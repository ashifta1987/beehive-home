import { timingSafeEqual, createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAlerts, loadAlertData } from "@/lib/alerts";
import { todayIST } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Constant-time comparison (hash both sides so lengths never leak). */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) && given.length === expected.length;
}

/**
 * Daily 07:00 IST (Vercel Cron `30 1 * * *`, see vercel.json; SPEC § 7).
 * 1. Re-syncs auto jobs for every apartment (keeps "today - 2" windows fresh).
 * 2. Computes the owner alert list and stores it as today's digest row.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || !given || !sameSecret(given, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const day = todayIST();
  try {
    const admin = createAdminClient();
    const sync = await admin.rpc("beehive_sync_all_tasks");
    if (sync.error) throw new Error(`sync failed: ${sync.error.message}`);

    const alerts = computeAlerts(await loadAlertData(admin, day), day);
    const up = await admin.from("beehive_digests").upsert({ day, alerts }, { onConflict: "day" });
    if (up.error) throw new Error(`digest failed: ${up.error.message}`);

    const red = alerts.filter((a) => a.level === "bad").length;
    return NextResponse.json({ ok: true, day, alerts: alerts.length, red });
  } catch (e) {
    // Messages above never contain secrets or guest data; DB messages are generic.
    console.error("[cron/daily]", e instanceof Error ? e.message : "unknown error");
    return NextResponse.json({ ok: false, error: "Daily job failed" }, { status: 500 });
  }
}
