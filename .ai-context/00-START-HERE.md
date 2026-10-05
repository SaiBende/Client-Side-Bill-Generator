# ShareMyBill — AI Onboarding Context

> Generated from a full read of the repo. Treat this folder as the authoritative map of the
> codebase. If code and these docs disagree, **code wins** — update the docs.

## What this project is

**ShareMyBill** — a free invoice generator for Indian small businesses.
Two delivery modes from one codebase:

| Mode | Entry point | Storage | Auth |
|---|---|---|---|
| **Web app** (hosted on Vercel at `/app`) | `npm run dev` → `index.html` → `src/main.jsx` | Supabase Postgres + RLS | Supabase email/password + Google OAuth |
| **Desktop app** (Electron, Windows) | `electron/main.cjs` → loads `dist/index.html` | Local `sql.js` (SQLite/WASM) file at `%USERPROFILE%\Documents\BillingApp\billing.db` | Local email/password (scrypt) |

Both modes share 100% of the React code. The switch happens at exactly one seam:
`src/lib/supabase.js` exports either a real `@supabase/supabase-js` client or a local adapter
(`src/lib/desktop.js`) that speaks the same chained API over Electron IPC.

## Read these, in this order

| # | File | What you get |
|---|---|---|
| 00 | `00-START-HERE.md` *(this file)* | Orientation, 60-second mental model, doc map |
| 01 | [`01-overview.md`](./01-overview.md) | Product scope, features, tech stack, dependencies, environments |
| 02 | [`02-architecture.md`](./02-architecture.md) | Layers, the dual-backend seam, IPC contract, data flow, export pipeline |
| 03 | [`03-file-map.md`](./03-file-map.md) | Every file with line count + responsibility. Use this to navigate |
| 04 | [`04-data-model.md`](./04-data-model.md) | Invoice/item shapes, camel↔snake mapping, DB schema, localStorage keys, GST math |
| 05 | [`05-conventions.md`](./05-conventions.md) | Code style, state patterns, component patterns, how to add things |
| 06 | [`06-commands-and-env.md`](./06-commands-and-env.md) | Scripts, env vars, build/publish/install flows, deployment topology |
| 07 | [`07-gotchas-and-known-issues.md`](./07-gotchas-and-known-issues.md) | **Read before you change calculation, export, or packaging code** |
| 08 | [`08-glossary.md`](./08-glossary.md) | Domain terms (GST, HSN, UPI, measurement bill, …) |

## 60-second mental model

```
                    ┌──────────────────────────────────────┐
   browser ───────► │  dist/index.html  →  src/main.jsx    │
                    │  →  src/App.jsx  (ALL app state)     │
   electron ──────► │  electron/main.cjs (BrowserWindow)   │
                    │      ↓ contextBridge                  │
                    │  window.billingDesktop               │
                    │      ↓ preload → ipcMain             │
                    │  electron/db.cjs (sql.js / SQLite)   │
                    └──────────────────────────────────────┘
```

- **No router.** `view` state in `App.jsx` is `'editor' | 'dashboard'`; share links arrive
  via the `?share=<token>` query param.
- **No state library.** Plain `useState` in `App.jsx`, drilled down as props.
- **`src/` is tiny** — 16 files, ~3,500 lines. `src/App.jsx` (1,141 lines) is the monolith
  holding routing, state, persistence, and the PDF/PNG pipeline.
- **Money math is injected, not imported.** `App.jsx` passes `calcSubtotal`, `calcGrandTotal`,
  `calcCgst`, `calcSgst`, `numberToWords` as **callbacks** into `InvoicePreview` and
  `exportDocx`. Never recompute totals inside a component.
- **Save-before-export is universal.** Every export button calls `saveInvoiceToDB()` first and
  aborts on error, so the share token and `grand_total` are always current.
- **Desktop feature gaps are surfaced as Supabase-shaped errors**, not `if (isDesktopMode)`
  branches (e.g. Google sign-in, share links). Only file output and UI chrome branch.

## Hard rules for any AI working in this repo

1. **Never read secrets.** `.env` holds `VITE_SUPABASE_ANON_KEY` (public, browser-visible by
   design) and `SUPABASE_SERVICE_ROLE_KEY` (server-only, never commit, never prefix `VITE_`).
   `.env` is gitignored.
2. **Never add `SUPABASE_SERVICE_ROLE_KEY` to any `src/` file.** It is only used by
   `db/schema/refresh.ps1`.
3. **Don't run `npm run build:vercel` before packaging the desktop app.** It overwrites
   `dist/index.html` with the landing page, and `electron/main.cjs:43` loads exactly that file.
   Use plain `npm run build` for desktop builds. See `07-gotchas-and-known-issues.md`.
4. **Lint with `npm run lint` (oxlint).** `landing/`, `scripts/`, `dist/`, `release/` are
   ignored by config.
5. **There is no test suite.** Verification is manual: `npm run desktop:dev`, plus the
   lint command. Say so rather than claiming tests pass.
6. **Line endings are CRLF** on this Windows checkout.

## Repo facts

- Root: `E:\Billing App` · package `sharemybill` v1.0.0 · `"type": "module"` · Electron entry `electron/main.cjs`
- Author/branding: **Sai Bende** — <https://github.com/saibende> · <https://saibende.vercel.app>
- Production: `https://sharemybill.vercel.app/` (landing) and `/app` (the SPA)
- Supabase project ref: `tytmqdruzdzejwatqgya`
- 3 uncommitted/untracked items as of generation: `db/` (schema snapshot, untracked),
  `billing-installer-test.nsi` (untracked)
- Root `README.md` is **still the unmodified Vite template** — ignore it; this folder is the
  real documentation.