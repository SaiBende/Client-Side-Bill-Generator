# 03 — File Map

Every tracked file, with line count and responsibility. `node_modules/`, `dist/`, `release/`,
`.git/`, `.idea/` excluded.

Legend: ⭐ = load-bearing / read this first · ⚠ = contains a known problem (see 07)

---

## `src/` — the React app (16 files, ~3,500 lines)

There is **no** `hooks/`, `context/`, `services/`, `pages/`, or `utils/` folder. Service-layer
logic lives in `src/lib/`; views are all components.

| File | Lines | Responsibility |
|---|---:|---|
| ⭐ `src/App.jsx` | **1070** | **The monolith.** Routing (`view`, `?share=`), all app state, both autosaves, `requireAuth` gate, draft/edit restore, business-defaults sync, `captureToPDF`, Share/Img/Blank/DOCX handlers, `SharedInvoiceView`, `numberToWords`, global wheel-listener fix, responsive layout, mobile bottom nav. Contains 2 components + ~8 module helpers. Its `calcSubtotal`/`calcGstRate`/`calcCgst`/`calcSgst`/`calcGrandTotal` are now **zero-arg wrappers over `lib/calculations.js`** (imported as `import * as totals`) — the duplicated math is gone but the callback signatures stay. Tracks `invoice.status` so saves stop resetting paid invoices. |
| `src/main.jsx` | 10 | Entry. `createRoot` → `<StrictMode><App/></StrictMode>`, imports `./index.css`. |
| `src/index.css` | 24 | Only stylesheet. 3 Tailwind directives + `@keyframes slide-in`/`.animate-slide-in` (toast), `.scrollbar-none` (mobile action bar), `.safe-area-bottom` (mobile nav), number-input spinner hiding (webkit + moz). |
| `src/assets/` | — | **Empty, vestigial.** Dead directory. |

### `src/lib/`

| File | Lines | Exports & notes |
|---|---:|---|
| ⭐ `src/lib/supabase.js` | 13 | `supabase` — the single seam. `isDesktopMode ? createLocalAdapter() : createWebClient()`. Web client **throws eagerly** if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` missing. |
| ⭐ `src/lib/desktop.js` | 157 | `isDesktopMode` (named + default), `createLocalAdapter()`. Reads `window.billingDesktop`. Contains `localAuth` (module-level `sessionCache` + `authListeners`), `getToken/setToken` on `billing_desktop_token`, and `makeBuilder(table)` — the thenable Supabase-compatible query builder that serializes to one object. |
| `src/lib/desktopFiles.js` | 14 | `desktopExportFile(name, dataUrl, { ask })`, `desktopReveal(fp)`, `isDesktop`. Non-desktop returns `{ error: { message: 'Not available' }, path: null, canceled: false }`. |
| ⭐ `src/lib/measurements.js` | 40 | Pure area math, zero deps: `toInches`, `measurementRows` (incl. legacy-shape fallback), `measurementRowAreaInPricing`, `measurementTotalArea`, `measurementItemAmount`, `measurementRowAmount` (⚠ exported, unused), `formatTotalArea`, `unitLabel`, `areaUnitLabel`. `SQ_INCHES_PER_SQ_FOOT = 144`. |
| ⭐ `src/lib/calculations.js` | 35 | **The money math, single source of truth** (created 2026-10-04). Zero React: `calcSubtotal(items, billType)`, `calcGstRate(items)` (empty array → `0`, never `-Infinity`), `calcCgst`/`calcSgst(items, billType, enableGst)`, `calcGrandTotal({ items, billType, enableGst, discount })`, and `rowGrandTotal(row)` for snake_case DB rows (prefers stored `grand_total`, recomputes when `0`/null). Depends only on `measurements.js`. Keep the add order `subtotal + cgst + sgst - discount` — see 07 §2b. |
| `src/lib/logo.js` | 73 | `billing_logo` + `billing_logo_settings` CRUD, `DEFAULT_LOGO_SETTINGS = { position:'center', width:80, height:80 }`, `resizeLogo(file, maxDim=400)` (FileReader → Image → canvas → PNG data URL). Every access try/catch-wrapped. |
| `src/lib/exportDocx.js` | 646 | `exportInvoiceDocx(invoice, calcSubtotal, calcGrandTotal, calcCgst, calcSgst, numberToWords, logo, logoSettings)` (named + default). **A hand-mirrored twin of `InvoicePreview.jsx`** — same design, built with `docx` primitives instead of HTML. Helpers: `C` (Tailwind-gray palette map), `F` (px → docx half-point size map), `px()` (px → DXA twips), `tw()` (**percent → DXA twips; the Google Docs fix**), `thin`/`noBorder(s)`/`boxBorders`, `t()` (TextRun), `p()` (Paragraph), `cell()` (TableCell), `layoutTable()` (borderless table used as a flexbox container), `base64ToBytes`, `imageRun`, `toDataURL`, `INR`. Page geometry constants `PAGE_W`/`MARGIN_X`/`CONTENT_W`/`INNER_W`/`FRAME_PAD`. Every table is `TableLayoutType.FIXED` with explicit `columnWidths` in twips; **no percentage widths anywhere** (breaks Google Docs — see 07 §4c). Table nesting kept to depth 2. Generates the UPI QR itself via `qrcode`. Packs with `Packer.toBlob(doc)`. **File output branches on `isDesktop`**: on desktop the blob is base64-encoded and written via `desktopExportFile(..., { ask: true })` so Word gets the same native Save dialog as PDF/PNG (and returns `{ canceled, error, path }`); on web it falls back to a manual `<a download>` with `revokeObjectURL` deferred 10 s and returns `{ canceled: false, error: null, path: null }`. Both paths emit identical `document.xml`. See 07 §4. |

### `src/components/`

| File | Lines | Props / responsibility |
|---|---:|---|
| `src/components/Dashboard.jsx` | 191 | `{ user, onSignOut, onNewInvoice, onEditInvoice, onToast, onCopyLink }`. Local `invoices[]/loading/deleteConfirm`. Loads once on mount: `from('invoices').select('*').eq('user_id',user.id).order('created_at',{ascending:false})`. `StatusBadge` custom dropdown (click-outside on `mousedown`+`touchstart`, options `pending/paid/cancelled`). Optimistic delete + status update. Custom delete modal. `totalRevenue()` and the per-row amount both use `rowGrandTotal()` from `lib/calculations.js` (GST- and measurement-aware; fixed 2026-10-04). |
| `src/components/InvoiceForm.jsx` | 427 | 17 props: 13 mutation callbacks — `{ invoice, updateField, updateItem, addItem, removeItem, addItemMeasurement, updateItemMeasurement, removeItemMeasurement, logo, logoSettings, onUploadLogo, onRemoveLogo, onLogoSettingsChange }` — plus the 4 injected calculators `{ calcSubtotal, calcCgst, calcSgst, calcGrandTotal }`. Local presentational components `Section`, `Field`, `Input`, `ResizableLogo`. Six sections: Business / Customer / Invoice Details / Items / Payment / Terms. Toggles: Bill Type (`normal`\|`measurement`), Enable GST, logo position. Footer renders Subtotal → Taxable Amount → CGST → SGST → Discount → Advance → Grand Total → Balance Due from the callbacks; it computes **no** totals itself. |
| ⭐ `src/components/InvoicePreview.jsx` | 234 | `{ invoice, calcSubtotal, calcGrandTotal, calcCgst, calcSgst, numberToWords, logo, logoSettings }`. **The rendered invoice.** Local `qrDataUrl` (160px, `#1e3a5f`) regenerated on upiId/upiName/businessName/invoiceNumber/grandTotal change. Three-way table branch (measurement / normal / empty). HSN only when `enableGst`. Measurement rows use `rowSpan` on `#`/HSN/Description/Rate/Amount for `mi===0`. Every field has a placeholder so sparse drafts still render. |
| `src/components/BlankInvoicePreview.jsx` | 122 | `{ businessName, businessAddress, businessPhone, businessEmail, logo, logoSettings }` — business fields only, **no** HSN/Size/GST. 5 dotted-line writing guides, blanks for Subtotal/Discount/Grand Total/Amount in Words, 3 bank lines, 2 terms lines, signature block. Never rendered visibly — capture target only. |
| `src/components/BackupManager.jsx` | 161 | `{ open, onClose }`. **Desktop only.** Bypasses `lib/desktop.js` — grabs `window.billingDesktop` directly. State `paths/backups/busy/confirmRestore/message`. `load` = `Promise.all([api.paths(), api.backup.list()])`. Auto-clears `message` after 4 s. Shows absolute paths in `font-mono break-all`. Two nested confirm layers (backdrop, then `confirmRestore` inner dialog). |
| `src/components/BrandFooter.jsx` | 39 | `{ compact = false }`. **Zero imports.** Constants `GITHUB='https://github.com/saibende'`, `PORTFOLIO='https://saibende.vercel.app'`. `compact` → one centered `<p>`; else full `<footer>` with 3 links. |
| `src/components/auth/AuthModal.jsx` | 161 | `{ open, onClose, local=false, onAuthInitiated }`. Bottom sheet on mobile (`items-end`), centered card from `sm:` up. State `email/password/loading/isSignUp/message`. `handleEmailAuth` 4-way branch (error / desktop auto-login / web "check your email" / close on success). `handleGoogleAuth` sets `localStorage['billing_auth_dash']='1'` before OAuth. Hand-written 4-color Google SVG. Password `minLength={6}`. Message colour chosen by substring sniffing. |

---

## `electron/` — main process (5 files, 725 lines, CommonJS `.cjs`)

| File | Lines | Responsibility |
|---|---:|---|
| `electron/db.cjs` | 494 | The local store. `INVOICE_COLS`(30)/`PROFILE_COLS`(12) whitelists, `NUMERIC_COLS`/`BOOL_COLS`/`JSON_COLS`, `normalizePayload`/`mapRow`, `rootPaths()`/`ensureDirs()`/`initStore()`/`persistNow()`, `migrate()`, `query(op)` → `runSelect/runInsert/runUpdate/runUpsert/runDelete`, local auth (`authGetSession`/`authSignUp`/`authSignIn`/`authSignOut`, scrypt), backups (`createBackup`/`listBackups`/`restoreBackup`/`deleteBackup`), `BACKUP_KEEP = 10`, `MERGE_TABLES`. |
| `electron/ipc.cjs` | 86 | Registers all 13 `ipcMain.handle` channels + `safeName()` + `broadcastAuth()`. Exports `{ registerIpc, broadcastAuth }`. |
| `electron/main.cjs` | 86 | `isDev`, `Menu.setApplicationMenu(null)`, `quitting` flag, `resolveLogo()` (probes `dist/logo.png` then `public/logo.png`), `createWindow()` (1280×860, min 900×640, `autoHideMenuBar`), load dev URL vs `dist/index.html`, F12 DevTools via `before-input-event`, `reloadAfterCrash()` with `crashTimes` window (30 s / max 3), `app.whenReady()` → `initStore()` → `registerIpc()` → `createWindow()`. |
| `electron/preload.cjs` | 29 | `contextBridge.exposeInMainWorld('billingDesktop', …)` — see the full surface in 02 §3. |
| `electron/start-dev.mjs` | 31 | ESM. `waitForVite()` — 60 attempts, `fetch(url)` expecting `res.ok`, 1,000 ms apart, else throws `Vite dev server not reachable at <url>`. Then spawns `require('electron')` with `['.']`, `env.VITE_DEV_SERVER_URL`. |

---

## `db/` — Supabase schema snapshot ⚠ **UNTRACKED in git**

Not a sql.js export — a documentation/introspection folder for Supabase project
`tytmqdruzdzejwatqgya` (`https://tytmqdruzdzejwatqgya.supabase.co`). Nothing imports it at
runtime. Snapshot date **2026-09-30**.

| File | Lines | Contents |
|---|---:|---|
| `db/schema/README.md` | 42 | What the folder is, how it was captured, how to refresh, key rotation. |
| `db/schema/schema.md` | 93 | Column-by-column reference for both tables, RLS, indexes, triggers, RPCs. |
| `db/schema/schema.sql` | 164 | Consolidated runnable current-state DDL. `advance` and `bill_type` are `NOT NULL` here (differs from migration 01). Notes which parts are live-verified vs reconstructed. |
| `db/schema/postgrest-openapi.json` | 1 (minified, 20 KB) | Live PostgREST OpenAPI snapshot, PostgREST v14.5. Paths: `/`, `/invoices`, `/user_profiles`, `/rpc/rls_auto_enable`, `/rpc/get_shared_invoice`. |
| `db/schema/refresh.ps1` | 29 | Re-fetches the OpenAPI snapshot via `curl.exe` using keys parsed from `.env` (falls back to `Read-Host -AsSecureString`). ⚠ hardcodes absolute path `E:\Billing App\.env`. Fails if output < 1000 bytes. |
| `db/schema/migrations/01-invoices-and-profiles.sql` | 141 | Base schema — byte-identical to root `supabase-schema.sql`. |
| `db/schema/migrations/02-advance-column.sql` | 5 | `advance` column. |
| `db/schema/migrations/03-measurement-bill-type.sql` | 6 | `bill_type` column. |
| `db/schema/migrations/04-rls-share-fix.sql` | 14 | Drops the leaky public-read policy, recreates `get_shared_invoice`. |

---

## `scripts/` (2 files, 100 lines)

| File | Lines | Responsibility |
|---|---:|---|
| `scripts/build-landing.mjs` | 25 | Copies `landing/` into `dist/` **after** deleting `dist/{assets,robots.txt,sitemap.xml,privacy.html,index.html}`. Throws `dist/app not found — run the Vite build first (vite build --base=/app/ --outDir dist/app)` if the SPA build is missing. Then hoists `public/logo.ico|logo.png` to `dist/`. |
| ⚠ `scripts/capture-shot.cjs` | 75 | Dev-only Electron screenshot tool for landing assets. `APP_URL = CAPTURE_URL \|\| 'http://localhost:4137/app/'`, `OUT_DIR = landing\assets\images`. Offscreen `BrowserWindow` 1440×940, waits 2,200 ms, `executeJavaScript` writes a **hardcoded sample invoice** into `localStorage['billing_draft']`, reloads, waits 3,200 ms, `capturePage()` → `app-editor.png`. `setPath('userData', tmpdir)`. ⚠ Depends on a `smoke-server.mjs` on port 4137 that **does not exist** in this repo; also never writes `app-invoice.png`. Run via `node node_modules/electron/cli.js scripts/capture-shot.cjs`. |

---

## `landing/` — static marketing site (no framework, no build)

| File | Lines | Notes |
|---|---:|---|
| `landing/index.html` | 425 | Full page. Sections: `#top` header (hamburger `.nav-toggle`/`.site-nav`) → `.hero` → `.trust-strip` (4) → `#features` (6 cards) → "Built for" (4 use-cases: shop keepers, coaches, freelancers, workshops) → `#web-app` → `#desktop-app` (mentions `Documents\BillingApp` local SQLite) → `#install` (4 steps, `ShareMyBill-Setup-1.0.0.exe` ~161 MB, SmartScreen "More info → Run anyway", portable zip) → `#how` (3 steps) → `.tech-band` (React, Vite, Supabase, SQLite/sql.js, Electron, jsPDF) → `#faq` (7 `<details>`) + `.faq-cta` → `.site-footer`. JSON-LD `@graph` with 4 nodes. |
| `landing/privacy.html` | 88 | Prose layout, "Last updated: September 2026". |
| `landing/robots.txt` | 5 | `Allow: /`, `Disallow: /app/`, sitemap → `https://sharemybill.vercel.app/sitemap.xml`. |
| `landing/sitemap.xml` | 21 | 3 URLs: `/` (1.0), `/app/` (0.9), `/privacy.html` (0.3). All `lastmod 2026-09-27`. |
| `landing/assets/css/style.css` | 291 | `:root` tokens — `--ink #1e1b4b`, `--ink-soft #443d6b`, `--muted #6b6b7b`, `--paper #fff`, `--soft #f6f5ff`, `--line #e6e4f2`, `--violet #7c3aed`, `--violet-deep #5b21b6`, `--violet-soft #ede9fe`, `--radius 14px`, `--shadow`, `--font` (system-ui). Comment-annotated blocks. `@media (prefers-reduced-motion: reduce)` at 257, `max-width:900px` at 264, `max-width:560px` at 285. |
| `landing/assets/js/main.js` | 39 | Nav toggle, `[data-year]`, IntersectionObserver reveal. |
| `landing/assets/images/app-editor.png` | 107 KB | Editor screenshot 1440×940. |
| `landing/assets/images/app-invoice.png` | 48 KB | Rendered invoice 912×956. |
| `landing/assets/images/og.png` | 146 KB | OG image 1200×630. |

---

## `public/` (Vite static root)

| File | Size | Notes |
|---|---:|---|
| `public/logo.png` | 1,056,745 | Main brand logo. Used by landing, `index.html`, `main.cjs::resolveLogo`. |
| `public/logo.ico` | 93,780 | Favicon + copied to `dist/logo.ico`. |
| `public/favicon.svg` | 9,522 | Purple `#863bff` glyph, `viewBox="0 0 48 46"`. |
| ⚠ `public/icons.svg` | 5,031 | **Leftover Vite-template sprite** (`bluesky-icon` etc.). Referenced by nothing. |

Also at repo root: **`logo.ico`** (140,273 B) — a *different, larger* icon used by the NSIS
`MUI_ICON` define via NSIS's relative path resolution. Two logo files, don't unify blindly.

---

## Root config

| File | Lines | Contents |
|---|---:|---|
| `index.html` | 16 | Vite SPA entry: `<div id="root">`, favicons `/logo.ico` + `/logo.png`, meta description/author, title `ShareMyBill — Indian Business Invoice Generator`, `<script type="module" src="/src/main.jsx">`. |
| `vite.config.js` | 7 | `defineConfig({ plugins: [react()], base: './' })` — relative base so `dist/index.html` works from `file://` in Electron. |
| `tailwind.config.js` | 11 | `content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}']`, `theme.extend: {}`, `plugins: []` — **no brand theme**. |
| `postcss.config.js` | 6 | ESM `{ plugins: { tailwindcss: {}, autoprefixer: {} } }`. |
| `vercel.json` | 9 | `framework: "vite"`, `buildCommand: "npm run build:vercel"`, `outputDirectory: "dist"`, one rewrite `{ source: "/app/:path*", destination: "/app/index.html" }`. |
| `.oxlintrc.json` | 9 | `ignorePatterns: ["landing/**","scripts/**","dist/**","release/**"]`; `plugins: ["react","oxc"]`; rules `react/rules-of-hooks: "error"`, `react/only-export-components: ["warn", { allowConstantExport: true }]`. |
| `.gitignore` | 26 | logs, `node_modules`, `dist`, `.env`, `dist-ssr`, `release`, `*.local`, editor junk. ⚠ `db/` and `*.nsi` are **not** ignored. |
| `.electronignore` | 18 | `node_modules/.cache`, `electron`, `electron-builder`, `electron-packager`, `src`, `public`, `.env`, `.gitignore`, `.oxlintrc.json`, `postcss.config.js`, `tailwind.config.js`, `vite.config.js`, `index.html`, `package-lock.json`, `release`, `supabase-*.sql`, `rt_*`. |
| `package.json` | 76 | See 06 for scripts and the `electron-builder` block. |
| ⚠ `README.md` | 16 | **Unmodified Vite template README.** Zero project documentation. This folder is the real doc. |
| `.env` | 5 | gitignored. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, a comment, `SUPABASE_SERVICE_ROLE_KEY`. |

---

## Root SQL — duplicates of `db/schema/migrations/` (verified byte-identical)

| File | Lines | Contents |
|---|---:|---|
| `supabase-schema.sql` | 141 | `CREATE EXTENSION "uuid-ossp"`. `invoices` table (~51 lines), indexes `idx_invoices_user_id`, `idx_invoices_created_at (DESC)`, `update_updated_at_column()` trigger + `CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE … FOR EACH ROW`, RLS enabled + **4 policies** (view/insert/update/delete own, all `auth.uid() = user_id`). `user_profiles` with `user_id` PK, `updated_at`, 12 TEXT cols, RLS + **3 policies** (no DELETE). `get_shared_invoice(token UUID) RETURNS SETOF invoices … SECURITY DEFINER`. |
| `supabase-advance-column.sql` | 5 | `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS advance NUMERIC(10,2) DEFAULT 0 NOT NULL;` |
| `supabase-measurement-bill.sql` | 6 | `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_type TEXT DEFAULT 'normal' NOT NULL CHECK (bill_type IN ('normal','measurement'));` |
| `supabase-rls-fix.sql` | 14 | `DROP POLICY IF EXISTS "Anyone can view shared invoices" ON invoices;` + recreates the `SECURITY DEFINER` RPC. |

⚠ If you change a migration, **change both copies** (root + `db/schema/migrations/`).

---

## NSIS installers (2 files, 65 lines each)

Both standalone scripts (not electron-builder-generated), `Unicode true`, MUI2,
Welcome → Directory → InstFiles → Finish, `MUI_FINISHPAGE_RUN "$INSTDIR\$APPEXE"`,
`MUI_UNPAGE_CONFIRM` + `MUI_UNPAGE_INSTFILES`, `MUI_ABORTWARNING`,
`!insertmacro MUI_LANGUAGE "English"`. Neither touches `Documents\BillingApp` or any env var.

| | `billing-installer.nsi` (production) | ⚠ `billing-installer-test.nsi` (untracked) |
|---|---|---|
| `OutFile` | `release\ShareMyBill Setup 1.0.0.exe` | `release\test-setup.exe` |
| `APPNAME` / `APPEXE` | `ShareMyBill` / `ShareMyBill.exe` | `Billing App` / `Billing App.exe` |
| `InstallDir` | `$PROGRAMFILES64\ShareMyBill` (reg-key backed) | `$LOCALAPPDATA\Billing App` |
| `RequestExecutionLevel` | `admin` | `user` |
| `SetCompressor` | `zlib` | `/SOLID lza` |
| `SetShellVarContext` | `all` | `current` |
| `MUI_ICON` / `MUI_UNICON` | `logo.ico` (root, 140 KB) | NSIS `modern-install.ico` / `modern-uninstall.ico` |
| Sources | `release\ShareMyBill-win32-x64\*.*` | ⚠ `release\Billing App-win32-x64\*.*` — **folder does not exist** |
| `Publisher` | `Sai Bende` | `${APPNAME}` |

Both write `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\…` with
`DisplayName`, `DisplayVersion`, `Publisher`, `InstallLocation`, `UninstallString`,
`DisplayIcon`, `NoModify 1`, `NoRepair 1`, `EstimatedSize 400000`; create Start-menu folder +
Desktop shortcut; `WriteUninstaller`; uninstall deletes shortcuts, `DeleteRegKey HKLM`,
`RMDir /r "$INSTDIR"`.

---

## Build artifacts (gitignored — do not edit)

| Path | Contents |
|---|---|
| `dist/` | Current output is from `npm run build:vercel`: root = landing site (`index.html` 24.8 KB, `privacy.html`, `robots.txt`, `sitemap.xml`, `assets/…`, `logo.*`), plus `dist/app/` = the SPA (`index.html` 780 B, `assets/index-*.js` **~1.5 MB**, `assets/index-*.css` 23 KB, `index.es-*.js` 151 KB, `purify.es-*.js` 26 KB). |
| `release/` | `ShareMyBill Setup 1.0.0.exe` (~160.8 MB), `ShareMyBill-win32-x64.zip` (~161.6 MB), `ShareMyBill-win32-x64/` (121 files, ~393 MB unpacked Electron 44.4.3). |
| `node_modules/` | Includes `sql.js/dist/sql-wasm.wasm` (658,410 B) required at runtime by the main process. |

---

## Search cheatsheet

| Looking for… | Go to |
|---|---|
| The invoice object shape | `src/App.jsx` → `defaultInvoice`; `04-data-model.md` |
| Where totals are computed | `src/lib/calculations.js` — change it there, nowhere else |
| A specific UI region | `03-file-map.md` → `src/components/` |
| The DB columns | `db/schema/schema.sql`; `04-data-model.md` |
| Electron file output | `electron/ipc.cjs` → `files:save` |
| The measurement/size math | `src/lib/measurements.js` |
| Autosave behaviour | `src/App.jsx` (two effects, 400 ms + 1,200 ms) |
| How a table row is rendered | `src/components/InvoicePreview.jsx` |
| Guest (no-account) persistence | `billing_business_defaults` in `src/App.jsx` |