/**
 * Money maths for Finance, Expenses and the Today month summary (SPEC § 4.5).
 * Pure functions (no I/O) plus one data loader that takes a Supabase client.
 *
 * ── Public API ────────────────────────────────────────────────────────────────
 *
 *   monthSummary(month: string, data: FinanceData): MonthSummary
 *     month  'YYYY-MM' (Asia/Kolkata month, e.g. todayIST().slice(0, 7))
 *     data   { apartments, bookings, extras, expenses } — see FinanceData below.
 *            Bookings may include cancelled ones (they are ignored). Extras and
 *            expenses outside the month are ignored, so you can pass a wider range.
 *     → { month, nights, occupancy (0..1), gross, commission, net, extras,
 *         income (net + extras), expenses (ledger + petty out), profit }
 *
 *   loadFinanceData(supabase, fromMonth, toMonth): Promise<FinanceData>
 *     Fetches everything needed for months fromMonth..toMonth inclusive (RLS as the
 *     caller — owner only, because bookings/expenses are owner-only). Throws on error.
 *
 *   Example (Today page, server component):
 *     const ym = todayIST().slice(0, 7);
 *     const data = await loadFinanceData(await createClient(), ym, ym);
 *     const s = monthSummary(ym, data);   // s.occupancy, s.income, s.expenses, s.profit
 *
 *   Also: monthFinance (full breakdown), financeSeries (12-month bars), splitEven.
 *
 * ── Rules ─────────────────────────────────────────────────────────────────────
 * - Booking total and commission are spread evenly over the nights, in whole rupees;
 *   the remainder rupees go to the first nights, so the parts always add up exactly.
 *   A night belongs to the month of the date it starts on.
 * - Net = total − commission. Cancelled bookings never count.
 * - Extras income counts on each booking extra's own date; cancelled extras and
 *   extras of cancelled bookings never count.
 * - Expenses = expense ledger + petty cash 'out'. Rows with no apartment are split
 *   evenly across apartments (whole rupees, remainder to the first apartments).
 * - Occupancy = booked nights ÷ (days in month × apartments). Avg rate = gross ÷ nights.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingExtraStatus, BookingStatus, Channel } from "./types";
import { addDaysISO, addMonths, daysInMonth, nights as nightsBetween } from "./dates";

// ── Input types ──────────────────────────────────────────────────────────────

export interface FinApartment {
  id: string;
}

export interface FinBooking {
  id: string;
  apartment_id: string;
  channel: Channel | string;
  check_in: string;
  check_out: string;
  total: number;
  commission: number;
  status: BookingStatus;
}

export interface FinExtra {
  apartment_id: string;
  date: string;
  total: number;
  status: BookingExtraStatus;
  /** Status of the booking the extra belongs to (extras of cancelled bookings are ignored). */
  booking_status?: BookingStatus | null;
}

export interface FinExpense {
  date: string;
  amount: number;
  apartment_id: string | null;
  category: string;
  /** 'expense' = expense ledger, 'petty' = petty cash spend (type 'out'). */
  source: "expense" | "petty";
}

export interface FinanceData {
  apartments: FinApartment[];
  bookings: FinBooking[];
  extras: FinExtra[];
  expenses: FinExpense[];
}

// ── Output types ─────────────────────────────────────────────────────────────

export interface ApartmentMonth {
  apartment_id: string;
  nights: number;
  occupancy: number;
  gross: number;
  commission: number;
  net: number;
  extras: number;
  income: number;
  expenses: number;
  profit: number;
}

export interface ChannelMonth {
  channel: string;
  bookings: number;
  nights: number;
  gross: number;
  commission: number;
  net: number;
}

export interface CategoryMonth {
  source: "expense" | "petty";
  category: string;
  amount: number;
}

export interface MonthSummary {
  month: string;
  nights: number;
  occupancy: number;
  gross: number;
  commission: number;
  net: number;
  extras: number;
  income: number;
  expenses: number;
  profit: number;
}

export interface MonthFinance extends MonthSummary {
  days: number;
  apartmentCount: number;
  avgRate: number;
  expenseLedger: number;
  pettyOut: number;
  byApartment: ApartmentMonth[];
  byChannel: ChannelMonth[];
  byCategory: CategoryMonth[];
}

export interface SeriesPoint {
  month: string;
  income: number;
  expenses: number;
  profit: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Split a whole-rupee amount into `parts` whole-rupee pieces that add up exactly.
 * The remainder goes one rupee at a time to the first pieces.
 * splitEven(1001, 3) → [334, 334, 333]
 */
export function splitEven(amount: number, parts: number): number[] {
  if (parts <= 0) return [];
  const a = Math.round(amount || 0);
  const base = Math.floor(a / parts);
  let rem = a - base * parts; // 0 ≤ rem < parts
  const out: number[] = [];
  for (let i = 0; i < parts; i++) {
    out.push(base + (rem > 0 ? 1 : 0));
    if (rem > 0) rem--;
  }
  return out;
}

export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** First day 'YYYY-MM-01' and the first day of the next month (exclusive end). */
export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${addMonths(month, 1)}-01` };
}

/** Months from `from` to `to` inclusive, oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let m = from;
  for (let guard = 0; m <= to && guard < 600; guard++) {
    out.push(m);
    m = addMonths(m, 1);
  }
  return out;
}

interface NightPart {
  month: string;
  apartment_id: string;
  channel: string;
  booking_id: string;
  gross: number;
  commission: number;
}

const CHANNELS = new Set(["airbnb", "booking", "direct", "other"]);

/** Every booked night of the non-cancelled bookings, with its share of the money. */
export function nightParts(bookings: FinBooking[]): NightPart[] {
  const out: NightPart[] = [];
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const n = nightsBetween(b.check_in, b.check_out);
    if (n <= 0) continue;
    const g = splitEven(b.total, n);
    const c = splitEven(b.commission, n);
    const channel = CHANNELS.has(b.channel) ? b.channel : "other";
    for (let i = 0; i < n; i++) {
      out.push({
        month: addDaysISO(b.check_in, i).slice(0, 7),
        apartment_id: b.apartment_id,
        channel,
        booking_id: b.id,
        gross: g[i],
        commission: c[i],
      });
    }
  }
  return out;
}

const extraCounts = (x: FinExtra) => x.status !== "cancelled" && x.booking_status !== "cancelled";

// ── Month breakdown ──────────────────────────────────────────────────────────

/** Full breakdown for one month. Pass `parts` (from nightParts) to reuse work across months. */
export function monthFinance(month: string, data: FinanceData, parts?: NightPart[]): MonthFinance {
  const days = daysInMonth(month);
  const apts = data.apartments;
  const aptCount = apts.length;
  const nightsList = (parts ?? nightParts(data.bookings)).filter((p) => p.month === month);

  const byApt = new Map<string, ApartmentMonth>();
  for (const a of apts) {
    byApt.set(a.id, {
      apartment_id: a.id, nights: 0, occupancy: 0, gross: 0, commission: 0, net: 0,
      extras: 0, income: 0, expenses: 0, profit: 0,
    });
  }
  const byCh = new Map<string, ChannelMonth & { ids: Set<string> }>();

  let nights = 0;
  let gross = 0;
  let commission = 0;
  for (const p of nightsList) {
    nights++;
    gross += p.gross;
    commission += p.commission;
    const a = byApt.get(p.apartment_id);
    if (a) {
      a.nights++;
      a.gross += p.gross;
      a.commission += p.commission;
    }
    let ch = byCh.get(p.channel);
    if (!ch) {
      ch = { channel: p.channel, bookings: 0, nights: 0, gross: 0, commission: 0, net: 0, ids: new Set() };
      byCh.set(p.channel, ch);
    }
    ch.nights++;
    ch.gross += p.gross;
    ch.commission += p.commission;
    ch.ids.add(p.booking_id);
  }

  let extras = 0;
  for (const x of data.extras) {
    if (!x.date.startsWith(month) || !extraCounts(x)) continue;
    const t = Math.round(x.total || 0);
    extras += t;
    const a = byApt.get(x.apartment_id);
    if (a) a.extras += t;
  }

  let expenseLedger = 0;
  let pettyOut = 0;
  const cats = new Map<string, CategoryMonth>();
  for (const e of data.expenses) {
    if (!e.date.startsWith(month)) continue;
    const amt = Math.round(e.amount || 0);
    if (e.source === "petty") pettyOut += amt;
    else expenseLedger += amt;
    const key = `${e.source}:${e.category}`;
    const c = cats.get(key) ?? { source: e.source, category: e.category, amount: 0 };
    c.amount += amt;
    cats.set(key, c);
    const own = e.apartment_id ? byApt.get(e.apartment_id) : undefined;
    if (own) {
      own.expenses += amt;
    } else if (aptCount > 0) {
      // Shared (or unknown apartment): split evenly across apartments.
      const shares = splitEven(amt, aptCount);
      apts.forEach((a, i) => {
        byApt.get(a.id)!.expenses += shares[i];
      });
    }
  }

  const net = gross - commission;
  const income = net + extras;
  const expenses = expenseLedger + pettyOut;

  const byApartment = apts.map((a) => {
    const x = byApt.get(a.id)!;
    x.net = x.gross - x.commission;
    x.income = x.net + x.extras;
    x.profit = x.income - x.expenses;
    x.occupancy = days ? x.nights / days : 0;
    return x;
  });

  const byChannel = [...byCh.values()]
    .map(({ ids, ...c }) => ({ ...c, bookings: ids.size, net: c.gross - c.commission }))
    .sort((a, b) => b.gross - a.gross || a.channel.localeCompare(b.channel));

  const byCategory = [...cats.values()].sort((a, b) => b.amount - a.amount);

  return {
    month,
    days,
    apartmentCount: aptCount,
    nights,
    occupancy: aptCount ? nights / (days * aptCount) : 0,
    gross,
    commission,
    net,
    extras,
    income,
    expenses,
    expenseLedger,
    pettyOut,
    profit: income - expenses,
    avgRate: nights ? Math.round(gross / nights) : 0,
    byApartment,
    byChannel,
    byCategory,
  };
}

/** This month's headline numbers (used by the Today page). */
export function monthSummary(month: string, data: FinanceData): MonthSummary {
  const f = monthFinance(month, data);
  return {
    month: f.month,
    nights: f.nights,
    occupancy: f.occupancy,
    gross: f.gross,
    commission: f.commission,
    net: f.net,
    extras: f.extras,
    income: f.income,
    expenses: f.expenses,
    profit: f.profit,
  };
}

/** `count` months ending with `endMonth` (oldest first): net income incl. extras vs expenses. */
export function financeSeries(endMonth: string, count: number, data: FinanceData): SeriesPoint[] {
  const parts = nightParts(data.bookings);
  const out: SeriesPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const m = addMonths(endMonth, -i);
    const f = monthFinance(m, data, parts);
    out.push({ month: m, income: f.income, expenses: f.expenses, profit: f.profit });
  }
  return out;
}

// ── Data loader ──────────────────────────────────────────────────────────────

/**
 * Load bookings, extras, expenses and petty spends touching fromMonth..toMonth (inclusive).
 * Uses the caller's client (RLS applies — owner only). Throws on any database error.
 */
export async function loadFinanceData(supabase: SupabaseClient, fromMonth: string, toMonth: string): Promise<FinanceData> {
  const start = monthRange(fromMonth).start;
  const end = monthRange(toMonth).end;
  const [apts, bookings, extras, expenses, petty] = await Promise.all([
    supabase.from("beehive_apartments").select("id").order("sort"),
    supabase
      .from("beehive_bookings")
      .select("id,apartment_id,channel,check_in,check_out,total,commission,status")
      .neq("status", "cancelled")
      .lt("check_in", end)
      .gt("check_out", start),
    supabase
      .from("beehive_booking_extras")
      .select("date,total,status,booking:beehive_bookings!inner(apartment_id,status)")
      .neq("status", "cancelled")
      .gte("date", start)
      .lt("date", end),
    supabase.from("beehive_expenses").select("date,amount,apartment_id,category").gte("date", start).lt("date", end),
    supabase.from("beehive_petty").select("date,amount,apartment_id,category").eq("type", "out").gte("date", start).lt("date", end),
  ]);
  for (const r of [apts, bookings, extras, expenses, petty]) if (r.error) throw r.error;

  type ExtraRow = {
    date: string;
    total: number | null;
    status: BookingExtraStatus;
    booking: { apartment_id: string; status: BookingStatus } | { apartment_id: string; status: BookingStatus }[] | null;
  };
  type MoneyRow = { date: string; amount: number; apartment_id: string | null; category: string };

  return {
    apartments: (apts.data ?? []) as FinApartment[],
    bookings: (bookings.data ?? []) as FinBooking[],
    extras: ((extras.data ?? []) as ExtraRow[]).flatMap((x) => {
      const b = Array.isArray(x.booking) ? x.booking[0] : x.booking;
      if (!b) return [];
      return [{ apartment_id: b.apartment_id, booking_status: b.status, date: x.date, total: x.total ?? 0, status: x.status }];
    }),
    expenses: [
      ...((expenses.data ?? []) as MoneyRow[]).map((e) => ({ ...e, source: "expense" as const })),
      ...((petty.data ?? []) as MoneyRow[]).map((e) => ({ ...e, source: "petty" as const })),
    ],
  };
}
