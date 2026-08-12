/**
 * LIVE RLS verification — run AFTER applying supabase-migration-v12.sql:
 *
 *     node tests/rls-verify.js
 *
 * Probes the real Supabase project with the PUBLIC anon key from
 * config.local.js and proves the lockdown holds end to end:
 *   • every destructive/tampering operation is rejected,
 *   • everything the learner flow needs still succeeds.
 *
 * Uses a filter no row matches (name=eq.<sentinel>) for DELETE/PATCH probes,
 * so even a FAILURE of the lockdown cannot touch real data: the request is
 * judged by its status code, and with zero matching rows there is nothing to
 * destroy. The one INSERT probe targets `presence`, whose rows expire by
 * staleness and carry no learner value. Nothing here reads more than one row.
 *
 * This is intentionally NOT in the tests/*.test.js suite: it needs network
 * access and live credentials, so it is run by hand, not by CI.
 */
const fs = require('fs');
const path = require('path');

const cfgPath = path.join(__dirname, '..', 'config.local.js');
if(!fs.existsSync(cfgPath)){
  console.error('config.local.js not found — nothing to verify against.');
  process.exit(1);
}
const ctx = {};
new Function('window', fs.readFileSync(cfgPath, 'utf8'))(ctx);
const { supabaseUrl, supabaseKey } = ctx.RSP_CONFIG || {};
const BASE = String(supabaseUrl || '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

const SENTINEL = '__rls_verify_no_such_row__';

async function probe(method, pathq, body){
  const res = await fetch(BASE + '/rest/v1' + pathq, {
    method,
    headers: {
      apikey: supabaseKey,
      Authorization: 'Bearer ' + supabaseKey,
      'Content-Type': 'application/json',
      Prefer: method === 'GET' ? '' : 'return=minimal'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.status;
}

// 400 counts as denied for the DENY probes: PostgREST surfaces some
// privilege rejections as 400 (e.g. a PATCH naming a column outside the
// UPDATE grant), and every DENY probe filters on a sentinel no row matches,
// so a 4xx of any kind means nothing was touched.
const denied = s => s >= 400 && s < 500;
const ok = s => s >= 200 && s < 300;

const CHECKS = [
  // ── must be DENIED (the point of the lockdown) ──
  ['DENY', 'DELETE a user',               () => probe('DELETE', `/users?name=eq.${SENTINEL}`), denied],
  ['DENY', 'DELETE progress',             () => probe('DELETE', `/progress?user_name=eq.${SENTINEL}`), denied],
  ['DENY', 'DELETE kudos',                () => probe('DELETE', `/kudos?from_user=eq.${SENTINEL}`), denied],
  ['DENY', 'DELETE presence',             () => probe('DELETE', `/presence?user_name=eq.${SENTINEL}`), denied],
  ['DENY', 'DELETE module_config',        () => probe('DELETE', `/module_config?module_id=eq.${SENTINEL}`), denied],
  ['DENY', 'DELETE a path',               () => probe('DELETE', `/paths?id=eq.${SENTINEL}`), denied],
  ['DENY', 'rewrite a quiz bank',         () => probe('PATCH', `/module_config?module_id=eq.${SENTINEL}`, {quiz_bank: []}), denied],
  ['DENY', 'change a codeword',           () => probe('PATCH', `/module_config?module_id=eq.${SENTINEL}`, {codeword: 'X'}), denied],
  ['DENY', 'unpublish a module',          () => probe('PATCH', `/module_config?module_id=eq.${SENTINEL}`, {published: false}), denied],
  ['DENY', 'create a path',               () => probe('POST', '/paths', {id: SENTINEL, label: 'x'}), denied],
  ['DENY', 'self-assign a role',          () => probe('PATCH', `/users?name=eq.${SENTINEL}`, {roles: ['ar-role-path']}), denied],
  ['DENY', 'edit admin notes',            () => probe('PATCH', `/users?name=eq.${SENTINEL}`, {notes: 'x'}), denied],
  ['DENY', 'read admin notes',            () => probe('GET', '/users?select=notes&limit=1'), denied],
  ['DENY', 'read employee ids',           () => probe('GET', '/users?select=employee_id&limit=1'), denied],
  ['DENY', 'edit a kudos message',        () => probe('PATCH', `/kudos?from_user=eq.${SENTINEL}`, {message: 'x'}), denied],
  ['DENY', 'insert a manual grant',       () => probe('POST', '/manual_grants', {user_name: SENTINEL, badge_id: 'x'}), denied],
  ['DENY', 'upload to storage',           async () => {
      const res = await fetch(BASE + `/storage/v1/object/training-flipbooks/${SENTINEL}.txt`, {
        method: 'POST',
        headers: {apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey, 'Content-Type': 'text/plain'},
        body: 'x'
      });
      return res.status;
    }, denied],

  // ── must still WORK (the learner flow) ──
  ['ALLOW', 'read public user columns',   () => probe('GET', '/users?select=id,name,avatar,started_at,last_active,created_at,earned_tiers,earned_badges,roles&limit=1'), ok],
  ['ALLOW', 'read progress',              () => probe('GET', '/progress?select=*&limit=1'), ok],
  ['ALLOW', 'read module config',         () => probe('GET', '/module_config?select=*&limit=1'), ok],
  ['ALLOW', 'read paths',                 () => probe('GET', '/paths?select=*&limit=1'), ok],
  ['ALLOW', 'read kudos',                 () => probe('GET', '/kudos?select=*&limit=1'), ok],
  ['ALLOW', 'read presence',              () => probe('GET', '/presence?select=*&limit=1'), ok],
  // ── the login flow (the v12 rollout broke exactly this — see cloud.js
  // upsertUser). PATCH-first against a sentinel that matches nothing: 200 +
  // empty proves the UPDATE grant on the learner columns without writing.
  ['ALLOW', 'login update path (PATCH avatar/last_active)',
    () => probe('PATCH', `/users?name=eq.${SENTINEL}&select=name`, {avatar: 'sparky', last_active: new Date().toISOString()}), ok],
  // INSERT privilege probed without creating an undeletable user row: an
  // empty body fails the name NOT NULL constraint, and constraint errors
  // (400) only happen AFTER the privilege check passes. 401 = grant missing.
  ['ALLOW', 'login insert privilege (constraint probe)',
    () => probe('POST', '/users', {}).then(s => s === 400 ? 200 : s), ok],
  // The full merge-duplicates upsert shape quiz submissions use, against the
  // sentinel presence row so the ON CONFLICT DO UPDATE path really executes.
  ['ALLOW', 'quiz-style upsert (ON CONFLICT DO UPDATE)',
    async () => {
      const res = await fetch(BASE + '/rest/v1/presence?on_conflict=user_name', {
        method: 'POST',
        headers: {apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey,
                  'Content-Type': 'application/json',
                  Prefer: 'return=representation,resolution=merge-duplicates'},
        body: JSON.stringify({user_name: SENTINEL, last_ping: new Date().toISOString()})
      });
      return res.status;
    }, ok],
  ['ALLOW', 'read a flipbook page (storage)', async () => {
      const res = await fetch(BASE + '/storage/v1/object/public/training-flipbooks/no-such-object.png', {
        headers: {apikey: supabaseKey}
      });
      // 400/404 = bucket reachable, object absent. 401/403 would mean public
      // read broke, which the flipbook viewer depends on.
      return (res.status === 400 || res.status === 404) ? 200 : res.status;
    }, ok]
];

/**
 * Remove any sentinel rows the probes created. Post-migration the POST probes
 * are denied, so there is nothing to clean and these DELETEs are denied too —
 * both fine. PRE-migration (permissive policies) the POSTs really do insert,
 * and these DELETEs still work, so a demonstration run leaves no residue.
 */
async function cleanup(){
  await probe('DELETE', `/paths?id=eq.${SENTINEL}`).catch(() => {});
  await probe('DELETE', `/manual_grants?user_name=eq.${SENTINEL}`).catch(() => {});
  await probe('DELETE', `/presence?user_name=eq.${SENTINEL}`).catch(() => {});
  await fetch(BASE + `/storage/v1/object/training-flipbooks/${SENTINEL}.txt`, {
    method: 'DELETE',
    headers: {apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey}
  }).catch(() => {});
}

(async () => {
  let failures = 0;
  for(const [kind, label, run, judge] of CHECKS){
    let status;
    try{ status = await run(); }catch(e){ status = 'ERR ' + e.message; }
    const pass = typeof status === 'number' && judge(status);
    if(!pass) failures++;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  [${kind}] ${label} (HTTP ${status})`);
  }
  await cleanup();
  console.log();
  if(failures){
    console.log(`${failures} CHECK(S) FAILED — the lockdown is not fully in effect.`);
    console.log('Run supabase-migration-v12.sql in the Supabase SQL editor, then re-run this.');
    process.exit(1);
  }
  console.log('All live RLS checks passed — the public key cannot destroy or tamper, and the learner flow works.');
})();
