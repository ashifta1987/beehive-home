import { z } from "zod";
import { addDaysISO, todayIST } from "@/lib/dates";

/** Shared by the guest form (client hints) and /api/checkin/submit (the real check). */
export const ID_TYPES = ["passport", "aadhaar", "driving", "voter", "other"] as const;
export type IdType = (typeof ID_TYPES)[number];

export const VISA_TYPES = ["e-Tourist", "Tourist", "Business", "OCI", "Other"] as const;
export type VisaType = (typeof VISA_TYPES)[number];

export const PORTAL_LOCALES = ["en", "ml", "hi"] as const;
export type PortalLocale = (typeof PORTAL_LOCALES)[number];

/** Country calling codes offered in the mobile field (India first). */
export const COUNTRY_CODES = [
  "+91", "+1", "+44", "+49", "+33", "+31", "+39", "+34", "+41", "+46", "+47", "+45", "+353", "+7",
  "+61", "+64", "+971", "+966", "+974", "+965", "+968", "+973", "+65", "+60", "+66", "+81", "+82",
  "+86", "+94", "+977", "+880", "+960", "+27", "+55", "+52",
] as const;

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateStr = z.string().regex(ISO_DATE);
const optDate = z
  .union([dateStr, z.literal("")])
  .nullish()
  .transform((v) => (v ? v : null));
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** Digits only, 6–15 of them (E.164 allows 15). */
export function phoneDigits(v: string): string {
  return v.replace(/\D/g, "");
}

export const submitSchema = z
  .object({
    apartment: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
    key: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/),
    full_name: z.string().trim().min(2).max(120),
    phone_code: z.string().regex(/^\+\d{1,4}$/),
    phone: z.string().trim().max(24).refine((v) => {
      const n = phoneDigits(v).length;
      return n >= 6 && n <= 15;
    }),
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(20),
    check_out: dateStr,
    is_foreign: z.boolean(),
    id_type: z.enum(ID_TYPES),
    nationality: optText(60),
    passport_no: optText(30),
    passport_expiry: optDate,
    visa_no: optText(30),
    visa_type: z.enum(VISA_TYPES).nullish().transform((v) => v ?? null),
    visa_expiry: optDate,
    arrived_india: optDate,
    arriving_from: optText(80),
    next_destination: optText(80),
    rules_accepted: z.literal(true),
    lang: z.enum(PORTAL_LOCALES),
  })
  .superRefine((v, ctx) => {
    const today = todayIST();
    if (v.check_out < today || v.check_out > addDaysISO(today, 366)) {
      ctx.addIssue({ code: "custom", path: ["check_out"], message: "check_out" });
    }
    if (v.is_foreign) {
      if (!v.nationality) ctx.addIssue({ code: "custom", path: ["nationality"], message: "required" });
      if (!v.passport_no) ctx.addIssue({ code: "custom", path: ["passport_no"], message: "required" });
      if (!v.passport_expiry) ctx.addIssue({ code: "custom", path: ["passport_expiry"], message: "required" });
      if (!v.arrived_india) ctx.addIssue({ code: "custom", path: ["arrived_india"], message: "required" });
    }
  });

export type SubmitInput = z.input<typeof submitSchema>;

/** What /api/checkin/submit returns. */
export type SubmitResponse =
  | {
      ok: true;
      id: string;
      code: string;
      name: string;
      check_out_time: string | null;
      wifi_name: string | null;
      wifi_password: string | null;
    }
  | { ok: false; error: "invalid_link" | "rate_limited" | "invalid" | "server" };

export type PhotoResponse = { ok: true } | { ok: false; error: "invalid_link" | "invalid" | "expired" | "too_many" | "server" };

/** What beehive_guest_apartment() returns for a valid door key. */
export interface GuestApartment {
  id: string;
  name: string;
  code: string;
  tag_colour: string;
  check_out_time: string | null;
  house_rules: string[] | null;
}
