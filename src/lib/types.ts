// Row types for every beehive_ table (see supabase/migrations). Dates are ISO 'YYYY-MM-DD',
// times 'HH:MM:SS', timestamps ISO strings. Money is whole rupees.

export type Role = "owner" | "housekeeper";
export type TagColour = "tag1" | "tag2" | "tag3" | "tag4";
export type Channel = "airbnb" | "booking" | "direct" | "other";

export interface Staff {
  user_id: string;
  role: Role;
  name: string | null;
  email: string | null;
  phone: string | null;
  lang: "en" | "ml";
  active: boolean;
  created_at: string;
}

export interface Apartment {
  id: string;
  name: string;
  code: string;
  sort: number;
  tag_colour: TagColour;
  location: string | null;
  bedrooms: number | null;
  max_guests: number | null;
  features: string[];
  check_in_time: string;
  check_out_time: string;
  cleaning_checklist: string[];
  arrival_checklist: string[];
  house_rules: string[];
  welcome_message: string | null;
  hk_notes: string | null;
  wifi_name: string | null;
  wifi_password: string | null;
}

export type PaymentStatus = "channel" | "paid" | "partial" | "pending";
export type DepositStatus = "none" | "held" | "refunded" | "deducted";
export type BookingStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled";

export interface Booking {
  id: string;
  apartment_id: string;
  channel: Channel;
  channel_ref: string | null;
  guest_name: string;
  phone: string | null;
  email: string | null;
  adults: number;
  children: number;
  check_in: string;
  check_out: string;
  check_in_time: string | null;
  check_out_time: string | null;
  total: number;
  commission: number;
  payment_status: PaymentStatus;
  deposit: number;
  deposit_status: DepositStatus;
  status: BookingStatus;
  id_verified: boolean;
  foreign_national: boolean;
  share_phone: boolean;
  hk_note: string | null;
  notes: string | null;
  review_asked: boolean;
  ical_uid: string | null;
  created_at: string;
  updated_at: string | null;
}

export type GuestTag = "none" | "repeat" | "vip" | "blocked";
export interface GuestProfile {
  key: string;
  tag: GuestTag;
  rating: number | null;
  nationality: string | null;
  city: string | null;
  notes: string | null;
}

export interface ForeignRecord {
  booking_id: string;
  nationality: string | null;
  passport_no: string | null;
  passport_expiry: string | null;
  visa_no: string | null;
  visa_type: string | null;
  visa_expiry: string | null;
  arrived_india: string | null;
  arriving_from: string | null;
  next_destination: string | null;
  docs_collected: boolean;
  form_c_submitted: boolean;
  form_c_ref: string | null;
  form_c_date: string | null;
  note: string | null;
}

export type TaskKind = "turnover" | "arrival" | "deep" | "inspection" | "maintenance" | "laundry" | "other";
export type TaskStatus = "pending" | "in_progress" | "done";
export type Condition = "ok" | "messy" | "damaged";

export interface Task {
  id: string;
  kind: TaskKind;
  apartment_id: string;
  booking_id: string | null;
  auto: boolean;
  date: string;
  time: string | null;
  status: TaskStatus;
  checks: Record<string, boolean>;
  note: string | null;
  hk_notes: string | null;
  completed_at: string | null;
  completed_by: string | null;
  guest_first_name: string | null;
  guests: number | null;
  guest_phone: string | null;
  channel: Channel | null;
  is_foreign: boolean;
  next_arrival: string | null;
  next_arrival_time: string | null;
  next_guests: number | null;
  extras_setup: string[];
  extras_collect: string[];
  hk_note: string | null;
  /** asset id → counted quantity */
  inventory: Record<string, number> | null;
  inventory_at: string | null;
  inventory_by: string | null;
  missing_count: number | null;
  condition: Condition | null;
  condition_note: string | null;
  condition_at: string | null;
  created_at: string;
}

export type IssueCategory =
  | "maintenance" | "electrical" | "plumbing" | "appliance" | "hygiene"
  | "supplies" | "damage" | "missing" | "mess" | "other";
export type IssuePriority = "low" | "normal" | "urgent";

export interface Issue {
  id: string;
  apartment_id: string | null;
  category: IssueCategory;
  priority: IssuePriority;
  status: "open" | "resolved";
  text: string;
  booking_id: string | null;
  task_id: string | null;
  guest_name: string | null;
  extra_hours: number | null;
  reported_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution: string | null;
  cost: number | null;
  created_at: string;
}

export type ScheduleCategory =
  | "hygiene" | "airfilter" | "purifier" | "watertest" | "deepclean" | "acservice" | "pest" | "safety" | "other";
export interface Schedule {
  id: string;
  name: string;
  category: ScheduleCategory;
  apartment_id: string | null;
  every_days: number;
  last_done: string | null;
  last_result: string | null;
  who: "housekeeper" | "technician" | "owner";
  vendor: string | null;
  note: string | null;
}
export interface ScheduleLog {
  id: string;
  schedule_id: string;
  apartment_id: string | null;
  date: string;
  result: string | null;
  note: string | null;
  cost: number | null;
  done_by: string | null;
  created_at: string;
}

export type AssetCategory =
  | "appliance" | "electronics" | "furniture" | "linen" | "kitchen" | "bathroom" | "decor" | "safety" | "other";
export interface Asset {
  id: string;
  apartment_id: string;
  name: string;
  category: AssetCategory;
  room: string | null;
  qty: number;
  value: number | null;
  count_on_checkout: boolean;
  purchased: string | null;
  warranty_until: string | null;
  serial: string | null;
  note: string | null;
}

export interface Laundry {
  id: string;
  apartment_id: string | null;
  vendor: string | null;
  sent_date: string;
  items_sent: number;
  details: string | null;
  returned_date: string | null;
  items_returned: number | null;
  cost: number | null;
  note: string | null;
}

export type PettyCategory = "supplies" | "laundry" | "cleaning" | "repairs" | "transport" | "guest" | "other";
export interface Petty {
  id: string;
  type: "in" | "out";
  date: string;
  amount: number;
  category: PettyCategory;
  apartment_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export type ExpenseCategory =
  | "electricity" | "water" | "internet" | "association" | "repairs" | "supplies" | "laundry" | "wages"
  | "cleaning" | "gas" | "taxes" | "marketing" | "assets" | "bank" | "other";
export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  apartment_id: string | null;
  vendor: string | null;
  paid_via: "upi" | "cash" | "bank" | "card" | null;
  note: string | null;
}

export type ExtraUnit = "use" | "day" | "night" | "hour" | "event" | "item";
export interface Extra {
  id: string;
  name: string;
  price: number | null;
  unit: ExtraUnit;
  apartment_id: string | null;
  qty: number | null;
  deposit: number | null;
  description: string | null;
  setup_note: string | null;
  return_check: boolean;
  active: boolean;
}

export type BookingExtraStatus = "requested" | "confirmed" | "delivered" | "returned" | "cancelled";
export interface BookingExtra {
  id: string;
  booking_id: string;
  extra_id: string | null;
  name: string;
  unit: string;
  qty: number;
  units: number;
  price: number;
  total: number;
  date: string;
  status: BookingExtraStatus;
  paid: boolean;
}

export interface Licence {
  id: string;
  name: string;
  number: string | null;
  issued_by: string | null;
  apartment_id: string | null;
  issued: string | null;
  expires: string | null;
  remind_days: number;
  note: string | null;
  file_path: string | null;
}

export interface Listing {
  id: string;
  apartment_id: string;
  channel: Channel;
  title: string | null;
  url: string | null;
  price: number | null;
  status: "live" | "paused" | "draft";
  rating: number | null;
  reviews: number | null;
  note: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  channel: "all" | "airbnb" | "booking" | "direct" | "instagram" | "whatsapp" | "google";
  spend: number;
  start: string | null;
  end: string | null;
  offer: string | null;
  result: string | null;
}

export interface DoorKey {
  apartment: string;
  label: string | null;
  door_key: string;
}

export interface Checkin {
  id: string;
  apartment: string;
  created_at: string;
  full_name: string | null;
  phone: string | null;
  adults: number | null;
  children: number | null;
  check_out: string | null;
  is_foreign: boolean | null;
  id_type: string | null;
  nationality: string | null;
  passport_no: string | null;
  passport_expiry: string | null;
  visa_no: string | null;
  visa_type: string | null;
  visa_expiry: string | null;
  arrived_india: string | null;
  arriving_from: string | null;
  next_destination: string | null;
  lang: string | null;
  rules_accepted_at: string | null;
  has_photo: boolean | null;
  photo_count: number | null;
  booking_id: string | null;
  reviewed: boolean;
}

export interface CheckinFile {
  id: string;
  checkin_id: string;
  path: string;
  mime: string;
  created_at: string;
}

export type AlertLevel = "bad" | "warn";
export interface Alert {
  level: AlertLevel;
  /** Short label shown as a coloured chip, e.g. "FORM C" */
  label: string;
  text: string;
  href?: string;
  apartment_id?: string | null;
}
