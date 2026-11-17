"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

const aptId = z.string().min(1).max(40).regex(/^[a-z0-9-]+$/);

/** Make a new random door key (24 hex chars). Old posters stop working at once. */
export async function rotateDoorKey(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const apartment = aptId.parse(input);
    const supabase = await createClient();
    const { data: apt } = await supabase.from("beehive_apartments").select("id, code").eq("id", apartment).maybeSingle<{ id: string; code: string }>();
    if (!apt) throw new UserError("That apartment no longer exists.");
    const door_key = randomBytes(12).toString("hex");
    check(
      await supabase
        .from("beehive_door_keys")
        .upsert({ apartment: apt.id, label: apt.code, door_key }, { onConflict: "apartment" }),
    );
    revalidatePath("/posters");
  });
}
