// Pure helpers for the owner Today screen: agenda items and week strip marks.
import type { Booking, Schedule, Task } from "@/lib/types";
import { addDaysISO } from "@/lib/dates";
import { careNextDue } from "@/lib/care";

export type AgendaBooking = Pick<
  Booking,
  "id" | "apartment_id" | "guest_name" | "check_in" | "check_out" | "check_in_time" | "check_out_time" | "status" | "channel" | "adults" | "children"
>;
export type AgendaTask = Pick<Task, "id" | "kind" | "apartment_id" | "booking_id" | "auto" | "date" | "time" | "status" | "note" | "checks">;
export type AgendaSchedule = Pick<Schedule, "id" | "name" | "apartment_id" | "last_done" | "every_days" | "who">;

export type AgendaItem =
  | { type: "checkout"; key: string; date: string; time: string | null; booking: AgendaBooking; cleaned: boolean; aptIds: string[] }
  | { type: "arrival"; key: string; date: string; time: string | null; booking: AgendaBooking; aptIds: string[] }
  | { type: "task"; key: string; date: string; time: string | null; task: AgendaTask; aptIds: string[] }
  | { type: "care"; key: string; date: string; time: null; schedule: AgendaSchedule; aptIds: string[] };

/** Sort key: real times first in order, then "any time" jobs, then care due. */
function sortKey(i: AgendaItem): string {
  if (i.type === "care") return "98";
  return i.time ? i.time.slice(0, 5) : "97";
}

/**
 * Everything happening on `day`: check-outs, arrivals, manual jobs and periodic care due.
 * `defaults` gives each apartment's standard times when a booking has none.
 */
export function agendaFor(
  day: string,
  input: {
    bookings: AgendaBooking[];
    tasks: AgendaTask[];
    schedules: AgendaSchedule[];
    allAptIds: string[];
    defaults: Record<string, { in: string; out: string }>;
  },
): AgendaItem[] {
  const out: AgendaItem[] = [];
  const live = input.bookings.filter((b) => b.status !== "cancelled");
  for (const b of live) {
    if (b.check_out === day) {
      const turn = input.tasks.find((k) => k.kind === "turnover" && k.booking_id === b.id);
      out.push({
        type: "checkout",
        key: `out-${b.id}`,
        date: day,
        time: b.check_out_time ?? input.defaults[b.apartment_id]?.out ?? null,
        booking: b,
        cleaned: turn?.status === "done",
        aptIds: [b.apartment_id],
      });
    }
    if (b.check_in === day) {
      out.push({
        type: "arrival",
        key: `in-${b.id}`,
        date: day,
        time: b.check_in_time ?? input.defaults[b.apartment_id]?.in ?? null,
        booking: b,
        aptIds: [b.apartment_id],
      });
    }
  }
  for (const k of input.tasks) {
    if (k.date !== day || k.auto) continue;
    out.push({ type: "task", key: `task-${k.id}`, date: day, time: k.time, task: k, aptIds: [k.apartment_id] });
  }
  for (const s of input.schedules) {
    if (careNextDue(s.last_done, s.every_days) !== day) continue;
    out.push({ type: "care", key: `care-${s.id}`, date: day, time: null, schedule: s, aptIds: s.apartment_id ? [s.apartment_id] : input.allAptIds });
  }
  return out.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));
}

/** The 7 days Mon–Sun starting at `monday`, each with the apartments that have a check-in or check-out. */
export function weekMarks(monday: string, bookings: AgendaBooking[]): { date: string; aptIds: string[] }[] {
  const live = bookings.filter((b) => b.status !== "cancelled");
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(monday, i);
    const ids = new Set<string>();
    for (const b of live) if (b.check_in === date || b.check_out === date) ids.add(b.apartment_id);
    return { date, aptIds: [...ids] };
  });
}

/** Checked items of a job vs. the checklist length. */
export function checkProgress(checks: Record<string, boolean> | null | undefined, total: number): { done: number; total: number } {
  const done = Object.entries(checks ?? {}).filter(([k, v]) => v && Number(k) < total).length;
  return { done, total };
}
