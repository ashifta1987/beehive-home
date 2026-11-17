import { getLocale, getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApartments, aptMap } from "@/lib/data";
import { todayIST } from "@/lib/dates";
import { careStatus, compareCare } from "@/lib/care";
import type { Schedule, ScheduleLog } from "@/lib/types";
import { Card, EmptyState, ErrorBox, PageHeader, Stat } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AptChip } from "@/components/ui/pill";
import { AptFilter } from "@/components/jobs/apt-filter";
import { intlLocale } from "@/components/jobs/constants";
import { CareRow, ScheduleFormButton, type LogRow } from "./care-client";

export default async function CarePage({ searchParams }: { searchParams: Promise<{ apt?: string }> }) {
  const session = await requireStaffPage();
  const isOwner = session.staff.role === "owner";
  const [t, tc, locale, sp, apartments] = await Promise.all([
    getTranslations("care"),
    getTranslations("common"),
    getLocale(),
    searchParams,
    getApartments(),
  ]);
  const loc = intlLocale(locale);
  const today = todayIST();
  const apts = aptMap(apartments);
  const aptFilter = sp.apt && apts[sp.apt] ? sp.apt : null;

  const supabase = await createClient();
  const [schedRes, logRes, staffRes] = await Promise.all([
    supabase.from("beehive_schedules").select("*").order("name"),
    supabase.from("beehive_schedule_log").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(500),
    supabase.from("beehive_staff").select("user_id, name, email"),
  ]);

  const names = new Map(
    ((staffRes.data ?? []) as Array<{ user_id: string; name: string | null; email: string | null }>).map((s) => [
      s.user_id,
      s.user_id === session.userId ? t("you") : (s.name ?? s.email ?? null),
    ]),
  );
  const logsBySchedule = new Map<string, LogRow[]>();
  for (const l of (logRes.data ?? []) as ScheduleLog[]) {
    const arr = logsBySchedule.get(l.schedule_id) ?? [];
    arr.push({ ...l, by: l.done_by ? (names.get(l.done_by) ?? null) : null });
    logsBySchedule.set(l.schedule_id, arr);
  }

  const all = ((schedRes.data ?? []) as Schedule[])
    .filter((s) => !aptFilter || s.apartment_id === aptFilter || s.apartment_id === null)
    .map((s) => ({ schedule: s, name: s.name, status: careStatus(s, today) }));

  const overdue = all.filter((r) => r.status.state === "overdue").length;
  const dueWeek = all.filter((r) => r.status.state === "today" || r.status.state === "soon").length;
  const never = all.filter((r) => r.status.state === "never").length;

  const groups: Array<{ key: string; apt: (typeof apartments)[number] | null; rows: typeof all }> = [
    ...apartments
      .filter((a) => !aptFilter || a.id === aptFilter)
      .map((a) => ({ key: a.id, apt: a, rows: all.filter((r) => r.schedule.apartment_id === a.id).sort(compareCare) })),
    { key: "both", apt: null, rows: all.filter((r) => r.schedule.apartment_id === null).sort(compareCare) },
  ].filter((g) => g.rows.length);

  const aptOptions = apartments.map((a) => ({ id: a.id, code: a.code, name: a.name }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={<ScheduleFormButton apartments={aptOptions} defaultApt={aptFilter} today={today} />}
      />

      {apartments.length > 1 ? (
        <AptFilter basePath="/care" apartments={apartments} current={aptFilter} allLabel={t("allApartments")} label={t("filterLabel")} />
      ) : null}

      {schedRes.error ? <ErrorBox>{t("loadError")}</ErrorBox> : null}

      {all.length ? (
        <Card className="grid grid-cols-3 gap-2">
          <Stat label={t("stat.overdue")} value={overdue} tone={overdue ? "bad" : undefined} />
          <Stat label={t("stat.dueWeek")} value={dueWeek} tone={dueWeek ? "warn" : undefined} />
          <Stat label={t("stat.never")} value={never} tone={never ? "warn" : undefined} />
        </Card>
      ) : null}

      {!schedRes.error && all.length === 0 ? (
        <EmptyState
          icon={<Icon name="care" size={32} />}
          title={t("empty.title")}
          body={t("empty.body")}
          action={<ScheduleFormButton apartments={aptOptions} defaultApt={aptFilter} today={today} />}
        />
      ) : null}

      <div className="grid gap-4 min-[960px]:grid-cols-2 min-[960px]:items-start">
        {groups.map((g) => (
          <Card key={g.key}>
            <div className="mb-3 flex items-center gap-2">
              {g.apt ? <AptChip tag={g.apt.tag_colour} code={g.apt.code} /> : null}
              <h2 className="font-display text-[14px] font-bold">{g.apt ? g.apt.name : tc("both")}</h2>
              <span className="tabular text-[12.5px] text-muted">{g.rows.length}</span>
            </div>
            <ul className="flex flex-col gap-2">
              {g.rows.map((r) => (
                <CareRow
                  key={r.schedule.id}
                  schedule={r.schedule}
                  status={r.status}
                  logs={logsBySchedule.get(r.schedule.id) ?? []}
                  apartments={aptOptions}
                  isOwner={isOwner}
                  today={today}
                  locale={loc}
                />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
