/* Relax shifts the 11/28 Kailua ride to 7:30–8:10 and drops the Pillbox from the visible list. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
global.window = global;
const js = fs.existsSync(path.join(__dirname, '../site/js/oahu.js')) ? path.join(__dirname, '../site/js') : path.join(__dirname, '../js');
require(js + '/oahu.js');
require(js + '/daybuilder.js');
const db = DayBuilder;
const day = db.buildSuggested('2026-11-28');
const base = db.reflow(day);
const uber = base.items.find(i => i.id === '2026-11-28-0');
assert.equal(db.range(uber.start, uber.end), '5:10 AM–5:30 AM');
assert.ok(base.items.some(i => i.id === '2026-11-28-1'));
const relaxed = db.reflow({
  date: day.date,
  items: day.items.filter(i => i.id !== '2026-11-28-1').map(i => i.id === '2026-11-28-0' ? {...i, preferred: 7 * 60 + 30, duration: 40} : i)
});
const later = relaxed.items.find(i => i.id === '2026-11-28-0');
assert.equal(db.range(later.start, later.end), '7:30 AM–8:10 AM');
assert.ok(!relaxed.items.some(i => i.id === '2026-11-28-1'));
const breakfast = relaxed.items.find(i => i.id === '2026-11-28-2');
assert.equal(db.range(breakfast.start, breakfast.end), '8:15 AM–9:15 AM');
console.log('PASS relax reflow 7:30 AM–8:10 AM');
