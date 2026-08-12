-- ============================================================
-- RSP TRAINING PORTAL — MIGRATION V2
-- "Earned status is permanent" (the ratchet)
-- ============================================================
-- Run this in Supabase → SQL Editor → New query.
-- Adds two JSONB columns to the users table for permanently locking
-- in tiers and badges once earned. Safe to re-run.
-- ============================================================

-- Add earned_tiers — array of {tier_id, earned_at} objects
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS earned_tiers JSONB DEFAULT '[]'::jsonb;

-- Add earned_badges — array of {badge_id, earned_at} objects
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS earned_badges JSONB DEFAULT '[]'::jsonb;

-- (Future) tier_settings — admin-overridable thresholds.
-- One row per tier_id. If a row exists, it overrides the in-code default.
-- We're not building the admin UI yet, but creating the table now means
-- you can experiment with raw SQL edits today.
CREATE TABLE IF NOT EXISTS public.tier_settings (
  tier_id     TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  min_xp      INT  NOT NULL,
  is_extreme  BOOLEAN DEFAULT FALSE,
  blurb       TEXT,
  color       TEXT,
  display_order INT DEFAULT 0
);

-- (Future) badge_definitions — admin-managed badge catalog.
CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  icon            TEXT,
  category        TEXT DEFAULT 'special',
  unlock_type     TEXT,    -- 'xp' | 'module_complete' | 'tier' | 'manual' | 'event'
  unlock_value    JSONB,   -- depends on type
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- (Future) manual_grants — for "Trainer of the Quarter" style awards
CREATE TABLE IF NOT EXISTS public.manual_grants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name     TEXT NOT NULL,
  badge_id      TEXT NOT NULL,
  granted_by    TEXT,
  message       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for the new tables — same anon-full-access pattern as v1
ALTER TABLE public.tier_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_grants     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon-all" ON public.tier_settings;
DROP POLICY IF EXISTS "anon-all" ON public.badge_definitions;
DROP POLICY IF EXISTS "anon-all" ON public.manual_grants;

CREATE POLICY "anon-all" ON public.tier_settings     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon-all" ON public.badge_definitions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon-all" ON public.manual_grants     FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- DONE. You should see "Success. No rows returned."
-- The portal will detect the new columns automatically; no
-- changes needed in cloud.js for this part.
-- ============================================================
