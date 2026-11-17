"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useAction, useToast } from "@/components/ui/toast";
import type { Apartment, Laundry } from "@/lib/types";
import { ConfirmDelete, formObject } from "@/components/jobs/confirm-delete";
import { deleteLaundry, returnLaundry, saveLaundry } from "./actions";
import { ActionError } from "@/components/jobs/action-error";

type AptOption = Pick<Apartment, "id" | "code" | "name">;

export function LaundryFormButton({
  batch,
  apartments,
  today,
}: {
  batch?: Laundry;
  apartments: AptOption[];
  today: string;
}) {
  const t = useTranslations("laundry");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const formId = useId();
  const { run, pending, error } = useAction();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formObject(e.currentTarget);
    void run(() => saveLaundry({ ...data, id: batch?.id ?? "" }), {
      success: batch ? t("form.saved") : t("form.added"),
      onDone: () => setOpen(false),
    });
  }

  return (
    <>
      {batch ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Icon name="edit" size={16} /> {tc("edit")}
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Icon name="plus" size={18} /> {t("form.add")}
        </Button>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={batch ? t("form.editTitle") : t("form.addTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : batch ? tc("save") : t("form.send")}</Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t("form.sentDate")} name="sent_date" type="date" required max={today} defaultValue={batch?.sent_date ?? today} />
            <TextField label={t("form.items")} name="items_sent" type="number" inputMode="numeric" required min={1} max={10000} step={1}
              defaultValue={batch?.items_sent ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t("form.vendor")} name="vendor" maxLength={120} defaultValue={batch?.vendor ?? ""} hint={tc("optional")} />
            <SelectField label={tc("apartment")} name="apartment_id" defaultValue={batch ? (batch.apartment_id ?? "both") : "both"}>
              <option value="both">{tc("both")}</option>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
              ))}
            </SelectField>
          </div>
          <TextAreaField label={t("form.details")} name="details" rows={2} maxLength={1000} defaultValue={batch?.details ?? ""}
            placeholder={t("form.detailsPh")} />
          {batch?.returned_date ? (
            <div className="grid grid-cols-3 gap-3">
              <TextField label={t("ret.date")} name="returned_date" type="date" max={today} defaultValue={batch.returned_date} />
              <TextField label={t("ret.items")} name="items_returned" type="number" inputMode="numeric" min={0} max={10000} step={1}
                defaultValue={batch.items_returned ?? ""} />
              <TextField label={t("ret.cost")} name="cost" type="number" inputMode="numeric" min={0} step={1} defaultValue={batch.cost ?? ""} />
            </div>
          ) : null}
          <TextAreaField label={tc("notes")} name="note" rows={2} maxLength={1000} defaultValue={batch?.note ?? ""} />
          <ActionError error={error} />
        </form>
      </Sheet>
    </>
  );
}

export function ReturnButton({ batch, today }: { batch: Laundry; today: string }) {
  const t = useTranslations("laundry");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const formId = useId();
  const toast = useToast();
  const { run, pending, error } = useAction();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formObject(e.currentTarget);
    void run(() => returnLaundry({ ...data, id: batch.id }), {
      onDone: (res) => {
        const short = res?.short ?? 0;
        toast(short ? t("ret.shortToast", { count: short }) : t("ret.savedToast"), short ? "bad" : "ok");
        setOpen(false);
      },
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Icon name="check" size={16} /> {t("ret.button")}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("ret.title")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
          <p className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-[14px]">{t("ret.intro", { count: batch.items_sent })}</p>
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t("ret.date")} name="returned_date" type="date" required min={batch.sent_date} max={today} defaultValue={today} />
            <TextField label={t("ret.items")} name="items_returned" type="number" inputMode="numeric" required min={0} max={10000} step={1}
              defaultValue={batch.items_sent} />
          </div>
          <TextField label={t("ret.cost")} name="cost" type="number" inputMode="numeric" min={0} step={1} hint={t("ret.costHint")} />
          <ActionError error={error} />
        </form>
      </Sheet>
    </>
  );
}

export function DeleteLaundryButton({ id }: { id: string }) {
  const t = useTranslations("laundry");
  return (
    <ConfirmDelete
      title={t("deleteTitle")}
      body={t("deleteBody")}
      success={t("deleted")}
      onConfirm={() => deleteLaundry({ laundryId: id })}
    />
  );
}
