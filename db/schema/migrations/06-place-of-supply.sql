-- Run this in Supabase SQL Editor
-- Adds place of supply (state) so GST invoices record the GST state code

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS place_of_supply TEXT DEFAULT '' NOT NULL;
