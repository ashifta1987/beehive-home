import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getApartments } from "@/lib/data";
import { addDaysISO, fmtDay, fmtLongDay, fmtStamp, fmtTime, todayIST, weekStart } from "@/lib/dates";
import { inr } from "@/lib/money";
import { CHANNEL_LABEL, firstName } from "@/lib/guest";
import { computeAlerts, loadAlertData, aptStatus, type AlertKey, type AlertValues } from "@/lib/alerts";
import { loadFinanceData, monthSummary, type MonthSummary } from "@/lib/finance";
import type { Alert, Apartment } from "@/lib/types";
import { cn } from "@/lib/ui";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, ErrorBox, Stat } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { AgendaRow, AlertRow, KeyTag, SectionTitle, WeekStrip } from "@/components/today/parts";
import { agendaFor, checkProgress, weekMarks, type AgendaBooking, type AgendaItem, type AgendaSchedule, type AgendaTask } from "@/components/today/logic";

export const dynamic = "force-dynamic";

const intlLocale = (l: string) => (l === "ml" ? "ml-IN" : l === "hi" ? "hi-IN" : "en-IN");

export default async function TodayPage() {
  await requireOwnerPage();
  const [t, locale, apartments] = await Promise.all([getTranslations("today"), getLocale(), getApartments()]);
  const loc = intlLocale(locale);
  const today = todayIST();
  const monday = weekStart(today);
  const horizon = addDaysISO(today, 7);
  const ym = today.slice(0, 7);
  const supabase = await createClient();

  const [bookingsRes, tasksRes, schedulesRes, digestRes, alertsResult, financeResult] = await Promise.all([
    supabase
      .from("beehive_bookings")
      .select("id, apartment_id, guest_name, check_in, check_out, check_in_time, check_out_time, status, channel, adults, children")
      .neq("status", "cancelled")
      .gte("check_out", monday)
      // look further ahead so a quiet flat's key tag can still show its next booking
      .lte("check_in", addDaysISO(today, 120))
      .limit(500)
      .order("check_in"),
    supabase
      .from("beehive_tasks")
      .select("id, kind, apartment_id, booking_id, auto, date, time, status, note, checks")
      .or(`and(date.gte.${monday},date.lte.${horizon}),and(kind.eq.turnover,status.neq.done,date.lt.${monday})`)
      .order("date")
      .limit(500),
    supabase.from("beehive_schedules").select("id, name, apartment_id, last_done, every_days, who"),
    supabase.from("beehive_digests").select("day, alerts, created_at, updated_at").order("day", { ascending: false }).limit(1).maybeSingle(),
    loadAlertData(supabase, today).then(
      (d) => ({ ok: true as const, data: d }),
      () => ({ ok: false as const }),
    ),
    loadFinanceData(supabase, ym, ym).then(
      (d) => ({ ok: true as const, summary: monthSummary(ym, d) }),
      () => ({ ok: false as const }),
    ),
  ]);

  if (bookingsRes.error || tasksRes.error || schedulesRes.error) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <Header today={today} loc={loc} title={t("title")} bellLabel={t("notifications")} red={0} />
        <ErrorBox>{t("loadError")}</ErrorBox>
      </div>
    );
  }

  const bookings = (bookingsRes.data ?? []) as AgendaBooking[];
  const tasks = (tasksRes.data ?? []) as AgendaTask[];
  const schedules = (schedulesRes.data ?? []) as AgendaSchedule[];
  const aptById = new Map(apartments.map((a) => [a.id, a]));
  const allAptIds = apartments.map((a) => a.id);
  const defaults = Object.fromEntries(apartments.map((a) => [a.id, { in: a.check_in_time, out: a.check_out_time }]));

  const translate = (k: AlertKey, v?: AlertValues) => t(`alerts.${k}`, v);
  const alerts: Alert[] | null = alertsResult.ok ? computeAlerts(alertsResult.data, today, translate) : null;
  const redCount = alerts?.filter((a) => a.level === "bad").length ?? 0;

  // Week strip
  const dowFmt = new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: "UTC" });
  const days = weekMarks(monday, bookings).map((d) => {
    const marks = d.aptIds
      .map((id) => aptById.get(id))
      .filter((a): a is Apartment => !!a)
      .sort((a, b) => a.sort - b.sort)
      .map((a) => ({ tag: a.tag_colour, code: a.code }));
    const dayLabel = fmtDay(d.date, loc);
    return {
      date: d.date,
      dow: dowFmt.format(new Date(`${d.date}T00:00:00Z`)),
      num: Number(d.date.slice(8)),
      isToday: d.date === today,
      marks,
      aria: marks.length ? t("dayAriaMarks", { day: dayLabel, apts: marks.map((m) => m.code).join(", ") }) : dayLabel,
    };
  });

  // Key tags
  const tagsData = apartments.map((a, i) => {
    const s = aptStatus(a.id, bookings, tasks, today);
    const total = a.cleaning_checklist.length;
    const clean = (taskId: string | undefined) => {
      const k = taskId ? tasks.find((x) => x.id === taskId) : undefined;
      if (!k) return t("tag.cleaningNotStarted");
      if (k.status === "done") return t("tag.cleaned");
      if (total) {
        const p = checkProgress(k.checks, total);
        return t("tag.cleaning", { done: p.done, total: p.total });
      }
      return k.status === "in_progress" ? t("tag.cleaningStarted") : t("tag.cleaningNotStarted");
    };
    const turnFor = (bookingId: string) => tasks.find((k) => k.kind === "turnover" && k.booking_id === bookingId)?.id;
    let line1 = "";
    let line2 = "";
    switch (s.state) {
      case "turnover":
        line1 = t("tag.outIn", {
          out: fmtTime(s.leaving!.check_out_time ?? a.check_out_time),
          in: fmtTime(s.arriving!.check_in_time ?? a.check_in_time),
        });
        line2 = clean(turnFor(s.leaving!.id));
        break;
      case "arriving":
        line1 = s.arriving!.guest_name;
        line2 = t("tag.arrives", { time: fmtTime(s.arriving!.check_in_time ?? a.check_in_time), guests: s.arriving!.adults + s.arriving!.children });
        break;
      case "checking_out":
        line1 = s.leaving!.guest_name;
        line2 = t("tag.leaves", { time: fmtTime(s.leaving!.check_out_time ?? a.check_out_time) });
        break;
      case "occupied":
        line1 = s.inHouse!.guest_name;
        line2 = t("tag.till", { date: fmtDay(s.inHouse!.check_out, loc), channel: CHANNEL_LABEL[s.inHouse!.channel] ?? s.inHouse!.channel });
        break;
      case "needs_cleaning":
        line1 = t("tag.since", { date: fmtDay(s.cleaning!.date, loc) });
        line2 = clean(s.cleaning!.id);
        break;
      default:
        if (s.next) {
          line1 = t("tag.next", { guest: firstName(s.next.guest_name) });
          line2 = fmtDay(s.next.check_in, loc);
        } else {
          line1 = t("tag.free");
          line2 = t("tag.noNext");
        }
    }
    const cleaningState = s.state === "turnover" || s.state === "needs_cleaning" || s.state === "checking_out";
    return {
      a,
      state: t(`state.${s.state}`),
      line1,
      line2,
      href: cleaningState ? `/jobs?apt=${encodeURIComponent(a.id)}` : `/calendar?month=${ym}`,
      tilt: (i % 2 === 0 ? "left" : "right") as "left" | "right",
    };
  });

  // Agenda
  const agendaInput = { bookings, tasks, schedules, allAptIds, defaults };
  const todayItems = agendaFor(today, agendaInput);
  const nextDays = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i + 1))
    .map((d) => ({ date: d, items: agendaFor(d, agendaInput) }))
    .filter((d) => d.items.length);

  const marksFor = (ids: string[]) =>
    ids
      .map((id) => aptById.get(id))
      .filter((a): a is Apartment => !!a)
      .map((a) => ({ tag: a.tag_colour, code: a.code }));
  const aptName = (ids: string[]) =>
    ids.length > 1 && ids.length === apartments.length ? t("agenda.both") : ids.map((id) => aptById.get(id)?.code ?? id).join(", ");

  const renderItem = (item: AgendaItem) => {
    const apt = aptName(item.aptIds);
    const time = item.time ? fmtTime(item.time) : item.type === "care" ? t("due") : t("anyTime");
    switch (item.type) {
      case "checkout":
        return (
          <AgendaRow key={item.key} href={`/bookings?open=${item.booking.id}`} time={time} marks={marksFor(item.aptIds)}
            title={t("agenda.checkout", { guest: item.booking.guest_name })}
            subtitle={item.cleaned ? t("agenda.cleaned", { apt }) : t("agenda.toClean", { apt })} />
        );
      case "arrival":
        return (
          <AgendaRow key={item.key} href={`/bookings?open=${item.booking.id}`} time={time} marks={marksFor(item.aptIds)}
            title={t("agenda.arrival", { guest: item.booking.guest_name })}
            subtitle={t("agenda.arrivalSub", { apt, channel: CHANNEL_LABEL[item.booking.channel] ?? item.booking.channel, guests: item.booking.adults + item.booking.children })} />
        );
      case "task":
        return (
          <AgendaRow key={item.key} href="/jobs" time={time} marks={marksFor(item.aptIds)}
            title={t(`kind.${item.task.kind}`)}
            subtitle={item.task.note ? t("agenda.taskSubNote", { apt, note: item.task.note }) : apt} />
        );
      case "care":
        return (
          <AgendaRow key={item.key} href="/care" time={time} marks={marksFor(item.aptIds)}
            title={item.schedule.name}
            subtitle={t("agenda.careSub", { apt, who: t(`who.${item.schedule.who}`) })} />
        );
    }
  };

  // Digest
  const digest = digestRes.data as { day: string; alerts: Alert[]; created_at: string; updated_at: string | null } | null;
  const digestAlerts = Array.isArray(digest?.alerts) ? digest!.alerts : [];

  const summary: MonthSummary | null = financeResult.ok ? financeResult.summary : null;

  return (
    <div className="flex flex-col gap-5 pb-4">
      <Header today={today} loc={loc} title={t("title")} bellLabel={`${t("notifications")}: ${t("notificationsCount", { count: alerts?.length ?? 0 })}`} red={redCount} />

      <WeekStrip label={t("weekLabel")} days={days} />

      <div className="grid gap-5 min-[960px]:grid-cols-2 min-[960px]:items-start">
        <section aria-label={t("keyTags")}>
          {apartments.length ? (
            <div className="grid grid-cols-2 gap-3.5 px-0.5 pt-1">
              {tagsData.map((x) => (
                <KeyTag key={x.a.id} href={x.href} tag={x.a.tag_colour} code={x.a.code} name={x.a.name} state={x.state} line1={x.line1} line2={x.line2} tilt={x.tilt} />
              ))}
            </div>
          ) : (
            <EmptyState title={t("noApartments")} body={t("noApartmentsBody")} action={<ButtonLink href="/apartments" variant="primary">{t("openApartments")}</ButtonLink>} />
          )}
        </section>

        <section aria-labelledby="alerts" className="flex flex-col gap-2 scroll-mt-4">
          <SectionTitle id="alerts" action={alerts?.length ? <Pill tone={redCount ? "bad" : "warn"}>{alerts.length}</Pill> : undefined}>
            {t("alertsTitle")}
          </SectionTitle>
          {alerts == null ? (
            <ErrorBox>{t("alertsError")}</ErrorBox>
          ) : alerts.length ? (
            <ul className="flex flex-col gap-2">
              {alerts.map((a, i) => (
                <li key={`${a.label}-${i}`}>
                  <AlertRow alert={a} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex min-h-11 items-center gap-2.5 rounded-[16px] bg-surface px-3.5 py-3">
              <Pill tone="ok"><Icon name="check" size={14} />{t("allClear")}</Pill>
              <span className="text-[14px] text-muted">{t("allClearBody")}</span>
            </div>
          )}
          {digest ? (
            <details className="rounded-[16px] bg-surface px-3.5 py-3 text-[13.5px]">
              <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2">
                <Icon name="bell" size={16} className="text-muted" />
                <span className="font-semibold">{t("digest.title")}</span>
                <span className="text-muted">
                  {t("digest.summary", {
                    count: digestAlerts.length,
                    time: fmtStamp(digest.updated_at ?? digest.created_at),
                    red: digestAlerts.filter((a) => a.level === "bad").length,
                  })}
                </span>
              </summary>
              {digest.day < addDaysISO(today, -1) ? <p className="mt-2 text-warn">{t("digest.stale", { date: fmtDay(digest.day, loc) })}</p> : null}
              {digestAlerts.length ? (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {digestAlerts.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className={cn("flex-none rounded-[6px] px-1.5 py-0.5 text-[10.5px] font-bold", a.level === "bad" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn")}>{a.label}</span>
                      <span>{a.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-muted">{t("digest.none")}</p>
              )}
            </details>
          ) : null}
        </section>
      </div>

      <div className="grid gap-5 min-[960px]:grid-cols-2 min-[960px]:items-start">
        <section aria-labelledby="today-agenda" className="flex flex-col gap-2">
          <SectionTitle id="today-agenda">{t("todayTitle")}</SectionTitle>
          {todayItems.length ? <div className="flex flex-col gap-2">{todayItems.map(renderItem)}</div> : <p className="px-1 text-[14px] text-muted">{t("nothingToday")}</p>}
        </section>

        <section aria-labelledby="next7" className="flex flex-col gap-2">
          <SectionTitle id="next7">{t("next7")}</SectionTitle>
          {nextDays.length ? (
            <div className="flex flex-col gap-3">
              {nextDays.map((d) => (
                <div key={d.date} className="flex flex-col gap-2">
                  <h3 className="px-1 text-[12.5px] font-semibold text-muted">{fmtDay(d.date, loc)}</h3>
                  {d.items.map(renderItem)}
                </div>
              ))}
            </div>
          ) : (
            <p className="px-1 text-[14px] text-muted">{t("nothingNext7")}</p>
          )}
        </section>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-[14px] font-bold">{new Date(`${ym}-01T00:00:00Z`).toLocaleDateString(loc, { month: "long", year: "numeric", timeZone: "UTC" })}</h2>
          <Link href="/finance" className="inline-flex min-h-11 items-center gap-1 text-[13.5px] font-semibold text-accent">
            {t("month.openFinance")} <Icon name="chevron" size={16} />
          </Link>
        </div>
        {summary ? (
          <div className="grid grid-cols-2 gap-2 min-[600px]:grid-cols-4">
            <div className="flex flex-col">
              <Stat label={t("month.occupancy")} value={`${Math.round(summary.occupancy * 100)}%`} />
              <span className="px-1 pt-1 text-[11.5px] text-muted">{t("month.nights", { count: summary.nights })}</span>
            </div>
            <div className="flex flex-col">
              <Stat label={t("month.income")} value={inr(summary.income)} />
              <span className="px-1 pt-1 text-[11.5px] text-muted">{t("month.incomeSub")}</span>
            </div>
            <div className="flex flex-col">
              <Stat label={t("month.expenses")} value={inr(summary.expenses)} />
              <span className="px-1 pt-1 text-[11.5px] text-muted">{t("month.expensesSub")}</span>
            </div>
            <Stat label={t("month.profit")} value={inr(summary.profit)} tone={summary.profit < 0 ? "bad" : "ok"} />
          </div>
        ) : (
          <ErrorBox>{t("month.error")}</ErrorBox>
        )}
      </Card>
    </div>
  );
}

function Header({ today, loc, title, bellLabel, red }: { today: string; loc: string; title: string; bellLabel: string; red: number }) {
  return (
    <header className="flex items-center justify-between gap-3 pt-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-[13px] text-muted">{fmtLongDay(today, loc)}</span>
        <h1 className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em] min-[960px]:text-[26px]">{title}</h1>
      </div>
      <a href="#alerts" aria-label={bellLabel} title={bellLabel} className="relative inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface text-ink hover:bg-surface-2">
        <Icon name="bell" size={22} />
        {red ? <span className="absolute right-[11px] top-[10px] h-2 w-2 rounded-full bg-bad" aria-hidden /> : null}
      </a>
    </header>
  );
}
