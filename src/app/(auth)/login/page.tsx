import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (s?.staff) redirect(s.staff.role === "owner" ? "/today" : "/jobs");
  return (
    <main className="gutter flex min-h-dvh flex-col items-center justify-center py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-5">
        <div className="relative mx-auto flex w-[220px] -rotate-2 flex-col items-center gap-1 rounded-[26px] bg-tag1 px-5 pb-5 pt-4 text-tag1-ink shadow-tag">
          <span className="tag-hole" />
          <span className="mt-2 font-display text-[26px] font-extrabold leading-none tracking-[-0.03em]">Beehive</span>
          <span className="text-[12px] font-bold uppercase tracking-[0.08em]">Home · Kochi</span>
        </div>
        <LoginForm next={sp.next ?? ""} expired={sp.error === "expired"} />
      </div>
    </main>
  );
}
