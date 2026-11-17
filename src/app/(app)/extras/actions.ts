"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { aptId, optText, uuid } from "../finance/_components/schema";
import { BOOKING_EXTRA_STATUSES, EXTRA_UNITS } from "./constants";

const optInt = (max: number) => z.number().int().min(0).max(max).nullable().default(null);

const extraSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Give the extra a name").max(80),
  price: optInt(1_000_000),
  unit: z.enum(EXTRA_UNITS),
  apartment_id: aptId,
  qty: optInt(999),
  deposit: optInt(1_000_000),
  description: optText(500),
  setup_note: optText(300),
  return_check: z.boolean(),
  active: z.boolean(),
});

function revalidateExtras() {
  revalidatePath("/extras");
  revalidatePath("/bookings");
  revalidatePath("/finance");
  revalidatePath("/today");
  revalidatePath("/jobs");
}

export async function saveExtra(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { id, ...v } = extraSchema.parse(input);
    const supabase = await createClient();
    if (id) {
      const rows = check(await supabase.from("beehive_extras").update(v).eq("id", id).select("id"));
      if (!rows?.length) throw new UserError("This extra no longer exists. Refresh the page.");
    } else {
      check(await supabase.from("beehive_extras").insert(v));
    }
    revalidateExtras();
  });
}

const statusSchema = z.object({ id: uuid, status: z.enum(BOOKING_EXTRA_STATUSES) });

/** Change a booked extra's status (requested → confirmed → given to guest → returned, or cancelled). */
export async function setBookingExtraStatus(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { id, status } = statusSchema.parse(input);
    const supabase = await createClient();
    const rows = check(await supabase.from("beehive_booking_extras").update({ status }).eq("id", id).select("id"));
    if (!rows?.length) throw new UserError("This booked extra no longer exists. Refresh the page.");
    revalidateExtras();
  });
}

const paidSchema = z.object({ id: uuid, paid: z.boolean() });

export async function setBookingExtraPaid(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { id, paid } = paidSchema.parse(input);
    const supabase = await createClient();
    const rows = check(await supabase.from("beehive_booking_extras").update({ paid }).eq("id", id).select("id"));
    if (!rows?.length) throw new UserError("This booked extra no longer exists. Refresh the page.");
    revalidateExtras();
  });
}
