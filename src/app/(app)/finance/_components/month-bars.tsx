import Link from "next/link";
import { inr } from "@/lib/money";
import type { SeriesPoint } from "@/lib/finance";
import { cn } from "@/lib/ui";

function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/**
 * 12-month bars (net income incl. extras vs expenses), pure HTML/CSS.
 * Each month links to that month. A table with the same numbers sits under a <details>.
 */
export function MonthBars({
  series,
  selected,
  locale,
  labels,
}: {
  series: SeriesPoint[];
  selected: string;
  locale: string;
  labels: {
    title: string;
    income: string;
    expenses: string;
    aria: string;
    showTable: string;
    month: string;
    profit: string;
    bar: (p: { month: string; income: string; expenses: string }) => string;
  };
}) {
  const compact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
  const max = niceMax(Math.max(0, ...series.map((s) => Math.max(s.income, s.expenses))));
  const h = (v: number) => `${(Math.max(0, v) / max) * 100}%`;
  const short = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(locale, { month: "short" });
  const long = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" });
  const ticks = [1, 0.75, 0.5, 0.25, 0];

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-tag2" aria-hidden />
          {labels.income}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-[3px] bg-tag1" aria-hidden />
          {labels.expenses}
        </span>
      </div>

      <div className="flex gap-2" role="img" aria-label={labels.aria}>
        {/* y-axis labels */}
        <div className="relative h-[180px] w-12 flex-none text-right text-[10.5px] text-muted tabular" aria-hidden>
          {ticks.map((f) => (
            <span key={f} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - f) * 100}%` }}>
              {compact.format(max * f)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-[180px]">
            {ticks.map((f) => (
              <div key={f} className="absolute inset-x-0 border-t border-line" style={{ top: `${(1 - f) * 100}%` }} aria-hidden />
            ))}
            <div className="absolute inset-0 flex items-end">
              {series.map((s) => {
                const title = labels.bar({ month: long(s.month), income: inr(s.income), expenses: inr(s.expenses) });
                return (
                  <Link
                    key={s.month}
                    href={`/finance?m=${s.month}`}
                    title={title}
                    aria-hidden
                    tabIndex={-1}
                    className={cn(
                      "flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] rounded-[6px] px-[1px] hover:bg-surface-2/70",
                      s.month === selected && "bg-surface-2",
                    )}
                  >
                    <span className="block w-full max-w-[14px] rounded-t-[3px] bg-tag2" style={{ height: h(s.income) }} />
                    <span className="block w-full max-w-[14px] rounded-t-[3px] bg-tag1" style={{ height: h(s.expenses) }} />
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="mt-1 flex" aria-hidden>
            {series.map((s) => (
              <span
                key={s.month}
                className={cn("min-w-0 flex-1 truncate text-center text-[10.5px]", s.month === selected ? "font-bold text-ink" : "text-muted")}
              >
                {short(s.month)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="rounded-[14px] bg-surface-2 px-3 py-2 text-[13.5px]">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{labels.showTable}</summary>
        <div className="overflow-x-auto pb-2">
          <table className="w-full min-w-[360px] text-left">
            <caption className="sr-only">{labels.title}</caption>
            <thead className="text-[12px] text-muted">
              <tr>
                <th scope="col" className="py-1.5 font-semibold">{labels.month}</th>
                <th scope="col" className="py-1.5 text-right font-semibold">{labels.income}</th>
                <th scope="col" className="py-1.5 text-right font-semibold">{labels.expenses}</th>
                <th scope="col" className="py-1.5 text-right font-semibold">{labels.profit}</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {series.map((s) => (
                <tr key={s.month} className={cn("border-t border-line", s.month === selected && "font-bold")}>
                  <th scope="row" className="py-1.5 font-medium">
                    <Link href={`/finance?m=${s.month}`} className="underline-offset-2 hover:underline">
                      {long(s.month)}
                    </Link>
                  </th>
                  <td className="py-1.5 text-right">{inr(s.income)}</td>
                  <td className="py-1.5 text-right">{inr(s.expenses)}</td>
                  <td className={cn("py-1.5 text-right", s.profit < 0 && "text-bad")}>{inr(s.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
