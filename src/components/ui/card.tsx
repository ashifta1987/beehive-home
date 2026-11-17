import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

export function Card({ children, className, as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "li" }) {
  return <Tag className={cn("rounded-[24px] bg-surface p-4", className)}>{children}</Tag>;
}

export function CardTitle({ children, className, action }: { children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className={cn("font-display text-[14px] font-bold", className)}>{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 pb-4 pt-2">
      <div className="flex min-w-0 flex-col">
        {subtitle ? <span className="text-[13px] text-muted">{subtitle}</span> : null}
        <h1 className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em] md:text-[26px]">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[24px] bg-surface px-6 py-10 text-center">
      {icon ? <div className="mb-1 text-muted">{icon}</div> : null}
      <p className="font-display text-[15px] font-bold">{title}</p>
      {body ? <p className="max-w-sm text-[14px] text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full rounded-[24px]" />
      <Skeleton className="h-24 w-full rounded-[24px]" />
      <Skeleton className="h-24 w-full rounded-[24px]" />
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-[13px] bg-bad-soft px-3 py-2.5 text-[14px] font-medium text-bad">
      {children}
    </p>
  );
}

/** Label/value tile, e.g. "Guest leaves · 11:00 AM". */
export function Stat({ label, value, tone, className }: { label: string; value: ReactNode; tone?: "warn" | "ok" | "bad"; className?: string }) {
  const toneCls = tone === "warn" ? "bg-warn-soft" : tone === "ok" ? "bg-ok-soft" : tone === "bad" ? "bg-bad-soft" : "bg-surface-2";
  return (
    <div className={cn("flex flex-col rounded-[14px] px-3 py-2.5", toneCls, className)}>
      <span className="text-[11.5px] text-muted">{label}</span>
      <span className="tabular text-[17px] font-bold">{value}</span>
    </div>
  );
}

