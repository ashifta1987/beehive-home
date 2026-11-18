import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (s?.staff) redirect(s.staff.role === "owner" ? "/today" : "/jobs");
  return (
    <main className="gutter flex min-h-dvh flex-col items-center justify-center py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-5">
        <div className="mx-auto rounded-[24px] bg-ink px-6 py-6 text-surface shadow-tag">
          <Logo size={22} tagline />
        </div>
        <LoginForm next={sp.next ?? ""} expired={sp.error === "expired"} />
      </div>
    </main>
  );
}
