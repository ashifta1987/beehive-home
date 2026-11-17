"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ownerEmails } from "@/lib/owner";

export type LoginState = { status: "idle" | "sent" | "error"; error?: string };

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = z.string().trim().toLowerCase().email().max(200).safeParse(form.get("email"));
  if (!parsed.success) return { status: "error", error: "invalidEmail" };
  const email = parsed.data;
  const next = String(form.get("next") ?? "");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Only the owner email(s) may create a new account; housekeepers are invited by the owner.
      shouldCreateUser: ownerEmails().includes(email),
      emailRedirectTo: `${site}/auth/callback${next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : ""}`,
    },
  });
  // Do not reveal whether an account exists: unknown emails also see "sent".
  if (error && !/signups not allowed|user not found/i.test(error.message)) {
    console.error("[login]", error.message);
    return { status: "error", error: "failed" };
  }
  return { status: "sent" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
