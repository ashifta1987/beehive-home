"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, blank, check, type ActionResult } from "@/lib/actions";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseRupees } from "@/lib/money";

const text = (max: number) => z.preprocess(blank, z.string().trim().max(max).nullable().default(null));
const isoDate = z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").nullable().default(null));
const rupees = z.preprocess(
  (v) => (typeof v === "number" ? v : parseRupees(typeof v === "string" ? v : null)),
  z.number().int().min(0, "Must be 0 or more").max(10_000_000).nullable(),
);
const optInt = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().int().min(0).max(1_000_000).nullable(),
);
const url = z.preprocess(
  blank,
  z
    .string()
    .trim()
    .max(500)
    .refine((s) => /^https?:\/\/\S+$/i.test(s), "Start the link with https://")
    .nullable()
    .default(null),
);

const listingSchema = z.object({
  id: z.uuid().nullable().optional(),
  apartment_id: z.string().min(1, "Pick an apartment").max(40),
  channel: z.enum(["airbnb", "booking", "direct", "other"]),
  title: text(200),
  url,
  price: rupees,
  status: z.enum(["live", "paused", "draft"]),
  rating: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))),
    z.number().min(0).max(5, "Rating is out of 5").nullable(),
  ),
  reviews: optInt,
  note: text(1000),
});

const campaignSchema = z
  .object({
    id: z.uuid().nullable().optional(),
    name: z.string().trim().min(1, "Enter a name").max(120),
    channel: z.enum(["all", "airbnb", "booking", "direct", "instagram", "whatsapp", "google"]),
    spend: rupees,
    start: isoDate,
    end: isoDate,
    offer: text(1000),
    result: text(1000),
  })
  .refine((c) => !c.start || !c.end || c.end >= c.start, { message: "The end date must be on or after the start date", path: ["end"] });

const idSchema = z.object({ id: z.uuid() });

function done() {
  revalidatePath("/marketing");
  return undefined;
}

export async function saveListing(input: unknown): Promise<ActionResult> {
  return action(async () => {
    await requireOwner();
    const { id, ...v } = listingSchema.parse(input);
    const supabase = await createClient();
    if (id) check(await supabase.from("beehive_listings").update(v).eq("id", id));
    else check(await supabase.from("beehive_listings").insert(v));
    return done();
  });
}

export async function deleteListing(input: unknown): Promise<ActionResult> {
  return action(async () => {
    await requireOwner();
    const { id } = idSchema.parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_listings").delete().eq("id", id));
    return done();
  });
}

export async function saveCampaign(input: unknown): Promise<ActionResult> {
  return action(async () => {
    await requireOwner();
    const { id, spend, ...rest } = campaignSchema.parse(input);
    const v = { ...rest, spend: spend ?? 0 };
    const supabase = await createClient();
    if (id) check(await supabase.from("beehive_campaigns").update(v).eq("id", id));
    else check(await supabase.from("beehive_campaigns").insert(v));
    return done();
  });
}

export async function deleteCampaign(input: unknown): Promise<ActionResult> {
  return action(async () => {
    await requireOwner();
    const { id } = idSchema.parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_campaigns").delete().eq("id", id));
    return done();
  });
}

/** The owner sent (or decided not to send) a review request: hide the guest from the list. */
export async function markReviewAsked(input: unknown): Promise<ActionResult> {
  return action(async () => {
    await requireOwner();
    const { id } = idSchema.parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_bookings").update({ review_asked: true }).eq("id", id));
    revalidatePath("/guests");
    return done();
  });
}
