const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

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
vm.runInNewContext(fs.readFileSync('paths.js', 'utf8'), context);
const W = context.window;
const P = W.RSPPaths;
const manifest = W.RSP_MANIFEST;

// Onboarding modules are admin-created (Supabase only); product modules come
// from the manifest. A path must be able to span both.
const rows = [];
for(let i = 0; i < 6; i++){
  rows.push({
    module_id: 'onb' + i,
    hub: 'onboarding',
    sort_order: i * 10,
    module_meta: { name: 'Onboarding Lesson ' + (i + 1), icon: '📋', category: 'Company & Culture', xp: 100 }
  });
}
manifest.modules.forEach(function(mod, i){
  rows.push({ module_id: mod.id, hub: 'product_mastery', sort_order: i * 10 });
});
// An unpublished module an admin has parked.
rows.push({
  module_id: 'onb-draft', hub: 'onboarding', sort_order: 999, published: false,
  module_meta: { name: 'Draft Lesson', icon: '📝', category: 'Company & Culture', xp: 100 }
});
const configs = manifest.cacheModuleConfigs(rows);

// ── cross-hub module lookup ──────────────────────────────────────────
const index = manifest.moduleIndex(configs);
assert(index['onb0'], 'custom onboarding modules resolve by id');
assert(index['vfd-mastery'], 'manifest product modules resolve by id');
assert.equal(index['onb0'].hub, 'onboarding', 'resolved modules carry their hub');
assert.equal(index['vfd-mastery'].hub, 'product_mastery');
assert(!index['onb-draft'], 'unpublished modules are excluded by default');
assert(manifest.moduleIndex(configs, true)['onb-draft'], 'and included for admin views');

// ── resolution: order, dedupe, missing ids ───────────────────────────
const arPath = {
  id: 'ar-role-path', label: 'AR Path', is_role: true, show_on_home: true, sequential: true,
  module_ids: ['onb1', 'vfd-mastery', 'onb0', 'onb1', 'deleted-module', 'onb-draft']
};
const resolved = P.resolvePath(arPath, configs);
assert.deepEqual(resolved.modules.map(m => m.id), ['onb1', 'vfd-mastery', 'onb0'],
  'modules come back in path order, deduped, spanning hubs');
assert.deepEqual(resolved.missingIds, ['deleted-module', 'onb-draft'],
  'ids that no longer resolve are reported, not silently dropped');
assert.equal(P.resolvePath(arPath, configs, {includeUnpublished: true}).modules.length, 4,
  'admin views can see parked modules');

// ── progress spans hubs without touching hub XP ──────────────────────
const learnerModules = {
  onb1: { hub: 'onboarding', completedAt: 1, totalXP: 100 },
  onb0: { hub: 'onboarding', completedAt: 1, totalXP: 100 },
  'vfd-mastery': { hub: 'product_mastery' }
};
const prog = P.pathProgress(resolved, learnerModules);
assert.equal(prog.total, 3);
assert.equal(prog.completed, 2);
assert.equal(prog.pct, 67);
assert.equal(prog.nextModule.id, 'vfd-mastery', 'the next module is the first incomplete one in path order');
assert.equal(prog.complete, false);
assert.equal(P.pathProgress(P.resolvePath({module_ids: []}, configs), learnerModules).pct, 0,
  'an empty path is 0%, never NaN or 100%');

// THE INVARIANT: a module in many paths is still worth its XP once, in its
// own hub. Paths report progress; they never mint XP.
const alsoInPath = { id: 'p2', module_ids: ['onb0', 'onb1'], sequential: false };
P.pathProgress(P.resolvePath(alsoInPath, configs), learnerModules);
assert.equal(W.hubScopedXP('onboarding', learnerModules, configs), 200,
  'hub XP is unchanged by how many paths a module belongs to');
assert.equal(W.hubScopedXP('product_mastery', learnerModules, configs), 0,
  'a product module inside an onboarding-heavy path adds no product XP until completed');

// ── sequential locking within a path ─────────────────────────────────
assert.equal(P.pathPrerequisite(resolved, 'onb1'), null, 'the first module in a path is ungated');
assert.equal(P.pathPrerequisite(resolved, 'vfd-mastery'), 'onb1');
assert.equal(P.pathPrerequisite(resolved, 'onb0'), 'vfd-mastery');
assert.equal(P.pathLock(resolved, 'vfd-mastery', learnerModules).locked, false, 'unlocked once its predecessor is done');
assert.equal(P.pathLock(resolved, 'onb0', learnerModules).locked, true, 'locked while its predecessor is outstanding');
assert(/vfd/i.test(P.pathLock(resolved, 'onb0', learnerModules).reason), 'the lock names the blocking module');

const loosePath = { id: 'ref', label: 'Reference', sequential: false, module_ids: ['onb1', 'onb0'] };
const looseResolved = P.resolvePath(loosePath, configs);
assert.equal(P.pathPrerequisite(looseResolved, 'onb0'), null, 'non-sequential paths never gate');
assert.equal(P.pathLock(looseResolved, 'onb0', {}).locked, false);

// ── roles ────────────────────────────────────────────────────────────
const paths = [
  arPath,
  { id: 'ops-role-path', label: 'OPS Path', is_role: true, show_on_home: false, sort_order: 20, module_ids: ['onb2', 'onb0'] },
  { id: 'ref-path', label: 'Reference', is_role: false, show_on_home: true, sort_order: 5, module_ids: ['onb3'] }
];
assert.deepEqual(P.rolesOf({ roles: ['ar-role-path'] }), ['ar-role-path']);
assert.deepEqual(P.rolesOf({}), [], 'a learner with no roles has none');
assert.deepEqual(P.rolesOf({ roles: 'ar-role-path' }), ['ar-role-path'], 'a bare string is tolerated');

const dualRole = { name: 'Dual', roles: ['ar-role-path', 'ops-role-path'] };
assert.deepEqual(P.assignedPaths(dualRole, paths).map(p => p.id), ['ops-role-path', 'ar-role-path'],
  'assigned paths come back in sort order');
const required = P.requiredModuleIds(dualRole, paths);
assert.deepEqual(Object.keys(required).sort(), ['deleted-module', 'onb-draft', 'onb0', 'onb1', 'onb2', 'vfd-mastery'],
  'multiple roles union their module sets');
assert(P.isRequiredFor('onb2', dualRole, paths), 'a module from either role is required');
assert(!P.isRequiredFor('onb3', dualRole, paths), 'a non-role path never makes a module required');
assert(!P.isRequiredFor('onb1', { name: 'Nobody' }, paths), 'an unassigned learner requires nothing');

// A non-role path must never become a requirement, even if someone is
// somehow assigned its id.
assert(!P.isRequiredFor('onb3', { roles: ['ref-path'] }, paths),
  'is_role=false paths are not assignable requirements');

// ── home screen selection ────────────────────────────────────────────
assert.deepEqual(P.homePaths(paths).map(p => p.id), ['ref-path', 'ar-role-path'],
  'only show_on_home paths get a card, in sort order');

// ── slugs ────────────────────────────────────────────────────────────
assert.equal(P.slugify('AR Role Path'), 'ar-role-path');
assert.equal(P.slugify('  Ops & Logistics!  '), 'ops-logistics');
assert.equal(P.uniqueSlug('AR Role Path', paths), 'ar-role-path-2', 'slug collisions are resolved');
assert.equal(P.uniqueSlug('Brand New', paths), 'brand-new');
assert(P.slugify('!!!').length > 0, 'an unusable label still yields an id');

// ── cache round-trip ─────────────────────────────────────────────────
P.cachePaths(paths);
assert.equal(P.readCache().length, 3, 'paths survive a cache round-trip');
store.set(P.cacheKey, 'not json');
assert.deepEqual(P.readCache(), [], 'a corrupt cache degrades to empty, never throws');

// ── graceful degradation before supabase-migration-v11.sql is applied ──
// Until the migration runs, /paths 404s and every helper receives an empty
// list. The portal must stay fully usable: no path cards, no role markers,
// nothing thrown.
const noPaths = [];
assert.deepEqual(P.homePaths(noPaths), []);
assert.deepEqual(P.assignedPaths({ name: 'X', roles: ['ar-role-path'] }, noPaths), []);
assert.deepEqual(P.requiredModuleIds({ name: 'X', roles: ['ar-role-path'] }, noPaths), {});
assert.equal(P.isRequiredFor('onb0', { roles: ['ar-role-path'] }, noPaths), false);
assert.equal(P.findPath(noPaths, 'ar-role-path'), null);
assert.deepEqual(P.rolesOf(undefined), [], 'a missing user record yields no roles');
const emptyResolved = P.resolvePath(null, configs);
assert.deepEqual(emptyResolved.modules, [], 'a null path resolves to nothing rather than throwing');
assert.equal(P.pathProgress(emptyResolved, {}).pct, 0);
assert.equal(P.pathPrerequisite(emptyResolved, 'onb0'), null);

// ── page wiring ──────────────────────────────────────────────────────
const needsPaths = ['index.html', 'path.html', 'admin.html', 'onboarding.html', 'product-mastery.html'];
for(const file of needsPaths){
  const html = fs.readFileSync(file, 'utf8');
  assert(html.includes('<script src="paths.js"></script>'), `${file} loads paths.js`);
  // paths.js reads RSP_MANIFEST.moduleIndex at call time, but every page also
  // initialises path state during script evaluation — manifest must come first.
  assert(html.indexOf('src="manifest.js"') < html.indexOf('src="paths.js"'),
    `${file} loads manifest.js before paths.js`);
  for(const match of html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)){
    new Function(match[1]);
  }
}

// The cloud layer must expose the whole path API the admin panel calls.
const cloud = fs.readFileSync('cloud.js', 'utf8');
for(const fn of ['listPaths', 'getPath', 'upsertPath', 'deletePath', 'setUserRoles']){
  assert(new RegExp('async function ' + fn + '\\b').test(cloud), `cloud.js implements ${fn}`);
  assert(new RegExp('\\b' + fn + ': ' + fn).test(cloud), `cloud.js exports ${fn}`);
}
// Roles are admin-assigned: the learner-facing upsert must never write them
// back, or a learner could grant themselves a role from local storage.
const upsertUserBody = cloud.slice(cloud.indexOf('async function upsertUser'), cloud.indexOf('async function listUsers'));
assert(!/roles/.test(upsertUserBody), 'upsertUser never writes the roles column');
assert(/localUser\.roles\s*=/.test(cloud), 'syncDown pulls roles down to the learner');

// The migration must exist and be additive.
const migration = fs.readFileSync('supabase-migration-v11.sql', 'utf8');
assert(/CREATE TABLE IF NOT EXISTS public\.paths/.test(migration), 'v11 creates the paths table idempotently');
assert(/ADD COLUMN IF NOT EXISTS roles/.test(migration), 'v11 adds users.roles idempotently');
assert(!/DROP TABLE|DELETE FROM|TRUNCATE/i.test(migration), 'v11 destroys nothing');

console.log('Learner path regression tests passed.');
