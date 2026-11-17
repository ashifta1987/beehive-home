"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Checkin } from "@/lib/types";
import { daysBetween, fmtDate, fmtStamp } from "@/lib/dates";
import { waLink } from "@/lib/guest";
import { cn } from "@/lib/ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { CardTitle, EmptyState, ErrorBox, Skeleton } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { AptChip, ChannelPill, Pill } from "@/components/ui/pill";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import { copyToFormC, getCheckinPhotos, markIdVerified, matchCheckin, setReviewed, type CheckinPhoto } from "./actions";

export type InboxCheckin = Checkin & { created_date: string };
export interface InboxBooking {
  id: string;
  apartment_id: string;
  guest_name: string;
  phone: string | null;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  status: string;
  id_verified: boolean;
  foreign_national: boolean;
  channel: string;
}
interface AptLite {
  id: string;
  code: string;
  name: string;
  tag_colour: string;
}

const ID_TYPE_KEYS = ["passport", "aadhaar", "driving", "voter", "other"];
const LANG_KEYS = ["en", "ml", "hi"];

export function CheckinsInbox({
  checkins,
  bookings,
  formC,
  apartments,
}: {
  checkins: InboxCheckin[];
  bookings: InboxBooking[];
  formC: string[];
  apartments: AptLite[];
}) {
  const t = useTranslations("checkins");
  const [openId, setOpenId] = useState<string | null>(null);
  const apt = (id: string) => apartments.find((a) => a.id === id);
  const fresh = checkins.filter((c) => !c.reviewed);
  const reviewed = checkins.filter((c) => c.reviewed);
  const open = checkins.find((c) => c.id === openId) ?? null;

  if (checkins.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="qr" size={34} />}
        title={t("emptyTitle")}
        body={t("emptyBody")}
        action={<ButtonLink href="/posters" variant="honey">{t("printPosters")}</ButtonLink>}
      />
    );
  }

  const row = (c: InboxCheckin) => {
    const a = apt(c.apartment);
    const b = c.booking_id ? bookings.find((x) => x.id === c.booking_id) : undefined;
    return (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => setOpenId(c.id)}
          className="flex w-full items-center gap-3 rounded-[20px] bg-surface p-3.5 text-left hover:bg-surface-2"
        >
          <AptChip tag={a?.tag_colour} code={a?.code ?? c.apartment} className="flex-none" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold">{c.full_name || t("noName")}</span>
            <span className="tabular truncate text-[12.5px] text-muted">
              {fmtStamp(c.created_at)} · {t("guestsShort", { adults: c.adults ?? 0, children: c.children ?? 0 })}
            </span>
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {!c.reviewed ? <Pill tone="info">{t("new")}</Pill> : null}
              {c.is_foreign ? <Pill tone="warn">{t("foreign")}</Pill> : null}
              <Pill tone={(c.photo_count ?? 0) > 0 || c.has_photo ? "ok" : "bad"}>
                {(c.photo_count ?? 0) > 0 ? t("photos", { count: c.photo_count ?? 0 }) : c.has_photo ? t("photoLegacy") : t("noPhotos")}
              </Pill>
              {b ? <Pill tone="neutral">{t("matchedTo", { name: b.guest_name })}</Pill> : <Pill tone="neutral">{t("notMatched")}</Pill>}
              {b?.id_verified ? <Pill tone="ok">{t("idVerified")}</Pill> : null}
            </span>
          </span>
          <Icon name="chevron" size={18} className="flex-none text-muted" />
        </button>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="ci-new">
        <h2 id="ci-new" className="mb-2.5 font-display text-[14px] font-bold">
          {t("newHeading")} <span className="tabular text-muted">({fresh.length})</span>
        </h2>
        {fresh.length === 0 ? (
          <p className="rounded-[20px] bg-surface p-4 text-[14px] text-muted">{t("allReviewed")}</p>
        ) : (
          <ul className="flex flex-col gap-2">{fresh.map(row)}</ul>
        )}
      </section>
      {reviewed.length > 0 ? (
        <section aria-labelledby="ci-done">
          <h2 id="ci-done" className="mb-2.5 font-display text-[14px] font-bold">{t("reviewedHeading")}</h2>
          <ul className="flex flex-col gap-2">{reviewed.map(row)}</ul>
        </section>
      ) : null}

      {open ? (
        <CheckinSheet
          key={open.id}
          checkin={open}
          apartment={apt(open.apartment)}
          bookings={bookings}
          formCDone={!!open.booking_id && formC.includes(open.booking_id)}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded-[20px] bg-surface-2 p-4">{children}</section>;
}

function Detail({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col", wide && "col-span-2")}>
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="break-words text-[14.5px] font-medium">{children || "—"}</dd>
    </div>
  );
}

type PhotoState = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; photos: CheckinPhoto[] };

function CheckinSheet({
  checkin: c,
  apartment,
  bookings,
  formCDone,
  onClose,
}: {
  checkin: InboxCheckin;
  apartment: AptLite | undefined;
  bookings: InboxBooking[];
  formCDone: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("checkins");
  const { run, pending, error } = useAction();
  const [photoState, setPhotoState] = useState<PhotoState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const [pickId, setPickId] = useState("");

  useEffect(() => {
    let alive = true;
    getCheckinPhotos(c.id)
      .then((res) => {
        if (!alive) return;
        setPhotoState(res.ok ? { status: "ok", photos: res.data ?? [] } : { status: "error", message: res.error });
      })
      .catch(() => alive && setPhotoState({ status: "error", message: t("photosError") }));
    return () => {
      alive = false;
    };
  }, [c.id, reload, t]);

  const sameApt = bookings.filter((b) => b.apartment_id === c.apartment && b.status !== "cancelled");
  const suggestions = sameApt.filter((b) => Math.abs(daysBetween(c.created_date, b.check_in)) <= 1 && b.id !== c.booking_id);
  const others = sameApt
    .filter((b) => b.id !== c.booking_id && !suggestions.some((s) => s.id === b.id))
    .sort((a, b) => Math.abs(daysBetween(c.created_date, a.check_in)) - Math.abs(daysBetween(c.created_date, b.check_in)))
    .slice(0, 40);
  const linked = c.booking_id ? bookings.find((b) => b.id === c.booking_id) : undefined;
  const idTypeLabel = c.id_type && ID_TYPE_KEYS.includes(c.id_type) ? t(`idTypes.${c.id_type}`) : c.id_type;
  const langLabel = c.lang && LANG_KEYS.includes(c.lang) ? t(`langs.${c.lang}`) : c.lang;
  const wa = waLink(c.phone, "");

  const match = (bookingId: string | null) =>
    run(() => matchCheckin({ checkinId: c.id, bookingId }), { success: bookingId ? t("matchedToast") : t("unmatchedToast"), onDone: () => setPickId("") });

  const bookingLine = (b: InboxBooking) => `${b.guest_name} · ${fmtDate(b.check_in)} → ${fmtDate(b.check_out)} · ${t("guestsShort", { adults: b.adults, children: b.children })}`;

  return (
    <Sheet
      open
      onClose={onClose}
      wide
      title={c.full_name || t("noName")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t("close")}</Button>
          {c.reviewed ? (
            <Button variant="secondary" disabled={pending} onClick={() => run(() => setReviewed({ checkinId: c.id, reviewed: false }), { success: t("markedNew") })}>
              {t("markNew")}
            </Button>
          ) : (
            <Button variant="primary" disabled={pending} onClick={() => run(() => setReviewed({ checkinId: c.id, reviewed: true }), { success: t("markedReviewed"), onDone: onClose })}>
              <Icon name="check" size={18} /> {t("markReviewed")}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ErrorBox>{error}</ErrorBox>

        <div className="flex flex-wrap items-center gap-2">
          <AptChip tag={apartment?.tag_colour} code={apartment?.code ?? c.apartment} />
          <span className="tabular text-[13px] text-muted">{t("submitted", { when: fmtStamp(c.created_at) })}</span>
          {c.is_foreign ? <Pill tone="warn">{t("foreign")}</Pill> : <Pill tone="neutral">{t("indian")}</Pill>}
        </div>

        <Panel>
          <CardTitle>{t("guestHeading")}</CardTitle>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Detail label={t("fullName")} wide>{c.full_name}</Detail>
            <Detail label={t("phone")}>
              {c.phone ? (
                <span className="flex flex-wrap items-center gap-2">
                  <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="tabular text-accent underline-offset-2 hover:underline">{c.phone}</a>
                  {wa ? (
                    <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={t("whatsapp")} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ok">
                      <Icon name="whatsapp" size={16} />
                    </a>
                  ) : null}
                </span>
              ) : null}
            </Detail>
            <Detail label={t("guests")}>{t("guestsShort", { adults: c.adults ?? 0, children: c.children ?? 0 })}</Detail>
            <Detail label={t("checkOut")}>{c.check_out ? fmtDate(c.check_out) : null}</Detail>
            <Detail label={t("idType")}>{idTypeLabel}</Detail>
            <Detail label={t("language")}>{langLabel}</Detail>
            <Detail label={t("rulesAccepted")}>{c.rules_accepted_at ? fmtStamp(c.rules_accepted_at) : t("no")}</Detail>
          </dl>
        </Panel>

        {c.is_foreign ? (
          <Panel>
            <CardTitle>{t("passportHeading")}</CardTitle>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Detail label={t("nationality")}>{c.nationality}</Detail>
              <Detail label={t("passportNo")}>{c.passport_no}</Detail>
              <Detail label={t("passportExpiry")}>{c.passport_expiry ? fmtDate(c.passport_expiry) : null}</Detail>
              <Detail label={t("visaType")}>{c.visa_type}</Detail>
              <Detail label={t("visaNo")}>{c.visa_no}</Detail>
              <Detail label={t("visaExpiry")}>{c.visa_expiry ? fmtDate(c.visa_expiry) : null}</Detail>
              <Detail label={t("arrivedIndia")}>{c.arrived_india ? fmtDate(c.arrived_india) : null}</Detail>
              <Detail label={t("arrivingFrom")}>{c.arriving_from}</Detail>
              <Detail label={t("nextDestination")} wide>{c.next_destination}</Detail>
            </dl>
            {c.check_out && ((c.visa_expiry && c.visa_expiry < c.check_out) || (c.passport_expiry && c.passport_expiry < c.check_out)) ? (
              <p className="mt-3 rounded-[12px] bg-bad-soft px-3 py-2 text-[13px] font-semibold text-bad">{t("expiryWarning")}</p>
            ) : null}
          </Panel>
        ) : null}

        <Panel>
          <CardTitle
            action={
              photoState.status !== "loading" ? (
                <Button size="sm" variant="ghost" onClick={() => { setPhotoState({ status: "loading" }); setReload((n) => n + 1); }}>
                  <Icon name="refresh" size={15} /> {t("reloadPhotos")}
                </Button>
              ) : null
            }
          >
            {t("photosHeading")}
          </CardTitle>
          {photoState.status === "loading" ? (
            <div className="grid grid-cols-2 gap-2" aria-busy="true" aria-label={t("loadingPhotos")}>
              <Skeleton className="aspect-[4/3] w-full" />
              <Skeleton className="aspect-[4/3] w-full" />
            </div>
          ) : photoState.status === "error" ? (
            <ErrorBox>{photoState.message}</ErrorBox>
          ) : photoState.photos.length === 0 ? (
            <p className="text-[14px] text-muted">{t("noPhotosBody")}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {photoState.photos.map((p, i) => (
                  <a key={i} href={p.src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-[14px] bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
                    <img src={p.src} alt={t("photoAlt", { n: i + 1, name: c.full_name ?? "" })} className="aspect-[4/3] w-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
                  </a>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-muted">{t("photosExpire")}</p>
            </>
          )}
        </Panel>

        <Panel>
          <CardTitle>{t("bookingHeading")}</CardTitle>
          {c.booking_id ? (
            <div className="flex flex-col gap-3">
              {linked ? (
                <div className="flex flex-col gap-1.5 rounded-[14px] bg-surface p-3">
                  <span className="text-[14.5px] font-semibold">{linked.guest_name}</span>
                  <span className="tabular text-[13px] text-muted">{fmtDate(linked.check_in)} → {fmtDate(linked.check_out)} · {t("guestsShort", { adults: linked.adults, children: linked.children })}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <ChannelPill channel={linked.channel} />
                    {linked.id_verified ? <Pill tone="ok">{t("idVerified")}</Pill> : <Pill tone="warn">{t("idNotVerified")}</Pill>}
                    {linked.foreign_national ? <Pill tone="warn">{t("foreign")}</Pill> : null}
                    {formCDone ? <Pill tone="ok">{t("formCCopied")}</Pill> : null}
                  </span>
                </div>
              ) : (
                <p className="text-[14px] text-muted">{t("linkedMissing")}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {linked && !linked.id_verified ? (
                  <Button variant="honey" disabled={pending} onClick={() => run(() => markIdVerified(c.id), { success: t("verifiedToast") })}>
                    <Icon name="badge" size={18} /> {t("markVerified")}
                  </Button>
                ) : null}
                {c.is_foreign && linked ? (
                  <Button variant="secondary" disabled={pending} onClick={() => run(() => copyToFormC(c.id), { success: t("formCToast") })}>
                    <Icon name="globe" size={18} /> {formCDone ? t("copyAgain") : t("copyFormC")}
                  </Button>
                ) : null}
                <Button variant="ghost" disabled={pending} onClick={() => match(null)}>
                  {t("unmatch")}
                </Button>
              </div>
              {linked && !linked.id_verified ? <p className="text-[12.5px] text-muted">{t("verifyHint")}</p> : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {suggestions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <span className="text-[12.5px] font-semibold text-muted">{t("suggested")}</span>
                  {suggestions.map((b) => (
                    <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-surface p-3">
                      <span className="tabular min-w-0 flex-1 text-[14px]">{bookingLine(b)}</span>
                      <Button size="sm" variant="primary" disabled={pending} onClick={() => match(b.id)}>{t("match")}</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[14px] text-muted">{t("noSuggestions")}</p>
              )}
              {others.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor={`pick-${c.id}`} className="text-[12.5px] font-semibold text-muted">{t("pickOther")}</label>
                  <div className="flex gap-2">
                    <Select id={`pick-${c.id}`} value={pickId} onChange={(e) => setPickId(e.target.value)} className="min-w-0 flex-1">
                      <option value="">{t("pickPlaceholder")}</option>
                      {others.map((b) => (
                        <option key={b.id} value={b.id}>{bookingLine(b)}</option>
                      ))}
                    </Select>
                    <Button variant="primary" disabled={!pickId || pending} onClick={() => match(pickId)}>{t("match")}</Button>
                  </div>
                </div>
              ) : suggestions.length === 0 ? (
                <p className="text-[13px] text-muted">{t("noBookings")}</p>
              ) : null}
            </div>
          )}
        </Panel>
      </div>
    </Sheet>
  );
}
