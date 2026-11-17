import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { signOut } from "../actions";
import { Button } from "@/components/ui/button";

export default async function NoAccess() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.staff) redirect("/");
  const t = await getTranslations("auth");
  return (
    <main className="gutter flex min-h-dvh items-center justify-center py-10">
      <div className="flex w-full max-w-[420px] flex-col gap-3 rounded-[24px] bg-surface p-6">
        <h1 className="font-display text-[20px] font-extrabold">{t("noAccessTitle")}</h1>
        <p className="text-[15px] text-muted">{t("noAccessBody", { email: s.email ?? "" })}</p>
        <form action={signOut}><Button type="submit" variant="secondary" className="w-full">{t("useOther")}</Button></form>
      </div>
    </main>
  );
}
