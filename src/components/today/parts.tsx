import Link from "next/link";
import type { ReactNode } from "react";
import type { Alert } from "@/lib/types";
import { cn, tagClasses } from "@/lib/ui";
import { Icon } from "@/components/ui/icon";
import { AptSquare } from "@/components/ui/pill";

/** Coloured key tag for one apartment (Today screen). */
export function KeyTag({
  href,
  tag,
  code,
  name,
  state,
  line1,
  line2,
  tilt,
}: {
  href: string;
  tag: string;
  code: string;
  name: string;
  state: string;
  line1: string;
  line2: string;
  tilt: "left" | "right";
}) {
  const c = tagClasses(tag);
  return (
    <Link
      href={href}
      aria-label={`${name}: ${state}. ${line1}. ${line2}`}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-[22px] px-4 pb-4 pt-[18px] shadow-tag transition hover:brightness-[1.03]",
        c.bg,
        c.text,
        tilt === "left" ? "-rotate-2" : "rotate-2",
      )}
    >
      <span className="tag-hole self-center" aria-hidden />
      <span className="mt-1 truncate font-display text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">{code}</span>
      <span className="text-[12px] font-bold uppercase tracking-[0.06em]">{state}</span>
      <span className="truncate text-[14px] font-semibold">{line1}</span>
      <span className="truncate text-[12px]">{line2}</span>
    </Link>
  );
}

/** Mon–Sun strip; today in ink; squares in apartment colours on check-in/out days. */
export function WeekStrip({
  days,
  label,
}: {
  label: string;
  days: { date: string; dow: string; num: number; isToday: boolean; marks: { tag: string; code: string }[]; aria: string }[];
}) {
  return (
    <nav aria-label={label} className="grid grid-cols-7 gap-1.5">
      {days.map((d) => (
        <Link
          key={d.date}
          href={`/calendar?month=${d.date.slice(0, 7)}`}
          aria-label={d.aria}
          aria-current={d.isToday ? "date" : undefined}
          className={cn(
            "flex min-h-[64px] flex-col items-center gap-0.5 rounded-[14px] py-2 text-[11px]",
            d.isToday ? "bg-ink text-surface" : "bg-surface text-muted hover:bg-surface-2",
          )}
        >
          {d.dow}
          <b className={cn("tabular text-[15px]", d.isToday ? "text-surface" : "text-ink")}>{d.num}</b>
          <span className="flex h-[6px] gap-[3px]" aria-hidden>
            {d.marks.map((m) => (
              <AptSquare key={m.code} tag={m.tag} size={6} />
            ))}
          </span>
        </Link>
      ))}
    </nav>
  );
}

/** One alert row: coloured chip, plain text, chevron; links to the page that fixes it. */
export function AlertRow({ alert }: { alert: Alert }) {
  const chip = (
    <span
      className={cn(
        "flex-none rounded-[8px] px-2 py-1 text-[11px] font-bold tracking-[0.02em]",
        alert.level === "bad" ? "bg-bad text-on-bad" : "bg-warn-soft text-warn",
      )}
    >
      {alert.label}
    </span>
  );
  const body = (
    <>
      {chip}
      <span className="min-w-0 flex-1 text-[14px] leading-snug">{alert.text}</span>
      {alert.href ? <Icon name="chevron" size={18} className="flex-none text-muted" /> : null}
    </>
  );
  const cls = "flex min-h-11 items-center gap-2.5 rounded-[16px] bg-surface px-3.5 py-3";
  return alert.href ? (
    <Link href={alert.href} className={cn(cls, "hover:bg-surface-2")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Agenda row: time chip, title/subtitle, apartment squares. */
export function AgendaRow({
  time,
  title,
  subtitle,
  marks,
  href,
}: {
  time: string;
  title: ReactNode;
  subtitle: ReactNode;
  marks: { tag: string; code: string }[];
  href?: string;
}) {
  const inner = (
    <>
      <span className="tabular w-[60px] flex-none rounded-[10px] bg-bg py-2 text-center text-[13px] font-bold">{time}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-semibold">{title}</span>
        <span className="truncate text-[12px] text-muted">{subtitle}</span>
      </span>
      <span className="flex flex-none gap-[3px]">
        {marks.map((m) => (
          <AptSquare key={m.code} tag={m.tag} label={m.code} />
        ))}
      </span>
    </>
  );
  const cls = "flex min-h-11 items-center gap-3 rounded-[16px] bg-surface px-3 py-2.5";
  return href ? (
    <Link href={href} className={cn(cls, "hover:bg-surface-2")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function SectionTitle({ children, id, action }: { children: ReactNode; id?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <h2 id={id} className="font-display text-[14px] font-bold">
        {children}
      </h2>
      {action}
    </div>
  );
}
