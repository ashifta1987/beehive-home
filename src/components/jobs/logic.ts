// Pure job logic (SPEC § 4.3), shared by the jobs page and its server actions.

import type { Apartment, Asset, Task } from "@/lib/types";
import { addDaysISO } from "@/lib/dates";

/** Checklist for a job: turnover/deep → cleaning list, arrival → arrival list, others none. */
export function checklistFor(task: Pick<Task, "kind">, apt: Pick<Apartment, "cleaning_checklist" | "arrival_checklist"> | undefined): string[] {
  if (!apt) return [];
  if (task.kind === "turnover" || task.kind === "deep") return apt.cleaning_checklist ?? [];
  if (task.kind === "arrival") return apt.arrival_checklist ?? [];
  return [];
}

/** How many checklist rows are ticked (keys are the row index as a string). */
export function doneCount(checks: Record<string, boolean> | null | undefined, length: number): number {
  let n = 0;
  for (let i = 0; i < length; i++) if (checks?.[String(i)]) n++;
  return n;
}

export interface JobSections {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  done: Task[];
}

const byDateTime = (a: Task, b: Task) =>
  a.date === b.date ? (a.time ?? "99").localeCompare(b.time ?? "99") : a.date < b.date ? -1 : 1;

/**
 * Split jobs into sections: overdue (not done, before today), today (not done),
 * upcoming (not done, next 7 days) and done recently (done, dated in the last 7 days
 * or later). Jobs further ahead are left out.
 */
export function sectionJobs(tasks: Task[], today: string): JobSections {
  const horizon = addDaysISO(today, 7);
  const since = addDaysISO(today, -7);
  const s: JobSections = { overdue: [], today: [], upcoming: [], done: [] };
  for (const t of tasks) {
    if (t.status === "done") {
      if (t.date >= since) s.done.push(t);
    } else if (t.date < today) s.overdue.push(t);
    else if (t.date === today) s.today.push(t);
    else if (t.date <= horizon) s.upcoming.push(t);
  }
  s.overdue.sort(byDateTime);
  s.today.sort(byDateTime);
  s.upcoming.sort(byDateTime);
  s.done.sort((a, b) => (b.completed_at ?? b.date).localeCompare(a.completed_at ?? a.date));
  return s;
}

export interface CountLine {
  asset: Pick<Asset, "id" | "name" | "room" | "qty" | "value">;
  expected: number;
  counted: number | null;
  short: number;
}

/** Compare counted numbers with each counted asset's quantity. */
export function compareCounts(
  assets: Array<Pick<Asset, "id" | "name" | "room" | "qty" | "value">>,
  counts: Record<string, number> | null | undefined,
): CountLine[] {
  return assets.map((a) => {
    const expected = Math.max(0, a.qty ?? 0);
    const raw = counts?.[a.id];
    const counted = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    return { asset: a, expected, counted, short: counted === null ? 0 : Math.max(0, expected - counted) };
  });
}

/** Text of the urgent "missing" issue: "2× Bath towel (Bathroom, ₹450 each), …". */
export function missingText(
  lines: CountLine[],
  guest: string | null,
  date: string,
  fmtMoney: (n: number) => string,
): { text: string; pieces: number; value: number } {
  const short = lines.filter((l) => l.short > 0);
  const pieces = short.reduce((s, l) => s + l.short, 0);
  const value = short.reduce((s, l) => s + l.short * (l.asset.value ?? 0), 0);
  const parts = short.map((l) => {
    const extra = [l.asset.room, l.asset.value ? `${fmtMoney(l.asset.value)} each` : null].filter(Boolean).join(", ");
    return `${l.short}× ${l.asset.name}${extra ? ` (${extra})` : ""}`;
  });
  const total = value > 0 ? ` · Value about ${fmtMoney(value)}` : "";
  return {
    text: `Missing after ${guest || "the guest"} checked out (${date}): ${parts.join(", ")}${total}`,
    pieces,
    value,
  };
}
