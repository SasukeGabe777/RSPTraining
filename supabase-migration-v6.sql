-- ============================================================
-- RSP TRAINING PORTAL — MIGRATION V6
-- Video pages support for the PDF flipbook
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Additive and safe to run on a live portal — only adds one column.
-- ============================================================

-- Stores an array of video page definitions per module:
--   [
--     { "insert_after": 3, "url": "https://www.loom.com/share/...", "title": "Watch before continuing" },
--     { "insert_after": 9, "url": "https://www.loom.com/share/...", "title": "Wiring walkthrough" }
--   ]
ALTER TABLE public.module_config
  ADD COLUMN IF NOT EXISTS video_pages JSONB;

-- ============================================================
-- DONE.
-- ============================================================
