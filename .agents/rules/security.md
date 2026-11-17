# Security rules (always on)

- Guest ID photos, passport and visa numbers are personal data. Store photos only in the
  private `beehive-ids` bucket, serve them only through signed URLs that expire within
  10 minutes, and only to the owner.
- Never put a Supabase service role key, a door key or a cron secret in client code,
  `NEXT_PUBLIC_*` variables, logs, error messages or git history.
- Every route handler and server action checks the user's role from `beehive_staff`
  before doing anything; never trust a role sent by the browser.
- Public guest routes accept only what `docs/SPEC.md` § 6 lists, validate it with zod,
  and rate-limit through the database function.
- Do not disable RLS, even temporarily, and do not use the service role to work around a
  policy except in the guest upload route and the cron job.
