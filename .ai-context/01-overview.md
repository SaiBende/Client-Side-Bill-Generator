# 01 — Project Overview

## Problem it solves

Indian micro/small businesses (shopkeepers, tuition coaches, freelancers, workshops) need to
issue GST-compliant-looking invoices with a phone number and zero IT staff. ShareMyBill gives
them a browser app and a Windows desktop app from one codebase, with **full offline operation**
on desktop — no account needed to start (guest mode), no internet needed to keep working.

## Feature set (all currently implemented)

### Invoice authoring
- Business profile (name, address, phone, email) + **uploadable, drag-resizable logo** with
  `Left / Center / Right` positioning and explicit pixel width/height.
- Customer block: name, address, city, state, pincode.
- Invoice meta: auto-generated number (`INV-####`, random 4-digit suffix), invoice date,
  optional due date.
- **Two bill types** (segmented toggle):
  - `normal` — classic `Qty × Rate` line items.
  - `measurement` — size/area billing, e.g. *"4 ft × 6 ft @ ₹550/sq ft"*. Each item holds
    **multiple size rows** (`measurements[]`), each with width, height, unit (`in`/`ft`),
    quantity, and a computed area. Pricing unit is per-item: `sqft` or `sqin`.
- Line items: description, quantity, rate, optional HSN/SAC code, GST rate (`0/5/12/18/28%`).
- Invoice-level **discount**, **advance paid**, **bank details** (name/account/IFSC/branch),
  **UPI** (id + name), free-text **terms**, **signature name**.
- Live on-screen preview that matches the export pixel-for-pixel.

### Money / tax
- Optional GST toggle → reveals GSTIN, HSN per item, and CGST/SGST split.
- GST is split **50/50** into CGST + SGST and applied at a **single max rate across all items**
  (not per line). Discount is applied *after* tax. See `04-data-model.md` for exact formulas.

### Output
| Output | How |
|---|---|
| **PDF** | `html2canvas` screenshot → `jsPDF` A4 |
| **PNG image** | `html2canvas` → canvas blob |
| **Word `.docx`** | `docx` library, real A4 document (added late; see gotchas) |
| **Blank printable invoice** | Separate hand-fill template rendered offscreen → PDF |
| **UPI QR code** | `qrcode` → data URL embedded in preview + share view |
| **UPI deep link** | `upi://pay?pa=…&pn=…&am=…&tn=…&cu=INR` |
| **Share link** | `?share=<uuid>` → public read-only page (web only) |
| **Native share sheet** | `navigator.share` when available (Share/Img buttons) |

### Persistence
- **Autosave, two independent debounced paths**: local draft (400 ms) and server/db row
  (1,200 ms, only when signed in). Signature-based dedupe prevents no-op writes.
- Guest mode works fully — business defaults + draft live in `localStorage`.
- Signed-in users get rows in Postgres (web) or SQLite (desktop), plus a `user_profiles`
  row that remembers business/bank/UPI/GSTIN across devices.
- **Crash/draft restore**: reopen the invoice you were editing after a reload.
- **Desktop backups**: create/list/restore/delete timestamped `.db` snapshots (keep newest 10).
  Restore is a **merge by `updated_at`**, not a rollback.

### Auth
- Web: Supabase email/password + Google OAuth (with `?billing_auth_dash` breadcrumb so an
  OAuth return lands on the dashboard instead of restoring a draft).
- Desktop: local email/password. `scrypt` + 16-byte random salt, `timingSafeEqual` compare,
  opaque 32-byte session tokens in a `sessions` table. Sign-up auto-signs-in (no email step).
- Google OAuth and share links return a friendly Supabase-shaped error on desktop.

## Tech stack

### Runtime dependencies (`package.json`)
| Package | Ver | Role |
|---|---|---|
| `react` / `react-dom` | ^19.2.7 | UI. Function components, `useState`/`useRef`/`useEffect` only |
| `@supabase/supabase-js` | ^2.110.8 | Web DB + auth |
| `sql.js` | ^1.14.2 | SQLite compiled to WASM, run in Electron main process |
| `html2canvas` | ^1.4.1 | DOM → canvas for PDF/PNG |
| `jspdf` | ^4.2.1 | PDF assembly (A4 mm units) |
| `docx` | ^9.8.1 | Word document generation |
| `file-saver` | ^2.0.5 | Present but effectively unused (see gotchas) |
| `qrcode` | ^1.5.4 | UPI QR data URLs |
| `lucide-react` | ^1.21.0 | All icons |

### Dev dependencies
`vite ^8.1.0`, `@vitejs/plugin-react ^6.0.2`, `tailwindcss ^3.4.19`, `postcss`, `autoprefixer`,
`oxlint ^1.69.0` (linter — replaces ESLint), `electron ^44.4.3`, `electron-builder ^26.15.3`,
`electron-packager ^17.1.2`, `concurrently ^10.0.5`, `@types/react`, `@types/react-dom`.

### Explicitly NOT in the stack
No router · no state manager (Redux/Zustand/Context) · no CSS framework beyond Tailwind
utilities · no CSS modules / styled-components · no test runner · no TypeScript (plain `.jsx`)
· no ORM/query builder · no component library beyond icon set.

## Environments

| | Web | Desktop |
|---|---|---|
| URL | `https://sharemybill.vercel.app/app` | `file://…/app.asar/dist/index.html` |
| Renderer | Browser | Chromium in Electron |
| Backend | Supabase (`tytmqdruzdzejwatqgya`) | `sql.js` in main process |
| Env needed | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | none |
| Extra storage | Supabase Auth | `%USERPROFILE%\Documents\BillingApp\{billing.db, Backups\, Exports\}` |
| Share links | yes | no (error returned) |
| Google login | yes | no (error returned) |

## Repo layout (one-line each)

```
.ai-context/   ← these docs
db/            ← Supabase schema snapshot + migrations (UNTRACKED in git)
dist/          ← build output (gitignored) — landing at root, SPA at dist/app
electron/      ← main process: window, IPC, sql.js store, preload bridge
landing/       ← static marketing site (plain HTML/CSS/JS, no framework)
public/        ← logo.png, logo.ico, favicon.svg, leftover icons.svg
release/       ← packaged Windows artifacts (gitignored, ~400 MB)
scripts/       ← build-landing.mjs, capture-shot.cjs (dev screenshot tool)
src/           ← the React app (16 files, ~3,500 lines)
supabase-*.sql ← root-level duplicates of db/schema/migrations/*.sql
```

## Author / branding constants

Defined once in `src/components/BrandFooter.jsx` and reused in the landing copy:

```js
const GITHUB   = 'https://github.com/saibende'
const PORTFOLIO = 'https://saibende.vercel.app'
```

Brand colors on the landing site are CSS custom properties in
`landing/assets/css/style.css` (`--ink #1e1b4b`, `--violet #7c3aed`,
`--violet-deep #5b21b6`). The **app itself uses stock Tailwind grays/blues** — the brand
palette is not yet applied in-app. The QR code hardcodes `#1e3a5f`.

## Git history themes (for orientation)

Recent commits cluster into: measurement-bill support, advance/balance fields,
electron offline app + backups, landing page + SEO, DOCX export, draft restore.
Feature work lands as one focused commit per concern, lowercase conventional-ish prefixes
(`add …`, `fix …`, `stop …`, `restore …`, `rebrand …`).