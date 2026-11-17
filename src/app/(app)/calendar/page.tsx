import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApartments } from "@/lib/data";
import { daysInMonth, todayIST } from "@/lib/dates";
import { CalendarView, type CalBooking } from "./calendar-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return { title: t("title") };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwnerPage();
  const sp = await searchParams;
  const today = todayIST();
  const rawM = sp.m ?? sp.month;
  const raw = Array.isArray(rawM) ? rawM[0] : rawM;
  const valid = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) && Number(raw.slice(0, 4)) >= 2000 && Number(raw.slice(0, 4)) <= 2100;
  const month = valid ? raw : today.slice(0, 7);
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;

  const supabase = await createClient();
  const [apartments, res] = await Promise.all([
    getApartments(),
    supabase
      .from("beehive_bookings")
      .select("id,apartment_id,guest_name,check_in,check_out,channel,adults,children,status")
      .neq("status", "cancelled")
      .gte("check_out", first)
      .lte("check_in", last)
      .order("check_in"),
  ]);
  if (res.error) throw new Error("Could not load the calendar");

  return (
    <CalendarView
      month={month}
      today={today}
      apartments={apartments.map((a) => ({ id: a.id, code: a.code, name: a.name, tag_colour: a.tag_colour }))}
      bookings={(res.data ?? []) as CalBooking[]}
    />
  );
}
