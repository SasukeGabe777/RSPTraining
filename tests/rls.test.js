const assert = require('assert');
const fs = require('fs');

// Static guarantees for the v12 lockdown: the migration must grant anon no
// destructive capability, and the client must handle the elevated key safely.
// The live end-to-end check (network, real policies) is tests/rls-verify.js.

const sql = fs.readFileSync('supabase-migration-v12.sql', 'utf8');

// ── the migration itself ──
// Strip comments so prose like "-- no DELETE" can't satisfy or trip checks.
const code = sql.replace(/--[^\n]*/g, '');

assert(!/GRANT[^;]*DELETE[^;]*TO anon/i.test(code), 'anon is never granted DELETE');
assert(!/FOR ALL/i.test(code), 'no FOR ALL policies — each verb is explicit');
assert(!/CREATE POLICY[^;]*FOR DELETE[^;]*TO anon/i.test(code), 'no anon DELETE policy on any table');
for(const table of ['users','progress','kudos','presence','module_config','paths','manual_grants','tier_settings','badge_definitions']){
  assert(new RegExp('REVOKE ALL ON public\\.' + table + '\\s+FROM anon', 'i').test(code),
    `privileges are reset from zero for ${table}`);
  assert(new RegExp('ALTER TABLE public\\.' + table + '\\s+ENABLE ROW LEVEL SECURITY', 'i').test(code),
    `RLS is explicitly enabled on ${table}`);
}
// Content tables are read-only for the public key.
for(const table of ['module_config','paths','manual_grants','tier_settings','badge_definitions']){
  assert(!new RegExp('GRANT[^;]*(INSERT|UPDATE)[^;]*ON public\\.' + table + '[^;]*TO anon', 'i').test(code),
    `anon cannot write ${table}`);
}
// kudos is append-only: INSERT but never UPDATE.
assert(!/GRANT[^;]*UPDATE[^;]*ON public\.kudos[^;]*TO anon/i.test(code), 'kudos rows cannot be edited');
// users: administrative and role columns are withheld from the public key.
const userSelect = code.match(/GRANT SELECT \(([^)]+)\)\s*ON public\.users TO anon/i);
assert(userSelect, 'users SELECT is column-scoped');
for(const hidden of ['employee_id','notes','status']){
  assert(!userSelect[1].includes(hidden), `users.${hidden} is not readable via the public key`);
}
const userUpdate = code.match(/GRANT UPDATE \(([^)]+)\)\s*ON public\.users TO anon/i);
assert(userUpdate, 'users UPDATE is column-scoped');
assert(!userUpdate[1].includes('roles'), 'a learner cannot assign themselves a role path');
assert(!userUpdate[1].includes('name'), 'a learner cannot rename another user record');
// Storage: uploads/deletes lose their anon policies; public read remains.
assert(/DROP POLICY IF EXISTS "flipbooks anon insert"/i.test(code), 'storage insert policy removed');
assert(/DROP POLICY IF EXISTS "flipbooks anon delete"/i.test(code), 'storage delete policy removed');
assert(/flipbooks public read/i.test(code), 'flipbook images stay publicly readable');

// ── the client's handling of the elevated key ──
const cloud = fs.readFileSync('cloud.js', 'utf8');
// The PLAINTEXT key must never be persisted. Remember-on-device is allowed
// only through the encrypted store: every localStorage write in cloud.js is
// either the JSON envelope of ciphertext (rememberAdminKey) or unrelated
// caching — never the raw adminKey / a raw pasted key.
assert(!/(localStorage|sessionStorage)\.setItem\([^)]*(adminKey|svc|serviceKey)/i.test(cloud),
  'the plaintext service key is never written to storage');
const rememberFn = cloud.slice(cloud.indexOf('async function rememberAdminKey'), cloud.indexOf('function hasStoredAdminKey'));
assert(/AES-GCM/.test(rememberFn) && /deriveKek/.test(rememberFn),
  'the remembered key is AES-GCM encrypted, not obfuscated');
const kek = cloud.slice(cloud.indexOf('async function deriveKek'), cloud.indexOf('async function rememberAdminKey'));
assert(/PBKDF2/.test(kek) && /310000/.test(kek), 'the KEK is derived with PBKDF2 at a real iteration count');
assert(/setItem\(ADMIN_KEY_STORE, JSON\.stringify\(\{ v: 1, salt:/.test(rememberFn),
  'only the ciphertext envelope reaches localStorage');
for(const fn of ['setAdminKey','verifyAdminKey','hasAdminKey','clearAdminKey',
                 'rememberAdminKey','restoreAdminKey','hasStoredAdminKey','forgetStoredAdminKey','autoElevate']){
  assert(new RegExp(fn + ': ' + fn).test(cloud), `cloud.js exports ${fn}`);
}
// restoreAdminKey must verify against the server, so a stale or tampered blob
// can never silently masquerade as elevation.
const restoreFn = cloud.slice(cloud.indexOf('async function restoreAdminKey'), cloud.indexOf('async function autoElevate'));
assert(/verifyAdminKey\(/.test(restoreFn), 'a restored key is re-verified before being trusted');

// ── every admin-only write fails fast with an actionable message ──
// Without these, a read-only session hits raw PostgREST/RLS errors (the
// exact confusion reported after the v12 rollout).
const GUARDED = ['updateUserStatus','deleteLearner','grantManualBadge','setModuleConfig',
                 'setModuleCodeword','deleteModuleConfig','upsertPath','deletePath',
                 'setUserRoles','uploadFlipbookAsset','setFlipbook','wipeAllCloud'];
for(const fn of GUARDED){
  const at = cloud.indexOf('async function ' + fn);
  assert(at !== -1, `cloud.js defines ${fn}`);
  const head = cloud.slice(at, at + 300);
  assert(/requireAdminKey\('/.test(head), `${fn} pre-flights the admin key before touching the network`);
}
assert(/function activeKey\(\)\{ return adminKey \|\| SUPABASE_KEY; \}/.test(cloud),
  'requests fall back to the public key when not elevated');
// Learner-facing user reads must name the granted columns — `select=*` fails
// under a column-scoped grant.
assert(/USER_PUBLIC_COLUMNS = 'id,name,avatar,started_at,last_active,created_at,earned_tiers,earned_badges,roles'/.test(cloud),
  'public user column list matches the migration grant');
assert(!/\/users\?select=\*/.test(cloud), 'no unconditional select=* against users');
// The learner login upsert must not send admin-only columns.
const upsert = cloud.slice(cloud.indexOf('async function upsertUser'), cloud.indexOf('const USER_PUBLIC_COLUMNS'));
assert(/hasAdminKey\(\)/.test(upsert), 'employee_id is only sent when elevated');
// ...and must not be a merge-duplicates upsert: that compiles to INSERT ... ON
// CONFLICT DO UPDATE SET <every payload column>, which needs UPDATE on `name`
// — withheld from anon. This exact mismatch took every module page down on
// the v12 rollout (the failed upsert aborted startSession before module
// config loaded).
assert(!/on_conflict=name/.test(upsert), 'upsertUser is PATCH-then-INSERT, not ON CONFLICT');
assert(/select=name/.test(upsert), 'user writes constrain RETURNING to granted columns');
// awardEarned (the tier/badge ratchet, run from learner sessions after every
// quiz) must constrain RETURNING the same way — a bare PATCH RETURNs *, which
// anon cannot read. updateUserStatus / setUserRoles are service-role-only and
// exempt.
const award = cloud.slice(cloud.indexOf('async function awardEarned'), cloud.indexOf('async function evaluateAndAward'));
assert(/\/users\?name=eq\.' \+ encodeURIComponent\(userName\) \+ '&select=name'/.test(award),
  'awardEarned constrains RETURNING to granted columns');
// Module pages must not let identity sync failure block content loading.
for(const page of ['training.html', 'quiz.html', 'results.html']){
  assert(/identity sync \(non-fatal\)/.test(fs.readFileSync(page, 'utf8')),
    `${page} loads module config even when the user upsert fails`);
}

// ── the admin surfaces prompt for elevation ──
const admin = fs.readFileSync('admin.html', 'utf8');
assert(/adminServiceKey/.test(admin), 'admin gate has a service-key field');
assert(/verifyAdminKey/.test(admin), 'the key is verified before the session trusts it');
assert(/renderElevationBadge/.test(admin), 'the dashboard shows its privilege level');
assert(/rememberKeyChk/.test(admin), 'the gate offers remember-on-this-device');
assert(/autoElevate/.test(admin), 'restored sessions elevate silently from the remembered key');
assert(/renderReadonlyBanner/.test(admin), 'read-only mode shows an unmissable banner with an unlock action');
const training = fs.readFileSync('training.html', 'utf8');
assert(/renderAdminKeyNotice/.test(training), 'inline module editing prompts for the key too');
assert(/autoElevate/.test(training), 'module pages elevate silently from the remembered key');
assert(/setAdminEditingLocked/.test(training), 'locked admin controls are disabled, not left to fail');

console.log('RLS lockdown static tests passed.');
