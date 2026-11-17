import { getLocale } from "next-intl/server";
import { isMonth } from "@/lib/finance";
import { todayIST } from "@/lib/dates";

/** BCP-47 locale for dates and numbers from the next-intl locale. */
export async function dateLocale(): Promise<string> {
  const l = await getLocale();
  return l === "ml" ? "ml-IN" : l === "hi" ? "hi-IN" : "en-IN";
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The `?m=YYYY-MM` month, or the current Kochi month. */
export async function pickMonth(searchParams: SearchParams): Promise<{ month: string; current: string }> {
  const sp = await searchParams;
  const current = todayIST().slice(0, 7);
  const raw = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  return { month: isMonth(raw) ? raw : current, current };
}

/** 0.4567 → "46%" */
export const pct = (v: number) => `${Math.round(v * 100)}%`;
