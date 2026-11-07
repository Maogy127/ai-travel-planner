/* Activity photos must be real files with Commons credits, never the island banner. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
const credits = JSON.parse(fs.readFileSync(path.join(root, 'credits.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const block = app.slice(app.indexOf('var ITEM_PHOTOS='), app.indexOf('function itemArticle'));
const map = {};
for (const m of block.matchAll(/'([^']+)':\s*'images\/([^']+)'/g)) map[m[1]] = m[2];
const byId = Object.fromEntries(credits.map(c => [c.id, c]));
assert.ok(Object.keys(map).length >= 8, 'expected several activity photos');
const oahu = fs.readFileSync(path.join(root, 'images/oahu.jpg'));
for (const [item, file] of Object.entries(map)) {
  assert.notEqual(file, 'oahu.jpg', item + ' reused the island banner');
  const buf = fs.readFileSync(path.join(root, 'images', file));
  assert.ok(buf[0] === 0xff && buf[1] === 0xd8, file + ' is not a JPEG');
  assert.notEqual(buf.equals(oahu), true, file + ' is byte-identical to oahu.jpg');
  const id = file.replace(/\.jpg$/, '');
  const credit = byId[id];
  assert.ok(credit, 'missing credit for ' + file);
  assert.ok(credit.photographer && credit.alt && credit.license && credit.licenseUrl && credit.photoUrl, id);
  assert.ok(credit.photoUrl.startsWith('https://commons.wikimedia.org/wiki/File:'), credit.photoUrl);
  assert.ok(credit.licenseUrl.startsWith('https://'), credit.licenseUrl);
  assert.equal(credit.source, 'Wikimedia Commons');
  assert.ok(!/AI-generated|artificial intelligence/i.test(credit.alt + credit.photographer));
  assert.ok(credit.alt.length > 20, credit.alt);
}
assert.ok(map['2026-11-26-1'] === 'activity-diamond-head.jpg');
assert.ok(/Diamond Head crater/.test(byId['activity-diamond-head'].alt));
assert.ok(map['2026-11-28-9'] === 'activity-waikiki-sunset.jpg');
assert.ok(/Waikiki Beach at sunset/.test(byId['activity-waikiki-sunset'].alt));
assert.ok(!Object.values(map).includes('oahu.jpg'));
const jsCredits = fs.readFileSync(path.join(root, 'js/credits.js'), 'utf8');
for (const credit of credits) assert.ok(jsCredits.includes(credit.photoUrl), credit.id);
console.log('PASS photo provenance', Object.keys(map).length, 'activities', credits.length, 'credits');
