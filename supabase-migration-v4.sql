-- ============================================================
-- RSP TRAINING PORTAL — MIGRATION V4
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.module_config (
  module_id   TEXT PRIMARY KEY,
  embed_url   TEXT,          -- Flipsnack src URL
  codeword    TEXT,          -- Quiz unlock word (null = no gate)
  quiz_bank   JSONB,         -- Question array uploaded from Excel/CSV
  xp          INTEGER,       -- XP override (null = use manifest value)
  pass_pct    INTEGER,       -- Pass % override (null = use manifest value)
  published   BOOLEAN,       -- Published override (null = use manifest value)
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.module_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "module_config anon read"  ON public.module_config;
DROP POLICY IF EXISTS "module_config anon write" ON public.module_config;

CREATE POLICY "module_config anon read"
  ON public.module_config FOR SELECT USING (true);

CREATE POLICY "module_config anon write"
  ON public.module_config FOR ALL USING (true);

-- ============================================================
-- DONE. One table handles all live module config.
-- ============================================================
