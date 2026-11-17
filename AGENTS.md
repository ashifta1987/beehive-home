# Beehive Home — project rules for the coding agent

## What this is
A web app to run two short-stay apartments in Panampilly Nagar, Kochi, India:
**1BHK** (1 bedroom, AC, attached bath, small pantry) and **2BHK** (2 bedrooms, AC,
attached bath, hall, pantry). Rooms are let through Airbnb, Booking.com and direct
bookings. The owner lives abroad and runs everything from a phone; one local
housekeeper does the work on site; guests check themselves in with a QR code on the door.

Before any feature work, read:
- `docs/SPEC.md`: roles, privacy, data model, every module's rules. **Source of truth.**
- `docs/design/DESIGN.md`: the "Key Tags" design system (tokens, components).
- `docs/reference/prototype.html`: a working single-file prototype. Use it as the
  behaviour reference: port its logic, never its storage (`window.claude`, `db.collection`).
- `docs/reference/screens/*.dc.html`: approved screen designs (owner Today, housekeeper
  job, 6-step guest check-in). Match them.

## Stack (fixed — do not swap)
- Next.js (App Router) + TypeScript in strict mode + Tailwind CSS
- Supabase: Postgres, Auth, Storage, Row Level Security, database functions
- Hosting: Vercel (cron jobs via Vercel Cron)
- `@supabase/ssr` for auth in server components, route handlers and middleware
- Libraries only when they earn it: `qrcode` (QR posters), `next-intl` (en / ml / hi),
  `zod` (input validation), `date-fns` + `date-fns-tz` (Asia/Kolkata dates)

## Database rules
- The Supabase project is shared with another product. **Every table, view, function,
  bucket and policy for this app is prefixed `beehive_`.** Never read, alter or drop
  anything without that prefix.
- Three objects already exist and are live: `beehive_door_keys`, `beehive_checkins`,
  `beehive_checkin_photos`, plus functions `beehive_door_info(text,text)` and
  `beehive_submit_checkin(jsonb)`. Extend them with new migrations; do not recreate them.
- All schema changes are SQL migrations in `supabase/migrations/`, one per change,
  never edited after they are applied.
- RLS is enabled on every table. `anon` gets no table access at all; guests act only
  through `security definer` functions that check the apartment's door key.
- After every migration, run the Supabase security and performance advisors and fix
  every warning that concerns a `beehive_` object.
- Never print, log or commit door keys, the service role key or guest ID data.

## Code rules
- Server-only secrets (service role key, cron secret) live in env vars **without**
  the `NEXT_PUBLIC_` prefix and are used only in server code.
- Validate every form and route input with zod, on the server.
- Stay dates are Postgres `date`. "Today", "overdue" and every reminder are computed in
  **Asia/Kolkata**, never the server's timezone.
- Money is whole rupees in `integer` columns. Display with `Intl.NumberFormat('en-IN',
  {style:'currency',currency:'INR',maximumFractionDigits:0})`.
- Mobile first. Every screen must work at 360 px wide; tap targets at least 44 px.
- Copy is plain and active. Buttons say exactly what happens ("Mark done", "Room OK").
  No lorem ipsum, no invented prices, licence names or legal claims: use clearly
  marked placeholders and ask the owner.
- UI text goes through `next-intl` message files from day one (`messages/en.json`,
  `messages/ml.json`, `messages/hi.json` for the guest portal).

## How to work
- For anything that adds a migration, changes RLS, or can delete data: write an
  Implementation Plan first and wait for approval.
- Build in the phases of `docs/BUILD-PROMPTS.md`. Finish and verify one phase before
  starting the next.
- A task is done only when `npm run typecheck`, `npm run lint` and `npm run build`
  pass, and you have clicked through the changed screens in the browser at phone width,
  as both the owner and the housekeeper where both are affected. Run `/verify`.
- Seed only the data in `docs/SPEC.md` § Seed data. Never invent guests or bookings in
  the production database; use a separate local seed for demo data.
