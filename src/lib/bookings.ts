// Pure booking logic (no server or browser APIs) so it can be unit-tested and used on
// both sides: guest identity, list filters, the commission "%" helper, the paid-extras
// availability check, the guest index and the CSV writer.
import type { Booking, BookingExtraStatus, BookingStatus, Channel, GuestProfile, Issue } from "./types";
import { guestKey } from "./guest";
import { nights } from "./dates";

export { guestKey };

/* ---------- list filters ---------- */

export type BookingFilter = "current" | "past" | "cancelled" | "all";
export const BOOKING_FILTERS: BookingFilter[] = ["current", "past", "cancelled", "all"];

type FilterRow = Pick<Booking, "status" | "check_in" | "check_out" | "guest_name" | "phone" | "email" | "channel_ref">;

/** Does a booking belong in the chosen tab? `today` is the Kochi date. */
export function inFilter(b: FilterRow, filter: BookingFilter, today: string): boolean {
  switch (filter) {
    case "current":
      return b.status !== "cancelled" && b.check_out >= today;
    case "past":
      return b.status !== "cancelled" && b.check_out < today;
    case "cancelled":
      return b.status === "cancelled";
    default:
      return true;
  }
}

/** Search on guest name, phone (digits match too), email and booking reference. */
export function matchesSearch(b: FilterRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${b.guest_name} ${b.phone ?? ""} ${b.email ?? ""} ${b.channel_ref ?? ""}`.toLowerCase();
  if (hay.includes(q)) return true;
  const qd = q.replace(/\D/g, "");
  if (qd.length >= 3) {
    const pd = (b.phone ?? "").replace(/\D/g, "");
    if (pd.includes(qd)) return true;
  }
  return false;
}

/** Filter + sort: upcoming soonest first, everything else newest first. */
export function filterBookings<T extends FilterRow>(rows: T[], filter: BookingFilter, query: string, today: string): T[] {
  const out = rows.filter((b) => inFilter(b, filter, today) && matchesSearch(b, query));
  out.sort((a, b) =>
    filter === "current"
      ? a.check_in.localeCompare(b.check_in)
      : b.check_in.localeCompare(a.check_in),
  );
  return out;
}

/** May the booking be checked in / out today? */
export const canCheckIn = (b: Pick<Booking, "status" | "check_in" | "check_out">, today: string) =>
  b.status === "confirmed" && b.check_in <= today && b.check_out >= today;
export const canCheckOut = (b: Pick<Booking, "status">) => b.status === "checked_in";

/* ---------- commission helper ---------- */

/**
 * Read what the owner typed in the commission box. "15%" means 15 % of the total;
 * a plain number is rupees. Returns null when the text is not a number.
 */
export function parseCommission(input: string, total: number): { amount: number; pct: number | null } | null {
  const s = input.replace(/[₹,\s]/g, "");
  if (s === "") return { amount: 0, pct: null };
  if (s.endsWith("%")) {
    const pct = Number(s.slice(0, -1));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
    return { amount: Math.round((Math.max(0, total) * pct) / 100), pct };
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return { amount: Math.round(n), pct: null };
}

/* ---------- paid extras availability ---------- */

export interface StayLite {
  id: string;
  apartment_id: string;
  check_in: string;
  check_out: string;
  status: BookingStatus;
}
export interface ExtraUse {
  booking_id: string;
  extra_id: string | null;
  qty: number;
  status: BookingExtraStatus;
}
export interface CatalogStock {
  id: string;
  name: string;
  qty: number | null;
}
export interface DraftExtra {
  extra_id: string | null;
  qty: number;
  status: BookingExtraStatus;
}
export interface Shortfall {
  extraId: string;
  name: string;
  /** how many the owner has */
  stock: number;
  /** already taken by other guests whose stays overlap */
  used: number;
  /** asked for on this booking */
  wanted: number;
}

const overlaps = (aIn: string, aOut: string, bIn: string, bOut: string) => aIn < bOut && bIn < aOut;

/** Units of a catalog extra taken by OTHER non-cancelled bookings that overlap the stay. */
export function extraUsed(
  extraId: string,
  stay: { id?: string | null; check_in: string; check_out: string },
  stays: StayLite[],
  uses: ExtraUse[],
): number {
  const overlapping = new Set(
    stays
      .filter((s) => s.id !== stay.id && s.status !== "cancelled" && overlaps(s.check_in, s.check_out, stay.check_in, stay.check_out))
      .map((s) => s.id),
  );
  return uses
    .filter((u) => u.extra_id === extraId && u.status !== "cancelled" && overlapping.has(u.booking_id))
    .reduce((sum, u) => sum + Math.max(0, u.qty), 0);
}

/**
 * Catalog extras whose stock (`qty`) would be exceeded by this booking plus other
 * overlapping bookings. Extras without a stock number are never short. This is a
 * WARNING for the owner, never a block.
 */
export function extraShortfalls(
  draft: DraftExtra[],
  stay: { id?: string | null; check_in: string; check_out: string },
  catalog: CatalogStock[],
  stays: StayLite[],
  uses: ExtraUse[],
): Shortfall[] {
  if (!(stay.check_in < stay.check_out)) return [];
  const wanted = new Map<string, number>();
  for (const d of draft) {
    if (!d.extra_id || d.status === "cancelled") continue;
    wanted.set(d.extra_id, (wanted.get(d.extra_id) ?? 0) + Math.max(0, d.qty));
  }
  const out: Shortfall[] = [];
  for (const [extraId, w] of wanted) {
    const cat = catalog.find((c) => c.id === extraId);
    if (!cat || cat.qty == null || cat.qty <= 0 || w === 0) continue;
    const used = extraUsed(extraId, stay, stays, uses);
    if (used + w > cat.qty) out.push({ extraId, name: cat.name, stock: cat.qty, used, wanted: w });
  }
  return out;
}

/* ---------- guests ---------- */

type GuestBooking = Pick<
  Booking,
  "id" | "guest_name" | "phone" | "email" | "check_in" | "check_out" | "status" | "total" | "commission" | "channel" | "foreign_national" | "apartment_id"
>;

export interface GuestSummary<B extends GuestBooking = GuestBooking> {
  key: string;
  name: string;
  phone: string | null;
  email: string | null;
  bookings: B[];
  /** latest check-in date */
  last: string;
  stays: number;
  nights: number;
  /** net = total − commission over non-cancelled stays */
  spend: number;
  channels: Channel[];
  missing: number;
  foreign: boolean;
  profile: GuestProfile | null;
}

/** Group bookings by guest identity (SPEC § 4.6), newest guests first. */
export function buildGuestIndex<B extends GuestBooking>(
  bookings: B[],
  issues: Pick<Issue, "category" | "booking_id">[],
  profiles: GuestProfile[],
): GuestSummary<B>[] {
  const prof = new Map(profiles.map((p) => [p.key, p]));
  const map = new Map<string, GuestSummary<B>>();
  for (const b of bookings) {
    const key = guestKey(b);
    let g = map.get(key);
    if (!g) {
      g = {
        key, name: b.guest_name, phone: b.phone, email: b.email, bookings: [], last: "",
        stays: 0, nights: 0, spend: 0, channels: [], missing: 0, foreign: false, profile: prof.get(key) ?? null,
      };
      map.set(key, g);
    }
    g.bookings.push(b);
    if (b.check_in > g.last) {
      g.last = b.check_in;
      g.name = b.guest_name || g.name;
      g.phone = b.phone || g.phone;
      g.email = b.email || g.email;
    }
  }
  const missingByBooking = new Map<string, number>();
  for (const i of issues) {
    if (i.category === "missing" && i.booking_id) missingByBooking.set(i.booking_id, (missingByBooking.get(i.booking_id) ?? 0) + 1);
  }
  for (const g of map.values()) {
    const active = g.bookings.filter((b) => b.status !== "cancelled");
    g.stays = active.length;
    g.nights = active.reduce((s, b) => s + nights(b.check_in, b.check_out), 0);
    g.spend = active.reduce((s, b) => s + (b.total - b.commission), 0);
    g.channels = [...new Set(active.map((b) => b.channel))];
    g.missing = g.bookings.reduce((s, b) => s + (missingByBooking.get(b.id) ?? 0), 0);
    g.foreign = g.bookings.some((b) => b.foreign_national);
    g.bookings.sort((a, b) => b.check_in.localeCompare(a.check_in));
  }
  return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
}

/* ---------- CSV ---------- */

/** RFC 4180 CSV. Cells that start with = + - @ are prefixed with ' so spreadsheets never run them. */
export function toCSV(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          let s = c == null ? "" : String(c);
          if (typeof c === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}
