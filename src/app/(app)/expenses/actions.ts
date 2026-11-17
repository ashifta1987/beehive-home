"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, check, UserError, type ActionResult } from "@/lib/actions";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { aptId, isoDate, optText, rupees, uuid } from "../finance/_components/schema";
import { EXPENSE_CATEGORIES, PAID_VIA } from "./constants";

const expenseSchema = z.object({
  id: uuid.optional(),
  date: isoDate,
  amount: rupees,
  category: z.enum(EXPENSE_CATEGORIES),
  apartment_id: aptId,
  vendor: optText(120),
  paid_via: z.preprocess((v) => (v === "" ? null : v), z.enum(PAID_VIA).nullable().default(null)),
  note: optText(1000),
});

function revalidateMoney() {
  revalidatePath("/expenses");
  revalidatePath("/finance");
  revalidatePath("/today");
}

export async function saveExpense(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const { id, ...v } = expenseSchema.parse(input);
    const supabase = await createClient();
    if (id) {
      const rows = check(await supabase.from("beehive_expenses").update(v).eq("id", id).select("id"));
      if (!rows?.length) throw new UserError("This expense no longer exists. Refresh the page.");
    } else {
      check(await supabase.from("beehive_expenses").insert(v));
    }
    revalidateMoney();
  });
}

export async function deleteExpense(input: unknown): Promise<ActionResult<void>> {
  return action(async () => {
    await requireOwner();
    const id = uuid.parse(input);
    const supabase = await createClient();
    check(await supabase.from("beehive_expenses").delete().eq("id", id));
    revalidateMoney();
  });
}
