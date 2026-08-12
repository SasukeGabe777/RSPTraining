const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const storage = new Map();
const context = {
  URL,
  location: { href: 'https://portal.example/index.html' },
  localStorage: {
    getItem(key){ return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value){ storage.set(key, String(value)); }
  },
  window: {}
};

vm.runInNewContext(fs.readFileSync('manifest.js', 'utf8'), context);
const resolveCodeword = context.window.RSP_MANIFEST.effectiveCodeword;
const legacyModule = { quiz: { codeword: ' voltage ' } };

assert.equal(resolveCodeword(legacyModule), 'VOLTAGE', 'manifest codeword remains the fallback without a config');
assert.equal(resolveCodeword(legacyModule, {}), 'VOLTAGE', 'a missing config field still uses the manifest fallback');
assert.equal(resolveCodeword(legacyModule, { codeword: null }), null, 'an explicit null clears the manifest fallback');
assert.equal(resolveCodeword(legacyModule, { codeword: '' }), null, 'an explicit blank clears the manifest fallback');
assert.equal(resolveCodeword(legacyModule, { codeword: '   ' }), null, 'whitespace clears the manifest fallback');
assert.equal(resolveCodeword(legacyModule, { codeword: ' new-word ' }), 'NEW-WORD', 'configured codewords are normalized');

const admin = fs.readFileSync('admin.html', 'utf8');
const training = fs.readFileSync('training.html', 'utf8');
const quiz = fs.readFileSync('quiz.html', 'utf8');
const cloud = fs.readFileSync('cloud.js', 'utf8');

assert(admin.includes('clear-cfg-btn'), 'admin includes an explicit Clear Codeword button');
assert(admin.includes('effectiveCodeword=window.RSP_MANIFEST.effectiveCodeword(mod,cfg)'), 'admin renders explicit clears correctly');
assert(admin.includes('setModuleCodeword(mod.id,codeword||null'), 'admin persists a blank through the verified null-aware save');
assert(training.includes('manifest.effectiveCodeword(training,cfg)'), 'training respects an explicit clear');
assert(quiz.includes('manifest.effectiveCodeword(training,cfg)'), 'quiz respects an explicit clear');
assert(cloud.includes('if(config.codeword!==undefined)'), 'cloud sends explicit null codewords');
assert(cloud.includes('async function setModuleCodeword'), 'cloud has a verified codeword-specific save path');
assert(cloud.includes("cache:'no-store'"), 'codeword verification bypasses stale HTTP cache');
assert(admin.includes('RSPCloud.setModuleCodeword'), 'admin waits for verified persistence');
assert(training.includes('RSPCloud.setModuleCodeword'), 'inline training editor waits for verified persistence');

console.log('Codeword clearing regression tests passed.');
