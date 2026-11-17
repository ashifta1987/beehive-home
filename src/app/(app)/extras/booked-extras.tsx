"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/ui/card";
import { AptChip, Pill, type Tone } from "@/components/ui/pill";
import { useAction } from "@/components/ui/toast";
import { fmtDay } from "@/lib/dates";
import { inr } from "@/lib/money";
import type { Apartment, BookingExtraStatus } from "@/lib/types";
import { setBookingExtraPaid, setBookingExtraStatus } from "./actions";
import type { BookedExtraRow } from "./constants";

type AptOption = Pick<Apartment, "id" | "code" | "name" | "tag_colour">;

const STATUS_TONE: Record<BookingExtraStatus, Tone> = {
  requested: "warn",
  confirmed: "info",
  delivered: "info",
  returned: "ok",
  cancelled: "neutral",
};

const NEXT: Partial<Record<BookingExtraStatus, { to: BookingExtraStatus; key: "confirm" | "deliver" | "return" }>> = {
  requested: { to: "confirmed", key: "confirm" },
  confirmed: { to: "delivered", key: "deliver" },
  delivered: { to: "returned", key: "return" },
};

const UNIT_KEYS = new Set(["use", "day", "night", "hour", "event", "item"]);

/** List of booked extras with status and paid actions. */
export function BookedExtras({
  rows,
  apartments,
  locale,
  mode,
}: {
  rows: BookedExtraRow[];
  apartments: AptOption[];
  locale: string;
  /** upcoming: status flow + paid; unpaid: after check-out, mainly "Mark paid". */
  mode: "upcoming" | "unpaid";
}) {
  const apts = Object.fromEntries(apartments.map((a) => [a.id, a]));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <BookedExtraItem key={r.id} row={r} apt={apts[r.apartment_id]} locale={locale} mode={mode} />
      ))}
    </ul>
  );
}

function BookedExtraItem({ row: r, apt, locale, mode }: { row: BookedExtraRow; apt?: AptOption; locale: string; mode: "upcoming" | "unpaid" }) {
  const t = useTranslations("extras");
  const { run, pending, error } = useAction();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const next = mode === "upcoming" ? NEXT[r.status] : undefined;
  const unitText = UNIT_KEYS.has(r.unit) ? t(`unitCount.${r.unit}`, { count: r.units }) : `${r.units} ${r.unit}`;
  const dates = `${fmtDay(r.check_in, locale)} – ${fmtDay(r.check_out, locale)}`;

  const setStatus = (status: BookingExtraStatus) =>
    void run(() => setBookingExtraStatus({ id: r.id, status }), { success: t("updated"), onDone: () => setConfirmCancel(false) });
  const togglePaid = () => void run(() => setBookingExtraPaid({ id: r.id, paid: !r.paid }), { success: t("updated") });

  return (
    <li className="flex flex-col gap-2 rounded-[18px] bg-surface-2 p-3">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-semibold">{r.name}</span>
            <Pill tone={STATUS_TONE[r.status]}>{t(`status.${r.status}`)}</Pill>
            {r.paid ? <Pill tone="ok">{t("paid")}</Pill> : <Pill tone="warn">{t("unpaid")}</Pill>}
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
            {apt ? <AptChip tag={apt.tag_colour} code={apt.code} /> : null}
            <span>{t("orders.guestStay", { guest: r.guest_name, dates })}</span>
          </p>
          <p className="text-[13px] text-muted">
            {fmtDay(r.date, locale)} · <span className="tabular">{t("orders.qtyUnits", { qty: r.qty, units: unitText })}</span>
            {mode === "unpaid" ? <> · {t("orders.checkout", { date: fmtDay(r.check_out, locale) })}</> : null}
          </p>
        </div>
        <span className="tabular flex-none text-[16px] font-bold">{inr(r.total)}</span>
      </div>

      {confirmCancel ? (
        <div role="alertdialog" aria-label={t("actions.cancelConfirm")} className="flex flex-col gap-2 rounded-[14px] bg-bad-soft p-3">
          <p className="text-[14px] font-medium text-bad">{t("actions.cancelConfirm")}</p>
          <div className="flex gap-2 [&>*]:flex-1">
            <Button size="sm" className="min-h-11" variant="secondary" onClick={() => setConfirmCancel(false)} disabled={pending}>
              {t("actions.keep")}
            </Button>
            <Button size="sm" className="min-h-11" variant="danger" onClick={() => setStatus("cancelled")} disabled={pending}>
              {t("actions.cancelYes")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {next ? (
            <Button size="sm" className="min-h-11" onClick={() => setStatus(next.to)} disabled={pending}>
              {t(`actions.${next.key}`)}
            </Button>
          ) : null}
          <Button size="sm" className="min-h-11" variant={r.paid ? "secondary" : mode === "unpaid" ? "honey" : "secondary"} onClick={togglePaid} disabled={pending}>
            {r.paid ? t("actions.markUnpaid") : t("actions.markPaid")}
          </Button>
          {mode === "upcoming" && (r.status === "requested" || r.status === "confirmed") ? (
            <Button size="sm" className="min-h-11 text-bad" variant="ghost" onClick={() => setConfirmCancel(true)} disabled={pending}>
              {t("actions.cancel")}
            </Button>
          ) : null}
        </div>
      )}
      <ErrorBox>{error}</ErrorBox>
    </li>
  );
}
