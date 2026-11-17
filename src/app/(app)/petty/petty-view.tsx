"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, ErrorBox } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PillChoice, SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { AptChip, Pill } from "@/components/ui/pill";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import { fmtDay } from "@/lib/dates";
import { inr, parseRupees } from "@/lib/money";
import type { Apartment, Petty, PettyCategory } from "@/lib/types";
import { cn } from "@/lib/ui";
import { deletePetty, savePetty } from "./actions";
import { PETTY_CATEGORIES } from "./constants";

type AptOption = Pick<Apartment, "id" | "code" | "name" | "tag_colour">;
type Row = Petty & { by: string | null };

interface Draft {
  id?: string;
  type: "in" | "out";
  date: string;
  amount: string;
  category: PettyCategory;
  apartment_id: string;
  note: string;
}

export function PettyView({
  rows,
  apartments,
  defaultDate,
  locale,
  isOwner,
  userId,
}: {
  rows: Row[];
  apartments: AptOption[];
  defaultDate: string;
  locale: string;
  isOwner: boolean;
  userId: string;
}) {
  const t = useTranslations("petty");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [nonce, setNonce] = useState(0);
  const apts = Object.fromEntries(apartments.map((a) => [a.id, a]));

  const openNew = (type: "in" | "out") => {
    setDraft({ type, date: defaultDate, amount: "", category: type === "in" ? "other" : "supplies", apartment_id: "", note: "" });
    setNonce((n) => n + 1);
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setDraft({
      id: r.id,
      type: r.type,
      date: r.date,
      amount: String(r.amount),
      category: r.category,
      apartment_id: r.apartment_id ?? "",
      note: r.note ?? "",
    });
    setNonce((n) => n + 1);
    setOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2 [&>*]:flex-1 min-[600px]:justify-end min-[600px]:[&>*]:flex-none">
        <Button variant="honey" onClick={() => openNew("out")}>
          <Icon name="plus" size={18} />
          {t("addSpend")}
        </Button>
        <Button variant="secondary" onClick={() => openNew("in")}>
          <Icon name="wallet" size={18} />
          {t("addReceived")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Icon name="wallet" size={32} />}
          title={t("emptyTitle")}
          body={isOwner ? t("emptyBodyOwner") : t("emptyBodyHk")}
          action={
            <Button onClick={() => openNew(isOwner ? "in" : "out")}>
              <Icon name="plus" size={18} />
              {isOwner ? t("addReceived") : t("addSpend")}
            </Button>
          }
        />
      ) : (
        <Card>
          <CardTitle>{t("list")}</CardTitle>
          <ul className="-mx-2 flex flex-col">
            {rows.map((r) => {
              const apt = r.apartment_id ? apts[r.apartment_id] : undefined;
              const mine = r.created_by === userId;
              const canEdit = isOwner || mine;
              const who = mine ? t("byYou") : r.by ? t("byName", { name: r.by }) : null;
              const sub = [fmtDay(r.date, locale), who].filter(Boolean).join(" · ");
              const amount = (
                <span className={cn("tabular flex-none text-[15px] font-bold", r.type === "in" ? "text-ok" : "text-ink")}>
                  {r.type === "in" ? "+" : "−"}
                  {inr(r.amount)}
                </span>
              );
              const body = (
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-semibold">
                    {r.type === "in" ? <Pill tone="ok">{t("received")}</Pill> : <span>{t(`categories.${r.category}`)}</span>}
                    {apt ? <AptChip tag={apt.tag_colour} code={apt.code} /> : <Pill>{t("both")}</Pill>}
                  </span>
                  <span className="truncate text-[13px] text-muted">{sub}</span>
                  {r.note ? <span className="line-clamp-2 text-[13px] text-muted">{r.note}</span> : null}
                </span>
              );
              return (
                <li key={r.id} className="border-b border-line last:border-b-0">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      aria-label={t("editAria", { what: `${r.type === "in" ? t("received") : t(`categories.${r.category}`)} ${inr(r.amount)} ${fmtDay(r.date, locale)}` })}
                      className="flex min-h-14 w-full items-center gap-3 rounded-[14px] px-2 py-2.5 text-left hover:bg-surface-2"
                    >
                      {body}
                      {amount}
                      <Icon name="edit" size={18} className="flex-none text-muted" aria-hidden />
                    </button>
                  ) : (
                    <div className="flex min-h-14 items-center gap-3 px-2 py-2.5">
                      {body}
                      {amount}
                      <span className="w-[18px] flex-none" aria-hidden />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {draft ? (
        <PettySheet key={nonce} open={open} onClose={() => setOpen(false)} initial={draft} apartments={apartments} isOwner={isOwner} />
      ) : null}
    </>
  );
}

function PettySheet({
  open,
  onClose,
  initial,
  apartments,
  isOwner,
}: {
  open: boolean;
  onClose: () => void;
  initial: Draft;
  apartments: AptOption[];
  isOwner: boolean;
}) {
  const t = useTranslations("petty");
  const [d, setD] = useState<Draft>(initial);
  const [fieldErr, setFieldErr] = useState<{ amount?: string; date?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, pending, error } = useAction();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const formId = `petty-form-${d.id ?? "new"}`;

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
        savePetty({
          id: d.id,
          type: d.type,
          date: d.date,
          amount,
          category: d.category,
          apartment_id: d.apartment_id || null,
          note: d.note,
        }),
      { success: t("saved"), onDone: onClose },
    );
  };

  const remove = () => {
    if (!d.id) return;
    const id = d.id;
    void run(() => deletePetty(id), { success: t("deleted"), onDone: onClose });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={d.id ? t("editTitle") : d.type === "in" ? t("addReceived") : t("addSpend")}
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
        <PillChoice
          label={t("fields.type")}
          name="petty-type"
          value={d.type}
          onChange={(v) => set("type", v)}
          options={[
            { value: "out", label: t("typeOut") },
            { value: "in", label: t("typeIn"), activeClass: "bg-ok text-surface" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("fields.date")} type="date" required value={d.date} onChange={(e) => set("date", e.target.value)} error={fieldErr.date} />
          <TextField
            label={t("fields.amount")}
            inputMode="numeric"
            autoComplete="off"
            required
            value={d.amount}
            onChange={(e) => set("amount", e.target.value)}
            error={fieldErr.amount}
            className="tabular"
          />
        </div>
        <SelectField label={d.type === "in" ? t("fields.categoryIn") : t("fields.category")} value={d.category} onChange={(e) => set("category", e.target.value as PettyCategory)}>
          {PETTY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("fields.apartment")} value={d.apartment_id} onChange={(e) => set("apartment_id", e.target.value)}>
          <option value="">{t("both")}</option>
          {apartments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label={d.type === "in" ? t("fields.noteIn") : t("fields.note")}
          placeholder={d.type === "in" ? t("fields.noteInPlaceholder") : t("fields.notePlaceholder")}
          maxLength={1000}
          rows={2}
          value={d.note}
          onChange={(e) => set("note", e.target.value)}
        />

        <ErrorBox>{error}</ErrorBox>

        {d.id && isOwner ? (
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
