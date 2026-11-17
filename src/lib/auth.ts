import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Staff } from "@/lib/types";

export interface Session {
  userId: string;
  email: string | null;
  staff: Staff | null;
}

/** The signed-in user and their beehive_staff row (cached per request). */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const { data: staff } = await supabase
    .from("beehive_staff")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Staff>();
  return { userId: user.id, email: user.email ?? null, staff: staff && staff.active ? staff : null };
});

/** For pages: any active staff member, else redirect. */
export async function requireStaffPage(): Promise<Session & { staff: Staff }> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.staff) redirect("/no-access");
  return s as Session & { staff: Staff };
}

/** For pages: owner only. Housekeepers are sent to their jobs. */
export async function requireOwnerPage(): Promise<Session & { staff: Staff }> {
  const s = await requireStaffPage();
  if (s.staff.role !== "owner") redirect("/jobs");
  return s;
}

export class AuthError extends Error {}

/** For server actions / route handlers: re-check the role from the database. */
export async function requireStaff(): Promise<Session & { staff: Staff }> {
  const s = await getSession();
  if (!s?.staff) throw new AuthError("Not allowed");
  return s as Session & { staff: Staff };
}

export async function requireOwner(): Promise<Session & { staff: Staff }> {
  const s = await requireStaff();
  if (s.staff.role !== "owner") throw new AuthError("Not allowed");
  return s;
}
