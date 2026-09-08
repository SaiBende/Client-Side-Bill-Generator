-- Run this in Supabase SQL Editor
-- Adds the size/area ("measurement") bill type column to invoices

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS bill_type TEXT DEFAULT 'normal' NOT NULL
  CHECK (bill_type IN ('normal', 'measurement'));