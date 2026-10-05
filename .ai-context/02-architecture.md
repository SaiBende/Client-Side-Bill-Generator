# 02 — Architecture

## 1. Layer diagram

```
┌─ WEB ─────────────────────────────────────────────────────────────────┐
│  Vercel  /            marketing site  (landing/, static, no build)     │
│  Vercel  /app/        React SPA      (dist/app/, base='/app/')         │
│        │  rewrite /app/:path* → /app/index.html  (SPA fallback)         │
└────────────────────────────────────────────────────────────────────────┘
                                    │
┌─ DESKTOP ──────────────────────────────────────────────────────────────┐
│  electron/main.cjs   BrowserWindow 1280×860 (min 900×640)              │
│    ├─ Menu removed, autoHideMenuBar, F12 toggles DevTools               │
│    ├─ prod: loadFile(dist/index.html)   dev: loadURL(VITE_DEV_SERVER_URL)│
│    ├─ webPreferences: contextIsolation ON, nodeIntegration OFF          │
│    └─ crash recovery: reload on 'render-process-gone' / 'unresponsive',   │
│         max 3 reloads inside a 30 s window                              │
└────────────────────────────────────────────────────────────────────────┘
                                    │  contextBridge
                       window.billingDesktop  (preload.cjs)
                                    │  ipcRenderer.invoke
┌─ MAIN PROCESS ────────────────────────────────────────────────────────┐
│  electron/ipc.cjs    13 ipcMain.handle channels                          │
│  electron/db.cjs     sql.js (SQLite/WASM) store, scrypt auth, backups   │
└────────────────────────────────────────────────────────────────────────┘
```

## 2. The single seam: `src/lib/supabase.js`

Everything that touches data imports one symbol:

```js
// src/lib/supabase.js
export const supabase = isDesktopMode ? createLocalAdapter() : createWebClient()
```

- `createWebClient()` → `createClient(import.meta.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`.
  **Throws eagerly at module scope** if either env var is missing → white screen, not a
  friendly error. Keep `.env` populated for any web/dev run.
- `createLocalAdapter()` → `src/lib/desktop.js`, never reads env vars.

Only three files import `supabase`: `App.jsx`, `components/Dashboard.jsx`,
`components/auth/AuthModal.jsx`. That is why swapping backends touches so little code.

### Supabase API surface the app is allowed to use

The desktop adapter only implements this subset — **if you use anything outside it, desktop
breaks silently**:

```
supabase.from(table)
  .select(cols?)  .eq(col, val)  .order(col, { ascending })  .limit(n)
  .insert(row)    .update(patch)  .upsert(row, { onConflict })  .delete()
  .then()          // the builder is thenable → await works directly
  .single()        // unwrap first row
supabase.auth.getSession() / onAuthStateChange(cb) / signUp() /
                signInWithPassword() / signInWithOAuth() / signOut()
supabase.rpc(name, args).single()
```

Notes:
- `select(cols)` is captured by the adapter but **ignored** by `electron/db.cjs` (always
  `SELECT *`). Don't rely on column projection.
- `.then()` on the builder is the mechanism — there is no `execute()`.
- `.single()` normalizes array-vs-object exactly like supabase-js.

### Capability gating by returning errors

Desktop-unsupported features return Supabase-shaped errors so callers need **zero**
`isDesktopMode` branches:

| Feature | Desktop behaviour |
|---|---|
| `auth.signInWithOAuth()` | `{ data: null, error: { message: 'Google sign-in is only available in the online version.' } }` |
| `rpc('get_shared_invoice')` | `{ data: null, error: { message: 'Shared links are only available in the online version.' } }` |

The only places that actually branch on `isDesktopMode` are:
1. `src/lib/desktopFiles.js` — native save dialog / reveal in folder.
2. `src/App.jsx` — an "Offline" badge and the **Backup** button in the header.

## 3. IPC contract (`electron/preload.cjs` → `window.billingDesktop`)

`contextIsolation: true`, `nodeIntegration: false`. Preload exposes one object:

```js
window.billingDesktop = {
  isDesktop: true,
  paths():                                   // invoke 'billing:paths'
  db(op):                                    // invoke 'billing:db'      ← generic CRUD
  auth: {
    getSession(token),                      // 'billing:auth:getSession'
    signUp(email, password),                 // 'billing:auth:signUp'
    signIn(email, password),                 // 'billing:auth:signIn'
    signOut(token),                          // 'billing:auth:signOut'
    onAuth(cb)                               // ipcRenderer.on('billing:auth') → unsubscribe fn
  },
  backup: {
    create(), list(), restore(name), del(name), openFolder()
  },
  files: {
    save({ name, dataUrl, ask }),            // 'files:save'
    reveal(filePath)                         // 'files:reveal'
  }
}
```

### The serialized query object

`src/lib/desktop.js` collapses a whole chained builder into **one** plain object and ships it
as a single `invoke`:

```js
{ table, op: 'select'|'insert'|'update'|'upsert'|'delete',
  filters: [{ col, val }],          // from .eq()
  order: { col, ascending },
  limit: n,
  selectCols: cols,                 // captured, unused by main
  data: row | patch,
  conflict: 'id' }                  // from upsert's onConflict
```

`electron/db.cjs::query(op)` dispatches on `op`, always resolves
`{ error: { message } | null, data }` — **it never throws across IPC**.

### `files:save` semantics

| `ask` | Behaviour |
|---|---|
| `true` | `dialog.showSaveDialog` — title `'Save Invoice'`, default `~/Downloads/<safeName>`; returns `{ canceled: true }` if dismissed |
| `false` | Writes silently to `<root>\Exports\<safeName>` (dir created recursively) |

`safeName()` strips `/[<>:"/\\|?*]/` → `_`, trims, falls back to `'file'`.
Empty decoded buffer → `{ error: { message: 'Empty file content' } }`.

App usage: **Download PDF**, **Blank PDF**, **Word** → `ask: true`.
**Share PDF**, **Img** → `ask: false` then `desktopReveal(path)`.

### Main → renderer push

Only one channel: `billing:auth` with `{ event: 'SIGNED_IN' | 'SIGNED_OUT', session }`,
broadcast via `ipc.cjs::broadcastAuth` after signUp/signIn/signOut. `desktop.js` mirrors this
into its own `authListeners` array so `onAuthStateChange` has Supabase's shape.

## 4. Renderer state & navigation (`src/App.jsx`)

### No router
```js
view            // 'editor' | 'dashboard'
isSharedView    // boolean, driven by ?share=<token> in the query string
editInvoiceId   // null = new invoice
activeTab       // 'form' | 'preview'  (mobile only)
```

Share link construction accounts for the Vercel base path:
```js
`${window.location.origin}${isDesktopMode ? '' : '/app'}?share=${token}`
```
Closing a share view does `history.replaceState({}, '', '/')`.

### `App.jsx` state inventory
`session`, `view`, `editInvoiceId`, `invoice`, `logo`, `logoSettings`, `activeTab`,
`saving`, `generating`, `shareToken`, `isSharedView`, `showAuth`, `showBackup`, `toast`,
`autosaveState` (`'idle'|'pending'|'saving'|'saved'|'error'`).

### Refs and why they exist
| Ref | Purpose |
|---|---|
| `previewRef` | The **offscreen** `InvoicePreview` div targeted by html2canvas |
| `blankPreviewRef` | Same for `BlankInvoicePreview` |
| `pendingActionRef` | A deferred action (Save / PDF / DOCX / Share / Dashboard) waiting on auth |
| `authNavRef` | Distinguishes OAuth-initiated sign-in (→ dashboard) from modal-initiated (→ resume action) |
| `editContextMountedRef` | Skips the first run of the edit-context effect so boot restore can't clobber the id |
| `autosaveTimerRef` | Debounce handle for the 1,200 ms db autosave |
| `autosaveSigRef` | `JSON.stringify(invoice)` of the last written state → dedupe |
| `saveInvoiceToDBRef` | Holds the latest `saveInvoiceToDB` so the autosave effect doesn't re-subscribe |

### Boot sequence
```
mount
 ├─ URL has ?share=<token>?  → SharedInvoiceView, stop
 ├─ supabase.auth.getSession()
 │    ├─ session exists
 │    │    ├─ localStorage['billing_auth_dash'] === '1'  → setView('dashboard'), clear flag
 │    │    ├─ else restoreEditContextOrDashboard()
 │    │    └─ loadProfileDefaultsToInvoice(user.id)   ← profile beats localStorage
 │    └─ no session  → applyBusinessDefaults(getBusinessDefaultsFromLocal())  ← guest
 └─ subscribe supabase.auth.onAuthStateChange  (unsubscribe on unmount)
```

### `requireAuth(callback)` — the central gate
```
signed in?  → run now
otherwise    → pendingActionRef.current = callback; open AuthModal
              → effect on `session` re-runs it
```
Wraps: Save, PDF, DOCX, Share PDF, Share Image, Blank PDF, and the Dashboard nav.

### Restore precedence (`restoreEditContextOrDashboard`)
1. `billing_edit_context` holds an id → verify the row still exists → `loadInvoice(id)`
2. else `billing_draft` → `{ invoice, editInvoiceId }` → restore into editor
3. else `setView('dashboard')`
Stale edit-context ids are cleared.

## 5. The two autosaves

| | Draft autosave | DB autosave |
|---|---|---|
| Debounce | **400 ms** | **1,200 ms** |
| Requires session | no | **yes** |
| Guard | `view === 'editor'` | `view === 'editor'` |
| Target | `localStorage['billing_draft']` = `{ invoice, editInvoiceId, savedAt }` | `invoices` row (Supabase or SQLite) |
| Dedupe | none | `JSON.stringify(invoice)` vs `autosaveSigRef.current` |
| UI feedback | none | `autosaveState` → header "Saving… / Saved / Save failed" |

Both use a **has-content predicate** so blank invoices are never written:
> customerName, businessName, or customerAddress non-empty, **or** any item with a
> description, `rate > 0`, or a measurement with `width`/`height` > 0.

`loadInvoiceFromRow` primes `autosaveSigRef` so merely opening an invoice doesn't re-save it.

## 6. Save path (`saveInvoiceToDB`)

Shared by autosave, manual Save, **and every export**. Returns `{ error }`.

```js
editInvoiceId ? supabase.from('invoices').update(payload).eq('id', editInvoiceId)
              : supabase.from('invoices').insert(payload).select('id, share_token').single()
```
On insert success → `setEditInvoiceId(res.data.id)`, `setShareToken(res.data.share_token)`.

Then always upsert the profile:
```js
supabase.from('user_profiles')
  .upsert({ user_id, ...11 business/bank/upi/gstin fields }, { onConflict: 'user_id' })
```

⚠ `payload.status` is hardcoded `'pending'` — a manual save resets a `paid` invoice. Change
status from `Dashboard`'s `StatusBadge`.

## 7. Export / capture pipeline

### The offscreen-capture trick
`App.jsx` renders **two duplicate previews** in fixed `w-[794px]` (A4 width) divs parked at
`-left-[9999px]`, each marked `data-capture="true"`:
- one `InvoicePreview` (→ Share PDF, Img)
- one `BlankInvoicePreview` (→ Blank PDF)

Consequences: the visible on-screen preview and the exported image are **independent copies**,
so a CSS/layout difference in the live preview does not corrupt the export. `previewRef` /
`blankPreviewRef` point at these.

### `captureToPDF(el, filename)`
1. `html2canvas(el, { scale: 2, useCORS: true, logging: false })`
2. `onclone`: set `wordSpacing: '1px'` + `letterSpacing: '0.3px'` on **every** node — a
   text-metric hack that stops justified-text reflow; force `[data-capture]` to
   `left:0; top:0; opacity:1`
3. `canvas.toDataURL('image/jpeg', 0.95)`
4. A4 portrait `210 × 297` mm; `fit = Math.min(1, 297 / naturalHeight)`; centre it
5. `new jsPDF('p','mm','a4').addImage(...)`; call `pdf.save(filename)` only if a filename was
   passed; **return the `pdf`** so callers can use `pdf.output('datauristring')`

### Four export entry points
| Button | Handler | Desktop | Web |
|---|---|---|---|
| **Word** | `downloadDocx` | identical — browser download | identical || **Share** | `sharePDF` | `pdf.output('datauristring')` → `desktopExportFile(ask:false)` → `desktopReveal` | `navigator.share({files:[File]})` if supported, else blob URL + `window.open`, revoke after 10 s |
| **Img** | `shareImage` | inline html2canvas → `toDataURL('image/png')` → save + reveal | `canvas.toBlob` → `navigator.share` / `window.open` |
| **Blank** | `downloadBlankPDF` | `desktopExportFile(ask:true)` | `pdf.save('Blank-Invoice.pdf')` |

`downloadPDF` still exists but **no button binds it** (superseded by `sharePDF`).

## 8. Desktop storage layer (`electron/db.cjs`)

### Paths
```js
root        = path.resolve(process.env.BILLING_FOLDER)
              ?? path.join(os.homedir(), 'Documents', 'BillingApp')
dbPath      = <root>/billing.db
backupsDir  = <root>/Backups
tmpPath     = <root>/billing.db.tmp     // atomic write staging
exportsDir  = <root>/Exports            // created lazily by ipc.cjs
```

### Init (`initStore`, awaited in `app.whenReady` before `registerIpc`/`createWindow`)
1. `ensureDirs()` — `mkdirSync(..., { recursive: true })` for root + Backups
2. `initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })`
   → `node_modules/sql.js/dist/sql-wasm.wasm` (~658 KB). Packaged builds rely on
   `asarUnpack: ["node_modules/sql.js/dist/**/*"]`.
3. Load existing `billing.db` bytes, or `new SQL.Database()`
4. `migrate()` → `persistNow()`

### Persistence
`persistNow()` runs **after every single mutation** (including auth writes):
`db.export()` → `writeFileSync(<root>/billing.db.tmp)` → `renameSync` to `billing.db`.
Atomic against torn writes, but O(database size) per save.

### Local schema
| Table | PK | Notes |
|---|---|---|
| `invoices` | `id TEXT` | 30 whitelisted cols; `discount/advance/grand_total REAL`, `enable_gst INTEGER`, `items TEXT` (JSON string), `bill_type TEXT DEFAULT 'normal'` |
| `user_profiles` | `user_id TEXT` | 11 business/bank/upi/gstin TEXT cols + `updated_at` |
| `users` | `id TEXT` | `email UNIQUE`, `name`, `password_salt`, `password_hash`, timestamps |
| `sessions` | `token TEXT` | `user_id`, `created_at` — **no expiry, no cleanup** |
| `meta` | `key TEXT` | holds `db_version`, **hardcoded `'1'`, never incremented** |

Indexes: `idx_invoices_user_updated(user_id, updated_at)`,
`idx_invoices_user_created(user_id, created_at)`, `idx_sessions_user(user_id)`.

⚠ Local `id`/`share_token` are `TEXT` with **no DB-side default**. `runInsert` generates
`id` via `crypto.randomUUID()` but **does not generate `share_token`** → `copyShareLink`
no-ops on desktop unless a token already exists.

### Coercion layers
- `normalizePayload(table, payload)` — whitelists columns (`INVOICE_COLS` 30, `PROFILE_COLS` 12),
  coerces `NUMERIC_COLS = [discount, advance, grand_total] → Number`,
  `BOOL_COLS = [enable_gst] → 0/1`, `JSON_COLS = [items] → JSON.stringify`. Unknown keys
  dropped; `null` → SQL NULL; everything else stringified.
- `mapRow(table, row)` — inverse: `enable_gst → boolean`, `items → JSON.parse` (falls back to
  `[]`), and for `user_profiles` it nulls a `user_profiles` key to mimic PostgREST's embedded
  resource shape.

⚠ Table/column names are interpolated with double quotes from caller-supplied strings —
there is **no allowlist on `op.table`**. Only ever pass literals from app code.

### Local auth
- email → `trim().toLowerCase()`, regex `^[^@\s]+@[^@\s]+\.[^@\s]+$`; password min length 6
- `crypto.randomBytes(16).toString('hex')` salt + `crypto.scryptSync(password, salt, 64)`
- compare with `crypto.timingSafeEqual` behind a length pre-check
- session token = `crypto.randomBytes(32).toString('hex')`, row in `sessions`
- session object is Supabase-shaped: `{ access_token, token_type: 'bearer', user: { id, email,
  created_at, user_metadata: {} } }` → renderer stores it in `billing_desktop_token`
- duplicate email → `'User already registered'`; bad sign-in → generic
  `'Invalid login credentials'`

### Backups
- `BACKUP_KEEP = 10`; filename `BillingApp-YYYYMMDD-HHMMSS-mmm.db`
- `createBackup()` = `persistNow()` → `copyFileSync(dbPath, file)` → prune oldest `.db`
  files while `length > 10`
- `listBackups()` → `{ name, size, mtime }`, name-descending (= newest first)
- `restoreBackup(name)`:
  1. `path.basename` guard, must end `.db`, must exist
  2. open into a **second** `SQL.Database`, run `PRAGMA integrity_check`; must be `'ok'`
     else `'Backup file is corrupted'`
  3. **auto-backup current state first**
  4. `MERGE_TABLES = [{users, pk:'id'}, {invoices, pk:'id'}, {user_profiles, pk:'user_id'}]`
     — `sessions` and `meta` are **excluded**
  5. per row: absent → insert (`added++`); present → overwrite only when
     `row.updated_at >= existing.updated_at` (`updated++`)
  6. returns `{ name, merged: { users:{added,updated}, invoices:{…}, user_profiles:{…} }, autoBackup }`
- `BackupManager.jsx` shows *"Merged. Current data saved as backup X — reloading…"* then
  `window.location.reload()` after 1,500 ms. **The reload is the reset mechanism** — the
  modal is intentionally not unmounted by any other path.

## 9. Landing site (`landing/`)

Zero build step, zero dependencies: `index.html` (425 lines) + `assets/css/style.css`
(291 lines, CSS custom properties) + `assets/js/main.js` (39 lines vanilla ESM).
Absolute root paths (`/assets/…`, `/logo.png`, `/app/`), so it **only works served from the
domain root**.

SEO head: `lang="en-IN"`, canonical `https://sharemybill.vercel.app/`, full OG + Twitter card,
and a JSON-LD `@graph` with 4 nodes (`WebSite`, `Organization`, `SoftwareApplication` desktop,
`SoftwareApplication` web).

`main.js` does exactly three things: mobile nav toggle (class `open`, syncs
`aria-expanded`/`aria-label`, closes on anchor click), `[data-year]` → current year, and an
`IntersectionObserver` (threshold `0.12`, unobserve after first hit) adding `.visible` to
`.card, .steps li, .split, .faq-cta` for reveal-on-scroll.

## 10. Dependency graph (`src/` internal edges)

```
main.jsx
 ├─ index.css
 └─ App.jsx                       ← 13 internal imports, the hub
      ├─ lib/supabase ──► lib/desktop
      ├─ lib/desktop  (isDesktopMode)
      ├─ lib/desktopFiles
      ├─ lib/logo
      ├─ lib/measurements
      ├─ lib/exportDocx
      ├─ components/AuthModal        ──► lib/supabase
      ├─ components/Dashboard        ──► lib/supabase
      ├─ components/InvoiceForm      ──► lib/measurements
      ├─ components/InvoicePreview   ──► lib/measurements
      ├─ components/BlankInvoicePreview   (leaf)
      ├─ components/BackupManager         (leaf, talks to window.billingDesktop directly)
      └─ components/BrandFooter           (leaf, zero imports)
```

Hub nodes: `App.jsx`, `lib/measurements.js` (3 consumers), `lib/supabase.js` (3 consumers).
Leaves: `BrandFooter`, `BlankInvoicePreview`, `BackupManager`, `lib/desktopFiles.js`.

## 11. Deployment topology

```
                    ┌──────────────────────────────┐
   GitHub repo ────►│ Vercel (auto-deploy)         │
                    │  build: npm run build:vercel │
                    │  output: dist                │
                    │  /            → landing/      │
                    │  /app/        → SPA           │
                    └──────────────────────────────┘
                    ┌──────────────────────────────┐
                    │ Supabase (Postgres + Auth)   │
                    │  RLS on invoices,            │
                    │  user_profiles               │
                    │  SECURITY DEFINER RPC for    │
                    │  public share links          │
                    └──────────────────────────────┘
                    ┌──────────────────────────────┐
                    │ GitHub Releases              │
                    │  ShareMyBill Setup 1.0.0.exe │
                    │  ShareMyBill-win32-x64.zip   │
                    └──────────────────────────────┘
```

`npm run build:vercel` = `vite build --base=/app/ --outDir dist/app` then
`node scripts/build-landing.mjs`, which **deletes** `dist/{assets,robots.txt,sitemap.xml,privacy.html,index.html}`
and copies `landing/*` into `dist/`, plus hoists `public/logo.ico|logo.png` to `dist/`.
It throws `dist/app not found — run the Vite build first` if the SPA build is missing.