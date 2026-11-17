import type { IconName } from "@/components/ui/icon";
import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  /** key in messages/<locale>/nav.json */
  label: string;
  /** shorter label for the bottom bar */
  short?: string;
  icon: IconName;
  /** key into the badge counts passed to the shell */
  badge?: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const OWNER_GROUPS: NavGroup[] = [
  { label: "overview", items: [
    { href: "/today", label: "today", icon: "home", badge: "alerts" },
    { href: "/calendar", label: "calendar", icon: "calendar" },
  ] },
  { label: "guests", items: [
    { href: "/bookings", label: "bookings", icon: "bookings" },
    { href: "/guests", label: "guests", icon: "guests" },
    { href: "/foreign", label: "foreign", icon: "globe", badge: "formc" },
    { href: "/extras", label: "extras", icon: "gift" },
    { href: "/checkins", label: "checkins", icon: "qr", badge: "checkins" },
  ] },
  { label: "care", items: [
    { href: "/jobs", label: "jobs", short: "jobsShort", icon: "jobs", badge: "jobs" },
    { href: "/care", label: "care", short: "careShort", icon: "care" },
    { href: "/laundry", label: "laundry", icon: "laundry" },
    { href: "/maintenance", label: "maintenance", icon: "wrench", badge: "issues" },
    { href: "/assets", label: "assets", short: "assetsShort", icon: "box" },
  ] },
  { label: "money", items: [
    { href: "/finance", label: "finance", icon: "chart" },
    { href: "/expenses", label: "expenses", icon: "receipt" },
    { href: "/petty", label: "petty", icon: "wallet" },
  ] },
  { label: "business", items: [
    { href: "/marketing", label: "marketing", icon: "megaphone" },
    { href: "/licences", label: "licences", icon: "badge" },
    { href: "/apartments", label: "apartments", icon: "building" },
    { href: "/settings", label: "settings", icon: "settings" },
  ] },
];

export const HOUSEKEEPER_GROUPS: NavGroup[] = [
  { label: "work", items: [
    { href: "/jobs", label: "myJobs", short: "jobsShort", icon: "jobs", badge: "jobs" },
    { href: "/care", label: "care", short: "careShort", icon: "care" },
    { href: "/laundry", label: "laundry", icon: "laundry" },
    { href: "/maintenance", label: "maintenance", short: "report", icon: "wrench" },
    { href: "/petty", label: "petty", icon: "wallet" },
    { href: "/assets", label: "assets", short: "assetsShort", icon: "box" },
    { href: "/apartments", label: "apartments", icon: "building" },
    { href: "/settings", label: "settings", icon: "settings" },
  ] },
];

/** Phone bottom bar: 4 items + More. The owner's centre item adds a booking. */
export const OWNER_BAR: NavItem[] = [
  { href: "/today", label: "today", icon: "home", badge: "alerts" },
  { href: "/calendar", label: "calendar", icon: "calendar" },
  { href: "/bookings?new=1", label: "addBooking", icon: "plus" },
  { href: "/jobs", label: "jobsShort", icon: "jobs", badge: "jobs" },
];
export const HOUSEKEEPER_BAR: NavItem[] = [
  { href: "/jobs", label: "jobsShort", icon: "jobs", badge: "jobs" },
  { href: "/care", label: "careShort", icon: "care" },
  { href: "/laundry", label: "laundry", icon: "laundry" },
  { href: "/maintenance", label: "report", icon: "wrench" },
];

export const groupsFor = (role: Role) => (role === "owner" ? OWNER_GROUPS : HOUSEKEEPER_GROUPS);
export const barFor = (role: Role) => (role === "owner" ? OWNER_BAR : HOUSEKEEPER_BAR);

/** Paths a housekeeper may open (everything else redirects to /jobs). */
export const HOUSEKEEPER_PATHS = ["/jobs", "/care", "/laundry", "/maintenance", "/petty", "/assets", "/apartments", "/settings"];
