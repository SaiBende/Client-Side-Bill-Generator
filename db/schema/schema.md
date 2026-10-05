# ShareMyBill — Database Schema (live)

Snapshot of the **current Supabase schema** for project `tytmqdruzdzejwatqgya`.

**Source of truth:** live PostgREST OpenAPI snapshot at `./postgrest-openapi.json` (fetched with the service role key).
Column names/types/required are **verified live**. Defaults, CHECKs, PK/FKs, indexes, RLS policies, triggers and functions are
reconstructed from `./migrations/*.sql` (the API does not expose them).

---

## Table: `invoices` (31 columns, live verified)

| Column | Type | Required | Default / Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | ✅ | PK, `uuid_generate_v4()` |
| `user_id` | `uuid` | ✅ | FK → `auth.users(id)` ON DELETE CASCADE |
| `created_at` | `timestamptz` | ❌ | `NOW()` |
| `updated_at` | `timestamptz` | ❌ | `NOW()`, auto-updated by trigger |
| `business_name` | `text` | ❌ | `''` |
| `business_address` | `text` | ❌ | `''` |
| `business_phone` | `text` | ❌ | `''` |
| `business_email` | `text` | ❌ | `''` |
| `customer_name` | `text` | ❌ | `''` |
| `customer_address` | `text` | ❌ | `''` |
| `customer_city` | `text` | ❌ | `''` |
| `customer_state` | `text` | ❌ | `''` |
| `customer_pincode` | `text` | ❌ | `''` |
| `invoice_number` | `text` | ✅ | |
| `invoice_date` | `date` | ✅ | |
| `due_date` | `date` | ❌ | |
| `discount` | `numeric(10,2)` | ❌ | `0` |
| `advance` | `numeric(10,2)` | ✅ | `0` (added by migration 02) |
| `enable_gst` | `boolean` | ❌ | `false` |
| `gstin` | `text` | ❌ | `''` |
| `grand_total` | `numeric(10,2)` | ❌ | `0` |
| `bill_type` | `text` | ✅ | `'normal'`, CHECK `('normal','measurement')` (migration 03) |
| `items` | `jsonb` | ❌ | `'[]'` |
| `bank_name` | `text` | ❌ | `''` |
| `bank_account` | `text` | ❌ | `''` |
| `bank_ifsc` | `text` | ❌ | `''` |
| `bank_branch` | `text` | ❌ | `''` |
| `upi_id` | `text` | ❌ | `''` |
| `upi_name` | `text` | ❌ | `''` |
| `terms` | `text` | ❌ | `''` |
| `signature` | `text` | ❌ | `''` |
| `status` | `text` | ❌ | `'pending'`, CHECK `('pending','paid','cancelled')` |
| `share_token` | `uuid` | ❌ | `uuid_generate_v4()`, UNIQUE |

Indexes: `idx_invoices_user_id(user_id)`, `idx_invoices_created_at(created_at DESC)`
Trigger: `update_invoices_updated_at` (BEFORE UPDATE → `update_updated_at_column()`)

**RLS:** enabled. Policies: `Users can view/insert/update/delete own invoices` — all scoped to `auth.uid() = user_id`.

---

## Table: `user_profiles` (13 columns, live verified)

| Column | Type | Required | Default / Notes |
| --- | --- | --- | --- |
| `user_id` | `uuid` | ✅ | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `updated_at` | `timestamptz` | ❌ | `NOW()` |
| `business_name` | `text` | ❌ | `''` |
| `business_address` | `text` | ❌ | `''` |
| `business_phone` | `text` | ❌ | `''` |
| `business_email` | `text` | ❌ | `''` |
| `bank_name` | `text` | ❌ | `''` |
| `bank_account` | `text` | ❌ | `''` |
| `bank_ifsc` | `text` | ❌ | `''` |
| `bank_branch` | `text` | ❌ | `''` |
| `upi_id` | `text` | ❌ | `''` |
| `upi_name` | `text` | ❌ | `''` |
| `gstin` | `text` | ❌ | `''` |

**RLS:** enabled. Policies: `Users can view/insert/update own profile` — scoped to `auth.uid() = user_id`.

---

## Functions (RPC)

| Function | Live? | Signature | Purpose |
| --- | --- | --- | --- |
| `get_shared_invoice(token uuid)` | ✅ (OpenAPI) | returns `SETOF invoices`, SECURITY DEFINER | Public share-link lookup by `share_token`; bypasses RLS safely |
| `rls_auto_enable()` | ✅ (OpenAPI) | — | Dashboard-created helper (auto-enables RLS); **not** in repo migrations |
| `update_updated_at_column()` | from migrations | returns trigger | Internal — used by the `updated_at` trigger |

---

## Files

- `schema.sql` — consolidated, runnable DDL (reconstructed, header explains what is live-verified).
- `postgrest-openapi.json` — raw live API snapshot (proof of current structure).
- `migrations/` — the applied SQL files in apply order (01 → 04).
- `refresh.ps1` — re-fetch the live OpenAPI snapshot (needs service role key).