import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/lib/auth";
import { getApartments } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { monthRange } from "@/lib/finance";
import { todayIST } from "@/lib/dates";
import { inr } from "@/lib/money";
import type { Petty } from "@/lib/types";
import { PageHeader, Stat } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { MonthSwitcher } from "../finance/_components/month-switcher";
import { dateLocale, pickMonth, type SearchParams } from "../finance/_components/shared";
import { PettyView } from "./petty-view";

export default async function PettyPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireStaffPage();
  const isOwner = session.staff.role === "owner";
  const [{ month, current }, t, locale, apartments, supabase] = await Promise.all([
    pickMonth(searchParams),
    getTranslations("petty"),
    dateLocale(),
    getApartments(),
    createClient(),
  ]);
  const { start, end } = monthRange(month);

  const [all, monthRows, staff] = await Promise.all([
    // Balance is over every entry ever recorded.
    supabase.from("beehive_petty").select("type,amount"),
    supabase
      .from("beehive_petty")
      .select("id,type,date,amount,category,apartment_id,note,created_by,created_at")
      .gte("date", start)
      .lt("date", end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    // Owner sees every staff name; a housekeeper can read only their own row (RLS).
    supabase.from("beehive_staff").select("user_id,name,email"),
  ]);
  if (all.error || monthRows.error) throw new Error("Could not load petty cash");

  const balance = ((all.data ?? []) as Pick<Petty, "type" | "amount">[]).reduce((s, e) => s + (e.type === "in" ? e.amount : -e.amount), 0);
  const names = new Map(
    ((staff.data ?? []) as { user_id: string; name: string | null; email: string | null }[]).map((s) => [s.user_id, s.name || s.email]),
  );
  const rows = ((monthRows.data ?? []) as Petty[]).map((r) => ({ ...r, by: r.created_by ? (names.get(r.created_by) ?? null) : null }));
  const spent = rows.filter((r) => r.type === "out").reduce((s, r) => s + r.amount, 0);
  const received = rows.filter((r) => r.type === "in").reduce((s, r) => s + r.amount, 0);

  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString(locale, { month: "short", year: "numeric" });
  const today = todayIST();
  const defaultDate = today.startsWith(month) ? today : `${month}-01`;

  return (
    <>
      <PageHeader title={t("title")} subtitle={isOwner ? t("subtitleOwner") : t("subtitleHk")} />

      {balance < 0 ? (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-[24px] bg-bad-soft p-4 text-bad">
          <Icon name="alert" size={22} className="mt-0.5 flex-none" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <p className="font-display text-[14px] font-bold">{t("negativeTitle", { amount: inr(-balance) })}</p>
            <p className="text-[14px]">{isOwner ? t("negativeOwner") : t("negativeHk")}</p>
          </div>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
        <Stat label={t("balance")} value={inr(balance)} tone={balance < 0 ? "bad" : balance > 0 ? "ok" : undefined} />
        <Stat label={t("spentMonth", { month: monthLabel })} value={inr(spent)} />
        <Stat label={t("receivedMonth", { month: monthLabel })} value={inr(received)} />
      </div>

      <MonthSwitcher
        month={month}
        current={current}
        basePath="/petty"
        locale={locale}
        labels={{ prev: t("prevMonth"), next: t("nextMonth"), thisMonth: t("thisMonth") }}
      />

      <PettyView
        rows={rows}
        apartments={apartments.map((a) => ({ id: a.id, code: a.code, name: a.name, tag_colour: a.tag_colour }))}
        defaultDate={defaultDate}
        locale={locale}
        isOwner={isOwner}
        userId={session.userId}
      />
    </>
  );
}
