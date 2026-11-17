import type { ReactNode } from "react";
import { cn, CHANNEL_CLASSES, tagClasses } from "@/lib/ui";
import { CHANNEL_LABEL } from "@/lib/guest";

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "ink";
const TONE: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-accent-soft text-accent",
  neutral: "bg-surface-2 text-muted",
  ink: "bg-ink text-surface",
};

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold leading-none whitespace-nowrap", TONE[tone], className)}>
      {children}
    </span>
  );
}

export function ChannelPill({ channel, className }: { channel: string | null | undefined; className?: string }) {
  const c = channel ?? "other";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[12.5px] font-semibold leading-none whitespace-nowrap", CHANNEL_CLASSES[c] ?? CHANNEL_CLASSES.other, className)}>
      {CHANNEL_LABEL[c] ?? c}
    </span>
  );
}

/** Small square in an apartment's colour, with an accessible label. */
export function AptSquare({ tag, label, size = 10 }: { tag: string | null | undefined; label?: string; size?: number }) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block flex-none rounded-[3px]", tagClasses(tag).bg)}
      style={{ width: size, height: size }}
    />
  );
}

/** Apartment code chip in its tag colour, e.g. [1BHK]. */
export function AptChip({ tag, code, className }: { tag: string | null | undefined; code: string; className?: string }) {
  const t = tagClasses(tag);
  return (
    <span className={cn("inline-flex items-center rounded-[8px] px-2 py-0.5 font-display text-[12px] font-extrabold", t.bg, t.text, className)}>
      {code}
    </span>
  );
}
