import type { ExpenseCategory } from "@/lib/types";

export const EXPENSE_CATEGORIES = [
  "electricity", "water", "internet", "association", "repairs", "supplies", "laundry", "wages",
  "cleaning", "gas", "taxes", "marketing", "assets", "bank", "other",
] as const satisfies readonly ExpenseCategory[];

export const PAID_VIA = ["upi", "cash", "bank", "card"] as const;

/** English labels for the CSV export (UI uses the expenses namespace). */
export const EXPENSE_CATEGORY_EN: Record<ExpenseCategory, string> = {
  electricity: "Electricity",
  water: "Water",
  internet: "Internet & TV",
  association: "Association fee",
  repairs: "Repairs & maintenance",
  supplies: "Supplies & toiletries",
  laundry: "Laundry",
  wages: "Housekeeping wages",
  cleaning: "Cleaning & pest control",
  gas: "Cooking gas",
  taxes: "Taxes & licences",
  marketing: "Marketing",
  assets: "Furniture & assets",
  bank: "Bank & payment fees",
  other: "Other",
};

export const PAID_VIA_EN: Record<(typeof PAID_VIA)[number], string> = {
  upi: "UPI",
  cash: "Cash",
  bank: "Bank transfer",
  card: "Card",
};
