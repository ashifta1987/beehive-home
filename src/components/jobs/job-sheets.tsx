"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, PillChoice, Textarea, Field } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useAction, useToast } from "@/components/ui/toast";
import { fmtDay, fmtStamp } from "@/lib/dates";
import type { Asset, Task } from "@/lib/types";
import { cn } from "@/lib/ui";
import { reportCondition, saveInventory } from "@/app/(app)/jobs/actions";
import { compareCounts } from "./logic";
import { ActionError } from "./action-error";

export type CountAsset = Pick<Asset, "id" | "name" | "room" | "qty" | "value">;

/** "Theft check" panel under a turnover job: pills like "Towels 6/6", "Kettle ?". */
export function TheftCheck({
  task,
  aptCode,
  assets,
  locale,
}: {
  task: Task;
  aptCode: string;
  assets: CountAsset[];
  locale: string;
}) {
  const t = useTranslations("jobs");
  const [open, setOpen] = useState(false);
  const lines = compareCounts(assets, task.inventory);
  return (
    <section className="flex flex-col gap-2.5 rounded-[22px] bg-surface px-4 py-3.5" aria-label={t("theft.title", { code: aptCode })}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-[13px] font-bold">{t("theft.title", { code: aptCode })}</h3>
        {task.inventory_at ? (
          <span className="text-[12px] text-muted">{t("theft.checkedAt", { when: fmtStamp(task.inventory_at) })}</span>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-2">
        {lines.map((l) => (
          <li
            key={l.asset.id}
            className={cn(
              "tabular rounded-full px-2.5 py-1.5 text-[13px] font-semibold",
              l.counted === null ? "bg-surface-2 text-muted" : l.short > 0 ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok",
            )}
          >
            {l.asset.name} {l.counted === null ? "?" : `${l.counted}/${l.expected}`}
            {l.short > 0 ? <span className="sr-only"> · {t("theft.short", { count: l.short })}</span> : null}
          </li>
        ))}
      </ul>
      {task.missing_count ? (
        <p className="text-[13px] font-semibold text-bad">{t("theft.missingReported", { count: task.missing_count })}</p>
      ) : null}
      <Button variant="honey" size="sm" className="self-start" onClick={() => setOpen(true)}>
        {task.inventory_at ? t("theft.recount") : t("theft.check")}
      </Button>
      <InventorySheet open={open} onClose={() => setOpen(false)} task={task} aptCode={aptCode} assets={assets} locale={locale} />
    </section>
  );
}

function InventorySheet({
  open,
  onClose,
  task,
  aptCode,
  assets,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  task: Task;
  aptCode: string;
  assets: CountAsset[];
  locale: string;
}) {
  const t = useTranslations("jobs");
  const tc = useTranslations("common");
  const formId = useId();
  const toast = useToast();
  const { run, pending, error } = useAction();
  const initial = () =>
    Object.fromEntries(assets.map((a) => [a.id, String(task.inventory?.[a.id] ?? a.qty)])) as Record<string, string>;
  const [counts, setCounts] = useState<Record<string, string>>(initial);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed: Record<string, number> = {};
    for (const a of assets) {
      const n = Number(counts[a.id]);
      if (counts[a.id] === "" || !Number.isInteger(n) || n < 0) {
        setLocalError(t("inv.enterCount", { name: a.name }));
        return;
      }
      parsed[a.id] = n;
    }
    setLocalError(null);
    void run(() => saveInventory({ taskId: task.id, counts: parsed }), {
      onDone: (data) => {
        const missing = data?.missing ?? 0;
        toast(missing ? t("inv.missingToast", { count: missing }) : t("inv.allToast"), missing ? "bad" : "ok");
        onClose();
      },
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("inv.title", { code: aptCode })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{tc("cancel")}</Button>
          <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : t("inv.save")}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <p className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-[14px]">
          {t("inv.intro", { guest: task.guest_first_name || t("theGuest"), date: fmtDay(task.date, locale) })}
        </p>
        <ul className="flex flex-col gap-2">
          {assets.map((a) => {
            const n = Number(counts[a.id]);
            const short = counts[a.id] !== "" && Number.isFinite(n) && n < a.qty;
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-[14px] bg-surface-2 px-3 py-2">
                <label htmlFor={`${formId}-${a.id}`} className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{a.name}</span>
                  <span className="block text-[12.5px] text-muted">
                    {[a.room, t("inv.expected", { count: a.qty })].filter(Boolean).join(" · ")}
                  </span>
                </label>
                <button
                  type="button"
                  aria-label={t("inv.fewer", { name: a.name })}
                  className="h-11 w-11 flex-none rounded-[11px] bg-surface text-[20px]"
                  onClick={() => setCounts((c) => ({ ...c, [a.id]: String(Math.max(0, (Number(c[a.id]) || 0) - 1)) }))}
                >
                  −
                </button>
                <Input
                  id={`${formId}-${a.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={counts[a.id]}
                  onChange={(e) => setCounts((c) => ({ ...c, [a.id]: e.target.value }))}
                  className={cn("tabular w-16 flex-none bg-surface px-2 text-center", short && "text-bad")}
                />
                <button
                  type="button"
                  aria-label={t("inv.more", { name: a.name })}
                  className="h-11 w-11 flex-none rounded-[11px] bg-surface text-[20px]"
                  onClick={() => setCounts((c) => ({ ...c, [a.id]: String((Number(c[a.id]) || 0) + 1) }))}
                >
                  +
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-[12.5px] text-muted">{t("inv.hint")}</p>
        <ActionError error={localError ?? error} />
      </form>
    </Sheet>
  );
}

/** "Messy or damaged" form → issue for the owner. */
export function ConditionSheet({ open, onClose, task, aptCode }: { open: boolean; onClose: () => void; task: Task; aptCode: string }) {
  const t = useTranslations("jobs");
  const tc = useTranslations("common");
  const formId = useId();
  const { run, pending, error } = useAction();
  const [kind, setKind] = useState<"messy" | "damaged">("messy");
  const [note, setNote] = useState("");
  const [hours, setHours] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) {
      setLocalError(t("cond.describeFirst"));
      return;
    }
    setLocalError(null);
    void run(() => reportCondition({ taskId: task.id, kind, note, hours }), {
      success: t("cond.reported"),
      onDone: onClose,
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("cond.title", { code: aptCode })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{tc("cancel")}</Button>
          <Button type="submit" form={formId} variant="danger" disabled={pending}>{pending ? tc("saving") : t("cond.submit")}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="rounded-[14px] bg-surface-2 px-3 py-2.5 text-[14px]">
          {t("cond.intro", { guest: task.guest_first_name || t("theGuest") })}
        </p>
        <PillChoice
          label={t("cond.what")}
          name={`${formId}-kind`}
          value={kind}
          onChange={setKind}
          options={[
            { value: "messy", label: t("cond.messy"), activeClass: "bg-bad text-on-bad" },
            { value: "damaged", label: t("cond.damaged"), activeClass: "bg-bad text-on-bad" },
          ]}
        />
        <Field label={t("cond.describe")} htmlFor={`${formId}-note`}>
          <Textarea
            id={`${formId}-note`}
            rows={3}
            required
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("cond.describePh")}
          />
        </Field>
        <Field label={t("cond.hours")} htmlFor={`${formId}-hours`} hint={t("cond.hoursHint")}>
          <Input
            id={`${formId}-hours`}
            type="number"
            inputMode="decimal"
            min={0}
            max={48}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </Field>
        <p className="text-[12.5px] text-muted">{t("cond.photos")}</p>
        <ActionError error={localError ?? error} />
      </form>
    </Sheet>
  );
}

/** Small link chip used for "Report a problem". */
export function ReportLink({ aptId, className, children }: { aptId: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={`/maintenance?new=1&apt=${encodeURIComponent(aptId)}`} className={className}>
      {children}
    </Link>
  );
}
