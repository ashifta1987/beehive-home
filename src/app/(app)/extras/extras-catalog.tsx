"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, ErrorBox } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { SelectField, TextAreaField, TextField, Toggle } from "@/components/ui/form";
import { AptChip, Pill } from "@/components/ui/pill";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import { inr } from "@/lib/money";
import type { Apartment, Extra, ExtraUnit } from "@/lib/types";
import { saveExtra } from "./actions";
import { EXTRA_UNITS } from "./constants";

type AptOption = Pick<Apartment, "id" | "code" | "name" | "tag_colour">;

/** "Add extra" + the catalog list; both open the extra sheet. */
export function ExtrasCatalog({ extras, apartments }: { extras: Extra[]; apartments: AptOption[] }) {
  const t = useTranslations("extras");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Extra | null>(null);
  const [nonce, setNonce] = useState(0);
  const apts = Object.fromEntries(apartments.map((a) => [a.id, a]));

  const openSheet = (e: Extra | null) => {
    setEditing(e);
    setNonce((n) => n + 1);
    setOpen(true);
  };

  return (
    <>
      <Card className="mb-4">
        <CardTitle
          action={
            <Button variant="honey" size="sm" className="min-h-11" onClick={() => openSheet(null)}>
              <Icon name="plus" size={16} />
              {t("add")}
            </Button>
          }
        >
          {t("catalog.title")}
        </CardTitle>
        {extras.length === 0 ? (
          <EmptyState icon={<Icon name="gift" size={32} />} title={t("catalog.emptyTitle")} body={t("catalog.emptyBody")} />
        ) : (
          <ul className="flex flex-col">
            {extras.map((e) => {
              const apt = e.apartment_id ? apts[e.apartment_id] : undefined;
              return (
                <li key={e.id} className="flex flex-col gap-2 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0 min-[600px]:flex-row min-[600px]:items-center">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[15px] font-semibold">{e.name}</span>
                      {apt ? <AptChip tag={apt.tag_colour} code={apt.code} /> : <Pill>{t("catalog.both")}</Pill>}
                      {!e.active ? <Pill tone="ink">{t("catalog.notOffered")}</Pill> : null}
                      {e.return_check ? <Pill tone="info">{t("catalog.returnCheck")}</Pill> : null}
                    </div>
                    {e.description ? <p className="text-[13px] text-muted">{e.description}</p> : null}
                    <p className="flex flex-wrap gap-x-3 text-[12.5px] text-muted">
                      {e.qty != null ? <span className="tabular">{t("catalog.youHave", { qty: e.qty })}</span> : null}
                      {e.deposit ? <span className="tabular">{t("catalog.deposit", { amount: inr(e.deposit) })}</span> : null}
                      {e.setup_note ? <span>{t("catalog.setupNote", { note: e.setup_note })}</span> : null}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 min-[600px]:justify-end">
                    {e.price == null ? (
                      <Button size="sm" variant="secondary" className="min-h-11 text-warn" onClick={() => openSheet(e)} aria-label={t("setPriceAria", { name: e.name })}>
                        <Icon name="alert" size={16} />
                        {t("setPrice")}
                      </Button>
                    ) : (
                      <span className="flex flex-col items-start min-[600px]:items-end">
                        <span className="tabular text-[16px] font-bold">{inr(e.price)}</span>
                        <span className="text-[12px] text-muted">{t(`units.${e.unit}`)}</span>
                      </span>
                    )}
                    <Button size="sm" variant="ghost" className="min-h-11" onClick={() => openSheet(e)} aria-label={t("editAria", { name: e.name })}>
                      <Icon name="edit" size={16} />
                      {t("edit")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[12.5px] text-muted">{t("catalog.tip")}</p>
      </Card>

      <ExtraSheet
        key={`${editing?.id ?? "new"}-${nonce}`}
        open={open}
        onClose={() => setOpen(false)}
        extra={editing}
        apartments={apartments}
      />
    </>
  );
}

interface Draft {
  id?: string;
  name: string;
  price: string;
  unit: ExtraUnit;
  apartment_id: string;
  qty: string;
  deposit: string;
  description: string;
  setup_note: string;
  return_check: boolean;
  active: boolean;
}

const toDraft = (e: Extra | null): Draft =>
  e
    ? {
        id: e.id,
        name: e.name,
        price: e.price == null ? "" : String(e.price),
        unit: e.unit,
        apartment_id: e.apartment_id ?? "",
        qty: e.qty == null ? "" : String(e.qty),
        deposit: e.deposit == null ? "" : String(e.deposit),
        description: e.description ?? "",
        setup_note: e.setup_note ?? "",
        return_check: e.return_check,
        active: e.active,
      }
    : { name: "", price: "", unit: "use", apartment_id: "", qty: "1", deposit: "", description: "", setup_note: "", return_check: false, active: true };

/** "" → null, "1,200" → 1200, junk → NaN (caught by validation). */
function optNumber(v: string): number | null {
  const s = v.replace(/[₹,\s]/g, "");
  if (s === "") return null;
  return /^\d+$/.test(s) ? Number(s) : Number.NaN;
}

function ExtraSheet({
  open,
  onClose,
  extra,
  apartments,
}: {
  open: boolean;
  onClose: () => void;
  extra: Extra | null;
  apartments: AptOption[];
}) {
  const t = useTranslations("extras");
  const [d, setD] = useState<Draft>(() => toDraft(extra));
  const [err, setErr] = useState<Partial<Record<"name" | "price" | "qty" | "deposit", string>>>({});
  const { run, pending, error } = useAction();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const formId = `extra-form-${d.id ?? "new"}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = optNumber(d.price);
    const qty = optNumber(d.qty);
    const deposit = optNumber(d.deposit);
    const errs: typeof err = {};
    if (!d.name.trim()) errs.name = t("errors.name");
    if (Number.isNaN(price)) errs.price = t("errors.price");
    if (Number.isNaN(qty)) errs.qty = t("errors.qty");
    if (Number.isNaN(deposit)) errs.deposit = t("errors.deposit");
    setErr(errs);
    if (Object.keys(errs).length) return;
    void run(
      () =>
        saveExtra({
          id: d.id,
          name: d.name,
          price,
          unit: d.unit,
          apartment_id: d.apartment_id || null,
          qty,
          deposit,
          description: d.description,
          setup_note: d.setup_note,
          return_check: d.return_check,
          active: d.active,
        }),
      { success: t("saved"), onDone: onClose },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={extra ? t("editTitle") : t("addTitle")}
      wide
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
        <TextField
          label={t("fields.name")}
          placeholder={t("fields.namePlaceholder")}
          required
          maxLength={80}
          value={d.name}
          onChange={(e) => set("name", e.target.value)}
          error={err.name}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t("fields.price")}
            inputMode="numeric"
            autoComplete="off"
            value={d.price}
            onChange={(e) => set("price", e.target.value)}
            error={err.price}
            hint={t("fields.priceHint")}
            className="tabular"
          />
          <SelectField label={t("fields.unit")} value={d.unit} onChange={(e) => set("unit", e.target.value as ExtraUnit)}>
            {EXTRA_UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`units.${u}`)}
              </option>
            ))}
          </SelectField>
        </div>
        <SelectField label={t("fields.apartment")} value={d.apartment_id} onChange={(e) => set("apartment_id", e.target.value)}>
          <option value="">{t("catalog.both")}</option>
          {apartments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("fields.qty")} inputMode="numeric" autoComplete="off" value={d.qty} onChange={(e) => set("qty", e.target.value)} error={err.qty} hint={t("fields.qtyHint")} className="tabular" />
          <TextField label={t("fields.deposit")} inputMode="numeric" autoComplete="off" value={d.deposit} onChange={(e) => set("deposit", e.target.value)} error={err.deposit} className="tabular" />
        </div>
        <TextAreaField label={t("fields.description")} maxLength={500} rows={2} value={d.description} onChange={(e) => set("description", e.target.value)} />
        <TextField label={t("fields.setupNote")} placeholder={t("fields.setupPlaceholder")} maxLength={300} value={d.setup_note} onChange={(e) => set("setup_note", e.target.value)} />
        <Toggle label={t("fields.returnCheck")} hint={t("fields.returnCheckHint")} checked={d.return_check} onChange={(v) => set("return_check", v)} />
        <Toggle label={t("fields.active")} hint={t("fields.activeHint")} checked={d.active} onChange={(v) => set("active", v)} />
        <ErrorBox>{error}</ErrorBox>
      </form>
    </Sheet>
  );
}
