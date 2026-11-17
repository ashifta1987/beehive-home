import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type Badges } from "@/components/shell/app-shell";
import { todayIST } from "@/lib/dates";
import { getBadgeCounts } from "@/lib/badges";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaffPage();
  const supabase = await createClient();
  const badges: Badges = await getBadgeCounts(supabase, s.staff.role, todayIST());
  return (
    <AppShell role={s.staff.role} name={s.staff.name ?? s.email ?? ""} badges={badges}>
      {children}
    </AppShell>
  );
}
