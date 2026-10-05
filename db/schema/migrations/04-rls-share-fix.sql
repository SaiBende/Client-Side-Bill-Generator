-- Run this in Supabase SQL Editor
-- Fix: drop the overly permissive public policy that exposes ALL invoices

DROP POLICY IF EXISTS "Anyone can view shared invoices" ON invoices;

-- Create a secure RPC function for public shared invoice access
-- This bypasses RLS but requires a valid share_token
CREATE OR REPLACE FUNCTION get_shared_invoice(token UUID)
RETURNS SETOF invoices
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM invoices WHERE share_token = token;
$$;
