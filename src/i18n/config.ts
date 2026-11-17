export const LOCALES = ["en", "ml", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/**
 * One message file per namespace per locale: messages/<locale>/<ns>.json.
 * Each feature owns its namespace file. Add a namespace here AND create the
 * three JSON files (en, ml, hi — use {} if not translated yet).
 */
export const NAMESPACES = [
  "common",
  "nav",
  "auth",
  "today",
  "calendar",
  "bookings",
  "guests",
  "foreign",
  "extras",
  "checkins",
  "jobs",
  "care",
  "laundry",
  "maintenance",
  "assets",
  "finance",
  "expenses",
  "petty",
  "marketing",
  "licences",
  "apartments",
  "settings",
  "portal",
  "posters",
] as const;
export type Namespace = (typeof NAMESPACES)[number];

