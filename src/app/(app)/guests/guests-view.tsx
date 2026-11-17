"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Booking, GuestTag, TagColour } from "@/lib/types";
import type { GuestSummary } from "@/lib/bookings";
import { fmtDate, fmtDay, nights } from "@/lib/dates";
import { firstName, waLink } from "@/lib/guest";
import { inr } from "@/lib/money";
import { cn } from "@/lib/ui";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { Card, EmptyState, ErrorBox, PageHeader, Stat } from "@/components/ui/card";
import { PillChoice, TextAreaField, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { AptChip, ChannelPill, Pill, type Tone } from "@/components/ui/pill";
import { Sheet } from "@/components/ui/sheet";
import { useAction } from "@/components/ui/toast";
import { BookingSheet } from "@/components/bookings/booking-sheet";
import { saveGuestProfile } from "./actions";

export type GuestBookingRow = Pick<
  Booking,
  "id" | "apartment_id" | "guest_name" | "phone" | "email" | "check_in" | "check_out" | "status" | "total" | "commission" | "channel" | "foreign_national"
>;
type Guest = GuestSummary<GuestBookingRow>;
interface Apt {
  id: string;
  code: string;
  tag_colour: TagColour;
}

const TAG_TONE: Record<GuestTag, Tone> = { none: "neutral", repeat: "info", vip: "ok", blocked: "bad" };
type TagFilter = "all" | "repeat" | "vip" | "blocked";

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[13px] text-warn" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} aria-hidden className={i < value ? "" : "opacity-30"}>★</span>
      ))}
    </span>
  );
}

export function GuestsView({ guests, apartments }: { guests: Guest[]; apartments: Apt[] }) {
  const t = useTranslations("guests");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const apts = useMemo(() => new Map(apartments.map((a) => [a.id, a])), [apartments]);

  const stats = useMemo(
    () => ({
      total: guests.length,
      repeat: guests.filter((g) => g.stays > 1).length,
      foreign: guests.filter((g) => g.foreign).length,
      blocked: guests.filter((g) => g.profile?.tag === "blocked").length,
    }),
    [guests],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return guests.filter((g) => {
      if (tagFilter === "repeat" && !(g.stays > 1 || g.profile?.tag === "repeat")) return false;
      if ((tagFilter === "vip" || tagFilter === "blocked") && g.profile?.tag !== tagFilter) return false;
      if (!q) return true;
      const hay = `${g.name} ${g.phone ?? ""} ${g.email ?? ""} ${g.profile?.city ?? ""} ${g.profile?.nationality ?? ""} ${g.bookings.map((b) => b.guest_name).join(" ")}`.toLowerCase();
      if (hay.includes(q)) return true;
      return qd.length >= 3 && (g.phone ?? "").replace(/\D/g, "").includes(qd);
    });
  }, [guests, query, tagFilter]);

  const open = guests.find((g) => g.key === openKey) ?? null;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {!guests.length ? (
        <EmptyState
          icon={<Icon name="guests" size={32} />}
          title={t("empty.title")}
          body={t("empty.body")}
          action={<ButtonLink href="/bookings?new=1" variant="honey">{t("empty.action")}</ButtonLink>}
        />
      ) : (
        <>
          <Card className="mb-4 grid grid-cols-2 gap-2 min-[960px]:grid-cols-4">
            <Stat label={t("stats.guests")} value={stats.total} />
            <Stat label={t("stats.repeat")} value={stats.repeat} />
            <Stat label={t("stats.foreign")} value={stats.foreign} />
            <Stat label={t("stats.blocked")} value={stats.blocked} tone={stats.blocked ? "bad" : undefined} />
          </Card>

          <div className="mb-4 flex flex-col gap-3 min-[960px]:flex-row min-[960px]:items-center min-[960px]:justify-between">
            <div role="group" aria-label={t("filterLabel")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 min-[960px]:mx-0 min-[960px]:px-0">
              {(["all", "repeat", "vip", "blocked"] as const).map((f) => (
                <button
                  key={f}
                  type="button"

                  aria-pressed={tagFilter === f}
                  onClick={() => setTagFilter(f)}
                  className={cn(
                    "inline-flex min-h-11 flex-none items-center rounded-full px-4 text-[14px] font-semibold transition",
                    tagFilter === f ? "bg-ink text-surface" : "bg-surface text-ink hover:bg-surface-2",
                  )}
                >
                  {t(`filters.${f}`)}
                </button>
              ))}
            </div>
            <label className="relative block min-[960px]:w-[320px]">
              <span className="sr-only">{t("searchLabel")}</span>
              <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPh")}
                className="w-full rounded-[13px] border-[1.5px] border-transparent bg-surface py-3 pl-10 pr-3.5 text-[16px] text-ink outline-none placeholder:text-muted/70 focus:border-accent"
              />
            </label>
          </div>

          {shown.length ? (
            <ul className="grid gap-3 min-[1200px]:grid-cols-2">
              {shown.map((g) => (
                <li key={g.key}>
                  <button
                    type="button"
                    onClick={() => setOpenKey(g.key)}
                    className="flex w-full flex-col gap-2.5 rounded-[24px] bg-surface p-4 text-left transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[16px] font-bold">{g.name}</span>
                          {g.profile && g.profile.tag !== "none" ? (
                            <Pill tone={TAG_TONE[g.profile.tag]}>{t(`tags.${g.profile.tag}`)}</Pill>
                          ) : g.stays > 1 ? (
                            <Pill tone="info">{t("returning")}</Pill>
                          ) : null}
                          {g.profile?.rating ? <Stars value={g.profile.rating} label={t("ratingLabel", { n: g.profile.rating })} /> : null}
                        </div>
                        <span className="truncate text-[13px] text-muted">
                          {[g.phone, g.email].filter(Boolean).join(" · ") || t("noContact")}
                        </span>
                      </div>
                      <div className="flex flex-none flex-col items-end">
                        <span className="tabular text-[16px] font-bold">{inr(g.spend)}</span>
                        <span className="text-[12px] text-muted">{t("netSpend")}</span>
                      </div>
                    </div>
                    <p className="tabular text-[13px] text-muted">
                      {t("staysLine", { stays: g.stays, nights: g.nights })}
                      {g.last ? ` · ${t("lastStay", { date: fmtDate(g.last) })}` : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {g.channels.map((c) => <ChannelPill key={c} channel={c} />)}
                      {g.missing ? <Pill tone="bad">{t("missing", { count: g.missing })}</Pill> : null}
                      {g.foreign ? <Pill tone="info">{t("foreign")}</Pill> : null}
                      {g.profile?.nationality ? <Pill>{g.profile.nationality}</Pill> : null}
                      {g.profile?.city ? <Pill>{g.profile.city}</Pill> : null}
                    </div>
                    {g.profile?.notes ? <p className="line-clamp-2 text-[13.5px] text-ink">{g.profile.notes}</p> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={t("noMatchTitle")}
              body={t("noMatchBody")}
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setTagFilter("all");
                  }}
                >
                  {t("clear")}
                </Button>
              }
            />
          )}
        </>
      )}

      {open ? (
        <GuestSheet
          key={open.key}
          guest={open}
          apts={apts}
          onClose={() => setOpenKey(null)}
          onOpenBooking={(id) => {
            setOpenKey(null);
            setBookingId(id);
          }}
        />
      ) : null}

      <BookingSheet open={bookingId != null} onClose={() => setBookingId(null)} bookingId={bookingId} />
    </>
  );
}

function GuestSheet({
  guest,
  apts,
  onClose,
  onOpenBooking,
}: {
  guest: Guest;
  apts: Map<string, Apt>;
  onClose: () => void;
  onOpenBooking: (id: string) => void;
}) {
  const t = useTranslations("guests");
  const tb = useTranslations("bookings");
  const tc = useTranslations("common");
  const { run, pending, error } = useAction();
  const p = guest.profile;
  const [tag, setTag] = useState<GuestTag>(p?.tag ?? "none");
  const [rating, setRating] = useState<string>(p?.rating ? String(p.rating) : "0");
  const [nationality, setNationality] = useState(p?.nationality ?? "");
  const [city, setCity] = useState(p?.city ?? "");
  const [notes, setNotes] = useState(p?.notes ?? "");
  const wa = guest.phone ? waLink(guest.phone, t("waHello", { name: firstName(guest.name) })) : null;

  function save() {
    void run(
      () =>
        saveGuestProfile({
          key: guest.key,
          tag,
          rating: rating === "0" ? null : Number(rating),
          nationality,
          city,
          notes,
        }),
      { success: t("saved"), onDone: onClose },
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={guest.name}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={save} disabled={pending}>{pending ? tc("saving") : t("saveProfile")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t("stats.stays")} value={guest.stays} />
          <Stat label={t("stats.nights")} value={guest.nights} />
          <Stat label={t("netSpend")} value={inr(guest.spend)} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <span className="text-muted">{[guest.phone, guest.email].filter(Boolean).join(" · ") || t("noContact")}</span>
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm", "min-h-11")}>
              <Icon name="whatsapp" size={16} />
              {t("whatsapp")}
            </a>
          ) : null}
          {guest.missing ? <Pill tone="bad">{t("missing", { count: guest.missing })}</Pill> : null}
        </div>

        <section aria-labelledby="g-hist">
          <h3 id="g-hist" className="mb-2 font-display text-[14px] font-bold">{t("history")}</h3>
          <ul className="flex flex-col gap-2">
            {guest.bookings.map((b) => {
              const a = apts.get(b.apartment_id);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onOpenBooking(b.id)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-[14px] bg-surface-2 px-3 py-2 text-left hover:brightness-95"
                  >
                    {a ? <AptChip tag={a.tag_colour} code={a.code} /> : null}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="tabular text-[14px] font-semibold">
                        {fmtDay(b.check_in)} → {fmtDay(b.check_out)}
                      </span>
                      <span className="tabular text-[12.5px] text-muted">
                        {tb("list.nights", { count: nights(b.check_in, b.check_out) })} · {inr(b.total)}
                        {b.status === "cancelled" ? ` · ${tb("status.cancelled")}` : ""}
                      </span>
                    </span>
                    <ChannelPill channel={b.channel} />
                    <Icon name="chevron" size={18} className="text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="g-prof" className="flex flex-col gap-4">
          <h3 id="g-prof" className="font-display text-[14px] font-bold">{t("profile")}</h3>
          <PillChoice
            label={t("tag")}
            name="g-tag"
            value={tag}
            onChange={setTag}
            options={(["none", "repeat", "vip", "blocked"] as const).map((v) => ({
              value: v,
              label: t(`tags.${v}`),
              activeClass: v === "blocked" ? "bg-bad text-on-bad" : undefined,
            }))}
          />
          {tag === "blocked" ? <p className="-mt-2 text-[13px] font-medium text-bad">{t("blockedHint")}</p> : null}
          <PillChoice
            label={t("rating")}
            name="g-rating"
            value={rating}
            onChange={setRating}
            options={["0", "1", "2", "3", "4", "5"].map((v) => ({
              value: v,
              label: v === "0" ? t("noRating") : `${v} ★`,
            }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t("nationality")} value={nationality} onChange={(e) => setNationality(e.target.value)} maxLength={80} />
            <TextField label={t("city")} value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
          </div>
          <TextAreaField
            label={t("notes")}
            hint={t("notesHint")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={2000}
          />
        </section>

        <ErrorBox>{error}</ErrorBox>
      </div>
    </Sheet>
  );
}
