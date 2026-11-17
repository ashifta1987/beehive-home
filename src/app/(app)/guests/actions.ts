"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { action, check, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const profileSchema = z.object({
  key: z.string().regex(/^[pen].{1,200}$/, "Unknown guest."),
  tag: z.enum(["none", "repeat", "vip", "blocked"]),
  rating: z.coerce.number().int().min(1).max(5).nullish().transform((v) => v ?? null),
  nationality: optText(80),
  city: optText(80),
  notes: optText(2000),
});

/** Save a guest's tag, rating and notes (upsert on the guest key). Owner only. */
export async function saveGuestProfile(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const v = profileSchema.parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_guest_profiles").upsert(v, { onConflict: "key" }));
    revalidatePath("/guests");
    revalidatePath("/bookings");
    revalidatePath("/today");
  });
}
