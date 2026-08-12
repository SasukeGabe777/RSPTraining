-- ============================================================
-- RSP TRAINING PORTAL — MIGRATION V10
-- Admin-controlled module ordering (needed for onboarding's
-- sequential lock chain, since custom modules have no manifest
-- array position to fall back on).
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Additive and safe to run on a live portal — only adds one nullable
-- column. Existing rows are unaffected (sort_order stays NULL until
-- an admin reorders modules via the admin panel).
-- ============================================================

ALTER TABLE public.module_config
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- ============================================================
-- DONE.
-- ============================================================
