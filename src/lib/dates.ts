import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { addDays, differenceInCalendarDays, parseISO, format } from "date-fns";

export const TZ = "Asia/Kolkata";

/** Today's date in Kochi as 'YYYY-MM-DD'. Pass `now` in tests. */
export function todayIST(now: Date = new Date()): string {
  return formatInTimeZone(now, TZ, "yyyy-MM-dd");
}

/** Current time in Kochi as 'HH:mm'. */
export function nowTimeIST(now: Date = new Date()): string {
  return formatInTimeZone(now, TZ, "HH:mm");
}

/** Add days to a 'YYYY-MM-DD' date string. */
export function addDaysISO(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), "yyyy-MM-dd");
}

/** Whole days from a to b (b − a) for 'YYYY-MM-DD' strings. */
export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

/** Nights in a stay. */
export const nights = (checkIn: string, checkOut: string) => Math.max(0, daysBetween(checkIn, checkOut));

/** Monday of the week containing iso. */
export function weekStart(iso: string): string {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  return format(addDays(d, -dow), "yyyy-MM-dd");
}

/** 'YYYY-MM' of a date string. */
export const monthKey = (iso: string) => iso.slice(0, 7);

/** e.g. "Tue 10 Nov" */
export function fmtDay(iso: string | null | undefined, locale = "en-IN"): string {
  if (!iso) return "—";
  return parseISO(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

/** e.g. "10 Nov 2026" */
export function fmtDate(iso: string | null | undefined, locale = "en-IN"): string {
  if (!iso) return "—";
  return parseISO(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

/** e.g. "Tuesday, 10 November" */
export function fmtLongDay(iso: string, locale = "en-IN"): string {
  return parseISO(iso).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}

/** "14:00:00" → "2 PM", "11:30" → "11:30 AM" */
export function fmtTime(t: string | null | undefined): string {
  if (!t) return "";
  const [hs, ms] = t.split(":");
  const h = Number(hs);
  const m = Number(ms ?? 0);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

/** Timestamp → Kochi date-time string. */
export function fmtStamp(ts: string | null | undefined): string {
  if (!ts) return "—";
  return formatInTimeZone(new Date(ts), TZ, "d MMM yyyy, h:mm a");
}

export function zoned(now: Date = new Date()) {
  return toZonedTime(now, TZ);
}

/** Month label, e.g. "November 2026" for '2026-11'. */
export function fmtMonth(ym: string, locale = "en-IN"): string {
  return parseISO(`${ym}-01`).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
