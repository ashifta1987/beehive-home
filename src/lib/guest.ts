import type { Apartment, Booking, Extra } from "./types";
import { fmtDate, fmtTime, nights } from "./dates";
import { inr } from "./money";

/** Guest identity key (SPEC § 4.6). */
export function guestKey(b: Pick<Booking, "phone" | "email" | "guest_name">): string {
  const digits = (b.phone ?? "").replace(/\D/g, "");
  if (digits.length >= 8) return "p" + digits.slice(-10);
  const email = (b.email ?? "").trim().toLowerCase();
  if (email) return "e" + email;
  return "n" + b.guest_name.trim().toLowerCase();
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Normalise a phone to 91 + 10 digits for wa.me (keeps other country codes as typed). */
export function waPhone(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) return "91" + d;
  if (d.length === 11 && d.startsWith("0")) return "91" + d.slice(1);
  if (d.length === 12 && d.startsWith("91")) return d;
  return d.length >= 8 ? d : null;
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const p = waPhone(phone);
  return p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : null;
}

const UNIT_LABEL: Record<string, string> = {
  use: "per use", day: "per day", night: "per night", hour: "per hour", event: "per event", item: "per item",
};
export const unitLabel = (u: string) => UNIT_LABEL[u] ?? u;

/** Fill the welcome message template (SPEC § 4.9). */
export function welcomeMessage(b: Booking, apt: Apartment, extras: Extra[]): string {
  const tpl = apt.welcome_message ?? "";
  const offered = extras
    .filter((e) => e.active && e.price != null && (e.apartment_id == null || e.apartment_id === apt.id))
    .map((e) => `${e.name} ${inr(e.price)} ${unitLabel(e.unit)}`)
    .join(", ");
  const map: Record<string, string> = {
    guest: firstName(b.guest_name),
    apartment: apt.name,
    checkin: fmtDate(b.check_in),
    checkout: fmtDate(b.check_out),
    checkinTime: fmtTime(b.check_in_time ?? apt.check_in_time),
    checkoutTime: fmtTime(b.check_out_time ?? apt.check_out_time),
    nights: String(nights(b.check_in, b.check_out)),
    guests: String(b.adults + b.children),
    extras: offered,
  };
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in map ? map[k] : m));
}

export const CHANNEL_LABEL: Record<string, string> = {
  airbnb: "Airbnb", booking: "Booking.com", direct: "Direct", other: "Other",
};
