"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, blank, check, UserError, type ActionResult } from "@/lib/actions";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIST } from "@/lib/dates";

const isoDate = z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable().default(null));
const text = (max: number) => z.preprocess(blank, z.string().trim().max(max).nullable().default(null));

const schema = z.object({
  booking_id: z.uuid(),
  nationality: z.string().trim().min(1, "Enter the nationality").max(80),
  passport_no: text(40),
  passport_expiry: isoDate,
  visa_no: text(40),
  visa_type: text(60),
  visa_expiry: isoDate,
  arrived_india: isoDate,
  arriving_from: text(120),
  next_destination: text(120),
  docs_collected: z.boolean().default(false),
  form_c_submitted: z.boolean().default(false),
  form_c_ref: text(60),
  form_c_date: isoDate,
  note: text(1000),
});

export type ForeignInput = z.input<typeof schema>;

/** Create or update the passport / visa / Form C record of one booking (owner only). */
export async function saveForeignRecord(input: unknown): Promise<ActionResult> {
  return action(async () => {
    await requireOwner();
    const v = schema.parse(input);
    if (v.form_c_submitted && !v.form_c_date) v.form_c_date = todayIST();
    if (!v.form_c_submitted) {
      // Keep the reference if typed, but a date without "submitted" makes no sense.
      v.form_c_date = null;
    }
    const supabase = await createClient();
    const booking = check(
      await supabase.from("beehive_bookings").select("id").eq("id", v.booking_id).maybeSingle(),
    );
    if (!booking) throw new UserError("This booking no longer exists.");
    check(await supabase.from("beehive_foreign_records").upsert(v, { onConflict: "booking_id" }));
    revalidatePath("/foreign");
    revalidatePath("/today");
    return undefined;
  });
}
