"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { requireOwner, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIST } from "@/lib/dates";
import { shouldMoveLastDone } from "@/lib/care";
import type { Schedule } from "@/lib/types";
import { SCHEDULE_CATEGORIES, SCHEDULE_WHO } from "@/components/jobs/constants";
import { aptOrBoth, id, isoDate, optDate, optInt, optText, reqInt, reqText } from "@/components/jobs/schemas";

function revalidateCare() {
  revalidatePath("/care");
  revalidatePath("/today");
}

const scheduleSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), id.optional()),
  name: reqText(120),
  category: z.enum(SCHEDULE_CATEGORIES),
  apartment_id: aptOrBoth,
  every_days: reqInt(1, 3650),
  who: z.enum(SCHEDULE_WHO),
  vendor: optText(120),
  note: optText(2000),
  last_done: optDate,
});

export async function saveSchedule(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireStaff();
    const v = scheduleSchema.parse(input);
    if (v.last_done && v.last_done > todayIST()) throw new UserError("errors.futureDate");
    const supabase = await createClient();
    const row = {
      name: v.name,
      category: v.category,
      apartment_id: v.apartment_id,
      every_days: v.every_days,
      who: v.who,
      vendor: v.vendor,
      note: v.note,
      last_done: v.last_done,
    };
    if (v.id) {
      const rows = check(await supabase.from("beehive_schedules").update(row).eq("id", v.id).select("id")) as Array<{ id: string }>;
      if (!rows.length) throw new UserError("errors.gone");
    } else {
      check(await supabase.from("beehive_schedules").insert(row));
    }
    revalidateCare();
  });
}

const doneSchema = z.object({
  scheduleId: id,
  date: isoDate,
  result: optText(300),
  note: optText(2000),
  cost: optInt(0, 10_000_000),
});

/** Log a visit; last_done moves forward only when the new date is the same or later. */
export async function markCareDone(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireStaff();
    const v = doneSchema.parse(input);
    if (v.date > todayIST()) throw new UserError("errors.futureDate");
    const supabase = await createClient();
    const { data: s, error } = await supabase
      .from("beehive_schedules")
      .select("id, apartment_id, last_done, every_days")
      .eq("id", v.scheduleId)
      .maybeSingle<Pick<Schedule, "id" | "apartment_id" | "last_done" | "every_days">>();
    if (error) throw error;
    if (!s) throw new UserError("errors.gone");

    check(
      await supabase.from("beehive_schedule_log").insert({
        schedule_id: s.id,
        apartment_id: s.apartment_id,
        date: v.date,
        result: v.result,
        note: v.note,
        cost: v.cost,
      }),
    );
    if (shouldMoveLastDone(s.last_done, v.date)) {
      check(await supabase.from("beehive_schedules").update({ last_done: v.date, last_result: v.result }).eq("id", s.id));
    }
    revalidateCare();
  });
}

export async function deleteSchedule(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { scheduleId } = z.object({ scheduleId: id }).parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_schedules").delete().eq("id", scheduleId));
    revalidateCare();
  });
}

export async function deleteCareLog(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { logId } = z.object({ logId: id }).parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_schedule_log").delete().eq("id", logId));
    revalidateCare();
  });
}
