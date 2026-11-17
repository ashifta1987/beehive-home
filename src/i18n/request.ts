import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { NAMESPACES, isLocale, type Locale } from "./config";

async function load(locale: Locale) {
  const parts = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const mod = (await import(`../../messages/${locale}/${ns}.json`)) as { default: Record<string, unknown> };
      return [ns, mod.default] as const;
    }),
  );
  return Object.fromEntries(parts);
}

function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object" && !Array.isArray(b)
        ? deepMerge(b as Record<string, unknown>, v as Record<string, unknown>)
        : v;
  }
  return out;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("NEXT_LOCALE")?.value;
  const locale: Locale = isLocale(raw) ? raw : "en";
  const en = await load("en");
  // Missing ml/hi strings fall back to English.
  const messages = locale === "en" ? en : deepMerge(en, await load(locale));
  return { locale, messages, timeZone: "Asia/Kolkata" };
});
