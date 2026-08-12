const assert = require('assert');
const fs = require('fs');

const activePages = [
  'index.html',
  'onboarding.html',
  'product-mastery.html',
  'training.html',
  'quiz.html',
  'results.html',
  'path.html',
  'badges.html',
  'mastery.html',
  'team.html',
  'admin.html'
];

for(const file of activePages){
  const html = fs.readFileSync(file, 'utf8');
  assert(html.includes('<link rel="stylesheet" href="brand.css">'), `${file} loads the shared brand theme`);
  assert(html.includes('images/rsp-industrial-logo.png'), `${file} displays the RSP Industrial logo`);

  for(const match of html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)){
    new Function(match[1]);
  }
}

const css = fs.readFileSync('brand.css', 'utf8').toLowerCase();
assert(css.includes('--rsp-navy:#2a4b66'));
assert(css.includes('--rsp-orange:#e57225'));
assert(css.includes('--rsp-accent:#b75b28'));
assert(/\.nav-link\.active,[\s\S]*?color:#fff !important/.test(css), 'selected navigation uses white text');
assert(css.includes('@media(max-width:700px)'));

function relativeLuminance(hex){
  const channels = hex.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
const selectedContrast = 1.05 / (relativeLuminance('b75b28') + 0.05);
assert(selectedContrast >= 4.5, `selected navigation contrast is ${selectedContrast.toFixed(2)}:1`);

const welcome = fs.readFileSync('welcome.js', 'utf8');
assert(welcome.includes('rsp-industrial-logo.png'));
assert(welcome.includes('#2a4b66'));
assert(welcome.includes('#b75b28'));

const logo = fs.readFileSync('images/rsp-industrial-logo.png');
assert(logo.length > 1000, 'logo asset is not empty');
assert.deepEqual([...logo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'logo asset is a PNG');

console.log('RSP brand regression tests passed.');
