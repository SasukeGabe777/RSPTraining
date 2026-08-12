/**
 * RSP TRAINING PORTAL — BADGES, MASTERY TIERS & RATCHET LOGIC
 * ============================================================
 * "Earned status is permanent." Once a rep hits a tier or badge,
 * they keep it forever — even if you publish more modules later
 * or tweak the thresholds.
 *
 * Both the per-page UIs and the cloud sync layer read from this file.
 */

// ============================================================
// MASTERY TIERS — absolute XP thresholds against expected curriculum
// ============================================================
// Sized for ~63 modules averaging ~400 XP each (~25-30K total possible).
// You can tune these here without breaking anything: nobody loses
// a tier they've already earned (see ratchet below).
window.RSP_TIERS = [
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
];

// ============================================================
// RATCHET HELPERS — the heart of "never lose status"
// ============================================================

/**
 * Returns all tiers a learner has CURRENTLY earned by XP threshold.
 * Used to detect newly-crossed thresholds for awarding.
 */
window.tiersByThreshold = function(lifetimeXP){
  return window.RSP_TIERS.filter(t => lifetimeXP >= t.minXP);
};

/**
 * Returns the tier objects a user has EVER earned (including ratcheted ones).
 * Reads from the user record's earned_tiers array.
 */
window.tiersFromRecord = function(earnedTiers){
  if(!earnedTiers || !earnedTiers.length) return [];
  const ids = new Set(earnedTiers.map(e => e.tier_id || e));
  return window.RSP_TIERS.filter(t => ids.has(t.id));
};

/**
 * Returns the highest tier the learner has earned (the ratchet floor).
 * Combines threshold-based earnings + locked-in earnings.
 */
window.highestTier = function(lifetimeXP, earnedTiers){
  const byThreshold = window.tiersByThreshold(lifetimeXP);
  const byRecord    = window.tiersFromRecord(earnedTiers);
  const all = [...byThreshold, ...byRecord];
  if(!all.length) return null;
  // Highest minXP wins
  return all.reduce((a,b) => a.minXP >= b.minXP ? a : b);
};

/**
 * Main display helper used by Mastery + portal UI.
 * Returns the rep's current displayed tier, the next tier to chase,
 * and how much XP they need to reach it.
 */
window.computeTier = function(lifetimeXP, earnedTiers){
  const current = window.highestTier(lifetimeXP, earnedTiers);
  let next = null, toNext = 0;
  if(current){
    const idx = window.RSP_TIERS.indexOf(current);
    next = window.RSP_TIERS[idx + 1] || null;
  } else {
    next = window.RSP_TIERS[0];
  }
  if(next){
    toNext = Math.max(0, next.minXP - lifetimeXP);
  }
  return { current, next, toNext, lifetimeXP };
};

/**
 * Detect newly-crossed tier thresholds that aren't yet locked in.
 * Returns the array of tier objects that should be awarded now.
 */
window.pendingTierAwards = function(lifetimeXP, earnedTiers){
  const earnedIds = new Set((earnedTiers || []).map(e => e.tier_id || e));
  return window.tiersByThreshold(lifetimeXP).filter(t => !earnedIds.has(t.id));
};

// ============================================================
// SPECIAL ACHIEVEMENT BADGES
// ============================================================
// These are evaluated against a learner record. Once earned, they
// get appended to the user's earned_badges array and never leave.
window.RSP_SPECIAL_BADGES = [
  {
    id: "first-step", icon: "👣", name: "First Step",
    desc: "Completed your first module.",
    check: (l, manifest) => Object.values(l.modules || {}).some(m => m.completedAt)
  },
  {
    id: "perfectionist", icon: "💯", name: "Perfectionist",
    desc: "Scored 40/40 on any module's final boss.",
    check: (l, manifest) => Object.values(l.modules || {}).some(m => m.correct === 40)
  },
  {
    id: "speedrunner", icon: "🏃", name: "Speedrunner",
    desc: "Finished a module in under 60 minutes.",
    check: (l, manifest) => Object.values(l.modules || {}).some(m => {
      if(!m.completedAt || !l.startedAt) return false;
      return (m.completedAt - l.startedAt) < 60 * 60 * 1000;
    })
  },
  {
    id: "boss-slayer", icon: "⚔️", name: "Boss Slayer",
    desc: "Defeated 5 mini-bosses across all modules.",
    check: (l, manifest) => {
      let total = 0;
      Object.values(l.modules || {}).forEach(m => {
        total += Object.keys(m.bossesDefeated || {}).length;
      });
      return total >= 5;
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
    check: (l, manifest) => {
      const published = manifest.modules.filter(x => x.published);
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
];

// ============================================================
// BADGE COMPUTATION
// ============================================================

/**
 * The list of badges this learner is currently entitled to (per their data),
 * including module-mastery and special achievements.
 * NOT the same as `earnedBadges` from the user record — this is what
 * SHOULD be earned right now. Compare against earned_badges to find
 * pending awards.
 */
window.entitledBadges = function(learner, manifest){
  const out = [];
  // Module mastery
  manifest.modules.forEach(mod => {
    const m = (learner.modules || {})[mod.id];
    if(m && m.tier === "gold"){
      out.push({
        id: "module-" + mod.id,
        category: "module",
        icon: mod.icon,
        name: mod.name + " — Mastery",
        desc: "Earned by scoring 32+ on " + mod.name + "."
      });
    }
  });
  // Special achievements
  window.RSP_SPECIAL_BADGES.forEach(b => {
    if(b.check(learner, manifest)) out.push({ ...b, category: "special" });
  });
  // Tier badges (one per tier ever crossed by threshold)
  const lifetimeXP = Object.values(learner.modules || {}).reduce((s,m) => s + (m.totalXP || 0), 0);
  window.tiersByThreshold(lifetimeXP).forEach(t => {
    out.push({
      id: "tier-" + t.id,
      category: "tier",
      icon: t.icon,
      name: t.name + " Tier",
      desc: t.blurb
    });
  });
  return out;
};

/**
 * Detect newly-earned badges that aren't yet in earned_badges.
 * Returns the array of badge objects to award now.
 */
window.pendingBadgeAwards = function(learner, manifest, earnedBadges){
  const earnedIds = new Set((earnedBadges || []).map(e => e.badge_id || e));
  return window.entitledBadges(learner, manifest).filter(b => !earnedIds.has(b.id));
};

/**
 * The full list of badges a user OWNS (earned + locked-in).
 * Reads from the user's earned_badges record. Falls back to
 * computed entitlement for users who haven't synced yet.
 */
window.badgesOwnedBy = function(learner, manifest, earnedBadges){
  if(earnedBadges && earnedBadges.length){
    const earnedIds = new Set(earnedBadges.map(e => e.badge_id || e));
    // Hydrate IDs into full badge objects (special, tier, or module)
    const all = window.entitledBadges(learner, manifest);
    const allMap = {};
    all.forEach(b => allMap[b.id] = b);
    // Also include any earned_badges that aren't in current entitled (e.g. legacy badges)
    const owned = [];
    earnedIds.forEach(id => {
      if(allMap[id]) owned.push(allMap[id]);
      else owned.push({ id: id, icon: '🏅', name: id, desc: 'Legacy badge', category: 'legacy' });
    });
    return owned;
  }
  // No record yet — fall back to computed entitlement
  return window.entitledBadges(learner, manifest);
};
