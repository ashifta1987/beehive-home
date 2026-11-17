/**
 * Standard result for server actions. Forms show `error` in plain words.
 * Usage in an action:
 *   export async function saveThing(input: unknown): Promise<ActionResult> {
 *     return action(async () => { await requireOwner(); ...; revalidatePath("/x"); });
 *   }
 */
import { ZodError } from "zod";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export async function action<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export class UserError extends Error {}

export function friendlyError(e: unknown): string {
  if (e instanceof UserError) return e.message;
  if (e instanceof ZodError) {
    const first = e.issues[0];
    const field = first?.path?.join(".");
    return field ? `Check "${field}": ${first.message}` : (first?.message ?? "Check the form.");
  }
  if (e && typeof e === "object") {
    const err = e as { name?: string; code?: string; message?: string };
    if (err.name === "AuthError" || err.message === "Not allowed") return "You do not have permission to do that.";
    if (err.code === "23P01") return "These dates overlap another booking in this apartment. Pick other dates or cancel the other booking first.";
    if (err.code === "23505") return "This already exists.";
    if (err.code === "23514") return "Some values are not allowed. Check the dates and numbers.";
    if (err.code === "42501") return "You do not have permission to do that.";
  }
  // Never leak internals to the browser; log on the server.
  console.error("[action]", e instanceof Error ? e.message : e);
  return "We could not save that. Check your connection and try again.";
}

/** Throw if a Supabase response has an error. */
export function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

/** Empty string → null for optional text fields. */
export const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

