"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { requireOwner, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIST } from "@/lib/dates";
import type { Booking, Issue } from "@/lib/types";
import { CHARGE_NAME, ISSUE_CATEGORIES, ISSUE_PRIORITIES } from "@/components/jobs/constants";
import { aptOrBoth, bool, id, optInt, reqText } from "@/components/jobs/schemas";

function revalidateIssues() {
  revalidatePath("/maintenance");
  revalidatePath("/today");
  revalidatePath("/assets");
}

const issueSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), id.optional()),
  apartment_id: aptOrBoth,
  category: z.enum(ISSUE_CATEGORIES),
  priority: z.enum(ISSUE_PRIORITIES),
  text: reqText(2000),
});

/** Report an issue (owner or housekeeper); housekeepers may edit their own open reports. */
export async function saveIssue(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    const s = await requireStaff();
    const v = issueSchema.parse(input);
    const supabase = await createClient();
    const row = { apartment_id: v.apartment_id, category: v.category, priority: v.priority, text: v.text };
    if (v.id) {
      let q = supabase.from("beehive_issues").update(row).eq("id", v.id);
      if (s.staff.role !== "owner") q = q.eq("reported_by", s.userId).eq("status", "open");
      const rows = check(await q.select("id")) as Array<{ id: string }>;
      if (!rows.length) throw new UserError("errors.ownReportsOnly");
    } else {
      check(await supabase.from("beehive_issues").insert({ ...row, status: "open" }));
    }
    revalidateIssues();
  });
}

const resolveSchema = z.object({
  id,
  resolution: reqText(2000),
  cost: optInt(0, 10_000_000),
  charge: optInt(0, 10_000_000),
  fromDeposit: bool,
});

/**
 * Owner resolves an issue. For mess / damage / missing issues linked to a booking the
 * owner may charge the guest (a one-off booking extra) and take it from the deposit.
 */
export async function resolveIssue(input: unknown): Promise<ActionResult<{ charged: boolean }>> {
  return action(async () => {
    const s = await requireOwner();
    const v = resolveSchema.parse(input);
    const supabase = await createClient();
    const { data: issue, error } = await supabase
      .from("beehive_issues")
      .select("id, category, booking_id, status")
      .eq("id", v.id)
      .maybeSingle<Pick<Issue, "id" | "category" | "booking_id" | "status">>();
    if (error) throw error;
    if (!issue) throw new UserError("errors.gone");

    const charge = v.charge ?? 0;
    const chargeName = CHARGE_NAME[issue.category];
    let booking: Pick<Booking, "id" | "deposit" | "deposit_status"> | null = null;
    if (charge > 0) {
      if (!issue.booking_id || !chargeName) throw new UserError("errors.chargeNotAllowed");
      const b = await supabase
        .from("beehive_bookings")
        .select("id, deposit, deposit_status")
        .eq("id", issue.booking_id)
        .maybeSingle<Pick<Booking, "id" | "deposit" | "deposit_status">>();
      if (b.error) throw b.error;
      if (!b.data) throw new UserError("errors.bookingGone");
      booking = b.data;
      if (v.fromDeposit) {
        if (booking.deposit_status !== "held") throw new UserError("errors.noDeposit");
        if (charge > booking.deposit) throw new UserError("errors.overDeposit");
      }
    } else if (v.fromDeposit) {
      throw new UserError("errors.chargeFirst");
    }

    check(
      await supabase
        .from("beehive_issues")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: s.userId,
          resolution: v.resolution,
          cost: v.cost,
        })
        .eq("id", issue.id),
    );

    if (booking && charge > 0 && chargeName) {
      check(
        await supabase.from("beehive_booking_extras").insert({
          booking_id: booking.id,
          extra_id: null,
          name: chargeName,
          unit: "event",
          qty: 1,
          units: 1,
          price: charge,
          date: todayIST(),
          status: "delivered",
          paid: v.fromDeposit,
        }),
      );
      if (v.fromDeposit) {
        check(await supabase.from("beehive_bookings").update({ deposit_status: "deducted" }).eq("id", booking.id));
      }
      revalidatePath("/bookings");
      revalidatePath("/finance");
    }
    revalidateIssues();
    return { charged: !!booking && charge > 0 };
  });
}

export async function reopenIssue(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { issueId } = z.object({ issueId: id }).parse(input);
    const supabase = await createClient();
    check(
      await supabase
        .from("beehive_issues")
        .update({ status: "open", resolved_at: null, resolved_by: null })
        .eq("id", issueId),
    );
    revalidateIssues();
  });
}

export async function deleteIssue(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { issueId } = z.object({ issueId: id }).parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_issues").delete().eq("id", issueId));
    revalidateIssues();
  });
}
