"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { BookingStatus, Channel, DepositStatus, PaymentStatus } from "@/lib/types";
import { guestKey, parseCommission } from "@/lib/bookings";
import { addDaysISO, fmtDay, nights as nightsOf } from "@/lib/dates";
import { inr, parseRupees } from "@/lib/money";
import { CHANNEL_CLASSES, tagClasses } from "@/lib/ui";
import { CHANNEL_LABEL } from "@/lib/guest";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ErrorBox, Skeleton } from "@/components/ui/card";
import { PillChoice, SelectField, Stepper, TextAreaField, TextField, Toggle } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { useAction } from "@/components/ui/toast";
import { deleteBooking, loadBookingForm, saveBooking, type BookingFormData } from "./actions";
import { BOOKING_STATUSES, CHANNELS, DEPOSIT_STATUSES, PAYMENT_STATUSES, type BookingInput } from "./schema";
import { BookingExtrasEditor, lineKey, type ExtraLine } from "./booking-extras";

export interface BookingPreset {
  apartmentId?: string | null;
  date?: string | null;
}

/**
 * The booking form in a bottom sheet (dialog on desktop). Self-contained: it loads what it
 * needs when opened, so any owner page can use it:
 *   <BookingSheet open={open} onClose={close} bookingId={id} preset={{ apartmentId, date }} />
 */
export function BookingSheet({
  open,
  onClose,
  bookingId,
  preset,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  bookingId?: string | null;
  preset?: BookingPreset;
  onSaved?: (id: string) => void;
}) {
  if (!open) return null;
  const k = `${bookingId ?? "new"}|${preset?.apartmentId ?? ""}|${preset?.date ?? ""}`;
  return <Loader key={k} onClose={onClose} bookingId={bookingId ?? null} preset={preset} onSaved={onSaved} />;
}

function Loader({
  onClose,
  bookingId,
  preset,
  onSaved,
}: {
  onClose: () => void;
  bookingId: string | null;
  preset?: BookingPreset;
  onSaved?: (id: string) => void;
}) {
  const t = useTranslations("bookings");
  const tc = useTranslations("common");
  const [data, setData] = useState<BookingFormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadBookingForm({ id: bookingId })
      .then((res) => {
        if (!alive) return;
        if (res.ok && res.data) setData(res.data);
        else setError(res.ok ? tc("errorGeneric") : res.error);
      })
      .catch(() => alive && setError(t("form.loadFailed")));
    return () => {
      alive = false;
    };
  }, [bookingId, attempt, t, tc]);

  const title = bookingId ? t("form.editTitle") : t("form.newTitle");

  if (!data) {
    return (
      <Sheet
        open
        onClose={onClose}
        title={title}
        wide
        footer={<Button variant="secondary" onClick={onClose}>{tc("cancel")}</Button>}
      >
        {error ? (
          <div className="flex flex-col gap-3 py-2">
            <ErrorBox>{error}</ErrorBox>
            <Button
              variant="secondary"
              onClick={() => {
                setError(null);
                setAttempt((a) => a + 1);
              }}
            >
              {tc("errorRetry")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2" aria-busy="true" aria-label={tc("loading")}>
            <Skeleton className="h-11 w-2/3 rounded-full" />
            <Skeleton className="h-11 w-full rounded-full" />
            <Skeleton className="h-12 w-full rounded-[13px]" />
            <Skeleton className="h-12 w-full rounded-[13px]" />
            <Skeleton className="h-24 w-full rounded-[13px]" />
          </div>
        )}
      </Sheet>
    );
  }

  if (!data.apartments.length) {
    return (
      <Sheet open onClose={onClose} title={title} footer={<Button variant="secondary" onClick={onClose}>{tc("close")}</Button>}>
        <p className="py-2 text-[14.5px] text-muted">{t("form.noApartments")}</p>
      </Sheet>
    );
  }

  return <BookingForm data={data} preset={preset} onClose={onClose} onSaved={onSaved} title={title} />;
}

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

function BookingForm({
  data,
  preset,
  onClose,
  onSaved,
  title,
}: {
  data: BookingFormData;
  preset?: BookingPreset;
  onClose: () => void;
  onSaved?: (id: string) => void;
  title: string;
}) {
  const t = useTranslations("bookings");
  const tc = useTranslations("common");
  const { run, pending, error, setError } = useAction();
  const del = useAction();
  const b = data.booking;
  const isNew = !b;

  const firstApt =
    data.apartments.find((a) => a.id === (b?.apartment_id ?? preset?.apartmentId)) ?? data.apartments[0];
  const startDate = b?.check_in ?? (preset?.date && /^\d{4}-\d{2}-\d{2}$/.test(preset.date) ? preset.date : data.today);

  const [aptId, setAptId] = useState(firstApt.id);
  const [channel, setChannel] = useState<Channel>(b?.channel ?? "airbnb");
  const [channelRef, setChannelRef] = useState(b?.channel_ref ?? "");
  const [guestName, setGuestName] = useState(b?.guest_name ?? "");
  const [phone, setPhone] = useState(b?.phone ?? "");
  const [email, setEmail] = useState(b?.email ?? "");
  const [checkIn, setCheckIn] = useState(startDate);
  const [checkOut, setCheckOut] = useState(b?.check_out ?? addDaysISO(startDate, 1));
  const [inTime, setInTime] = useState(hhmm(b ? b.check_in_time ?? firstApt.check_in_time : firstApt.check_in_time));
  const [outTime, setOutTime] = useState(hhmm(b ? b.check_out_time ?? firstApt.check_out_time : firstApt.check_out_time));
  const [adults, setAdults] = useState(b?.adults ?? 2);
  const [children, setChildren] = useState(b?.children ?? 0);
  const [totalText, setTotalText] = useState(b ? String(b.total) : "");
  const [commText, setCommText] = useState(b?.commission ? String(b.commission) : "");
  const [commPct, setCommPct] = useState<number | null>(null);
  const [payment, setPayment] = useState<PaymentStatus>(b?.payment_status ?? "channel");
  const [paymentTouched, setPaymentTouched] = useState(!isNew);
  const [depositText, setDepositText] = useState(b?.deposit ? String(b.deposit) : "");
  const [depositStatus, setDepositStatus] = useState<DepositStatus>(b?.deposit_status ?? "none");
  const [status, setStatus] = useState<BookingStatus>(b?.status ?? "confirmed");
  const [idVerified, setIdVerified] = useState(b?.id_verified ?? false);
  const [foreign, setForeign] = useState(b?.foreign_national ?? false);
  const [sharePhone, setSharePhone] = useState(b?.share_phone ?? true);
  const [hkNote, setHkNote] = useState(b?.hk_note ?? "");
  const [notes, setNotes] = useState(b?.notes ?? "");
  const [lines, setLines] = useState<ExtraLine[]>(() =>
    data.bookingExtras.map((x) => ({
      key: lineKey(),
      id: x.id,
      extra_id: x.extra_id,
      name: x.name,
      unit: (["use", "day", "night", "hour", "event", "item"].includes(x.unit) ? x.unit : "event") as ExtraLine["unit"],
      qty: x.qty,
      units: x.units,
      price: x.price,
      date: x.date,
      status: x.status,
      paid: x.paid,
    })),
  );
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const apt = data.apartments.find((a) => a.id === aptId) ?? firstApt;
  const datesOk = /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut) && checkOut > checkIn;
  const n = datesOk ? nightsOf(checkIn, checkOut) : 0;
  const total = parseRupees(totalText) ?? 0;
  const comm = parseCommission(commText, total);
  const commission = comm?.amount ?? 0;

  function chooseApartment(id: string) {
    setAptId(id);
    const a = data.apartments.find((x) => x.id === id);
    if (isNew && a) {
      setInTime(hhmm(a.check_in_time));
      setOutTime(hhmm(a.check_out_time));
    }
  }
  function chooseChannel(c: Channel) {
    setChannel(c);
    if (!paymentTouched) setPayment(c === "airbnb" || c === "booking" ? "channel" : "pending");
  }
  function changeCheckIn(v: string) {
    setCheckIn(v);
    // Keep the stay length when moving the start date forward past check-out.
    if (/^\d{4}-\d{2}-\d{2}$/.test(v) && checkOut <= v) setCheckOut(addDaysISO(v, Math.max(1, n)));
  }
  function changeTotal(v: string) {
    setTotalText(v);
    if (commPct != null) {
      const tot = parseRupees(v) ?? 0;
      setCommText(String(Math.round((tot * commPct) / 100)));
    }
  }
  function changeCommission(v: string) {
    setCommText(v);
    if (!v.includes("%")) setCommPct(null);
  }
  function settleCommission() {
    const r = parseCommission(commText, total);
    if (r && r.pct != null) {
      setCommPct(r.pct);
      setCommText(String(r.amount));
    }
  }

  const overlap = useMemo(() => {
    if (!datesOk || status === "cancelled") return [];
    return data.stays.filter(
      (s) => s.id !== b?.id && s.apartment_id === aptId && s.status !== "cancelled" && s.check_in < checkOut && checkIn < s.check_out,
    );
  }, [datesOk, status, data.stays, b?.id, aptId, checkIn, checkOut]);

  const blocked = useMemo(() => {
    if (!guestName.trim() && !phone.trim() && !email.trim()) return false;
    const key = guestKey({ guest_name: guestName, phone, email });
    return data.blockedKeys.includes(key);
  }, [guestName, phone, email, data.blockedKeys]);

  const guests = adults + children;
  const overCapacity = apt.max_guests != null && guests > apt.max_guests;

  function submit() {
    const errs: Record<string, string> = {};
    if (!guestName.trim()) errs.guest_name = t("form.errName");
    if (!datesOk) errs.check_out = t("form.errDates");
    if (totalText.trim() && parseRupees(totalText) == null) errs.total = t("form.errAmount");
    if (!comm) errs.commission = t("form.errCommission");
    else if (total > 0 && comm.amount > total) errs.commission = t("form.errCommissionHigh");
    if (depositText.trim() && parseRupees(depositText) == null) errs.deposit = t("form.errAmount");
    if (guests < 1) errs.adults = t("form.errGuests");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = t("form.errEmail");
    setFieldErr(errs);
    if (Object.keys(errs).length) {
      setError(t("form.fixErrors"));
      return;
    }
    const payload: BookingInput = {
      id: b?.id ?? null,
      apartment_id: aptId,
      channel,
      channel_ref: channelRef,
      guest_name: guestName,
      phone,
      email,
      adults,
      children,
      check_in: checkIn,
      check_out: checkOut,
      check_in_time: inTime || null,
      check_out_time: outTime || null,
      total,
      commission,
      payment_status: payment,
      deposit: parseRupees(depositText) ?? 0,
      deposit_status: depositStatus,
      status,
      id_verified: idVerified,
      foreign_national: foreign,
      share_phone: sharePhone,
      hk_note: hkNote,
      notes,
      extras: lines.map((l) => ({
        id: l.id,
        extra_id: l.extra_id,
        name: l.name,
        unit: l.unit,
        qty: l.qty,
        units: l.units,
        price: l.price,
        date: l.date,
        status: l.status,
        paid: l.paid,
      })),
    };
    void run(() => saveBooking(payload), {
      success: isNew ? t("form.added") : t("form.updated"),
      onDone: (res) => {
        if (res?.id) onSaved?.(res.id);
        onClose();
      },
    });
  }

  function remove() {
    if (!b) return;
    void del.run(() => deleteBooking({ id: b.id }), { success: t("form.deleted"), onDone: onClose });
  }

  const tag = tagClasses(apt.tag_colour);

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending || del.pending}>
            {pending ? tc("saving") : isNew ? t("form.add") : t("form.save")}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5 pb-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <PillChoice
          label={t("form.apartment")}
          name="bk-apt"
          value={aptId}
          onChange={chooseApartment}
          options={data.apartments.map((a) => ({
            value: a.id,
            label: <span className="font-display text-[13px] font-extrabold">{a.code}</span>,
            activeClass: `${tagClasses(a.tag_colour).bg} ${tagClasses(a.tag_colour).text}`,
          }))}
        />
        <PillChoice
          label={t("form.channel")}
          name="bk-ch"
          value={channel}
          onChange={chooseChannel}
          options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c], activeClass: `${CHANNEL_CLASSES[c]} ring-2 ring-current` }))}
        />

        <div className="grid gap-3 min-[600px]:grid-cols-2">
          <TextField
            label={t("form.guestName")}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            error={fieldErr.guest_name}
            autoComplete="off"
            maxLength={120}
            required
            autoFocus={isNew}
          />
          <TextField
            label={t("form.ref")}
            value={channelRef}
            onChange={(e) => setChannelRef(e.target.value)}
            placeholder={t("form.refPh")}
            maxLength={80}
          />
          <TextField
            label={t("form.phone")}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98xxxxxxxx"
            maxLength={40}
          />
          <TextField
            label={t("form.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErr.email}
            maxLength={160}
          />
        </div>

        {blocked ? (
          <p role="alert" className="flex gap-2 rounded-[13px] bg-bad px-3 py-2.5 text-[14px] font-semibold text-on-bad">
            <Icon name="alert" size={18} className="mt-0.5 flex-none" />
            {t("form.blocked")}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-4">
          <TextField label={t("form.checkIn")} type="date" value={checkIn} onChange={(e) => changeCheckIn(e.target.value)} required />
          <TextField label={t("form.from")} type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} />
          <TextField
            label={t("form.checkOut")}
            type="date"
            value={checkOut}
            min={/^\d{4}-\d{2}-\d{2}$/.test(checkIn) ? addDaysISO(checkIn, 1) : undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            error={fieldErr.check_out}
            required
          />
          <TextField label={t("form.by")} type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} />
        </div>
        <p className="-mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <span className={`inline-block h-2.5 w-2.5 rounded-[3px] ${tag.bg}`} aria-hidden />
          {datesOk
            ? t("form.stayLine", { nights: n, from: fmtDay(checkIn), to: fmtDay(checkOut) })
            : t("form.errDates")}
        </p>

        {overlap.length ? (
          <p role="alert" className="flex gap-2 rounded-[13px] bg-bad-soft px-3 py-2.5 text-[13.5px] font-medium text-bad">
            <Icon name="alert" size={18} className="mt-0.5 flex-none" />
            {t("form.overlap", {
              list: overlap.map((o) => `${o.guest_name} (${fmtDay(o.check_in)} – ${fmtDay(o.check_out)})`).join(", "),
            })}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Stepper label={t("form.adults")} value={adults} onChange={setAdults} min={0} max={50} />
          <Stepper label={t("form.children")} value={children} onChange={setChildren} min={0} max={50} />
        </div>
        {fieldErr.adults ? <p role="alert" className="-mt-3 text-[12.5px] font-medium text-bad">{fieldErr.adults}</p> : null}
        {overCapacity ? (
          <p className="-mt-3 text-[12.5px] font-medium text-warn">{t("form.overCapacity", { max: apt.max_guests ?? 0 })}</p>
        ) : null}

        <section className="flex flex-col gap-3" aria-labelledby="bk-pay-h">
          <h3 id="bk-pay-h" className="font-display text-[14px] font-bold">{t("form.payment")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t("form.total")}
              inputMode="numeric"
              value={totalText}
              onChange={(e) => changeTotal(e.target.value)}
              error={fieldErr.total}
              placeholder="0"
            />
            <TextField
              label={t("form.commission")}
              value={commText}
              onChange={(e) => changeCommission(e.target.value)}
              onBlur={settleCommission}
              error={fieldErr.commission}
              hint={
                commText.includes("%") && comm
                  ? t("form.commissionIs", { amount: inr(comm.amount) })
                  : commPct != null
                    ? t("form.commissionPct", { pct: commPct })
                    : t("form.commissionHint")
              }
              placeholder={t("form.commissionPh")}
            />
          </div>
          {total > 0 ? (
            <p className="tabular text-[13px] text-muted">
              {n > 0
                ? t("form.netLinePerNight", { net: inr(total - commission), perNight: inr((total - commission) / n) })
                : t("form.netLine", { net: inr(total - commission) })}
            </p>
          ) : null}
          <SelectField
            label={t("form.paymentStatus")}
            value={payment}
            onChange={(e) => {
              setPayment(e.target.value as PaymentStatus);
              setPaymentTouched(true);
            }}
          >
            {PAYMENT_STATUSES.map((p) => (
              <option key={p} value={p}>{t(`payment.${p}`)}</option>
            ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t("form.deposit")}
              inputMode="numeric"
              value={depositText}
              onChange={(e) => setDepositText(e.target.value)}
              error={fieldErr.deposit}
              placeholder="0"
            />
            <SelectField
              label={t("form.depositStatus")}
              value={depositStatus}
              onChange={(e) => setDepositStatus(e.target.value as DepositStatus)}
            >
              {DEPOSIT_STATUSES.map((d) => (
                <option key={d} value={d}>{t(`deposit.${d}`)}</option>
              ))}
            </SelectField>
          </div>
        </section>

        <BookingExtrasEditor
          lines={lines}
          onChange={setLines}
          catalog={data.catalog}
          apartmentId={aptId}
          bookingId={b?.id ?? null}
          checkIn={checkIn}
          checkOut={checkOut}
          nights={n}
          stays={data.stays}
          uses={data.uses}
        />

        <section className="flex flex-col gap-3" aria-labelledby="bk-stay-h">
          <h3 id="bk-stay-h" className="font-display text-[14px] font-bold">{t("form.stay")}</h3>
          <SelectField label={t("form.status")} value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)}>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </SelectField>
          <Toggle label={t("form.idVerified")} checked={idVerified} onChange={setIdVerified} />
          <Toggle label={t("form.foreign")} hint={t("form.foreignHint")} checked={foreign} onChange={setForeign} />
          <Toggle label={t("form.sharePhone")} hint={t("form.sharePhoneHint")} checked={sharePhone} onChange={setSharePhone} />
          <TextAreaField
            label={t("form.hkNote")}
            hint={t("form.hkNoteHint")}
            value={hkNote}
            onChange={(e) => setHkNote(e.target.value)}
            placeholder={t("form.hkNotePh")}
            rows={2}
            maxLength={500}
          />
          <TextAreaField
            label={t("form.notes")}
            hint={t("form.notesHint")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </section>

        <ErrorBox>{error}</ErrorBox>

        {b ? (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            {confirmDelete ? (
              <>
                <p className="text-[14px] font-medium">{t("form.deleteConfirm")}</p>
                <ErrorBox>{del.error}</ErrorBox>
                <div className="flex gap-2 [&>*]:flex-1">
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={del.pending}>
                    {t("form.keep")}
                  </Button>
                  <Button variant="danger" onClick={remove} disabled={del.pending}>
                    {del.pending ? t("form.deleting") : t("form.deleteYes")}
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="ghost" className="self-start text-bad" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" size={18} />
                {t("form.delete")}
              </Button>
            )}
          </div>
        ) : null}
      </form>
    </Sheet>
  );
}
