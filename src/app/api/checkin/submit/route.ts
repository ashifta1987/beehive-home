import { NextResponse, type NextRequest } from "next/server";
import { createAnonClient } from "@/components/portal/anon-client";
import { submitSchema, type SubmitResponse } from "@/components/portal/checkin-schema";

export const dynamic = "force-dynamic";

const json = (body: SubmitResponse, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Guest check-in submit. Validates with zod, then calls the security-definer function
 * beehive_guest_submit as anon (it re-checks the door key and rate-limits).
 * Never log or echo the door key.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const v = parsed.data;

  const payload = {
    apartment: v.apartment,
    key: v.key,
    full_name: v.full_name,
    phone: `${v.phone_code} ${v.phone.replace(/[^\d ]/g, "").replace(/\s+/g, " ").trim()}`,
    adults: v.adults,
    children: v.children,
    check_out: v.check_out,
    is_foreign: v.is_foreign,
    id_type: v.id_type,
    nationality: v.is_foreign ? v.nationality : null,
    passport_no: v.is_foreign ? v.passport_no?.toUpperCase() : null,
    passport_expiry: v.is_foreign ? v.passport_expiry : null,
    visa_no: v.is_foreign ? v.visa_no : null,
    visa_type: v.is_foreign ? v.visa_type : null,
    visa_expiry: v.is_foreign ? v.visa_expiry : null,
    arrived_india: v.is_foreign ? v.arrived_india : null,
    arriving_from: v.is_foreign ? v.arriving_from : null,
    next_destination: v.is_foreign ? v.next_destination : null,
    rules_accepted: true,
    lang: v.lang,
  };

  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase.rpc("beehive_guest_submit", { p: payload });
    if (error) {
      if (error.code === "28000") return json({ ok: false, error: "invalid_link" }, 403);
      if (error.code === "54000") return json({ ok: false, error: "rate_limited" }, 429);
      if (error.code === "22023" || error.code === "22007" || error.code === "22008") {
        return json({ ok: false, error: "invalid" }, 400);
      }
      console.error("[checkin/submit] rpc failed", error.code);
      return json({ ok: false, error: "server" }, 500);
    }
    const r = (data ?? {}) as Record<string, unknown>;
    const str = (x: unknown) => (typeof x === "string" && x ? x : null);
    if (!str(r.id)) {
      console.error("[checkin/submit] no id returned");
      return json({ ok: false, error: "server" }, 500);
    }
    return json({
      ok: true,
      id: r.id as string,
      code: str(r.code) ?? "",
      name: str(r.name) ?? "",
      check_out_time: str(r.check_out_time),
      wifi_name: str(r.wifi_name),
      wifi_password: str(r.wifi_password),
    });
  } catch (e) {
    console.error("[checkin/submit]", e instanceof Error ? e.name : "error");
    return json({ ok: false, error: "server" }, 500);
  }
}
