"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { Booking, TagColour } from "@/lib/types";
import { addDaysISO, addMonths, daysBetween, daysInMonth, fmtDay, fmtMonth, nights } from "@/lib/dates";
import { CHANNEL_LABEL } from "@/lib/guest";
import { cn, tagClasses } from "@/lib/ui";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AptChip, AptSquare, ChannelPill } from "@/components/ui/pill";
import { BookingSheet, type BookingPreset } from "@/components/bookings/booking-sheet";

export type CalBooking = Pick<
  Booking,
  "id" | "apartment_id" | "guest_name" | "check_in" | "check_out" | "channel" | "adults" | "children" | "status"
>;
interface CalApartment {
  id: string;
  code: string;
  name: string;
  tag_colour: TagColour;
}

/** Solid bar colours per channel (tokens only). */
const BAR: Record<string, string> = {
  airbnb: "bg-airbnb text-surface",
  booking: "bg-booking text-surface",
  direct: "bg-direct text-surface",
  other: "bg-other text-surface",
};

const HALF = 17; // px per half day on phones; columns stretch on wider screens

type SheetState = { id: string } | { preset: BookingPreset } | null;

export function CalendarView({
  month,
  today,
  apartments,
  bookings,
}: {
  month: string;
  today: string;
  apartments: CalApartment[];
  bookings: CalBooking[];
}) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const [sheet, setSheet] = useState<SheetState>(null);

  const n = daysInMonth(month);
  const first = `${month}-01`;
  const last = `${month}-${String(n).padStart(2, "0")}`;
  const thisMonth = today.slice(0, 7);

  const days = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const iso = addDaysISO(first, i);
        const [y, m, d] = iso.split("-").map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));
        const dow = date.getUTCDay();
        return {
          iso,
          day: d,
          weekend: dow === 0 || dow === 6,
          letter: date.toLocaleDateString(locale === "en" ? "en-IN" : locale, { weekday: "narrow", timeZone: "UTC" }),
        };
      }),
    [n, first, locale],
  );

  const occupancy = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of apartments) {
      let booked = 0;
      for (const b of bookings) {
        if (b.apartment_id !== a.id) continue;
        const from = b.check_in < first ? first : b.check_in;
        const to = b.check_out > last ? addDaysISO(last, 1) : b.check_out;
        booked += Math.max(0, daysBetween(from, to));
      }
      out[a.id] = Math.round((booked / n) * 100);
    }
    return out;
  }, [apartments, bookings, first, last, n]);

  const header = (
    <PageHeader
      title={t("title")}
      subtitle={t("subtitle")}
      actions={
        apartments.length ? (
          <Button variant="honey" onClick={() => setSheet({ preset: {} })}>
            <Icon name="plus" size={18} />
            {t("newBooking")}
          </Button>
        ) : null
      }
    />
  );

  if (!apartments.length) {
    return (
      <>
        {header}
        <EmptyState
          icon={<Icon name="calendar" size={32} />}
          title={t("noApartmentsTitle")}
          body={t("noApartmentsBody")}
          action={<ButtonLink href="/apartments">{t("addApartment")}</ButtonLink>}
        />
      </>
    );
  }

  const cols = n * 2;
  const aptById = new Map(apartments.map((a) => [a.id, a]));

  return (
    <>
      {header}

      <nav aria-label={t("monthNav")} className="mb-3 flex flex-wrap items-center gap-2">
        <Link
          href={`/calendar?m=${addMonths(month, -1)}`}
          scroll={false}
          aria-label={t("prevMonth")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink hover:bg-surface-2"
        >
          <Icon name="chevronLeft" size={20} />
        </Link>
        <h2 className="min-w-[170px] text-center font-display text-[16px] font-bold tracking-[-0.01em]" aria-live="polite">
          {fmtMonth(month, locale === "en" ? "en-IN" : locale)}
        </h2>
        <Link
          href={`/calendar?m=${addMonths(month, 1)}`}
          scroll={false}
          aria-label={t("nextMonth")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink hover:bg-surface-2"
        >
          <Icon name="chevron" size={20} />
        </Link>
        {month !== thisMonth ? (
          <Link href="/calendar" scroll={false} className={buttonClass("secondary", "sm", "min-h-11")}>
            {t("thisMonth")}
          </Link>
        ) : null}
      </nav>

      <div className="overflow-x-auto rounded-[24px] bg-surface [--cal-lab:84px] min-[960px]:[--cal-lab:132px]">
        <div
         
          aria-label={t("gridLabel", { month: fmtMonth(month) })}
          className="grid"
          style={{
            gridTemplateColumns: `var(--cal-lab) repeat(${cols}, minmax(${HALF}px, 1fr))`,
            gridTemplateRows: `auto repeat(${apartments.length}, 64px)`,
            minWidth: `calc(var(--cal-lab) + ${cols * HALF}px)`,
          }}
        >
          <div
            className="sticky left-0 z-20 flex items-end border-b border-r border-line bg-surface px-3 py-2 text-[11.5px] font-semibold text-muted"
            style={{ gridRow: 1, gridColumn: 1 }}
          >
            {t("apartment")}
          </div>
          {days.map((d, i) => (
            <div
              key={d.iso}
             
              aria-label={fmtDay(d.iso)}
              className={cn(
                "flex flex-col items-center border-b border-l border-line py-1.5 text-[10.5px] leading-tight",
                d.iso === today ? "bg-ink text-surface" : d.weekend ? "bg-surface-2 text-muted" : "text-muted",
              )}
              style={{ gridRow: 1, gridColumn: `${2 + i * 2} / span 2` }}
            >
              <span aria-hidden>{d.letter}</span>
              <b className={cn("tabular text-[13px]", d.iso === today ? "text-surface" : "text-ink")} aria-hidden>
                {d.day}
              </b>
            </div>
          ))}

          {apartments.map((a, ri) => {
            const row = ri + 2;
            const tag = tagClasses(a.tag_colour);
            return (
              <div key={a.id} className="contents">
                <div
                 
                  className="sticky left-0 z-20 flex flex-col justify-center gap-0.5 border-b border-r border-line bg-surface px-2.5 min-[960px]:px-3"
                  style={{ gridRow: row, gridColumn: 1 }}
                >
                  <span className={cn("self-start rounded-[8px] px-1.5 py-0.5 font-display text-[12px] font-extrabold", tag.bg, tag.text)}>
                    {a.code}
                  </span>
                  <span className="tabular text-[11px] text-muted">{t("booked", { pct: occupancy[a.id] ?? 0 })}</span>
                </div>
                {days.map((d, i) => (
                  <button
                    key={d.iso}
                    type="button"
                   
                    onClick={() => setSheet({ preset: { apartmentId: a.id, date: d.iso } })}
                    aria-label={t("newOn", { apartment: a.code, date: fmtDay(d.iso) })}
                    className={cn(
                      "border-b border-l border-line transition hover:bg-accent-soft focus-visible:relative focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-accent",
                      d.iso === today ? "bg-tag1/15" : d.weekend ? "bg-surface-2" : "bg-transparent",
                    )}
                    style={{ gridRow: row, gridColumn: `${2 + i * 2} / span 2` }}
                  />
                ))}
                {bookings
                  .filter((b) => b.apartment_id === a.id)
                  .map((b) => {
                    const s = b.check_in < first ? 2 : 3 + daysBetween(first, b.check_in) * 2;
                    const e = b.check_out > last ? 2 + cols : 3 + daysBetween(first, b.check_out) * 2;
                    if (e <= s) return null;
                    const guests = b.adults + b.children;
                    const nn = nights(b.check_in, b.check_out);
                    const label = t("barLabel", {
                      guest: b.guest_name,
                      from: fmtDay(b.check_in),
                      to: fmtDay(b.check_out),
                      channel: CHANNEL_LABEL[b.channel] ?? b.channel,
                    });
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSheet({ id: b.id })}
                        title={label}
                        aria-label={label}
                        className={cn(
                          "relative z-10 flex h-11 min-w-0 flex-col justify-center self-center overflow-hidden px-2 text-left shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                          BAR[b.channel] ?? BAR.other,
                          b.check_in < first ? "ml-0 rounded-l-none" : "ml-0.5 rounded-l-[12px]",
                          b.check_out > last ? "mr-0 rounded-r-none" : "mr-0.5 rounded-r-[12px]",
                          b.status === "checked_out" && "opacity-75",
                        )}
                        style={{ gridRow: row, gridColumn: `${s} / ${e}` }}
                      >
                        <span className="truncate text-[12px] font-semibold leading-tight">{b.guest_name}</span>
                        <span className="truncate text-[11px] leading-tight opacity-90">
                          {t("barSub", { nights: nn, guests })}
                        </span>
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
        {(["airbnb", "booking", "direct", "other"] as const).map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className={cn("inline-block h-3 w-5 rounded-[4px]", BAR[c])} aria-hidden />
            {CHANNEL_LABEL[c]}
          </span>
        ))}
        <span>{t("legend")}</span>
      </div>

      <Card className="mt-5">
        <h2 className="mb-3 font-display text-[14px] font-bold">{t("listTitle", { month: fmtMonth(month) })}</h2>
        {bookings.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {bookings.map((b) => {
              const a = aptById.get(b.apartment_id);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setSheet({ id: b.id })}
                    className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-surface-2"
                  >
                    {a ? <AptChip tag={a.tag_colour} code={a.code} /> : <AptSquare tag="tag1" />}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14.5px] font-semibold">{b.guest_name}</span>
                      <span className="tabular text-[12.5px] text-muted">
                        {fmtDay(b.check_in)} → {fmtDay(b.check_out)} · {t("barSub", { nights: nights(b.check_in, b.check_out), guests: b.adults + b.children })}
                      </span>
                    </span>
                    <ChannelPill channel={b.channel} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[14px] text-muted">{t("listEmpty")}</p>
        )}
      </Card>

      <BookingSheet
        open={sheet != null}
        onClose={() => setSheet(null)}
        bookingId={sheet && "id" in sheet ? sheet.id : null}
        preset={sheet && "preset" in sheet ? sheet.preset : undefined}
      />
    </>
  );
}
