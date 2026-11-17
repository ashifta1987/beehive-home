"use client";

import { useId, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ForeignRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/ui/card";
import { CheckRow, TextAreaField, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import { saveForeignRecord } from "../actions";

export const FRRO_URL = "https://indianfrro.gov.in/frro/FormC";

export interface ForeignBookingView {
  id: string;
  guest: string;
  apt: string;
  stay: string;
  checkOut: string;
  record: ForeignRecord | null;
}

type Form = Omit<ForeignRecord, "booking_id">;

const EMPTY: Form = {
  nationality: "",
  passport_no: "",
  passport_expiry: "",
  visa_no: "",
  visa_type: "",
  visa_expiry: "",
  arrived_india: "",
  arriving_from: "",
  next_destination: "",
  docs_collected: false,
  form_c_submitted: false,
  form_c_ref: "",
  form_c_date: "",
  note: "",
};

function toForm(r: ForeignRecord | null): Form {
  if (!r) return { ...EMPTY };
  const out = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof Form)[]) {
    const v = r[k];
    (out as Record<string, unknown>)[k] = typeof v === "boolean" ? v : (v ?? "");
  }
  return out;
}

/** Button that opens the record sheet; also opens itself when the URL has ?open=<booking id>. */
export function ForeignRecordButton({
  booking,
  label,
  primary,
  autoOpen = false,
}: {
  booking: ForeignBookingView;
  label: string;
  primary?: boolean;
  /** true when the page URL has ?open=<this booking id> */
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const shouldOpen = autoOpen;
  const [open, setOpen] = useState(shouldOpen);
  const [seen, setSeen] = useState(shouldOpen);

  // Re-open when navigated here again with ?open= (e.g. from a Today alert).
  if (shouldOpen && !seen) {
    setSeen(true);
    setOpen(true);
  } else if (!shouldOpen && seen) {
    setSeen(false);
  }

  const close = () => {
    setOpen(false);
    if (shouldOpen) router.replace(path, { scroll: false });
  };

  return (
    <>
      <Button size="sm" variant={primary ? "primary" : "secondary"} onClick={() => setOpen(true)}>
        <Icon name="edit" size={16} />
        {label}
      </Button>
      {open ? <ForeignSheet booking={booking} onClose={close} /> : null}
    </>
  );
}

function ForeignSheet({ booking, onClose }: { booking: ForeignBookingView; onClose: () => void }) {
  const t = useTranslations("foreign");
  const tc = useTranslations("common");
  const formId = useId();
  const [f, setF] = useState<Form>(() => toForm(booking.record));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { run, pending, error } = useAction();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const visaShort = !!f.visa_expiry && f.visa_expiry < booking.checkOut;
  const passportShort = !!f.passport_expiry && f.passport_expiry < booking.checkOut;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.nationality?.trim()) {
      setFieldError(t("form.nationalityRequired"));
      return;
    }
    run(() => saveForeignRecord({ booking_id: booking.id, ...f }), { success: t("form.saved"), onDone: onClose });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("form.title")}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{tc("cancel")}</Button>
          <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="rounded-[14px] bg-surface-2 px-3.5 py-3 text-[14px]">
          <p className="font-semibold">{booking.guest}</p>
          <p className="text-muted">{booking.apt} · {booking.stay}</p>
          <p className="mt-1.5">
            {t("form.portalNote")}{" "}
            <a href={FRRO_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline">
              {t("portal")}
            </a>
          </p>
        </div>

        <div className="grid gap-3 min-[600px]:grid-cols-2">
          <TextField label={t("form.nationality")} value={f.nationality ?? ""} onChange={(e) => {
              setFieldError(null);
              set("nationality", e.target.value);
            }} required maxLength={80} error={fieldError} autoComplete="off" />
          <TextField label={t("form.arrivedIndia")} type="date" value={f.arrived_india ?? ""} onChange={(e) => set("arrived_india", e.target.value)} />
          <TextField label={t("form.passportNo")} value={f.passport_no ?? ""} onChange={(e) => set("passport_no", e.target.value)} maxLength={40} autoComplete="off" />
          <TextField label={t("form.passportExpiry")} type="date" value={f.passport_expiry ?? ""} onChange={(e) => set("passport_expiry", e.target.value)} />
          <TextField label={t("form.visaNo")} value={f.visa_no ?? ""} onChange={(e) => set("visa_no", e.target.value)} maxLength={40} autoComplete="off" />
          <TextField label={t("form.visaType")} placeholder={t("form.visaTypeHint")} value={f.visa_type ?? ""} onChange={(e) => set("visa_type", e.target.value)} maxLength={60} />
          <TextField label={t("form.visaExpiry")} type="date" value={f.visa_expiry ?? ""} onChange={(e) => set("visa_expiry", e.target.value)} />
          <TextField label={t("form.arrivingFrom")} value={f.arriving_from ?? ""} onChange={(e) => set("arriving_from", e.target.value)} maxLength={120} />
          <TextField label={t("form.nextDestination")} value={f.next_destination ?? ""} onChange={(e) => set("next_destination", e.target.value)} maxLength={120} className="min-[600px]:col-span-2" />
        </div>

        {visaShort || passportShort ? (
          <div role="alert" className="flex flex-col gap-1 rounded-[13px] bg-bad-soft px-3 py-2.5 text-[14px] font-medium text-bad">
            {visaShort ? <span>{t("warn.visa")}</span> : null}
            {passportShort ? <span>{t("warn.passport")}</span> : null}
          </div>
        ) : null}

        <CheckRow label={t("form.docsCollected")} checked={f.docs_collected} onChange={(e) => set("docs_collected", e.target.checked)} />
        <CheckRow label={t("form.formCSubmitted")} checked={f.form_c_submitted} onChange={(e) => set("form_c_submitted", e.target.checked)} />

        <div className="grid gap-3 min-[600px]:grid-cols-2">
          <TextField label={t("form.formCRef")} value={f.form_c_ref ?? ""} onChange={(e) => set("form_c_ref", e.target.value)} maxLength={60} autoComplete="off" />
          <TextField label={t("form.formCDate")} type="date" value={f.form_c_date ?? ""} onChange={(e) => set("form_c_date", e.target.value)} disabled={!f.form_c_submitted} hint={f.form_c_submitted ? t("form.formCDateHint") : undefined} />
        </div>

        <TextAreaField label={t("form.note")} value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} maxLength={1000} />
        <ErrorBox>{error}</ErrorBox>
      </form>
    </Sheet>
  );
}
