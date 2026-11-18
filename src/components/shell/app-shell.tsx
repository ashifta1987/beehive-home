"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/ui";
import { Logo } from "@/components/brand/logo";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { ToastProvider } from "@/components/ui/toast";
import { barFor, groupsFor, type NavItem } from "./nav";
import { signOut } from "@/app/(auth)/actions";

export type Badges = Partial<Record<string, number>>;

function isActive(path: string, href: string) {
  const base = href.split("?")[0];
  return path === base || path.startsWith(base + "/");
}

function Bubble({ n, className }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn("tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-bad px-1.5 text-[11px] font-bold text-on-bad", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function AppShell({
  role,
  name,
  badges,
  children,
}: {
  role: Role;
  name: string;
  badges: Badges;
  children: ReactNode;
}) {
  const path = usePathname();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const [moreOpen, setMoreOpen] = useState(false);
  const groups = groupsFor(role);
  const bar = barFor(role);
  const barHrefs = new Set(bar.map((b) => b.href.split("?")[0]));
  const moreActive = !bar.some((b) => isActive(path, b.href));
  const moreBadge = groups
    .flatMap((g) => g.items)
    .filter((i) => !barHrefs.has(i.href) && i.badge)
    .reduce((s, i) => s + (badges[i.badge!] ?? 0), 0);

  return (
    <ToastProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] gap-5 min-[960px]:p-4">
        {/* Sidebar ≥ 960 px */}
        <aside className="no-print sticky top-4 hidden h-[calc(100dvh-2rem)] w-[248px] flex-none flex-col overflow-y-auto rounded-[24px] bg-surface p-4 min-[960px]:flex">
          <Link href={role === "owner" ? "/today" : "/jobs"} className="mb-5 flex justify-center px-1 pt-1">
            <Logo size={15} tagline />
          </Link>
          <nav aria-label={t("main")} className="flex flex-1 flex-col gap-4">
            {groups.map((g) => (
              <div key={g.label} className="flex flex-col gap-0.5">
                <span className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{t(`groups.${g.label}`)}</span>
                {g.items.map((i) => (
                  <SideLink key={i.href} item={i} active={isActive(path, i.href)} label={t(i.label)} badge={i.badge ? badges[i.badge] : undefined} />
                ))}
              </div>
            ))}
          </nav>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-line px-2 pt-3">
            <span className="min-w-0 truncate text-[13px] text-muted">{name}</span>
            <form action={signOut}>
              <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-[11px] px-2 text-[13px] font-semibold text-muted hover:bg-surface-2" aria-label={tc("signOut")}>
                <Icon name="logout" size={18} />
              </button>
            </form>
          </div>
        </aside>

        <main className="gutter min-w-0 flex-1 pb-32 pt-3 min-[960px]:px-2 min-[960px]:pb-10 min-[960px]:pt-2">{children}</main>
      </div>

      {/* Floating bottom bar < 960 px */}
      <nav
        aria-label={t("main")}
        className="no-print fixed inset-x-3 z-40 grid grid-cols-5 rounded-[24px] bg-ink p-2 shadow-card min-[960px]:hidden"
        style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        {bar.map((i) => {
          const active = isActive(path, i.href) && !i.href.includes("?");
          return (
            <Link key={i.href} href={i.href} aria-label={t(i.label)} aria-current={active ? "page" : undefined}
              className={cn("relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[16px] text-[10.5px] font-semibold", active ? "bg-tag1 text-tag1-ink" : "text-surface")}>
              <Icon name={i.icon} size={i.icon === "plus" ? 24 : 21} strokeWidth={i.icon === "plus" ? 2.2 : 2} />
              <span className="leading-none">{t(i.label)}</span>
              <Bubble n={i.badge ? badges[i.badge] : undefined} className="absolute right-2 top-0.5" />
            </Link>
          );
        })}
        <button type="button" onClick={() => setMoreOpen(true)} aria-label={t("more")} aria-haspopup="dialog"
          className={cn("relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[16px] text-[10.5px] font-semibold", moreActive ? "bg-tag1 text-tag1-ink" : "text-surface")}>
          <Icon name="more" size={22} strokeWidth={3} />
          <span className="leading-none">{t("more")}</span>
          <Bubble n={moreBadge} className="absolute right-2 top-0.5" />
        </button>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t("more")}>
        <div className="flex flex-col gap-4 pb-2">
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-1">
              <span className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{t(`groups.${g.label}`)}</span>
              <div className="grid grid-cols-2 gap-2">
                {g.items.map((i) => (
                  <Link key={i.href} href={i.href} onClick={() => setMoreOpen(false)}
                    className={cn("relative flex min-h-12 items-center gap-2.5 rounded-[14px] px-3 text-[14px] font-semibold", isActive(path, i.href) ? "bg-ink text-surface" : "bg-surface-2")}>
                    <Icon name={i.icon} size={19} />
                    <span className="min-w-0 flex-1 truncate">{t(i.label)}</span>
                    <Bubble n={i.badge ? badges[i.badge] : undefined} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <form action={signOut}>
            <button type="submit" className="flex min-h-12 w-full items-center gap-2.5 rounded-[14px] bg-surface-2 px-3 text-[14px] font-semibold">
              <Icon name="logout" size={19} /> {tc("signOut")} · <span className="truncate font-normal text-muted">{name}</span>
            </button>
          </form>
        </div>
      </Sheet>
    </ToastProvider>
  );
}

function SideLink({ item, active, label, badge }: { item: NavItem; active: boolean; label: string; badge?: number }) {
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined}
      className={cn("flex min-h-10 items-center gap-2.5 rounded-[12px] px-3 text-[14px] font-medium transition", active ? "bg-ink text-surface" : "text-ink hover:bg-surface-2")}>
      <Icon name={item.icon} size={18} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <Bubble n={badge} />
    </Link>
  );
}

