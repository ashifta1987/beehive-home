import { z } from "zod";
import { blank } from "@/lib/actions";

/** 'YYYY-MM-DD' that is a real calendar date. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Pick a valid date");

/** Whole rupees, at least 1. */
export const rupees = z.number({ error: "Enter an amount in rupees" }).int("Use whole rupees").min(1, "Enter an amount above zero").max(10_000_000, "That amount looks too big");

/** Optional trimmed text: empty → null. */
export const optText = (max: number) => z.preprocess(blank, z.string().trim().max(max).nullable().optional().default(null));

/** Apartment id or null for "both apartments". */
export const aptId = z.preprocess(blank, z.string().trim().min(1).max(40).nullable().default(null));

export const uuid = z.uuid();
