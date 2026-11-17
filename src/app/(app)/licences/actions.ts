"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, blank, check, type ActionResult } from "@/lib/actions";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const text = (max: number) => z.preprocess(blank, z.string().trim().max(max).nullable().default(null));
const isoDate = z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable().default(null));

const schema = z
  .object({
    id: z.uuid().nullable().optional(),
    name: z.string().trim().min(1, "Enter the licence name").max(160),
    number: text(80),
    issued_by: text(160),
    apartment_id: z.preprocess(blank, z.string().max(40).nullable().default(null)),
    issued: isoDate,
    expires: isoDate,
    remind_days: z.preprocess(
      (v) => (v === "" || v == null ? 60 : Number(v)),
      z.number().int("Use whole days").min(0, "Must be 0 or more").max(730, "At most 730 days"),
    ),
    note: text(1000),
  })
  .refine((l) => !l.issued || !l.expires || l.expires >= l.issued, { message: "The expiry date must be after the issue date", path: ["expires"] });

const idSchema = z.object({ id: z.uuid() });

function done() {
  revalidatePath("/licences");
  revalidatePath("/today");
  return undefined;
}

export async function saveLicence(input: unknown): Promise<ActionResult> {
  return action(async () => {
    await requireOwner();
    const { id, ...v } = schema.parse(input);
    const supabase = await createClient();
    if (id) check(await supabase.from("beehive_licences").update(v).eq("id", id));
    else check(await supabase.from("beehive_licences").insert(v));
    return done();
  });
}

export async function deleteLicence(input: unknown): Promise<ActionResult> {
  return action(async () => {
    await requireOwner();
    const { id } = idSchema.parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_licences").delete().eq("id", id));
    return done();
  });
}
