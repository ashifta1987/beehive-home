# Build prompts for Antigravity

Paste one prompt at a time into the Antigravity agent. For each phase:
1. Paste the prompt. Let the agent write its **Implementation Plan**.
2. Read the plan. Approve it, or comment on the lines you want changed.
3. When the agent says it is done, open the app in the browser at phone width and try
   the "Check it" list yourself.
4. Commit and push to GitHub (`Phase N done`). Vercel deploys a preview automatically.

The agent reads `AGENTS.md` by itself on every task, so the prompts stay short.

---

## Phase 0 — Project set-up

```
Set up the project described in AGENTS.md in this empty folder (keep AGENTS.md, docs/,
.agents/ and supabase/ as they are).
- Create a Next.js App Router app with TypeScript strict, Tailwind CSS, ESLint, src/ dir.
- Add @supabase/supabase-js, @supabase/ssr, zod, next-intl, date-fns, date-fns-tz, qrcode.
- Add the design tokens from docs/design/DESIGN.md to globals.css and map them in
  Tailwind. Load Unbounded, Inter, Noto Sans Malayalam and Noto Sans Devanagari with
  next/font/google.
- Supabase clients: browser, server (cookies) and middleware, per @supabase/ssr.
- next-intl with en, ml, hi message files.
- Scripts: dev, build, lint, typecheck.
- .env.example with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, NEXT_PUBLIC_SITE_URL.
- An app shell: sidebar on desktop, floating bottom bar on phones, as in DESIGN.md,
  with empty placeholder pages for every section in SPEC.md § 5.
Do not create any database objects yet.
```
**Check it:** `npm run dev` opens; the shell looks like the Key Tags design on a phone
and a laptop; dark mode follows the system.

## Phase 1 — Sign-in, roles, apartments

```
Implement SPEC.md § 1, § 2 and § 3.1 (staff and apartments only).
- Migration: beehive_staff, beehive_apartments, beehive_is_owner(), beehive_is_staff(),
  updated_at trigger, RLS per the privacy map. Seed the two apartments from SPEC § 10
  (checklists, house rules, welcome message). Add house_rules, wifi_name, wifi_password.
- Email magic-link sign-in at /login. After sign-in: owner → Today, housekeeper →
  My jobs, no staff row → "Ask the owner for access".
- Settings › People: owner adds a housekeeper by email (invite) and sets language en/ml.
- Apartments page: view and edit (owner), read-only checklists (housekeeper).
Show me the Implementation Plan with the full SQL before applying the migration.
Run the Supabase advisors after applying it.
```
**Check it:** sign in as owner; edit an apartment; invite a second email as housekeeper;
sign in as housekeeper in another browser and confirm you cannot open /bookings.

## Phase 2 — Bookings, calendar, automatic jobs

```
Implement bookings (SPEC § 3.1 bookings, guest profiles; § 4.1; § 4.6; calendar in § 5).
- Migration with the no-overlap exclusion constraint, beehive_tasks table, and
  beehive_sync_tasks() run by a trigger on bookings exactly as § 4.1 describes.
- Booking form as a bottom sheet: apartment and channel as pill choices, guest, dates
  and times, adults/children, total, commission % helper, payment, deposit, status,
  ID verified, foreign national, share phone, housekeeper note, private notes.
  Show the overlap error in plain words.
- Bookings list with filters (current & upcoming, past, cancelled, all) and search;
  Check in / Check out buttons; WhatsApp welcome link (§ 4.9); CSV export.
- Calendar month view (§ 5). Guests page (§ 4.6).
Port the logic from docs/reference/prototype.html (openBooking, desiredTasks, guestIndex).
```
**Check it:** add two bookings back-to-back in 2BHK → a same-day turnover job appears;
try an overlapping booking → it is refused; cancel a booking → its jobs disappear.

## Phase 3 — Housekeeping, care, laundry, maintenance, assets

```
Implement SPEC § 3.2 and § 4.3, § 4.4: job cards (match docs/reference/screens/
C-Job.dc.html), checklist ticking, Start / Mark done / Reopen, housekeeper notes,
Room OK / Messy or damaged, inventory check with missing-item issues, periodic care
with log and seed rows from § 10, laundry, maintenance issues, assets & inventory with
the theft-control panel. Respect the privacy map: test every page as the housekeeper.
```
**Check it:** as housekeeper, finish a turnover, mark a towel missing → owner sees an
urgent issue linked to the guest; mark "Clean AC filters" done → next date moves 30 days.

## Phase 4 — Money: finance, expenses, petty cash, paid extras, charges

```
Implement SPEC § 3.3 and § 4.5: expenses with month switcher and CSV export, petty cash
with balance, paid extras catalog (seed from § 10, prices empty), booking extras inside
the booking form with the availability warning, extras on arrival/turnover jobs,
resolving mess/damage/missing issues with a charge and optional deposit deduction,
and the Finance page with the 12-month chart, by-apartment and by-channel tables.
Write unit tests for the night-by-night income split and the even split of shared
expenses, including a stay that crosses a month end.
```
**Check it:** a 3-night stay from 30 Nov to 3 Dec shows 1 night in November and 2 in
December; an unpaid extra shows on Today after check-out.

## Phase 5 — Today, foreign guests, marketing, licences

```
Implement the owner Today screen exactly per SPEC § 4.2 and docs/reference/screens/
C-Today.dc.html (week strip, key tags, alerts, next 7 days, month summary), foreign
guests & Form C (§ 3.1, § 4.7), marketing (§ 4.8), licences with expiry reminders.
All "today" logic in Asia/Kolkata — add tests that run at 23:30 and 00:30 IST.
```
**Check it:** a foreign booking arriving tomorrow shows a red Form C alert until you
tick "Form C submitted".

## Phase 6 — Guest QR check-in portal and door posters

```
Implement SPEC § 3.5 and § 6. The tables beehive_door_keys, beehive_checkins,
beehive_checkin_photos and the functions beehive_door_info and beehive_submit_checkin
already exist in the database: inspect them first and extend them with new migrations
(do not recreate). Build /checkin/[apartment] matching docs/reference/screens/G1…G6
(en/ml/hi), the private beehive-ids bucket and upload route, the owner Check-ins inbox
with booking matching and signed photo URLs, door posters, and "Rotate key".
Never expose a door key in logs, errors or client bundles other than the poster page.
```
**Check it:** print the 1BHK poster, scan it with your phone, check in as a foreign
guest; the owner inbox shows it with the ID photo; matching it fills the Form C record.
A wrong key shows the friendly error.

## Phase 7 — Phone app feel, Malayalam, reminders

```
Make the app installable as a PWA (manifest, icons from the key-tag logo, theme colour).
Translate all housekeeper screens into Malayalam (messages/ml.json) and the guest portal
into Malayalam and Hindi; flag every string for native review in a REVIEW-ML.md list.
Add the daily 07:00 IST Vercel Cron (§ 7) with CRON_SECRET.
```
**Check it:** "Add to Home screen" works on Android; the housekeeper sees Malayalam.

## Phase 8 — Go live

```
Prepare production: Vercel project linked to the GitHub repo, environment variables,
Supabase Auth redirect URLs for the production domain, run all advisors, remove demo
data, write docs/RUNBOOK.md (how to add a housekeeper, rotate a door key, export data,
restore from a Supabase backup).
```

## Later — channel sync
```
Implement SPEC § 8: per-apartment iCal import links for Airbnb and Booking.com every
30 minutes, and an iCal export of direct bookings.
```
