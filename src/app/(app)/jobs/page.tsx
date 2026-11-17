import { getLocale, getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApartments, aptMap } from "@/lib/data";
import { addDaysISO, fmtLongDay, todayIST } from "@/lib/dates";
import type { Asset, Task } from "@/lib/types";
import { EmptyState, ErrorBox, PageHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AptFilter } from "@/components/jobs/apt-filter";
import { JobCard } from "@/components/jobs/job-card";
import { JobFormButton } from "@/components/jobs/job-form";
import { intlLocale } from "@/components/jobs/constants";
import { sectionJobs } from "@/components/jobs/logic";

type CountRow = Pick<Asset, "id" | "name" | "room" | "qty" | "value" | "apartment_id">;

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ apt?: string }> }) {
  const session = await requireStaffPage();
  const isOwner = session.staff.role === "owner";
  const [t, locale, sp, apartments] = await Promise.all([getTranslations("jobs"), getLocale(), searchParams, getApartments()]);
  const loc = intlLocale(locale);
  const today = todayIST();
  const apts = aptMap(apartments);
  const aptFilter = isOwner && sp.apt && apts[sp.apt] ? sp.apt : null;

  const supabase = await createClient();
  let q = supabase
    .from("beehive_tasks")
    .select("*")
    .or(`and(status.neq.done,date.lte.${addDaysISO(today, 7)}),and(status.eq.done,date.gte.${addDaysISO(today, -7)})`)
    .order("date")
    .order("time", { nullsFirst: false })
    .limit(400);
  if (aptFilter) q = q.eq("apartment_id", aptFilter);

  const [tasksRes, assetsRes, staffRes] = await Promise.all([
    q,
    supabase
      .from("beehive_assets")
      .select("id, name, room, qty, value, apartment_id")
      .eq("count_on_checkout", true)
      .order("room", { nullsFirst: false })
      .order("name"),
    // Only the owner can read other staff rows (RLS); housekeepers get their own.
    supabase.from("beehive_staff").select("user_id, name, email"),
  ]);

  const tasks = (tasksRes.data ?? []) as Task[];
  const countable = (assetsRes.data ?? []) as CountRow[];
  const staffNames = new Map(
    ((staffRes.data ?? []) as Array<{ user_id: string; name: string | null; email: string | null }>).map((s) => [
      s.user_id,
      s.user_id === session.userId ? t("you") : (s.name ?? s.email ?? ""),
    ]),
  );
  const s = sectionJobs(tasks, today);
  const left = s.overdue.length + s.today.length;
  const aptOptions = apartments.map((a) => ({ id: a.id, code: a.code, name: a.name }));

  const sections: Array<{ key: "overdue" | "today" | "upcoming" | "done"; list: Task[] }> = [
    { key: "overdue", list: s.overdue },
    { key: "today", list: s.today },
    { key: "upcoming", list: s.upcoming },
    { key: "done", list: s.done },
  ];

  const card = (task: Task) => (
    <JobCard
      key={task.id}
      task={task}
      apt={apts[task.apartment_id]}
      countable={countable.filter((a) => a.apartment_id === task.apartment_id)}
      isOwner={isOwner}
      today={today}
      locale={loc}
      doneByName={task.completed_by ? (staffNames.get(task.completed_by) || null) : null}
      apartments={aptOptions}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        subtitle={fmtLongDay(today, loc)}
        title={t("title", { who: isOwner ? "owner" : "hk", count: left })}
        actions={
          isOwner && apartments.length ? (
            <JobFormButton apartments={aptOptions} defaultApt={aptFilter ?? undefined} today={today} />
          ) : null
        }
      />

      {isOwner && apartments.length > 1 ? (
        <AptFilter basePath="/jobs" apartments={apartments} current={aptFilter} allLabel={t("allApartments")} label={t("filterLabel")} />
      ) : null}

      {tasksRes.error ? <ErrorBox>{t("loadError")}</ErrorBox> : null}

      {!tasksRes.error && tasks.length === 0 ? (
        <EmptyState
          icon={<Icon name="jobs" size={32} />}
          title={t("empty.title")}
          body={isOwner ? t("empty.bodyOwner") : t("empty.bodyHk")}
        />
      ) : null}

      {!tasksRes.error && tasks.length > 0
        ? sections.map((sec) =>
            sec.list.length ? (
              <section key={sec.key} aria-labelledby={`jobs-${sec.key}`} className="flex flex-col gap-3">
                <h2
                  id={`jobs-${sec.key}`}
                  className={`flex items-center gap-2 pt-2 font-display text-[15px] font-bold ${sec.key === "overdue" ? "text-bad" : ""}`}
                >
                  {t(`section.${sec.key}`)}
                  <span className="tabular rounded-full bg-surface px-2 py-0.5 text-[12px] text-muted">{sec.list.length}</span>
                </h2>
                <div className="grid gap-4 min-[960px]:grid-cols-2 min-[960px]:items-start">{sec.list.map(card)}</div>
              </section>
            ) : sec.key === "today" ? (
              <section key={sec.key} aria-labelledby="jobs-today" className="flex flex-col gap-2">
                <h2 id="jobs-today" className="pt-2 font-display text-[15px] font-bold">{t("section.today")}</h2>
                <p className="rounded-[24px] bg-surface px-4 py-4 text-[14px] text-muted">{t("nothingToday")}</p>
              </section>
            ) : null,
          )
        : null}
    </div>
  );
}
