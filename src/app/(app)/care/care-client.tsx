"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Pill, type Tone } from "@/components/ui/pill";
import { SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import { addDaysISO, fmtDate, fmtDay } from "@/lib/dates";
import { inr } from "@/lib/money";
import type { CareStatus } from "@/lib/care";
import type { Apartment, Schedule, ScheduleLog } from "@/lib/types";
import { SCHEDULE_CATEGORIES, SCHEDULE_WHO } from "@/components/jobs/constants";
import { ConfirmDelete, formObject } from "@/components/jobs/confirm-delete";
import { deleteCareLog, deleteSchedule, markCareDone, saveSchedule } from "./actions";
import { ActionError } from "@/components/jobs/action-error";

type AptOption = Pick<Apartment, "id" | "code" | "name">;
export type LogRow = ScheduleLog & { by: string | null };

const TONE: Record<CareStatus["state"], Tone> = { never: "warn", overdue: "bad", today: "warn", soon: "warn", later: "ok" };

export function CareStatusPill({ status, locale }: { status: CareStatus; locale: string }) {
  const t = useTranslations("care");
  const label =
    status.state === "never"
      ? t("status.never")
      : status.state === "overdue"
        ? t("status.overdue", { count: -(status.days ?? 0) })
        : status.state === "today"
          ? t("status.today")
          : status.state === "soon"
            ? t("status.soon", { count: status.days ?? 0, date: fmtDay(status.next, locale) })
            : t("status.later", { date: fmtDate(status.next, locale) });
  return <Pill tone={TONE[status.state]}>{label}</Pill>;
}

export function CareRow({
  schedule,
  status,
  logs,
  apartments,
  isOwner,
  today,
  locale,
}: {
  schedule: Schedule;
  status: CareStatus;
  logs: LogRow[];
  apartments: AptOption[];
  isOwner: boolean;
  today: string;
  locale: string;
}) {
  const t = useTranslations("care");
  const [doneOpen, setDoneOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const meta = [
    t(`category.${schedule.category}`),
    t("every", { count: schedule.every_days }),
    t(`who.${schedule.who}`) + (schedule.vendor ? ` · ${schedule.vendor}` : ""),
  ].join(" · ");

  return (
    <li className="flex flex-col gap-2 rounded-[18px] bg-surface-2 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{schedule.name}</p>
          <p className="text-[12.5px] text-muted">{meta}</p>
        </div>
        <CareStatusPill status={status} locale={locale} />
      </div>
      <p className="text-[13px] text-muted">
        {schedule.last_done
          ? t("lastDone", { date: fmtDate(schedule.last_done, locale) }) + (schedule.last_result ? ` · ${schedule.last_result}` : "")
          : t("neverDone")}
      </p>
      {schedule.note ? <p className="whitespace-pre-line text-[13px]">{schedule.note}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setDoneOpen(true)}>
          <Icon name="check" size={16} /> {t("markDone")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
          {t("history", { count: logs.length })}
        </Button>
        <ScheduleFormButton schedule={schedule} apartments={apartments} today={today} />
        {isOwner ? (
          <ConfirmDelete
            title={t("deleteTitle")}
            body={t("deleteBody", { name: schedule.name })}
            success={t("deleted")}
            onConfirm={() => deleteSchedule({ scheduleId: schedule.id })}
          />
        ) : null}
      </div>
      <MarkDoneSheet open={doneOpen} onClose={() => setDoneOpen(false)} schedule={schedule} today={today} locale={locale} />
      <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} schedule={schedule} logs={logs} isOwner={isOwner} locale={locale} />
    </li>
  );
}

function MarkDoneSheet({
  open,
  onClose,
  schedule,
  today,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  schedule: Schedule;
  today: string;
  locale: string;
}) {
  const t = useTranslations("care");
  const tc = useTranslations("common");
  const formId = useId();
  const { run, pending, error } = useAction();
  const [date, setDate] = useState(today);
  const nextIfSaved = date && (!schedule.last_done || date >= schedule.last_done) ? addDaysISO(date, Math.max(1, schedule.every_days)) : null;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formObject(e.currentTarget);
    void run(() => markCareDone({ ...data, scheduleId: schedule.id }), {
      success: nextIfSaved ? t("done.savedNext", { date: fmtDay(nextIfSaved, locale) }) : t("done.saved"),
      onDone: onClose,
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("done.title", { name: schedule.name })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{tc("cancel")}</Button>
          <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("done.date")} name="date" type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label={t("done.cost")} name="cost" type="number" inputMode="numeric" min={0} step={1} hint={tc("optional")} />
        </div>
        <TextField label={t(`resultLabel.${schedule.category}`)} name="result" maxLength={300} />
        <TextAreaField label={tc("notes")} name="note" rows={2} maxLength={2000} />
        {nextIfSaved ? (
          <p className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-[14px]">{t("done.nextWillBe", { date: fmtDate(nextIfSaved, locale) })}</p>
        ) : date ? (
          <p className="rounded-[14px] bg-warn-soft px-3 py-2.5 text-[14px] text-warn">{t("done.olderDate")}</p>
        ) : null}
        <p className="text-[12.5px] text-muted">{t("done.costHint")}</p>
        <ActionError error={error} />
      </form>
    </Sheet>
  );
}

function HistorySheet({
  open,
  onClose,
  schedule,
  logs,
  isOwner,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  schedule: Schedule;
  logs: LogRow[];
  isOwner: boolean;
  locale: string;
}) {
  const t = useTranslations("care");
  const tc = useTranslations("common");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("historyTitle", { name: schedule.name })}
      footer={<Button variant="secondary" onClick={onClose}>{tc("close")}</Button>}
    >
      {logs.length ? (
        <ul className="flex flex-col gap-2">
          {logs.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-2 rounded-[14px] bg-surface-2 px-3 py-2.5">
              <div className="min-w-0 flex-1 text-[14px]">
                <p className="font-semibold">
                  {fmtDate(l.date, locale)}
                  {l.cost ? <span className="tabular font-normal text-muted"> · {inr(l.cost)}</span> : null}
                </p>
                {l.result ? <p>{l.result}</p> : null}
                {l.note ? <p className="whitespace-pre-line text-muted">{l.note}</p> : null}
                {l.by ? <p className="text-[12px] text-muted">{t("by", { who: l.by })}</p> : null}
              </div>
              {isOwner ? (
                <ConfirmDelete
                  title={t("deleteLogTitle")}
                  body={t("deleteLogBody")}
                  success={t("deleted")}
                  onConfirm={() => deleteCareLog({ logId: l.id })}
                >
                  <Icon name="trash" size={16} />
                  <span className="sr-only">{tc("delete")}</span>
                </ConfirmDelete>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-[14px] text-muted">{t("noHistory")}</p>
      )}
    </Sheet>
  );
}

export function ScheduleFormButton({
  schedule,
  apartments,
  defaultApt,
  today,
}: {
  schedule?: Schedule;
  apartments: AptOption[];
  defaultApt?: string | null;
  today: string;
}) {
  const t = useTranslations("care");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const formId = useId();
  const { run, pending, error } = useAction();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formObject(e.currentTarget);
    void run(() => saveSchedule({ ...data, id: schedule?.id ?? "" }), {
      success: schedule ? t("form.saved") : t("form.added"),
      onDone: () => setOpen(false),
    });
  }

  return (
    <>
      {schedule ? (
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
        title={schedule ? t("form.editTitle") : t("form.addTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
          <TextField label={t("form.name")} name="name" required maxLength={120} defaultValue={schedule?.name ?? ""} placeholder={t("form.namePh")} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label={t("form.category")} name="category" defaultValue={schedule?.category ?? "other"}>
              {SCHEDULE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`category.${c}`)}</option>
              ))}
            </SelectField>
            <SelectField label={tc("apartment")} name="apartment_id" defaultValue={schedule ? (schedule.apartment_id ?? "both") : (defaultApt ?? "both")}>
              <option value="both">{tc("both")}</option>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
              ))}
            </SelectField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t("form.everyDays")} name="every_days" type="number" inputMode="numeric" required min={1} max={3650} step={1}
              defaultValue={schedule?.every_days ?? 30} />
            <SelectField label={t("form.who")} name="who" defaultValue={schedule?.who ?? "housekeeper"}>
              {SCHEDULE_WHO.map((w) => (
                <option key={w} value={w}>{t(`who.${w}`)}</option>
              ))}
            </SelectField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t("form.vendor")} name="vendor" maxLength={120} defaultValue={schedule?.vendor ?? ""} hint={tc("optional")} />
            <TextField label={t("form.lastDone")} name="last_done" type="date" max={today} defaultValue={schedule?.last_done ?? ""} hint={tc("optional")} />
          </div>
          <TextAreaField label={tc("notes")} name="note" rows={2} maxLength={2000} defaultValue={schedule?.note ?? ""} />
          <ActionError error={error} />
        </form>
      </Sheet>
    </>
  );
}
