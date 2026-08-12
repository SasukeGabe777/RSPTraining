-- RSP Training Portal — Migration v7
-- Adds module_meta column to support dynamically created modules from the admin panel.
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.module_config
  ADD COLUMN IF NOT EXISTS module_meta JSONB;
