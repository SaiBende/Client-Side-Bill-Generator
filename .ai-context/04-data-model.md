# 04 — Data Model

## 1. The invoice object

Client-side shape is **camelCase**; the DB is **snake_case**. Three mappers do the translation:

| Direction | Function | Location |
|---|---|---|
| client → row | `saveInvoiceToDB` payload build | `src/App.jsx` |
| row → client | `loadInvoiceFromRow` | `src/App.jsx` |
| profile row → client | `businessDefaultsFromProfile(data)` | `src/App.jsx` |

### Canonical shape (`defaultInvoice` in `src/App.jsx`)

```js
{
  // business
  businessName: '', businessAddress: '', businessPhone: '', businessEmail: '',
  // customer
  customerName: '', customerAddress: '', customerCity: '', customerState: '', customerPincode: '',
  // invoice meta
  invoiceNumber: '',          // auto-filled 'INV-####'
  invoiceDate: '',            // ISO 'YYYY-MM-DD'
  dueDate: '',                // optional
  billType: 'normal',         // 'normal' | 'measurement'
  // money
  discount: 0,
  advance: 0,                 // amount already paid
  enableGst: false,
  gstin: '',
  // lines
  items: [ /* see §2 */ ],
  // payment
  bankName: '', bankAccount: '', bankIfsc: '', bankBranch: '',
  upiId: '', upiName: '',
  // footer
  terms: '', signature: '',
  status: 'pending'            // round-tripped only; edited from the Dashboard
}
```

### Column mapping

| Client (camelCase) | Column (snake_case) | Postgres type | Local SQLite | Notes |
|---|---|---|---|---|
| `businessName` | `business_name` | TEXT | TEXT | |
| `businessAddress` | `business_address` | TEXT | TEXT | multiline; rendered `whitespace-pre` |
| `businessPhone` | `business_phone` | TEXT | TEXT | |
| `businessEmail` | `business_email` | TEXT | TEXT | |
| `customerName` | `customer_name` | TEXT | TEXT | |
| `customerAddress` | `customer_address` | TEXT | TEXT | |
| `customerCity` | `customer_city` | TEXT | TEXT | |
| `customerState` | `customer_state` | TEXT | TEXT | |
| `customerPincode` | `customer_pincode` | TEXT | TEXT | |
| `invoiceNumber` | `invoice_number` | TEXT NOT NULL | TEXT | |
| `invoiceDate` | `invoice_date` | DATE NOT NULL | TEXT | ISO `YYYY-MM-DD` |
| `dueDate` | `due_date` | DATE (null) | TEXT | saved as `|| null` |
| `discount` | `discount` | NUMERIC(10,2) | REAL | `NUMERIC_COLS` |
| `advance` | `advance` | NUMERIC(10,2) | REAL | `NUMERIC_COLS`; added by migration 02 |
| `enableGst` | `enable_gst` | BOOLEAN | INTEGER 0/1 | `BOOL_COLS`; `mapRow` back to boolean |
| `gstin` | `gstin` | TEXT | TEXT | shown only when `enableGst` |
| `billType` | `bill_type` | TEXT CHECK `IN ('normal','measurement')` | TEXT DEFAULT `'normal'` | added by migration 03 |
| `items` | `items` | **JSONB** | TEXT (JSON string) | `JSON_COLS`; `mapRow` `JSON.parse`, fallback `[]` |
| — | `grand_total` | NUMERIC(10,2) | REAL | server-side mirror; `NUMERIC_COLS` |
| `bankName` | `bank_name` | TEXT | TEXT | |
| `bankAccount` | `bank_account` | TEXT | TEXT | |
| `bankIfsc` | `bank_ifsc` | TEXT | TEXT | |
| `bankBranch` | `bank_branch` | TEXT | TEXT | |
| `upiId` | `upi_id` | TEXT | TEXT | |
| `upiName` | `upi_name` | TEXT | TEXT | |
| `terms` | `terms` | TEXT | TEXT | |
| `signature` | `signature` | TEXT | TEXT | **a name, not an image** |
| `status` | `status` | TEXT CHECK `('pending','paid','cancelled')` | TEXT DEFAULT `'pending'` | edited from Dashboard only; the editor now loads and re-saves it verbatim so autosave can't clobber `paid` — see 07 §5 |
| — | `share_token` | UUID UNIQUE DEFAULT `uuid_generate_v4()` | TEXT, **no default** | desktop won't auto-generate |
| — | `id` | UUID DEFAULT `uuid_generate_v4()` PK | TEXT PK, main process sets `crypto.randomUUID()` | |
| — | `user_id` | UUID → `auth.users(id)` ON DELETE CASCADE | TEXT NOT NULL | |
| — | `created_at` | TIMESTAMPTZ DEFAULT NOW() | TEXT, main process fills | used for dashboard ordering |
| — | `updated_at` | TIMESTAMPTZ DEFAULT NOW() + trigger | TEXT, main process sets | used for merge-restore conflict resolution |

### `user_profiles` (the "remember my business" row)

`user_id` PK (+ `updated_at`), then 12 TEXT columns `DEFAULT ''`:
`business_name`, `business_address`, `business_phone`, `business_email`, `bank_name`,
`bank_account`, `bank_ifsc`, `bank_branch`, `upi_id`, `upi_name`, `gstin`
(that's 11 business fields + `user_id`; `schema.sql` lists 13 properties total including
timestamps).

Upserted with `{ onConflict: 'user_id' }` after **every** successful invoice save.

## 2. Item shapes

### Default item factory
Repeated in **4 places** (`defaultInvoice`, `addItem`, `loadInvoiceFromRow`, and the
measurement add-size path). If you change it, change all four:

```js
{
  description: '', quantity: 1, rate: 0,
  hsn: '', gstRate: 0,
  areaUnit: 'sqft',                                    // measurement only
  measurements: [{ width: '', height: '', unit: 'in', quantity: 1 }]  // measurement only
}
```

### Normal item
```js
{ description, quantity, rate, hsn, gstRate }
```
Amount = `quantity * rate`.

### Measurement item
```js
{ description, quantity, rate, hsn, gstRate,
  areaUnit: 'sqft' | 'sqin',        // the unit the RATE is quoted in
  measurements: [{ width, height, unit: 'in' | 'ft', quantity }] }
```
Amount = `totalArea * rate`, where `totalArea` is measured in `areaUnit`.

### Legacy item shape (read-only support)
Before the `measurements[]` array existed, measurement items carried flat fields:
```js
{ ..., width, height, unit }
```
`measurementRows(item)` in `src/lib/measurements.js` synthesizes
`[{ width, height, unit, quantity }]` from those. **Always call `measurementRows(item)` — never
read `item.measurements` directly** — or old invoices silently lose their sizes.

## 3. Measurement / area math (`src/lib/measurements.js`)

```js
SQ_INCHES_PER_SQ_FOOT = 144

toInches(value, unit)                     // 'ft' → v*12, else v ;  Number(value) || 0
measurementRowAreaInPricing(m, areaUnit)  // (w_in * h_in) / (areaUnit === 'sqft' ? 144 : 1)
measurementTotalArea(item)               // Σ (rowArea × row.quantity)
measurementItemAmount(item)              // measurementTotalArea(item) * item.rate
measurementRowAmount(item, m)            // rowArea × row.quantity × rate   [EXPORTED BUT UNUSED]
formatTotalArea(item, digits = 2)        // "123.45 sq ft"
unitLabel(unit)                          // 'ft' | 'in'
areaUnitLabel(unit)                      // 'sq ft' | 'sq in'
```

**All internal area math is in square inches.** `areaUnit` only changes the divisor and the
printed label. So `4 ft × 6 ft` → 48 in × 72 in = 3456 sq in ÷ 144 = **24 sq ft**; at
₹550/sqft → **₹13,200**.

Consumers: `App.jsx` (only `measurementItemAmount`), `InvoiceForm.jsx` (5 imports),
`InvoicePreview.jsx` (6 imports).

## 4. Tax / GST math

One toggle for the whole invoice (`enableGst`), a rate per item (`gstRate` ∈
`{0, 5, 12, 18, 28}`), and the GSTIN at invoice level.

```js
gstRate    = Math.max(...items.map(i => i.gstRate || 0))   // ONE rate for the whole invoice
taxable    = subtotal                                        // NOT discount-adjusted
cgst       = subtotal * gstRate / 200
sgst       = subtotal * gstRate / 200                        // i.e. gstRate/2 each
grandTotal = subtotal + cgst + sgst - discount               // discount applied AFTER tax
balanceDue = Math.max(0, grandTotal - advance)               // advance is a PAYMENT
subtotal   = Σ (billType === 'measurement' ? measurementItemAmount(item)
                                                 : item.quantity * item.rate)
```

Consequences to keep in mind:
- A 5% item next to an 18% item taxes the **entire** subtotal at 18%. This is intentional
  given the UI ("GST Rate" reads as an invoice-level rate) but is not per-line accounting.
- `taxable === subtotal`, so the Taxable line is not reduced by the discount even though
  Grand Total is.
- `advance` never affects `grandTotal`. It only produces the extra **Balance Due** line, shown
  only when `advance > 0`.
- Number-to-words uses **Indian grouping**: `Thousand / Lakh / Crore`, then
  `"X Rupees and Y Paise Only"`. `0` → `'Zero'`. Implemented recursively; duplicated in
  `App` and `SharedInvoiceView`.

Display order in the totals panel:
```
Subtotal
  Taxable
  CGST @ (gstRate/2)%
  SGST @ (gstRate/2)%
Discount            (red, only if > 0)
Advance Paid        (green, only if > 0)
Grand Total
Balance Due         (only if advance > 0)
```

## 5. UPI deep link

Shared template (appears in `App.jsx`, `InvoicePreview.jsx`, `SharedInvoiceView`):

```
upi://pay?pa=<upiId>&pn=<upiName || businessName || 'Business'>&am=<amount>&tn=<invoiceNumber || 'Invoice'>&cu=INR
```

QR generation — `qrcode.toDataURL`:
- `InvoicePreview`: `{ width: 160, margin: 1, color: { dark: '#1e3a5f', light: '#fff' } }`
  regenerated when `upiId`, `upiName`, `businessName`, `invoiceNumber`, or `grandTotal` change;
  cleared when `upiId` is empty.
- `SharedInvoiceView`: 250 px, own copy. The Pay button card uses a 176 px QR.

## 6. localStorage keys

| Key | Written by | Value | Lifetime |
|---|---|---|---|
| `billing_business_defaults` | `App.jsx` (10-field effect) | 11 business/bank/UPI/GSTIN defaults | persists; guest path |
| `billing_draft` | `App.jsx` (400 ms effect) | `{ invoice, editInvoiceId, savedAt }` | persists; reload restore |
| `billing_edit_context` | `App.jsx` | the invoice id being edited | persists; cleared if row is gone |
| `billing_auth_dash` | `AuthModal.jsx` | `'1'` | **transient** OAuth breadcrumb, cleared on boot/error |
| `billing_logo` | `lib/logo.js` | `JSON.stringify(dataUrl)` of the logo PNG | device-local, **never synced** |
| `billing_logo_settings` | `lib/logo.js` | `{ position, width, height }` | device-local; survives `clearStoredLogo()` |
| `billing_desktop_token` | `lib/desktop.js` | offline session access token | desktop only |

Every access is individually try/catch-wrapped (private mode / quota).

Note: `logo` is **not** in `user_profiles` and **not** in `invoices`. It lives only on the
device that uploaded it.

## 7. Business-defaults resolution

Two sources, profile wins when a session exists:

```
signed in  →  user_profiles row  →  businessDefaultsFromProfile(row)
              (falls back to billing_business_defaults if the row is thin)
guest      →  billing_business_defaults  (localStorage)
```

`applyBusinessDefaults` uses `prev.businessName ? prev : {...}` — it **never overwrites**
values already present on the invoice. That is why a guest who fills the form once keeps it.

## 8. Supabase (web) schema essentials

Full DDL: `db/schema/schema.sql` (consolidated) and `supabase-schema.sql` (base).
Snapshot 2026-09-30, project `tytmqdruzdzejwatqgya`.

- `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` — supplies `uuid_generate_v4()` for
  `invoices.id` and `invoices.share_token`.
- Indexes: `idx_invoices_user_id ON invoices(user_id)`,
  `idx_invoices_created_at ON invoices(created_at DESC)`.
- Trigger `update_updated_at_column()` (PL/pgSQL, `NEW.updated_at = NOW()`) wired as
  `CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW`.
- RLS enabled on both tables.
  - `invoices` — 4 policies, all scoped `auth.uid() = user_id`:
    `"Users can view own invoices"`, `"Users can insert own invoices"`,
    `"Users can update own invoices"`, `"Users can delete own invoices"`.
  - `user_profiles` — 3 policies (view / insert / update own). **No DELETE policy.**
- Public share access is **deliberately NOT an RLS policy**. It goes through:
  ```sql
  get_shared_invoice(token UUID) RETURNS SETOF invoices
  LANGUAGE sql SECURITY DEFINER AS $$ SELECT * FROM invoices WHERE share_token = token; $$
  ```
  `supabase-rls-fix.sql` drops the earlier `"Anyone can view shared invoices"` policy that
  leaked every row, then recreates this function. **Don't "simplify" by re-adding a public
  SELECT policy.**
- Live DB also exposes `/rpc/rls_auto_enable` (empty-arg helper created from the dashboard,
  not in the repo migrations) — `schema.sql` notes it can be dropped.
- PostgREST 14.5. `/invoices` requires `id, user_id, invoice_number, invoice_date, bill_type,
  advance`; 31 properties. `/user_profiles` requires `user_id`; 13 properties.

## 9. Local SQLite schema (`electron/db.cjs::migrate`)

All `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` — safe to re-run.

| Table | Columns |
|---|---|
| `invoices` | `id TEXT PK`, `user_id TEXT NOT NULL`, 25 whitelisted business/customer/detail TEXT cols, `discount REAL DEFAULT 0`, `advance REAL DEFAULT 0`, `enable_gst INTEGER DEFAULT 0`, `gstin TEXT`, `bill_type TEXT DEFAULT 'normal'`, `items TEXT DEFAULT '[]'`, `grand_total REAL DEFAULT 0`, bank_* , `upi_id`, `upi_name`, `terms`, `signature`, `share_token TEXT`, `status TEXT DEFAULT 'pending'`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL` |
| `user_profiles` | `user_id TEXT PK`, 11 TEXT cols, `updated_at TEXT NOT NULL` |
| `users` | `id TEXT PK`, `email TEXT UNIQUE`, `name TEXT DEFAULT ''`, `password_salt TEXT NOT NULL`, `password_hash TEXT NOT NULL`, `created_at`, `updated_at` |
| `sessions` | `token TEXT PK`, `user_id TEXT NOT NULL`, `created_at TEXT NOT NULL` |
| `meta` | `key TEXT PK`, `value TEXT` — holds `db_version` |

Indexes: `idx_invoices_user_updated(user_id, updated_at)`,
`idx_invoices_user_created(user_id, created_at)`, `idx_sessions_user(user_id)`.

### Type coercion (`normalizePayload` / `mapRow`)
```js
INVOICE_COLS  // 30 entries — the allowlist; unknown keys are DROPPED
PROFILE_COLS   // 12 entries
NUMERIC_COLS = ['discount', 'advance', 'grand_total']   // → Number on write
BOOL_COLS    = ['enable_gst']                            // → 0/1 on write
JSON_COLS    = ['items']                                 // → JSON.stringify on write
```
`mapRow` reverses: `enable_gst → boolean`, `items → JSON.parse` (fallback `[]`), and for
`user_profiles` it nulls out a nested `user_profiles` key to mimic PostgREST's embedded-resource
shape.

### Deltas from Postgres (intentional but surprising)
| | Postgres | Local SQLite |
|---|---|---|
| `id` / `share_token` type | UUID, DB-generated | TEXT; **main process must supply** |
| `enable_gst` | BOOLEAN | INTEGER |
| `items` | JSONB | TEXT (JSON string) |
| `updated_at` | DB trigger | main process sets explicitly |
| Constraints (CHECK/UNIQUE/REFERENCES) | enforced | not enforced |

## 10. Security rules

- `.env` is gitignored. `VITE_SUPABASE_ANON_KEY` is intentionally browser-visible (RLS is the
  real boundary). `SUPABASE_SERVICE_ROLE_KEY` **bypasses RLS** and is used only by
  `db/schema/refresh.ps1`. Never prefix it `VITE_`, never import it into `src/`, never commit.
- Logo images are stored as base64 data URLs in `localStorage` — they never leave the device.
- Electron: `contextIsolation: true`, `nodeIntegration: false`. `webSecurity`/`sandbox` are
  left at defaults.
- Local passwords: `scrypt(password, 16-byte-random-salt, 64)`, compared with
  `crypto.timingSafeEqual`.
- Share tokens are unguessable UUIDs and are only resolvable through the `SECURITY DEFINER` RPC.
- Backup filenames are sanitised with `path.basename` + a `.db` suffix check before any
  `fs` call; export filenames go through `safeName()`.