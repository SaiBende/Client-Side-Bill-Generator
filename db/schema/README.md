# db/schema

Live schema snapshot of the Supabase project `tytmqdruzdzejwatqgya` (ShareMyBill web auth + cloud storage).

## Contents

| File | What it is |
| --- | --- |
| `schema.sql` | Consolidated DDL — full runnable schema (see header for what is live-verified vs reconstructed) |
| `schema.md` | Human-readable column-by-column reference of both tables, RLS policies, indexes, triggers, functions |
| `postgrest-openapi.json` | Raw PostgREST OpenAPI snapshot, fetched live with the service role key |
| `refresh.ps1` | Re-fetch the live OpenAPI snapshot (asks for the service role key once; writes `postgrest-openapi.json`) |
| `migrations/` | The applied SQL migrations in apply order |
| `migrations/01-invoices-and-profiles.sql` | Base schema: tables, RLS, trigger, `get_shared_invoice` |
| `migrations/02-advance-column.sql` | `invoices.advance` |
| `migrations/03-measurement-bill-type.sql` | `invoices.bill_type` CHECK (`normal`/`measurement`) |
| `migrations/04-rls-share-fix.sql` | Drops overly permissive policy; defines secure `get_shared_invoice` |

## How it was captured

Live structure (tables, columns, types, required, RPC list) comes from the **PostgREST OpenAPI endpoint**,
which requires the **service role key**:

```
curl "https://<ref>.supabase.co/rest/v1/" \
  -H "apikey: <service_role>" -H "Authorization: Bearer <service_role>" \
  -H "Accept: application/openapi+json"
```

The API cannot expose defaults, CHECKs, PK/FKs, indexes, triggers, RLS policies or function bodies —
those are reconstructed from `migrations/` (whose column structure was verified to match the live DB).

## Refreshing

```
.\db\schema\refresh.ps1
```

Then, if columns changed, update `schema.md` + `schema.sql` accordingly.

## Rotating keys
If the service role key ever leaks, regenerate it in Supabase Dashboard → Project Settings → API.