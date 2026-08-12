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
const keySection = cloud.slice(cloud.indexOf('let adminKey'), cloud.indexOf('async function sb'));
assert(keySection.length > 100, 'admin key management block exists');
assert(!/localStorage|sessionStorage/.test(keySection),
  'the service key is never persisted — memory only, dies with the tab');
for(const fn of ['setAdminKey','verifyAdminKey','hasAdminKey','clearAdminKey']){
  assert(new RegExp(fn + ': ' + fn).test(cloud), `cloud.js exports ${fn}`);
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

// ── the admin surfaces prompt for elevation ──
const admin = fs.readFileSync('admin.html', 'utf8');
assert(/adminServiceKey/.test(admin), 'admin gate has a service-key field');
assert(/verifyAdminKey/.test(admin), 'the key is verified before the session trusts it');
assert(/renderElevationBadge/.test(admin), 'the dashboard shows its privilege level');
const training = fs.readFileSync('training.html', 'utf8');
assert(/renderAdminKeyNotice/.test(training), 'inline module editing prompts for the key too');

console.log('RLS lockdown static tests passed.');
