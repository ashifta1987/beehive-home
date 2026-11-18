"use client";

import { useEffect, useState, type ReactNode } from "react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { cn, tagClasses } from "@/lib/ui";
import type { PortalLocale } from "./checkin-schema";
import { Logo } from "@/components/brand/logo";

export type PortalMessages = Record<PortalLocale, Record<string, unknown>>;

const LANGS: Array<{ value: PortalLocale; short: string; name: string }> = [
  { value: "en", short: "EN", name: "English" },
  { value: "ml", short: "മല", name: "മലയാളം" },
  { value: "hi", short: "हिं", name: "हिंदी" },
];

/** Guest-portal i18n: all three languages are on the page, so switching keeps the form. */
export function PortalProvider({
  messages,
  initialLocale,
  children,
}: {
  messages: PortalMessages;
  initialLocale: PortalLocale;
  children: (locale: PortalLocale, setLocale: (l: PortalLocale) => void) => ReactNode;
}) {
  const [locale, setLocale] = useState<PortalLocale>(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="Asia/Kolkata">
      {children(locale, setLocale)}
    </NextIntlClientProvider>
  );
}

export function LangSwitch({ value, onChange }: { value: PortalLocale; onChange: (l: PortalLocale) => void }) {
  const t = useTranslations("portal");
  return (
    <div className="flex gap-1 rounded-full bg-surface p-[3px]" role="group" aria-label={t("language")}>
      {LANGS.map((l) => (
        <button
          key={l.value}
          type="button"
          lang={l.value}
          aria-pressed={value === l.value}
          aria-label={l.name}
          onClick={() => onChange(l.value)}
          className={cn(
            "min-h-11 min-w-11 rounded-full px-2.5 text-[12.5px] font-semibold",
            value === l.value ? "bg-ink text-surface" : "text-ink",
          )}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}

/** Beehive Home logo for the guest portal header. */
export function BrandRow() {
  return <Logo size={14} />;
}

/** The big tilted apartment key tag on the welcome screen. */
export function GuestTag({ tag, code, name, location }: { tag: string; code: string; name: string; location: string }) {
  const c = tagClasses(tag);
  return (
    <div
      className={cn(
        "flex w-[210px] rotate-3 flex-col gap-1 rounded-[30px] px-[22px] pb-6 pt-[22px] shadow-tag",
        c.bg,
        c.text,
      )}
    >
      <span aria-hidden className="h-[22px] w-[22px] self-center rounded-full border-[3.5px] border-current bg-bg" />
      <span className="mt-2.5 font-display text-[44px] font-extrabold leading-[1.05] tracking-[-0.04em]">{code}</span>
      <span className="text-[13px] font-semibold">{name}</span>
      <span className="text-[12px] opacity-85">{location}</span>
    </div>
  );
}

export function LockLine({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("flex items-start justify-center gap-1.5 text-[12.5px] text-muted", className)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="mt-0.5 flex-none">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <span>{children}</span>
    </span>
  );
}

/** Wrong / missing key, or the database could not be reached. */
export function PortalProblem({
  kind,
  locale,
  setLocale,
}: {
  kind: "invalid" | "unavailable";
  locale: PortalLocale;
  setLocale: (l: PortalLocale) => void;
}) {
  const t = useTranslations("portal");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg">
      <header className="flex items-center justify-between px-5 pt-5">
        <BrandRow />
        <LangSwitch value={locale} onChange={setLocale} />
      </header>
      <section className="mx-4 mt-10 flex flex-col items-center gap-3 rounded-[24px] bg-surface px-6 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-warn-soft text-warn" aria-hidden>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
        </span>
        <h1 className="font-display text-[21px] font-extrabold tracking-[-0.03em]">
          {kind === "invalid" ? t("invalidTitle") : t("unavailableTitle")}
        </h1>
        <p className="max-w-[32ch] text-[15px] text-muted">{kind === "invalid" ? t("invalidBody") : t("unavailableBody")}</p>
      </section>
    </main>
  );
}
