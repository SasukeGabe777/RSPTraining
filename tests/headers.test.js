const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('_headers', 'utf8');
const blocks = source
  .split(/\r?\n(?=\/)/)
  .map(block => block.trim())
  .filter(Boolean);

const globalBlock = blocks.find(block => block.startsWith('/*\n'));
const adminBlock = blocks.find(block => block.startsWith('/admin.html\n'));

assert(globalBlock, 'global header block exists');
assert(!/x-frame-options\s*:/i.test(globalBlock), 'learner pages do not inherit X-Frame-Options');
assert(adminBlock, 'admin-specific header block exists');
assert(/x-frame-options\s*:\s*sameorigin/i.test(adminBlock), 'admin remains protected with SAMEORIGIN');

console.log('Kiosk framing header tests passed.');
