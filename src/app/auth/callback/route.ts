import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownerEmails } from "@/lib/owner";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  if (!ok) return NextResponse.redirect(new URL("/login?error=expired", url.origin));

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.redirect(new URL("/login?error=expired", url.origin));

  let { data: staff } = await supabase.from("beehive_staff").select("role, lang, active").eq("user_id", user.id).maybeSingle();

  // Owner bootstrap: an email listed in OWNER_EMAILS becomes the owner on first sign-in.
  if (!staff && user.email && ownerEmails().includes(user.email.toLowerCase())) {
    const admin = createAdminClient();
    const { error } = await admin.from("beehive_staff").insert({
      user_id: user.id, role: "owner", email: user.email, name: user.email.split("@")[0], lang: "en",
    });
    if (!error) staff = { role: "owner", lang: "en", active: true };
  }

  let dest = "/no-access";
  if (staff?.active) dest = next ?? (staff.role === "owner" ? "/today" : "/jobs");
  const res = NextResponse.redirect(new URL(dest, url.origin));
  if (staff?.lang) res.cookies.set("NEXT_LOCALE", staff.lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
