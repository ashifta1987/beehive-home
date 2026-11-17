"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayIST } from "@/lib/dates";
import type { Apartment, Booking, BookingExtra, Extra } from "@/lib/types";
import type { ExtraUse } from "@/lib/bookings";
import { bookingSchema, statusChangeSchema } from "./schema";

export type FormApartment = Pick<Apartment, "id" | "name" | "code" | "tag_colour" | "check_in_time" | "check_out_time" | "max_guests">;
export type FormStay = Pick<Booking, "id" | "apartment_id" | "check_in" | "check_out" | "status" | "guest_name">;

export interface BookingFormData {
  today: string;
  apartments: FormApartment[];
  catalog: Extra[];
  booking: Booking | null;
  bookingExtras: BookingExtra[];
  /** other bookings near these dates: overlap hint + extras stock check */
  stays: FormStay[];
  uses: ExtraUse[];
  /** guest keys tagged "blocked" in Guests */
  blockedKeys: string[];
}

const PATHS = ["/bookings", "/calendar", "/guests", "/today", "/finance", "/extras", "/foreign", "/jobs"];
const revalidateAll = () => PATHS.forEach((p) => revalidatePath(p));

/** Everything the booking sheet needs, loaded when it opens. Owner only (RLS too). */
export async function loadBookingForm(input: unknown): Promise<ActionResult<BookingFormData>> {
  return action(async () => {
    await requireOwner();
    const { id } = z.object({ id: z.uuid().nullish() }).parse(input ?? {});
    const supabase = await createClient();
    const today = todayIST();

    let booking: Booking | null = null;
    let bookingExtras: BookingExtra[] = [];
    if (id) {
      booking = check(await supabase.from("beehive_bookings").select("*").eq("id", id).maybeSingle<Booking>());
      if (!booking) throw new UserError("This booking no longer exists. It may have been deleted.");
      bookingExtras = check(
        await supabase.from("beehive_booking_extras").select("*").eq("booking_id", id).order("date").order("created_at"),
      ) as BookingExtra[];
    }

    // Bookings that could overlap the stay being edited (or anything from two months ago on).
    const from = addDaysISO(booking && booking.check_in < today ? booking.check_in : today, -60);
    const [apts, catalog, stays, blocked] = await Promise.all([
      supabase
        .from("beehive_apartments")
        .select("id,name,code,tag_colour,check_in_time,check_out_time,max_guests")
        .order("sort"),
      supabase.from("beehive_extras").select("*").order("name"),
      supabase
        .from("beehive_bookings")
        .select("id,apartment_id,check_in,check_out,status,guest_name")
        .gte("check_out", from)
        .neq("status", "cancelled")
        .order("check_in"),
      supabase.from("beehive_guest_profiles").select("key").eq("tag", "blocked"),
    ]);
    const stayRows = (check(stays) ?? []) as FormStay[];
    const ids = stayRows.map((s) => s.id);
    let uses: ExtraUse[] = [];
    if (ids.length) {
      uses = (check(
        await supabase
          .from("beehive_booking_extras")
          .select("booking_id,extra_id,qty,status")
          .in("booking_id", ids)
          .not("extra_id", "is", null),
      ) ?? []) as ExtraUse[];
    }
    return {
      today,
      apartments: (check(apts) ?? []) as FormApartment[],
      catalog: (check(catalog) ?? []) as Extra[],
      booking,
      bookingExtras,
      stays: stayRows,
      uses,
      blockedKeys: ((check(blocked) ?? []) as { key: string }[]).map((r) => r.key),
    };
  });
}

/** Create or update a booking together with its paid extras. Returns the booking id. */
export async function saveBooking(input: unknown): Promise<ActionResult<{ id: string }>> {
  return action(async () => {
    await requireOwner();
    const v = bookingSchema.parse(input);
    const supabase = await createClient();

    // Catalog lines take name and unit from the catalog so they always match it.
    const catalogIds = [...new Set(v.extras.map((x) => x.extra_id).filter((x): x is string => !!x))];
    const catalog = new Map<string, Pick<Extra, "id" | "name" | "unit">>();
    if (catalogIds.length) {
      const rows = check(await supabase.from("beehive_extras").select("id,name,unit").in("id", catalogIds)) ?? [];
      for (const r of rows as Pick<Extra, "id" | "name" | "unit">[]) catalog.set(r.id, r);
      if (catalog.size !== catalogIds.length) throw new UserError("One of the extras was removed from the catalog. Remove it from this booking and try again.");
    }

    const { extras, id, ...fields } = v;
    let bookingId: string;
    const isNew = !id;
    if (id) {
      const row = check(
        await supabase.from("beehive_bookings").update(fields).eq("id", id).select("id").maybeSingle<{ id: string }>(),
      );
      if (!row) throw new UserError("This booking no longer exists. It may have been deleted.");
      bookingId = row.id;
    } else {
      const row = check(await supabase.from("beehive_bookings").insert(fields).select("id").single<{ id: string }>());
      if (!row) throw new UserError("We could not save that. Check your connection and try again.");
      bookingId = row.id;
    }

    try {
      const existing = (check(
        await supabase.from("beehive_booking_extras").select("id").eq("booking_id", bookingId),
      ) ?? []) as { id: string }[];
      const existingIds = new Set(existing.map((r) => r.id));
      const keep = new Set(extras.map((x) => x.id).filter((x): x is string => !!x && existingIds.has(x)));
      const remove = [...existingIds].filter((x) => !keep.has(x));
      if (remove.length) {
        check(await supabase.from("beehive_booking_extras").delete().eq("booking_id", bookingId).in("id", remove));
      }
      const toRow = (x: (typeof extras)[number]) => {
        const cat = x.extra_id ? catalog.get(x.extra_id) : undefined;
        return {
          booking_id: bookingId,
          extra_id: x.extra_id,
          name: cat?.name ?? x.name,
          unit: cat?.unit ?? x.unit,
          qty: x.qty,
          units: x.units,
          price: x.price,
          date: x.date,
          status: x.status,
          paid: x.paid,
        };
      };
      for (const x of extras) {
        if (x.id && keep.has(x.id)) {
          check(await supabase.from("beehive_booking_extras").update(toRow(x)).eq("id", x.id).eq("booking_id", bookingId));
        }
      }
      const inserts = extras.filter((x) => !(x.id && keep.has(x.id))).map(toRow);
      if (inserts.length) check(await supabase.from("beehive_booking_extras").insert(inserts));
    } catch (e) {
      // Keep it all-or-nothing for a new booking: never leave a booking without the extras the owner added.
      if (isNew) await supabase.from("beehive_bookings").delete().eq("id", bookingId);
      throw e;
    }

    revalidateAll();
    return { id: bookingId };
  });
}

export async function deleteBooking(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { id } = z.object({ id: z.uuid() }).parse(input);
    const supabase = await createClient();
    const rows = check(await supabase.from("beehive_bookings").delete().eq("id", id).select("id")) ?? [];
    if (!rows.length) throw new UserError("This booking was already deleted.");
    revalidateAll();
  });
}

/** Check in / Check out buttons on the list. */
export async function setBookingStatus(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { id, status } = statusChangeSchema.parse(input);
    const supabase = await createClient();
    const from = status === "checked_in" ? "confirmed" : "checked_in";
    const rows = check(
      await supabase.from("beehive_bookings").update({ status }).eq("id", id).eq("status", from).select("id"),
    ) ?? [];
    if (!rows.length) throw new UserError("This booking changed in the meantime. Refresh and try again.");
    revalidateAll();
  });
}
