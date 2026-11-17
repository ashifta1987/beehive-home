"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { requireOwner, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIST } from "@/lib/dates";
import { aptOrBoth, id, isoDate, optDate, optInt, optText, reqInt } from "@/components/jobs/schemas";

function revalidateLaundry() {
  revalidatePath("/laundry");
  revalidatePath("/today");
}

const laundrySchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), id.optional()),
  sent_date: isoDate,
  vendor: optText(120),
  apartment_id: aptOrBoth,
  items_sent: reqInt(1, 10_000),
  details: optText(1000),
  note: optText(1000),
  returned_date: optDate,
  items_returned: optInt(0, 10_000),
  cost: optInt(0, 10_000_000),
});

export async function saveLaundry(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireStaff();
    const v = laundrySchema.parse(input);
    const today = todayIST();
    if (v.sent_date > today) throw new UserError("errors.futureDate");
    if (v.returned_date && v.returned_date < v.sent_date) throw new UserError("errors.returnBeforeSent");
    if (v.returned_date && v.returned_date > today) throw new UserError("errors.futureDate");
    const supabase = await createClient();
    const row = {
      sent_date: v.sent_date,
      vendor: v.vendor,
      apartment_id: v.apartment_id,
      items_sent: v.items_sent,
      details: v.details,
      note: v.note,
    };
    if (v.id) {
      const returned = v.returned_date
        ? { returned_date: v.returned_date, items_returned: v.items_returned ?? v.items_sent, cost: v.cost }
        : { returned_date: null, items_returned: null, cost: v.cost };
      const rows = check(
        await supabase.from("beehive_laundry").update({ ...row, ...returned }).eq("id", v.id).select("id"),
      ) as Array<{ id: string }>;
      if (!rows.length) throw new UserError("errors.gone");
    } else {
      check(await supabase.from("beehive_laundry").insert(row));
    }
    revalidateLaundry();
  });
}

const returnSchema = z.object({
  id,
  returned_date: isoDate,
  items_returned: reqInt(0, 10_000),
  cost: optInt(0, 10_000_000),
});

export async function returnLaundry(input: unknown): Promise<ActionResult<{ short: number }>> {
  return action(async () => {
    await requireStaff();
    const v = returnSchema.parse(input);
    if (v.returned_date > todayIST()) throw new UserError("errors.futureDate");
    const supabase = await createClient();
    const { data: batch, error } = await supabase
      .from("beehive_laundry")
      .select("id, sent_date, items_sent")
      .eq("id", v.id)
      .maybeSingle<{ id: string; sent_date: string; items_sent: number }>();
    if (error) throw error;
    if (!batch) throw new UserError("errors.gone");
    if (v.returned_date < batch.sent_date) throw new UserError("errors.returnBeforeSent");
    check(
      await supabase
        .from("beehive_laundry")
        .update({ returned_date: v.returned_date, items_returned: v.items_returned, cost: v.cost })
        .eq("id", v.id),
    );
    revalidateLaundry();
    return { short: Math.max(0, batch.items_sent - v.items_returned) };
  });
}

export async function deleteLaundry(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { laundryId } = z.object({ laundryId: id }).parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_laundry").delete().eq("id", laundryId));
    revalidateLaundry();
  });
}
