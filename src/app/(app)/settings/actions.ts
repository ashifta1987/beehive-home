"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireOwner, requireStaff } from "@/lib/auth";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v ? v : null))
    .nullable()
    .optional();

const phone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || /^\+?[0-9 ()-]{6,30}$/.test(v), "Enter a phone number with digits only")
  .transform((v) => (v ? v : null))
  .nullable()
  .optional();

const lang = z.enum(["en", "ml"]);
const userId = z.uuid();

const LOCALE_COOKIE = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Find an existing auth user by email (service role, paged). */
async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < perPage) break;
  }
  return null;
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(200)),
  name: z.string().trim().min(1).max(80),
  phone,
  lang,
});

/** Owner adds a housekeeper by email: invite (or reuse an existing account), then add the staff row. */
export async function inviteHousekeeper(input: unknown): Promise<ActionResult<{ invited: boolean }>> {
  return action(async () => {
    const s = await requireOwner();
    const v = inviteSchema.parse(input);
    const supabase = await createClient();

    // Already on the team? (owner can read every staff row)
    const { data: byEmail } = await supabase.from("beehive_staff").select("user_id").eq("email", v.email).maybeSingle();
    if (byEmail) throw new UserError("This email is already on the team.");

    const admin = createAdminClient();
    let uid: string | null = null;
    let invited = false;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(v.email, { redirectTo: `${siteUrl()}/auth/callback` });
    if (!error && data.user) {
      uid = data.user.id;
      invited = true;
    } else if (error && (error.code === "email_exists" || /already (been )?registered|already exists/i.test(error.message))) {
      uid = await findUserIdByEmail(admin, v.email);
    } else if (error) {
      console.error("[settings] invite failed", error.code ?? error.status);
      if (error.status === 429) throw new UserError("Too many invites were sent. Wait an hour and try again.");
      throw new UserError("We could not send the invite. Check the email address and try again.");
    }
    if (!uid) throw new UserError("We could not find or create an account for this email. Try again.");

    const { data: existing } = await supabase.from("beehive_staff").select("role").eq("user_id", uid).maybeSingle<{ role: string }>();
    if (existing) throw new UserError(existing.role === "owner" ? "This person is the owner." : "This person is already on the team.");

    check(
      await supabase.from("beehive_staff").insert({
        user_id: uid,
        role: "housekeeper",
        name: v.name,
        email: v.email,
        phone: v.phone ?? null,
        lang: v.lang,
        active: true,
        created_by: s.userId,
      }),
    );
    revalidatePath("/settings");
    return { invited };
  });
}

const updateSchema = z.object({
  userId,
  name: z.string().trim().min(1).max(80),
  phone,
  lang,
  active: z.boolean(),
});

/** Owner edits a staff member's name, phone, language and active flag. */
export async function updateStaff(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    const s = await requireOwner();
    const v = updateSchema.parse(input);
    if (v.userId === s.userId && !v.active) throw new UserError("You cannot switch off your own access.");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("beehive_staff")
      .update({ name: v.name, phone: v.phone ?? null, lang: v.lang, active: v.active })
      .eq("user_id", v.userId)
      .select("user_id");
    if (error) throw error;
    if (!data || data.length === 0) throw new UserError("This person is no longer on the team.");
    revalidatePath("/settings");
  });
}

/** Owner removes a housekeeper's access (the login itself is left alone). */
export async function removeStaff(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    const s = await requireOwner();
    const id = userId.parse(input);
    if (id === s.userId) throw new UserError("You cannot remove yourself.");
    const supabase = await createClient();
    const { data: row } = await supabase.from("beehive_staff").select("role").eq("user_id", id).maybeSingle<{ role: string }>();
    if (!row) throw new UserError("This person is no longer on the team.");
    if (row.role === "owner") throw new UserError("The owner cannot be removed here.");
    check(await supabase.from("beehive_staff").delete().eq("user_id", id));
    revalidatePath("/settings");
  });
}

const profileSchema = z.object({ name: optText(80), phone });

/** Anyone: change their own name and phone (scoped to the caller's own row). */
export async function updateMyProfile(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    const s = await requireStaff();
    const v = profileSchema.parse(input);
    if (!v.name) throw new UserError("Enter your name.");
    // RLS lets only the owner update staff rows, so use the service role — strictly
    // limited to the caller's own user_id and to these columns.
    const admin = createAdminClient();
    check(await admin.from("beehive_staff").update({ name: v.name, phone: v.phone ?? null }).eq("user_id", s.userId));
    revalidatePath("/", "layout");
  });
}

/** Anyone: change their own language; also sets the NEXT_LOCALE cookie. */
export async function setMyLanguage(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    const s = await requireStaff();
    const l = lang.parse(input);
    const admin = createAdminClient();
    check(await admin.from("beehive_staff").update({ lang: l }).eq("user_id", s.userId));
    const store = await cookies();
    store.set("NEXT_LOCALE", l, LOCALE_COOKIE);
    revalidatePath("/", "layout");
  });
}
