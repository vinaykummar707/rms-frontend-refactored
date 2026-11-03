-- ==============================================================================
-- Migration: Add PIS, PAS, ITMS module entitlement flags to public.users
-- Target: Supabase PostgreSQL Database (users table)
-- Description:
--   Enables per-user feature module access flags (PIS, PAS, ITMS) on public.users.
--   Matches the existing schema in public.organizations and allows Regular Customers
--   (and optional STU user overrides) to persist and manage module capabilities.
-- ==============================================================================

-- 1. Add PIS, PAS, ITMS columns to public.users
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS "PIS" BOOLEAN DEFAULT true;

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS "PAS" BOOLEAN DEFAULT false;

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS "ITMS" BOOLEAN DEFAULT false;

-- 2. Documentation comments
COMMENT ON COLUMN public.users."PIS" IS 'Enables access to Passenger Information System modules and route configurations';
COMMENT ON COLUMN public.users."PAS" IS 'Enables access to Public Address System audio announcements';
COMMENT ON COLUMN public.users."ITMS" IS 'Enables access to Intelligent Transit Management System modules and telematics';

