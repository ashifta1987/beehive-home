# Foundation conventions (read before building a module)

The project shell, database and shared UI already exist. Build features on top; do not
re-create them.

## Database
- All tables/functions are already written in `supabase/migrations/2026111800*.sql`.
  **Read them** — they are the schema. Row types are in `src/lib/types.ts`.
- If you truly need a schema change, add a NEW migration file
  `supabase/migrations/20261118001NNN_beehive_<what>.sql` (never edit existing ones),
  prefix every object `beehive_`, enable RLS, and mention it in your report.
- Jobs (`beehive_tasks`) for turnover/arrival are created by the DB trigger
  `beehive_sync_tasks` whenever bookings or booking extras change. Do not create them in app code.
- Housekeepers can UPDATE tasks, but a trigger silently keeps owner-only columns unchanged.

## Server side
- Server client (RLS as the user): `import { createClient } from "@/lib/supabase/server"`.
- Service role (bypasses RLS) `@/lib/supabase/admin` — ONLY for guest upload route, cron,
  staff invites. Never anywhere else.
- Pages: call `await requireOwnerPage()` (owner-only pages) or `await requireStaffPage()`
  from `@/lib/auth` at the top. Both return `{ userId, email, staff }`.
- Server actions: put them in an `actions.ts` with `"use server"` next to the page.
  Wrap every action:
  ```ts
  export async function saveX(input: unknown): Promise<ActionResult> {
    return action(async () => {
      await requireOwner();               // or requireStaff()
      const v = schema.parse(input);      // zod, always on the server
      const supabase = await createClient();
      check(await supabase.from("beehive_x").insert(v));
      revalidatePath("/x");
    });
  }
  ```
  (`action`, `check`, `UserError`, `ActionResult` from `@/lib/actions`.) `action()` turns
  DB errors into plain English (overlap error 23P01 is already handled).
- Dates: `todayIST()`, `addDaysISO`, `nights`, `fmtDay`, `fmtDate`, `fmtTime`, `fmtMonth`… in
  `@/lib/dates`. "Today" is ALWAYS Asia/Kolkata. Money: `inr()` / `parseRupees()` in `@/lib/money`.
- Guests: `guestKey`, `firstName`, `waLink`, `welcomeMessage`, `CHANNEL_LABEL`, `unitLabel`
  in `@/lib/guest`. Apartments: `getApartments()`, `aptMap()` in `@/lib/data`.

## UI (all in `src/components/ui`, use them, do not fork them)
- `button.tsx`: `Button`, `ButtonLink`, `IconButton`, `buttonClass(variant,size)`;
  variants primary (ink) / secondary / honey (the ONE main action) / danger / ghost.
- `card.tsx`: `Card`, `CardTitle`, `PageHeader`, `EmptyState`, `Skeleton`, `PageSkeleton`,
  `ErrorBox`, `Stat`.
- `pill.tsx`: `Pill tone=ok|warn|bad|info|neutral|ink`, `ChannelPill`, `AptSquare`, `AptChip`.
- `form.tsx`: `Field`, `Input`, `Textarea`, `Select`, `TextField`, `TextAreaField`,
  `SelectField`, `CheckRow`, `PillChoice`, `Stepper`, `Toggle`.
- `sheet.tsx`: `Sheet` — bottom sheet on phones, dialog on desktop. EVERY form opens in one,
  with `footer={<><Button variant="secondary">Cancel</Button><Button>Save</Button></>}`.
- `toast.tsx`: `useAction()` → `{ run, pending, error }`; `run(() => serverAction(data),
  { success: "Saved", onDone: close })` refreshes the route; show `error` with `<ErrorBox>`.
- `icon.tsx`: `<Icon name="…" />` (see the PATHS list; add new icons only by appending).
- `src/lib/ui.ts`: `cn`, `tagClasses(apartment.tag_colour)` → `{ bg, text, ring }`,
  `CHANNEL_CLASSES`.
- Tailwind colours are the design tokens: `bg-bg bg-surface bg-surface-2 text-ink text-muted
  border-line bg-accent bg-tag1 text-tag1-ink bg-ok-soft text-ok bg-warn-soft text-warn
  bg-bad-soft text-bad bg-airbnb-soft text-airbnb …`. NEVER literal hex colours.
  Display font: `font-display` (Unbounded). Numbers: `tabular`. Cards: `rounded-[24px]`.
- Mobile first: works at 360 px, tap targets ≥ 44 px. Desktop breakpoint is `min-[960px]:`.
- Each list needs an empty state that says how to add the first item. Add a `loading.tsx`
  only if you need a different skeleton (one exists for the whole app group).

## i18n
- `next-intl` without locale routing; locale comes from the `NEXT_LOCALE` cookie
  (en / ml / hi). Messages: `messages/<locale>/<namespace>.json`, one namespace per feature,
  already created (empty `{}`), listed in `src/i18n/config.ts`. Missing ml/hi keys fall
  back to English.
- Use `useTranslations("<ns>")` in client components, `await getTranslations("<ns>")` in
  server ones. Put ALL UI text of your feature in your namespace (`en`). Housekeeper-facing
  screens also need `ml`; the guest portal needs `ml` and `hi`. Append each Malayalam/Hindi
  string you write to `REVIEW-ML.md` under your feature heading for native review.

## Routes
Owner: /today /calendar /bookings /guests /foreign /extras /checkins /finance /expenses
/marketing /licences. Owner + housekeeper: /jobs /care /laundry /maintenance /petty /assets
/apartments /settings. Public: /checkin/[apartment] /api/checkin/*. Placeholders exist —
replace the page you own. The shell (sidebar + bottom bar) is in `src/components/shell`.

## Working in parallel
Several agents build modules at the same time in this folder.
- Only edit files for your own routes/feature plus your own namespace message files.
- Do not edit shared files (`src/components/ui/*`, `src/lib/{auth,actions,dates,money,guest,
  types,ui,data}.ts`, shell, layouts, migrations written by others). If you need a helper,
  create it under your feature folder or a new `src/lib/<feature>.ts`.
- Check your work with `npx tsc --noEmit` and `npx eslint <your paths>`. Do **not** run
  `npm run build` / `npm run dev` / `npm install` (they clash with other agents); if you need a
  new package, ask the coordinator. If tsc shows errors in files you do not own, ignore them.
- Do not commit; the coordinator commits.
