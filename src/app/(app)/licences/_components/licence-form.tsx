"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { Licence } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/ui/card";
import { SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import { DeleteButton } from "@/components/today/delete-button";
import { deleteLicence, saveLicence } from "../actions";

type AptOption = { id: string; name: string };

export function LicenceButton({ licence, apartments, label, primary }: { licence?: Licence; apartments: AptOption[]; label: string; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={primary ? "md" : "sm"} variant={primary ? "primary" : "secondary"} onClick={() => setOpen(true)}>
        <Icon name={licence ? "edit" : "plus"} size={16} />
        {label}
      </Button>
      {open ? <LicenceSheet licence={licence} apartments={apartments} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function LicenceSheet({ licence, apartments, onClose }: { licence?: Licence; apartments: AptOption[]; onClose: () => void }) {
  const t = useTranslations("licences");
  const tc = useTranslations("common");
  const formId = useId();
  const { run, pending, error, setError } = useAction();
  const [f, setF] = useState({
    name: licence?.name ?? "",
    number: licence?.number ?? "",
    issued_by: licence?.issued_by ?? "",
    apartment_id: licence?.apartment_id ?? "",
    issued: licence?.issued ?? "",
    expires: licence?.expires ?? "",
    remind_days: String(licence?.remind_days ?? 60),
    note: licence?.note ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const expiresBad = !!f.issued && !!f.expires && f.expires < f.issued;
  const remind = Number(f.remind_days);
  const remindBad = f.remind_days !== "" && (!Number.isInteger(remind) || remind < 0 || remind > 730);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setError(t("form.nameRequired"));
    if (expiresBad) return setError(t("form.expiresBefore"));
    if (remindBad) return setError(t("form.remindInvalid"));
    run(() => saveLicence({ id: licence?.id ?? null, ...f }), { success: t("form.saved"), onDone: onClose });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={licence ? t("form.editTitle") : t("form.newTitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{tc("cancel")}</Button>
          <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <TextField label={t("form.name")} hint={t("form.nameHint")} value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={160} />
        <div className="grid gap-3 min-[600px]:grid-cols-2">
          <TextField label={t("form.number")} value={f.number} onChange={(e) => set("number", e.target.value)} maxLength={80} autoComplete="off" />
          <TextField label={t("form.issuedBy")} value={f.issued_by} onChange={(e) => set("issued_by", e.target.value)} maxLength={160} />
          <SelectField label={t("form.apartment")} value={f.apartment_id} onChange={(e) => set("apartment_id", e.target.value)} className="min-[600px]:col-span-2">
            <option value="">{tc("both")}</option>
            {apartments.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </SelectField>
          <TextField label={t("form.issued")} type="date" value={f.issued} onChange={(e) => set("issued", e.target.value)} />
          <TextField label={t("form.expires")} type="date" value={f.expires} onChange={(e) => set("expires", e.target.value)} error={expiresBad ? t("form.expiresBefore") : null} hint={t("form.expiresHint")} />
          <TextField label={t("form.remindDays")} inputMode="numeric" value={f.remind_days} onChange={(e) => set("remind_days", e.target.value)} error={remindBad ? t("form.remindInvalid") : null} hint={t("form.remindHint")} />
        </div>
        <TextAreaField label={t("form.note")} placeholder={t("form.noteHint")} value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={1000} />
        <ErrorBox>{error}</ErrorBox>
        {licence ? (
          <DeleteButton
            title={t("form.deleteTitle")}
            body={t("form.deleteBody")}
            success={t("form.deleted")}
            onConfirm={() => deleteLicence({ id: licence.id })}
            onDone={onClose}
          />
        ) : null}
      </form>
    </Sheet>
  );
}
