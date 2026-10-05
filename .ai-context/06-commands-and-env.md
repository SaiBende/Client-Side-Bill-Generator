# 06 — Commands, Env & Ops

## npm scripts (`package.json`)

| Script | Command | What it does |
|---|---|---|
| `dev` | `vite` | Vite dev server for the **web** app. Default `http://localhost:5173`. Needs `.env`. |
| `build` | `vite build` | Builds the SPA into `dist/` with `base: './'`. **This is the desktop build.** |
| `build:vercel` | `vite build --base=/app/ --outDir dist/app && node scripts/build-landing.mjs` | Full production build: SPA into `dist/app/`, then the landing site into `dist/`. **Vercel only.** |
| `lint` | `oxlint` | The only quality gate. Ignores `landing/`, `scripts/`, `dist/`, `release/`. |
| `preview` | `vite preview` | Serves the last `dist/` build. |
| `desktop:dev` | `concurrently -k "npm:dev" "node electron/start-dev.mjs"` | **The main dev loop.** Vite + Electron together; `start-dev.mjs` waits for Vite then spawns Electron with `VITE_DEV_SERVER_URL`. |
| `desktop:start` | `npm run build && npx electron .` | Build then run the packaged-style app from `dist/index.html`. |
| `desktop:exe` | `npm run build && electron-packager . ShareMyBill --platform=win32 --arch=x64 --out=release --overwrite` | **Portable zip** — `release/ShareMyBill-win32-x64.zip` (~161.6 MB) + unpacked folder. |
| `desktop:dist` | `npm run build && electron-builder --win` | **NSIS installer** via the `build` block in package.json → `release/`. |

### Which build for which target
| Target | Command | Result |
|---|---|---|
| Local web dev | `npm run dev` | Vite only |
| Desktop dev (hot reload) | `npm run desktop:dev` | Vite + Electron |
| Desktop run-from-build | `npm run desktop:start` | `dist/index.html` |
| Windows installer (.exe) | `npm run desktop:dist` | electron-builder NSIS |
| Portable zip | `npm run desktop:exe` | electron-packager |
| Vercel deploy | `npm run build:vercel` | `dist/` = landing + `dist/app/` = SPA |

⚠ **Never run `build:vercel` before `desktop:dist` / `desktop:exe`.** See 07 §1.

## Linting

`npm run lint` → oxlint. Config `.oxlintrc.json`:
```json
{
  "ignorePatterns": ["landing/**", "scripts/**", "dist/**", "release/**"],
  "plugins": ["react", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```
`allowConstantExport` is why `lib/measurements.js` can export both functions and
`SQ_INCHES_PER_SQ_FOOT`-style constants without warnings.

**Current baseline (2026-10-04): 0 errors, 1 warning.** Don't introduce new ones; this one is
pre-existing and unrelated to exports:
```
src/components/Dashboard.jsx:59  useEffect missing dependency 'loadInvoices'
```
This was 3 warnings until 2026-10-04. The other two were `src/App.jsx:13 Download imported but
never used` and `src/App.jsx:788 downloadPDF declared but never used` — both symptoms of the PDF
button having been deleted in commit `1836b87`. Restoring the button cleared both. `oxlint`
flags unused imports but **not** unreferenced functions, so a missing `onClick` shows up as a
bare function; treat a new unused-function warning as "a feature lost its button".

`src/lib/exportDocx.js` is lint-clean (previously 3 warnings: unused `Header`, `Footer`,
`saveAs`).

**There is no test runner and no test script.** Don't claim tests pass. Verify manually.

## Environment variables

### `.env` (gitignored, 5 lines)
```ini
VITE_SUPABASE_URL=https://tytmqdruzdzejwatqgya.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable anon key>

# Backend-only secret. DO NOT prefix with VITE_ (frontend exposure). Never commit.
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```
- `VITE_*` vars are **inlined into the client bundle by Vite**. `VITE_SUPABASE_ANON_KEY` is
  therefore public by design — RLS is the security boundary, not the key.
- `SUPABASE_SERVICE_ROLE_KEY` **bypasses RLS**. Used only by `db/schema/refresh.ps1`. Never
  import it into `src/`, never rename it to a `VITE_` prefix, never commit.
- Missing either `VITE_` var makes `src/lib/supabase.js` **throw at import time** →
  white screen. Not a runtime error banner.

### Other env vars in the codebase
| Var | Read at | Purpose |
|---|---|---|
| `VITE_DEV_SERVER_URL` | `electron/main.cjs:7,41`; `electron/start-dev.mjs:8,28` | If set → `isDev`, load that URL. `start-dev.mjs` injects it into the child. |
| `BILLING_FOLDER` | `electron/db.cjs:33` | Overrides the local storage root (see paths below). Unset in normal use. |
| `CAPTURE_URL` | `scripts/capture-shot.cjs:8` | Screenshot target; defaults `http://localhost:4137/app/`. |

## Desktop data locations

```
root       = BILLING_FOLDER ? path.resolve(BILLING_FOLDER)
                         : %USERPROFILE%\Documents\BillingApp
  billing.db          ← the sql.js SQLite database
  billing.db.tmp      ← atomic write staging
  Backups\            ← BillingApp-YYYYMMDD-HHMMSS-mmm.db  (newest 10 kept)
  Exports\            ← written when ask:false (Share PDF / Img on desktop)
```

Set `BILLING_FOLDER` to relocate — useful for portable installs or automated testing:
```powershell
$env:BILLING_FOLDER = "$PWD\.tmp-billing"; npm run desktop:start
```
Remember to clear it (`Remove-Item Env:BILLING_FOLDER`) for normal runs.

## Database operations

### Apply a Postgres migration
Two copies must be updated together (they are byte-identical today):
```
supabase-<name>.sql                ← root, the original
db/schema/migrations/NN-<name>.sql ← curated copy
```
Run against Supabase Studio (`https://supabase.com/dashboard/project/tytmqdruzdzejwatqgya/sql/new`).

### Local SQLite migrations
`electron/db.cjs::migrate()` is automatic — all statements are
`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` and run on every launch.
There is **no version gating** (`meta.db_version` is hardcoded `'1'`), so adding a column
means writing your own `ALTER TABLE` guarded by a check, since `IF NOT EXISTS` on a *column*
is not portable SQLite.

### Refresh the schema snapshot
```powershell
pwsh -File db\schema\refresh.ps1
```
Reads `.env` (⚠ hardcoded absolute path `E:\Billing App\.env`), falls back to an interactive
`Read-Host -AsSecureString` prompt, then `curl.exe` fetches
`$url/rest/v1/` with the service-role key into `db/schema/postgrest-openapi.json`. Fails if the
output is under 1000 bytes.

## Desktop packaging

### electron-builder (`npm run desktop:dist`)
```json
"appId": "com.sharemybill.app",
"productName": "ShareMyBill",
"files": ["dist/**/*", "electron/**/*", "package.json"],
"directories": { "output": "release" },
"asarUnpack": ["node_modules/sql.js/dist/**/*"],
"win": { "target": [{ "target": "nsis", "arch": ["x64"] }] },
"nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true }
```
`asarUnpack` for `sql.js` is **required** — the main process resolves
`sql.js/dist/sql-wasm.wasm` at runtime and it cannot be read from inside an asar archive.

### electron-packager (`npm run desktop:exe`)
No config block; driven by CLI flags. `.electronignore` trims the bundle (`src`, `public`,
`.env`, config files, `index.html`, `package-lock.json`, `supabase-*.sql`, …).

### Hand-written NSIS scripts
`billing-installer.nsi` (production, machine-wide, admin) wraps the **electron-packager**
output folder:
```
release\ShareMyBill-win32-x64\*.*   →   $PROGRAMFILES64\ShareMyBill
```
Installs to `$SMPROGRAMS\ShareMyBill` + Desktop shortcut, writes the HKLM uninstall key,
`EstimatedSize 400000`.

Compile with `makensis billing-installer.nsi` (requires NSIS on PATH; `logo.ico` at the repo
root is used as `MUI_ICON`).

⚠ `billing-installer-test.nsi` is a per-user test variant but points at
`release\Billing App-win32-x64\`, **which does not exist** — it will not work as-is.

## Deployment

### Vercel (auto-deploy from git)
`vercel.json`:
```json
{ "framework": "vite",
  "buildCommand": "npm run build:vercel",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/app/:path*", "destination": "/app/index.html" }] }
```
Resulting topology:
- `/` → `dist/index.html` = **landing site** (copied from `landing/`)
- `/app/` → `dist/app/index.html` = **the SPA**, with the rewrite giving it SPA fallback
- `/privacy.html`, `/robots.txt`, `/sitemap.xml` served statically
- `dist/logo.ico` / `dist/logo.png` hoisted from `public/` for favicons/OG

### GitHub Releases
Desktop artifacts are published manually to <https://github.com/saibende>. Names referenced
by the landing page:
- `ShareMyBill-Setup-1.0.0.exe` (~161 MB) — the landing page tells users to accept the
  SmartScreen warning ("More info → Run anyway")
- `ShareMyBill-win32-x64.zip` — portable

### Landing page prerequisites
`landing/` has **no build step** and uses **absolute root paths** (`/assets/…`, `/logo.png`,
`/app/`). It only works when served from the domain root. Don't convert paths to relative.

## Regenerating landing screenshots
```powershell
npm run build:vercel                     # or serve dist/ yourself
node node_modules/electron/cli.js scripts/capture-shot.cjs
```
⚠ `capture-shot.cjs` expects a `smoke-server.mjs` on port **4137** that is **not in this
repo**, and only ever writes `landing\assets\images\app-editor.png`. To regenerate, serve
`dist/` on 4137 yourself and set `CAPTURE_URL`:
```powershell
npx vite preview --port 4137
$env:CAPTURE_URL = 'http://localhost:4137/app/'
node node_modules/electron/cli.js scripts/capture-shot.cjs
```
`app-invoice.png` (912×956, the rendered invoice) has no generator script — capture it by hand.

## DevTools
F12 toggles DevTools in Electron in **both** dev and prod (`before-input-event` handler in
`electron/main.cjs`). The app menu is removed entirely (`Menu.setApplicationMenu(null)`,
`autoHideMenuBar: true`).

## Quick task → command table

| Task | Command |
|---|---|
| Work on the app with hot reload | `npm run desktop:dev` |
| Check for lint errors before committing | `npm run lint` |
| Produce a Windows installer | `npm run desktop:dist` |
| Produce a portable zip | `npm run desktop:exe` |
| Build the web app for Vercel | `npm run build:vercel` |
| Inspect the built web app locally | `npm run preview` |
| Point the desktop DB at a scratch folder | `$env:BILLING_FOLDER = "…"; npm run desktop:start` |
| Refresh the Supabase schema snapshot | `pwsh -File db\schema\refresh.ps1` |
| Apply a DB migration | Supabase Studio → SQL editor, paste the `supabase-*.sql` |