// Shared zod helpers for the work module's server actions (jobs, care, laundry,
// maintenance, assets). Forms send FormData-like objects of strings; these
// helpers trim, turn "" into null and coerce numbers, then validate.

import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

const blankToNull = (v: unknown) => {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" ? null : s;
  }
  return v;
};

const toNumber = (v: unknown) => {
  const b = blankToNull(v);
  if (b === null) return null;
  if (typeof b === "number") return b;
  if (typeof b === "string") return Number(b.replace(/[₹,\s]/g, ""));
  return b;
};

const validDate = (s: string) => {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const id = z.uuid();

export const reqText = (max = 500) => z.string().trim().min(1, "Fill this in.").max(max);

export const optText = (max = 1000) => z.preprocess(blankToNull, z.string().max(max).nullable());

export const isoDate = z.string().trim().refine(validDate, "Pick a valid date.");

export const optDate = z.preprocess(blankToNull, isoDate.nullable());

export const optTime = z.preprocess(blankToNull, z.string().regex(TIME, "Pick a valid time.").nullable());

export const optInt = (min = 0, max = 10_000_000) =>
  z.preprocess(toNumber, z.number().int("Use a whole number.").min(min).max(max).nullable());

export const reqInt = (min = 0, max = 10_000_000) =>
  z.preprocess(toNumber, z.number({ error: "Fill this in." }).int("Use a whole number.").min(min).max(max));

/** Apartment id, or null for "both apartments" ("" or "both"). */
export const aptOrBoth = z.preprocess(
  (v) => (v === "both" ? null : blankToNull(v)),
  z.string().max(40).nullable(),
);

export const aptRequired = z.string().trim().min(1, "Pick an apartment.").max(40);

/** HTML checkbox / toggle value → boolean. */
export const bool = z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean());
