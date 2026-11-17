import { getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { getApartments } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { financeSeries, loadFinanceData, monthFinance } from "@/lib/finance";
import { addMonths, fmtMonth } from "@/lib/dates";
import { inr } from "@/lib/money";
import { cn } from "@/lib/ui";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle, PageHeader, Stat } from "@/components/ui/card";
import { AptChip, ChannelPill } from "@/components/ui/pill";
import { MonthSwitcher } from "./_components/month-switcher";
import { MonthBars } from "./_components/month-bars";
import { dateLocale, pct, pickMonth, type SearchParams } from "./_components/shared";

const th = "py-2 pr-3 text-[12px] font-semibold text-muted last:pr-0";
const td = "py-2.5 pr-3 last:pr-0";

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  await requireOwnerPage();
  const [{ month, current }, t, tx, tp, locale, apartments, supabase] = await Promise.all([
    pickMonth(searchParams),
    getTranslations("finance"),
    getTranslations("expenses"),
    getTranslations("petty"),
    dateLocale(),
    getApartments(),
    createClient(),
  ]);

  const data = await loadFinanceData(supabase, addMonths(month, -11), month);
  const f = monthFinance(month, data);
  const series = financeSeries(month, 12, data);
  const aptById = Object.fromEntries(apartments.map((a) => [a.id, a]));
  const maxCat = f.byCategory[0]?.amount || 1;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <ButtonLink href="/expenses" variant="secondary">
              {t("goExpenses")}
            </ButtonLink>
            <ButtonLink href="/petty" variant="secondary">
              {t("goPetty")}
            </ButtonLink>
          </>
        }
      />
      <MonthSwitcher
        month={month}
        current={current}
        basePath="/finance"
        locale={locale}
        labels={{ prev: t("prevMonth"), next: t("nextMonth"), thisMonth: t("thisMonth") }}
      />

      <section aria-label={fmtMonth(month, locale)} className="mb-4 grid grid-cols-2 gap-2 min-[600px]:grid-cols-3 min-[960px]:grid-cols-5">
        <Stat label={t("stats.gross")} value={inr(f.gross)} />
        <Stat label={t("stats.commission")} value={inr(f.commission)} />
        <Stat label={t("stats.extras")} value={inr(f.extras)} />
        <Stat label={t("stats.net")} value={inr(f.income)} />
        <Stat label={f.pettyOut ? `${t("stats.expenses")} · ${t("stats.pettyPart", { amount: inr(f.pettyOut) })}` : t("stats.expenses")} value={inr(f.expenses)} />
        <Stat label={t("stats.profit")} value={inr(f.profit)} tone={f.profit < 0 ? "bad" : f.profit > 0 ? "ok" : undefined} />
        <Stat label={t("stats.occupancy")} value={pct(f.occupancy)} />
        <Stat label={t("stats.avgRate")} value={inr(f.avgRate)} />
        <Stat label={t("stats.nights")} value={f.nights} />
      </section>

      <Card className="mb-4">
        <CardTitle>{t("chart.title")}</CardTitle>
        <MonthBars
          series={series}
          selected={month}
          locale={locale}
          labels={{
            title: t("chart.title"),
            income: t("chart.income"),
            expenses: t("chart.expenses"),
            aria: t("chart.aria", { month: fmtMonth(month, locale) }),
            showTable: t("chart.showTable"),
            month: t("chart.month"),
            profit: t("chart.profit"),
            bar: (p) => t("chart.bar", p),
          }}
        />
      </Card>

      <div className="mb-4 grid gap-4 min-[960px]:grid-cols-2">
        <Card>
          <CardTitle>{t("byApartment.title")}</CardTitle>
          {f.byApartment.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className={th}>{t("byApartment.apartment")}</th>
                      <th scope="col" className={cn(th, "text-right")}>{t("byApartment.nights")}</th>
                      <th scope="col" className={cn(th, "text-right")}>{t("byApartment.occupancy")}</th>
                      <th scope="col" className={cn(th, "text-right")}>{t("byApartment.income")}</th>
                      <th scope="col" className={cn(th, "text-right")}>{t("byApartment.expenses")}</th>
                      <th scope="col" className={cn(th, "text-right")}>{t("byApartment.profit")}</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {f.byApartment.map((a) => {
                      const apt = aptById[a.apartment_id];
                      return (
                        <tr key={a.apartment_id} className="border-b border-line last:border-b-0">
                          <th scope="row" className={cn(td, "font-medium")}>
                            {apt ? <AptChip tag={apt.tag_colour} code={apt.code} /> : a.apartment_id}
                          </th>
                          <td className={cn(td, "text-right")}>{a.nights}</td>
                          <td className={cn(td, "text-right")}>{pct(a.occupancy)}</td>
                          <td className={cn(td, "text-right")}>{inr(a.income)}</td>
                          <td className={cn(td, "text-right")}>{inr(a.expenses)}</td>
                          <td className={cn(td, "text-right font-semibold", a.profit < 0 && "text-bad")}>{inr(a.profit)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[12.5px] text-muted">{t("byApartment.note")}</p>
            </>
          ) : (
            <p className="text-[14px] text-muted">{t("byApartment.none")}</p>
          )}
        </Card>

        <Card>
          <CardTitle>{t("byChannel.title")}</CardTitle>
          {f.byChannel.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className={th}>{t("byChannel.channel")}</th>
                    <th scope="col" className={cn(th, "text-right")}>{t("byChannel.bookings")}</th>
                    <th scope="col" className={cn(th, "text-right")}>{t("byChannel.nights")}</th>
                    <th scope="col" className={cn(th, "text-right")}>{t("byChannel.value")}</th>
                    <th scope="col" className={cn(th, "text-right")}>{t("byChannel.commission")}</th>
                    <th scope="col" className={cn(th, "text-right")}>{t("byChannel.net")}</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {f.byChannel.map((c) => (
                    <tr key={c.channel} className="border-b border-line last:border-b-0">
                      <th scope="row" className={td}>
                        <ChannelPill channel={c.channel} />
                      </th>
                      <td className={cn(td, "text-right")}>{c.bookings}</td>
                      <td className={cn(td, "text-right")}>{c.nights}</td>
                      <td className={cn(td, "text-right")}>{inr(c.gross)}</td>
                      <td className={cn(td, "text-right")}>{inr(c.commission)}</td>
                      <td className={cn(td, "text-right font-semibold")}>{inr(c.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[14px] text-muted">{t("byChannel.none")}</p>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>{t("where.title")}</CardTitle>
        {f.byCategory.length ? (
          <ul className="flex flex-col gap-3">
            {f.byCategory.map((c) => {
              const label =
                c.source === "petty"
                  ? t("where.petty", { category: tp.has(`categories.${c.category}`) ? tp(`categories.${c.category}`) : c.category })
                  : tx.has(`categories.${c.category}`)
                    ? tx(`categories.${c.category}`)
                    : c.category;
              return (
                <li key={`${c.source}:${c.category}`} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="min-w-0 truncate font-medium">{label}</span>
                    <span className="tabular flex-none font-semibold">{inr(c.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2" aria-hidden>
                    <div className="h-2 rounded-full bg-tag1" style={{ width: `${Math.max(2, (c.amount / maxCat) * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[14px] text-muted">{t("where.none")}</p>
        )}
      </Card>
    </>
  );
}
