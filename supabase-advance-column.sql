-- Run this in Supabase SQL Editor
-- Adds the advance (amount paid) column to invoices

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS advance NUMERIC(10, 2) DEFAULT 0 NOT NULL;