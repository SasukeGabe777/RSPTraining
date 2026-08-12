/**
 * RSP TRAINING PORTAL — LEARNER PATHS (TAGS & ROLES)
 * ============================================================
 * A path is a named, ordered set of modules that cuts ACROSS hubs.
 *
 * A path is a VIEW, never a hub. Each module keeps exactly one home hub,
 * which is what scopes XP, tiers, and badges (see badges.js). A path only
 * reports progress over the modules it points at, so putting a module in
 * five paths never multiplies the XP it is worth. This is the invariant
 * that keeps the mastery ladders honest — do not give paths their own XP.
 *
 * Three independent switches decide how a path behaves:
 *   show_on_home  renders a card on the portal home screen  ("tag")
 *   is_role       can be assigned to learners                ("role")
 *   sequential    modules unlock in path order
 *
 * Requires supabase-migration-v11.sql.
 * ============================================================
 */
(function(){

  const CACHE_KEY = 'rsp_paths_v1';

  // ============================================================
  // CACHE — last-known-good, mirroring the module_config cache.
  // A transient outage must never make a learner's assigned path
  // vanish, so we always paint from cache first.
  // ============================================================

  function readCache(){
    try{
      const raw = localStorage.getItem(CACHE_KEY);
      const cached = raw ? JSON.parse(raw) : null;
      const rows = Array.isArray(cached) ? cached : (cached && cached.rows);
      return Array.isArray(rows) ? rows.filter(function(row){ return row && row.id; }) : [];
    }catch(e){ return []; }
  }

  function cachePaths(rows){
    if(!Array.isArray(rows)) return readCache();
    try{
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rows: rows }));
    }catch(e){}
    return rows.filter(function(row){ return row && row.id; });
  }

  /**
   * Fetch every path with retries, returning the row array. Rejects rather
   * than resolving empty on failure so callers keep their cached copy.
   * An empty response is only treated as suspect when we know rows existed.
   */
  async function loadPaths(opts){
    opts = opts || {};
    const attempts = opts.attempts || 3;
    const known = Array.isArray(opts.current) ? opts.current.length : 0;
    let lastError = null;
    for(let attempt = 0; attempt < attempts; attempt++){
      try{
        const rows = await window.RSPCloud.listPaths();
        if(!Array.isArray(rows)) throw new Error('Unexpected path response');
        if(rows.length === 0 && known > 0) throw new Error('Path response was unexpectedly empty');
        return cachePaths(rows);
      }catch(e){
        lastError = e;
        if(attempt < attempts - 1) await new Promise(function(r){ setTimeout(r, 300 * (attempt + 1)); });
      }
    }
    throw lastError || new Error('Paths could not be loaded');
  }

  // ============================================================
  // SORTING & LOOKUP
  // ============================================================

  function sortPaths(paths){
    return (paths || []).slice().sort(function(a, b){
      const sa = a.sort_order == null ? Number.MAX_SAFE_INTEGER : Number(a.sort_order);
      const sb = b.sort_order == null ? Number.MAX_SAFE_INTEGER : Number(b.sort_order);
      if(sa !== sb) return sa - sb;
      return String(a.label || a.id).localeCompare(String(b.label || b.id));
    });
  }

  function findPath(paths, pathId){
    return (paths || []).find(function(p){ return p && p.id === pathId; }) || null;
  }

  function moduleIds(path){
    return (path && Array.isArray(path.module_ids)) ? path.module_ids.filter(Boolean) : [];
  }

  // ============================================================
  // RESOLUTION
  // ============================================================

  /**
   * Turn a path's stored module_ids into real module objects, in path order.
   *
   * Ids that no longer resolve are reported in `missingIds` rather than
   * silently dropped: a module can be deleted or unpublished long after an
   * admin added it to a path, and a path that quietly shrinks would let a
   * learner "finish" a role they haven't finished. Learner-facing callers
   * show only `modules`; the admin panel surfaces `missingIds` so the stale
   * entry can be cleaned up.
   */
  function resolvePath(path, moduleConfigs, opts){
    opts = opts || {};
    const index = window.RSP_MANIFEST.moduleIndex(moduleConfigs, opts.includeUnpublished);
    const modules = [];
    const missingIds = [];
    const seen = {};
    moduleIds(path).forEach(function(id){
      if(seen[id]) return;              // a module counts once per path
      seen[id] = true;
      if(index[id]) modules.push(index[id]);
      else missingIds.push(id);
    });
    return { path: path, modules: modules, missingIds: missingIds };
  }

  /**
   * Progress for a learner over a resolved path. `learnerModules` is the
   * ledger's `modules` map (all hubs — a path deliberately spans them).
   */
  function pathProgress(resolved, learnerModules){
    const mods = (resolved && resolved.modules) || [];
    const progressMap = learnerModules || {};
    let completed = 0;
    let earnedXP = 0;
    let availableXP = 0;
    let nextModule = null;
    mods.forEach(function(mod){
      const record = progressMap[mod.id];
      availableXP += Number(mod.xp || 0);
      if(record && record.completedAt){
        completed++;
        earnedXP += Number(record.totalXP || 0);
      } else if(!nextModule){
        nextModule = mod;
      }
    });
    const total = mods.length;
    return {
      total: total,
      completed: completed,
      remaining: total - completed,
      pct: total > 0 ? Math.round(completed / total * 100) : 0,
      earnedXP: earnedXP,
      availableXP: availableXP,
      nextModule: nextModule,
      complete: total > 0 && completed === total
    };
  }

  /**
   * The module that gates `moduleId` within this path, or null.
   *
   * Only applies to sequential paths. This is deliberately additive: a
   * module's own hub prerequisite (see RSP_MANIFEST.effectivePrerequisite)
   * still applies independently, so a path can never UNLOCK something the
   * hub has locked — it can only add a further gate. Callers must honour
   * both.
   */
  function pathPrerequisite(resolved, moduleId){
    const path = resolved && resolved.path;
    if(!path || !path.sequential) return null;
    const mods = resolved.modules || [];
    const idx = mods.findIndex(function(m){ return m.id === moduleId; });
    if(idx <= 0) return null;
    return mods[idx - 1].id;
  }

  /** Is `moduleId` reachable in this path for this learner? */
  function pathLock(resolved, moduleId, learnerModules){
    const prereqId = pathPrerequisite(resolved, moduleId);
    if(!prereqId) return { locked: false };
    const record = (learnerModules || {})[prereqId];
    if(record && record.completedAt) return { locked: false };
    const prereq = (resolved.modules || []).find(function(m){ return m.id === prereqId; });
    return {
      locked: true,
      prerequisiteId: prereqId,
      reason: 'Complete "' + ((prereq && prereq.name) || prereqId) + '" first'
    };
  }

  // ============================================================
  // ROLES
  // ============================================================

  /** Role ids assigned to a user record (local user object or cloud row). */
  function rolesOf(user){
    const raw = user && (user.roles != null ? user.roles : user.role);
    if(Array.isArray(raw)) return raw.filter(Boolean).map(String);
    if(typeof raw === 'string' && raw.trim()) return [raw.trim()];
    return [];
  }

  /** The role paths actually assigned to this user, in display order. */
  function assignedPaths(user, paths){
    const ids = rolesOf(user);
    if(!ids.length) return [];
    return sortPaths((paths || []).filter(function(p){
      return p && p.is_role && ids.indexOf(p.id) !== -1;
    }));
  }

  /**
   * Union of every module id required of this learner by their roles.
   * Multiple roles are additive — someone who is both AR and OPS must
   * complete both paths.
   */
  function requiredModuleIds(user, paths){
    const required = {};
    assignedPaths(user, paths).forEach(function(path){
      moduleIds(path).forEach(function(id){ required[id] = true; });
    });
    return required;
  }

  function isRequiredFor(moduleId, user, paths){
    return !!requiredModuleIds(user, paths)[moduleId];
  }

  /** Paths that earn a card on the home screen. */
  function homePaths(paths){
    return sortPaths((paths || []).filter(function(p){ return p && p.show_on_home; }));
  }

  /** A stable slug for a new path, derived from its label. */
  function slugify(label){
    const base = String(label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    return base || ('path-' + Math.random().toString(36).slice(2, 8));
  }

  function uniqueSlug(label, paths){
    const base = slugify(label);
    const taken = {};
    (paths || []).forEach(function(p){ if(p && p.id) taken[p.id] = true; });
    if(!taken[base]) return base;
    for(let n = 2; n < 500; n++){
      if(!taken[base + '-' + n]) return base + '-' + n;
    }
    return base + '-' + Math.random().toString(36).slice(2, 6);
  }

  window.RSPPaths = {
    cacheKey: CACHE_KEY,
    readCache: readCache,
    cachePaths: cachePaths,
    loadPaths: loadPaths,
    sortPaths: sortPaths,
    findPath: findPath,
    moduleIds: moduleIds,
    resolvePath: resolvePath,
    pathProgress: pathProgress,
    pathPrerequisite: pathPrerequisite,
    pathLock: pathLock,
    rolesOf: rolesOf,
    assignedPaths: assignedPaths,
    requiredModuleIds: requiredModuleIds,
    isRequiredFor: isRequiredFor,
    homePaths: homePaths,
    slugify: slugify,
    uniqueSlug: uniqueSlug
  };
})();
