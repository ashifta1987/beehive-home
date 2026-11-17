import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_PHOTO_BYTES, PHOTO_MIME, type PhotoResponse } from "@/components/portal/checkin-schema";

export const dynamic = "force-dynamic";

const BUCKET = "beehive-ids";
const UPLOAD_WINDOW_MS = 60 * 60 * 1000;

const fieldsSchema = z.object({
  apartment: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  key: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/),
  checkin_id: z.uuid(),
});

const json = (body: PhotoResponse, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Check the file really is the image type it claims (magic bytes). */
function sniff(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mime === "image/webp") {
    const ascii = (a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));
    return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  }
  return false;
}

/**
 * Guest ID photo upload (multipart: apartment, key, checkin_id, file).
 * Re-checks the door key, that the check-in belongs to that apartment, is less than an
 * hour old and has room for another photo; then stores it in the private bucket with
 * the service role. Never log or echo the door key.
 */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }
  const parsed = fieldsSchema.safeParse({
    apartment: form.get("apartment"),
    key: form.get("key"),
    checkin_id: form.get("checkin_id"),
  });
  const file = form.get("file");
  if (!parsed.success || !(file instanceof Blob)) return json({ ok: false, error: "invalid" }, 400);
  const { apartment, key, checkin_id } = parsed.data;

  const mime = file.type;
  if (!(PHOTO_MIME as readonly string[]).includes(mime) || file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    return json({ ok: false, error: "invalid" }, 400);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniff(bytes, mime)) return json({ ok: false, error: "invalid" }, 400);

  try {
    const admin = createAdminClient();

    const { data: door, error: doorErr } = await admin
      .from("beehive_door_keys")
      .select("apartment")
      .eq("apartment", apartment)
      .eq("door_key", key)
      .maybeSingle();
    if (doorErr) throw doorErr;
    if (!door) return json({ ok: false, error: "invalid_link" }, 403);

    const { data: checkin, error: ciErr } = await admin
      .from("beehive_checkins")
      .select("id, apartment, created_at, adults")
      .eq("id", checkin_id)
      .maybeSingle<{ id: string; apartment: string; created_at: string; adults: number | null }>();
    if (ciErr) throw ciErr;
    if (!checkin || checkin.apartment !== apartment) return json({ ok: false, error: "invalid" }, 400);
    if (Date.now() - new Date(checkin.created_at).getTime() > UPLOAD_WINDOW_MS) {
      return json({ ok: false, error: "expired" }, 403);
    }

    const { count, error: cntErr } = await admin
      .from("beehive_checkin_files")
      .select("id", { count: "exact", head: true })
      .eq("checkin_id", checkin_id);
    if (cntErr) throw cntErr;
    const existing = count ?? 0;
    if (existing >= (checkin.adults ?? 1) + 1) return json({ ok: false, error: "too_many" }, 403);

    const path = `${apartment}/${checkin_id}/${randomUUID()}.${EXT[mime]}`;
    const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
    if (up.error) throw up.error;

    const ins = await admin.from("beehive_checkin_files").insert({ checkin_id, path, mime });
    if (ins.error) {
      await admin.storage.from(BUCKET).remove([path]);
      throw ins.error;
    }

    const upd = await admin
      .from("beehive_checkins")
      .update({ has_photo: true, photo_count: existing + 1 })
      .eq("id", checkin_id);
    if (upd.error) throw upd.error;

    return json({ ok: true });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    console.error("[checkin/photo] failed", code || (e instanceof Error ? e.name : "error"));
    return json({ ok: false, error: "server" }, 500);
  }
}
