"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Field, Input, PillChoice, Select, TextField } from "@/components/ui/form";
import { ErrorBox } from "@/components/ui/card";
import { addDaysISO, fmtDay, fmtTime, todayIST } from "@/lib/dates";
import { waLink } from "@/lib/guest";
import { cn, tagClasses } from "@/lib/ui";
import {
  COUNTRY_CODES,
  ID_TYPES,
  VISA_TYPES,
  phoneDigits,
  type GuestApartment,
  type IdType,
  type PhotoResponse,
  type PortalLocale,
  type SubmitResponse,
  type VisaType,
} from "./checkin-schema";
import { compressImage } from "./compress";
import { BrandRow, GuestTag, LangSwitch, LockLine } from "./portal-ui";

type Step = "welcome" | "details" | "id" | "passport" | "rules" | "done";

interface FormState {
  full_name: string;
  phone_code: string;
  phone: string;
  adults: number;
  children: number;
  check_out: string;
  is_foreign: boolean | null;
  id_type: IdType;
  nationality: string;
  passport_no: string;
  passport_expiry: string;
  visa_no: string;
  visa_type: VisaType;
  visa_expiry: string;
  arrived_india: string;
  arriving_from: string;
  next_destination: string;
  rules: boolean;
}

const EMPTY: FormState = {
  full_name: "",
  phone_code: "+91",
  phone: "",
  adults: 1,
  children: 0,
  check_out: "",
  is_foreign: null,
  id_type: "aadhaar",
  nationality: "",
  passport_no: "",
  passport_expiry: "",
  visa_no: "",
  visa_type: "e-Tourist",
  visa_expiry: "",
  arrived_india: "",
  arriving_from: "",
  next_destination: "",
  rules: false,
};

type Submitted = Extract<SubmitResponse, { ok: true }>;
type Phase = "idle" | "sending" | "uploading" | "failed";

const DATE_LOCALE: Record<PortalLocale, string> = { en: "en-IN", ml: "ml-IN", hi: "hi-IN" };
const RULE_TONES = [
  "bg-bad-soft text-bad",
  "bg-accent-soft text-accent",
  "bg-warn-soft text-warn",
  "bg-ok-soft text-ok",
  "bg-surface-2 text-ink",
];

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function BigButton({
  children,
  onClick,
  variant = "ink",
  disabled,
  busy,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "ink" | "honey";
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={cn(
        "flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-[20px] px-5 text-[16px]",
        variant === "honey" ? "bg-tag1 font-extrabold text-tag1-ink" : "bg-ink font-bold text-surface",
      )}
    >
      {children}
    </button>
  );
}

function Counter({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const t = useTranslations("portal");
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-muted">{label}</span>
      <div className="flex items-center justify-between rounded-[14px] bg-surface-2 p-1">
        <button type="button" aria-label={t("fewer", { label })} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}
          className="h-11 w-11 rounded-[11px] bg-surface text-[20px] leading-[44px]">−</button>
        <span className="tabular text-[18px] font-bold" aria-live="polite">{value}</span>
        <button type="button" aria-label={t("more", { label })} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}
          className="h-11 w-11 rounded-[11px] bg-surface text-[20px] leading-[44px]">+</button>
      </div>
    </div>
  );
}

export function CheckinFlow({
  apartment,
  doorKey,
  hostWhatsapp,
  location,
  locale,
  setLocale,
}: {
  apartment: GuestApartment;
  doorKey: string;
  hostWhatsapp: string | null;
  location: string;
  locale: PortalLocale;
  setLocale: (l: PortalLocale) => void;
}) {
  const t = useTranslations("portal");
  const [step, setStep] = useState<Step>("welcome");
  const [f, setF] = useState<FormState>(EMPTY);
  const [photos, setPhotos] = useState<Array<Blob | null>>([null]);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Submitted | null>(null);
  const [uploaded, setUploaded] = useState<boolean[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [failInfo, setFailInfo] = useState<{ count: number; fatal: boolean } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [skippedPhotos, setSkippedPhotos] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef(0);

  const tag = tagClasses(apartment.tag_colour);
  const today = todayIST();
  const rules = (apartment.house_rules ?? []).filter((r) => r.trim());

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setErrors((e) => {
      if (!e[k as string]) return e;
      const next = { ...e };
      delete next[k as string];
      return next;
    });
  };

  const setAdults = (n: number) => {
    set("adults", n);
    setPhotos((p) => (p.length === n ? p : Array.from({ length: n }, (_, i) => p[i] ?? null)));
  };

  // ---- validation (the server re-checks everything) ----
  function validateDetails(): boolean {
    const e: Record<string, string> = {};
    if (f.full_name.trim().length < 2) e.full_name = t("errName");
    const digits = phoneDigits(f.phone).length;
    if (digits < 6 || digits > 15) e.phone = t("errPhone");
    if (!f.check_out || f.check_out < today || f.check_out > addDaysISO(today, 366)) e.check_out = t("errCheckOut");
    if (f.is_foreign === null) e.is_foreign = t("errNationality");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateId(): boolean {
    const missing = photos.filter((p) => !p).length;
    if (missing > 0) {
      setErrors({ photos: t("errPhotos", { count: missing }) });
      return false;
    }
    setErrors({});
    return true;
  }

  function validatePassport(): boolean {
    const e: Record<string, string> = {};
    const req = t("errRequired");
    if (!f.nationality.trim()) e.nationality = req;
    if (!f.passport_no.trim()) e.passport_no = req;
    if (!f.passport_expiry) e.passport_expiry = req;
    if (!f.arrived_india) e.arrived_india = req;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ---- navigation ----
  const goNext = () => {
    if (step === "welcome") return setStep("details");
    if (step === "details" && validateDetails()) return setStep("id");
    if (step === "id" && validateId()) return setStep(f.is_foreign ? "passport" : "rules");
    if (step === "passport" && validatePassport()) return setStep("rules");
  };
  const goBack = () => {
    setErrors({});
    if (step === "details") setStep("welcome");
    else if (step === "id") setStep("details");
    else if (step === "passport") setStep("id");
    else if (step === "rules") setStep(f.is_foreign ? "passport" : "id");
  };

  // ---- photos ----
  const pickPhoto = (i: number) => {
    slotRef.current = i;
    fileRef.current?.click();
  };
  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    const i = slotRef.current;
    setBusySlot(i);
    setErrors({});
    try {
      const blob = await compressImage(file);
      setPhotos((p) => p.map((x, j) => (j === i ? blob : x)));
      setUploaded((u) => u.map((x, j) => (j === i ? false : x)));
    } catch {
      setErrors({ photos: t("errPhotoRead") });
    } finally {
      setBusySlot(null);
    }
  };

  // ---- submit ----
  async function uploadOne(id: string, blob: Blob, i: number): Promise<PhotoResponse> {
    const body = new FormData();
    body.set("apartment", apartment.id);
    body.set("key", doorKey);
    body.set("checkin_id", id);
    body.set("file", blob, `id-${i + 1}.jpg`);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch("/api/checkin/photo", { method: "POST", body });
        return (await r.json()) as PhotoResponse;
      } catch {
        // network blip: retry once
      }
    }
    return { ok: false, error: "server" };
  }

  async function uploadAll(res: Submitted) {
    const done = photos.map((_, i) => uploaded[i] ?? false);
    const todo = photos.map((_, i) => i).filter((i) => photos[i] && !done[i]);
    setPhase("uploading");
    let failed = 0;
    let fatal = false;
    for (let n = 0; n < todo.length; n++) {
      const i = todo[n];
      setProgress({ current: n + 1, total: todo.length });
      const r = await uploadOne(res.id, photos[i]!, i);
      if (r.ok) done[i] = true;
      else {
        failed++;
        if (r.error !== "server") fatal = true;
      }
    }
    setUploaded(done);
    if (failed > 0) {
      setFailInfo({ count: failed, fatal });
      setPhase("failed");
    } else {
      setPhase("idle");
      setStep("done");
    }
  }

  async function complete() {
    if (!f.rules) {
      setErrors({ rules: t("errAgree") });
      return;
    }
    setSubmitError(null);
    setFailInfo(null);
    let res = result;
    if (!res) {
      setPhase("sending");
      try {
        const r = await fetch("/api/checkin/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apartment: apartment.id,
            key: doorKey,
            full_name: f.full_name.trim(),
            phone_code: f.phone_code,
            phone: f.phone.trim(),
            adults: f.adults,
            children: f.children,
            check_out: f.check_out,
            is_foreign: f.is_foreign === true,
            id_type: f.id_type,
            nationality: f.is_foreign ? f.nationality : null,
            passport_no: f.is_foreign ? f.passport_no : null,
            passport_expiry: f.is_foreign ? f.passport_expiry : null,
            visa_no: f.is_foreign ? f.visa_no : null,
            visa_type: f.is_foreign ? f.visa_type : null,
            visa_expiry: f.is_foreign ? f.visa_expiry : null,
            arrived_india: f.is_foreign ? f.arrived_india : null,
            arriving_from: f.is_foreign ? f.arriving_from : null,
            next_destination: f.is_foreign ? f.next_destination : null,
            rules_accepted: true,
            lang: locale,
          }),
        });
        const data = (await r.json()) as SubmitResponse;
        if (!data.ok) {
          setPhase("idle");
          setSubmitError(
            data.error === "invalid_link"
              ? t("invalidBody")
              : data.error === "rate_limited"
                ? t("errRateLimited")
                : data.error === "invalid"
                  ? t("errInvalid")
                  : t("errServer"),
          );
          return;
        }
        res = data;
        setResult(data);
      } catch {
        setPhase("idle");
        setSubmitError(t("errNetwork"));
        return;
      }
    }
    await uploadAll(res);
  }

  const reset = () => {
    setF(EMPTY);
    setPhotos([null]);
    setErrors({});
    setResult(null);
    setUploaded([]);
    setPhase("idle");
    setFailInfo(null);
    setSubmitError(null);
    setSkippedPhotos(false);
    setCopied(false);
    setStep("welcome");
  };

  const copyWifi = async () => {
    if (!result?.wifi_password) return;
    try {
      await navigator.clipboard.writeText(result.wifi_password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: the password is visible on screen anyway
    }
  };

  const busy = phase === "sending" || phase === "uploading";
  const idLabel = (id: IdType) => t(`idTypes.${id}`);

  // ---------------- screens ----------------
  if (step === "welcome") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg">
        <header className="flex items-center justify-between px-5 pt-5">
          <BrandRow />
          <LangSwitch value={locale} onChange={setLocale} />
        </header>
        <section className="flex justify-center px-6 pt-8">
          <GuestTag tag={apartment.tag_colour} code={apartment.code} name={apartment.name} location={location} />
        </section>
        <section className="flex flex-col gap-2 px-6 pt-8">
          <h1 className="font-display text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">{t("welcomeTitle")}</h1>
          <p className="text-[15px] text-muted">{t("welcomeBody")}</p>
        </section>
        <section className="mx-4 mt-[18px] flex flex-col gap-3 rounded-[22px] bg-surface px-[18px] py-4">
          <span className="text-[13px] font-bold">{t("keepReady")}</span>
          <ReadyRow icon={<path d="M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2" />}>{t("readyPhone")}</ReadyRow>
          <ReadyRow icon={<path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM9 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM14 10h4M14 14h3" />}>{t("readyId")}</ReadyRow>
          <ReadyRow icon={<path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16" />}>{t("readyPassport")}</ReadyRow>
        </section>
        <span className="flex-1" />
        <div className="sticky bottom-0 flex flex-col gap-2.5 bg-bg px-4 pt-4 pb-safe">
          <BigButton onClick={goNext}>
            {t("start")} <ArrowIcon className="text-tag1" />
          </BigButton>
          <LockLine>{t("privacy")}</LockLine>
        </div>
      </main>
    );
  }

  if (step === "done" && result) {
    const out = f.check_out ? `${fmtDay(f.check_out, DATE_LOCALE[locale])}${result.check_out_time ? `, ${fmtTime(result.check_out_time)}` : ""}` : fmtTime(result.check_out_time);
    const wa = hostWhatsapp ? waLink(hostWhatsapp, t("hostMessage", { code: result.code || apartment.code, name: f.full_name.trim() })) : null;
    const isMango = apartment.tag_colour === "tag1";
    return (
      <main className={cn("mx-auto flex min-h-dvh w-full max-w-[480px] flex-col", tag.bg, tag.text)}>
        <div className="flex justify-end px-5 pt-5">
          <LangSwitch value={locale} onChange={setLocale} />
        </div>
        <section className="flex flex-col items-center gap-3.5 px-6 pt-8 text-center">
          <span className={cn("flex h-[88px] w-[88px] items-center justify-center rounded-full", isMango ? "bg-ink text-tag1" : "bg-tag1 text-tag1-ink")}>
            <CheckIcon size={44} />
          </span>
          <h1 className="mt-1.5 font-display text-[27px] font-extrabold leading-[1.15] tracking-[-0.03em]">
            {t("doneTitle", { name: f.full_name.trim().split(/\s+/)[0] ?? "" })}
          </h1>
          <p className="max-w-[30ch] text-[15px] opacity-90">{t("doneBody")}</p>
        </section>
        <section className="mx-4 mt-7 overflow-hidden rounded-[26px] bg-surface text-ink">
          <div className="grid grid-cols-2 gap-3 border-b border-line px-[18px] py-4">
            <span className="flex flex-col">
              <span className="text-[12px] text-muted">{t("apartment")}</span>
              <span className="font-display text-[18px] font-extrabold">{result.code || apartment.code}</span>
            </span>
            <span className="flex flex-col">
              <span className="text-[12px] text-muted">{t("checkOutLabel")}</span>
              <span className="tabular text-[15px] font-bold">{out}</span>
            </span>
          </div>
          {result.wifi_name || result.wifi_password ? (
            <div className="flex flex-col gap-2.5 border-b border-line px-[18px] py-3.5">
              <span className="flex items-center gap-2 text-[13px] font-bold">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" />
                </svg>
                {t("wifi")}
              </span>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-surface-2 px-3 py-2.5">
                {result.wifi_name ? (
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[11px] text-muted">{t("network")}</span>
                    <span className="break-all text-[14px] font-semibold">{result.wifi_name}</span>
                  </span>
                ) : null}
                {result.wifi_password ? (
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[11px] text-muted">{t("password")}</span>
                    <span className="break-all text-[14px] font-semibold">{result.wifi_password}</span>
                  </span>
                ) : null}
                {result.wifi_password ? (
                  <button type="button" onClick={copyWifi} className="min-h-11 px-1 text-[13px] font-bold text-accent" aria-live="polite">
                    {copied ? t("copied") : t("copy")}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 px-[18px] py-3.5">
            <span className="text-[13px] font-bold">{t("next")}</span>
            {[t("next1"), t("next2")].map((line, i) => (
              <span key={i} className="flex items-center gap-2.5 text-[14px]">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-tag1 text-[12px] font-extrabold text-tag1-ink">{i + 1}</span>
                {line}
              </span>
            ))}
            {skippedPhotos ? <p className="mt-1 rounded-[12px] bg-warn-soft px-3 py-2 text-[13px] font-medium text-warn">{t("photosSkippedNote")}</p> : null}
          </div>
        </section>
        <span className="flex-1" />
        <div className="flex flex-col gap-2.5 px-4 pt-6 pb-safe">
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex min-h-[58px] items-center justify-center gap-2.5 rounded-[20px] bg-ink px-5 text-[16px] font-bold text-surface">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
                <path d="M3 21l1.6-4.8A9 9 0 1 1 8 19.6z" />
              </svg>
              {t("messageHost")}
            </a>
          ) : null}
          <button type="button" onClick={reset} className="min-h-11 p-2 text-center text-[13.5px] underline-offset-2 opacity-90 hover:underline">
            {t("another")}
          </button>
        </div>
      </main>
    );
  }

  // Steps 2–5 share a header and a pinned bottom button.
  const current = step === "details" ? 1 : step === "rules" ? 3 : 2;
  const canGoBack = !result && !busy;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg">
      <header className="flex flex-col gap-3.5 px-4 pt-[18px]">
        <div className="flex items-center justify-between">
          {canGoBack ? (
            <button type="button" onClick={goBack} aria-label={t("back")} className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
          ) : (
            <span className="h-11 w-11" aria-hidden />
          )}
          <span className={cn("rounded-full px-3 py-1.5 text-[13px] font-semibold", tag.bg, tag.text)}>{apartment.code}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={current} aria-label={t("progress", { current })}>
          {[t("stepDetails"), t("stepId"), t("stepRules")].map((label, i) => (
            <span key={label} className={cn("flex flex-col gap-[5px] text-[11px]", i < current ? "font-bold text-ink" : "text-muted")}>
              <span className={cn("h-1.5 rounded-[6px]", i < current ? "bg-ink" : "bg-line")} />
              {label}
            </span>
          ))}
        </div>
        {step === "passport" ? (
          <div className="mx-1 mt-1 flex flex-col gap-1">
            <span className="text-[11.5px] font-bold tracking-[0.08em] text-accent">{t("foreignLabel")}</span>
            <h1 className="font-display text-[22px] font-extrabold tracking-[-0.03em]">{t("passportTitle")}</h1>
            <p className="text-[13.5px] text-muted">{t("passportBody")}</p>
          </div>
        ) : (
          <div className="mx-1 mt-1 flex flex-col gap-1">
            <h1 className="font-display text-[22px] font-extrabold tracking-[-0.03em]">
              {step === "details" ? t("detailsTitle") : step === "id" ? t("idTitle") : t("rulesTitle")}
            </h1>
            {step === "id" ? <p className="text-[13.5px] text-muted">{t("idBody")}</p> : null}
          </div>
        )}
      </header>

      {step === "details" ? (
        <form className="mx-4 mt-3.5 flex flex-col gap-3.5 rounded-[24px] bg-surface p-[18px]" onSubmit={(e) => { e.preventDefault(); goNext(); }} noValidate>
          <TextField
            label={t("fullName")}
            value={f.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            autoComplete="name"
            maxLength={120}
            error={errors.full_name}
          />
          <Field label={t("mobile")} htmlFor="g-phone" error={errors.phone}>
            <div className="flex gap-2">
              <Select aria-label={t("countryCode")} value={f.phone_code} onChange={(e) => set("phone_code", e.target.value)} className="w-[104px] flex-none font-semibold">
                {COUNTRY_CODES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Input
                id="g-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={f.phone}
                maxLength={24}
                onChange={(e) => set("phone", e.target.value)}
                aria-invalid={errors.phone ? true : undefined}
                className="min-w-0 flex-1"
              />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Counter label={t("adults")} value={f.adults} min={1} max={20} onChange={setAdults} />
            <Counter label={t("children")} value={f.children} min={0} max={20} onChange={(v) => set("children", v)} />
          </div>
          <TextField
            label={t("checkOut")}
            type="date"
            value={f.check_out}
            min={today}
            max={addDaysISO(today, 366)}
            onChange={(e) => set("check_out", e.target.value)}
            error={errors.check_out}
          />
          <div className="flex flex-col gap-1.5">
            <PillChoice
              label={t("nationality")}
              name="nationality"
              value={f.is_foreign === null ? "" : f.is_foreign ? "other" : "indian"}
              onChange={(v) => {
                const foreign = v === "other";
                set("is_foreign", foreign);
                set("id_type", foreign ? "passport" : f.id_type === "passport" ? "aadhaar" : f.id_type);
              }}
              options={[
                { value: "indian", label: t("indian") },
                { value: "other", label: t("otherCountry") },
              ]}
            />
            {errors.is_foreign ? <span role="alert" className="text-[12.5px] font-medium text-bad">{errors.is_foreign}</span> : null}
          </div>
          <button type="submit" className="sr-only" tabIndex={-1}>{t("continue")}</button>
        </form>
      ) : null}

      {step === "id" ? (
        <>
          <section className="mx-4 mt-3.5 flex flex-col gap-3.5 rounded-[24px] bg-surface p-4">
            <PillChoice
              label={t("idType")}
              name="id_type"
              value={f.id_type}
              onChange={(v) => set("id_type", v)}
              options={ID_TYPES.map((id) => ({ value: id, label: idLabel(id) }))}
            />
            {photos.map((p, i) => {
              const who = i === 0 && f.full_name.trim() ? t("adultNamed", { n: i + 1, name: f.full_name.trim() }) : t("adultN", { n: i + 1 });
              if (busySlot === i) {
                return (
                  <div key={i} className="flex min-h-[84px] items-center justify-center gap-3 rounded-[18px] bg-surface-2 p-2.5 text-[14px] font-semibold" aria-live="polite">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden />
                    {t("processing")}
                  </div>
                );
              }
              if (p) {
                return (
                  <div key={i} className="flex items-center gap-3 rounded-[18px] bg-surface-2 p-2.5">
                    <span aria-hidden className="flex h-16 w-[92px] flex-none flex-col justify-center gap-[5px] rounded-[10px] bg-line px-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className="h-6 w-5 rounded-[4px] bg-muted/40" />
                        <span className="flex flex-1 flex-col gap-1">
                          <span className="h-1 rounded-[2px] bg-muted/40" />
                          <span className="h-1 w-[70%] rounded-[2px] bg-muted/40" />
                        </span>
                      </span>
                      <span className="h-1 rounded-[2px] bg-muted/40" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[14px] font-bold">{who}</span>
                      <span className="flex items-center gap-1 text-[12.5px] font-semibold text-ok">
                        <CheckIcon /> {uploaded[i] ? t("photoSent") : t("photoAdded")}
                      </span>
                    </span>
                    {!uploaded[i] && !busy ? (
                      <button type="button" onClick={() => pickPhoto(i)} className="min-h-11 px-1.5 text-[13px] font-semibold text-accent">
                        {t("retake")}
                      </button>
                    ) : null}
                  </div>
                );
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickPhoto(i)}
                  disabled={busySlot !== null}
                  className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-line px-4 text-center"
                >
                  <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-tag1 text-tag1-ink" aria-hidden>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                      <path d="M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                    </svg>
                  </span>
                  <span className="text-[15px] font-bold">{t("takePhoto", { who: t("adultN", { n: i + 1 }) })}</span>
                  <span className="text-[12.5px] text-muted">{t("photoHint", { type: idLabel(f.id_type) })}</span>
                </button>
              );
            })}
            <ErrorBox>{errors.photos}</ErrorBox>
          </section>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <LockLine className="mx-6 mt-3 justify-start text-left">{t("photosPrivate")}</LockLine>
        </>
      ) : null}

      {step === "passport" ? (
        <form className="mx-4 mt-3.5 grid grid-cols-2 gap-3 rounded-[24px] bg-surface p-4" onSubmit={(e) => { e.preventDefault(); goNext(); }} noValidate>
          <TextField className="col-span-2" label={t("passportNationality")} value={f.nationality} maxLength={60} autoComplete="country-name" onChange={(e) => set("nationality", e.target.value)} error={errors.nationality} />
          <TextField className="min-w-0" label={t("passportNo")} value={f.passport_no} maxLength={30} autoCapitalize="characters" onChange={(e) => set("passport_no", e.target.value)} error={errors.passport_no} />
          <TextField className="min-w-0" label={t("passportExpiry")} type="date" value={f.passport_expiry} min={today} onChange={(e) => set("passport_expiry", e.target.value)} error={errors.passport_expiry} />
          <PillChoice
            className="col-span-2"
            label={t("visaType")}
            name="visa_type"
            value={f.visa_type}
            onChange={(v) => set("visa_type", v)}
            options={VISA_TYPES.map((v) => ({ value: v, label: t(`visaTypes.${v}`) }))}
          />
          <TextField className="min-w-0" label={t("visaNo")} placeholder={t("visaNoHint")} value={f.visa_no} maxLength={30} onChange={(e) => set("visa_no", e.target.value)} />
          <TextField className="min-w-0" label={t("visaExpiry")} type="date" value={f.visa_expiry} onChange={(e) => set("visa_expiry", e.target.value)} />
          <TextField className="min-w-0" label={t("arrivedIndia")} type="date" value={f.arrived_india} max={today} onChange={(e) => set("arrived_india", e.target.value)} error={errors.arrived_india} />
          <TextField className="min-w-0" label={t("arrivingFrom")} value={f.arriving_from} maxLength={80} onChange={(e) => set("arriving_from", e.target.value)} />
          <TextField className="col-span-2" label={t("nextDestination")} placeholder={t("nextDestinationHint")} value={f.next_destination} maxLength={80} onChange={(e) => set("next_destination", e.target.value)} />
          <button type="submit" className="sr-only" tabIndex={-1}>{t("continue")}</button>
        </form>
      ) : null}

      {step === "rules" ? (
        <>
          <section className="mx-4 mt-3.5 flex flex-col rounded-[24px] bg-surface px-4 py-1.5">
            {rules.length === 0 ? (
              <p className="py-3 text-[14.5px] text-muted">{t("noRules")}</p>
            ) : (
              rules.map((r, i) => (
                <div key={i} className={cn("flex items-center gap-3 py-[11px]", i < rules.length - 1 && "border-b border-bg")}>
                  <span className={cn("flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[12px] text-[14px] font-extrabold", RULE_TONES[i % RULE_TONES.length])} aria-hidden>
                    {i + 1}
                  </span>
                  <span lang="en" className="text-[14.5px]">{r}</span>
                </div>
              ))
            )}
          </section>
          <label className={cn("mx-4 mt-3.5 flex cursor-pointer items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5", f.rules ? "shadow-[inset_0_0_0_2px_var(--ink)]" : "shadow-[inset_0_0_0_2px_var(--line)]")}>
            <input type="checkbox" checked={f.rules} disabled={!!result} onChange={(e) => set("rules", e.target.checked)} className="h-6 w-6 flex-none accent-[var(--ink)]" />
            <span className="text-[14.5px] font-semibold">{t("agree")}</span>
          </label>
          <div className="mx-4 mt-3 flex flex-col gap-2">
            <ErrorBox>{errors.rules}</ErrorBox>
            <ErrorBox>{submitError}</ErrorBox>
            {phase === "failed" && failInfo ? (
              <div role="alert" className="flex flex-col gap-2 rounded-[16px] bg-bad-soft px-3.5 py-3 text-bad">
                <p className="text-[14px] font-semibold">
                  {t("errUpload", { count: failInfo.count })} {failInfo.fatal ? t("errUploadFatal") : t("errUploadRetry")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {!failInfo.fatal && result ? (
                    <button type="button" onClick={() => uploadAll(result)} className="min-h-11 rounded-[14px] bg-ink px-4 text-[14px] font-semibold text-surface">
                      {t("retryUpload")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setSkippedPhotos(true);
                      setPhase("idle");
                      setStep("done");
                    }}
                    className="min-h-11 rounded-[14px] bg-surface px-4 text-[14px] font-semibold text-ink"
                  >
                    {t("skipPhotos")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <span className="flex-1" />
      <div className="sticky bottom-0 flex flex-col gap-2 bg-bg px-4 pt-4 pb-safe">
        {busy ? (
          <p className="text-center text-[13px] font-medium text-muted" aria-live="polite">
            {phase === "sending" ? t("sending") : t("uploading", { current: progress.current, total: progress.total })}
          </p>
        ) : null}
        {step === "rules" ? (
          phase === "failed" ? null : (
            <BigButton variant="honey" onClick={complete} disabled={busy} busy={busy}>
              {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-tag1-ink/30 border-t-tag1-ink" aria-hidden /> : null}
              {t("complete")} {busy ? null : <ArrowIcon />}
            </BigButton>
          )
        ) : (
          <BigButton onClick={goNext} disabled={busySlot !== null}>
            {t("continue")} <ArrowIcon className="text-tag1" />
          </BigButton>
        )}
      </div>
    </main>
  );
}

function ReadyRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[14px]">
      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[11px] bg-surface-2" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      {children}
    </div>
  );
}
