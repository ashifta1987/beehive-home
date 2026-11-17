import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApartments } from "@/lib/data";
import { buildGuestIndex } from "@/lib/bookings";
import type { GuestProfile } from "@/lib/types";
import { GuestsView, type GuestBookingRow } from "./guests-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("guests");
  return { title: t("title") };
}

export default async function GuestsPage() {
  await requireOwnerPage();
  const supabase = await createClient();
  const [apartments, bookings, issues, profiles] = await Promise.all([
    getApartments(),
    supabase
      .from("beehive_bookings")
      .select("id,apartment_id,guest_name,phone,email,check_in,check_out,status,total,commission,channel,foreign_national")
      .order("check_in", { ascending: false }),
    supabase.from("beehive_issues").select("category,booking_id").eq("category", "missing").not("booking_id", "is", null),
    supabase.from("beehive_guest_profiles").select("key,tag,rating,nationality,city,notes"),
  ]);
  if (bookings.error || issues.error || profiles.error) throw new Error("Could not load guests");

  const guests = buildGuestIndex(
    (bookings.data ?? []) as GuestBookingRow[],
    (issues.data ?? []) as { category: "missing"; booking_id: string }[],
    (profiles.data ?? []) as GuestProfile[],
  );

  return (
    <GuestsView
      guests={guests}
      apartments={apartments.map((a) => ({ id: a.id, code: a.code, tag_colour: a.tag_colour }))}
    />
  );
}
