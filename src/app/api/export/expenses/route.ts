import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMonth, monthRange } from "@/lib/finance";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { EXPENSE_CATEGORY_EN, PAID_VIA_EN } from "@/app/(app)/expenses/constants";

export const dynamic = "force-dynamic";

/** Quote a CSV cell and defuse spreadsheet formulas (=, +, -, @, tab, CR at the start). */
function cell(v: string | number | null | undefined): string {
  if (v == null) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/export/expenses?m=YYYY-MM  → that month's expenses as CSV (owner only).
 * Without `m`, exports every expense.
 */
export async function GET(req: NextRequest) {
  try {
    await requireOwner();
  } catch {
    return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
  }

  const m = req.nextUrl.searchParams.get("m");
  if (m != null && !isMonth(m)) {
    return NextResponse.json({ error: "Use ?m=YYYY-MM" }, { status: 400 });
  }

  const supabase = await createClient();
  let q = supabase
    .from("beehive_expenses")
    .select("id,date,amount,category,apartment_id,vendor,paid_via,note")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  if (m) {
    const { start, end } = monthRange(m);
    q = q.gte("date", start).lt("date", end);
  }
  const [{ data, error }, apts] = await Promise.all([q, supabase.from("beehive_apartments").select("id,code")]);
  if (error || apts.error) {
    console.error("[export/expenses]", error?.message ?? apts.error?.message);
    return NextResponse.json({ error: "Could not load expenses. Try again." }, { status: 500 });
  }
  const code = Object.fromEntries(((apts.data ?? []) as { id: string; code: string }[]).map((a) => [a.id, a.code]));

  const header = ["Date", "Amount (INR)", "Category", "Apartment", "Paid to", "Paid by", "Note"];
  const lines = [header.join(",")];
  let total = 0;
  for (const e of (data ?? []) as Expense[]) {
    total += e.amount;
    lines.push(
      [
        cell(e.date),
        cell(e.amount),
        cell(EXPENSE_CATEGORY_EN[e.category as ExpenseCategory] ?? e.category),
        cell(e.apartment_id ? (code[e.apartment_id] ?? e.apartment_id) : "Both apartments"),
        cell(e.vendor),
        cell(e.paid_via ? PAID_VIA_EN[e.paid_via] : ""),
        cell(e.note),
      ].join(","),
    );
  }
  lines.push(["Total", cell(total), "", "", "", "", ""].join(","));

  const name = `beehive-expenses-${m ?? "all"}.csv`;
  // BOM so Excel opens the ₹/Malayalam text as UTF-8.
  return new NextResponse("\uFEFF" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
