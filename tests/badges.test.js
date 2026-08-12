const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Onboarding's entire curriculum is admin-created: those modules exist only as
// Supabase module_config rows and are never in RSP_MANIFEST.modules. Any badge
// rule that reads the static manifest array therefore sees an empty hub and can
// never fire. These fixtures reproduce that shape offline.
const store = new Map();
const context = {
  URL, console, Date, Set, Math, JSON, Object, Array, Number, String, Promise, setTimeout,
  location: { href: 'https://portal.example/index.html' },
  localStorage: {
    getItem(key){ return store.has(key) ? store.get(key) : null; },
    setItem(key, value){ store.set(key, String(value)); }
  },
  window: {}
};

vm.runInNewContext(fs.readFileSync('manifest.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('badges.js', 'utf8'), context);
const W = context.window;
const manifest = W.RSP_MANIFEST;

// 26 custom onboarding modules (module_meta only — no manifest entry), mirroring
// the live portal, plus config rows for the manifest's product modules.
const rows = [];
for(let i = 0; i < 26; i++){
  rows.push({
    module_id: 'onb' + i,
    hub: 'onboarding',
    sort_order: i * 10,
    published: null,
    quiz_bank: [],
    module_meta: { name: 'Onboarding Lesson ' + (i + 1), icon: '📋', category: 'Company & Culture', xp: 100 }
  });
}
manifest.modules.forEach(function(mod, i){
  rows.push({ module_id: mod.id, hub: 'product_mastery', sort_order: i * 10, published: null });
});
const configs = manifest.cacheModuleConfigs(rows);

const onboarding = manifest.hubModulesSorted('onboarding', configs);
const product = manifest.hubModulesSorted('product_mastery', configs);
assert.equal(onboarding.length, 26, 'all custom onboarding modules resolve into the hub curriculum');
assert.equal(product.length, manifest.modules.length, 'manifest modules resolve into product mastery');

// Sequential lock: onboarding is an admin-ordered checklist, so each module is
// gated on the one before it and the first is ungated.
assert.equal(manifest.effectivePrerequisite(onboarding[0], onboarding, configs), null);
for(let i = 1; i < onboarding.length; i++){
  assert.equal(
    manifest.effectivePrerequisite(onboarding[i], onboarding, configs),
    onboarding[i - 1].id,
    'onboarding module ' + i + ' unlocks after the previous one'
  );
}
// Product Mastery keeps its hand-curated chain rather than a positional one.
assert.equal(
  manifest.effectivePrerequisite(product.find(m => m.id === 'vfd-mastery'), product, configs),
  'motor-starter',
  'an explicit prerequisite still wins over positional ordering'
);

function learnerWhoCompleted(mods, hub){
  const modules = {};
  mods.forEach(function(m){ modules[m.id] = { hub: hub, totalXP: m.xp, completedAt: 1, tier: 'gold' }; });
  return { name: 'Test Learner', startedAt: 0, modules: modules };
}
const badgeIds = (hub, learner) => W.entitledBadges(hub, learner, manifest, configs).map(b => b.id);

// The regression: a fully-custom hub must still award its completion badge.
const doneOnboarding = learnerWhoCompleted(onboarding, 'onboarding');
assert(badgeIds('onboarding', doneOnboarding).includes('onboarding-fully-onboarded'),
  'completing every custom onboarding module awards Fully Onboarded');
assert(badgeIds('onboarding', doneOnboarding).includes('onboarding-first-step'),
  'completing onboarding modules awards Welcome Aboard');

// ...and must not award it early, or to a learner with no progress at all.
assert(!badgeIds('onboarding', learnerWhoCompleted(onboarding.slice(0, 25), 'onboarding')).includes('onboarding-fully-onboarded'),
  'Fully Onboarded is withheld at 25 of 26');
assert(!badgeIds('onboarding', { name: 'New', startedAt: 0, modules: {} }).includes('onboarding-fully-onboarded'),
  'an empty curriculum never sweeps the hub');

const doneProduct = learnerWhoCompleted(product, 'product_mastery');
assert(badgeIds('product_mastery', doneProduct).includes('fully-loaded'),
  'completing every product module awards Fully Loaded');

// Hub isolation: the two tracks never share XP, tiers, or achievements.
assert.equal(badgeIds('product_mastery', doneOnboarding).length, 0,
  'onboarding progress awards no product mastery badges');
assert.equal(W.hubScopedXP('product_mastery', doneOnboarding.modules, configs), 0,
  'onboarding XP does not count toward product mastery');

// What cloud.js would actually persist.
const pending = W.pendingBadgeAwards('onboarding', doneOnboarding, manifest, [], configs);
assert(pending.some(b => b.id === 'onboarding-fully-onboarded'), 'the award is pending persistence');
assert(pending.every(b => b.hub === 'onboarding'), 'pending awards carry their hub');

// ── retargeted badges must be winnable in the current assessment flow ──
// These three were written for the retired v1 boss fight and had drifted into
// rules no learner could satisfy (or, for Speedrunner, only in their first hour).
const special = id => W.RSP_SPECIAL_BADGES.product_mastery.find(b => b.id === id);
const HOUR = 60 * 60 * 1000;

// Perfectionist: any full-marks assessment, whatever the bank size.
assert(special('perfectionist').check({ modules: { a: { correct: 12, total: 12 } } }),
  'a perfect 12-question assessment counts');
assert(special('perfectionist').check({ modules: { a: { correct: 35, total: 35 } } }),
  'a perfect 35-question assessment counts');
assert(!special('perfectionist').check({ modules: { a: { correct: 34, total: 35 } } }),
  'one wrong answer is not perfect');
assert(!special('perfectionist').check({ modules: { a: { correct: 0, total: 0 } } }),
  'an untouched module is not a perfect score');

// Boss Slayer: five first-attempt passes.
const firstTry = n => {
  const modules = {};
  for(let i = 0; i < n; i++) modules['m' + i] = { attemptHistory: [{ passed: true }] };
  return { modules };
};
assert(special('boss-slayer').check(firstTry(5)), 'five first-attempt passes wins');
assert(!special('boss-slayer').check(firstTry(4)), 'four does not');
assert(!special('boss-slayer').check({ modules: { a: { attemptHistory: [{ passed: false }, { passed: true }] } } }),
  'passing on a retake is not a first-attempt win');
assert(!special('boss-slayer').check({ modules: { a: {} } }), 'no history, no credit');

// Speedrunner: measured from when the module was opened, not account creation.
assert(special('speedrunner').check({ startedAt: 0, modules: { a: { openedAt: 100 * HOUR, completedAt: 100.5 * HOUR } } }),
  'a module finished 30 minutes after opening counts, however old the account');
assert(!special('speedrunner').check({ startedAt: 0, modules: { a: { openedAt: 100 * HOUR, completedAt: 102 * HOUR } } }),
  'a module that took two hours does not count');
assert(special('speedrunner').check({ startedAt: 0, modules: { a: { completedAt: 0.5 * HOUR } } }),
  'without openedAt it still falls back to the account start date');

// Neither retargeted rule may reference the retired v1 data shapes.
for(const id of ['perfectionist', 'boss-slayer']){
  assert(!/bossesDefeated|=== ?40/.test(special(id).check.toString()),
    id + ' must not depend on retired v1 boss-fight data');
}

// Special-badge rules must read the passed-in curriculum, not the static array.
for(const hub of Object.keys(W.RSP_SPECIAL_BADGES)){
  for(const badge of W.RSP_SPECIAL_BADGES[hub]){
    assert(!/manifest\.modules/.test(badge.check.toString()),
      hub + '/' + badge.id + ' must not read manifest.modules directly');
  }
}

console.log('Badge entitlement regression tests passed.');
