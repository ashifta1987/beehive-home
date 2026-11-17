"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/ui/card";
import { SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import { parseRupees } from "@/lib/money";
import type { Apartment, Expense, ExpenseCategory } from "@/lib/types";
import { deleteExpense, saveExpense } from "./actions";
import { EXPENSE_CATEGORIES, PAID_VIA } from "./constants";

export type AptOption = Pick<Apartment, "id" | "code" | "name" | "tag_colour">;

interface Draft {
  id?: string;
  date: string;
  amount: string;
  category: ExpenseCategory;
  apartment_id: string;
  vendor: string;
  paid_via: string;
  note: string;
}

const fromExpense = (e: Expense): Draft => ({
  id: e.id,
  date: e.date,
  amount: String(e.amount),
  category: e.category,
  apartment_id: e.apartment_id ?? "",
  vendor: e.vendor ?? "",
  paid_via: e.paid_via ?? "",
  note: e.note ?? "",
});

const blankDraft = (date: string): Draft => ({
  date,
  amount: "",
  category: "repairs",
  apartment_id: "",
  vendor: "",
  paid_via: "upi",
  note: "",
});

/**
 * Add / edit / delete an expense. `expense` null = new.
 * Give it a fresh `key` each time it opens so the draft starts from the expense.
 */
export function ExpenseSheet({
  open,
  onClose,
  expense,
  defaultDate,
  apartments,
}: {
  open: boolean;
  onClose: () => void;
  expense: Expense | null;
  defaultDate: string;
  apartments: AptOption[];
}) {
  const t = useTranslations("expenses");
  const [d, setD] = useState<Draft>(() => (expense ? fromExpense(expense) : blankDraft(defaultDate)));
  const [fieldErr, setFieldErr] = useState<{ amount?: string; date?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, pending, error } = useAction();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseRupees(d.amount);
    const errs: typeof fieldErr = {};
    if (amount == null || amount <= 0) errs.amount = t("errors.amount");
    if (!d.date) errs.date = t("errors.date");
    setFieldErr(errs);
    if (Object.keys(errs).length) return;
    void run(
      () =>
        saveExpense({
          id: d.id,
          date: d.date,
          amount,
          category: d.category,
          apartment_id: d.apartment_id || null,
          vendor: d.vendor,
          paid_via: d.paid_via || null,
          note: d.note,
        }),
      { success: t("saved"), onDone: onClose },
    );
  };

  const remove = () => {
    if (!d.id) return;
    const id = d.id;
    void run(() => deleteExpense(id), { success: t("deleted"), onDone: onClose });
  };

  const formId = `expense-form-${d.id ?? "new"}`;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={expense ? t("editTitle") : t("addTitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3 pt-1" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("fields.date")} type="date" required value={d.date} onChange={(e) => set("date", e.target.value)} error={fieldErr.date} />
          <TextField
            label={t("fields.amount")}
            inputMode="numeric"
            required
            autoComplete="off"
            value={d.amount}
            onChange={(e) => set("amount", e.target.value)}
            error={fieldErr.amount}
            className="tabular"
          />
        </div>
        <SelectField label={t("fields.category")} value={d.category} onChange={(e) => set("category", e.target.value as ExpenseCategory)}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("fields.apartment")} value={d.apartment_id} onChange={(e) => set("apartment_id", e.target.value)} hint={d.apartment_id ? undefined : t("sharedHint")}>
          <option value="">{t("shared")}</option>
          {apartments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <TextField label={t("fields.vendor")} placeholder={t("fields.vendorPlaceholder")} maxLength={120} value={d.vendor} onChange={(e) => set("vendor", e.target.value)} />
          <SelectField label={t("fields.paidVia")} value={d.paid_via} onChange={(e) => set("paid_via", e.target.value)}>
            <option value="">{t("paidViaOptions.none")}</option>
            {PAID_VIA.map((p) => (
              <option key={p} value={p}>
                {t(`paidViaOptions.${p}`)}
              </option>
            ))}
          </SelectField>
        </div>
        <TextAreaField label={t("fields.note")} placeholder={t("fields.notePlaceholder")} maxLength={1000} rows={2} value={d.note} onChange={(e) => set("note", e.target.value)} />

        <ErrorBox>{error}</ErrorBox>

        {d.id ? (
          confirmDelete ? (
            <div role="alertdialog" aria-label={t("deleteConfirm")} className="flex flex-col gap-2 rounded-[14px] bg-bad-soft p-3">
              <p className="text-[14px] font-medium text-bad">{t("deleteConfirm")}</p>
              <div className="flex gap-2 [&>*]:flex-1">
                <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={pending}>
                  {t("deleteNo")}
                </Button>
                <Button variant="danger" onClick={remove} disabled={pending}>
                  {t("deleteYes")}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="self-start text-bad" onClick={() => setConfirmDelete(true)} disabled={pending}>
              {t("delete")}
            </Button>
          )
        ) : null}
      </form>
    </Sheet>
  );
}
