// Periodic care status (SPEC § 4.4). Pure functions — no I/O, so they are unit-tested.
// All dates are 'YYYY-MM-DD' strings; pass "today" from todayIST().

import { addDaysISO, daysBetween } from "./dates";

export type CareState = "never" | "overdue" | "today" | "soon" | "later";

export interface CareStatus {
  state: CareState;
  /** Next due date, or null when there is no last done date. */
  next: string | null;
  /** Days from today to the next due date (negative = overdue). Null when never done. */
  days: number | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (v: string | null | undefined): v is string => !!v && ISO.test(v);

/** Next due = last_done + every_days (every_days below 1 counts as 1). */
export function careNextDue(lastDone: string | null | undefined, everyDays: number): string | null {
  if (!isIso(lastDone)) return null;
  const every = Number.isFinite(everyDays) ? Math.max(1, Math.round(everyDays)) : 1;
  return addDaysISO(lastDone, every);
}

/** Status: never → "Set last done date"; overdue; due today; due within 7 days; otherwise later. */
export function careStatus(s: { last_done: string | null; every_days: number }, today: string): CareStatus {
  const next = careNextDue(s.last_done, s.every_days);
  if (!next) return { state: "never", next: null, days: null };
  const days = daysBetween(today, next);
  if (days < 0) return { state: "overdue", next, days };
  if (days === 0) return { state: "today", next, days };
  if (days <= 7) return { state: "soon", next, days };
  return { state: "later", next, days };
}

/** Sort weight: most urgent first. */
export const CARE_RANK: Record<CareState, number> = { overdue: 0, today: 1, never: 2, soon: 3, later: 4 };

/** Compare two schedules for display: urgent first, then by next date, then by name. */
export function compareCare(
  a: { status: CareStatus; name: string },
  b: { status: CareStatus; name: string },
): number {
  const r = CARE_RANK[a.status.state] - CARE_RANK[b.status.state];
  if (r) return r;
  const an = a.status.next ?? "";
  const bn = b.status.next ?? "";
  if (an !== bn) return an < bn ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/** "Mark done" moves last_done forward only when the new date is the same or later. */
export function shouldMoveLastDone(current: string | null | undefined, done: string): boolean {
  return !isIso(current) || done >= current;
}
