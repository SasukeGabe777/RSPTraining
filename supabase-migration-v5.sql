-- ============================================================
-- RSP TRAINING PORTAL — MIGRATION V5
-- PDF → flipbook training support
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- This migration is additive and safe to run on a live portal:
--   • it only ADDS a column to module_config (nothing is dropped)
--   • it creates one public Storage bucket for the page images
--   • it adds permissive RLS policies that match the existing
--     honor-system model already used by the rest of the portal
-- ============================================================

-- ── 1. Flipbook metadata column on the existing per-module config table ──
-- We store the whole flipbook record as JSONB so we never need another
-- migration as the shape evolves. Shape written by cloud.js:
--   {
--     "status":      "pending" | "processing" | "ready" | "failed",
--     "pdf_url":     "<public URL of the stored original PDF>",
--     "pdf_name":    "original-file-name.pdf",
--     "page_count":  12,
--     "page_urls":   ["<public URL>", ...],   -- one per page, in order
--     "thumb_urls":  ["<public URL>", ...],   -- small previews (optional)
--     "aspect":      0.773,                    -- width / height of page 1
--     "version":     1718800000000,            -- bump to bust the viewer cache
--     "error":       "<message>",              -- only when status = failed
--     "updated_at":  "2026-06-19T00:00:00.000Z",
--     "updated_by":  "admin"
--   }
ALTER TABLE public.module_config
  ADD COLUMN IF NOT EXISTS flipbook JSONB;

-- ── 2. Public Storage bucket for the generated page images + PDFs ──
-- Public-read so employees can load page images straight from a URL with
-- no auth round-trip (same trust model as the rest of this internal tool).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('training-flipbooks', 'training-flipbooks', true, 78643200) -- 75 MB/object cap
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit;

-- ── 3. RLS policies on storage.objects scoped to this bucket ──
-- Mirrors the permissive anon read/write policies the portal already uses
-- for its data tables. Tighten later if Supabase Auth is added.
DROP POLICY IF EXISTS "flipbooks anon read"   ON storage.objects;
DROP POLICY IF EXISTS "flipbooks anon insert" ON storage.objects;
DROP POLICY IF EXISTS "flipbooks anon update" ON storage.objects;
DROP POLICY IF EXISTS "flipbooks anon delete" ON storage.objects;

CREATE POLICY "flipbooks anon read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'training-flipbooks');

CREATE POLICY "flipbooks anon insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'training-flipbooks');

CREATE POLICY "flipbooks anon update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'training-flipbooks');

CREATE POLICY "flipbooks anon delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'training-flipbooks');

-- ============================================================
-- DONE.
--   module_config.flipbook now holds the flipbook record, and the
--   training-flipbooks bucket holds the original PDF + page images.
-- ============================================================
