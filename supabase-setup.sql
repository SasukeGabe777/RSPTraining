-- ============================================================
-- RSP TRAINING PORTAL — SUPABASE SCHEMA
-- ============================================================
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query
-- It creates 4 tables, indexes, and RLS policies.
-- Safe to re-run: each statement uses IF NOT EXISTS where possible.
-- ============================================================

-- ====== USERS ======================================================
-- One row per learner. Identified by their (case-sensitive) name.
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  employee_id  TEXT,
  avatar       TEXT DEFAULT 'sparky',
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  last_active  TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_last_active_idx ON public.users (last_active DESC);

-- ====== PROGRESS ===================================================
-- One row per (user, module). Stores all per-module training data.
CREATE TABLE IF NOT EXISTS public.progress (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name             TEXT NOT NULL,
  module_id             TEXT NOT NULL,
  module_name           TEXT,
  module_icon           TEXT,
  answered              JSONB DEFAULT '{}'::jsonb,
  correct               INT  DEFAULT 0,
  total                 INT  DEFAULT 0,
  viewed_pages          JSONB DEFAULT '[]'::jsonb,
  bosses_defeated       JSONB DEFAULT '{}'::jsonb,
  total_xp              INT  DEFAULT 0,
  tier                  TEXT,
  completed_at          TIMESTAMPTZ,
  last_update           TIMESTAMPTZ DEFAULT NOW(),
  submitted_to_webhook  BOOLEAN DEFAULT FALSE,
  UNIQUE(user_name, module_id)
);

CREATE INDEX IF NOT EXISTS progress_user_idx     ON public.progress (user_name);
CREATE INDEX IF NOT EXISTS progress_module_idx   ON public.progress (module_id);
CREATE INDEX IF NOT EXISTS progress_completed_idx ON public.progress (completed_at);

-- ====== KUDOS ======================================================
-- Recognition messages between learners.
CREATE TABLE IF NOT EXISTS public.kudos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user    TEXT NOT NULL,
  to_user      TEXT NOT NULL,
  module_id    TEXT,
  message      TEXT,
  emoji        TEXT DEFAULT '🎉',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kudos_to_idx       ON public.kudos (to_user);
CREATE INDEX IF NOT EXISTS kudos_created_idx  ON public.kudos (created_at DESC);

-- ====== PRESENCE ===================================================
-- Real-time "currently working on this module" indicator.
-- One row per user; updated every ~30s by the active module page.
CREATE TABLE IF NOT EXISTS public.presence (
  user_name    TEXT PRIMARY KEY,
  module_id    TEXT,
  last_ping    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS presence_module_idx ON public.presence (module_id);
CREATE INDEX IF NOT EXISTS presence_ping_idx   ON public.presence (last_ping DESC);

-- ====== ROW LEVEL SECURITY =========================================
-- Internal honor-system portal: anonymous users get full read/write.
-- The anon key is required to access, so this is "anyone with the
-- portal URL can use it." For stricter security, replace with auth-based
-- policies in a follow-up.

ALTER TABLE public.users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kudos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;

-- Drop old policies if rerunning
DROP POLICY IF EXISTS "anon-all" ON public.users;
DROP POLICY IF EXISTS "anon-all" ON public.progress;
DROP POLICY IF EXISTS "anon-all" ON public.kudos;
DROP POLICY IF EXISTS "anon-all" ON public.presence;

CREATE POLICY "anon-all" ON public.users    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon-all" ON public.progress FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon-all" ON public.kudos    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon-all" ON public.presence FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- DONE — you should see "Success. No rows returned."
-- Now go to Project Settings → API to get your URL + anon key.
-- ============================================================
