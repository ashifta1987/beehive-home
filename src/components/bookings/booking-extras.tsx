"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { BookingExtraStatus, Extra, ExtraUnit } from "@/lib/types";
import { extraShortfalls, type ExtraUse, type StayLite } from "@/lib/bookings";
import { fmtDay } from "@/lib/dates";
import { inr, parseRupees } from "@/lib/money";
import { cn } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Stepper } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { EXTRA_STATUSES } from "./schema";

/** One extra on the booking while the form is open. */
export interface ExtraLine {
  key: string;
  id: string | null;
  extra_id: string | null;
  name: string;
  unit: ExtraUnit;
  qty: number;
  units: number;
  price: number;
  date: string;
  status: BookingExtraStatus;
  paid: boolean;
}

const OTHER = "__other";

let seq = 0;
export const lineKey = () => `x${Date.now().toString(36)}${(seq++).toString(36)}`;

export function BookingExtrasEditor({
  lines,
  onChange,
  catalog,
  apartmentId,
  bookingId,
  checkIn,
  checkOut,
  nights,
  stays,
  uses,
}: {
  lines: ExtraLine[];
  onChange: (lines: ExtraLine[]) => void;
  catalog: Extra[];
  apartmentId: string;
  bookingId: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  stays: StayLite[];
  uses: ExtraUse[];
}) {
  const t = useTranslations("bookings");
  const offered = useMemo(
    () => catalog.filter((e) => e.active && (e.apartment_id == null || e.apartment_id === apartmentId)),
    [catalog, apartmentId],
  );

  const [choice, setChoice] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [units, setUnits] = useState(1);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const chosen = offered.find((e) => e.id === choice) ?? null;
  const unit: ExtraUnit = chosen?.unit ?? "event";

  function pick(id: string) {
    setChoice(id);
    setErr(null);
    const e = offered.find((x) => x.id === id);
    setPrice(e?.price != null ? String(e.price) : "");
    setUnits(e && (e.unit === "day" || e.unit === "night") ? Math.max(1, nights) : 1);
    setQty(1);
    setName("");
    setDate("");
  }

  function add() {
    if (!choice) return setErr(t("extras.chooseFirst"));
    const lineName = chosen ? chosen.name : name.trim();
    if (!lineName) return setErr(t("extras.nameRequired"));
    const p = parseRupees(price);
    if (p == null || p < 0) return setErr(chosen && chosen.price == null ? t("extras.setPriceRequired") : t("extras.priceRequired"));
    onChange([
      ...lines,
      {
        key: lineKey(),
        id: null,
        extra_id: chosen?.id ?? null,
        name: lineName,
        unit,
        qty,
        units,
        price: p,
        date: date || checkIn,
        status: "confirmed",
        paid: false,
      },
    ]);
    setChoice("");
    setName("");
    setPrice("");
    setQty(1);
    setUnits(1);
    setDate("");
    setErr(null);
  }

  const update = (key: string, patch: Partial<ExtraLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key));

  // Stock warning includes the item being prepared, so the owner sees it before adding.
  const shortfalls = useMemo(() => {
    const draft = lines.map((l) => ({ extra_id: l.extra_id, qty: l.qty, status: l.status }));
    if (chosen) draft.push({ extra_id: chosen.id, qty, status: "confirmed" });
    return extraShortfalls(draft, { id: bookingId, check_in: checkIn, check_out: checkOut }, catalog, stays, uses);
  }, [lines, chosen, qty, bookingId, checkIn, checkOut, catalog, stays, uses]);

  const active = lines.filter((l) => l.status !== "cancelled");
  const sum = active.reduce((s, l) => s + l.qty * l.units * l.price, 0);
  const unpaid = active.filter((l) => !l.paid).reduce((s, l) => s + l.qty * l.units * l.price, 0);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="bk-extras-h">
      <div className="flex items-center justify-between gap-2">
        <h3 id="bk-extras-h" className="font-display text-[14px] font-bold">{t("extras.title")}</h3>
        {sum ? (
          <span className="tabular text-[13px] text-muted">
            {inr(sum)}
            {unpaid ? ` · ${t("extras.unpaid", { amount: inr(unpaid) })}` : ""}
          </span>
        ) : null}
      </div>

      {lines.length ? (
        <ul className="flex flex-col gap-2">
          {lines.map((l) => (
            <li key={l.key} className={cn("flex flex-col gap-2 rounded-[14px] bg-surface-2 p-3", l.status === "cancelled" && "opacity-70")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn("text-[14.5px] font-semibold", l.status === "cancelled" && "line-through")}>{l.name}</p>
                  <p className="tabular text-[12.5px] text-muted">
                    {t("extras.lineSummary", {
                      qty: l.qty,
                      units: l.units,
                      unit: t(`units.${l.unit}`, { units: l.units }),
                      price: inr(l.price),
                      date: fmtDay(l.date),
                    })}
                  </p>
                </div>
                <span className="tabular flex-none text-[14.5px] font-bold">{inr(l.qty * l.units * l.price)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`st-${l.key}`}>{t("extras.statusOf", { name: l.name })}</label>
                <Select
                  id={`st-${l.key}`}
                  value={l.status}
                  onChange={(e) => update(l.key, { status: e.target.value as BookingExtraStatus })}
                  className="w-auto min-w-[140px] bg-surface py-2 text-[14px]"
                >
                  {EXTRA_STATUSES.map((s) => (
                    <option key={s} value={s}>{t(`extraStatus.${s}`)}</option>
                  ))}
                </Select>
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[11px] bg-surface px-3 text-[14px]">
                  <input
                    type="checkbox"
                    checked={l.paid}
                    onChange={(e) => update(l.key, { paid: e.target.checked })}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                  {t("extras.paid")}
                </label>
                <Button variant="ghost" size="sm" className="ml-auto min-h-11 text-bad" onClick={() => remove(l.key)} aria-label={t("extras.removeLabel", { name: l.name })}>
                  <Icon name="trash" size={18} />
                  {t("extras.remove")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-muted">{offered.length ? t("extras.none") : t("extras.noneOffered")}</p>
      )}

      <div className="flex flex-col gap-3 rounded-[14px] border border-dashed border-line p-3">
        <Field label={t("extras.add")} htmlFor="bk-x-choice">
          <Select id="bk-x-choice" value={choice} onChange={(e) => pick(e.target.value)}>
            <option value="">{t("extras.choose")}</option>
            {offered.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.price != null ? `${inr(e.price)} ${t(`unitsPer.${e.unit}`)}` : t("extras.setPrice")}
              </option>
            ))}
            <option value={OTHER}>{t("extras.other")}</option>
          </Select>
        </Field>

        {choice ? (
          <>
            {chosen?.price == null && chosen ? <Pill tone="warn" className="self-start">{t("extras.setPrice")}</Pill> : null}
            {choice === OTHER ? (
              <Field label={t("extras.chargeName")} htmlFor="bk-x-name">
                <Input id="bk-x-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("extras.chargeNamePh")} maxLength={120} />
              </Field>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Stepper label={t("extras.qty")} value={qty} onChange={setQty} min={1} max={99} />
              <Stepper label={t(`unitsCount.${unit}`)} value={units} onChange={setUnits} min={1} max={365} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("extras.priceEach")} htmlFor="bk-x-price">
                <Input
                  id="bk-x-price"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={chosen?.price == null ? t("extras.setPrice") : undefined}
                  aria-required
                />
              </Field>
              <Field label={t("extras.date")} htmlFor="bk-x-date">
                <Input id="bk-x-date" type="date" value={date || checkIn} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
            {err ? <p role="alert" className="text-[13px] font-medium text-bad">{err}</p> : null}
            <Button variant="secondary" onClick={add}>
              <Icon name="plus" size={18} />
              {t("extras.addToBooking")}
            </Button>
          </>
        ) : null}
      </div>

      {shortfalls.map((s) => (
        <p key={s.extraId} role="status" className="flex gap-2 rounded-[13px] bg-warn-soft px-3 py-2.5 text-[13.5px] font-medium text-warn">
          <Icon name="alert" size={18} className="mt-0.5 flex-none" />
          {t("extras.shortWarn", { name: s.name, stock: s.stock, used: s.used, wanted: s.wanted })}
        </p>
      ))}
    </section>
  );
}
