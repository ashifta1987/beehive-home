import { getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { getApartments } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { monthRange } from "@/lib/finance";
import { todayIST } from "@/lib/dates";
import { inr } from "@/lib/money";
import type { BookingExtraStatus, BookingStatus, Extra } from "@/lib/types";
import { Card, CardTitle, PageHeader, Stat } from "@/components/ui/card";
import { dateLocale } from "../finance/_components/shared";
import { ExtrasCatalog } from "./extras-catalog";
import { BookedExtras } from "./booked-extras";
import type { BookedExtraRow } from "./constants";

type BookingJoin = { guest_name: string; apartment_id: string; check_in: string; check_out: string; status: BookingStatus };
type RawRow = Omit<BookedExtraRow, "guest_name" | "apartment_id" | "check_in" | "check_out"> & { booking: BookingJoin | BookingJoin[] | null };

const COLS = "id,booking_id,name,unit,qty,units,price,total,date,status,paid,booking:beehive_bookings!inner(guest_name,apartment_id,check_in,check_out,status)";

function flatten(rows: RawRow[] | null): BookedExtraRow[] {
  return (rows ?? []).flatMap(({ booking, ...x }) => {
    const b = Array.isArray(booking) ? booking[0] : booking;
    if (!b) return [];
    return [{ ...x, total: x.total ?? 0, guest_name: b.guest_name, apartment_id: b.apartment_id, check_in: b.check_in, check_out: b.check_out }];
  });
}

export default async function ExtrasPage() {
  await requireOwnerPage();
  const [t, locale, apartments, supabase] = await Promise.all([getTranslations("extras"), dateLocale(), getApartments(), createClient()]);
  const today = todayIST();
  const { start, end } = monthRange(today.slice(0, 7));
  const active: BookingExtraStatus[] = ["requested", "confirmed", "delivered"];

  const [catalog, upcoming, unpaid, month] = await Promise.all([
    supabase.from("beehive_extras").select("*").order("active", { ascending: false }).order("name"),
    supabase
      .from("beehive_booking_extras")
      .select(COLS)
      .in("status", active)
      .gte("booking.check_out", today)
      .neq("booking.status", "cancelled")
      .order("date")
      .limit(200),
    supabase
      .from("beehive_booking_extras")
      .select(COLS)
      .eq("paid", false)
      .neq("status", "cancelled")
      .gt("total", 0)
      .lt("booking.check_out", today)
      .neq("booking.status", "cancelled")
      .order("date", { ascending: false })
      .limit(200),
    supabase
      .from("beehive_booking_extras")
      .select("total,booking:beehive_bookings!inner(status)")
      .neq("status", "cancelled")
      .neq("booking.status", "cancelled")
      .gte("date", start)
      .lt("date", end),
  ]);
  if (catalog.error || upcoming.error || unpaid.error || month.error) throw new Error("Could not load paid extras");

  const extras = (catalog.data ?? []) as Extra[];
  const upcomingRows = flatten(upcoming.data as RawRow[] | null);
  const unpaidRows = flatten(unpaid.data as RawRow[] | null);
  const monthRows = (month.data ?? []) as { total: number | null }[];
  const monthTotal = monthRows.reduce((s, r) => s + (r.total ?? 0), 0);
  const unpaidTotal = unpaidRows.reduce((s, r) => s + r.total, 0);
  const aptOptions = apartments.map((a) => ({ id: a.id, code: a.code, name: a.name, tag_colour: a.tag_colour }));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mb-4 grid grid-cols-2 gap-2 min-[600px]:grid-cols-3">
        <Stat label={`${t("stats.month")} · ${t("stats.items", { count: monthRows.length })}`} value={inr(monthTotal)} />
        <Stat label={t("stats.unpaid")} value={inr(unpaidTotal)} tone={unpaidTotal > 0 ? "warn" : undefined} />
        <Stat label={t("stats.offered")} value={extras.filter((e) => e.active).length} className="col-span-2 min-[600px]:col-span-1" />
      </div>

      <ExtrasCatalog extras={extras} apartments={aptOptions} />

      <div className="grid gap-4 min-[960px]:grid-cols-2 min-[960px]:items-start">
        <Card>
          <CardTitle>{t("orders.title")}</CardTitle>
          <p className="-mt-2 mb-3 text-[13px] text-muted">{t("orders.hint")}</p>
          {upcomingRows.length ? (
            <BookedExtras rows={upcomingRows} apartments={aptOptions} locale={locale} mode="upcoming" />
          ) : (
            <p className="rounded-[14px] bg-surface-2 p-4 text-[14px] text-muted">{t("orders.empty")}</p>
          )}
        </Card>
        <Card>
          <CardTitle>{t("orders.unpaidTitle")}</CardTitle>
          <p className="-mt-2 mb-3 text-[13px] text-muted">{t("orders.unpaidHint")}</p>
          {unpaidRows.length ? (
            <BookedExtras rows={unpaidRows} apartments={aptOptions} locale={locale} mode="unpaid" />
          ) : (
            <p className="rounded-[14px] bg-ok-soft p-4 text-[14px] text-ok">{t("orders.unpaidEmpty")}</p>
          )}
        </Card>
      </div>
    </>
  );
}
