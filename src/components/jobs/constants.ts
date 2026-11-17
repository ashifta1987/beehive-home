// Enum lists for the work module. Labels live in the message files
// (jobs / care / laundry / maintenance / assets namespaces).

import type { AssetCategory, IssueCategory, IssuePriority, ScheduleCategory, TaskKind } from "@/lib/types";

export const MANUAL_KINDS = ["deep", "inspection", "maintenance", "laundry", "other"] as const satisfies readonly TaskKind[];
export type ManualKind = (typeof MANUAL_KINDS)[number];

export const ISSUE_CATEGORIES = [
  "maintenance", "electrical", "plumbing", "appliance", "hygiene", "supplies", "damage", "missing", "mess", "other",
] as const satisfies readonly IssueCategory[];

export const ISSUE_PRIORITIES = ["low", "normal", "urgent"] as const satisfies readonly IssuePriority[];

export const SCHEDULE_CATEGORIES = [
  "hygiene", "airfilter", "purifier", "watertest", "deepclean", "acservice", "pest", "safety", "other",
] as const satisfies readonly ScheduleCategory[];

export const SCHEDULE_WHO = ["housekeeper", "technician", "owner"] as const;

export const ASSET_CATEGORIES = [
  "appliance", "electronics", "furniture", "linen", "kitchen", "bathroom", "decor", "safety", "other",
] as const satisfies readonly AssetCategory[];

/** Booking extra name used when the owner charges a guest for an issue (SPEC § 4.5). */
export const CHARGE_NAME: Partial<Record<IssueCategory, string>> = {
  mess: "Extra cleaning charge",
  damage: "Damage charge",
  missing: "Missing items charge",
};

/** Laundry batches out longer than this are flagged (SPEC § 4.2). */
export const LAUNDRY_LATE_DAYS = 4;

/** next-intl locale → Intl locale for dates. */
export const intlLocale = (locale: string) => (locale === "ml" ? "ml-IN" : locale === "hi" ? "hi-IN" : "en-IN");
