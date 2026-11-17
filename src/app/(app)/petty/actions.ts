"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { requireOwner, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { aptId, isoDate, optText, rupees, uuid } from "../finance/_components/schema";
import { PETTY_CATEGORIES, PETTY_TYPES } from "./constants";

const pettySchema = z.object({
  id: uuid.optional(),
  type: z.enum(PETTY_TYPES),
  date: isoDate,
  amount: rupees,
  category: z.enum(PETTY_CATEGORIES),
  apartment_id: aptId,
  note: optText(1000),
});

function revalidateMoney() {
  revalidatePath("/petty");
  revalidatePath("/finance");
  revalidatePath("/today");
}

/** Owner: add/edit any entry. Housekeeper: add, and edit only entries they created (also enforced by RLS). */
export async function savePetty(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    const s = await requireStaff();
    const { id, ...v } = pettySchema.parse(input);
    const supabase = await createClient();
    if (id) {
      if (s.staff.role !== "owner") {
        const row = check(await supabase.from("beehive_petty").select("created_by").eq("id", id).maybeSingle<{ created_by: string | null }>());
        if (!row) throw new UserError("This entry no longer exists. Refresh the page.");
        if (row.created_by !== s.userId) throw new UserError("You can only change entries you recorded. Ask the owner to fix this one.");
      }
      const rows = check(await supabase.from("beehive_petty").update(v).eq("id", id).select("id"));
      if (!rows?.length) throw new UserError("This entry could not be changed. Refresh the page and try again.");
    } else {
      check(await supabase.from("beehive_petty").insert(v));
    }
    revalidateMoney();
  });
}

export async function deletePetty(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const id = uuid.parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_petty").delete().eq("id", id));
    revalidateMoney();
  });
}
