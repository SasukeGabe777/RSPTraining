-- ============================================================
-- RSP TRAINING PORTAL — MIGRATION V9
-- Multi-hub support (New Employee Onboarding + Product Training Mastery)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Additive and safe to run on a live portal:
--   - Both new columns default to 'product_mastery', so every existing
--     module_config / progress row backfills automatically. No data is
--     changed, deleted, or reset.
--   - Nothing here touches users, kudos, presence, manual_grants, or the
--     scaffolded tier_settings / badge_definitions tables.
-- ============================================================

ALTER TABLE public.module_config
  ADD COLUMN IF NOT EXISTS hub TEXT DEFAULT 'product_mastery';

ALTER TABLE public.progress
  ADD COLUMN IF NOT EXISTS hub TEXT DEFAULT 'product_mastery';

CREATE INDEX IF NOT EXISTS module_config_hub_idx ON public.module_config (hub);
CREATE INDEX IF NOT EXISTS progress_hub_idx       ON public.progress (hub);

-- ============================================================
-- DONE. Existing rows are now hub = 'product_mastery'. New onboarding
-- content (created via the admin panel's hub picker, or synced from
-- onboarding module progress) will write hub = 'onboarding' going forward.
-- ============================================================
