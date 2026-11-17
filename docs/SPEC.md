# Beehive Home — product specification

Version 1.0 · 18 November 2026 · Owner-approved design: "Key Tags"

This spec describes the production version of the prototype in
`docs/reference/prototype.html`. Where this document and the prototype disagree, this
document wins.

---

## 1. People and access

| Role | Who | Signs in with | Sees |
|---|---|---|---|
| **Owner** | Apartment owner, abroad | Supabase Auth, email magic link | Everything |
| **Housekeeper** | One person in Kochi (more later) | Supabase Auth, email magic link or Google | Only their work (see § 2) |
| **Guest** | Each stay | No account. Scans the door QR | Only the check-in form for that apartment |

Roles live in `beehive_staff (user_id, role)`. A signed-in user with no row there sees
a "Ask the owner for access" screen and nothing else. The owner adds staff from
**Settings › People** by email.

> Decision for the owner: SMS/phone OTP needs a paid SMS provider. Default is email
> magic link. Switch later if the housekeeper has no email.

## 2. Privacy map

| Data | Owner | Housekeeper | Guest (anon) |
|---|---|---|---|
| Apartments (names, checklists, notes) | read/write | read | — |
| Bookings, payments, deposits, guest phone/email | read/write | — (only what jobs copy, below) | — |
| Guest profiles, tags, notes | read/write | — | — |
| Foreign guest records (passport, visa, Form C) | read/write | — | — |
| Check-ins and ID photos | read/write | — | insert only, via function |
| Jobs (tasks) | read/write | read, update status/checks/notes/inventory/condition | — |
| Periodic care + log | read/write | read/write | — |
| Maintenance issues | read/write | read, insert, update own reports | — |
| Assets & inventory | read/write | read/write | — |
| Laundry | read/write | read/write | — |
| Petty cash | read/write | read, insert, update own entries | — |
| Paid extras catalog | read/write | read | — |
| Booking extras (what a guest ordered) | read/write | — (jobs copy names only) | — |
| Expenses, finance, licences, listings, campaigns | read/write | — | — |

Housekeeper jobs carry a **copy** of what the housekeeper needs: guest first name,
guest count, arrival/departure time, next arrival, the guest phone only when the
booking's `share_phone` is true, the foreign-guest flag, set-up and collect lists for
extras, and the booking's note for the housekeeper. They never get a join into bookings.

## 3. Data model

All tables: `id uuid primary key default gen_random_uuid()` unless noted,
`created_at timestamptz default now()`, `updated_at timestamptz` (trigger), and
`created_by uuid references auth.users` where a person creates rows.
Enums can be Postgres enums or `text` + `check`; pick one style and keep it.

### 3.1 Core

**beehive_staff** — `user_id uuid pk → auth.users`, `role text check (owner|housekeeper)`,
`name`, `phone`, `lang text default 'en' check (en|ml)`, `active bool default true`.
Helper functions (security definer, stable): `beehive_is_owner()`, `beehive_is_staff()`.

**beehive_apartments** — `id text pk` (`apt-1bhk`, `apt-2bhk`; the door keys use these
ids), `name`, `code` (short label, e.g. 1BHK), `sort int`, `tag_colour text`
(token name `tag1`…`tag4`), `location`, `bedrooms int`, `max_guests int`,
`features text[]`, `check_in_time time default '14:00'`, `check_out_time time default
'11:00'`, `cleaning_checklist text[]`, `arrival_checklist text[]`, `house_rules text[]`,
`welcome_message text`, `hk_notes text`, `wifi_name text`, `wifi_password text`.
Guests may read only `name, code, check_out_time, house_rules, wifi_name, wifi_password`
of one apartment, and only through a function that checks the door key
(`beehive_guest_apartment(p_apartment, p_key)`); Wi-Fi details are returned only
after a successful check-in submit.

**beehive_bookings** — `apartment_id → apartments`, `channel (airbnb|booking|direct|other)`,
`channel_ref`, `guest_name not null`, `phone`, `email`, `adults int default 2`,
`children int default 0`, `check_in date not null`, `check_out date not null`
(`check (check_out > check_in)`), `check_in_time time`, `check_out_time time`,
`total int default 0`, `commission int default 0`,
`payment_status (channel|paid|partial|pending)`, `deposit int default 0`,
`deposit_status (none|held|refunded|deducted)`,
`status (confirmed|checked_in|checked_out|cancelled)`, `id_verified bool`,
`foreign_national bool`, `share_phone bool default true`, `hk_note`, `notes`,
`review_asked bool default false`, `ical_uid text unique` (for channel sync, § 8).

Double bookings are impossible at database level:
```sql
create extension if not exists btree_gist;
alter table beehive_bookings add constraint beehive_bookings_no_overlap
  exclude using gist (apartment_id with =, daterange(check_in, check_out, '[)') with &&)
  where (status <> 'cancelled');
```

**beehive_guest_profiles** — `key text pk` (see § 4.6), `tag (none|repeat|vip|blocked)`,
`rating int null check 1..5`, `nationality`, `city`, `notes`.

**beehive_foreign_records** — `booking_id uuid pk → bookings on delete cascade`,
`nationality`, `passport_no`, `passport_expiry date`, `visa_no`, `visa_type`,
`visa_expiry date`, `arrived_india date`, `arriving_from`, `next_destination`,
`docs_collected bool`, `form_c_submitted bool`, `form_c_ref`, `form_c_date date`, `note`.

### 3.2 Work

**beehive_tasks** — `kind (turnover|arrival|deep|inspection|maintenance|laundry|other)`,
`apartment_id`, `booking_id null → bookings on delete cascade`, `auto bool` (true for
turnover/arrival made from bookings; unique on `(booking_id, kind)` when auto),
`date date`, `time time`, `status (pending|in_progress|done)`, `checks jsonb default '{}'`
(index → bool), `note` (owner instructions), `hk_notes`, `completed_at`, `completed_by`,
copied booking fields: `guest_first_name`, `guests int`, `guest_phone`, `channel`,
`is_foreign bool`, `next_arrival date`, `next_arrival_time time`, `next_guests int`,
`extras_setup text[]`, `extras_collect text[]`;
theft & condition fields: `inventory jsonb`, `inventory_at`, `inventory_by`,
`missing_count int`, `condition (ok|messy|damaged) null`, `condition_note`, `condition_at`.

**beehive_issues** — `apartment_id null` (null = both), `category
(maintenance|electrical|plumbing|appliance|hygiene|supplies|damage|missing|mess|other)`,
`priority (low|normal|urgent)`, `status (open|resolved)`, `text not null`,
`booking_id null`, `reported_by`, `resolved_at`, `resolved_by`, `resolution`, `cost int`.

**beehive_schedules** (periodic care) — `name`, `category
(hygiene|airfilter|purifier|watertest|deepclean|acservice|pest|safety|other)`,
`apartment_id null` (null = both), `every_days int not null`, `last_done date`,
`last_result`, `who (housekeeper|technician|owner)`, `vendor`, `note`.
**beehive_schedule_log** — `schedule_id`, `apartment_id`, `date`, `result`, `note`,
`cost int`, `done_by`.

**beehive_assets** — `apartment_id not null`, `name`, `category
(appliance|electronics|furniture|linen|kitchen|bathroom|decor|safety|other)`, `room`,
`qty int default 1`, `value int` (per item), `count_on_checkout bool`, `purchased date`,
`warranty_until date`, `serial`, `note`.

**beehive_laundry** — `apartment_id null`, `vendor`, `sent_date`, `items_sent int`,
`details`, `returned_date`, `items_returned int`, `cost int`, `note`.

### 3.3 Money

**beehive_petty** — `type (in|out)`, `date`, `amount int`, `category
(supplies|laundry|cleaning|repairs|transport|guest|other)`, `apartment_id null`, `note`.
**beehive_expenses** — `date`, `amount int`, `category (electricity|water|internet|
association|repairs|supplies|laundry|wages|cleaning|gas|taxes|marketing|assets|bank|other)`,
`apartment_id null`, `vendor`, `paid_via (upi|cash|bank|card)`, `note`.
**beehive_extras** (catalog) — `name`, `price int null` (null = not set yet, show "Set
price"), `unit (use|day|night|hour|event|item)`, `apartment_id null`, `qty int`,
`deposit int`, `description`, `setup_note`, `return_check bool`, `active bool`
(active = offered to guests).
**beehive_booking_extras** — `booking_id → bookings on delete cascade`, `extra_id null`
(null for one-off charges), `name`, `unit`, `qty int`, `units int`, `price int`,
`total int generated always as (qty*units*price) stored`, `date`,
`status (requested|confirmed|delivered|returned|cancelled)`, `paid bool`.

### 3.4 Business

**beehive_licences** — `name`, `number`, `issued_by`, `apartment_id null`, `issued date`,
`expires date`, `remind_days int default 60`, `note`, `file_path` (Storage, optional).
**beehive_listings** — `apartment_id`, `channel`, `title`, `url`, `price int`,
`status (live|paused|draft)`, `rating numeric(3,2)`, `reviews int`, `note`.
**beehive_campaigns** — `name`, `channel (all|airbnb|booking|direct|instagram|whatsapp|google)`,
`spend int`, `start date`, `end date`, `offer`, `result`.

### 3.5 Guest check-in (already in the database)

`beehive_door_keys (apartment text pk, label, door_key)`,
`beehive_checkins (…guest fields…, apartment, rules_accepted_at, has_photo)`,
`beehive_checkin_photos (checkin_id pk, mime, data base64)`;
`beehive_door_info(p_apartment, p_key) → label` and
`beehive_submit_checkin(p jsonb) → uuid` (validates key, max 15 per apartment per hour).
Phase 6 changes, by migration:
1. Add `booking_id uuid null`, `reviewed bool default false` to `beehive_checkins`.
2. Move ID photos to a **private** Storage bucket `beehive-ids`; the guest upload goes
   through a Next.js route handler that re-checks the door key, then writes with the
   service role. Keep `beehive_checkin_photos` readable for old rows, stop writing to it.
3. Owner-only read policies on all three tables.

## 4. Behaviour (port from the prototype)

### 4.1 Bookings → jobs (automatic)
On insert/update/delete of a booking (database trigger calling `beehive_sync_tasks`,
or one server function used everywhere):
- Every non-cancelled booking with `check_out >= today - 2` has a **turnover** job on
  `check_out` at `check_out_time`, carrying guest first name, guests leaving, and the
  **next** non-cancelled booking of the same apartment that starts on or after this
  check-out (date, time, guest count). Same-day turnover when they are equal.
- Every non-cancelled booking with `check_in >= today - 2` has an **arrival** job on
  `check_in` at `check_in_time`, carrying first name, guest count, phone if
  `share_phone`, channel, foreign flag, extras to set up.
- Turnover jobs list extras whose catalog item has `return_check` (collect & check).
- Cancelling or deleting a booking deletes its auto jobs unless they are `done`.
- Copied fields update when the booking changes; housekeeper fields (status, checks,
  notes, inventory, condition) are never overwritten.

### 4.2 Today (owner) — alerts, most urgent first
Red (urgent): Form C not submitted for a foreign guest whose stay touches
[yesterday … tomorrow]; booking for a guest tagged `blocked`; turnover not done and
dated before today; open issue that is `urgent` or `missing`; licence expired.
Amber: ID not verified for a stay that starts by tomorrow and has not ended; payment
`pending`/`partial` with check-in within 3 days; deposit `held` more than 2 days after
check-out; same-day turnover today; periodic care overdue; licence expiring within
`remind_days`; laundry out more than 4 days; petty cash balance below zero; booking
extras still `requested` within 2 days of check-in; unpaid extras after check-out;
open `mess`/`damage` issue linked to a booking ("decide whether to charge").
Then: one key tag per apartment (status: Turnover / Arriving / Checking out / Occupied /
Needs cleaning / Ready), week strip (Mon–Sun, dots in apartment colour on check-in or
check-out days), next 7 days in time order, this month's occupancy / net income / expenses
/ profit.

### 4.3 Housekeeping
Job cards as in `screens/C-Job.dc.html`: band in apartment colour, time window, checklist
from the apartment (turnover/deep use cleaning list, arrival uses arrival list), progress,
notes, Start / Mark done / Reopen. Turnover jobs also show **Room OK** and **Messy or
damaged** until a condition is set, and **Inventory check** when the apartment has assets
with `count_on_checkout`.
- Inventory: count each counted item; any shortfall creates an `urgent` issue category
  `missing`, linked to the booking, text listing the missing items.
- Messy/damaged: form with description and extra cleaning hours → issue `mess` or
  `damage` linked to the booking.

### 4.4 Periodic care
Next due = `last_done + every_days`. Status: no last date → "Set last done date";
overdue; due today; due within 7 days; otherwise "Next <date>". "Mark done" writes a log
row (date, result, note, cost) and moves `last_done` forward only if the new date is later.

### 4.5 Money
- Booking `total` and `commission` are spread evenly over the nights, so a stay across
  two months counts in both. Net = total − commission.
- Extras income counts on each booking extra's `date` (not cancelled).
- Expenses = expense ledger + petty cash `out`. Rows with no apartment split evenly
  across apartments.
- Occupancy = booked nights ÷ (days in month × apartments). Average rate = gross ÷ nights.
- Finance page: month switcher, stat row, 12-month bars (net income incl. extras vs
  expenses), by apartment, by channel, "where the money went".
- Resolving a `mess`/`damage`/`missing` issue with a charge adds a booking extra
  ("Extra cleaning charge" / "Damage charge" / "Missing items charge", unpaid), and
  optionally marks the deposit `deducted` and the charge paid.
- Booking form shows a warning (not a block) when an extra's `qty` would be exceeded by
  overlapping bookings.
- Exports: bookings CSV and expenses CSV (owner only).

### 4.6 Guests
Guest identity key = `p` + last 10 digits of phone (if ≥ 8 digits) else `e` + lowercase
email else `n` + lowercase name. Guests page groups bookings by key: stays, nights,
spend, channels, missing-item reports, profile tag and notes.

### 4.7 Foreign guests & Form C
List grouped Form C due / arriving soon / submitted. Warn if visa or passport ends
before check-out. Link to the FRRO Form C portal: https://indianfrro.gov.in/frro/FormC
(owner logs in there; the app does not submit Form C itself).

### 4.8 Marketing
Channel mix last 90 days (count, share, net), review requests for guests who left in the
last 21 days with a phone and `review_asked = false` (WhatsApp link with a prefilled
message), listings per apartment, campaigns with running/planned/ended state.

### 4.9 Welcome message
Template placeholders: `{guest}` (first name), `{apartment}`, `{checkin}`, `{checkout}`,
`{checkinTime}`, `{checkoutTime}`, `{nights}`, `{guests}`, `{extras}` (active extras with
a price, "Air fryer ₹… per day"). Sent with a `https://wa.me/<91…>?text=` link; phone
normalised to 91 + 10 digits.

## 5. Screens and navigation

Owner sidebar groups (desktop) — Overview: Today, Calendar · Guests: Bookings, Guests,
Foreign guests, Paid extras, Check-ins · Property care: Housekeeping, Periodic care,
Laundry, Maintenance, Assets & inventory · Money: Finance, Expenses, Petty cash ·
Business: Marketing, Licences, Apartments, Settings.
Owner phone bottom bar: Today, Calendar, Bookings, Jobs, More.
Housekeeper: My jobs, Periodic care, Laundry, Maintenance, Petty cash, Assets,
Apartments; bottom bar Jobs, Care, Laundry, Report, More. Housekeeper UI in Malayalam
when `beehive_staff.lang = 'ml'`.
Calendar: month grid, one row per apartment, bars from check-in afternoon to check-out
morning coloured by channel; tap empty day = new booking, tap bar = edit.
Forms open as bottom sheets on phones, centred dialogs on desktop.

## 6. Guest check-in portal

Public route: `/checkin/[apartment]?k=<door_key>` (no login). Design:
`screens/G1-Welcome` → `G2-Details` → `G3-ID` → `G4-Passport` (only when "Other country")
→ `G5-Rules` → `G6-Done`. Language switch EN / മലയാളം / हिंदी.
- Wrong or missing key → friendly "This link is not valid. Please scan the QR on the door."
- Details: full name, mobile with country code, adults (1–20), children (0–20), check-out
  date, Indian / Other country.
- Photo ID: type (Passport, Aadhaar, Driving licence, Voter ID, Other); one photo per
  adult; compress on the phone to max 1600 px, JPEG ~0.8, before upload.
- House rules come from the apartment record (owner edits them); "I agree" required.
- Done: check-out time, Wi-Fi name/password from the apartment record, "Message your
  host" WhatsApp link.
Owner **Check-ins** inbox: new check-ins, match to a booking (suggest same apartment
with check-in today ±1), view ID photos via short-lived signed URLs, copy passport/visa
fields into the Form C record, mark reviewed. A matched check-in sets the booking's
`id_verified` only when the owner confirms.
**Door posters**: printable A5 page per apartment with the QR (`qrcode` lib), the
apartment name and three lines of instructions in English, Malayalam and Hindi.
"Rotate key" button regenerates the door key (old posters stop working).

## 7. Reminders
Vercel Cron, daily 07:00 IST (`30 1 * * *` UTC), calls `/api/cron/daily` with a secret.
Phase 1: computes the alert list and stores a daily digest row; Today shows it.
Later: email digest to the owner (Resend), and per-job reminders to the housekeeper.

## 8. Channel sync (later phase)
Airbnb and Booking.com export each listing's calendar as an iCal (.ics) link. Import those
links per apartment every 30 minutes: create `confirmed` bookings with placeholder guest
"Airbnb guest" and the reservation code in `channel_ref`, keyed by `ical_uid`; never
overwrite a booking the owner has edited. The feed carries dates only, so the owner still
fills in name, amount and commission. Export an iCal of direct bookings so the channels
block those dates.

## 9. Quality bar
- Phone first (360 px), PWA installable (manifest + icons), light and dark themes.
- Accessibility: real buttons and labels, focus rings, contrast AA, no colour-only meaning.
- Every list has a designed empty state that says how to add the first item.
- Loading: skeletons, no layout jump. Errors say what went wrong and what to do.
- All "today" logic tested around midnight IST.

## 10. Seed data (production)

**Apartments**
| id | name | code | tag | features |
|---|---|---|---|---|
| apt-1bhk | 1 Bedroom Apartment | 1BHK | tag1 (mango) | Air conditioning, Attached bathroom, Small pantry |
| apt-2bhk | 2 Bedroom Apartment | 2BHK | tag2 (indigo) | Air conditioning, Attached bathroom, Hall, Pantry |

Both: location "Panampilly Nagar, Kochi", check-in 14:00, check-out 11:00.
1BHK bedrooms 1, 2BHK bedrooms 2; max guests: ask the owner.

Cleaning checklist (2BHK adds "Hall: wipe table, arrange sofa and cushions" after the
bathroom line, and says "Strip both beds"):
1. Strip the bed and put on fresh linen
2. Fresh bath and hand towels
3. Clean and disinfect bathroom, toilet and shower
4. Wipe pantry counter, sink, kettle and microwave
5. Empty leftovers from the fridge and wipe the shelves
6. Sweep and mop all floors
7. Dust surfaces, switches, remotes and door handles
8. Empty and wash bins, put new liners
9. Check AC, lights, fans, TV and Wi-Fi work
10. Restock toiletries, tissue and drinking water
11. Lock windows, switch off lights and AC, send photos to owner

Arrival checklist: Collect photo ID of every adult guest · Foreign guests: copy of passport
photo page and visa · Hand over keys and note how many sets · Show AC remote, water purifier
and Wi-Fi details · Share house rules and your phone number.

Welcome message: "Hello {guest}, welcome to Beehive Home! Your stay at our {apartment} in
Panampilly Nagar, Kochi is confirmed for {checkin} to {checkout}. Check-in is from
{checkinTime} and check-out is by {checkoutTime}. Please send a photo ID for each adult
before arrival. Message me here anytime if you need anything."

**Periodic care** (both apartments; intervals are suggestions the owner can change)
| name | category | every | who |
|---|---|---|---|
| Hygiene inspection | hygiene | 7 | housekeeper |
| Clean AC filters | airfilter | 30 | housekeeper |
| Water purifier check | purifier | 90 | technician |
| Deep clean | deepclean | 90 | housekeeper |
| Pest control | pest | 90 | technician |
| AC service | acservice | 180 | technician |
| Water quality test | watertest | 180 | technician |
| Safety check | safety | 180 | owner |

**Paid extras** (prices not set — owner fills in)
| name | unit | return check | offered |
|---|---|---|---|
| Air fryer | per day | yes | yes |
| BBQ maker | per use | yes | yes |
| Party hall | per hour | no | yes |
| Extra cleaning (room left messy) | per event | no | no (charge only) |

**House rules** (shown on the guest portal; owner can edit): No smoking inside the
apartment · Quiet hours 10 PM to 7 AM, no parties · Only registered guests stay overnight ·
Switch off AC and lights when you go out · Check out by 11 AM on your last day · Missing
items, damage or a very messy room are charged extra.
