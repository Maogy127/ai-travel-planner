/* Run with node tests/test_daybuilder_logic.js; no browser or network required. */
'use strict';
const assert = require('node:assert/strict');
global.window = {};
const jsRoot = require('fs').existsSync(require('path').join(__dirname, '../site/js/oahu.js')) ? require('path').join(__dirname, '../site/js') : require('path').join(__dirname, '../js');
require(jsRoot + '/oahu.js');
require(jsRoot + '/daybuilder.js');
const B = window.DayBuilder;
const fresh = () => B.buildSuggested('2026-11-26');
const expectedTimes = [
    '5:35 AM–5:50 AM', '6:00 AM–7:30 AM', '7:35 AM–7:55 AM', '8:00 AM–9:10 AM',
    '9:10 AM–9:25 AM', '9:30 AM–12:00 PM', '1:00 PM–2:00 PM', '2:00 PM–2:20 PM',
    '2:30 PM–4:30 PM', '4:30 PM–5:30 PM', '5:40 PM–6:40 PM', '7:30 PM–9:30 PM'
];
const expectedTitles = [
    'Uber Reserve to Diamond Head', 'Diamond Head — 6:00 AM entry slot',
    'Uber to Twin Fin, 2570 Kalākaua (Kualoa shuttle stop)', 'Kualoa Ranch shuttle from Twin Fin',
    'Breakfast at Aunty Pat’s Café', 'Kualoa Ranch — Jurassic Adventure (not UTV)',
    'Kualoa shuttle back to Waikiki', 'Uber to the Kahala', 'Free time at the Kahala (pool / beach downtime)',
    'Get ready / change + makeup', 'Kahala Beach “Jennie” palms — sunset photos', 'Birthday dinner — La Mer at Halekulani'
];
for (const day of window.OAHU_SAMPLE.days) {
    const suggested = B.buildSuggested(day.date);
    const before = JSON.stringify(suggested);
    const result = B.reflow(suggested);
    assert.deepEqual(result.conflicts, [], day.date + ' starts clear');
    assert.equal(JSON.stringify(suggested), before, 'reflow must not mutate saved intent');
}
const baseline = B.reflow(fresh());
assert.deepEqual(baseline.items.map(i => B.range(i.start, i.end)), expectedTimes);
assert.deepEqual(baseline.items.map(i => i.title), expectedTitles);
const dinner = baseline.items.find(i => i.id === 'lamer');
assert.deepEqual(dinner.travel, {minutes: 20, label: 'Uber ~20 min', depart: 1135, arrive: 1155, late: false});
baseline.items.forEach((item, index) => {
    if (baseline.items[index - 1]?.kind === 'travel') assert.equal(item.travel, null);
});
const late = fresh();
late.items.splice(late.items.findIndex(i => i.id === 'photos'), 0, B.trayItems()[1]);
assert(B.reflow(late).conflicts.some(c => c.note.includes("you'd miss La Mer")));
const afterDinner = fresh();
afterDinner.items.push(B.trayItems()[1]);
const last = B.reflow(afterDinner).items.at(-1);
assert.equal(last.start, 1290 + B.commuteMinutes('Waikiki', 'Kewalo Basin'));
assert.equal(B.reflow(afterDinner).items.find(i => i.id === 'lamer').start, 1170);
for (const date of ['2026-11-28', '2026-11-29']) {
    const day = B.buildSuggested(date);
    day.items.push(B.trayItems()[0]);
    assert(B.reflow(day).conflicts.some(c => c.note === 'Keep 24 hrs between diving and flying'));
}
for (const day of window.OAHU_SAMPLE.days) {
    const plan = B.buildSuggested(day.date);
    plan.items.push(B.trayItems().at(-1));
    assert(B.reflow(plan).conflicts.some(c => c.note.startsWith('21+')));
    assert(!B.reflow(plan, {ages: [25, 26]}).conflicts.some(c => c.note.startsWith('21+')));
}
const flight = B.reflow(B.buildSuggested('2026-11-29')).items[0];
assert(flight.locked);
assert.equal(flight.textTime, 'Add flight time');
assert.equal(flight.start, null);
assert.equal(flight.end, null);
console.log('Day Builder logic checks passed. Default 11/26:');
baseline.items.forEach(i => console.log(B.range(i.start, i.end) + '  ' + i.title));
