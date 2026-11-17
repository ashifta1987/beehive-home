import type { BookingExtraStatus, ExtraUnit } from "@/lib/types";

export const EXTRA_UNITS = ["use", "day", "night", "hour", "event", "item"] as const satisfies readonly ExtraUnit[];
export const BOOKING_EXTRA_STATUSES = ["requested", "confirmed", "delivered", "returned", "cancelled"] as const satisfies readonly BookingExtraStatus[];

/** A booked extra with the few booking fields the extras page shows. */
export interface BookedExtraRow {
  id: string;
  booking_id: string;
  name: string;
  unit: string;
  qty: number;
  units: number;
  price: number;
  total: number;
  date: string;
  status: BookingExtraStatus;
  paid: boolean;
  guest_name: string;
  apartment_id: string;
  check_in: string;
  check_out: string;
}
