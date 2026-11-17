import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApartments, aptMap } from "@/lib/data";
import { todayIST } from "@/lib/dates";
import { guestKey, waLink, welcomeMessage } from "@/lib/guest";
import type { Booking, Extra } from "@/lib/types";
import { BookingsView, type BookingRow, type SheetIntent } from "./bookings-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bookings");
  return { title: t("title") };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwnerPage();
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayIST();

  const [apartments, bookingsRes, extrasRes, bxRes, blockedRes] = await Promise.all([
    getApartments(),
    supabase.from("beehive_bookings").select("*").order("check_in", { ascending: false }),
    supabase.from("beehive_extras").select("*").eq("active", true),
    supabase.from("beehive_booking_extras").select("booking_id,total,paid,status"),
    supabase.from("beehive_guest_profiles").select("key").eq("tag", "blocked"),
  ]);
  if (bookingsRes.error || extrasRes.error || bxRes.error || blockedRes.error) {
    throw new Error("Could not load bookings");
  }

  const apts = aptMap(apartments);
  const extras = (extrasRes.data ?? []) as Extra[];
  const blocked = new Set(((blockedRes.data ?? []) as { key: string }[]).map((r) => r.key));
  const extraSums = new Map<string, { total: number; unpaid: number }>();
  for (const x of (bxRes.data ?? []) as { booking_id: string; total: number; paid: boolean; status: string }[]) {
    if (x.status === "cancelled") continue;
    const s = extraSums.get(x.booking_id) ?? { total: 0, unpaid: 0 };
    s.total += x.total;
    if (!x.paid) s.unpaid += x.total;
    extraSums.set(x.booking_id, s);
  }

  const rows: BookingRow[] = ((bookingsRes.data ?? []) as Booking[]).map((b) => {
    const apt = apts[b.apartment_id];
    const msg = apt ? welcomeMessage(b, apt, extras) : "";
    return {
      booking: b,
      aptCode: apt?.code ?? b.apartment_id,
      aptTag: apt?.tag_colour ?? "tag1",
      waHref: msg.trim() ? waLink(b.phone, msg) : null,
      extrasTotal: extraSums.get(b.id)?.total ?? 0,
      extrasUnpaid: extraSums.get(b.id)?.unpaid ?? 0,
      blocked: blocked.has(guestKey(b)),
    };
  });

  const edit = one(sp.edit) ?? one(sp.open);
  const date = one(sp.date);
  const apartment = one(sp.apartment);
  const intent: SheetIntent =
    edit && UUID.test(edit)
      ? { mode: "edit", id: edit }
      : one(sp.new) === "1" || apartment || date
        ? {
            mode: "new",
            apartmentId: apartment && apts[apartment] ? apartment : null,
            date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
          }
        : null;

  return <BookingsView rows={rows} today={today} intent={intent} hasApartments={apartments.length > 0} />;
}
