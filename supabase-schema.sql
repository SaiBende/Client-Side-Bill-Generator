-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/tytmqdruzdzejwatqgya/sql/new)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Invoices table
CREATE TABLE invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Business info
  business_name TEXT DEFAULT '',
  business_address TEXT DEFAULT '',
  business_phone TEXT DEFAULT '',
  business_email TEXT DEFAULT '',

  -- Customer info
  customer_name TEXT DEFAULT '',
  customer_address TEXT DEFAULT '',
  customer_city TEXT DEFAULT '',
  customer_state TEXT DEFAULT '',
  customer_pincode TEXT DEFAULT '',

  -- Invoice details
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  discount NUMERIC(10, 2) DEFAULT 0,
  enable_gst BOOLEAN DEFAULT false,
  gstin TEXT DEFAULT '',
  grand_total NUMERIC(10, 2) DEFAULT 0,

  -- Items (stored as JSONB for simplicity)
  items JSONB DEFAULT '[]'::jsonb,

  -- Bank details
  bank_name TEXT DEFAULT '',
  bank_account TEXT DEFAULT '',
  bank_ifsc TEXT DEFAULT '',
  bank_branch TEXT DEFAULT '',
  upi_id TEXT DEFAULT '',
  upi_name TEXT DEFAULT '',

  -- Terms & signature
  terms TEXT DEFAULT '',
  signature TEXT DEFAULT '',

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),

  -- Share token for public links
  share_token UUID DEFAULT uuid_generate_v4() UNIQUE
);

-- Index for faster queries by user
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);

-- Enable Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Users can only see their own invoices
CREATE POLICY "Users can view own invoices"
  ON invoices FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own invoices
CREATE POLICY "Users can insert own invoices"
  ON invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own invoices
CREATE POLICY "Users can update own invoices"
  ON invoices FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own invoices
CREATE POLICY "Users can delete own invoices"
  ON invoices FOR DELETE
  USING (auth.uid() = user_id);

-- Public shared access uses the get_shared_invoice(token) RPC function (see supabase-rls-fix.sql)
-- This avoids the OR-combination problem with RLS policies

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- User profiles for default business info
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  business_name TEXT DEFAULT '',
  business_address TEXT DEFAULT '',
  business_phone TEXT DEFAULT '',
  business_email TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  bank_account TEXT DEFAULT '',
  bank_ifsc TEXT DEFAULT '',
  bank_branch TEXT DEFAULT '',
  upi_id TEXT DEFAULT '',
  upi_name TEXT DEFAULT '',
  gstin TEXT DEFAULT ''
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Secure RPC for public shared invoice access (avoids RLS OR-combination issue)
CREATE OR REPLACE FUNCTION get_shared_invoice(token UUID)
RETURNS SETOF invoices
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM invoices WHERE share_token = token;
$$;
