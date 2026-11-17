"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { AptChip, Pill } from "@/components/ui/pill";
import { fmtDay } from "@/lib/dates";
import { inr } from "@/lib/money";
import type { Expense } from "@/lib/types";
import { ExpenseSheet, type AptOption } from "./expense-sheet";

/** "Add expense" button + entries list; both open the expense sheet. */
export function ExpensesView({
  rows,
  apartments,
  defaultDate,
  locale,
}: {
  rows: Expense[];
  apartments: AptOption[];
  defaultDate: string;
  locale: string;
}) {
  const t = useTranslations("expenses");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [nonce, setNonce] = useState(0);
  const apts = Object.fromEntries(apartments.map((a) => [a.id, a]));

  const openSheet = (e: Expense | null) => {
    setEditing(e);
    setNonce((n) => n + 1);
    setOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="honey" onClick={() => openSheet(null)}>
          <Icon name="plus" size={18} />
          {t("add")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Icon name="receipt" size={32} />}
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <Button onClick={() => openSheet(null)}>
              <Icon name="plus" size={18} />
              {t("add")}
            </Button>
          }
        />
      ) : (
        <Card>
          <CardTitle>{t("list")}</CardTitle>
          <ul className="-mx-2 flex flex-col">
            {rows.map((e) => {
              const apt = e.apartment_id ? apts[e.apartment_id] : undefined;
              const what = `${t(`categories.${e.category}`)} ${inr(e.amount)} ${fmtDay(e.date, locale)}`;
              const sub = [fmtDay(e.date, locale), e.vendor, e.paid_via ? t(`paidViaOptions.${e.paid_via}`) : null].filter(Boolean).join(" · ");
              return (
                <li key={e.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => openSheet(e)}
                    aria-label={t("editAria", { what })}
                    className="flex min-h-14 w-full items-center gap-3 rounded-[14px] px-2 py-2.5 text-left hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-semibold">
                        {t(`categories.${e.category}`)}
                        {apt ? <AptChip tag={apt.tag_colour} code={apt.code} /> : <Pill>{t("shared")}</Pill>}
                      </span>
                      <span className="truncate text-[13px] text-muted">{sub}</span>
                      {e.note ? <span className="line-clamp-2 text-[13px] text-muted">{e.note}</span> : null}
                    </span>
                    <span className="tabular flex-none text-[15px] font-bold">{inr(e.amount)}</span>
                    <Icon name="edit" size={18} className="flex-none text-muted" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <ExpenseSheet
        key={`${editing?.id ?? "new"}-${nonce}`}
        open={open}
        onClose={() => setOpen(false)}
        expense={editing}
        defaultDate={defaultDate}
        apartments={apartments}
      />
    </>
  );
}
