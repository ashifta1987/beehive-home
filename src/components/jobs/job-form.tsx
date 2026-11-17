"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import type { Apartment, Task } from "@/lib/types";
import { deleteJob, saveJob } from "@/app/(app)/jobs/actions";
import { MANUAL_KINDS } from "./constants";
import { ConfirmDelete, formObject } from "./confirm-delete";
import { ActionError } from "./action-error";

type AptOption = Pick<Apartment, "id" | "code" | "name">;

/** Owner: add a job by hand, or edit one that was added by hand. */
export function JobFormButton({
  task,
  apartments,
  defaultApt,
  today,
}: {
  task?: Task;
  apartments: AptOption[];
  defaultApt?: string;
  today?: string;
}) {
  const t = useTranslations("jobs");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const formId = useId();
  const { run, pending, error } = useAction();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formObject(e.currentTarget);
    void run(() => saveJob({ ...data, id: task?.id ?? "" }), {
      success: task ? t("form.saved") : t("form.added"),
      onDone: () => setOpen(false),
    });
  }

  return (
    <>
      {task ? (
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
        title={task ? t("form.editTitle") : t("form.addTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
          <SelectField label={t("form.kind")} name="kind" defaultValue={task?.kind ?? "deep"} required>
            {MANUAL_KINDS.map((k) => (
              <option key={k} value={k}>{t(`kind.${k}`)}</option>
            ))}
          </SelectField>
          <SelectField label={tc("apartment")} name="apartment_id" defaultValue={task?.apartment_id ?? defaultApt ?? apartments[0]?.id} required>
            {apartments.map((a) => (
              <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
            ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-3">
            <TextField label={tc("date")} name="date" type="date" required defaultValue={task?.date ?? today} />
            <TextField label={t("form.time")} name="time" type="time" defaultValue={task?.time?.slice(0, 5) ?? ""} hint={tc("optional")} />
          </div>
          <TextAreaField label={t("form.note")} name="note" rows={3} maxLength={2000} defaultValue={task?.note ?? ""}
            placeholder={t("form.notePh")} />
          <ActionError error={error} />
        </form>
      </Sheet>
    </>
  );
}

export function DeleteJobButton({ taskId }: { taskId: string }) {
  const t = useTranslations("jobs");
  return (
    <ConfirmDelete
      title={t("form.deleteTitle")}
      body={t("form.deleteBody")}
      success={t("form.deleted")}
      onConfirm={() => deleteJob({ taskId })}
    />
  );
}
