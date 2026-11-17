import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";
import { addMonths, fmtMonth } from "@/lib/dates";

/**
 * Month switcher used by Finance, Expenses and Petty cash: ‹ November 2026 › links
 * that set `?m=YYYY-MM`. Labels come from the calling page's namespace.
 */
export function MonthSwitcher({
  month,
  current,
  basePath,
  locale,
  labels,
}: {
  month: string;
  current: string;
  basePath: string;
  locale: string;
  labels: { prev: string; next: string; thisMonth: string };
}) {
  const href = (m: string) => (m === current ? basePath : `${basePath}?m=${m}`);
  const arrow = "inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface text-ink hover:bg-surface-2";
  return (
    <nav aria-label={fmtMonth(month, locale)} className="mb-4 flex items-center gap-2">
      <Link href={href(addMonths(month, -1))} className={arrow} aria-label={labels.prev} title={labels.prev}>
        <Icon name="chevronLeft" size={20} />
      </Link>
      <p className="min-w-0 flex-1 text-center font-display text-[16px] font-bold tracking-[-0.02em]" aria-live="polite">
        {fmtMonth(month, locale)}
      </p>
      <Link href={href(addMonths(month, 1))} className={arrow} aria-label={labels.next} title={labels.next}>
        <Icon name="chevron" size={20} />
      </Link>
      {month !== current ? (
        <Link href={basePath} className={buttonClass("secondary", "sm", "min-h-11")}>
          {labels.thisMonth}
        </Link>
      ) : null}
    </nav>
  );
}
