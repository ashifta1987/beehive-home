import { getLocale, getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApartments } from "@/lib/data";
import { fmtDay, todayIST } from "@/lib/dates";
import { formCGroup } from "@/lib/alerts";
import type { Booking, ForeignRecord } from "@/lib/types";
import { Card, EmptyState, ErrorBox, PageHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AptChip, ChannelPill, Pill } from "@/components/ui/pill";
import { buttonClass } from "@/components/ui/button";
import { FRRO_URL, ForeignRecordButton, type ForeignBookingView } from "./_components/foreign-sheet";

export const dynamic = "force-dynamic";

type Row = Pick<Booking, "id" | "apartment_id" | "guest_name" | "check_in" | "check_out" | "adults" | "children" | "channel" | "status"> & {
  beehive_foreign_records: ForeignRecord | ForeignRecord[] | null;
};

const intlLocale = (l: string) => (l === "ml" ? "ml-IN" : l === "hi" ? "hi-IN" : "en-IN");

export default async function ForeignPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  await requireOwnerPage();
  const [t, locale, sp, apartments] = await Promise.all([getTranslations("foreign"), getLocale(), searchParams, getApartments()]);
  const loc = intlLocale(locale);
  const today = todayIST();
  const apts = new Map(apartments.map((a) => [a.id, a]));
  const supabase = await createClient();
  const res = await supabase
    .from("beehive_bookings")
    .select("id, apartment_id, guest_name, check_in, check_out, adults, children, channel, status, beehive_foreign_records(*)")
    .eq("foreign_national", true)
    .neq("status", "cancelled")
    .order("check_in")
    .limit(1000);

  const header = (
    <PageHeader
      title={t("title")}
      subtitle={t("subtitle")}
      actions={
        <a href={FRRO_URL} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "md")}>
          {t("portal")} <Icon name="chevron" size={16} />
        </a>
      }
    />
  );

  if (res.error) {
    return (
      <>
        {header}
        <ErrorBox>{t("loadError")}</ErrorBox>
      </>
    );
  }

  const rows = ((res.data ?? []) as unknown as Row[]).map((r) => {
    const rec = Array.isArray(r.beehive_foreign_records) ? (r.beehive_foreign_records[0] ?? null) : r.beehive_foreign_records;
    return { b: r, rec, group: formCGroup(r, !!rec?.form_c_submitted, today) };
  });
  const due = rows.filter((r) => r.group === "due");
  const soon = rows.filter((r) => r.group === "soon");
  const done = rows.filter((r) => r.group === "submitted").sort((a, b) => (a.b.check_in < b.b.check_in ? 1 : -1)).slice(0, 30);

  const card = ({ b, rec, group }: (typeof rows)[number]) => {
    const apt = apts.get(b.apartment_id);
    const view: ForeignBookingView = {
      id: b.id,
      guest: b.guest_name,
      apt: apt?.name ?? b.apartment_id,
      stay: `${fmtDay(b.check_in, loc)} → ${fmtDay(b.check_out, loc)} · ${t("guests", { count: b.adults + b.children })}`,
      checkOut: b.check_out,
      record: rec,
    };
    const visaShort = !!rec?.visa_expiry && rec.visa_expiry < b.check_out;
    const passportShort = !!rec?.passport_expiry && rec.passport_expiry < b.check_out;
    return (
      <Card as="li" key={b.id} className="flex flex-col gap-3 min-[600px]:flex-row min-[600px]:items-start min-[600px]:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {apt ? <AptChip tag={apt.tag_colour} code={apt.code} /> : null}
            <span className="text-[15px] font-semibold">{b.guest_name}</span>
            {rec?.nationality ? <Pill tone="info">{rec.nationality}</Pill> : null}
            <ChannelPill channel={b.channel} />
          </div>
          <p className="text-[13.5px] text-muted">
            {view.stay}
            {rec?.passport_no ? ` · ${t("passportShort", { no: rec.passport_no })}` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group === "submitted" ? (
              <Pill tone="ok">{rec?.form_c_ref ? t("flag.submittedRef", { ref: rec.form_c_ref }) : t("flag.submitted")}</Pill>
            ) : group === "due" ? (
              <Pill tone="bad">{b.check_in > today ? t("flag.dueTomorrow") : t("flag.dueNow")}</Pill>
            ) : (
              <Pill tone="warn">{t("flag.within24")}</Pill>
            )}
            <Pill tone={rec?.docs_collected ? "ok" : "warn"}>{rec?.docs_collected ? t("flag.docsOk") : t("flag.docsMissing")}</Pill>
            {visaShort ? <Pill tone="bad">{t("warn.visaShort")}</Pill> : null}
            {passportShort ? <Pill tone="bad">{t("warn.passportShort")}</Pill> : null}
          </div>
        </div>
        <div className="flex flex-none flex-wrap gap-2">
          <ForeignRecordButton booking={view} label={rec ? t("openRecord") : t("fillRecord")} primary={group !== "submitted"} autoOpen={sp.open === b.id} />
        </div>
      </Card>
    );
  };

  const section = (title: string, list: typeof rows, empty: string) => (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 font-display text-[14px] font-bold">
        {title} <span className="tabular text-muted">· {list.length}</span>
      </h2>
      {list.length ? <ul className="flex flex-col gap-2">{list.map(card)}</ul> : <p className="px-1 text-[14px] text-muted">{empty}</p>}
    </section>
  );

  return (
    <div className="flex flex-col gap-5 pb-4">
      {header}
      <Card>
        <h2 className="mb-2 font-display text-[14px] font-bold">{t("how.title")}</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-[14px]">
          <li>{t("how.step1")}</li>
          <li>{t("how.step2")}</li>
          <li>{t("how.step3")}</li>
          <li>{t("how.step4")}</li>
        </ol>
      </Card>
      {rows.length ? (
        <>
          {section(t("group.due"), due, t("empty.due"))}
          {section(t("group.soon"), soon, t("empty.soon"))}
          {section(t("group.submitted"), done, t("empty.submitted"))}
        </>
      ) : (
        <EmptyState icon={<Icon name="globe" size={28} />} title={t("empty.title")} body={t("empty.body")} />
      )}
    </div>
  );
}
