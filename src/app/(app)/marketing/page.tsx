import { getLocale, getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApartments } from "@/lib/data";
import { addDaysISO, fmtDate, fmtDay, todayIST } from "@/lib/dates";
import { inr } from "@/lib/money";
import { CHANNEL_LABEL, firstName, waLink } from "@/lib/guest";
import type { Booking, Campaign, Channel, Listing } from "@/lib/types";
import { cn } from "@/lib/ui";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, ErrorBox, PageHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AptChip, ChannelPill, Pill } from "@/components/ui/pill";
import { CampaignButton, ListingButton, MarkAskedButton } from "./_components/marketing-forms";

export const dynamic = "force-dynamic";

const CHANNELS: Channel[] = ["airbnb", "booking", "direct", "other"];
const BAR: Record<Channel, string> = { airbnb: "bg-airbnb", booking: "bg-booking", direct: "bg-direct", other: "bg-other" };
const intlLocale = (l: string) => (l === "ml" ? "ml-IN" : l === "hi" ? "hi-IN" : "en-IN");

function campaignState(c: Pick<Campaign, "start" | "end">, today: string): "running" | "planned" | "ended" {
  if (c.start && c.start > today) return "planned";
  if (c.end && c.end < today) return "ended";
  return "running";
}

export default async function MarketingPage() {
  await requireOwnerPage();
  const [t, locale, apartments] = await Promise.all([getTranslations("marketing"), getLocale(), getApartments()]);
  const loc = intlLocale(locale);
  const today = todayIST();
  const supabase = await createClient();

  const [mixRes, revRes, listRes, campRes] = await Promise.all([
    supabase
      .from("beehive_bookings")
      .select("channel, total, commission")
      .neq("status", "cancelled")
      .gte("check_in", addDaysISO(today, -90))
      .lte("check_in", today),
    supabase
      .from("beehive_bookings")
      .select("id, guest_name, phone, channel, apartment_id, check_out")
      .neq("status", "cancelled")
      .eq("review_asked", false)
      .not("phone", "is", null)
      .neq("phone", "")
      .gte("check_out", addDaysISO(today, -21))
      .lte("check_out", today)
      .order("check_out", { ascending: false }),
    supabase.from("beehive_listings").select("*").order("channel"),
    supabase.from("beehive_campaigns").select("*").order("start", { ascending: false, nullsFirst: false }),
  ]);

  const apts = new Map(apartments.map((a) => [a.id, a]));
  const aptOptions = apartments.map((a) => ({ id: a.id, name: a.name }));
  const header = (
    <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<CampaignButton label={t("campaign.add")} primary />} />
  );

  if (mixRes.error || revRes.error || listRes.error || campRes.error) {
    return (
      <>
        {header}
        <ErrorBox>{t("loadError")}</ErrorBox>
      </>
    );
  }

  // Channel mix
  const mixRows = (mixRes.data ?? []) as Pick<Booking, "channel" | "total" | "commission">[];
  const totalCount = mixRows.length;
  const mix = CHANNELS.map((c) => {
    const rows = mixRows.filter((b) => (CHANNELS.includes(b.channel) ? b.channel : "other") === c);
    return { c, n: rows.length, net: rows.reduce((s, b) => s + (b.total ?? 0) - (b.commission ?? 0), 0) };
  });
  const maxN = Math.max(1, ...mix.map((m) => m.n));

  // Review requests
  const reviews = (revRes.data ?? []) as Pick<Booking, "id" | "guest_name" | "phone" | "channel" | "apartment_id" | "check_out">[];
  const platform = (c: Channel) => (c === "airbnb" || c === "booking" ? CHANNEL_LABEL[c] : "Google");

  const listings = (listRes.data ?? []) as Listing[];
  const campaigns = (campRes.data ?? []) as Campaign[];

  return (
    <div className="flex flex-col gap-5 pb-4">
      {header}

      <div className="grid gap-4 min-[960px]:grid-cols-2 min-[960px]:items-start">
        <Card>
          <h2 className="mb-3 font-display text-[14px] font-bold">{t("mix.title")}</h2>
          {totalCount ? (
            <ul className="flex flex-col gap-3">
              {mix.map((m) => (
                <li key={m.c} className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
                  <ChannelPill channel={m.c} className="justify-self-start" />
                  <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                    <span className={cn("block h-full rounded-full", BAR[m.c])} style={{ width: `${(m.n / maxN) * 100}%` }} />
                  </span>
                  <span className="tabular col-start-2 text-[13px] text-muted">
                    {t("mix.row", { count: m.n, share: Math.round((m.n / totalCount) * 100), net: inr(m.net) })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">{t("mix.empty")}</p>
          )}
          <p className="mt-3 text-[13px] text-muted">{t("mix.note")}</p>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-display text-[14px] font-bold">
            {t("reviews.title")} {reviews.length ? <Pill tone="info">{reviews.length}</Pill> : null}
          </h2>
          {reviews.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {reviews.map((b) => {
                const apt = apts.get(b.apartment_id);
                const msg = t("reviews.message", { guest: firstName(b.guest_name), apartment: apt?.name ?? "", platform: platform(b.channel) });
                const link = waLink(b.phone, msg);
                return (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="flex min-w-0 flex-col">
                      <span className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-semibold">
                        {b.guest_name} <ChannelPill channel={b.channel} />
                      </span>
                      <span className="text-[12.5px] text-muted">{t("reviews.left", { date: fmtDay(b.check_out, loc), apt: apt?.code ?? "" })}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      {link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                          <Icon name="whatsapp" size={16} />
                          {t("reviews.whatsapp")}
                        </a>
                      ) : (
                        <span className="py-2 text-[12.5px] text-warn">{t("reviews.badPhone")}</span>
                      )}
                      <MarkAskedButton bookingId={b.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">{t("reviews.empty")}</p>
          )}
        </Card>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 font-display text-[14px] font-bold">{t("listings.title")}</h2>
        {apartments.length ? (
          <div className="grid gap-4 min-[960px]:grid-cols-2 min-[960px]:items-start">
            {apartments.map((a) => {
              const ls = listings.filter((l) => l.apartment_id === a.id);
              return (
                <Card key={a.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                      <AptChip tag={a.tag_colour} code={a.code} /> {a.name}
                    </h3>
                    <ListingButton apartments={aptOptions} apartmentId={a.id} label={t("listing.add")} />
                  </div>
                  {ls.length ? (
                    <ul className="flex flex-col divide-y divide-line">
                      {ls.map((l) => (
                        <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <ChannelPill channel={l.channel} />
                              <Pill tone={l.status === "live" ? "ok" : l.status === "paused" ? "warn" : "neutral"}>{t(`listingStatus.${l.status}`)}</Pill>
                              {l.price != null ? <span className="tabular text-[13.5px] font-semibold">{t("listing.perNight", { price: inr(l.price) })}</span> : null}
                            </span>
                            {l.title ? <span className="text-[14px]">{l.title}</span> : null}
                            {l.rating != null || l.reviews != null ? (
                              <span className="tabular text-[12.5px] text-muted">
                                {[l.rating != null ? `★ ${Number(l.rating).toFixed(2)}` : null, l.reviews != null ? t("listing.reviewCount", { count: l.reviews }) : null].filter(Boolean).join(" · ")}
                              </span>
                            ) : null}
                            {l.note ? <span className="text-[12.5px] text-muted">{l.note}</span> : null}
                          </div>
                          <div className="flex gap-1.5">
                            {l.url && /^https?:\/\//i.test(l.url) ? (
                              <a href={l.url} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>
                                {t("listing.open")}
                              </a>
                            ) : null}
                            <ListingButton listing={l} apartments={aptOptions} label={t("listing.edit")} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[14px] text-muted">{t("listings.empty")}</p>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState title={t("listings.noApts")} body={t("listings.noAptsBody")} />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 font-display text-[14px] font-bold">{t("campaigns.title")}</h2>
        {campaigns.length ? (
          <ul className="flex flex-col gap-2">
            {campaigns.map((c) => {
              const st = campaignState(c, today);
              return (
                <Card as="li" key={c.id} className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[15px] font-semibold">{c.name}</span>
                      <Pill tone="neutral">{t(`campaignChannel.${c.channel}`)}</Pill>
                      <Pill tone={st === "running" ? "ok" : st === "planned" ? "info" : "neutral"}>{t(`campaignState.${st}`)}</Pill>
                    </span>
                    <span className="tabular text-[13px] text-muted">
                      {[
                        c.start || c.end ? `${c.start ? fmtDate(c.start, loc) : "…"} → ${c.end ? fmtDate(c.end, loc) : "…"}` : null,
                        c.spend ? t("campaign.spendShort", { amount: inr(c.spend) }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {c.offer ? <span className="text-[13.5px]">{c.offer}</span> : null}
                    {c.result ? (
                      <span className="text-[13.5px]">
                        <b>{t("campaign.resultLabel")}</b> {c.result}
                      </span>
                    ) : null}
                  </div>
                  <CampaignButton campaign={c} label={t("campaign.edit")} />
                </Card>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Icon name="megaphone" size={28} />} title={t("campaigns.emptyTitle")} body={t("campaigns.emptyBody")} action={<CampaignButton label={t("campaign.add")} primary />} />
        )}
      </section>
    </div>
  );
}
