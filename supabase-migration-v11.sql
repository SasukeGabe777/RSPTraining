-- ============================================================
-- RSP TRAINING PORTAL — MIGRATION V11
-- Learner paths (tags + roles)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Additive and safe to run on a live portal: creates one new table
-- and adds one nullable column to users. No existing row changes.
--
-- A "path" is a named, ordered set of modules that cuts ACROSS hubs.
-- It is a view, not a hub: a module keeps its single home hub, so XP,
-- tiers, and badges still resolve exactly as they did before. A path
-- only ever reports progress over modules it points at.
--
--   show_on_home = true  → renders its own card on the portal home
--                          screen, alongside the hub cards ("tag")
--   is_role      = true  → can be assigned to learners, defining the
--                          modules required of them ("role")
--   sequential   = true  → modules unlock in path order, the way the
--                          Onboarding hub does
--
-- A path may be any combination. "AR Role Path" is typically all three.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.paths (
  id            TEXT PRIMARY KEY,               -- slug, e.g. 'ar-role-path'
  label         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT    DEFAULT '🎯',
  accent        TEXT    DEFAULT '#8B5CF6',
  is_role       BOOLEAN DEFAULT FALSE,
  show_on_home  BOOLEAN DEFAULT TRUE,
  sequential    BOOLEAN DEFAULT FALSE,
  sort_order    INTEGER,
  module_ids    JSONB   DEFAULT '[]'::jsonb,    -- ordered array of module ids
  updated_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS paths_sort_idx ON public.paths (sort_order);
CREATE INDEX IF NOT EXISTS paths_role_idx ON public.paths (is_role);

-- ── Learner role assignment ──
-- Array of path ids, e.g. ["ar-role-path","ops-role-path"]. A learner may
-- hold several roles; their required module set is the union of those paths.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '[]'::jsonb;

-- ── RLS — same permissive anon model as every other table here ──
ALTER TABLE public.paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paths anon read"  ON public.paths;
DROP POLICY IF EXISTS "paths anon write" ON public.paths;

CREATE POLICY "paths anon read"  ON public.paths FOR SELECT USING (true);
CREATE POLICY "paths anon write" ON public.paths FOR ALL    USING (true) WITH CHECK (true);

-- ── Default roles ──
-- Created empty (no modules yet) so they appear in the admin panel ready to
-- fill. They stay off the home screen until an admin adds modules and flips
-- show_on_home. Safe to re-run: existing rows are left untouched.
INSERT INTO public.paths (id, label, description, icon, accent, is_role, show_on_home, sequential, sort_order)
VALUES
  ('sdr-role-path',   'SDR Path',   'Training required for Sales Development Representatives.', '📞', '#EC4899', TRUE, FALSE, TRUE, 10),
  ('ar-role-path',    'AR Path',    'Training required for Account Representatives.',           '🤝', '#A855F7', TRUE, FALSE, TRUE, 20),
  ('ops-role-path',   'OPS Path',   'Training required for Operations.',                        '📦', '#22C55E', TRUE, FALSE, TRUE, 30),
  ('admin-role-path', 'Admin Path', 'Training required for administrative staff.',              '🛡️', '#38BDF8', TRUE, FALSE, TRUE, 40)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DONE.
--   public.paths holds every tag/role; users.roles holds assignments.
-- ============================================================
