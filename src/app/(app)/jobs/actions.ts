"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { requireOwner, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDay } from "@/lib/dates";
import { inr } from "@/lib/money";
import type { Asset, Task } from "@/lib/types";
import { MANUAL_KINDS } from "@/components/jobs/constants";
import { compareCounts, missingText } from "@/components/jobs/logic";
import { aptRequired, id, isoDate, optText, optTime, reqText } from "@/components/jobs/schemas";

type TaskRow = Pick<Task, "id" | "kind" | "apartment_id" | "booking_id" | "auto" | "date" | "guest_first_name" | "status">;

async function loadTask(taskId: string): Promise<TaskRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beehive_tasks")
    .select("id, kind, apartment_id, booking_id, auto, date, guest_first_name, status")
    .eq("id", taskId)
    .maybeSingle<TaskRow>();
  if (error) throw error;
  if (!data) throw new UserError("errors.jobGone");
  return data;
}

function revalidateWork() {
  revalidatePath("/jobs");
  revalidatePath("/today");
}

// Checklist ---------------------------------------------------------------

const checksSchema = z.object({
  taskId: id,
  checks: z.record(z.string().regex(/^\d{1,3}$/), z.boolean()),
});

/** Saves the whole checklist map. The client sends its latest state in order. */
export async function saveChecks(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireStaff();
    const v = checksSchema.parse(input);
    const clean = Object.fromEntries(Object.entries(v.checks).filter(([, on]) => on));
    const supabase = await createClient();
    const rows = check(await supabase.from("beehive_tasks").update({ checks: clean }).eq("id", v.taskId).select("id"));
    if (!rows?.length) throw new UserError("errors.jobGone");
  });
}

// Status ------------------------------------------------------------------

const statusSchema = z.object({ taskId: id, status: z.enum(["pending", "in_progress", "done"]) });

export async function setJobStatus(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    const s = await requireStaff();
    const v = statusSchema.parse(input);
    const supabase = await createClient();
    const patch =
      v.status === "done"
        ? { status: "done", completed_at: new Date().toISOString(), completed_by: s.userId }
        : { status: v.status, completed_at: null, completed_by: null };
    const rows = check(await supabase.from("beehive_tasks").update(patch).eq("id", v.taskId).select("id"));
    if (!rows?.length) throw new UserError("errors.jobGone");
    revalidateWork();
  });
}

// Housekeeper notes -------------------------------------------------------

const notesSchema = z.object({ taskId: id, hk_notes: optText(2000) });

export async function saveJobNotes(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireStaff();
    const v = notesSchema.parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_tasks").update({ hk_notes: v.hk_notes }).eq("id", v.taskId));
    revalidatePath("/jobs");
  });
}

// Room condition ----------------------------------------------------------

export async function markRoomOk(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireStaff();
    const { taskId } = z.object({ taskId: id }).parse(input);
    const t = await loadTask(taskId);
    if (t.kind !== "turnover") throw new UserError("errors.turnoverOnly");
    const supabase = await createClient();
    check(
      await supabase
        .from("beehive_tasks")
        .update({ condition: "ok", condition_note: null, condition_at: new Date().toISOString() })
        .eq("id", taskId),
    );
    revalidateWork();
  });
}

const conditionSchema = z.object({
  taskId: id,
  kind: z.enum(["messy", "damaged"]),
  note: reqText(2000),
  hours: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().min(0).max(48).multipleOf(0.25, "Use quarter hours, e.g. 1.5").nullable(),
  ),
});

/** Messy or damaged room → condition on the job + an issue linked to the booking. */
export async function reportCondition(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireStaff();
    const v = conditionSchema.parse(input);
    const t = await loadTask(v.taskId);
    if (t.kind !== "turnover") throw new UserError("errors.turnoverOnly");
    const supabase = await createClient();
    const hrs = v.hours && v.hours > 0 ? v.hours : null;
    const conditionNote = v.note + (hrs ? ` (about ${hrs} h extra cleaning)` : "");
    check(
      await supabase
        .from("beehive_tasks")
        .update({ condition: v.kind, condition_note: conditionNote, condition_at: new Date().toISOString() })
        .eq("id", t.id),
    );
    const guest = t.guest_first_name || "the guest";
    const what = v.kind === "messy" ? "Room left very messy" : "Damage found";
    check(
      await supabase.from("beehive_issues").insert({
        apartment_id: t.apartment_id,
        category: v.kind === "messy" ? "mess" : "damage",
        priority: "normal",
        status: "open",
        text: `${what} after ${guest} checked out (${fmtDay(t.date)}): ${v.note}${hrs ? ` · about ${hrs} h extra cleaning` : ""}`,
        booking_id: t.booking_id,
        task_id: t.id,
        guest_name: t.guest_first_name,
        extra_hours: hrs,
      }),
    );
    revalidateWork();
    revalidatePath("/maintenance");
  });
}

// Inventory (theft check) -------------------------------------------------

const inventorySchema = z.object({
  taskId: id,
  counts: z.record(z.uuid(), z.number().int().min(0).max(10_000)),
});

/**
 * Saves the checkout count. Any shortfall creates (or updates, on a recount) one
 * URGENT "missing" issue linked to the booking. Returns the number of missing pieces.
 */
export async function saveInventory(input: unknown): Promise<ActionResult<{ missing: number }>> {
  return action(async () => {
    const s = await requireStaff();
    const v = inventorySchema.parse(input);
    const t = await loadTask(v.taskId);
    if (t.kind !== "turnover") throw new UserError("errors.turnoverOnly");
    const supabase = await createClient();
    const assets = check(
      await supabase
        .from("beehive_assets")
        .select("id, name, room, qty, value")
        .eq("apartment_id", t.apartment_id)
        .eq("count_on_checkout", true)
        .order("name"),
    ) as Array<Pick<Asset, "id" | "name" | "room" | "qty" | "value">>;
    if (!assets.length) throw new UserError("errors.noCounted");
    for (const a of assets) {
      if (v.counts[a.id] === undefined) throw new UserError("errors.countMissing");
    }
    const lines = compareCounts(assets, v.counts);
    const counts = Object.fromEntries(assets.map((a) => [a.id, v.counts[a.id]]));
    const miss = missingText(lines, t.guest_first_name, fmtDay(t.date), inr);

    check(
      await supabase
        .from("beehive_tasks")
        .update({ inventory: counts, inventory_at: new Date().toISOString(), inventory_by: s.userId, missing_count: miss.pieces })
        .eq("id", t.id),
    );

    const insertMissing = async () => {
      check(
        await supabase.from("beehive_issues").insert({
          apartment_id: t.apartment_id,
          category: "missing",
          priority: "urgent",
          status: "open",
          text: miss.text,
          booking_id: t.booking_id,
          task_id: t.id,
          guest_name: t.guest_first_name,
        }),
      );
    };

    // One missing-items issue per job: update the open one on a recount.
    const existing = check(
      await supabase
        .from("beehive_issues")
        .select("id")
        .eq("task_id", t.id)
        .eq("category", "missing")
        .eq("status", "open")
        .limit(1),
    ) as Array<{ id: string }>;

    if (existing.length) {
      const patch =
        miss.pieces > 0
          ? { text: miss.text, priority: "urgent" }
          : { text: `Recount after ${t.guest_first_name || "the guest"} checked out (${fmtDay(t.date)}): all items found.`, priority: "normal" };
      const updated = check(await supabase.from("beehive_issues").update(patch).eq("id", existing[0].id).select("id")) as Array<{ id: string }>;
      // Someone else's report cannot be edited by a housekeeper: add a new one instead.
      if (!updated.length && miss.pieces > 0) await insertMissing();
    } else if (miss.pieces > 0) {
      await insertMissing();
    }

    revalidateWork();
    revalidatePath("/maintenance");
    revalidatePath("/assets");
    return { missing: miss.pieces };
  });
}

// Manual jobs (owner) -----------------------------------------------------

const jobSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), id.optional()),
  kind: z.enum(MANUAL_KINDS),
  apartment_id: aptRequired,
  date: isoDate,
  time: optTime,
  note: optText(2000),
});

export async function saveJob(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const v = jobSchema.parse(input);
    const supabase = await createClient();
    const row = { kind: v.kind, apartment_id: v.apartment_id, date: v.date, time: v.time, note: v.note };
    if (v.id) {
      const rows = check(
        await supabase.from("beehive_tasks").update(row).eq("id", v.id).eq("auto", false).select("id"),
      ) as Array<{ id: string }>;
      if (!rows.length) throw new UserError("errors.manualOnlyEdit");
    } else {
      check(await supabase.from("beehive_tasks").insert({ ...row, auto: false, status: "pending" }));
    }
    revalidateWork();
  });
}

export async function deleteJob(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { taskId } = z.object({ taskId: id }).parse(input);
    const supabase = await createClient();
    const rows = check(
      await supabase.from("beehive_tasks").delete().eq("id", taskId).eq("auto", false).select("id"),
    ) as Array<{ id: string }>;
    if (!rows.length) throw new UserError("errors.manualOnlyDelete");
    revalidateWork();
  });
}
