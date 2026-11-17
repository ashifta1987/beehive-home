"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { Campaign, Listing } from "@/lib/types";
import { CHANNEL_LABEL } from "@/lib/guest";
import { Button } from "@/components/ui/button";
import { ErrorBox } from "@/components/ui/card";
import { SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import { DeleteButton } from "@/components/today/delete-button";
import { deleteCampaign, deleteListing, markReviewAsked, saveCampaign, saveListing } from "../actions";

export const CAMPAIGN_CHANNELS = ["all", "airbnb", "booking", "direct", "instagram", "whatsapp", "google"] as const;
const LISTING_CHANNELS = ["airbnb", "booking", "direct", "other"] as const;
const LISTING_STATUS = ["live", "paused", "draft"] as const;

type AptOption = { id: string; name: string };

function useSheet() {
  const [open, setOpen] = useState(false);
  return { open, show: () => setOpen(true), hide: () => setOpen(false) };
}

function TriggerButton({ edit, label }: { edit: boolean; label: string }) {
  return (
    <>
      <Icon name={edit ? "edit" : "plus"} size={16} />
      {label}
    </>
  );
}

// ── Listings ────────────────────────────────────────────────────────────────

export function ListingButton({
  listing,
  apartments,
  apartmentId,
  label,
  primary,
}: {
  listing?: Listing;
  apartments: AptOption[];
  apartmentId?: string;
  label: string;
  primary?: boolean;
}) {
  const s = useSheet();
  return (
    <>
      <Button size="sm" variant={primary ? "primary" : "secondary"} onClick={s.show}>
        <TriggerButton edit={!!listing} label={label} />
      </Button>
      {s.open ? <ListingSheet listing={listing} apartments={apartments} apartmentId={apartmentId} onClose={s.hide} /> : null}
    </>
  );
}

function ListingSheet({ listing, apartments, apartmentId, onClose }: { listing?: Listing; apartments: AptOption[]; apartmentId?: string; onClose: () => void }) {
  const t = useTranslations("marketing");
  const tc = useTranslations("common");
  const formId = useId();
  const { run, pending, error, setError } = useAction();
  const [f, setF] = useState({
    apartment_id: listing?.apartment_id ?? apartmentId ?? apartments[0]?.id ?? "",
    channel: listing?.channel ?? "airbnb",
    title: listing?.title ?? "",
    url: listing?.url ?? "",
    price: listing?.price != null ? String(listing.price) : "",
    status: listing?.status ?? "live",
    rating: listing?.rating != null ? String(listing.rating) : "",
    reviews: listing?.reviews != null ? String(listing.reviews) : "",
    note: listing?.note ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const urlBad = !!f.url.trim() && !/^https?:\/\/\S+$/i.test(f.url.trim());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (urlBad) {
      setError(t("listing.urlInvalid"));
      return;
    }
    run(() => saveListing({ id: listing?.id ?? null, ...f }), { success: t("listing.saved"), onDone: onClose });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={listing ? t("listing.editTitle") : t("listing.newTitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{tc("cancel")}</Button>
          <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <div className="grid gap-3 min-[600px]:grid-cols-2">
          <SelectField label={t("listing.apartment")} value={f.apartment_id} onChange={(e) => set("apartment_id", e.target.value)} required>
            {apartments.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </SelectField>
          <SelectField label={t("listing.channel")} value={f.channel} onChange={(e) => set("channel", e.target.value)}>
            {LISTING_CHANNELS.map((c) => (
              <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
            ))}
          </SelectField>
        </div>
        <TextField label={t("listing.titleField")} value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={200} />
        <TextField label={t("listing.url")} type="url" inputMode="url" placeholder="https://" value={f.url} onChange={(e) => set("url", e.target.value)} maxLength={500} error={urlBad ? t("listing.urlInvalid") : null} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("listing.price")} inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value)} hint={t("listing.priceHint")} />
          <SelectField label={t("listing.status")} value={f.status} onChange={(e) => set("status", e.target.value)}>
            {LISTING_STATUS.map((s) => (
              <option key={s} value={s}>{t(`listingStatus.${s}`)}</option>
            ))}
          </SelectField>
          <TextField label={t("listing.rating")} inputMode="decimal" value={f.rating} onChange={(e) => set("rating", e.target.value)} hint={t("listing.ratingHint")} />
          <TextField label={t("listing.reviews")} inputMode="numeric" value={f.reviews} onChange={(e) => set("reviews", e.target.value)} />
        </div>
        <TextAreaField label={t("listing.note")} placeholder={t("listing.noteHint")} value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={1000} />
        <ErrorBox>{error}</ErrorBox>
        {listing ? (
          <DeleteButton
            title={t("listing.deleteTitle")}
            body={t("listing.deleteBody")}
            success={t("listing.deleted")}
            onConfirm={() => deleteListing({ id: listing.id })}
            onDone={onClose}
          />
        ) : null}
      </form>
    </Sheet>
  );
}

// ── Campaigns ───────────────────────────────────────────────────────────────

export function CampaignButton({ campaign, label, primary }: { campaign?: Campaign; label: string; primary?: boolean }) {
  const s = useSheet();
  return (
    <>
      <Button size={primary ? "md" : "sm"} variant={primary ? "primary" : "secondary"} onClick={s.show}>
        <TriggerButton edit={!!campaign} label={label} />
      </Button>
      {s.open ? <CampaignSheet campaign={campaign} onClose={s.hide} /> : null}
    </>
  );
}

function CampaignSheet({ campaign, onClose }: { campaign?: Campaign; onClose: () => void }) {
  const t = useTranslations("marketing");
  const tc = useTranslations("common");
  const formId = useId();
  const { run, pending, error, setError } = useAction();
  const [f, setF] = useState({
    name: campaign?.name ?? "",
    channel: campaign?.channel ?? "all",
    spend: campaign?.spend ? String(campaign.spend) : "",
    start: campaign?.start ?? "",
    end: campaign?.end ?? "",
    offer: campaign?.offer ?? "",
    result: campaign?.result ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const endBad = !!f.start && !!f.end && f.end < f.start;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setError(t("campaign.nameRequired"));
    if (endBad) return setError(t("campaign.endBefore"));
    run(() => saveCampaign({ id: campaign?.id ?? null, ...f }), { success: t("campaign.saved"), onDone: onClose });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={campaign ? t("campaign.editTitle") : t("campaign.newTitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{tc("cancel")}</Button>
          <Button type="submit" form={formId} disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <TextField label={t("campaign.name")} placeholder={t("campaign.nameHint")} value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label={t("campaign.channel")} value={f.channel} onChange={(e) => set("channel", e.target.value)}>
            {CAMPAIGN_CHANNELS.map((c) => (
              <option key={c} value={c}>{t(`campaignChannel.${c}`)}</option>
            ))}
          </SelectField>
          <TextField label={t("campaign.spend")} inputMode="numeric" value={f.spend} onChange={(e) => set("spend", e.target.value)} />
          <TextField label={t("campaign.start")} type="date" value={f.start} onChange={(e) => set("start", e.target.value)} />
          <TextField label={t("campaign.end")} type="date" value={f.end} onChange={(e) => set("end", e.target.value)} error={endBad ? t("campaign.endBefore") : null} />
        </div>
        <TextAreaField label={t("campaign.offer")} value={f.offer} onChange={(e) => set("offer", e.target.value)} maxLength={1000} />
        <TextAreaField label={t("campaign.result")} placeholder={t("campaign.resultHint")} value={f.result} onChange={(e) => set("result", e.target.value)} maxLength={1000} />
        <ErrorBox>{error}</ErrorBox>
        {campaign ? (
          <DeleteButton
            title={t("campaign.deleteTitle")}
            body={t("campaign.deleteBody")}
            success={t("campaign.deleted")}
            onConfirm={() => deleteCampaign({ id: campaign.id })}
            onDone={onClose}
          />
        ) : null}
      </form>
    </Sheet>
  );
}

// ── Review requests ─────────────────────────────────────────────────────────

export function MarkAskedButton({ bookingId }: { bookingId: string }) {
  const t = useTranslations("marketing");
  const { run, pending, error } = useAction();
  return (
    <span className="flex flex-col items-end gap-1">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => markReviewAsked({ id: bookingId }), { success: t("reviews.marked") })}>
        <Icon name="check" size={16} />
        {t("reviews.markAsked")}
      </Button>
      {error ? <span role="alert" className="text-[12px] text-bad">{error}</span> : null}
    </span>
  );
}
