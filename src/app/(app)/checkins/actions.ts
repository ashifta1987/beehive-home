"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import type { Checkin } from "@/lib/types";

const BUCKET = "beehive-ids";
const SIGNED_URL_SECONDS = 600;

const id = z.uuid();

async function loadCheckin(checkinId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("beehive_checkins").select("*").eq("id", checkinId).maybeSingle<Checkin>();
  if (error) throw error;
  if (!data) throw new UserError("This check-in no longer exists.");
  return { supabase, checkin: data };
}

function refresh() {
  revalidatePath("/checkins");
  revalidatePath("/bookings");
  revalidatePath("/foreign");
  revalidatePath("/today");
}

export interface CheckinPhoto {
  src: string;
}

/** Short-lived signed URLs (≤ 600 s) for a check-in's ID photos in the private bucket. */
export async function getCheckinPhotos(input: unknown): Promise<ActionResult<CheckinPhoto[]>> {
  return action(async () => {
    await requireOwner();
    const checkinId = id.parse(input);
    const supabase = await createClient();
    const files = check(
      await supabase.from("beehive_checkin_files").select("path, created_at").eq("checkin_id", checkinId).order("created_at"),
    ) as Array<{ path: string }> | null;
    const photos: CheckinPhoto[] = [];
    if (files && files.length > 0) {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(files.map((f) => f.path), SIGNED_URL_SECONDS);
      if (error) throw error;
      for (const s of data ?? []) if (s.signedUrl) photos.push({ src: s.signedUrl });
    }
    return photos;
  });
}

const matchSchema = z.object({ checkinId: id, bookingId: id.nullable() });

/** Link a check-in to a booking of the same apartment (or unlink with null). */
export async function matchCheckin(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const v = matchSchema.parse(input);
    const { supabase, checkin } = await loadCheckin(v.checkinId);
    if (v.bookingId) {
      const { data: b, error } = await supabase
        .from("beehive_bookings")
        .select("id, apartment_id, status")
        .eq("id", v.bookingId)
        .maybeSingle<{ id: string; apartment_id: string; status: string }>();
      if (error) throw error;
      if (!b) throw new UserError("That booking no longer exists.");
      if (b.apartment_id !== checkin.apartment) throw new UserError("Pick a booking in the same apartment as the check-in.");
      if (b.status === "cancelled") throw new UserError("That booking is cancelled. Pick another one.");
    }
    check(await supabase.from("beehive_checkins").update({ booking_id: v.bookingId }).eq("id", v.checkinId));
    refresh();
  });
}

/** Copy passport / visa details into the booking's Form C record and flag it foreign. */
export async function copyToFormC(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { supabase, checkin: c } = await loadCheckin(id.parse(input));
    if (!c.booking_id) throw new UserError("Match this check-in to a booking first.");
    if (!c.is_foreign) throw new UserError("This guest said they are Indian, so there is nothing to copy for Form C.");
    const fields = {
      nationality: c.nationality,
      passport_no: c.passport_no,
      passport_expiry: c.passport_expiry,
      visa_no: c.visa_no,
      visa_type: c.visa_type,
      visa_expiry: c.visa_expiry,
      arrived_india: c.arrived_india,
      arriving_from: c.arriving_from,
      next_destination: c.next_destination,
    };
    // Only send filled-in values so nothing the owner already typed is wiped.
    const row: Record<string, string> = { booking_id: c.booking_id };
    for (const [k, val] of Object.entries(fields)) if (val) row[k] = val;
    check(await supabase.from("beehive_foreign_records").upsert(row, { onConflict: "booking_id" }));
    check(await supabase.from("beehive_bookings").update({ foreign_national: true }).eq("id", c.booking_id));
    refresh();
  });
}

/** Owner confirms they checked the ID photos: sets the booking's id_verified. */
export async function markIdVerified(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { supabase, checkin: c } = await loadCheckin(id.parse(input));
    if (!c.booking_id) throw new UserError("Match this check-in to a booking first.");
    check(await supabase.from("beehive_bookings").update({ id_verified: true }).eq("id", c.booking_id));
    refresh();
  });
}

const reviewedSchema = z.object({ checkinId: id, reviewed: z.boolean() });

export async function setReviewed(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const v = reviewedSchema.parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_checkins").update({ reviewed: v.reviewed }).eq("id", v.checkinId));
    revalidatePath("/checkins");
  });
}
