"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v ? v : null))
    .nullable()
    .optional();

const list = (maxItems: number, maxLen: number) =>
  z
    .array(z.string().trim().max(maxLen))
    .max(maxItems)
    .transform((a) => a.filter(Boolean))
    .optional();

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  .transform((v) => v.slice(0, 5));

/** Any subset of apartment fields; only the keys sent are changed. */
const schema = z
  .object({
    id: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
    name: z.string().trim().min(1).max(80).optional(),
    code: z.string().trim().min(1).max(12).optional(),
    tag_colour: z.enum(["tag1", "tag2", "tag3", "tag4"]).optional(),
    location: optText(120),
    bedrooms: z.number().int().min(0).max(20).nullable().optional(),
    max_guests: z.number().int().min(1).max(50).nullable().optional(),
    features: list(30, 60),
    check_in_time: time.optional(),
    check_out_time: time.optional(),
    cleaning_checklist: list(60, 200),
    arrival_checklist: list(40, 200),
    house_rules: list(30, 200),
    welcome_message: optText(2000),
    hk_notes: optText(2000),
    wifi_name: optText(64),
    wifi_password: optText(64),
  })
  .strict();

export async function saveApartment(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { id, ...raw } = schema.parse(input);
    const patch = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
    if (Object.keys(patch).length === 0) throw new UserError("Nothing to save.");
    const supabase = await createClient();
    const { data, error } = await supabase.from("beehive_apartments").update(patch).eq("id", id).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new UserError("That apartment no longer exists.");
    if (typeof patch.code === "string") {
      // Keep the door-key label in step with the short code (no key is read or changed).
      check(await supabase.from("beehive_door_keys").update({ label: patch.code }).eq("apartment", id));
    }
    revalidatePath("/", "layout");
  });
}
