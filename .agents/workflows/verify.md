---
description: Check a finished task before calling it done
---

1. Run `npm run typecheck`, `npm run lint` and `npm run build`. Fix every error.
2. If this task added a migration: run the Supabase security and performance advisors
   and fix every warning about a `beehive_` object. Confirm RLS is on for every new table.
3. Open each changed screen in the browser at 390 px wide and at 1280 px wide, in light
   and dark mode.
4. If the change touches data the housekeeper can see, sign in as the housekeeper and
   confirm they see only what the privacy map in docs/SPEC.md § 2 allows.
5. Check empty, loading and error states of each changed list or form.
6. Write a short Walkthrough: what changed, screenshots, anything the owner must decide.
