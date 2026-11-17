"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PillChoice, SelectField, TextAreaField, TextField, Toggle } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import { inr } from "@/lib/money";
import type { Apartment, Issue, IssuePriority } from "@/lib/types";
import { CHARGE_NAME, ISSUE_CATEGORIES } from "@/components/jobs/constants";
import { ConfirmDelete, formObject } from "@/components/jobs/confirm-delete";
import { deleteIssue, reopenIssue, resolveIssue, saveIssue } from "./actions";
import { ActionError } from "@/components/jobs/action-error";

type AptOption = Pick<Apartment, "id" | "code" | "name">;

/** Booking facts the owner needs to charge a guest. Never sent to housekeepers. */
export interface ChargeInfo {
  guest_name: string;
  deposit: number;
  deposit_status: string;
}

export function IssueFormButton({
  issue,
  apartments,
  defaultApt,
  autoOpen,
}: {
  issue?: Issue;
  apartments: AptOption[];
  defaultApt?: string | null;
  autoOpen?: boolean;
}) {
  const t = useTranslations("maintenance");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState<IssuePriority>(issue?.priority ?? "normal");
  const formId = useId();
  const { run, pending, error } = useAction();

  // Opened from a link (?new=1): open after hydration, then drop the query so a refresh does not reopen it.
  useEffect(() => {
    if (!autoOpen) return;
    window.setTimeout(() => setOpen(true), 0);
    router.replace("/maintenance", { scroll: false });
  }, [autoOpen, router]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formObject(e.currentTarget);
    void run(() => saveIssue({ ...data, priority, id: issue?.id ?? "" }), {
      success: issue ? t("form.saved") : t("form.reported"),
      onDone: () => setOpen(false),
    });
  }

  return (
    <>
      {issue ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Icon name="edit" size={16} /> {tc("edit")}
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Icon name="alert" size={18} /> {t("form.add")}
        </Button>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={issue ? t("form.editTitle") : t("form.addTitle")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : issue ? tc("save") : t("form.submit")}</Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField label={tc("apartment")} name="apartment_id"
              defaultValue={issue ? (issue.apartment_id ?? "both") : (defaultApt ?? apartments[0]?.id ?? "both")}>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
              ))}
              <option value="both">{tc("both")}</option>
            </SelectField>
            <SelectField label={t("form.category")} name="category" defaultValue={issue?.category ?? "maintenance"}>
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`category.${c}`)}</option>
              ))}
            </SelectField>
          </div>
          <PillChoice
            label={t("form.priority")}
            name={`${formId}-priority`}
            value={priority}
            onChange={setPriority}
            options={[
              { value: "low", label: t("priority.low") },
              { value: "normal", label: t("priority.normal") },
              { value: "urgent", label: t("priority.urgent"), activeClass: "bg-bad text-on-bad" },
            ]}
          />
          <TextAreaField label={t("form.text")} name="text" rows={4} required maxLength={2000} defaultValue={issue?.text ?? ""}
            placeholder={t("form.textPh")} />
          <p className="text-[12.5px] text-muted">{t("form.photos")}</p>
          <ActionError error={error} />
        </form>
      </Sheet>
    </>
  );
}

export function ResolveButton({ issue, charge }: { issue: Issue; charge: ChargeInfo | null }) {
  const t = useTranslations("maintenance");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [fromDeposit, setFromDeposit] = useState(false);
  const formId = useId();
  const { run, pending, error } = useAction();
  const chargeName = CHARGE_NAME[issue.category];
  const canCharge = !!charge && !!chargeName;
  const depositHeld = canCharge && charge.deposit_status === "held" && charge.deposit > 0;
  const amountNum = Number(amount) || 0;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formObject(e.currentTarget);
    void run(
      () =>
        resolveIssue({
          id: issue.id,
          resolution: data.resolution ?? "",
          cost: data.cost ?? "",
          charge: canCharge ? amount : "",
          fromDeposit: canCharge && depositHeld && amountNum > 0 && fromDeposit,
        }),
      {
        success: canCharge && amountNum > 0 ? t("resolve.charged") : t("resolve.saved"),
        onDone: () => setOpen(false),
      },
    );
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Icon name="check" size={16} /> {t("resolve.button")}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("resolve.title")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : t("resolve.submit")}</Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
          <p className="whitespace-pre-line rounded-[14px] bg-surface-2 px-3 py-2.5 text-[14px]">{issue.text}</p>
          <TextAreaField label={t("resolve.resolution")} name="resolution" rows={2} required maxLength={2000} placeholder={t("resolve.resolutionPh")} />
          <TextField label={t("resolve.cost")} name="cost" type="number" inputMode="numeric" min={0} step={1} hint={t("resolve.costHint")} />
          {canCharge ? (
            <div className="flex flex-col gap-3 rounded-[18px] bg-warn-soft p-3">
              <p className="text-[14px]">
                <strong>{t("resolve.chargeTitle", { guest: charge.guest_name })}</strong> {t("resolve.chargeBody", { name: chargeName })}
              </p>
              <TextField
                label={t("resolve.chargeAmount")}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                hint={t("resolve.chargeHint")}
              />
              {depositHeld ? (
                <Toggle
                  label={t("resolve.fromDeposit", { amount: inr(charge.deposit) })}
                  hint={amountNum > charge.deposit ? t("resolve.overDeposit") : t("resolve.fromDepositHint")}
                  checked={fromDeposit}
                  onChange={setFromDeposit}
                />
              ) : null}
              <p className="text-[12.5px] text-warn">{t("resolve.platformHint")}</p>
            </div>
          ) : null}
          <ActionError error={error} />
        </form>
      </Sheet>
    </>
  );
}

export function ReopenIssueButton({ id }: { id: string }) {
  const t = useTranslations("maintenance");
  const { run, pending, error } = useAction();
  return (
    <>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => reopenIssue({ issueId: id }), { success: t("reopened") })}>
        <Icon name="refresh" size={16} /> {t("reopen")}
      </Button>
      {error ? <span className="text-[13px] text-bad" role="alert">{error}</span> : null}
    </>
  );
}

export function DeleteIssueButton({ id }: { id: string }) {
  const t = useTranslations("maintenance");
  return (
    <ConfirmDelete title={t("deleteTitle")} body={t("deleteBody")} success={t("deleted")} onConfirm={() => deleteIssue({ issueId: id })} />
  );
}
