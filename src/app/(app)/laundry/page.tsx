import { getLocale, getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApartments, aptMap } from "@/lib/data";
import { daysBetween, fmtDay, fmtMonth, monthKey, todayIST } from "@/lib/dates";
import { inr } from "@/lib/money";
import type { Laundry } from "@/lib/types";
import { Card, EmptyState, ErrorBox, PageHeader, Stat } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AptChip, Pill } from "@/components/ui/pill";
import { FilterChips } from "@/components/jobs/apt-filter";
import { intlLocale, LAUNDRY_LATE_DAYS } from "@/components/jobs/constants";
import { DeleteLaundryButton, LaundryFormButton, ReturnButton } from "./laundry-client";

type Show = "out" | "returned" | "all";

export default async function LaundryPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const session = await requireStaffPage();
  const isOwner = session.staff.role === "owner";
  const [t, tc, locale, sp, apartments] = await Promise.all([
    getTranslations("laundry"),
    getTranslations("common"),
    getLocale(),
    searchParams,
    getApartments(),
  ]);
  const loc = intlLocale(locale);
  const today = todayIST();
  const apts = aptMap(apartments);
  const show: Show = sp.show === "returned" || sp.show === "all" ? sp.show : "out";

  const supabase = await createClient();
  const res = await supabase.from("beehive_laundry").select("*").order("sent_date", { ascending: false }).limit(300);
  const all = (res.data ?? []) as Laundry[];

  const out = all.filter((l) => !l.returned_date);
  const returned = all.filter((l) => l.returned_date);
  const pieces = out.reduce((s, l) => s + (l.items_sent || 0), 0);
  const isShort = (l: Laundry) => !!l.returned_date && (l.items_returned ?? 0) < l.items_sent;
  const shortCount = all.filter(isShort).length;
  const late = out.filter((l) => daysBetween(l.sent_date, today) > LAUNDRY_LATE_DAYS).length;
  const month = monthKey(today);
  const bills = all
    .filter((l) => monthKey(l.returned_date ?? l.sent_date) === month)
    .reduce((s, l) => s + (l.cost ?? 0), 0);

  const rows = show === "out" ? out : show === "returned" ? returned : all;
  const aptOptions = apartments.map((a) => ({ id: a.id, code: a.code, name: a.name }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<LaundryFormButton apartments={aptOptions} today={today} />} />

      {res.error ? <ErrorBox>{t("loadError")}</ErrorBox> : null}

      {all.length ? (
        <Card className="grid grid-cols-3 gap-2">
          <Stat label={t("stat.out")} value={t("stat.outValue", { batches: out.length, pieces })} tone={late ? "warn" : undefined} />
          <Stat label={t("stat.short")} value={shortCount} tone={shortCount ? "bad" : undefined} />
          <Stat label={t("stat.bills", { month: fmtMonth(month, loc) })} value={inr(bills)} />
        </Card>
      ) : null}

      {all.length ? (
        <FilterChips
          basePath="/laundry"
          param="show"
          current={show}
          label={t("filterLabel")}
          options={[
            { value: "out", label: t("filter.out"), count: out.length },
            { value: "returned", label: t("filter.returned"), count: returned.length },
            { value: "all", label: t("filter.all"), count: all.length },
          ]}
        />
      ) : null}

      {!res.error && all.length === 0 ? (
        <EmptyState
          icon={<Icon name="laundry" size={32} />}
          title={t("empty.title")}
          body={t("empty.body")}
          action={<LaundryFormButton apartments={aptOptions} today={today} />}
        />
      ) : null}

      {all.length > 0 && rows.length === 0 ? (
        <p className="rounded-[24px] bg-surface px-4 py-6 text-center text-[14px] text-muted">
          {show === "out" ? t("noneOut") : t("noneReturned")}
        </p>
      ) : null}

      {rows.length ? (
        <ul className="grid gap-3 min-[960px]:grid-cols-2 min-[960px]:items-start">
          {rows.map((l) => {
            const apt = l.apartment_id ? apts[l.apartment_id] : null;
            const days = daysBetween(l.sent_date, l.returned_date ?? today);
            const short = isShort(l) ? l.items_sent - (l.items_returned ?? 0) : 0;
            return (
              <li key={l.id} className="flex flex-col gap-2 rounded-[24px] bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular font-display text-[16px] font-bold">{t("pieces", { count: l.items_sent })}</span>
                  {apt ? <AptChip tag={apt.tag_colour} code={apt.code} /> : <Pill>{tc("both")}</Pill>}
                  {l.returned_date ? (
                    short ? (
                      <Pill tone="bad">{t("short", { count: short })}</Pill>
                    ) : (
                      <Pill tone="ok">{t("returned")}</Pill>
                    )
                  ) : (
                    <Pill tone={days > LAUNDRY_LATE_DAYS ? "warn" : "neutral"}>
                      {days > LAUNDRY_LATE_DAYS ? t("outLate", { count: days }) : t("outDays", { count: days })}
                    </Pill>
                  )}
                </div>
                <p className="text-[13.5px] text-muted">
                  {l.vendor ? t("sentTo", { date: fmtDay(l.sent_date, loc), vendor: l.vendor }) : t("sent", { date: fmtDay(l.sent_date, loc) })}
                  {l.returned_date
                    ? ` · ${t("back", { date: fmtDay(l.returned_date, loc), count: l.items_returned ?? 0 })}`
                    : ""}
                  {l.cost ? <span className="tabular"> · {inr(l.cost)}</span> : null}
                </p>
                {l.details ? <p className="whitespace-pre-line text-[14px]">{l.details}</p> : null}
                {l.note ? <p className="whitespace-pre-line text-[13px] text-muted">{l.note}</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  {!l.returned_date ? <ReturnButton batch={l} today={today} /> : null}
                  <LaundryFormButton batch={l} apartments={aptOptions} today={today} />
                  {isOwner ? <DeleteLaundryButton id={l.id} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
