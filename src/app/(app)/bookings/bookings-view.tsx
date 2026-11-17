"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Booking, TagColour } from "@/lib/types";
import { BOOKING_FILTERS, canCheckIn, canCheckOut, filterBookings, inFilter, type BookingFilter } from "@/lib/bookings";
import { fmtDay, nights } from "@/lib/dates";
import { inr } from "@/lib/money";
import { cn } from "@/lib/ui";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { Card, EmptyState, ErrorBox, PageHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AptChip, ChannelPill, Pill, type Tone } from "@/components/ui/pill";
import { useAction } from "@/components/ui/toast";
import { BookingSheet } from "@/components/bookings/booking-sheet";
import { setBookingStatus } from "@/components/bookings/actions";

export interface BookingRow {
  booking: Booking;
  aptCode: string;
  aptTag: TagColour;
  waHref: string | null;
  extrasTotal: number;
  extrasUnpaid: number;
  blocked: boolean;
}

export type SheetIntent =
  | { mode: "new"; apartmentId: string | null; date: string | null }
  | { mode: "edit"; id: string }
  | null;

const STATUS_TONE: Record<Booking["status"], Tone> = {
  confirmed: "info",
  checked_in: "ok",
  checked_out: "neutral",
  cancelled: "bad",
};
const PAY_TONE: Record<Booking["payment_status"], Tone> = {
  channel: "neutral",
  paid: "ok",
  partial: "warn",
  pending: "warn",
};
const DEP_TONE: Record<Booking["deposit_status"], Tone> = {
  none: "neutral",
  held: "warn",
  refunded: "ok",
  deducted: "info",
};

export function BookingsView({
  rows,
  today,
  intent,
  hasApartments,
}: {
  rows: BookingRow[];
  today: string;
  intent: SheetIntent;
  hasApartments: boolean;
}) {
  const t = useTranslations("bookings");
  const router = useRouter();
  const [filter, setFilter] = useState<BookingFilter>("current");
  const [query, setQuery] = useState("");

  // The URL (?new=1, ?edit=…, ?apartment=&date=) opens the sheet; re-sync when it changes.
  const intentKey = JSON.stringify(intent);
  const [seen, setSeen] = useState(intentKey);
  const [sheet, setSheet] = useState<SheetIntent>(intent);
  if (seen !== intentKey) {
    setSeen(intentKey);
    setSheet(intent);
  }
  function closeSheet() {
    setSheet(null);
    if (intent) router.replace("/bookings", { scroll: false });
  }

  const status = useAction();
  const [busy, setBusy] = useState<string | null>(null);
  function changeStatus(id: string, s: "checked_in" | "checked_out") {
    setBusy(id);
    void status
      .run(() => setBookingStatus({ id, status: s }), { success: s === "checked_in" ? t("list.checkedIn") : t("list.checkedOut") })
      .finally(() => setBusy(null));
  }

  const counts = useMemo(() => {
    const c: Record<BookingFilter, number> = { current: 0, past: 0, cancelled: 0, all: rows.length };
    for (const r of rows) {
      if (inFilter(r.booking, "current", today)) c.current++;
      else if (inFilter(r.booking, "past", today)) c.past++;
      else if (inFilter(r.booking, "cancelled", today)) c.cancelled++;
    }
    return c;
  }, [rows, today]);

  const shown = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.booking.id, r]));
    return filterBookings(rows.map((r) => r.booking), filter, query, today).map((b) => byId.get(b.id)!);
  }, [rows, filter, query, today]);

  const actions = (
    <>
      <a href="/api/export/bookings" download className={buttonClass("secondary", "md")}>
        <Icon name="download" size={18} />
        {t("exportCsv")}
      </a>
      {hasApartments ? (
        <Button variant="honey" onClick={() => setSheet({ mode: "new", apartmentId: null, date: null })}>
          <Icon name="plus" size={18} />
          {t("newBooking")}
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={actions} />

      {!rows.length ? (
        <EmptyState
          icon={<Icon name="bookings" size={32} />}
          title={t("empty.title")}
          body={hasApartments ? t("empty.body") : t("empty.noApartments")}
          action={
            hasApartments ? (
              <Button variant="honey" onClick={() => setSheet({ mode: "new", apartmentId: null, date: null })}>
                {t("empty.action")}
              </Button>
            ) : (
              <ButtonLink href="/apartments">{t("empty.addApartment")}</ButtonLink>
            )
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 min-[960px]:flex-row min-[960px]:items-center min-[960px]:justify-between">
            <div role="group" aria-label={t("list.filterLabel")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 min-[960px]:mx-0 min-[960px]:px-0">
              {BOOKING_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"

                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "inline-flex min-h-11 flex-none items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition",
                    filter === f ? "bg-ink text-surface" : "bg-surface text-ink hover:bg-surface-2",
                  )}
                >
                  {t(`filters.${f}`)}
                  <span className={cn("tabular text-[12.5px]", filter === f ? "opacity-80" : "text-muted")}>{counts[f]}</span>
                </button>
              ))}
            </div>
            <label className="relative block min-[960px]:w-[320px]">
              <span className="sr-only">{t("list.searchLabel")}</span>
              <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("list.searchPh")}
                className="w-full rounded-[13px] border-[1.5px] border-transparent bg-surface py-3 pl-10 pr-3.5 text-[16px] text-ink outline-none placeholder:text-muted/70 focus:border-accent"
              />
            </label>
          </div>

          <ErrorBox>{status.error}</ErrorBox>

          {shown.length ? (
            <ul className="mt-1 grid gap-3 min-[1200px]:grid-cols-2">
              {shown.map((r) => (
                <BookingCard
                  key={r.booking.id}
                  row={r}
                  today={today}
                  busy={busy === r.booking.id && status.pending}
                  onEdit={() => setSheet({ mode: "edit", id: r.booking.id })}
                  onStatus={(s) => changeStatus(r.booking.id, s)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              title={query ? t("list.noMatchTitle") : t(`list.emptyTab.${filter}`)}
              body={query ? t("list.noMatchBody") : undefined}
              action={
                query ? (
                  <Button variant="secondary" onClick={() => setQuery("")}>{t("list.clearSearch")}</Button>
                ) : undefined
              }
            />
          )}
        </>
      )}

      <BookingSheet
        open={sheet != null}
        onClose={closeSheet}
        bookingId={sheet?.mode === "edit" ? sheet.id : null}
        preset={sheet?.mode === "new" ? { apartmentId: sheet.apartmentId, date: sheet.date } : undefined}
      />
    </>
  );
}

function BookingCard({
  row,
  today,
  busy,
  onEdit,
  onStatus,
}: {
  row: BookingRow;
  today: string;
  busy: boolean;
  onEdit: () => void;
  onStatus: (s: "checked_in" | "checked_out") => void;
}) {
  const t = useTranslations("bookings");
  const b = row.booking;
  const n = nights(b.check_in, b.check_out);
  const guests = b.adults + b.children;
  const live = b.status !== "cancelled" && b.check_out >= today;

  return (
    <Card as="li" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <AptChip tag={row.aptTag} code={row.aptCode} />
            <h2 className="min-w-0 truncate text-[16px] font-bold">{b.guest_name}</h2>
          </div>
          <p className="tabular text-[13.5px] text-muted">
            {fmtDay(b.check_in)} → {fmtDay(b.check_out)} · {t("list.nights", { count: n })} · {t("list.guests", { count: guests })}
          </p>
        </div>
        <div className="flex flex-none flex-col items-end">
          <span className="tabular text-[16px] font-bold">{inr(b.total)}</span>
          {b.commission ? <span className="tabular text-[12px] text-muted">{t("list.net", { amount: inr(b.total - b.commission) })}</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ChannelPill channel={b.channel} />
        <Pill tone={STATUS_TONE[b.status]}>{t(`status.${b.status}`)}</Pill>
        {b.status !== "cancelled" ? <Pill tone={PAY_TONE[b.payment_status]}>{t(`paymentPill.${b.payment_status}`)}</Pill> : null}
        {b.deposit_status !== "none" ? (
          <Pill tone={DEP_TONE[b.deposit_status]}>
            {t(`depositPill.${b.deposit_status}`)}
            {b.deposit ? ` ${inr(b.deposit)}` : ""}
          </Pill>
        ) : null}
        {b.status !== "cancelled" ? (
          b.id_verified ? (
            <Pill tone="ok"><Icon name="check" size={14} />{t("list.idVerified")}</Pill>
          ) : live ? (
            <Pill tone="warn">{t("list.idNotVerified")}</Pill>
          ) : null
        ) : null}
        {b.foreign_national ? <Pill tone="info">{t("list.foreign")}</Pill> : null}
        {row.blocked ? <Pill tone="bad"><Icon name="alert" size={14} />{t("list.blocked")}</Pill> : null}
        {row.extrasTotal ? (
          <Pill tone={row.extrasUnpaid ? "warn" : "ok"}>
            {row.extrasUnpaid
              ? t("list.extrasUnpaid", { total: inr(row.extrasTotal), unpaid: inr(row.extrasUnpaid) })
              : t("list.extras", { total: inr(row.extrasTotal) })}
          </Pill>
        ) : null}
        {b.channel_ref ? <span className="text-[12px] text-muted">{t("list.ref", { ref: b.channel_ref })}</span> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {canCheckIn(b, today) ? (
          <Button size="sm" className="min-h-11" disabled={busy} onClick={() => onStatus("checked_in")}>
            <Icon name="key" size={16} />
            {t("list.checkIn")}
          </Button>
        ) : null}
        {canCheckOut(b) ? (
          <Button size="sm" className="min-h-11" disabled={busy} onClick={() => onStatus("checked_out")}>
            <Icon name="logout" size={16} />
            {t("list.checkOut")}
          </Button>
        ) : null}
        {row.waHref && b.status !== "cancelled" ? (
          <a href={row.waHref} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm", "min-h-11")}>
            <Icon name="whatsapp" size={16} />
            {t("list.whatsapp")}
          </a>
        ) : null}
        <Button variant="secondary" size="sm" className="min-h-11" onClick={onEdit}>
          <Icon name="edit" size={16} />
          {t("list.edit")}
        </Button>
      </div>
    </Card>
  );
}
