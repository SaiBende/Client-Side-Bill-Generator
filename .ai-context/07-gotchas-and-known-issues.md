# 07 — Gotchas & Known Issues

Read this before touching calculation, export, or packaging code. Severity:
🔴 breaks the app · 🟠 wrong output/data · 🟡 maintenance debt.

---

## 🔴 1. `build:vercel` destroys the desktop entry point

`electron/main.cjs:43` loads **`dist/index.html`** in production:
```js
mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
```
`npm run build:vercel` runs `scripts/build-landing.mjs`, which **deletes
`dist/index.html`** and replaces it with the **landing page**, moving the SPA to
`dist/app/index.html`.

Running `build:vercel` and then packaging ships a desktop app that opens the marketing site.

**Rule:** `npm run desktop:dist`, `desktop:exe`, `desktop:start` all use plain `npm run build`.
Only use `build:vercel` for Vercel. If both are needed, rebuild with `npm run build` before
packaging.

---

## 🔴 2. Divergent implementations of invoice totals

The money math is not centralized. `App.jsx` is the source of truth, but copies still exist:

| # | Location | GST-aware | Measurement-aware | Where it shows | Status |
|---|---|---|---|---|---|
| 1 | `App.jsx` `calcSubtotal`/`calcGstRate`/`calcCgst`/`calcSgst`/`calcGrandTotal` | ✅ | ✅ | injected into preview, form footer, DOCX; persisted as `grand_total` | **source of truth** |
| 2 | `InvoiceForm.jsx` footer | ✅ | ✅ | Subtotal / GST lines / Grand Total / Balance Due | **fixed 2026-10-04** — now receives the calculators as props |
| 3 | `Dashboard.jsx` `totalRevenue()` | ✅ | ✅ | the "Total Revenue" stat card | **fixed 2026-10-04** — now uses `rowGrandTotal()` |
| 4 | `exportDocx.js` per-row amount | n/a | ✅ `measurementItemAmount` | DOCX line items | fixed 2026-10-04 |

`InvoiceForm.jsx` used to inline its own sum and **omit GST entirely**, so the editor footer
showed a Grand Total lower than the preview and the PDF on the same screen — ₹48,000 vs
₹55,640 at 18% GST. It now takes `calcSubtotal`/`calcCgst`/`calcSgst`/`calcGrandTotal` as
props, matching how `InvoicePreview` is wired. This was also a direct violation of rule 4 in
`AGENTS.md` ("never recompute totals inside a render component").

**`Dashboard.jsx` `totalRevenue()` was also wrong** — it recomputed `quantity × rate` minus
discount, so it ignored GST *and* ignored `measurementItemAmount`, under-reporting every
measurement invoice. It now calls `rowGrandTotal()` from `src/lib/calculations.js`, which
**prefers the `grand_total` column already stored on each row** and only recomputes when that
is `0`/null (rows predating the column). On a 3-invoice sample this moved revenue from
₹91,000 to ₹1,03,038.40. The per-row display at `Dashboard.jsx:160` was also switched to
`rowGrandTotal()` — it called `.toFixed(2)` directly on `grand_total`, which **throws** if
PostgREST returns the `NUMERIC` column as a string.

### 2b. `src/lib/calculations.js` now owns the money math (2026-10-04)

The five calculators were duplicated verbatim in `App.jsx` (editor) and again in
`SharedInvoiceView`, with a third divergent copy in `Dashboard.jsx`. They now live in
**`src/lib/calculations.js`**:

| Export | Signature | Notes |
|---|---|---|
| `calcSubtotal(items, billType)` | array + `'normal'`/`'measurement'` | measurement bills use `measurementItemAmount` |
| `calcGstRate(items)` | array | guarded: empty array → `0`, never `-Infinity` |
| `calcCgst` / `calcSgst(items, billType, enableGst)` | | `0` when GST is off; SGST always mirrors CGST |
| `calcGrandTotal({ items, billType, enableGst, discount })` | object | single add order: `subtotal + cgst + sgst - discount` |
| `rowGrandTotal(row)` | snake_case DB row | stored `grand_total` first, recompute as fallback |

`App.jsx` imports it as `import * as totals from './lib/calculations'` and keeps its original
zero-arg closures (`calcSubtotal()`, `calcGrandTotal()`, …) so **the injection signatures are
unchanged** — `InvoicePreview`, `InvoiceForm` and `exportDocx` needed no edits. `Dashboard.jsx`
imports `rowGrandTotal` directly.

The add order matters: the old code computed `subtotal + cgst + cgst - discount`, so the
refactor reproduces that exact association rather than `subtotal + (cgst * 2)`. Verified
**bit-exact** (`===`) across 4,000 randomised invoices × 5 assertions — a `cgst * 2`
rewrite shifts some half-paisa boundaries by 0.01 through float rounding.

`numberToWords` is still duplicated and is the remaining copy to consolidate.

### 2a. `Math.max()` on an empty array poisons every total with `NaN`

`Math.max()` with no arguments returns `-Infinity`. The editor's `calcGstRate` was
`Math.max(...invoice.items.map(i => i.gstRate || 0))`, so an invoice with **zero items**
produced `calcCgst() = 0 * -Infinity / 200 = NaN`, which propagated into
`calcGrandTotal` and every total in the preview. Now guarded:

```js
const rates = (invoice.items || []).map(i => i.gstRate || 0)
return rates.length ? Math.max(...rates) : 0
```

The `SharedInvoiceView` copy already had a `|| [0]` guard, which is why only the editor was
affected. **When spreading an array into `Math.max`/`Math.min`, always guard for empty** — an
empty invoice is a normal state (the "no items" placeholder), not an edge case.

Also hardened the editor's `calcSubtotal` to `(item.quantity || 0) * (item.rate || 0)` so a
row with a missing field yields `0` rather than `NaN`. `SharedInvoiceView` already did this.

Verified across 6 cases (GST on/off, discount, advance, measurement, mixed rates, empty):
`grand = subtotal + cgst + sgst - discount`, `cgst === sgst`, `balance = grand - advance`.

---

## 🟠 3. The PDF download button was silently deleted (fixed 2026-10-04)

Commit `1836b87` ("add Word (.docx) export for invoices") was meant to **add** a Word export.
Instead it **replaced** the PDF button in *both* toolbars:

```diff
-<button onClick={downloadPDF} …><Download …/><span>{generating ? '...' : 'PDF'}</span></button>
-<button onClick={downloadPDF} …><Download className="w-3.5 h-3.5" /> PDF</button>
+<button onClick={downloadDocx} …><FileDown …/><span>Word</span></button>
+<button onClick={downloadDocx} …><FileDown className="w-3.5 h-3.5" /> Word</button>
```

So the app has had **no way to download a PDF of the current invoice** since 3 Oct 2026 — only
"Share", "Img", and "Blank" (which exports an *empty* invoice, not the current one). `downloadPDF`
was left intact but unreferenced, and the `Download` icon import was left unused — the two dead
ends that gave it away.

Both buttons are restored, desktop and mobile. Watch for this class of mistake: **adding a
feature next to an existing button means adding, not swapping.** `git log -S "onClick={downloadPDF}"`
is the fastest way to catch it.

`downloadPDF` was verified correct while restoring it — it is the only PDF path that honours the
desktop save dialog (`desktopExportFile(..., { ask: true })`) for the *current* invoice. Don't
delete it in favour of `captureToPDF` directly; `sharePDF` also exists but is a different
feature (Web Share API / clipboard).

---

## 🟠 4. DOCX export — was broken, then rewritten (2026-10-04)

**Two separate problems, both now fixed. Read this before changing the export.**

### 4a. The export threw on every click (fixed)
It called `Document.create(doc).generateBlob()`, but `docx` has no `Document.create` static
method (confirmed: zero matches in its type definitions). Every click threw
`TypeError: Document.create is not a function`, reported as the generic *"Word export failed"*
toast. Broken since the feature was first added in `1836b87`. Now `Packer.toBlob(doc)`.

Two related fixes shipped with it:
- `Buffer.from(...)` for the logo — `Buffer` is a Node global Vite does **not** polyfill, so any
  user with a logo got a `ReferenceError` swallowed by the surrounding `try/catch`, silently
  dropping the logo. Replaced with `base64ToBytes()` returning a `Uint8Array`.
- `URL.revokeObjectURL(url)` ran synchronously right after `link.click()` and could cancel the
  download. Now deferred 10 s.

### 4b. The DOCX ignored the preview design (fixed)
The DOCX was a hand-rebuild that shared no code with `InvoicePreview.jsx` and had drifted badly.
Missing **entirely**: Bank Details, UPI block, Terms & Conditions, signature block, UPI QR
strip, and the footer bar. Also missing: uppercase business name, the dark table header, the
two separate bordered Bill-To/meta boxes, the thick rules, column widths, the totals panel
layout, and all colour (red discount / green advance / blue area label).

`exportDocx.js` was rewritten as a 1:1 mirror of `InvoicePreview.jsx`. It now imports
`measurementRows` / `measurementItemAmount` / `measurementRowAreaInPricing` / `formatTotalArea`
/ `unitLabel` / `areaUnitLabel` from `lib/measurements.js`, so the DOCX measurement amounts are
correct (previously `rate * quantity`) and the rate suffix respects `item.areaUnit` instead of
hardcoding `/sqft`.

Structure it relies on:
- A **palette map** (`C`) mirroring the Tailwind grays plus `blue700`/`red600`/`green700`.
- A **font-size map** (`F`) converting preview px → docx half-points (`size = px * 1.5`).
- `px()` converts px → DXA twips (`n * 15`) for cell padding.
- **Borderless tables as flexbox containers** — the only way to do side-by-side layout in Word.
  Bill To / meta is a 3-column table `[47% box, 6% spacer, 47% box]` to get a real gap.
- Column widths are derived: `descWidth = 100 - sum(fixed)` so the table always totals 100%.

### 4c. Google Docs renders it badly — widths must be absolute (fixed 2026-10-04)

The first rewrite looked fine in Word but fell apart in **Google Docs**. Root cause was not
styling — it was **width units**. Two bugs, both invisible in Word because Word silently
auto-fits, but Google Docs honours `w:tblGrid` literally:

1. **`layoutTable` passed percentages to `columnWidths`.** Per docx's own types
   (`columnWidths?: readonly number[]`), those are **DXA twips** — so `[47, 6, 47]` meant
   *47 twips*, not 47%. A 47-twip column is ~0.8 mm. Every flexbox-layout table collapsed.
2. **Every width used `WidthType.PERCENTAGE`.** Google Docs' importer approximates percentages
   and redistributes them, so even correct percentages lost their proportions.

Fixes now in place:
- `tw(pct, avail)` converts percent → twips; **all** cell and table widths use `WidthType.DXA`.
  Verified in the output XML: `pctWidths=0`.
- Every table passes real `columnWidths` **and** `layout: TableLayoutType.FIXED`, so the grid is
  authoritative and can't be auto-fitted away. Verified: `fixedLayout` on every table.
- Page geometry is derived, not guessed: `CONTENT_W = convertMillimetersToTwip(210) - 2*560`,
  and `INNER_W = CONTENT_W - FRAME_PAD` accounts for the frame cell's own padding.
- **Nested tables are sized against their parent's *inner* width**, not the page width. They
  previously overflowed their parent cell and the consumer squeezed them back.
- Removed one level of nesting: the Bill-To/meta box was a table inside a table. It's now a
  single flat 4-column table `[47, 3, 23, 27]`, where the 3% gap column is borderless and the
  meta label/value pair shares borders (`right: noBorder` / `left: noBorder`) so it still reads
  as one box.

**Rules for touching this file:** never reintroduce `WidthType.PERCENTAGE`; never pass a
percentage to `columnWidths`; when nesting a table inside a cell, subtract that cell's
horizontal padding (`2 * PAD_BOX`) from the available width.

### 4d. `page.margins` is silently ignored — the tables overflowed the page

Found while adding the `SHIFT_LEFT` nudge. The section config read:

```js
page: {
  size: createPageSize({ ... }),
  margins: { top: 480, right: 640, bottom: 480, left: 480 },   // WRONG KEY
}
```

`docx` **page properties take `margin` (singular)**; `margins` (plural) is the *cell/table*
option. An unknown key is not an error — `docx` dropped it and applied its default **1440twip
(1 inch) on every side**. The generated file proved it:

```
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" .../>
```

Printable width became `11906 - 2880 = 9026` while the tables were built for `10786`, so the
frame **overflowed the printable area by 319 twips (~5.6 mm)** and got clipped or squeezed by
the consumer. This was a second, independent cause of the broken Google Docs rendering.

Corrected to `margin:`, which now emits `left=480 right=640 top=480 bottom=480` and leaves
641 twips of slack on the right. **Symptom to recognise:** a `page: { ... }` block that looks
right but has no effect, and a `pgMar` full of `1440`s you didn't write.

`SHIFT_LEFT` (80 twips ≈ 1.4 mm) is applied by making the margins asymmetric —
`left: MARGIN_X - SHIFT_LEFT, right: MARGIN_X + SHIFT_LEFT`. Content width stays
`PAGE_W - MARGIN_X * 2`, so nudging the bill sideways never disturbs any column width. Tune
that one constant. Prefer this over a negative table `indent`, which Google Docs handles badly.

### 4e. Known remaining differences from the PDF
The PDF is an **html2canvas raster**, so it can be pixel-perfect. A native Word document cannot
be — Word has no CSS. These are permanent unless you switch to the image-based export:
- **Rounded corners** (`rounded`, `rounded-lg`) have no Word equivalent — corners are square.
- `flex` gap/margin collapse and `my-*` spacing don't map; spacing is approximated per element.
- Exact line-wrap and hyphenation positions will differ.
- Fonts: `Calibri` is used (universally available in Word); the preview uses the system UI font.
- Multi-page invoices break the outer page frame, since a bordered table can't span pages cleanly.

**If a pixel-identical Word file is ever required, the fix is a different approach:** reuse the
existing `captureToPDF` html2canvas render and embed the resulting image(s) as full-page
pictures. That is identical by construction but the text stops being selectable/editable.
This is also the only approach that is guaranteed to survive Google Docs import unchanged.

Remaining Google Docs caveat: max table nesting is still 2 (the page-frame table wraps
everything). Google Docs supports depth 2, but 3+ is unreliable. Depth 2 comes from the frame
itself, which exists to mirror `InvoicePreview.jsx:25`'s `border border-gray-300`.

### 4f. Word export on desktop bypassed the Save dialog (fixed 2026-10-04)

`exportInvoiceDocx` always finished with a manual `<a download>` blob URL. On the web that is
correct, but in Electron it dumps the `.docx` **silently into the default download folder**
with no prompt and no "saved to…" feedback — while PDF, PNG and Blank-invoice all went
through `desktopExportFile`. So on the Windows app, Word was the odd one out.

The fix keeps one branch, in file output only, which rule 6 explicitly allows:

```js
if (isDesktop) {
  // base64 the blob -> desktopExportFile(filename, dataUrl, { ask: true })
}
```

`ipc.cjs` `files:save` decodes any base64 data URL with `Buffer.from(..., 'base64')` and does
not care about the extension, so no main-process change was needed. `exportInvoiceDocx` now
returns `{ canceled, error, path }` on **both** paths, and `App.jsx` reports the real outcome:
"Save cancelled." if the dialog is dismissed, the error message if the write fails, otherwise
the saved path plus `desktopReveal` so the file opens in Explorer.

Verified by running both paths in separate processes and comparing the unzipped OOXML: same
22 entries, `word/document.xml` byte-identical (32,112 chars, matching SHA-256). The `.docx`
files themselves differ by ~1 byte because `Packer.toBlob` stamps each zip entry with the
current time — that is expected, not a parity bug.

### Maintenance warning
`exportDocx.js` and `InvoicePreview.jsx` are now two parallel renderers of the same design with
no shared source of truth. **If you change the preview layout, the DOCX will not follow.**

---

## ✅ 5. Manual save reset invoice status to `pending` (fixed 2026-10-04)

`saveInvoiceToDB` hardcoded `payload.status = 'pending'`. Autosave fires 1,200 ms after any
edit, so **any edit to a `paid` invoice flipped it back to `pending`.** Status can then be
re-set from `Dashboard`'s `StatusBadge`, but the round-trip was lossy and surprising. It hit
**both** web and desktop — the payload is built in `App.jsx` before the backend seam.

Root cause: the editor's invoice state had **no `status` field at all**, so there was nothing
to preserve. `loadInvoiceFromRow` mapped 24 invoice columns and never read `data.status`.

Fixed by tracking status in editor state, which works uniformly across both backends and needs
no `isDesktopMode` branch:

| Location | Change |
|---|---|
| `defaultInvoice` | `status: 'pending'` seeds new invoices |
| `loadInvoiceFromRow` | `status: data.status \|\| 'pending'` restores it on open |
| `saveInvoiceToDB` payload | `status: invoice.status \|\| 'pending'` instead of the literal |

The `|| 'pending'` fallback matters: a draft opened via the shared-invoice link has no status,
and a row predating the column arrives as `null`.

Two consequences worth knowing:

- `status` is now part of `mapped`, so `autosaveSigRef.current = JSON.stringify(mapped)` changes
  signature once when an invoice is first opened. Harmless — it just schedules one autosave.
- This is last-write-wins like every other field. If an invoice is open in the editor *while*
  you mark it paid in the Dashboard, the editor's stale `pending` will overwrite on the next
  autosave. Opening the invoice after changing status avoids it. A proper fix would make
  `status` a Dashboard-only field the editor never writes.

---

## 🟠 6. Desktop share links silently do nothing

`electron/db.cjs::runInsert` generates `id` with `crypto.randomUUID()` but leaves
`share_token` as `?? null`. Postgres supplies `uuid_generate_v4()` server-side; SQLite has no
equivalent. So on desktop a new invoice has no token, `setShareToken(null)`, and
`copyShareLink` no-ops. `Dashboard` only renders the share button when `inv.share_token`
exists, so the UI hides it — but there's no explanation for the user.

---

## 🟠 7. `isDesktopMode` branches must stay minimal — and why

The design deliberately surfaces offline-incompatible features as Supabase-shaped errors
(`src/lib/desktop.js`) rather than `if (isDesktopMode)` checks, so components stay
backend-agnostic. The **only** legitimate branches are:
1. `src/lib/desktopFiles.js` — file output.
2. `src/App.jsx` — the "Offline" badge and the Backup button.
3. `src/lib/exportDocx.js` — **file output only** (see §4f).

If you add `isDesktopMode` checks inside `Dashboard.jsx` or `AuthModal.jsx`, you're fighting
the pattern. Add the capability to `src/lib/desktop.js` or return an error.

Note both `src/lib/desktop.js` (`isDesktopMode`) and `src/lib/desktopFiles.js` (`isDesktop`)
read `window.billingDesktop` **once at module-evaluation time**. That is correct in Electron
because the preload script runs before the renderer bundle. It does mean you cannot flip the
flag at runtime to test a path — a second `import('./exportDocx.js?v=2')` will *not* re-read
it, because `./desktopFiles.js` keeps its own cached module instance. Test desktop vs web in
**separate processes** instead.

---

## 🟠 8. Supabase client construction throws eagerly

`src/lib/supabase.js` calls `createWebClient()` **at module scope**. A missing
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` throws during the initial import → **blank white
screen**, not an error message. Desktop is immune (never reads env). Debug a white screen by
checking `.env` first.

---

## 🟠 9. Supabase API subset — desktop breaks silently outside it

`src/lib/desktop.js` implements only:
`.from().select().eq().order().limit().insert().update().upsert().delete().then().single()`
plus `.auth.{getSession,onAuthStateChange,signUp,signInWithPassword,signInWithOAuth,signOut}`
and `.rpc().single()`.

Anything else — `.in()`, `.ilike()`, `.gte()`, `.range()`, embedded resource selects,
count/aggregate queries — **works on the web and fails on desktop with no build-time signal.**

Also `select(cols)` is captured by the builder but **ignored** by `electron/db.cjs`
(always `SELECT *`). Column projection is a lie on desktop.

---

## 🟡 10. No session expiry or stale-session cleanup (desktop)

The `sessions` table rows are only removed on explicit sign-out. Tokens are 32 random bytes
with no TTL and nothing prunes old rows. Restoring an old `billing.db` backup also restores
`sessions`… except `MERGE_TABLES` **excludes** `sessions`, so a restore logs nobody out
(the current in-memory session survives; the row set is unchanged). Worth being aware of if
you touch backup/restore.

---

## 🟡 11. Full database file rewritten on every mutation

`persistNow()` does `db.export()` → `writeFileSync(.tmp)` → `renameSync` **after every
insert/update/upsert/delete, including auth writes**. It's atomic against torn writes, but
O(database size) per save. With the 1,200 ms autosave, a large `billing.db` will churn the
disk continuously while typing. Consider debouncing `persistNow` if this becomes a problem.

---

## 🟡 12. `electron/db.cjs` interpolates table/column names into SQL

```js
`SELECT * FROM "${op.table}" WHERE ${filters.map(f => `"${f.col}" = ?`).join(' AND ')}`
```
Double-quoted, but there is **no allowlist on `op.table`** — only `INVOICE_COLS`/`PROFILE_COLS`
guard *column* names on writes. Safe today because every caller passes literals
(`'invoices'`, `'user_profiles'`) from app source, but a table name derived from user input
would be injectable. Add a `TABLES = ['invoices','user_profiles']` allowlist if you touch
this file.

---

## 🟡 13. `db_version` is hardcoded and unused

`electron/db.cjs::migrate()` ends with
```js
db.exec("INSERT OR REPLACE INTO meta (key,value) VALUES ('db_version','1')")
```
It is **never incremented** and never read. There is no migration versioning, so a future
schema change has no ordered path. Also, `ALTER TABLE … ADD COLUMN IF NOT EXISTS` is **not
portable SQLite** — a new column needs a guarded `PRAGMA table_info` check.

---

## 🟡 14. Invoice numbers can collide

`generateInvoiceNumber()` → `INV-${1000 + rand(9000)}` — random, not sequential, no
collision check, and it does not consult existing invoices. A signed-in user's insert will
not fail (no unique constraint on `invoice_number`) but duplicates are visible.

---

## 🟡 15. Migrations exist twice — keep them in sync

Root `supabase-*.sql` and `db/schema/migrations/NN-*.sql` are **byte-identical duplicates**
(verified by SHA-256). Edit both or they drift. Note `db/` is **untracked** in git and **not**
in `.gitignore`, so it won't survive a clean clone.

---

## 🟡 16. Two different `logo.ico` files

- `public/logo.ico` — 93,780 B. Favicon, copied to `dist/logo.ico` by `build-landing.mjs`.
- `./logo.ico` (repo root) — 140,273 B. Used by `billing-installer.nsi` as `MUI_ICON` /
  `MUI_UNICON` via NSIS relative-path resolution.

Don't unify them casually — the installer's icon is baked into the shipped `.exe`.

---

## 🟡 17. Electron hardening gaps

`electron/main.cjs` sets `contextIsolation: true` and `nodeIntegration: false` (good), but:
- no `sandbox: true`
- no `setWindowOpenHandler` — renderer-opened windows are unrestricted
- no `will-navigate` guard
- no CSP (and `index.html` sets none)
- `webSecurity` left at default

The renderer only loads local content and does use `navigator.share`/`window.open` for blob
URLs, so this is defense-in-depth rather than an active hole. Worth tightening before
shipping widely.

---

## 🟡 18. `landing/` only works at the domain root

All paths are absolute (`/assets/…`, `/logo.png`, `/app/`). Opening
`landing/index.html` from `file://` or serving it from a sub-path breaks every asset and the
"Open the app" CTA.

---

## 🟡 19. Capture workaround you must not "clean up"

`captureToPDF`'s `onclone` sets `wordSpacing: '1px'` and `letterSpacing: '0.3px'` on **every
node**. This is a deliberate text-metric hack that stops justified text from reflowing when
html2canvas rasterizes. Removing it visibly changes the exported PDF. Similarly:

- `scale: 2` + JPEG `0.95` — the quality/size tradeoff for text legibility.
- The offscreen `w-[794px]` `-left-[9999px]` capture divs with `data-capture="true"` and the
  forced `left:0; top:0; opacity:1` in `onclone`. Moving the live preview into the capture
  position would break export fidelity.

---

## 🟡 20. Dead code / unused imports (oxlint does not flag these)

| Item | Location | Status |
|---|---|---|
| `measurementRowAmount` | `src/lib/measurements.js` | unused export |
| `selectCols` (captured, ignored by main) | `src/lib/desktop.js` | dead param |
| `broadcastAuth` export (desktop.js uses `auth.onAuth` from preload instead) | `electron/ipc.cjs` | dead export |
| `src/assets/` - empty directory | `src/assets/` | cruft |
| `public/icons.svg` - Vite-template sprite | `public/icons.svg` | unused |
| root `README.md` is the unmodified Vite template | `README.md` | not documentation — `.ai-context/` is |
| ~~`file-saver` in `package.json`~~ | — | **removed 2026-10-04** (`npm uninstall`). Never reintroduce `saveAs`; the DOCX/other downloads use a manual `<a download>`. |
| ~~`toCamelCaseKeys` (no-op passthrough)~~ | `src/lib/exportDocx.js` | **removed 2026-10-04** in the rewrite |
| ~~`Download` icon import~~ | `src/App.jsx` | **was** a symptom of the missing PDF button — see §3 |
| ~~`downloadPDF` (no button binds it)~~ | `src/App.jsx` | **was** orphaned by commit `1836b87`; button restored — see §3 |

---

## 🟡 21. Broken dev tooling

- `scripts/capture-shot.cjs` requires a `smoke-server.mjs` on port **4137** that **is not in
  the repo**. It also never writes `app-invoice.png` (no code path for it) even though the
  landing page references that image.
- `billing-installer-test.nsi` sources `release\Billing App-win32-x64\*.*`, a folder that does
  not exist. It's also **untracked** in git.
- `db/schema/refresh.ps1` hardcodes the absolute path `E:\Billing App\.env`.

---

## 🟡 22. Local SQLite diverges from Postgres — don't assume parity

| | Postgres | SQLite |
|---|---|---|
| `id`, `share_token` | UUID, DB-generated | TEXT; **must be supplied by the caller** |
| `enable_gst` | BOOLEAN | INTEGER 0/1 |
| `items` | JSONB | TEXT (JSON string) |
| `updated_at` | DB trigger | set explicitly by the main process |
| CHECK / UNIQUE / FK constraints | enforced | **not enforced** |
| `due_date` NULL | proper NULL | `null` → SQL NULL via `normalizePayload` |

A schema change that relies on a constraint will silently pass locally and fail in production.

---

## 🟡 23. StrictMode double-invokes effects in dev

`src/main.jsx` wraps `<App/>` in `<StrictMode>`, so every effect runs twice on mount in dev.
The autosave effects are protected by `autosaveSigRef` (signature dedupe), the debounce timer
in `autosaveTimerRef`, and `editContextMountedRef` (skips the first edit-context run). **If you
add an effect with a side effect, add the equivalent guard** or you'll get double writes in dev
only.

---

## 🟡 24. Restore is a merge, not a rollback

`BackupManager`'s confirm dialog says so explicitly: *"Invoices already present keep the newer
version. Your current data is saved as a backup first."* Internally:
`PRAGMA integrity_check` → auto-backup → merge `users`, `invoices`, `user_profiles`
(`sessions`/`meta` excluded) → `window.location.reload()` after 1,500 ms. The reload **is** the
reset mechanism; don't try to unmount the modal first.

Conflicts resolve by lexicographic `updated_at` string comparison — correct for ISO-8601 UTC,
fragile if the format ever changes.

---

## Quick triage table

| Symptom | Likely cause |
|---|---|
| White screen on load | `.env` missing `VITE_SUPABASE_*` (throw at import) — §8 |
| Desktop app opens the marketing site | `build:vercel` ran before packaging — §1 |
| Form total ≠ preview total | fixed — the footer now gets the calculators — §2 |
| Any total shows `NaN` | empty invoice → `Math.max()` of nothing is `-Infinity` — §2a |
| Dashboard revenue looks low | fixed — now sums stored `grand_total` — §2b |
| DOCX amounts don't match the PDF | measurement rows now use `measurementItemAmount` — §4b |
| Toast says "Word export failed: …" | the toast now includes the real message; check the console for the docx API error — §4a |
| Paid invoice reverted to pending | fixed — status is tracked in editor state — §5 |
| Any invoice total shifted after a refactor | calculators are in `src/lib/calculations.js`; keep the add order — §2b |
| Share button missing on desktop | no `share_token` generated — §6 |
| Feature works on web, fails on desktop | Supabase API outside the supported subset — §9 |
| PDF text spacing looks wrong after an edit | don't remove the `onclone` letter/word-spacing hack — §19 |
| Backup restore "didn't roll back" | it's a merge by `updated_at` — §24 |
| A new SQL column is missing locally | no SQLite versioning; write a guarded `PRAGMA table_info` check — §13 |
