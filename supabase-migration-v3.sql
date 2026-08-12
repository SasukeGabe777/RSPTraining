-- ============================================================
-- RSP TRAINING PORTAL — MIGRATION V3
-- "Admin power tools" — user status, profile data
-- ============================================================
-- Run this in Supabase → SQL Editor → New query.
-- Adds a `status` column to users (Active / On Leave / Trainer / Inactive / Terminated).
-- Safe to re-run.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
-- Allowed values (admin-managed): 'active', 'on_leave', 'trainer', 'inactive', 'terminated'

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS users_status_idx ON public.users (status);

-- ============================================================
-- DONE.
-- ============================================================
