-- ============================================================
-- RSP TRAINING PORTAL — MIGRATION V12
-- Lock down the public (anon) key
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- ⚠ READ THIS FIRST — this migration changes who can do what.
--
-- WHY
-- The anon key is embedded in browser JavaScript and is therefore public by
-- design; anyone who views source on the deployed site has it. That is fine
-- ONLY if row-level security constrains what the key can do. Until now every
-- table carried `FOR ALL USING (true) WITH CHECK (true)`, so that public key
-- could read every learner record, rewrite quiz banks and codewords, and
-- delete every row in the database.
--
-- WHAT CHANGES
-- Tracing every call the client makes shows learners never need DELETE — not
-- once — and never write module_config or paths. So anon is reduced to
-- exactly the learner surface:
--
--   users          SELECT (safe columns), INSERT, UPDATE (safe columns)
--   progress       SELECT, INSERT, UPDATE
--   kudos          SELECT, INSERT
--   presence       SELECT, INSERT, UPDATE
--   module_config  SELECT only
--   paths          SELECT only
--   manual_grants  SELECT only
--   tier_settings  SELECT only
--   badge_defs     SELECT only
--   storage        SELECT only (page images stay publicly readable)
--
-- DELETE is granted on nothing. Data loss via the public key becomes
-- impossible, and quiz banks / codewords / module config become read-only.
--
-- AFTER RUNNING THIS, THE ADMIN DASHBOARD NEEDS ITS SERVICE-ROLE KEY.
-- admin.html prompts for it once per session and keeps it in memory only.
-- Get it from: Project Settings → API → service_role. Treat it like a
-- password: it bypasses every policy below. Never commit it, never paste it
-- into a shared machine.
--
-- WHAT THIS DOES NOT FIX (no identity = no per-learner scoping)
--   • Learner names and XP stay readable by anyone with the anon key. The
--     Team leaderboard needs that, and without login there is no way to tell
--     a learner reading their own row from someone reading everyone's.
--   • A learner can still write progress rows under another name, or grant
--     themselves tiers/badges. Fixing that requires Supabase Auth.
--   • A quiz in progress still has its answers in the browser, because
--     grading is client-side. This migration stops bulk-downloading every
--     module's answer key, but not that. Server-side grading is the fix.
--
-- ROLLBACK: re-run supabase-setup.sql, which restores the permissive
-- "anon-all" policies.
-- ============================================================

-- ── 1. Drop the blanket policies ──
DROP POLICY IF EXISTS "anon-all" ON public.users;
DROP POLICY IF EXISTS "anon-all" ON public.progress;
DROP POLICY IF EXISTS "anon-all" ON public.kudos;
DROP POLICY IF EXISTS "anon-all" ON public.presence;
DROP POLICY IF EXISTS "anon-all" ON public.tier_settings;
DROP POLICY IF EXISTS "anon-all" ON public.badge_definitions;
DROP POLICY IF EXISTS "anon-all" ON public.manual_grants;
DROP POLICY IF EXISTS "module_config anon read"  ON public.module_config;
DROP POLICY IF EXISTS "module_config anon write" ON public.module_config;
DROP POLICY IF EXISTS "paths anon read"  ON public.paths;
DROP POLICY IF EXISTS "paths anon write" ON public.paths;

-- Make sure RLS is on everywhere (a table with RLS off ignores policies).
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kudos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paths             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_grants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;

-- ── 2. Reset anon table privileges to nothing ──
-- Privileges and policies are independent gates: a request must pass BOTH.
-- Starting from zero means anything not granted below is denied.
REVOKE ALL ON public.users             FROM anon;
REVOKE ALL ON public.progress          FROM anon;
REVOKE ALL ON public.kudos             FROM anon;
REVOKE ALL ON public.presence          FROM anon;
REVOKE ALL ON public.module_config     FROM anon;
REVOKE ALL ON public.paths             FROM anon;
REVOKE ALL ON public.manual_grants     FROM anon;
REVOKE ALL ON public.tier_settings     FROM anon;
REVOKE ALL ON public.badge_definitions FROM anon;

-- ── 3. users ──
-- employee_id, notes and status are administrative and stay hidden from the
-- public key. The client reads explicit column lists (see cloud.js), so a
-- narrowed grant does not break `select=*`.
GRANT SELECT (id, name, avatar, started_at, last_active, created_at,
              earned_tiers, earned_badges, roles)            ON public.users TO anon;
-- Login upserts a row; the merge-duplicates path needs UPDATE on what it sends.
GRANT INSERT (name, avatar, started_at, last_active)         ON public.users TO anon;
-- Badge/tier ratchet writes back after a quiz. `roles` is deliberately absent:
-- a learner must not be able to assign themselves a role path.
GRANT UPDATE (avatar, last_active, earned_tiers, earned_badges) ON public.users TO anon;

CREATE POLICY "users anon select" ON public.users FOR SELECT TO anon USING (true);
CREATE POLICY "users anon insert" ON public.users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "users anon update" ON public.users FOR UPDATE TO anon USING (true) WITH CHECK (true);
-- No DELETE policy and no DELETE grant → learner deletion is impossible.

-- ── 4. progress ──
GRANT SELECT, INSERT, UPDATE ON public.progress TO anon;
CREATE POLICY "progress anon select" ON public.progress FOR SELECT TO anon USING (true);
CREATE POLICY "progress anon insert" ON public.progress FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "progress anon update" ON public.progress FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── 5. kudos ── append-only: written once, never edited or removed
GRANT SELECT, INSERT ON public.kudos TO anon;
CREATE POLICY "kudos anon select" ON public.kudos FOR SELECT TO anon USING (true);
CREATE POLICY "kudos anon insert" ON public.kudos FOR INSERT TO anon WITH CHECK (true);

-- ── 6. presence ── heartbeat upsert, rows expire by staleness not deletion
GRANT SELECT, INSERT, UPDATE ON public.presence TO anon;
CREATE POLICY "presence anon select" ON public.presence FOR SELECT TO anon USING (true);
CREATE POLICY "presence anon insert" ON public.presence FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "presence anon update" ON public.presence FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── 7. Read-only reference data ──
-- module_config holds quiz banks, answer keys, codewords and publish flags.
-- Read-only for anon is what stops a learner rewriting a quiz or unpublishing
-- a module. Admin edits go through the service-role key.
GRANT SELECT ON public.module_config     TO anon;
GRANT SELECT ON public.paths             TO anon;
GRANT SELECT ON public.manual_grants     TO anon;
GRANT SELECT ON public.tier_settings     TO anon;
GRANT SELECT ON public.badge_definitions TO anon;

CREATE POLICY "module_config anon select"     ON public.module_config     FOR SELECT TO anon USING (true);
CREATE POLICY "paths anon select"             ON public.paths             FOR SELECT TO anon USING (true);
CREATE POLICY "manual_grants anon select"     ON public.manual_grants     FOR SELECT TO anon USING (true);
CREATE POLICY "tier_settings anon select"     ON public.tier_settings     FOR SELECT TO anon USING (true);
CREATE POLICY "badge_definitions anon select" ON public.badge_definitions FOR SELECT TO anon USING (true);

-- ── 8. Storage — flipbook page images ──
-- Public read stays (employees load page images with no auth round-trip);
-- uploading and deleting become service-role only.
DROP POLICY IF EXISTS "flipbooks anon read"   ON storage.objects;
DROP POLICY IF EXISTS "flipbooks anon insert" ON storage.objects;
DROP POLICY IF EXISTS "flipbooks anon update" ON storage.objects;
DROP POLICY IF EXISTS "flipbooks anon delete" ON storage.objects;

CREATE POLICY "flipbooks public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'training-flipbooks');
-- No anon insert/update/delete policy → uploads require the service role.

-- ── 9. Verify ──
-- Should list SELECT-only for anon on module_config/paths, and no DELETE
-- anywhere. Run tests/rls-verify.js afterwards for an end-to-end check.
SELECT table_name, string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS anon_privileges
FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;

-- ============================================================
-- DONE. The public key can no longer delete anything, and can no longer
-- modify quizzes, codewords, module config, or learner paths.
-- Next: open admin.html and paste the service_role key when prompted.
-- ============================================================
