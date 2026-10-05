# AGENTS.md

## Read this first

Full project context lives in **[`.ai-context/`](./.ai-context/)**. Start with
[`00-START-HERE.md`](./.ai-context/00-START-HERE.md).

| Doc | Contents |
|---|---|
| [`00-START-HERE.md`](./.ai-context/00-START-HERE.md) | Orientation, 60-second mental model, doc map, hard rules |
| [`01-overview.md`](./.ai-context/01-overview.md) | Product scope, features, tech stack, environments |
| [`02-architecture.md`](./.ai-context/02-architecture.md) | Layers, the dual-backend seam, IPC contract, data flow, export pipeline |
| [`03-file-map.md`](./.ai-context/03-file-map.md) | Every file with line count + responsibility, and a search cheatsheet |
| [`04-data-model.md`](./.ai-context/04-data-model.md) | Invoice/item shapes, camel↔snake mapping, DB schema, localStorage keys, GST math |
| [`05-conventions.md`](./.ai-context/05-conventions.md) | Code style, patterns to follow, "how to add X" recipes |
| [`06-commands-and-env.md`](./.ai-context/06-commands-and-env.md) | Scripts, env vars, packaging, deployment |
| [`07-gotchas-and-known-issues.md`](./.ai-context/07-gotchas-and-known-issues.md) | **Read before changing calculation, export, or packaging code** |
| [`08-glossary.md`](./.ai-context/08-glossary.md) | GST/HSN/UPI/measurement-bill and architecture terms |

The root `README.md` is the unmodified Vite template and is not documentation.

## What this is

**ShareMyBill** — an invoice generator for Indian small businesses. One React codebase, two
targets:

- **Web** — React 19 + Vite SPA at `/app` on Vercel, Supabase Postgres + Auth.
- **Desktop** — Electron shell on Windows, fully offline via `sql.js` (SQLite/WASM) in the
  main process.

The backend switch happens at exactly one seam, `src/lib/supabase.js`.

## Non-negotiables

1. **Never expose secrets.** `.env` is gitignored. `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS —
   it is used only by `db/schema/refresh.ps1`. Never import it into `src/`, never give it a
   `VITE_` prefix, never commit it.
2. **Never run `npm run build:vercel` before packaging the desktop app.** It overwrites
   `dist/index.html` (the Electron entry point) with the landing page. Use `npm run build` for
   desktop builds.
3. **Import `supabase` from `src/lib/supabase.js`** — never `@supabase/supabase-js` directly.
   Only a narrow Supabase API subset works on desktop (see 02 §2).
4. **Never recompute totals inside a render component.** `src/lib/calculations.js` is the single
   source of truth for the money math. `App.jsx` wraps it in zero-arg closures and injects those
   into `InvoicePreview`, `InvoiceForm` and `exportDocx` — the injection signatures must not
   change. `Dashboard.jsx` imports `rowGrandTotal` directly.
5. **Always read measurement sizes via `measurementRows(item)`** from
   `src/lib/measurements.js`, never `item.measurements` — it carries the legacy flat-shape
   fallback.
6. **Don't add `isDesktopMode` branches to components.** Surface offline-incompatible
   features as Supabase-shaped errors from `src/lib/desktop.js`. The only legitimate
   branches are file output (`src/lib/desktopFiles.js`) and UI chrome in `src/App.jsx`.
7. **Keep the root `supabase-*.sql` files and `db/schema/migrations/*.sql` in sync** — they are
   byte-identical duplicates.
8. **Don't remove the `captureToPDF` `onclone` word/letter-spacing hack** or the offscreen
   capture divs — they are load-bearing for export fidelity.

## Conventions in brief

- Plain JavaScript, no TypeScript. `"type": "module"`; Electron files are `.cjs`.
- Tailwind utility classes inline in JSX; `tailwind.config.js` has an **empty theme** (stock
  colors only). Global CSS only in `src/index.css`.
- Function components, props drilled from `App.jsx`. No router, no state library, no Context.
- Fully controlled forms — mutation callbacks (`updateField`, `updateItem`, …).
- Two-space indent, single quotes in JS, double quotes in JSX, semicolons.
- **No comments in source** — match the existing style.
- Money idiom: `Number(value) || 0`, `.toFixed(2)`, literal `₹`.
- A new invoice field touches: `defaultInvoice`, `InvoiceForm`, `InvoicePreview` (with a
  placeholder), `saveInvoiceToDB`, `loadInvoiceFromRow`, `INVOICE_COLS` in
  `electron/db.cjs`, plus a Postgres migration in **both** locations. See 05 for the full recipe.
- Icons: `lucide-react`, imported individually.
- CR﻿LF line endings on this checkout.

## Verify with

```bash
npm run lint        # oxlint — the only automated gate
npm run desktop:dev # Vite + Electron with hot reload
```

**There is no test suite and no test script.** Don't claim tests pass — say it wasn't run.