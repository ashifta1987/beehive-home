import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "./types";
import { countOwnerBadges } from "./alerts";

/** Red count bubbles for the navigation. Keep these queries cheap (head counts only). */
export async function getBadgeCounts(supabase: SupabaseClient, role: Role, today: string) {
  const jobs = supabase.from("beehive_tasks").select("id", { count: "exact", head: true })
    .lte("date", today).neq("status", "done");
  if (role !== "owner") {
    const { count } = await jobs;
    return { jobs: count ?? 0 };
  }
  const [j, c, i, a] = await Promise.all([
    jobs,
    supabase.from("beehive_checkins").select("id", { count: "exact", head: true }).eq("reviewed", false),
    supabase.from("beehive_issues").select("id", { count: "exact", head: true }).eq("status", "open").in("priority", ["urgent"]),
    // alerts = red alerts on Today, formc = Form C due (see src/lib/alerts.ts)
    countOwnerBadges(supabase, today),
  ]);
  return { jobs: j.count ?? 0, checkins: c.count ?? 0, issues: i.count ?? 0, alerts: a.alerts, formc: a.formc };
}
