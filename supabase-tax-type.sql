-- Run this in Supabase SQL Editor
-- Adds intra/inter-state tax type so inter-state sales can bill IGST instead of CGST+SGST

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'intra' NOT NULL
  CHECK (tax_type IN ('intra', 'inter'));
