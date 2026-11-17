"use client";

import { useRef, useState, useId } from "react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ChannelPill, Pill } from "@/components/ui/pill";
import { Textarea } from "@/components/ui/form";
import { useAction } from "@/components/ui/toast";
import { fmtDay, fmtStamp, fmtTime } from "@/lib/dates";
import type { Apartment, Task } from "@/lib/types";
import { cn, tagClasses } from "@/lib/ui";
import { markRoomOk, saveChecks, saveJobNotes, setJobStatus } from "@/app/(app)/jobs/actions";
import { checklistFor, doneCount } from "./logic";
import { ConditionSheet, TheftCheck, type CountAsset } from "./job-sheets";
import { JobFormButton, DeleteJobButton } from "./job-form";
import { ActionError } from "./action-error";

export interface JobCardProps {
  task: Task;
  apt: Apartment | undefined;
  countable: CountAsset[];
  isOwner: boolean;
  today: string;
  locale: string;
  doneByName: string | null;
  apartments: Array<Pick<Apartment, "id" | "code" | "name">>;
}

function TimeTile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-[14px] px-3 py-2.5", warn ? "bg-warn-soft" : "bg-bg")}>
      <span className={cn("text-[11px]", warn ? "text-warn" : "text-muted")}>{label}</span>
      <span className="tabular truncate text-[17px] font-bold">{value}</span>
    </div>
  );
}

export function JobCard({ task, apt, countable, isOwner, today, locale, doneByName, apartments }: JobCardProps) {
  const t = useTranslations("jobs");
  const tag = tagClasses(apt?.tag_colour);
  const code = apt?.code ?? "—";
  const list = checklistFor(task, apt);
  const notesId = useId();
  const { run, pending, error } = useAction();

  // Checklist: optimistic, saved in order so quick taps never overwrite each other.
  const [checks, setChecks] = useState<Record<string, boolean>>(task.checks ?? {});
  const latest = useRef(checks);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [checkError, setCheckError] = useState(false);

  function flush() {
    queue.current = queue.current.then(async () => {
      try {
        const res = await saveChecks({ taskId: task.id, checks: latest.current });
        setCheckError(!res.ok);
      } catch {
        setCheckError(true);
      }
    });
  }
  function toggle(i: number, on: boolean) {
    const next = { ...latest.current, [String(i)]: on };
    latest.current = next;
    setChecks(next);
    flush();
  }

  const [notes, setNotes] = useState(task.hk_notes ?? "");
  const notesChanged = notes.trim() !== (task.hk_notes ?? "").trim();
  const [condOpen, setCondOpen] = useState(false);

  const done = doneCount(checks, list.length);
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  const overdue = task.status !== "done" && task.date < today;
  const isTurnover = task.kind === "turnover";
  const isArrival = task.kind === "arrival";

  const statusPill =
    task.status === "done" ? (
      <Pill tone="ok">{t("status.done")}</Pill>
    ) : task.status === "in_progress" ? (
      <Pill tone="warn">{t("status.in_progress")}</Pill>
    ) : overdue ? (
      <Pill tone="bad">{t("status.overdue")}</Pill>
    ) : (
      <Pill tone="neutral">{t("status.pending")}</Pill>
    );

  const setStatus = (status: Task["status"], success: string) =>
    run(() => setJobStatus({ taskId: task.id, status }), { success });

  // Time tiles ------------------------------------------------------------
  let tiles: React.ReactNode;
  if (isTurnover) {
    const nextValue = task.next_arrival
      ? task.next_arrival === task.date
        ? fmtTime(task.next_arrival_time) || t("sameDay")
        : `${fmtDay(task.next_arrival, locale)}${task.next_arrival_time ? `, ${fmtTime(task.next_arrival_time)}` : ""}`
      : t("noNextBooking");
    tiles = (
      <>
        <TimeTile label={t("tile.guestLeaves")} value={fmtTime(task.time) || t("anyTime")} />
        <TimeTile label={t("tile.nextGuestsIn")} value={nextValue} warn={!!task.next_arrival} />
      </>
    );
  } else if (isArrival) {
    tiles = (
      <>
        <TimeTile label={t("tile.guestsArrive")} value={fmtTime(task.time) || t("anyTime")} />
        <TimeTile label={t("tile.guests")} value={task.guests != null ? String(task.guests) : "—"} />
      </>
    );
  } else {
    tiles = (
      <>
        <TimeTile label={t("tile.date")} value={fmtDay(task.date, locale)} />
        <TimeTile label={t("tile.time")} value={fmtTime(task.time) || t("anyTime")} />
      </>
    );
  }

  const showTheft = isTurnover && countable.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <article
        className={cn("flex flex-col rounded-[26px] bg-surface", overdue && "shadow-[inset_0_0_0_2px_var(--bad)]")}
        aria-label={`${t(`kind.${task.kind}`)} · ${code}`}
      >
        {/* Band in the apartment colour */}
        <div className={cn("flex items-center justify-between gap-3 rounded-t-[26px] px-[18px] py-4", tag.bg, tag.text)}>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em]">{t(`kind.${task.kind}`)}</span>
            <span className="font-display text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em]">{code}</span>
          </span>
          <span className="flex items-center gap-3">
            {statusPill}
            <span aria-hidden className={cn("box-border h-[18px] w-[18px] flex-none rounded-full border-[3px] bg-bg", tag.ring)} />
          </span>
        </div>

        <div className="flex flex-col gap-3 px-[18px] pb-4 pt-3.5">
          {task.date !== today ? (
            <p className={cn("text-[13px] font-semibold", overdue ? "text-bad" : "text-muted")}>
              {fmtDay(task.date, locale)}
              {overdue ? ` · ${t("status.overdue")}` : ""}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">{tiles}</div>

          {/* What the job copies from the booking */}
          <JobDetails task={task} locale={locale} />

          {list.length ? (
            <>
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-2.5 flex-1 overflow-hidden rounded-[10px] bg-bg"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={list.length}
                  aria-valuenow={done}
                  aria-label={t("progress")}
                >
                  <span className="rounded-[10px] bg-ink transition-[width]" style={{ width: `${pct}%` }} />
                </span>
                <span className="tabular text-[13px] font-bold">{t("ofCount", { done, total: list.length })}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {list.map((item, i) => {
                  const on = !!checks[String(i)];
                  return (
                    <li key={i}>
                      <label
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] bg-surface-2 px-3 py-2 text-[15px]",
                          on && "text-muted line-through",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => toggle(i, e.target.checked)}
                          className="h-[22px] w-[22px] flex-none accent-[var(--accent)]"
                        />
                        <span className="min-w-0 flex-1">{item}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {checkError ? (
                <div className="flex items-center justify-between gap-2 rounded-[13px] bg-bad-soft px-3 py-2 text-[14px] font-medium text-bad" role="alert">
                  <span>{t("checkNotSaved")}</span>
                  <Button size="sm" variant="secondary" onClick={flush}>{t("retry")}</Button>
                </div>
              ) : null}
            </>
          ) : null}

          {/* Housekeeper notes */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={notesId} className="text-[12.5px] font-semibold text-muted">{t("hkNotes")}</label>
            <Textarea
              id={notesId}
              rows={2}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("hkNotesPh")}
            />
            {notesChanged ? (
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                disabled={pending}
                onClick={() => run(() => saveJobNotes({ taskId: task.id, hk_notes: notes }), { success: t("noteSaved") })}
              >
                {t("saveNote")}
              </Button>
            ) : null}
          </div>

          {task.status === "done" ? (
            <p className="text-[13px] text-muted">
              {doneByName
                ? t("doneAtBy", { when: fmtStamp(task.completed_at), who: doneByName })
                : t("doneAt", { when: fmtStamp(task.completed_at) })}
            </p>
          ) : null}

          {/* Secondary actions */}
          {(isTurnover && !task.condition) || task.status === "pending" || (isOwner && !task.auto) ? (
            <div className="flex flex-wrap gap-2">
              {isTurnover && !task.condition ? (
                <>
                  <Button size="sm" variant="secondary" disabled={pending}
                    onClick={() => run(() => markRoomOk({ taskId: task.id }), { success: t("roomOkSaved") })}>
                    <Icon name="check" size={16} /> {t("roomOk")}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setCondOpen(true)}>
                    {t("messyOrDamaged")}
                  </Button>
                </>
              ) : null}
              {task.status === "pending" ? (
                <ButtonLink size="sm" variant="ghost" href={`/maintenance?new=1&apt=${encodeURIComponent(task.apartment_id)}`}>
                  <Icon name="alert" size={16} /> {t("report")}
                </ButtonLink>
              ) : null}
              {isOwner && !task.auto ? (
                <>
                  <JobFormButton task={task} apartments={apartments} />
                  <DeleteJobButton taskId={task.id} />
                </>
              ) : null}
            </div>
          ) : null}

          <ActionError error={error} />

          {/* Sticky main actions (stay above the phone bottom bar while scrolling a long checklist) */}
          <div className="sticky bottom-[96px] z-10 -mx-[18px] -mb-4 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2.5 rounded-b-[26px] bg-surface px-[18px] pb-4 pt-2 min-[960px]:bottom-0">
            {task.status === "pending" ? (
              <Button variant="secondary" className="min-h-14 rounded-[20px] text-[15px]" disabled={pending}
                onClick={() => setStatus("in_progress", t("started"))}>
                {t("start")}
              </Button>
            ) : (
              <ButtonLink variant="secondary" className="min-h-14 rounded-[20px] text-[15px]"
                href={`/maintenance?new=1&apt=${encodeURIComponent(task.apartment_id)}`}>
                <Icon name="alert" size={18} /> {t("report")}
              </ButtonLink>
            )}
            {task.status === "done" ? (
              <Button variant="secondary" className="min-h-14 rounded-[20px] text-[16px]" disabled={pending}
                onClick={() => setStatus("pending", t("reopened"))}>
                <Icon name="refresh" size={18} /> {t("reopen")}
              </Button>
            ) : (
              <Button className="min-h-14 rounded-[20px] text-[16px] font-bold" disabled={pending}
                onClick={() => setStatus("done", t("markedDone"))}>
                <Icon name="check" size={20} strokeWidth={2.4} className="text-tag1" /> {t("markDone")}
              </Button>
            )}
          </div>
        </div>
      </article>

      {showTheft ? <TheftCheck task={task} aptCode={code} assets={countable} locale={locale} /> : null}

      {isTurnover ? <ConditionSheet open={condOpen} onClose={() => setCondOpen(false)} task={task} aptCode={code} /> : null}
    </div>
  );
}

/** Guest info, extras, notes and condition copied onto the job. */
function JobDetails({ task, locale }: { task: Task; locale: string }) {
  const t = useTranslations("jobs");
  const rows: React.ReactNode[] = [];

  if (task.guest_first_name || task.guests != null) {
    rows.push(
      <li key="guest" className="flex flex-wrap items-center gap-2">
        <span>
          {task.kind === "turnover"
            ? t("guestLeaving", { name: task.guest_first_name || t("theGuest"), count: task.guests ?? 0 })
            : t("guestArriving", { name: task.guest_first_name || t("theGuest"), count: task.guests ?? 0 })}
        </span>
        {task.channel ? <ChannelPill channel={task.channel} /> : null}
      </li>,
    );
  }
  if (task.kind === "turnover" && task.next_arrival) {
    rows.push(
      <li key="next" className="flex flex-wrap items-center gap-2">
        <span>{t("nextGuests", { date: fmtDay(task.next_arrival, locale), count: task.next_guests ?? 0 })}</span>
        {task.next_arrival === task.date ? <Pill tone="warn">{t("sameDayTurnover")}</Pill> : null}
      </li>,
    );
  }
  if (task.guest_phone) {
    rows.push(
      <li key="phone">
        <a href={`tel:${task.guest_phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-surface-2 px-3 font-semibold text-ink">
          <Icon name="phone" size={18} />
          <span className="tabular">{task.guest_phone}</span>
          <span className="sr-only">{t("callGuest")}</span>
        </a>
      </li>,
    );
  }
  if (task.is_foreign) {
    rows.push(
      <li key="foreign" className="flex flex-wrap items-center gap-2">
        <Pill tone="info">{t("foreignGuest")}</Pill>
        <span className="text-muted">{t("foreignHint")}</span>
      </li>,
    );
  }
  if (task.extras_setup?.length) {
    rows.push(
      <li key="setup" className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-tag1 px-2.5 py-1 text-[12.5px] font-semibold text-tag1-ink">{t("setUp")}</span>
        <span>{task.extras_setup.join(", ")}</span>
      </li>,
    );
  }
  if (task.extras_collect?.length) {
    rows.push(
      <li key="collect" className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-tag1 px-2.5 py-1 text-[12.5px] font-semibold text-tag1-ink">{t("collectCheck")}</span>
        <span>{task.extras_collect.join(", ")}</span>
      </li>,
    );
  }
  if (task.note) {
    rows.push(
      <li key="note">
        <span className="font-semibold">{t("ownerNote")}: </span>
        <span className="whitespace-pre-line">{task.note}</span>
      </li>,
    );
  }
  if (task.hk_note) {
    rows.push(
      <li key="hknote">
        <span className="font-semibold">{t("bookingNote")}: </span>
        <span className="whitespace-pre-line">{task.hk_note}</span>
      </li>,
    );
  }
  if (task.kind === "turnover" && task.condition) {
    rows.push(
      <li key="cond" className="flex flex-wrap items-center gap-2">
        <Pill tone={task.condition === "ok" ? "ok" : "bad"}>{t(`condition.${task.condition}`)}</Pill>
        {task.condition_note ? <span className="text-muted">{task.condition_note}</span> : null}
      </li>,
    );
  }
  if (!rows.length) return null;
  return <ul className="flex flex-col gap-2 text-[14px]">{rows}</ul>;
}
