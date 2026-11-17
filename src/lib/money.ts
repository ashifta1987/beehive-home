const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** Whole rupees → "₹12,500". */
export function inr(n: number | null | undefined): string {
  return fmt.format(Math.round(n ?? 0));
}

/** Parse a user-typed amount into whole rupees (or null). */
export function parseRupees(v: FormDataEntryValue | string | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[₹,\s]/g, "");
  if (s === "") return null;
  const n = Math.round(Number(s));
  return Number.isFinite(n) ? n : null;
}

