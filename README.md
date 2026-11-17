# Beehive Home — start here

The manager app for the 1BHK and 2BHK apartments in Panampilly Nagar, Kochi,
to be built in Google Antigravity with Next.js, Supabase and Vercel.

## What is in this folder
| Path | What it is |
|---|---|
| `AGENTS.md` | Rules the Antigravity agent reads on every task (stack, database, design, how to work) |
| `.agents/rules/security.md` | Always-on security rules for guest data and keys |
| `.agents/workflows/verify.md` | `/verify` — the agent's checklist before it says "done" |
| `docs/SPEC.md` | The full product spec: roles, privacy, tables, every module's rules, seed data |
| `docs/design/DESIGN.md` | The Key Tags design system: tokens, fonts, components |
| `docs/BUILD-PROMPTS.md` | Prompts to paste into Antigravity, one phase at a time |
| `docs/reference/prototype.html` | The working prototype (behaviour reference) |
| `docs/reference/screens.html` | All approved screens side by side (open in a browser) |
| `docs/reference/screens/*.dc.html` | Source of each approved screen |
| `docs/reference/*.pdf` | Owner guide and appointment proposal |
| `supabase/migrations/` | Empty; the agent adds SQL migrations here |

## Steps
1. **GitHub:** create a private repository named `beehive-home`, clone it to your
   computer, and copy everything from this folder into it (including the hidden
   `.agents` folder). Commit: "Project brief".
2. **Antigravity:** open the repository folder as the workspace. Use Agent Manager in
   plan mode so you approve each Implementation Plan.
3. **Supabase:** in Antigravity's MCP settings, add the Supabase MCP server and sign in,
   so the agent can run migrations and advisors on your project. Copy the project URL and
   publishable (anon) key into `.env.local`.
4. **Build:** paste the prompts from `docs/BUILD-PROMPTS.md`, Phase 0 to Phase 8, one at
   a time. Test each phase yourself before the next.
5. **Vercel:** import the GitHub repository, add the same environment variables plus
   `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`, and deploy. Every push makes a preview.

## Decisions to make before or during the build
- **Supabase project:** the guest check-in tables already live in the `hostoctopus`
  project (all prefixed `beehive_`). Keep building there, or move to a dedicated project
  before Phase 1. A separate project keeps guest data apart from your other products.
- **Housekeeper sign-in:** email magic link (free) or phone OTP (needs a paid SMS
  provider).
- **Domain:** for example a subdomain like `beehive.<your-domain>`; the QR posters print
  this address, so choose it before Phase 6.
- **Prices** for paid extras, deposit amount, max guests per apartment, Wi-Fi details.
