# 05 — Conventions & Patterns

Follow these so new code looks like the existing code. Nothing here is aspirational — it
describes what is actually in the tree.

## Language & modules

- **Plain JavaScript, no TypeScript.** `.jsx` for components, `.js` for libs. No `.ts`/`.tsx`
  files exist (only `@types/*` devDeps for editor help).
- `"type": "module"` → `.js`/`.mjs` are ESM. Electron files are deliberately **`.cjs`**
  (CommonJS) because `electron/main.cjs` is the `main` entry.
- Imports are **named** except `lib/supabase.js`, `lib/desktop.js` (`isDesktopMode` is also a
  default), and `lib/exportDocx.js` (`exportInvoiceDocx` is also a default).
- Relative imports only — **no path aliases** configured in `vite.config.js`.

## Formatting

- 2-space indent, semicolons, single quotes, trailing commas in multiline literals.
- JSX attributes use double quotes in JSX position (`className="…"`), single quotes in JS
  position.
- `camelCase` for variables/functions/objects; `PascalCase` for components; `SCREAMING_SNAKE`
  for module constants (`TOKEN_KEY`, `BACKUP_KEEP`, `INVOICE_COLS`, `SQ_INCHES_PER_SQ_FOOT`,
  `GITHUB`, `PORTFOLIO`).
- **No comments in source.** The codebase is essentially comment-free; this documentation
  folder replaces that need. Match it — don't add explanatory comments to `.jsx`/`.js`.
- Line endings are CRLF on this Windows checkout.

## Styling

- Tailwind utility classes **inline in JSX**. There are no CSS files per component, no CSS
  modules, no styled-components.
- `tailwind.config.js` has an **empty theme** — only stock Tailwind colors/classes work.
  Don't reference `text-brand-500` or similar; add real config or use `violet-*`/`indigo-*`.
- Custom CSS exists only in `src/index.css`: `.animate-slide-in`, `.scrollbar-none`,
  `.safe-area-bottom`, plus number-input spinner suppression. Add new globals there, not inline
  `<style>` tags.
- Responsive strategy: Tailwind breakpoints with `md:` as the single divide.
  - Desktop: form and preview side-by-side, preview `md:sticky md:top-20`.
  - Mobile: `activeTab` toggle + a fixed bottom nav; **two duplicated action bars**
    (`hidden md:flex` and `md:hidden`). If you add an action, add it to both.
- Icons: `lucide-react`, imported individually at the top of the component file. The Google
  logo is a hand-written inline SVG (no brand-icon package).

## Component conventions

- **Function components only**, arrow or `function` both appear. `export default function X()`
  for top-level; inner helpers are plain functions declared above the component.
- **Fully controlled** where practical. `InvoiceForm.jsx` holds no state except a single
  `useRef` for the hidden file input — every value change calls a prop callback
  (`updateField`, `updateItem`, …).
- Small presentational helpers are declared **inside the same file**, not exported:
  `Section`, `Field`, `Input` in `InvoiceForm.jsx`; `StatusBadge` in `Dashboard.jsx`.
- Guard clauses: `if (!open) return null` at the top of modal components
  (`AuthModal`, `BackupManager`).
- Every field in `InvoicePreview` has a **placeholder** (`'Your Business Name'`, `'N/A'`,
  `'-'`, `'Customer Name'`) so a sparse draft still renders a valid-looking invoice. Preserve
  this when adding fields.
- `lucide-react` icons are passed as a component: `<Section icon={Building2} …>` then
  `<Icon size={16} />` inside.
- Icons on clickable rows: wrap the action buttons in a container with
  `onClick={(e) => e.stopPropagation()}` so the row-level `onEditInvoice` doesn't also fire.

## Money & numbers — the established idiom

```js
Number(value) || 0                    // coerce, treat '' / NaN as 0
Number(inv.advance) || 0
amount.toFixed(2)
`₹${Number(v || 0).toFixed(2)}`      // INR(v) in exportDocx.js
```

There is **no money library, no cents-integer arithmetic, no rounding helper**. Follow the
existing inline idiom rather than introducing one, unless you're deliberately refactoring.

⚠ `₹` is written as the literal character in `InvoicePreview.jsx` and `exportDocx.js`
(`INR`), but as the escape `\u20b9` in `Dashboard.jsx`. Keep the local style of the file
you're editing.

## Browser-only runtime — no Node globals

Everything under `src/` runs in a **browser context**, including inside Electron's renderer
(`contextIsolation: true`, `nodeIntegration: false`). Vite polyfills nothing.

**`Buffer`, `process`, and every Node built-in are undefined.** Use web equivalents:

| Need | ❌ Don't | ✅ Do |
|---|---|---|
| base64 → bytes | `Buffer.from(b64, 'base64')` | `Uint8Array` + `atob` (see `base64ToBytes` in `lib/exportDocx.js`), or `fetch(...).then(r => r.arrayBuffer())` |
| base64 → data URL | `fs.readFileSync` | `FileReader.readAsDataURL` (as `lib/logo.js` does) |

This is easy to miss because a `ReferenceError` inside a `try/catch` fails *silently* — that's
exactly how uploaded logos vanished from Word exports. When you add a `try/catch` around an
optional enhancement, log the swallowed error rather than discarding it.

Also note: **library APIs must be checked, not assumed.** `docx` v9 packs via
`Packer.toBlob(doc)` / `Packer.toBuffer(doc)`; `Document` has no `create` method. Verify a
third-party API against its `.d.ts` in `node_modules/` before writing the call.

## Two renderers, one design — the DOCX mirrors the preview

`src/lib/exportDocx.js` is a **hand-built twin** of `src/components/InvoicePreview.jsx`. They
share no code. When you change the preview's layout, **the Word export will not follow** —
you must change both. This is deliberate (a real editable Word document was chosen over an
image-based one) but it is a real maintenance cost.

Mapping used by the DOCX builder:

| Preview (Tailwind) | `docx` equivalent |
|---|---|
| `text-[Npx]` | `size: N * 1.5` (docx `size` is half-points) |
| `p-1.5` / `p-2` / `p-4` | cell `margins` via `px(n)` (twips = `n * 15`) |
| `text-gray-900` etc. | palette map `C.gray900` etc. |
| `bg-gray-900 text-white` | cell `shading: { fill }` + white run colour |
| `border-t-2` | `p({ border: { bottom: thin(color, 12) } })` |
| `flex justify-between` | 2-column **borderless** table |
| `flex gap-3` | 3-column table with a borderless spacer column |
| `grid-cols-2` | 2-column borderless table |
| `uppercase` | run `allCaps: true` (preserves the original string) |
| `tracking-wide` | run `characterSpacing` |
| `rowSpan` | cell `rowSpan` |
| `w-[5%]` on `<th>` | percentage `TableCell` widths; the Description column absorbs the remainder so columns total 100% |

Borderless tables are the only way to do flex/grid layout in Word. Use `layoutTable()`.

### Widths must be absolute twips, never percentages

`layoutTable(rows, widths, opts)` and `cell({ width })` take **percentages** as a convenience,
but `tw()` converts them to DXA twips before they reach `docx`, and every table sets
`layout: TableLayoutType.FIXED` plus real `columnWidths`.

This is not optional. Two traps, both of which look fine in Word and break in Google Docs:

- **`columnWidths` is DXA, not percent.** `[47, 6, 47]` = 47 twips ≈ 0.8 mm. Passing percentages
  there silently collapses every column.
- **`WidthType.PERCENTAGE` is not portable.** Google Docs' importer approximates percentages and
  redistributes them, destroying column proportions.

Available widths are derived from the page, never hardcoded:

```
PAGE_W    = convertMillimetersToTwip(210)          // 11906
MARGIN_X  = 560
CONTENT_W = PAGE_W - MARGIN_X * 2                  // 10786
INNER_W   = CONTENT_W - FRAME_PAD                  // inside the page-frame cell
```

**`page: { margin }` is singular.** `docx` takes `margin` on page properties and `margins` on
cells/tables. Writing `margins:` inside `page:` is *silently dropped* — no error, no warning —
and you get docx's default 1440 twip (1 inch) margins, which makes your tables overflow the
printable area. Check the emitted `<w:pgMar>` before trusting page setup. See 07 §4d.

To nudge the whole bill sideways without disturbing any column width, make the margins
asymmetric rather than using a table indent:

```
margin: { top: 480, bottom: 480, left: MARGIN_X - SHIFT_LEFT, right: MARGIN_X + SHIFT_LEFT }
```

`SHIFT_LEFT` is the single knob (`src/lib/exportDocx.js`). Because `CONTENT_W` is still
`PAGE_W - MARGIN_X * 2`, shifting moves the block without resizing it. Negative table indents
are less portable, especially to Google Docs.

A table nested in a cell must be sized against that cell's **inner** width — subtract the
cell's horizontal padding (`2 * PAD_BOX`). Otherwise it overflows and the consumer squeezes it.
Pass it explicitly: `layoutTable(rows, widths, { avail })` / `cell({ width, avail })`.

Keep nesting at **depth ≤ 2**. A table inside a cell inside a table (depth 3) is unreliable in
Google Docs; flatten it into a single multi-column row instead, using a borderless spacer column
for the gap and split borders (`{ ...boxBorders, right: noBorder }`) to make adjacent cells read
as one box.

## Calculation injection — the most important pattern

**`src/lib/calculations.js` owns the math** (zero React, depends only on `measurements.js`).
`App.jsx` wraps it in zero-arg closures and passes those as **callbacks**:

```jsx
<InvoicePreview
  invoice={invoice}
  calcSubtotal={calcSubtotal}
  calcGrandTotal={calcGrandTotal}
  calcCgst={calcCgst}
  calcSgst={calcSgst}
  numberToWords={numberToWords}
  logo={logo}
  logoSettings={logoSettings}
/>
```
```js
exportInvoiceDocx(invoice, calcSubtotal, calcGrandTotal, calcCgst, calcSgst,
                   numberToWords, logo, logoSettings)
```

The wrappers in `App.jsx` exist only to bind the current invoice to the pure functions:

```js
import * as totals from './lib/calculations'

function calcGrandTotal() {
  return totals.calcGrandTotal({
    items: invoice.items,
    billType: invoice.billType,
    enableGst: invoice.enableGst,
    discount: invoice.discount,
  })
}
```

`SharedInvoiceView` does the same against a snake_case row (`invoice.items`,
`invoice.bill_type`, `invoice.enable_gst`). `Dashboard.jsx` skips the wrappers entirely and
imports `rowGrandTotal(row)` for raw DB rows.

Rules:
- **Never recompute totals inside a render component.** If a component needs a number, add a
  prop.
- **Change the tax/area formula in `calculations.js` only.** The signatures above are load-bearing.
- Keep the add order `subtotal + cgst + sgst - discount`. Rewriting it as `cgst * 2` shifts
  some half-paisa boundaries by 0.01 through float rounding — verified bit-exact before, don't
  assume it stays that way (07 §2b).
- `InvoicePreview` tolerates missing `cgst`/`sgst` (`= 0` defaults) but should always receive
  all five.
- ⚠ `numberToWords` is still **duplicated verbatim** in `App.jsx` (editor + `SharedInvoiceView`)
  and is the last piece of duplicated money-adjacent logic to consolidate.

## Area / measurement rules

- **Always** read sizes via `measurementRows(item)` from `src/lib/measurements.js`, never
  `item.measurements` directly. It carries the legacy flat-shape fallback.
- **All math is in square inches** internally; `areaUnit` only changes the divisor (÷144 for
  sqft) and the label.
- Print rates as `₹{rate}/{areaUnitLabel(areaUnit)}` and item amounts via
  `measurementItemAmount(item)`.

## Data access rules

- Import `supabase` from `src/lib/supabase.js` — never from `@supabase/supabase-js`
  directly, and never `import.meta.env` outside that file.
- **Only the documented subset of the Supabase API works on desktop** (02 §2). Using
  `.in()`, `.ilike()`, `.range()`, embedded selects, or aggregate functions will work on the
  web and break the desktop app.
- Table names are literals: `'invoices'`, `'user_profiles'`. `electron/db.cjs` interpolates
  them into SQL with double quotes and **has no allowlist**.
- New columns must be added in **four** places: the client field, `saveInvoiceToDB` payload,
  `loadInvoiceFromRow`, `INVOICE_COLS` in `electron/db.cjs`, **plus** a Postgres migration
  (root + `db/schema/migrations/`). Also extend `mapRow` if the type isn't text.
- Every `localStorage` read/write is wrapped in `try/catch`. Keep it that way.
- Optimistic UI updates in `Dashboard.jsx` follow `setX(prev => …)` then a toast; there is no
  rollback on failure.

## Electron / IPC rules

- Add a channel in **three** places: `electron/ipc.cjs` (`ipcMain.handle`), the matching
  method in `electron/preload.cjs`, and the caller in `src/lib/desktop*.js`.
- Return `{ error: { message } | null, data }` from every `ipcMain.handle`. **Never throw
  across IPC.**
- Main-process files are CommonJS `.cjs`. Use `crypto` (Node's), `fs`, `path`, `os`.
- After any DB mutation call `persistNow()` — the DB lives only in memory between writes.
- If you add a table, add it to `MERGE_TABLES` in `restoreBackup` if it should merge
  (`sessions`/`meta` intentionally don't).

## Error & feedback UX

- One `toast` string state in `App.jsx`, cleared by a per-call `setTimeout` (3–4 s). Pass
  through the `onToast` prop in child components.
- Errors from Supabase-shaped rejections are shown via `error.message` strings, often with a
  "friendly fallback" when the error is missing.
- Autosave feedback is `autosaveState` → header text `Saving… / Saved / Save failed`.
- Desktop capability gaps return errors instead of branching. If you add an online-only
  feature, return an error from `src/lib/desktop.js` rather than adding `if (isDesktopMode)`
  checks in components.

## How to add things (recipes)

### A new invoice field
1. Add to `defaultInvoice` in `src/App.jsx`.
2. Add the `<Field>`/`<Input>` to `src/components/InvoiceForm.jsx` (attach via `updateField`).
3. Render it in `src/components/InvoicePreview.jsx` **with a placeholder**.
4. Map it in `saveInvoiceToDB` (camel → snake) and `loadInvoiceFromRow` (snake → camel).
5. Add the column to `INVOICE_COLS` in `electron/db.cjs` (+ `migrate()` if it needs DDL) and
   to `PROFILE_COLS` if it's a business default.
6. Write a migration — **both** `supabase-*.sql` at the root and `db/schema/migrations/NN-*.sql`.
7. If it's a business default, add it to the 10-field effect that writes
   `billing_business_defaults` and to `businessDefaultsFromProfile`.

### A new item field
Repeat `defaultInvoice`'s item factory in **4 places**: `defaultInvoice`, `addItem`,
`loadInvoiceFromRow`, and the measurement add-size handler.

### A new export format
Add a handler in `App.jsx` that (1) calls `await saveInvoiceToDB()` and aborts on error,
(2) uses the offscreen capture div, (3) branches on `isDesktopMode` for file output via
`desktopExportFile` / `desktopReveal`, and (4) adds a button to **both** action bars.

### A new desktop-only capability
1. `electron/db.cjs` — implement + export.
2. `electron/ipc.cjs` — `ipcMain.handle('billing:…')`, return `{ error, data }`.
3. `electron/preload.cjs` — expose under `window.billingDesktop`.
4. `src/lib/desktop.js` (or `desktopFiles.js`) — wrap it; for online-incompatible features
   return a Supabase-shaped error instead.
5. UI: `isDesktopMode` guard in `src/App.jsx` for chrome only (like the Backup button).

### A new landing page section
`landing/index.html` + classes in `landing/assets/css/style.css`. Add `.reveal`-eligible
classes (`.card`, `.steps li`, `.split`, `.faq-cta`) for the scroll animation. `landing/` is
excluded from oxlint and has no build step. If you add a page, also update `robots.txt` and
`sitemap.xml`.

## Things you will want to clean up (don't be surprised)

| Item | Where |
|---|---|
| Calculation logic triplicated | **resolved 2026-10-04** — now only in `src/lib/calculations.js`; `numberToWords` still duplicated |
| `src/assets/` empty | `src/assets/` |
| `file-saver` still in `package.json` but unreferenced | `package.json` |
| `Download` icon imported, unused | `src/App.jsx` |
| `downloadPDF` defined, no button binds it | `src/App.jsx` |
| `toCamelCaseKeys` is a no-op passthrough | `src/lib/exportDocx.js` |
| `measurementRowAmount` exported, unused | `src/lib/measurements.js` |
| `selectCols` captured, ignored by main | `src/lib/desktop.js` |
| `broadcastAuth` exported, desktop.js uses `auth.onAuth` instead | `electron/ipc.cjs` |
| `useEffect` missing dep `loadInvoices` (lint warning) | `src/components/Dashboard.jsx:59` |
| `public/icons.svg` is Vite-template leftover | `public/icons.svg` |
| `db_version` hardcoded `'1'`, never incremented | `electron/db.cjs` |
| root `README.md` is the Vite template | `README.md` |

Full detail and severity in [`07-gotchas-and-known-issues.md`](./07-gotchas-and-known-issues.md).