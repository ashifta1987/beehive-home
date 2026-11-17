import { z } from "zod";

// Shared zod schemas for the booking form. The server action always re-parses input with these.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");
const time = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a valid time.")
  .transform((t) => t.slice(0, 5));
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const rupees = z.coerce.number().int("Use whole rupees.").min(0, "Cannot be below zero.").max(100_000_000);

export const CHANNELS = ["airbnb", "booking", "direct", "other"] as const;
export const PAYMENT_STATUSES = ["channel", "paid", "partial", "pending"] as const;
export const DEPOSIT_STATUSES = ["none", "held", "refunded", "deducted"] as const;
export const BOOKING_STATUSES = ["confirmed", "checked_in", "checked_out", "cancelled"] as const;
export const EXTRA_UNITS = ["use", "day", "night", "hour", "event", "item"] as const;
export const EXTRA_STATUSES = ["requested", "confirmed", "delivered", "returned", "cancelled"] as const;

export const bookingExtraSchema = z.object({
  id: z.uuid().nullish(),
  extra_id: z.uuid().nullish().transform((v) => v ?? null),
  name: z.string().trim().min(1, "Give the charge a name.").max(120),
  unit: z.enum(EXTRA_UNITS),
  qty: z.coerce.number().int().min(1, "At least 1.").max(99),
  units: z.coerce.number().int().min(1, "At least 1.").max(365),
  price: z.coerce.number({ error: "Enter the price." }).int("Use whole rupees.").min(0).max(10_000_000),
  date: isoDate,
  status: z.enum(EXTRA_STATUSES),
  paid: z.boolean(),
});

export const bookingSchema = z
  .object({
    id: z.uuid().nullish(),
    apartment_id: z.string().min(1, "Choose an apartment."),
    channel: z.enum(CHANNELS),
    channel_ref: optText(80),
    guest_name: z.string().trim().min(1, "Enter the guest name.").max(120),
    phone: optText(40),
    email: z
      .string()
      .trim()
      .max(160)
      .nullish()
      .transform((v) => (v ? v.toLowerCase() : null))
      .refine((v) => v == null || z.email().safeParse(v).success, "Enter a valid email or leave it empty."),
    adults: z.coerce.number().int().min(0).max(50),
    children: z.coerce.number().int().min(0).max(50),
    check_in: isoDate,
    check_out: isoDate,
    check_in_time: time.nullish().transform((v) => v ?? null),
    check_out_time: time.nullish().transform((v) => v ?? null),
    total: rupees,
    commission: rupees,
    payment_status: z.enum(PAYMENT_STATUSES),
    deposit: rupees,
    deposit_status: z.enum(DEPOSIT_STATUSES),
    status: z.enum(BOOKING_STATUSES),
    id_verified: z.boolean(),
    foreign_national: z.boolean(),
    share_phone: z.boolean(),
    hk_note: optText(500),
    notes: optText(2000),
    extras: z.array(bookingExtraSchema).max(40),
  })
  .refine((v) => v.check_out > v.check_in, { path: ["check_out"], message: "Check-out must be after check-in." })
  .refine((v) => v.commission <= v.total || v.total === 0, {
    path: ["commission"],
    message: "Commission cannot be more than the total.",
  })
  .refine((v) => v.adults + v.children >= 1, { path: ["adults"], message: "Add at least one guest." });

export type BookingInput = z.input<typeof bookingSchema>;
export type BookingExtraInput = z.input<typeof bookingExtraSchema>;

export const statusChangeSchema = z.object({
  id: z.uuid(),
  status: z.enum(["checked_in", "checked_out"]),
});
