import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nights, todayIST } from "@/lib/dates";
import { CHANNEL_LABEL } from "@/lib/guest";
import { toCSV } from "@/lib/bookings";
import type { Booking } from "@/lib/types";

const PAY: Record<string, string> = { channel: "Paid via channel", paid: "Paid", partial: "Part paid", pending: "Not paid yet" };
const STATUS: Record<string, string> = { confirmed: "Confirmed", checked_in: "Checked in", checked_out: "Checked out", cancelled: "Cancelled" };
const DEP: Record<string, string> = { none: "None", held: "Held", refunded: "Refunded", deducted: "Deducted" };

/** Bookings CSV (SPEC § 4.5). Owner only: the role is re-checked here, and RLS applies too. */
export async function GET() {
  try {
    await requireOwner();
  } catch {
    return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
  }
  const supabase = await createClient();
  const [bookings, apartments, foreign, extras] = await Promise.all([
    supabase.from("beehive_bookings").select("*").order("check_in"),
    supabase.from("beehive_apartments").select("id,name"),
    supabase.from("beehive_foreign_records").select("booking_id,form_c_submitted"),
    supabase.from("beehive_booking_extras").select("booking_id,total,status"),
  ]);
  if (bookings.error || apartments.error || foreign.error || extras.error) {
    console.error("[export/bookings]", bookings.error?.message ?? apartments.error?.message ?? foreign.error?.message ?? extras.error?.message);
    return NextResponse.json({ error: "We could not build the file. Try again in a minute." }, { status: 500 });
  }

  const aptName = new Map((apartments.data ?? []).map((a: { id: string; name: string }) => [a.id, a.name]));
  const formC = new Map(
    (foreign.data ?? []).map((f: { booking_id: string; form_c_submitted: boolean }) => [f.booking_id, f.form_c_submitted]),
  );
  const extrasBy = new Map<string, number>();
  for (const x of (extras.data ?? []) as { booking_id: string; total: number; status: string }[]) {
    if (x.status !== "cancelled") extrasBy.set(x.booking_id, (extrasBy.get(x.booking_id) ?? 0) + x.total);
  }

  const header = [
    "Apartment", "Channel", "Reference", "Guest", "Phone", "Email", "Adults", "Children",
    "Check-in", "Check-out", "Nights", "Total INR", "Commission INR", "Net INR", "Extras INR",
    "Payment", "Status", "ID verified", "Foreign national", "Form C submitted", "Deposit INR", "Deposit status",
  ];
  const rows = ((bookings.data ?? []) as Booking[]).map((b) => [
    aptName.get(b.apartment_id) ?? b.apartment_id,
    CHANNEL_LABEL[b.channel] ?? b.channel,
    b.channel_ref,
    b.guest_name,
    b.phone,
    b.email,
    b.adults,
    b.children,
    b.check_in,
    b.check_out,
    nights(b.check_in, b.check_out),
    b.total,
    b.commission,
    b.total - b.commission,
    extrasBy.get(b.id) ?? 0,
    PAY[b.payment_status] ?? b.payment_status,
    STATUS[b.status] ?? b.status,
    b.id_verified ? "Yes" : "No",
    b.foreign_national ? "Yes" : "No",
    b.foreign_national ? (formC.get(b.id) ? "Yes" : "No") : "",
    b.deposit,
    DEP[b.deposit_status] ?? b.deposit_status,
  ]);

  // BOM so Excel opens the UTF-8 file with the right characters (₹, Malayalam names).
  const body = "\uFEFF" + toCSV([header, ...rows]) + "\r\n";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="beehive-bookings-${todayIST()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
