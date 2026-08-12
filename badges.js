/**
 * RSP TRAINING PORTAL — BADGES, MASTERY TIERS & RATCHET LOGIC
 * ============================================================
 * "Earned status is permanent." Once a rep hits a tier or badge,
 * they keep it forever — even if you publish more modules later
 * or tweak the thresholds.
 *
 * Tiers and badges are namespaced by training hub (see RSP_HUBS in
 * manifest.js) so New Employee Onboarding and Product Training Mastery
 * never share XP, tiers, or achievements. Every helper below takes a
 * leading `hub` argument; omit it and it defaults to "product_mastery"
 * so any pre-existing data (earned before hubs existed) keeps resolving
 * exactly as it did before this file was split by hub.
 *
 * Both the per-page UIs and the cloud sync layer read from this file.
 */

// ============================================================
// HUB-SCOPING HELPERS
// ============================================================

// An earned_tiers / earned_badges record entry may predate the hub
// field entirely — treat that as Product Mastery (the only hub that
// existed when those records were written).
function entryHub(e){ return (e && e.hub) || "product_mastery"; }

function resolveHub(hub){ return hub || "product_mastery"; }

/**
 * Slice a learner's `modules` map down to just the modules that belong
 * to `hub`. `moduleConfigs` (from RSPCloud.getAllModuleConfigs) is
 * optional but needed to correctly attribute admin-created custom
 * modules that aren't in the static manifest.
 */
window.hubScopedModules = function(hub, learnerModules, moduleConfigs){
  hub = resolveHub(hub);
  const out = {};
  Object.keys(learnerModules || {}).forEach(id => {
    const record = learnerModules[id] || {};
    // Progress rows persist their hub. Prefer that durable attribution for
    // custom modules so deleting/moving configuration cannot silently shift
    // a learner's already-earned XP into Product Mastery.
    const recordHub = record.hub || window.RSP_MANIFEST.hubOf(id, moduleConfigs);
    if(recordHub === hub) out[id] = record;
  });
  return out;
};

window.hubScopedXP = function(hub, learnerModules, moduleConfigs){
  const scoped = window.hubScopedModules(hub, learnerModules, moduleConfigs);
  return Object.values(scoped).reduce((s, m) => s + (m.totalXP || 0), 0);
};

// ============================================================
// MASTERY TIERS — absolute XP thresholds against expected curriculum
// ============================================================
// Product Mastery is sized for ~63 modules averaging ~400 XP each
// (~25-30K total possible). Onboarding is a much shorter track, so its
// ladder is scaled down accordingly. You can tune either ladder here
// without breaking anything: nobody loses a tier they've already
// earned (see the ratchet helpers below).
window.RSP_TIERS = {
  product_mastery: [
    { id: "bronze",    name: "Bronze",    icon: "🥉",  minXP: 250,    color: "#CD7F32",
      blurb: "First steps. You've earned your stripes." },
    { id: "silver",    name: "Silver",    icon: "🥈",  minXP: 1500,   color: "#C0C0C0",
      blurb: "Building momentum. The tools are starting to feel familiar." },
    { id: "gold",      name: "Gold",      icon: "🥇",  minXP: 5000,   color: "#FACC15",
      blurb: "Real fluency. You can hold your own on most calls." },
    { id: "platinum",  name: "Platinum",  icon: "💎",  minXP: 12000,  color: "#E5E4E2",
      blurb: "Senior-level material. Customers start asking for you specifically." },
    { id: "diamond",   name: "Diamond",   icon: "💠",  minXP: 22000,  color: "#67E8F9",
      blurb: "Top of the standard ranks. Mentor material." },
    { id: "ruby",      name: "Ruby",      icon: "❤️",  minXP: 30000,  color: "#DC2626", extreme: true,
      blurb: "Extreme mastery. A reference point for the rest of the team." },
    { id: "sovereign", name: "Sovereign", icon: "👑",  minXP: 35000,  color: "#9333EA", extreme: true,
      blurb: "Total mastery of the RSP curriculum. The standard everyone aims for." }
  ],
  onboarding: [
    { id: "new-hire",         name: "New Hire",         icon: "👋", minXP: 100,  color: "#38BDF8",
      blurb: "You're in the system. Welcome to RSP." },
    { id: "getting-oriented", name: "Getting Oriented", icon: "🧭", minXP: 500,  color: "#22C55E",
      blurb: "The tools, the systems, the people — it's starting to click." },
    { id: "ramped-up",        name: "Ramped Up",        icon: "🚀", minXP: 1200, color: "#F97316",
      blurb: "You know how things work here. Time to put it to use." },
    { id: "fully-onboarded",  name: "Fully Onboarded",  icon: "🏆", minXP: 2000, color: "#9333EA", extreme: true,
      blurb: "Onboarding complete. You're fully up to speed." }
  ]
};

// ============================================================
// RATCHET HELPERS — the heart of "never lose status"
// ============================================================

/**
 * Returns all tiers a learner has CURRENTLY earned by XP threshold,
 * for the given hub.
 */
window.tiersByThreshold = function(hub, lifetimeXP){
  hub = resolveHub(hub);
  const tiers = window.RSP_TIERS[hub] || [];
  return tiers.filter(t => lifetimeXP >= t.minXP);
};

/**
 * Returns the tier objects a user has EVER earned in this hub
 * (including ratcheted ones). Reads from the user record's
 * earned_tiers array, filtered to entries tagged for this hub.
 */
window.tiersFromRecord = function(hub, earnedTiers){
  hub = resolveHub(hub);
  if(!earnedTiers || !earnedTiers.length) return [];
  const ids = new Set(earnedTiers.filter(e => entryHub(e) === hub).map(e => e.tier_id || e));
  const tiers = window.RSP_TIERS[hub] || [];
  return tiers.filter(t => ids.has(t.id));
};

/**
 * Returns the highest tier the learner has earned in this hub
 * (the ratchet floor). Combines threshold-based earnings + locked-in
 * earnings.
 */
window.highestTier = function(hub, lifetimeXP, earnedTiers){
  hub = resolveHub(hub);
  const byThreshold = window.tiersByThreshold(hub, lifetimeXP);
  const byRecord    = window.tiersFromRecord(hub, earnedTiers);
  const all = [...byThreshold, ...byRecord];
  if(!all.length) return null;
  // Highest minXP wins
  return all.reduce((a,b) => a.minXP >= b.minXP ? a : b);
};

/**
 * Main display helper used by Mastery + hub dashboard UI.
 * Returns the rep's current displayed tier for `hub`, the next tier
 * to chase, and how much XP they need to reach it.
 */
window.computeTier = function(hub, lifetimeXP, earnedTiers){
  hub = resolveHub(hub);
  const tiers = window.RSP_TIERS[hub] || [];
  const current = window.highestTier(hub, lifetimeXP, earnedTiers);
  let next = null, toNext = 0;
  if(current){
    const idx = tiers.indexOf(current);
    next = tiers[idx + 1] || null;
  } else {
    next = tiers[0] || null;
  }
  if(next){
    toNext = Math.max(0, next.minXP - lifetimeXP);
  }
  return { current, next, toNext, lifetimeXP };
};

/**
 * Detect newly-crossed tier thresholds in this hub that aren't yet
 * locked in. Returns the array of tier objects that should be awarded
 * now (each carries the hub they belong to for the caller to persist).
 */
window.pendingTierAwards = function(hub, lifetimeXP, earnedTiers){
  hub = resolveHub(hub);
  const earnedIds = new Set((earnedTiers || []).filter(e => entryHub(e) === hub).map(e => e.tier_id || e));
  return window.tiersByThreshold(hub, lifetimeXP)
    .filter(t => !earnedIds.has(t.id))
    .map(t => Object.assign({}, t, { hub }));
};

// ============================================================
// SPECIAL ACHIEVEMENT BADGES
// ============================================================
// These are evaluated against a hub-scoped learner record (i.e. `l.modules`
// already contains only that hub's modules by the time `check` runs — see
// entitledBadges below). Once earned, they get appended to the user's
// earned_badges array (tagged with hub) and never leave.
window.RSP_SPECIAL_BADGES = {
  product_mastery: [
    {
      id: "first-step", icon: "👣", name: "First Step",
      desc: "Completed your first module.",
      check: (l, manifest) => Object.values(l.modules || {}).some(m => m.completedAt)
    },
    {
      // Retargeted from the retired v1 boss fight (which scored out of 40) to
      // the current assessment flow, where banks vary from 12 to 35 questions.
      id: "perfectionist", icon: "💯", name: "Perfectionist",
      desc: "Scored 100% on a module assessment.",
      check: (l, manifest) => Object.values(l.modules || {}).some(m => m.total > 0 && m.correct === m.total)
    },
    {
      id: "speedrunner", icon: "🏃", name: "Speedrunner",
      desc: "Finished a module in under 60 minutes.",
      check: (l, manifest) => Object.values(l.modules || {}).some(m => {
        if(!m.completedAt) return false;
        // Measure from when this module was opened. Falling back to the account
        // start date would make this "finished your first module within an hour
        // of signing up" — unwinnable for every module after the first.
        // openedAt is device-local, so the account date remains the fallback.
        // Compare against null explicitly: a legitimate timestamp can be 0.
        const startedModule = m.openedAt != null ? m.openedAt : l.startedAt;
        if(startedModule == null) return false;
        return (m.completedAt - startedModule) < 60 * 60 * 1000;
      })
    },
    {
      // Also retargeted: the v1 mini-boss checkpoints no longer exist, so
      // `bossesDefeated` is never written. First-attempt passes are the
      // closest equivalent in the current flow — and still hard to fake.
      id: "boss-slayer", icon: "⚔️", name: "Boss Slayer",
      desc: "Passed 5 module assessments on the first attempt.",
      check: (l, manifest) => {
        let firstTryWins = 0;
        Object.values(l.modules || {}).forEach(m => {
          const first = Array.isArray(m.attemptHistory) ? m.attemptHistory[0] : null;
          if(first && first.passed) firstTryWins++;
        });
        return firstTryWins >= 5;
      }
    },
    {
      id: "trifecta", icon: "🎯", name: "Trifecta",
      desc: "Completed 3 modules with Mastery (32+ score).",
      check: (l, manifest) => {
        const mastered = Object.values(l.modules || {}).filter(m => m.tier === "gold").length;
        return mastered >= 3;
      }
    },
    {
      id: "fully-loaded", icon: "🏆", name: "Fully Loaded",
      desc: "Completed every published module.",
      check: (l, manifest, curriculum) => {
        const published = (curriculum || []).filter(x => x.published);
        const completedIds = Object.keys(l.modules || {}).filter(id => l.modules[id].completedAt);
        return published.length > 0 && published.every(m => completedIds.indexOf(m.id) !== -1);
      }
    },
    {
      id: "the-mentor", icon: "🧑‍🏫", name: "The Mentor",
      desc: "Reached Diamond tier — qualified to coach others.",
      check: (l, manifest) => {
        const lifetimeXP = Object.values(l.modules || {}).reduce((s,m) => s + (m.totalXP || 0), 0);
        return lifetimeXP >= 22000;
      }
    },
    {
      id: "the-sovereign", icon: "👑", name: "Sovereign",
      desc: "Reached the highest tier in RSP training.",
      check: (l, manifest) => {
        const lifetimeXP = Object.values(l.modules || {}).reduce((s,m) => s + (m.totalXP || 0), 0);
        return lifetimeXP >= 35000;
      }
    }
  ],
  onboarding: [
    {
      id: "onboarding-first-step", icon: "👋", name: "Welcome Aboard",
      desc: "Completed your first onboarding module.",
      check: (l, manifest) => Object.values(l.modules || {}).some(m => m.completedAt)
    },
    {
      id: "onboarding-sharp-start", icon: "💯", name: "Sharp Start",
      desc: "Scored a perfect score on an onboarding assessment.",
      check: (l, manifest) => Object.values(l.modules || {}).some(m => m.total > 0 && m.correct === m.total)
    },
    {
      id: "onboarding-fast-starter", icon: "🏃", name: "Fast Starter",
      desc: "Finished an onboarding module in under 60 minutes.",
      check: (l, manifest) => Object.values(l.modules || {}).some(m => {
        if(!m.completedAt || !l.startedAt) return false;
        return (m.completedAt - l.startedAt) < 60 * 60 * 1000;
      })
    },
    {
      id: "onboarding-fully-onboarded", icon: "🎓", name: "Fully Onboarded",
      desc: "Completed every published onboarding module.",
      check: (l, manifest, curriculum) => {
        const published = (curriculum || []).filter(x => x.published);
        const completedIds = Object.keys(l.modules || {}).filter(id => l.modules[id].completedAt);
        return published.length > 0 && published.every(m => completedIds.indexOf(m.id) !== -1);
      }
    },
    {
      id: "onboarding-ramped", icon: "🏆", name: "Ramped Up",
      desc: "Reached the top onboarding tier.",
      check: (l, manifest) => {
        const lifetimeXP = Object.values(l.modules || {}).reduce((s,m) => s + (m.totalXP || 0), 0);
        const tiers = window.RSP_TIERS.onboarding || [];
        const top = tiers[tiers.length - 1];
        return !!top && lifetimeXP >= top.minXP;
      }
    }
  ]
};

// ============================================================
// BADGE COMPUTATION
// ============================================================

/**
 * The list of badges this learner is currently entitled to in `hub`
 * (per their data), including module-mastery and special achievements.
 * NOT the same as `earnedBadges` from the user record — this is what
 * SHOULD be earned right now. Compare against earned_badges to find
 * pending awards.
 *
 * Special-badge `check`s receive the resolved hub curriculum as their
 * third argument. They must use it rather than reading manifest.modules:
 * admin-created modules live only in Supabase module_config, so a hub
 * built entirely from custom modules (Onboarding) is invisible in the
 * static manifest array.
 */
window.entitledBadges = function(hub, learner, manifest, moduleConfigs){
  hub = resolveHub(hub);
  const out = [];
  const hubModules = window.hubScopedModules(hub, learner.modules, moduleConfigs);
  const hubLearner = Object.assign({}, learner, { modules: hubModules });

  // Module mastery
  const curriculum = manifest.hubModulesSorted
    ? manifest.hubModulesSorted(hub, moduleConfigs)
    : manifest.modules.filter(mod => window.RSP_MANIFEST.hubOf(mod.id, moduleConfigs) === hub);
  curriculum.forEach(mod => {
    const m = hubModules[mod.id];
    if(m && m.tier === "gold"){
      out.push({
        id: "module-" + mod.id,
        category: "module",
        icon: mod.icon,
        name: mod.name + " — Mastery",
        desc: "Earned by passing " + mod.name + ".",
        hub
      });
    }
  });

  // Special achievements (hub-scoped catalog, hub-scoped learner data,
  // hub-scoped curriculum — see the note above about custom modules)
  (window.RSP_SPECIAL_BADGES[hub] || []).forEach(b => {
    if(b.check(hubLearner, manifest, curriculum)) out.push(Object.assign({}, b, { category: "special", hub }));
  });

  // Tier badges (one per tier ever crossed by threshold, in this hub)
  const lifetimeXP = Object.values(hubModules).reduce((s,m) => s + (m.totalXP || 0), 0);
  window.tiersByThreshold(hub, lifetimeXP).forEach(t => {
    out.push({
      id: "tier-" + hub + "-" + t.id,
      category: "tier",
      icon: t.icon,
      name: t.name + " Tier",
      desc: t.blurb,
      hub
    });
  });
  return out;
};

/**
 * Detect newly-earned badges in `hub` that aren't yet in earned_badges.
 * Returns the array of badge objects to award now.
 */
window.pendingBadgeAwards = function(hub, learner, manifest, earnedBadges, moduleConfigs){
  hub = resolveHub(hub);
  const earnedIds = new Set((earnedBadges || []).filter(e => entryHub(e) === hub).map(e => e.badge_id || e));
  return window.entitledBadges(hub, learner, manifest, moduleConfigs).filter(b => !earnedIds.has(b.id));
};

/**
 * The full list of badges a user OWNS in `hub` (earned + locked-in).
 * Reads from the user's earned_badges record. Falls back to
 * computed entitlement for users who haven't synced yet.
 */
window.badgesOwnedBy = function(hub, learner, manifest, earnedBadges, moduleConfigs){
  hub = resolveHub(hub);
  const hubEarned = (earnedBadges || []).filter(e => entryHub(e) === hub);
  if(hubEarned.length){
    const earnedIds = new Set(hubEarned.map(e => e.badge_id || e));
    // Hydrate IDs into full badge objects (special, tier, or module)
    const all = window.entitledBadges(hub, learner, manifest, moduleConfigs);
    const allMap = {};
    all.forEach(b => allMap[b.id] = b);
    // Also include any earned_badges that aren't in current entitled (e.g. legacy badges)
    const owned = [];
    earnedIds.forEach(id => {
      if(allMap[id]) owned.push(allMap[id]);
      else owned.push({ id: id, icon: '🏅', name: id, desc: 'Legacy badge', category: 'legacy', hub });
    });
    return owned;
  }
  // No record yet — fall back to computed entitlement
  return window.entitledBadges(hub, learner, manifest, moduleConfigs);
};
