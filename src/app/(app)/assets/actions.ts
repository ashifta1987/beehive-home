"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { requireOwner, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ASSET_CATEGORIES } from "@/components/jobs/constants";
import { aptRequired, bool, id, optDate, optInt, optText, reqInt, reqText } from "@/components/jobs/schemas";

function revalidateAssets() {
  revalidatePath("/assets");
  revalidatePath("/jobs");
}

const assetSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), id.optional()),
  apartment_id: aptRequired,
  name: reqText(120),
  category: z.enum(ASSET_CATEGORIES),
  room: optText(60),
  qty: reqInt(0, 10_000),
  value: optInt(0, 100_000_000),
  count_on_checkout: bool,
  purchased: optDate,
  warranty_until: optDate,
  serial: optText(120),
  note: optText(1000),
});

export async function saveAsset(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireStaff();
    const v = assetSchema.parse(input);
    if (v.purchased && v.warranty_until && v.warranty_until < v.purchased) {
      throw new UserError("errors.warrantyBeforePurchase");
    }
    const supabase = await createClient();
    const row = {
      apartment_id: v.apartment_id,
      name: v.name,
      category: v.category,
      room: v.room,
      qty: v.qty,
      value: v.value,
      count_on_checkout: v.count_on_checkout,
      purchased: v.purchased,
      warranty_until: v.warranty_until,
      serial: v.serial,
      note: v.note,
    };
    if (v.id) {
      const rows = check(await supabase.from("beehive_assets").update(row).eq("id", v.id).select("id")) as Array<{ id: string }>;
      if (!rows.length) throw new UserError("errors.gone");
    } else {
      check(await supabase.from("beehive_assets").insert(row));
    }
    revalidateAssets();
  });
}

export async function deleteAsset(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { assetId } = z.object({ assetId: id }).parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_assets").delete().eq("id", assetId));
    revalidateAssets();
  });
}
