# Matthews Consignment CRM

Equipment consignment prospecting CRM for Matthews Auctioneers: companies, contacts,
activity, tasks, opportunities, territories, spreadsheet import, a review queue and
AI-drafted outreach.

## Layout

| Path | What it is |
|---|---|
| `src/core.js` | Option lists, helpers, the storage layer (`Store`), territory matching, derived data, CSV |
| `src/ui.js` | App state, rendering, dialogs, every screen except import and outreach, exports |
| `src/import.js` | CSV / Excel import: column matching, match-before-create planning, apply |
| `src/outreach.js` | AI email drafting and the outreach queue |
| `src/app.js` | Event wiring and start-up |
| `src/style.css`, `src/shell.html` | Styles and the page shell |
| `seed/territories.json` | The seven starting territories (cities, counties, main-town ZIPs) |
| `build.mjs` | Inlines everything into `dist/matthews-consignment-crm.html` |
| `test/` | End-to-end browser test against an in-memory stand-in for the platform |

## Build and test

```
npm install
npx playwright install chromium
npm test        # builds, then runs the browser test; screenshots land in test/out/
```

`npm run build` alone writes the single-file page to `dist/`.

## Where it runs today

The built page is published as a Claude artifact. It depends on the platform through
`window.claude.use(...)` in five places only:

| Capability | Used for | Where |
|---|---|---|
| `db` | All records and settings | `Store` in `src/core.js` |
| `user` | Recognizing the signed-in rep, read-only detection | `boot()` / `identify()` in `src/app.js` |
| `downloads` | CSV and backup exports | `saveFile()` in `src/ui.js` |
| `sample` | AI email drafts | `aiDraftOne()` / `aiDraftMany()` in `src/outreach.js` |
| `mcp` (Gmail `create_draft`) | Putting a reviewed draft into the rep's Gmail drafts | `gmailDraft()` in `src/outreach.js` |

Records are stored in block documents (`{items: {id: record}}`, about 80 records each)
in the collections `co`, `ct`, `ac`, `tk`, `op`, `dr`, plus settings in `cfg/territories`,
`cfg/team` and `cfg/outreach`.

## Moving to Vercel + Supabase

- Replace `Store` with Supabase calls against real tables (companies, contacts, activities,
  tasks, opportunities, email_drafts, territories, team). Its public surface is small:
  `init`, `addMany`, `patchMany`, `remove`, `cfgPatch`, and an `onChange` callback.
- Replace the "who are you" prompt with Supabase Auth and map each user to a team record.
- Replace `saveFile()` with ordinary browser downloads.
- Replace the two `CAP.sample` calls with a server route that calls the Claude API. Replace
  `gmailDraft()` with the Gmail API (OAuth per rep) or an email-sending service.
- Load data from the CRM's full backup export (Import / Export → Full backup).
- Vercel can serve `dist/` as a static site; no framework is required.
