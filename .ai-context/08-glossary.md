# 08 — Glossary

Domain and project terms, so a model or new contributor can read the code without Indian
business context.

## Indian tax & invoicing

| Term | Meaning | In this codebase |
|---|---|---|
| **GST** | Goods and Services Tax — India's consumption tax | Invoice-level boolean `enableGst`. When on: reveals `gstin`, per-item HSN/SAC + `gstRate`, and adds CGST+SGST lines. |
| **GSTIN** | 15-character GST Identification Number | `invoice.gstin`, TEXT, shown only when `enableGst`. |
| **CGST** | Central GST — the central-government half | `subtotal * gstRate / 200` (i.e. `gstRate/2`%). |
| **SGST** | State GST — the state-government half | `subtotal * gstRate / 200`. Same half as CGST. |
| **IGST** | Integrated GST — for inter-state supply | **Not implemented.** Only intra-state CGST+SGST is supported. |
| **HSN / SAC** | Harmonised System of Nomenclature (goods) / Services Accounting Code (services) — the tax classification code | `item.hsn`, free text. Renders as an `HSN` table column only when `enableGst`. Not validated. |
| **Taxable value** | The base the tax is computed on | `taxable = subtotal`. **Not** reduced by the discount, even though Grand Total is. |
| **Invoice number** | The human-facing sequential reference | `INV-####`, randomly generated, **not** collision-checked, no DB uniqueness constraint. |
| **Bill To** | The customer block on the invoice | `customerName`/`Address`/`City`/`State`/`Pincode`. |
| **Amount in words** | The spelled-out total, legally expected on Indian invoices | `numberToWords(num)` — Indian grouping (Thousand / Lakh / Crore), output `"X Rupees and Y Paise Only"`. |
| **Paise** | Sub-rupee unit, 1/100 | Second half of the amount-in-words string. |

## Measurement / area billing

| Term | Meaning |
|---|---|
| **Measurement bill** | `billType: 'measurement'` — billing by physical size/area rather than by piece count. Common for carpenters, fabricators, glass and marble work, signage, upholstery. |
| **Size row** | One entry in `item.measurements[]`: a width × height pair with its own unit and quantity. An item can have many. |
| **`areaUnit`** | The unit the **rate** is quoted in: `sqft` or `sqin`. Per-item, not per-size-row. |
| **`unit`** (`in`/`ft`) | The unit of an individual **size row's** width and height. |
| **Total area** | `Σ (rowArea × row.quantity)` across all size rows, expressed in `areaUnit`. |
| **Item amount** | `totalArea × rate`. This is the measurement analogue of `quantity × rate`. |
| **Internal unit** | All math is in **square inches**. `areaUnit` only changes the divisor (÷144 for sqft) and the printed label. |
| **Legacy shape** | Pre-`measurements[]` invoices stored flat `width`/`height`/`unit` on the item. `measurementRows()` migrates them on read. |
| **`₹550/sq ft`** | Rate printed as `₹{rate}/{areaUnitLabel(areaUnit)}`. |

Example: `4 ft × 6 ft`, areaUnit `sqft`, rate ₹550 →
`toInches` → 48 in × 72 in = 3456 sq in → ÷144 = **24 sq ft** → 24 × 550 = **₹13,200**.

## Payments

| Term | Meaning |
|---|---|
| **UPI** | Unified Payments Interface — India's instant bank-to-bank payment system. |
| **UPI ID** | The payments handle, e.g. `name@bank` (`invoice.upiId`). |
| **UPI deep link** | `upi://pay?pa=<id>&pn=<name>&am=<amount>&tn=<note>&cu=INR` — opens the UPI app pre-filled. |
| **QR** | Generated with `qrcode.toDataURL` from the deep link. 160px in the preview, 250px in the share view. |
| **Advance** | `invoice.advance` — amount already paid. A **payment**, not a discount. Shown as "Advance Paid". |
| **Balance Due** | `max(0, grandTotal - advance)`. Only rendered when `advance > 0`. |
| **Discount** | `invoice.discount` — reduces the Grand Total, applied **after** tax. |
| **IFSC** | Indian Financial System Code — the bank branch identifier (`invoice.bankIfsc`). |
| **Status** | `pending` \| `paid` \| `cancelled`. Enforced by a Postgres CHECK constraint. |

## Architecture terms

| Term | Meaning |
|---|---|
| **Dual backend / the seam** | `src/lib/supabase.js` exports either a real Supabase client or a local Electron-backed adapter. Everything above it is backend-agnostic. |
| **`isDesktopMode`** | `!!window.billingDesktop`. True in Electron, false in a browser. |
| **`window.billingDesktop`** | The single `contextBridge` object exposed by `electron/preload.cjs`. |
| **IPC** | Inter-Process Communication. `ipcMain.handle` / `ipcRenderer.invoke`, all `billing:*` or `files:*` channels. |
| **`billingDesktop` query builder** | `src/lib/desktop.js::makeBuilder(table)` — a thenable chainable object mimicking Supabase's `from().select().eq()…` that serializes to one plain object. |
| **sql.js** | SQLite compiled to WebAssembly. The entire local database is held **in memory** and written to disk on every mutation. |
| **`persistNow()`** | `db.export()` → write `.tmp` → `rename` to `billing.db`. Atomic, O(db size), runs after every write. |
| **`asarUnpack`** | electron-builder setting that keeps `node_modules/sql.js/dist/**` outside the asar archive so the `.wasm` is readable at runtime. |
| **A4 px width (794px)** | The fixed width of the offscreen capture divs — A4 at 96dpi. `html2canvas` renders them at `scale: 2`. |
| **Offscreen capture** | Duplicate `InvoicePreview`/`BlankInvoicePreview` rendered in `fixed w-[794px]` divs at `-left-[9999px]`, marked `data-capture="true"`. Targets for PDF/PNG export. |
| **Guest mode** | Using the app with no account. Data persists only in `localStorage`. Enabled via `isEditor = view === 'editor' \|\| !session`. |
| **`requireAuth(callback)`** | The gate in `App.jsx`. Runs immediately if signed in, otherwise stashes the callback in `pendingActionRef`, opens `AuthModal`, and replays it once `session` arrives. |
| **Save-before-export** | Every export handler calls `saveInvoiceToDB()` first and aborts on error, guaranteeing a fresh `share_token` and `grand_total`. |
| **Autosave (draft)** | 400 ms debounce → `localStorage['billing_draft']`. No session needed. |
| **Autosave (db)** | 1,200 ms debounce → `invoices` row. Session required. Deduped by a `JSON.stringify` signature in `autosaveSigRef`. |
| **has-content predicate** | The guard both autosaves use so blank invoices are never written. |
| **RLS** | Row Level Security — Postgres policies scoped by `auth.uid() = user_id`. The real security boundary; the anon key is public by design. |
| **`SECURITY DEFINER` RPC** | `get_shared_invoice(token UUID)` — how public share links work **without** a permissive RLS policy. Don't replace it with an `OR`-based policy. |
| **PostgREST** | The HTTP API layer in front of Supabase's Postgres. Version 14.5. Snapshotted in `db/schema/postgrest-openapi.json`. |
| **Merge-restore** | Backup restore merges rows, keeping the newer `updated_at`. **Not** a rollback. |
| **Share link** | `${origin}${isDesktopMode ? '' : '/app'}?share=<uuid>` → `SharedInvoiceView`. Web only. |
| **`billing_auth_dash`** | Transient `localStorage` breadcrumb so an OAuth return lands on the dashboard instead of restoring a draft. |

## Build & ops terms

| Term | Meaning |
|---|---|
| **`build:vercel`** | Builds the SPA to `dist/app/` and the landing site to `dist/`. ⚠ Destroys `dist/index.html` as the desktop entry. |
| **electron-packager** | Produces the **portable** unpacked folder + zip (`desktop:exe`). |
| **electron-builder** | Produces the **NSIS installer** via the `build` block in `package.json` (`desktop:dist`). |
| **NSIS** | Nullsoft Scriptable Install System — the Windows installer toolkit. Two hand-written `.nsi` scripts wrap the packager output. |
| **SmartScreen** | The Windows "unrecognized app" warning. The landing page tells users to click "More info → Run anyway". |
| **`base: './'`** | Vite relative asset base, required so `dist/index.html` works over `file://` in Electron. The Vercel build overrides it to `/app/`. |
| **oxlint** | The linter (Rust-based, ESLint-compatible config). Replaces ESLint. Ignores `landing/`, `scripts/`, `dist/`, `release/`. |
| **Spice / `allowConstantExport`** | oxlint rule option permitting a module to export both components and plain constants. |

## Project-specific names

| Name | What it is |
|---|---|
| **ShareMyBill** | The product. Package name `sharemybill`, `appId com.sharemybill.app`, productName `ShareMyBill`. |
| **Sai Bende** | The author/branding, <https://github.com/saibende> · <https://saibende.vercel.app>. Constants live in `BrandFooter.jsx`. |
| **`sharemybill.vercel.app`** | Production. `/` = landing, `/app` = the SPA. |
| **`tytmqdruzdzejwatqgya`** | The Supabase project ref. |
| **`BillingApp`** | The folder name under `Documents/`, and the prefix of backup filenames. |
| **`BlankInvoicePreview`** | The hand-fill printable template — 5 dotted writing guides, no HSN/Size/GST. Export-only, never displayed. |