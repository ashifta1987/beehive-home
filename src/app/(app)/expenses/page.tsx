import { getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/auth";
import { getApartments } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { monthRange } from "@/lib/finance";
import { todayIST } from "@/lib/dates";
import { inr } from "@/lib/money";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { Card, CardTitle, PageHeader, Stat } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";
import { MonthSwitcher } from "../finance/_components/month-switcher";
import { dateLocale, pickMonth, type SearchParams } from "../finance/_components/shared";
import { ExpensesView } from "./expenses-view";

export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireOwnerPage();
  const [{ month, current }, t, locale, apartments, supabase] = await Promise.all([
    pickMonth(searchParams),
    getTranslations("expenses"),
    dateLocale(),
    getApartments(),
    createClient(),
  ]);
  const { start, end } = monthRange(month);
  const { data, error } = await supabase
    .from("beehive_expenses")
    .select("id,date,amount,category,apartment_id,vendor,paid_via,note")
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load expenses");
  const rows = (data ?? []) as Expense[];

  const total = rows.reduce((s, e) => s + e.amount, 0);
  const byCat = new Map<ExpenseCategory, number>();
  for (const e of rows) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] ?? 1;

  const today = todayIST();
  const defaultDate = today.startsWith(month) ? today : `${month}-01`;

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <a href={`/api/export/expenses?m=${month}`} download aria-label={t("exportAria")} className={buttonClass("secondary", "md")}>
            <Icon name="download" size={18} />
            {t("export")}
          </a>
        }
      />
      <MonthSwitcher
        month={month}
        current={current}
        basePath="/expenses"
        locale={locale}
        labels={{ prev: t("prevMonth"), next: t("nextMonth"), thisMonth: t("thisMonth") }}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 min-[960px]:grid-cols-3">
        <Stat label={t("totalMonth")} value={inr(total)} />
        <Stat label={t("list")} value={t("entries", { count: rows.length })} />
        {cats[0] ? (
          <Stat label={t("biggest")} value={t(`categories.${cats[0][0]}`)} className="col-span-2 min-[960px]:col-span-1" />
        ) : null}
      </div>

      <div className="flex flex-col gap-4 min-[960px]:grid min-[960px]:grid-cols-[1fr_340px] min-[960px]:items-start">
        <div className="min-w-0">
          <ExpensesView
            rows={rows}
            apartments={apartments.map((a) => ({ id: a.id, code: a.code, name: a.name, tag_colour: a.tag_colour }))}
            defaultDate={defaultDate}
            locale={locale}
          />
        </div>
        {cats.length ? (
          <Card>
            <CardTitle>{t("byCategory")}</CardTitle>
            <ul className="flex flex-col gap-3">
              {cats.map(([c, v]) => (
                <li key={c} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
                    <span className="font-medium">{t(`categories.${c}`)}</span>
                    <span className="tabular font-semibold">{inr(v)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2" aria-hidden>
                    <div className="h-2 rounded-full bg-tag1" style={{ width: `${Math.max(2, (v / maxCat) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
