const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const storage = new Map([['rsp_progress_v2', 'preserved-progress']]);
const context = {
  Date,
  document: {},
  localStorage: {
    getItem(key){ return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value){ storage.set(key, String(value)); }
  },
  window: {}
};

vm.runInNewContext(fs.readFileSync('welcome.js', 'utf8'), context);
const welcome = context.window.RSPWelcome;
const original = { name: 'New Learner', startedAt: '2026-07-29T16:00:00Z' };
const recreated = { name: 'New Learner', startedAt: '2026-07-30T16:00:00Z' };

assert.equal(welcome.hasSeen(original), false);
welcome.markSeen(original);
assert.equal(welcome.hasSeen({ name: ' new learner ', startedAt: original.startedAt }), true);
assert.equal(welcome.hasSeen(recreated), false);
assert.equal(welcome.hasSeen({ startedAt: original.startedAt }), false);
assert.equal(storage.get('rsp_progress_v2'), 'preserved-progress');

for(const file of ['index.html', 'onboarding.html', 'product-mastery.html']){
  const html = fs.readFileSync(file, 'utf8');
  assert(html.includes('<script src="welcome.js"></script>'), `${file} loads welcome.js`);
  assert.equal((html.match(/RSPWelcome\.show\(user\)/g) || []).length, 1, `${file} opens welcome once`);
  assert.equal((html.match(/avatarPickerFirstTime = !!isFirstTime/g) || []).length, 1, `${file} tracks the initial picker`);

  for(const match of html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)){
    new Function(match[1]);
  }
}

const source = fs.readFileSync('welcome.js', 'utf8');
for(const phrase of [
  'Welcome to the RSP Training Portal',
  'bottom-right corner',
  'Gabe',
  'in person and monitored',
  'Start Onboarding',
  'Explore Product Training',
  'I’ll Look Around'
]){
  assert(source.includes(phrase), `welcome includes: ${phrase}`);
}

console.log('Welcome component regression tests passed.');
