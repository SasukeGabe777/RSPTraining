-- RSP Training Portal — Migration v8
-- Adds quiz attempt tracking columns to the progress table.
-- Run this in the Supabase SQL Editor after migration v7.

ALTER TABLE public.progress
  ADD COLUMN IF NOT EXISTS attempts       INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_pct       INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attempt_history JSONB   DEFAULT '[]'::jsonb;
