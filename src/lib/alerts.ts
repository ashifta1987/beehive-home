/**
 * Owner alerts for Today and the daily digest (SPEC § 4.2), apartment key-tag status and
 * Form C grouping. The maths are pure functions (no I/O) so they are unit-tested; the
 * loaders take a Supabase client (owner session or the cron's admin client).
 *
 * ── Public API ────────────────────────────────────────────────────────────────
 *   computeAlerts(data: AlertData, today: string, t?: AlertTranslate): Alert[]
 *     Every alert of SPEC § 4.2, red first then amber, each group in spec order.
 *     `today` is todayIST(). `t` translates message keys (defaults to English).
 *   loadAlertData(supabase, today): Promise<AlertData>     — throws on a DB error.
 *   aptStatus(apartmentId, bookings, tasks, today): AptStatus — key tag status.
 *   formCGroup(booking, submitted, today): "due" | "soon" | "submitted"
 *   countOwnerBadges(supabase, today): { alerts, formc }  — cheap counts for the nav.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Alert,
  Booking,
  BookingExtra,
  Issue,
  Laundry,
  Licence,
  Schedule,
  Task,
} from "./types";
import { addDaysISO, daysBetween, fmtDay, fmtTime } from "./dates";
import { inr } from "./money";
import { guestKey } from "./guest";
import { careNextDue } from "./care";

// ── Input types (only the columns the rules need) ───────────────────────────

export type AlertApartment = { id: string; code: string; name: string; tag_colour: string };
export type AlertBooking = Pick<
  Booking,
  | "id" | "apartment_id" | "guest_name" | "phone" | "email" | "check_in" | "check_out"
  | "check_in_time" | "check_out_time" | "payment_status" | "deposit_status" | "status"
  | "id_verified" | "foreign_national"
>;
export type AlertTask = Pick<
  Task,
  "id" | "kind" | "apartment_id" | "booking_id" | "date" | "status" | "next_arrival" | "next_arrival_time"
>;
export type AlertIssue = Pick<Issue, "id" | "apartment_id" | "category" | "priority" | "status" | "booking_id" | "text">;
export type AlertSchedule = Pick<Schedule, "id" | "name" | "apartment_id" | "last_done" | "every_days">;
export type AlertLicence = Pick<Licence, "id" | "name" | "apartment_id" | "expires" | "remind_days">;
export type AlertLaundry = Pick<Laundry, "id" | "apartment_id" | "sent_date" | "returned_date">;
export type AlertExtra = Pick<BookingExtra, "booking_id" | "name" | "status" | "paid" | "total">;

export interface AlertData {
  apartments: AlertApartment[];
  /** Non-cancelled bookings (cancelled ones are ignored if passed). */
  bookings: AlertBooking[];
  /** booking ids whose Form C is submitted */
  formCSubmitted: string[];
  /** guest keys (see guestKey) tagged `blocked` */
  blockedKeys: string[];
  tasks: AlertTask[];
  issues: AlertIssue[];
  schedules: AlertSchedule[];
  licences: AlertLicence[];
  laundry: AlertLaundry[];
  /** Petty cash balance, or null when there are no petty cash entries at all. */
  pettyBalance: number | null;
  extras: AlertExtra[];
}

// ── Messages ────────────────────────────────────────────────────────────────

/** English defaults. The same keys live in messages/<locale>/today.json under "alerts". */
export const ALERT_EN = {
  "label.formc": "FORM C",
  "label.blocked": "BLOCKED",
  "label.cleaning": "CLEANING",
  "label.urgent": "URGENT",
  "label.missing": "MISSING",
  "label.licence": "LICENCE",
  "label.id": "ID",
  "label.payment": "PAYMENT",
  "label.deposit": "DEPOSIT",
  "label.turnover": "TURNOVER",
  "label.care": "CARE",
  "label.laundry": "LAUNDRY",
  "label.petty": "PETTY CASH",
  "label.extras": "EXTRAS",
  "label.charge": "CHARGE",
  formc: "Form C not submitted for {guest} ({apt}, arrives {date}). Submit it within 24 hours of arrival.",
  blocked: "{guest} is tagged \"Do not host\" and has a booking in {apt} from {date}.",
  cleaning: "Cleaning in {apt} not marked done since {date}.",
  urgentIssue: "Urgent in {apt}: {text}",
  missingIssue: "Missing items reported in {apt}: {text}",
  licenceExpired: "{name} expired on {date}. Renew it.",
  idNotVerified: "ID not verified for {guest} ({apt}, {date}).",
  paymentPending: "Payment pending for {guest} ({apt}, arrives {date}).",
  paymentPartial: "Part payment only from {guest} ({apt}, arrives {date}). Collect the rest.",
  deposit: "Security deposit still held for {guest} who left {date}. Refund or deduct it.",
  sameDay: "Same-day turnover in {apt}: next guests arrive {time}.",
  careOverdue: "{count, plural, one {# periodic care item} other {# periodic care items}} overdue: {names}.",
  licenceSoon: "{name} expires on {date} ({days, plural, one {# day} other {# days}} left). Start the renewal.",
  laundryLate: "{count, plural, one {# laundry batch} other {# laundry batches}} out for more than 4 days.",
  pettyNegative: "Petty cash is {amount}. Top it up.",
  extrasRequested: "Confirm extras for {guest} ({apt}, {date}): {names}.",
  extrasUnpaid: "{amount} in extras or charges not yet paid by {guest}.",
  chargeDecide: "{guest} left the room messy or damaged ({apt}). Decide whether to charge.",
  someone: "the guest",
  bothApts: "both apartments",
} as const;

export type AlertKey = keyof typeof ALERT_EN;
export type AlertValues = Record<string, string | number>;
export type AlertTranslate = (key: AlertKey, values?: AlertValues) => string;

/** Minimal ICU-ish formatter for the English defaults ({x} and {n, plural, one {..} other {..}}). */
export function formatEn(key: AlertKey, values: AlertValues = {}): string {
  let s: string = ALERT_EN[key];
  s = s.replace(/\{(\w+), plural, one \{([^}]*)\} other \{([^}]*)\}\}/g, (_m, k: string, one: string, other: string) => {
    const n = Number(values[k] ?? 0);
    return (n === 1 ? one : other).replace(/#/g, String(n));
  });
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

// ── Rules ───────────────────────────────────────────────────────────────────

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (v: string | null | undefined): v is string => !!v && ISO.test(v);

/** "Due" until submitted once the stay starts tomorrow or earlier; "soon" before that. */
export function formCGroup(b: Pick<Booking, "check_in">, submitted: boolean, today: string): "due" | "soon" | "submitted" {
  if (submitted) return "submitted";
  return b.check_in <= addDaysISO(today, 1) ? "due" : "soon";
}

/** Form C red alert window: the stay touches [yesterday … tomorrow]. */
export function formCAlertDue(b: Pick<Booking, "check_in" | "check_out">, today: string): boolean {
  return b.check_in <= addDaysISO(today, 1) && b.check_out >= addDaysISO(today, -1);
}

export type LicenceState = "none" | "expired" | "expiring" | "valid";
export function licenceStatus(l: Pick<Licence, "expires" | "remind_days">, today: string): { state: LicenceState; days: number | null } {
  if (!isIso(l.expires)) return { state: "none", days: null };
  const days = daysBetween(today, l.expires);
  if (days < 0) return { state: "expired", days };
  const remind = Number.isFinite(l.remind_days) && l.remind_days >= 0 ? l.remind_days : 60;
  if (days <= remind) return { state: "expiring", days };
  return { state: "valid", days };
}

export function computeAlerts(data: AlertData, today: string, t: AlertTranslate = formatEn): Alert[] {
  const T = today;
  const apts = new Map(data.apartments.map((a) => [a.id, a]));
  const aptLabel = (id: string | null | undefined) => (id ? (apts.get(id)?.code ?? id) : t("bothApts"));
  const guest = (name: string | null | undefined) => (name && name.trim() ? name.trim() : t("someone"));
  const submitted = new Set(data.formCSubmitted);
  const blocked = new Set(data.blockedKeys);
  const bookings = data.bookings.filter((b) => b.status !== "cancelled");
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const open = (id: string) => `/bookings?open=${encodeURIComponent(id)}`;

  const red: Alert[] = [];
  const amber: Alert[] = [];

  // RED 1 · Form C
  for (const b of bookings) {
    if (b.foreign_national && !submitted.has(b.id) && formCAlertDue(b, T)) {
      red.push({
        level: "bad",
        label: t("label.formc"),
        text: t("formc", { guest: guest(b.guest_name), apt: aptLabel(b.apartment_id), date: fmtDay(b.check_in) }),
        href: `/foreign?open=${encodeURIComponent(b.id)}`,
        apartment_id: b.apartment_id,
      });
    }
  }
  // RED 2 · blocked guest with a current or future booking
  for (const b of bookings) {
    if (b.check_out >= T && b.status !== "checked_out" && blocked.has(guestKey(b))) {
      red.push({
        level: "bad",
        label: t("label.blocked"),
        text: t("blocked", { guest: guest(b.guest_name), apt: aptLabel(b.apartment_id), date: fmtDay(b.check_in) }),
        href: open(b.id),
        apartment_id: b.apartment_id,
      });
    }
  }
  // RED 3 · turnover not done, dated before today
  for (const k of data.tasks) {
    if (k.kind === "turnover" && k.status !== "done" && k.date < T) {
      red.push({
        level: "bad",
        label: t("label.cleaning"),
        text: t("cleaning", { apt: aptLabel(k.apartment_id), date: fmtDay(k.date) }),
        href: "/jobs",
        apartment_id: k.apartment_id,
      });
    }
  }
  // RED 4 · open urgent / missing issues
  for (const i of data.issues) {
    if (i.status !== "open") continue;
    if (i.category === "missing") {
      red.push({ level: "bad", label: t("label.missing"), text: t("missingIssue", { apt: aptLabel(i.apartment_id), text: clip(i.text) }), href: "/maintenance", apartment_id: i.apartment_id });
    } else if (i.priority === "urgent") {
      red.push({ level: "bad", label: t("label.urgent"), text: t("urgentIssue", { apt: aptLabel(i.apartment_id), text: clip(i.text) }), href: "/maintenance", apartment_id: i.apartment_id });
    }
  }
  // RED 5 · licence expired
  for (const l of data.licences) {
    if (licenceStatus(l, T).state === "expired") {
      red.push({ level: "bad", label: t("label.licence"), text: t("licenceExpired", { name: l.name, date: fmtDay(l.expires) }), href: "/licences", apartment_id: l.apartment_id });
    }
  }

  // AMBER 1 · ID not verified for a stay that starts by tomorrow and has not ended
  for (const b of bookings) {
    if (!b.id_verified && b.status !== "checked_out" && b.check_in <= addDaysISO(T, 1) && b.check_out >= T) {
      amber.push({ level: "warn", label: t("label.id"), text: t("idNotVerified", { guest: guest(b.guest_name), apt: aptLabel(b.apartment_id), date: fmtDay(b.check_in) }), href: open(b.id), apartment_id: b.apartment_id });
    }
  }
  // AMBER 2 · payment pending/partial with check-in within 3 days (or already started)
  for (const b of bookings) {
    if ((b.payment_status === "pending" || b.payment_status === "partial") && b.check_in <= addDaysISO(T, 3)) {
      amber.push({
        level: "warn",
        label: t("label.payment"),
        text: t(b.payment_status === "pending" ? "paymentPending" : "paymentPartial", { guest: guest(b.guest_name), apt: aptLabel(b.apartment_id), date: fmtDay(b.check_in) }),
        href: open(b.id),
        apartment_id: b.apartment_id,
      });
    }
  }
  // AMBER 3 · deposit held more than 2 days after check-out
  for (const b of bookings) {
    if (b.deposit_status === "held" && daysBetween(b.check_out, T) > 2) {
      amber.push({ level: "warn", label: t("label.deposit"), text: t("deposit", { guest: guest(b.guest_name), date: fmtDay(b.check_out) }), href: open(b.id), apartment_id: b.apartment_id });
    }
  }
  // AMBER 4 · same-day turnover today
  for (const k of data.tasks) {
    if (k.kind === "turnover" && k.status !== "done" && k.date === T && k.next_arrival === T) {
      amber.push({ level: "warn", label: t("label.turnover"), text: t("sameDay", { apt: aptLabel(k.apartment_id), time: fmtTime(k.next_arrival_time) || fmtTime("14:00") }), href: "/jobs", apartment_id: k.apartment_id });
    }
  }
  // AMBER 5 · periodic care overdue (one row)
  const overdue = data.schedules.filter((s) => {
    const next = careNextDue(s.last_done, s.every_days);
    return next != null && next < T;
  });
  if (overdue.length) {
    const names = overdue.slice(0, 3).map((s) => `${s.name}${s.apartment_id ? ` (${aptLabel(s.apartment_id)})` : ""}`).join(", ") + (overdue.length > 3 ? "…" : "");
    amber.push({ level: "warn", label: t("label.care"), text: t("careOverdue", { count: overdue.length, names }), href: "/care", apartment_id: null });
  }
  // AMBER 6 · licence expiring within remind_days
  for (const l of data.licences) {
    const st = licenceStatus(l, T);
    if (st.state === "expiring") {
      amber.push({ level: "warn", label: t("label.licence"), text: t("licenceSoon", { name: l.name, date: fmtDay(l.expires), days: st.days ?? 0 }), href: "/licences", apartment_id: l.apartment_id });
    }
  }
  // AMBER 7 · laundry out more than 4 days (one row)
  const late = data.laundry.filter((l) => !l.returned_date && isIso(l.sent_date) && daysBetween(l.sent_date, T) > 4);
  if (late.length) amber.push({ level: "warn", label: t("label.laundry"), text: t("laundryLate", { count: late.length }), href: "/laundry", apartment_id: null });
  // AMBER 8 · petty cash below zero
  if (data.pettyBalance != null && data.pettyBalance < 0) {
    amber.push({ level: "warn", label: t("label.petty"), text: t("pettyNegative", { amount: inr(data.pettyBalance) }), href: "/petty", apartment_id: null });
  }
  // AMBER 9 + 10 · booking extras
  const extrasByBooking = new Map<string, AlertExtra[]>();
  for (const x of data.extras) {
    if (x.status === "cancelled") continue;
    const list = extrasByBooking.get(x.booking_id) ?? [];
    list.push(x);
    extrasByBooking.set(x.booking_id, list);
  }
  const unpaidRows: Alert[] = [];
  for (const b of bookings) {
    const xs = extrasByBooking.get(b.id);
    if (!xs?.length) continue;
    const req = xs.filter((x) => x.status === "requested");
    if (req.length && b.check_in <= addDaysISO(T, 2) && b.check_out >= T) {
      amber.push({ level: "warn", label: t("label.extras"), text: t("extrasRequested", { guest: guest(b.guest_name), apt: aptLabel(b.apartment_id), date: fmtDay(b.check_in), names: req.map((x) => x.name).join(", ") }), href: open(b.id), apartment_id: b.apartment_id });
    }
    const unpaid = xs.filter((x) => !x.paid).reduce((s, x) => s + (Number(x.total) || 0), 0);
    if (unpaid > 0 && b.check_out <= T) {
      unpaidRows.push({ level: "warn", label: t("label.extras"), text: t("extrasUnpaid", { amount: inr(unpaid), guest: guest(b.guest_name) }), href: open(b.id), apartment_id: b.apartment_id });
    }
  }
  amber.push(...unpaidRows);
  // AMBER 11 · open mess/damage issue linked to a booking
  for (const i of data.issues) {
    if (i.status === "open" && (i.category === "mess" || i.category === "damage") && i.booking_id) {
      const b = bookingById.get(i.booking_id);
      amber.push({ level: "warn", label: t("label.charge"), text: t("chargeDecide", { guest: guest(b?.guest_name), apt: aptLabel(i.apartment_id ?? b?.apartment_id) }), href: "/maintenance", apartment_id: i.apartment_id ?? b?.apartment_id ?? null });
    }
  }

  return [...red, ...amber];
}

function clip(s: string, n = 90): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n - 1) + "…" : one;
}

// ── Apartment key tag status ───────────────────────────────────────────────

export type AptState = "turnover" | "arriving" | "checking_out" | "occupied" | "needs_cleaning" | "ready";
export type StatusBooking = Pick<Booking, "id" | "apartment_id" | "guest_name" | "check_in" | "check_out" | "check_in_time" | "check_out_time" | "status" | "channel" | "adults" | "children">;
export type StatusTask = Pick<Task, "id" | "kind" | "apartment_id" | "booking_id" | "date" | "status" | "checks">;

export interface AptStatus {
  state: AptState;
  /** Guest staying tonight (checked in before today, leaving after today). */
  inHouse: StatusBooking | null;
  /** Booking that checks out today. */
  leaving: StatusBooking | null;
  /** Booking that checks in today. */
  arriving: StatusBooking | null;
  /** Next booking that starts after today. */
  next: StatusBooking | null;
  /** Oldest turnover job not done, dated today or earlier. */
  cleaning: StatusTask | null;
}

export function aptStatus(apartmentId: string, bookings: StatusBooking[], tasks: StatusTask[], today: string): AptStatus {
  const T = today;
  const bs = bookings
    .filter((b) => b.apartment_id === apartmentId && b.status !== "cancelled")
    .sort((a, b) => (a.check_in < b.check_in ? -1 : a.check_in > b.check_in ? 1 : 0));
  const leaving = bs.find((b) => b.check_out === T) ?? null;
  const arriving = bs.find((b) => b.check_in === T) ?? null;
  const inHouse = bs.find((b) => b.check_in < T && T < b.check_out) ?? null;
  const next = bs.find((b) => b.check_in > T) ?? null;
  const cleaning =
    tasks
      .filter((k) => k.apartment_id === apartmentId && k.kind === "turnover" && k.status !== "done" && k.date <= T)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))[0] ?? null;

  let state: AptState;
  if (leaving && arriving) state = "turnover";
  else if (arriving) state = "arriving";
  else if (leaving) {
    // Guest leaves today: once the turnover job is done the flat is ready again.
    const turn = tasks.find((k) => k.kind === "turnover" && k.booking_id === leaving.id);
    state = turn && turn.status === "done" && !cleaning ? "ready" : "checking_out";
  } else if (inHouse) state = "occupied";
  else if (cleaning) state = "needs_cleaning";
  else state = "ready";

  return { state, inHouse, leaving, arriving, next, cleaning };
}

// ── Loaders ─────────────────────────────────────────────────────────────────

/** How far back to look for bookings that can still raise an alert (deposits, unpaid). */
const BOOKING_LOOKBACK_DAYS = 120;

/** Fetch everything computeAlerts needs. Works with the owner client or the admin client. */
export async function loadAlertData(supabase: SupabaseClient, today: string): Promise<AlertData> {
  const from = addDaysISO(today, -BOOKING_LOOKBACK_DAYS);
  const [apts, bookings, profiles, tasks, issues, schedules, licences, laundry, petty] = await Promise.all([
    supabase.from("beehive_apartments").select("id, code, name, tag_colour").order("sort"),
    supabase
      .from("beehive_bookings")
      .select(
        "id, apartment_id, guest_name, phone, email, check_in, check_out, check_in_time, check_out_time, payment_status, deposit_status, status, id_verified, foreign_national, beehive_foreign_records(form_c_submitted), beehive_booking_extras(booking_id, name, status, paid, total)",
      )
      .neq("status", "cancelled")
      .or(`check_out.gte.${from},deposit_status.eq.held,payment_status.in.(pending,partial)`)
      .limit(2000),
    supabase.from("beehive_guest_profiles").select("key").eq("tag", "blocked"),
    supabase
      .from("beehive_tasks")
      .select("id, kind, apartment_id, booking_id, date, status, next_arrival, next_arrival_time")
      .eq("kind", "turnover")
      .neq("status", "done")
      .lte("date", today),
    supabase.from("beehive_issues").select("id, apartment_id, category, priority, status, booking_id, text").eq("status", "open"),
    supabase.from("beehive_schedules").select("id, name, apartment_id, last_done, every_days"),
    supabase.from("beehive_licences").select("id, name, apartment_id, expires, remind_days").not("expires", "is", null),
    supabase.from("beehive_laundry").select("id, apartment_id, sent_date, returned_date").is("returned_date", null),
    supabase.from("beehive_petty").select("type, amount"),
  ]);
  for (const r of [apts, bookings, profiles, tasks, issues, schedules, licences, laundry, petty]) if (r.error) throw r.error;

  type Row = AlertBooking & {
    beehive_foreign_records: { form_c_submitted: boolean } | { form_c_submitted: boolean }[] | null;
    beehive_booking_extras: AlertExtra[] | null;
  };
  const rows = (bookings.data ?? []) as unknown as Row[];
  const formCSubmitted: string[] = [];
  const extras: AlertExtra[] = [];
  const plain: AlertBooking[] = rows.map((r) => {
    const { beehive_foreign_records: fr, beehive_booking_extras: bx, ...b } = r;
    const rec = Array.isArray(fr) ? fr[0] : fr;
    if (rec?.form_c_submitted) formCSubmitted.push(b.id);
    if (bx) extras.push(...bx);
    return b;
  });
  const pettyRows = (petty.data ?? []) as { type: "in" | "out"; amount: number }[];

  return {
    apartments: (apts.data ?? []) as AlertApartment[],
    bookings: plain,
    formCSubmitted,
    blockedKeys: ((profiles.data ?? []) as { key: string }[]).map((p) => p.key),
    tasks: (tasks.data ?? []) as AlertTask[],
    issues: (issues.data ?? []) as AlertIssue[],
    schedules: (schedules.data ?? []) as AlertSchedule[],
    licences: (licences.data ?? []) as AlertLicence[],
    laundry: (laundry.data ?? []) as AlertLaundry[],
    pettyBalance: pettyRows.length ? pettyRows.reduce((s, e) => s + (e.type === "in" ? 1 : -1) * (Number(e.amount) || 0), 0) : null,
    extras,
  };
}

/**
 * Nav bubbles for the owner: `alerts` = number of red alerts, `formc` = Form C due.
 * Small queries only; never throws (a failed count shows no bubble).
 */
export async function countOwnerBadges(supabase: SupabaseClient, today: string): Promise<{ alerts: number; formc: number }> {
  try {
    const tomorrow = addDaysISO(today, 1);
    const yesterday = addDaysISO(today, -1);
    const [turn, issues, lic, foreign, profiles, current] = await Promise.all([
      supabase.from("beehive_tasks").select("id", { count: "exact", head: true }).eq("kind", "turnover").neq("status", "done").lt("date", today),
      supabase.from("beehive_issues").select("id", { count: "exact", head: true }).eq("status", "open").or("priority.eq.urgent,category.eq.missing"),
      supabase.from("beehive_licences").select("id", { count: "exact", head: true }).lt("expires", today),
      supabase
        .from("beehive_bookings")
        .select("id, check_in, check_out, beehive_foreign_records(form_c_submitted)")
        .eq("foreign_national", true)
        .neq("status", "cancelled")
        .lte("check_in", tomorrow)
        .limit(1000),
      supabase.from("beehive_guest_profiles").select("key").eq("tag", "blocked"),
      supabase
        .from("beehive_bookings")
        .select("phone, email, guest_name")
        .neq("status", "cancelled")
        .neq("status", "checked_out")
        .gte("check_out", today)
        .limit(1000),
    ]);
    type F = { id: string; check_in: string; check_out: string; beehive_foreign_records: { form_c_submitted: boolean } | { form_c_submitted: boolean }[] | null };
    const notSubmitted = ((foreign.data ?? []) as unknown as F[]).filter((b) => {
      const r = Array.isArray(b.beehive_foreign_records) ? b.beehive_foreign_records[0] : b.beehive_foreign_records;
      return !r?.form_c_submitted;
    });
    const formc = notSubmitted.length; // all have check_in <= tomorrow → "due"
    const formcRed = notSubmitted.filter((b) => b.check_out >= yesterday).length;
    const blocked = new Set(((profiles.data ?? []) as { key: string }[]).map((p) => p.key));
    const blockedCount = blocked.size
      ? ((current.data ?? []) as Pick<Booking, "phone" | "email" | "guest_name">[]).filter((b) => blocked.has(guestKey(b))).length
      : 0;
    const alerts = formcRed + blockedCount + (turn.count ?? 0) + (issues.count ?? 0) + (lic.count ?? 0);
    return { alerts, formc };
  } catch {
    return { alerts: 0, formc: 0 };
  }
}
