const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// The repository is public. Credentials live in config.local.js, which is
// git-ignored; every other file must reference them through window.RSP_CONFIG.
// This test fails the moment a real key, token, or password is hard-coded into
// a tracked file — the mistake is cheap to make and expensive to undo, because
// git history is permanent and public repos are swept by credential scanners.

function trackedFiles(){
  try{
    return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split('\n').map(s => s.trim()).filter(Boolean);
  }catch(e){
    console.log('Secret scan skipped: not a git repository.');
    process.exit(0);
  }
}

const files = trackedFiles();
assert(files.length > 0, 'expected tracked files');

// config.local.js must never be tracked.
assert(!files.includes('config.local.js'), 'config.local.js must stay git-ignored');
const ignore = fs.readFileSync('.gitignore', 'utf8');
assert(/^config\.local\.js$/m.test(ignore), '.gitignore lists config.local.js');
assert(fs.existsSync('config.example.js'), 'config.example.js is committed as the template');

const PATTERNS = [
  // Supabase/JWT: header.payload.signature, base64url, always starts "eyJ".
  { name: 'JSON Web Token (Supabase anon/service key)', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  // A password/secret/token constant assigned a non-empty literal.
  { name: 'hard-coded password or secret constant',
    re: /\b(?:ADMIN_PW|ADMIN_PASSWORD|PASSWORD|SECRET|API_KEY|ACCESS_TOKEN)\b\s*[:=]\s*["'][^"']+["']/ },
  // Provider webhook endpoints.
  { name: 'webhook URL', re: /https:\/\/[^\s"']*(?:hooks\.(?:slack|pumble)|discord\.com\/api\/webhooks)[^\s"']*/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ }
];

// The example template deliberately contains PASTE_ placeholders, and the
// scanner itself contains the patterns it looks for.
const SELF = new Set(['config.example.js', 'tests/secrets.test.js']);
const TEXT = /\.(?:js|html|md|sql|json|css|txt|yml|yaml|sh|ps1)$/i;

const findings = [];
for(const file of files){
  if(SELF.has(file) || !TEXT.test(file)) continue;
  let body;
  try{ body = fs.readFileSync(file, 'utf8'); }catch(e){ continue; }
  for(const { name, re } of PATTERNS){
    const hit = body.match(re);
    if(!hit) continue;
    // A placeholder is not a leak.
    if(/PASTE_|YOUR_|CHANGE_ME|xxx|example\.com/i.test(hit[0])) continue;
    // An empty-string fallback is the intended "unset" state.
    if(/[:=]\s*(""|'')/.test(hit[0])) continue;
    const line = body.slice(0, hit.index).split('\n').length;
    findings.push(`${file}:${line} — ${name}: ${hit[0].slice(0, 48)}…`);
  }
}

// The strongest check: learn the REAL secrets from the git-ignored
// config.local.js and prove none of them appear in any tracked file. Pattern
// matching alone missed the admin password, which appeared as prose in the
// README and as a bare `adminPassword: "…"` in 30 archived module pages.
// Nothing here prints a secret — only the field name that leaked.
if(fs.existsSync('config.local.js')){
  const local = {};
  new Function('window', fs.readFileSync('config.local.js', 'utf8'))(local);
  const real = Object.entries(local.RSP_CONFIG || {})
    .filter(([, v]) => typeof v === 'string' && v.length >= 8 && !/^PASTE_/.test(v));
  assert(real.length > 0, 'config.local.js defines credentials to check against');

  for(const file of files){
    if(SELF.has(file) || !TEXT.test(file)) continue;
    let body;
    try{ body = fs.readFileSync(file, 'utf8'); }catch(e){ continue; }
    for(const [field, value] of real){
      const at = body.indexOf(value);
      if(at === -1) continue;
      const line = body.slice(0, at).split('\n').length;
      findings.push(`${file}:${line} — literal value of config field "${field}"`);
    }
  }
}

assert.deepEqual(findings, [],
  'tracked files must not contain credentials:\n  ' + findings.join('\n  ') +
  '\n\nMove the value into config.local.js and read it from window.RSP_CONFIG.');

// The credential consumers must actually read from the config object.
const cloud = fs.readFileSync('cloud.js', 'utf8');
assert(/window\.RSP_CONFIG/.test(cloud), 'cloud.js reads credentials from window.RSP_CONFIG');
const legacyCloud = fs.readFileSync(path.join('legacy', 'portal-v1', 'cloud.js'), 'utf8');
assert(/window\.RSP_CONFIG/.test(legacyCloud), 'the archived v1 cloud.js does too');

// Every page that loads cloud.js must load the config first, or the portal
// silently drops into localStorage-only mode.
for(const file of files.filter(f => /\.html$/.test(f) && !/index\.backup\.html$/.test(f))){
  const body = fs.readFileSync(file, 'utf8');
  const cloudAt = body.indexOf('src="cloud.js"');
  if(cloudAt === -1) continue;
  const configAt = body.search(/src="(?:\.\.\/\.\.\/)?config\.local\.js"/);
  assert(configAt !== -1, `${file} loads config.local.js`);
  assert(configAt < cloudAt, `${file} loads config.local.js before cloud.js`);
}

// An unset admin password must never unlock the dashboard: ADMIN_PW falls back
// to '', and a blank input would otherwise compare equal.
for(const [file, guard] of [['admin.html', /if\(!ADMIN_PW\)/], ['legacy/portal-v1/admin.html', /ADMIN_PASSWORD &&/]]){
  assert(guard.test(fs.readFileSync(file, 'utf8')),
    `${file} refuses to unlock when no admin password is configured`);
}

console.log(`Secret scan passed — ${files.length} tracked files clean.`);
