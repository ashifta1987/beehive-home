import { getLocale, getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApartments } from "@/lib/data";
import { fmtDate, todayIST } from "@/lib/dates";
import { licenceStatus, type LicenceState } from "@/lib/alerts";
import type { Licence } from "@/lib/types";
import { Card, EmptyState, ErrorBox, PageHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AptChip, Pill, type Tone } from "@/components/ui/pill";
import { LicenceButton } from "./_components/licence-form";

export const dynamic = "force-dynamic";

const RANK: Record<LicenceState, number> = { expired: 0, expiring: 1, none: 2, valid: 3 };
const TONE: Record<LicenceState, Tone> = { expired: "bad", expiring: "warn", none: "neutral", valid: "ok" };
const intlLocale = (l: string) => (l === "ml" ? "ml-IN" : l === "hi" ? "hi-IN" : "en-IN");

export default async function LicencesPage() {
  await requireOwnerPage();
  const [t, tc, locale, apartments] = await Promise.all([getTranslations("licences"), getTranslations("common"), getLocale(), getApartments()]);
  const loc = intlLocale(locale);
  const today = todayIST();
  const supabase = await createClient();
  const res = await supabase.from("beehive_licences").select("*").order("expires", { nullsFirst: false });
  const apts = new Map(apartments.map((a) => [a.id, a]));
  const aptOptions = apartments.map((a) => ({ id: a.id, name: a.name }));

  const header = (
    <PageHeader title={t("title")} subtitle={t("subtitle")} actions={<LicenceButton apartments={aptOptions} label={t("add")} primary />} />
  );
  if (res.error) {
    return (
      <>
        {header}
        <ErrorBox>{t("loadError")}</ErrorBox>
      </>
    );
  }

  const rows = ((res.data ?? []) as Licence[])
    .map((l) => ({ l, st: licenceStatus(l, today) }))
    .sort((a, b) => RANK[a.st.state] - RANK[b.st.state] || (a.l.expires ?? "9999").localeCompare(b.l.expires ?? "9999") || a.l.name.localeCompare(b.l.name));

  const statusText = (l: Licence, st: ReturnType<typeof licenceStatus>) => {
    const date = fmtDate(l.expires, loc);
    switch (st.state) {
      case "expired":
        return t("status.expired", { date });
      case "expiring":
        return t("status.expiring", { date, days: st.days ?? 0 });
      case "valid":
        return t("status.valid", { date });
      default:
        return t("status.none");
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      {header}
      {rows.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map(({ l, st }) => {
            const apt = l.apartment_id ? apts.get(l.apartment_id) : null;
            const meta = [
              l.number ? t("meta.number", { number: l.number }) : null,
              l.issued_by,
              l.issued ? t("meta.issued", { date: fmtDate(l.issued, loc) }) : null,
              t("meta.remind", { days: l.remind_days }),
            ].filter(Boolean);
            return (
              <Card as="li" key={l.id} className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    {apt ? <AptChip tag={apt.tag_colour} code={apt.code} /> : <Pill tone="neutral">{tc("both")}</Pill>}
                    <span className="text-[15px] font-semibold">{l.name}</span>
                  </span>
                  <Pill tone={TONE[st.state]} className="self-start">
                    {st.state === "expired" ? <Icon name="alert" size={14} /> : st.state === "valid" ? <Icon name="check" size={14} /> : null}
                    {statusText(l, st)}
                  </Pill>
                  <span className="text-[13px] text-muted">{meta.join(" · ")}</span>
                  {l.note ? <span className="text-[13.5px]">{l.note}</span> : null}
                </div>
                <LicenceButton licence={l} apartments={aptOptions} label={t("edit")} />
              </Card>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<Icon name="badge" size={28} />}
          title={t("empty.title")}
          body={t("empty.body")}
          action={<LicenceButton apartments={aptOptions} label={t("addFirst")} primary />}
        />
      )}
    </div>
  );
}
