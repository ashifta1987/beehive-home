import { formatInTimeZone } from "date-fns-tz";
import { getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { getApartments } from "@/lib/data";
import { addDaysISO, TZ } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Checkin } from "@/lib/types";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, ErrorBox } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { CheckinsInbox, type InboxBooking, type InboxCheckin } from "./checkins-inbox";

export const dynamic = "force-dynamic";

const BOOKING_COLS = "id, apartment_id, guest_name, phone, check_in, check_out, adults, children, status, id_verified, foreign_national, channel";

export default async function CheckinsPage() {
  await requireOwnerPage();
  const t = await getTranslations("checkins");
  const supabase = await createClient();

  const [apartments, newRes, doneRes] = await Promise.all([
    getApartments(),
    supabase.from("beehive_checkins").select("*").eq("reviewed", false).order("created_at", { ascending: false }).limit(100),
    supabase.from("beehive_checkins").select("*").eq("reviewed", true).order("created_at", { ascending: false }).limit(40),
  ]);

  const loadFailed = !!(newRes.error || doneRes.error);
  const rows = [...((newRes.data ?? []) as Checkin[]), ...((doneRes.data ?? []) as Checkin[])];
  const checkins: InboxCheckin[] = rows.map((c) => ({ ...c, created_date: formatInTimeZone(new Date(c.created_at), TZ, "yyyy-MM-dd") }));

  // Bookings that could match: around the check-in dates, plus any already linked.
  let bookings: InboxBooking[] = [];
  let formC: string[] = [];
  if (checkins.length > 0) {
    const dates = checkins.map((c) => c.created_date).sort();
    const from = addDaysISO(dates[0], -30);
    const to = addDaysISO(dates[dates.length - 1], 30);
    const linked = Array.from(new Set(checkins.map((c) => c.booking_id).filter((x): x is string => !!x)));
    const [nearRes, linkedRes, formRes] = await Promise.all([
      supabase.from("beehive_bookings").select(BOOKING_COLS).neq("status", "cancelled").gte("check_in", from).lte("check_in", to).order("check_in"),
      linked.length ? supabase.from("beehive_bookings").select(BOOKING_COLS).in("id", linked) : Promise.resolve({ data: [], error: null }),
      linked.length ? supabase.from("beehive_foreign_records").select("booking_id, passport_no").in("booking_id", linked) : Promise.resolve({ data: [], error: null }),
    ]);
    const map = new Map<string, InboxBooking>();
    for (const b of [...((nearRes.data ?? []) as InboxBooking[]), ...((linkedRes.data ?? []) as InboxBooking[])]) map.set(b.id, b);
    bookings = Array.from(map.values()).sort((a, b) => a.check_in.localeCompare(b.check_in));
    formC = ((formRes.data ?? []) as Array<{ booking_id: string; passport_no: string | null }>).filter((r) => r.passport_no).map((r) => r.booking_id);
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <ButtonLink href="/posters" variant="secondary">
            <Icon name="qr" size={18} /> {t("posters")}
          </ButtonLink>
        }
      />
      {loadFailed ? (
        <div className="mb-4">
          <ErrorBox>{t("loadError")}</ErrorBox>
        </div>
      ) : null}
      <CheckinsInbox
        checkins={checkins}
        bookings={bookings}
        formC={formC}
        apartments={apartments.map((a) => ({ id: a.id, code: a.code, name: a.name, tag_colour: a.tag_colour }))}
      />
    </>
  );
}
