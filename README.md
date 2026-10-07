# Sell with Matthews

Two things in one site for Matthews Auctioneers:

- **Public pages** for people with something to sell: a front page and one page per program
  (equipment, dealer trade-ins, estates, real estate). Each has a free-consultation form.
- **The CRM** the team uses to prospect and follow up: companies, individuals, contacts,
  activity, tasks, appointments, opportunities, territories, a scoreboard, spreadsheet import,
  a review queue and AI-drafted outreach. Form submissions arrive in it as web leads.

| What | Output | Address | Data | Sign-in |
|---|---|---|---|---|
| Public pages | `public/*.html` (from `site/`) | `/`, `/equipment`, `/dealers`, `/estates`, `/real-estate` | Adds rows to `web_leads` | None |
| CRM on the website | `public/crm/index.html` + `api/draft.js` | `/crm` | Supabase (Postgres) | Supabase Auth |
| CRM as a Claude-hosted page | `dist/matthews-consignment-crm.html` | A Claude artifact | The artifact's own database | The viewer's Claude account |

Links from the main site can carry a tag so each lead records where it came from, for example
`/equipment?src=main-site`.

A program's page is only built for the live site when it is marked `published: true` in
`site/pages.mjs`. With one program published, the site's front address forwards to that page.
`SITE_ALL=1 node build.mjs` builds every program for a local preview.

Wording for the public pages lives in `site/pages.mjs`. Real photos placed in
`site/img/photos/` appear on the front page; with none, that band is left out.

## Putting the website live

1. **Supabase.** Use a project with no existing tables named `companies`, `contacts`,
   `activities`, `tasks`, `opportunities`, `territories`, `team_members`, `email_drafts` or
   `settings`. With the GitHub integration connected and **Deploy to production** switched
   on, merging to the production branch applies `supabase/migrations/`. Without it, paste the
   migration file into the SQL Editor and run it once.
2. **Vercel.** Import this GitHub repo as a new project. No framework. `vercel.json` already
   sets the build command (`node build.mjs`) and output folder (`public`).
3. **Environment variables in Vercel** (Project → Settings → Environment Variables):

   | Name | Value | Needed for |
   |---|---|---|
   | `SUPABASE_URL` | Project URL from Supabase → Project Settings → API | Everything |
   | `SUPABASE_ANON_KEY` | The anon / publishable key from the same page | Everything |
   | `ANTHROPIC_API_KEY` | A key from the Claude Console | AI email drafting only |
   | `ANTHROPIC_MODEL` | Optional. Defaults to `claude-sonnet-5-5` | AI email drafting only |
   | `CALENDAR_TZ` | Optional. Defaults to `America/New_York` | Time zone of appointments in the Google Calendar link |

   The Supabase–Vercel integration fills in the first two for you. Never put the Supabase
   `service_role` key here; the site does not use it. Redeploy after changing variables.
4. **Supabase Auth → URL Configuration.** Set **Site URL** to the Vercel address (and add it
   under Redirect URLs) so confirmation and password-reset links come back to the site.
5. **First sign-in.** Open the site, choose *Create an account*, confirm the email, sign in.
   The first person to sign in becomes the CRM admin. Do this yourself straight away.
6. **Add the team.** Territories → Team → *+ Team member*, with each rep's sign-in email.
   A rep gets access when they create an account (or accept an invite sent from Supabase →
   Authentication → Users) with that same email. Anyone else who signs up sees nothing.

**Later database updates.** Each new file in `supabase/migrations/` has to be run once, in filename order. While *Deploy to production* is off, paste the new file into the SQL Editor and run it. The files are written to be safe to run twice.

Supabase's built-in email sender is limited to a few messages an hour. That is enough for a
small team's confirmations and resets; add custom SMTP in Supabase if it becomes a problem.

## How access works

- Every table has row-level security. A signed-in user can read or change CRM data only if
  their account is linked to an **active** row in `team_members`.
- Only admins can add, change or remove team members. Any member can change their own name
  and signature, and can add a name-only team entry (imports do this for unknown rep names),
  which grants no access.
- `/api/draft` checks the caller's session against the same `is_member()` rule before it
  spends anything on the Claude API. The API key never reaches the browser.

## Layout

| Path | What it is |
|---|---|
| `src/core.js` | Option lists, helpers, shared in-memory state, territory matching, derived data, CSV |
| `src/ui.js` | App state, rendering, dialogs, every screen except import and outreach, exports |
| `src/import.js` | CSV / Excel import: column matching, match-before-create planning, apply |
| `src/pipeline.js` | Lines of business (Equipment, Estate, Real Estate), opportunity items and types, the opportunity dialog and Opportunities screen |
| `src/appointments.js` | Scheduling appointments (stored as tasks with a time, place and kind) |
| `src/report.js` | Scoreboard: outreach counts, leaderboard, streaks and call outcomes, all computed from the activity log |
| `src/lookup.js` | Check-first search that opens before a new company or contact is added |
| `src/leads.js` | Web leads from the public pages: the Dashboard inbox, live alert, and one-click add with a call-back task |
| `src/calendar.js` | Calendar: a month view of appointments, optionally with tasks and follow-ups |
| `api/calendar.js` | The address calendar apps read: a private-link feed of appointments for Google Calendar, Apple Calendar or Outlook |
| `src/assets/` | The Matthews Auctioneers logo, cut to web sizes from the company's own file and embedded at build time |
| `src/outreach.js` | AI email drafting and the outreach queue |
| `src/app.js` | Event wiring shared by both builds |
| `src/store-web.js`, `src/boot-web.js` | Website build: Supabase storage, sign-in, account screen, backup restore |
| `src/store-claude.js`, `src/boot-claude.js` | Claude-hosted build: artifact database, viewer identity, Gmail connector |
| `src/style.css`, `src/body.html` | Styles and the page body |
| `api/draft.js` | Vercel function that writes email drafts with the Claude API |
| `supabase/migrations/` | Tables, access rules, realtime, the seven starting territories |
| `seed/territories.json` | The same territories for the Claude-hosted build |
| `build.mjs` | Produces both builds |
| `test/` | Browser tests for both builds |

The screens only talk to `Store` (`init`, `add`, `addMany`, `patch`, `patchMany`, `remove`,
`cfgPatch`, `onChange`) and to `CAP` (`downloads`, `sample`, `mcp`), so the two builds differ
only in the `store-*` and `boot-*` files. `src/store-web.js` holds the map between the app's
field names and the database columns.

## Build and test

```
npm install
npx playwright install chromium
npm test
```

- `test/run.mjs` drives the Claude-hosted build against an in-memory stand-in for the platform.
- `test/run-web.mjs` drives the website build against the real migration loaded into an
  in-memory Postgres (PGlite), with every query run as the signed-in user so row-level
  security is enforced. Supabase's own client library, Auth service and Realtime are stood in
  for, so the first sign-in on the real project is still worth checking by hand.

Screenshots land in `test/out/`.

## Moving data between the two builds

Import / Export → **Full backup (JSON)** in either build produces one file. In the website
build, Import / Export → **Restore from a backup** loads it. Existing records are left alone.

## Differences between the builds

| | Website | Claude-hosted |
|---|---|---|
| AI drafting billed to | The `ANTHROPIC_API_KEY` account | Each rep's own Claude usage |
| Getting a draft into Gmail | *Open in Gmail* opens a filled-in compose window | *Create Gmail draft* through the Gmail connector |
| Live updates between users | Supabase Realtime, plus a reload when the tab regains focus | Built into the artifact database |
| Capacity | Postgres | 25,000 stored documents |
