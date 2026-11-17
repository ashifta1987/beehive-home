"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SelectField, TextAreaField, TextField, Toggle } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import type { Apartment, Asset } from "@/lib/types";
import { ASSET_CATEGORIES } from "@/components/jobs/constants";
import { ConfirmDelete, formObject } from "@/components/jobs/confirm-delete";
import { deleteAsset, saveAsset } from "./actions";
import { ActionError } from "@/components/jobs/action-error";

type AptOption = Pick<Apartment, "id" | "code" | "name">;

export function AssetFormButton({
  asset,
  apartments,
  defaultApt,
  rooms,
}: {
  asset?: Asset;
  apartments: AptOption[];
  defaultApt?: string | null;
  /** Rooms already used, offered as suggestions. */
  rooms: string[];
}) {
  const t = useTranslations("assets");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState(asset?.count_on_checkout ?? false);
  const formId = useId();
  const { run, pending, error } = useAction();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formObject(e.currentTarget);
    void run(() => saveAsset({ ...data, count_on_checkout: counted, id: asset?.id ?? "" }), {
      success: asset ? t("form.saved") : t("form.added"),
      onDone: () => setOpen(false),
    });
  }

  return (
    <>
      {asset ? (
        <Button size="sm" variant="ghost" onClick={() => { setCounted(asset.count_on_checkout); setOpen(true); }} aria-label={`${tc("edit")}: ${asset.name}`}>
          <Icon name="edit" size={16} /> {tc("edit")}
        </Button>
      ) : (
        <Button onClick={() => { setCounted(false); setOpen(true); }}>
          <Icon name="plus" size={18} /> {t("form.add")}
        </Button>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={asset ? t("form.editTitle") : t("form.addTitle")}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
          <TextField label={t("form.name")} name="name" required maxLength={120} defaultValue={asset?.name ?? ""} placeholder={t("form.namePh")} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label={tc("apartment")} name="apartment_id" required defaultValue={asset?.apartment_id ?? defaultApt ?? apartments[0]?.id}>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
              ))}
            </SelectField>
            <SelectField label={t("form.category")} name="category" defaultValue={asset?.category ?? "linen"}>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`category.${c}`)}</option>
              ))}
            </SelectField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField label={t("form.room")} name="room" maxLength={60} list={`${formId}-rooms`} defaultValue={asset?.room ?? ""}
              placeholder={t("form.roomPh")} className="col-span-3 min-[480px]:col-span-1" />
            <TextField label={t("form.qty")} name="qty" type="number" inputMode="numeric" required min={0} max={10000} step={1}
              defaultValue={asset?.qty ?? 1} className="col-span-3 min-[480px]:col-span-1" />
            <TextField label={t("form.value")} name="value" type="number" inputMode="numeric" min={0} step={1}
              defaultValue={asset?.value ?? ""} hint={tc("optional")} className="col-span-3 min-[480px]:col-span-1" />
          </div>
          <datalist id={`${formId}-rooms`}>
            {rooms.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <Toggle label={t("form.countOnCheckout")} hint={t("form.countHint")} checked={counted} onChange={setCounted} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t("form.purchased")} name="purchased" type="date" defaultValue={asset?.purchased ?? ""} hint={tc("optional")} />
            <TextField label={t("form.warranty")} name="warranty_until" type="date" defaultValue={asset?.warranty_until ?? ""} hint={tc("optional")} />
          </div>
          <TextField label={t("form.serial")} name="serial" maxLength={120} defaultValue={asset?.serial ?? ""} hint={tc("optional")} />
          <TextAreaField label={tc("notes")} name="note" rows={2} maxLength={1000} defaultValue={asset?.note ?? ""} />
          <ActionError error={error} />
        </form>
      </Sheet>
    </>
  );
}

export function DeleteAssetButton({ asset }: { asset: Pick<Asset, "id" | "name"> }) {
  const t = useTranslations("assets");
  return (
    <ConfirmDelete
      title={t("deleteTitle")}
      body={t("deleteBody", { name: asset.name })}
      success={t("deleted")}
      onConfirm={() => deleteAsset({ assetId: asset.id })}
    />
  );
}
