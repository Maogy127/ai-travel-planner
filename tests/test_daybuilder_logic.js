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
    'Grab-and-go breakfast', 'Kualoa Ranch — Jurassic Adventure (not UTV)',
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
    assert(B.reflow(day).unscheduled.some(c => c.blockedReason === 'No diving within 24h of your flight'));
}
for (const day of window.OAHU_SAMPLE.days) {
    const plan = B.buildSuggested(day.date);
    plan.items.push(B.trayItems().at(-1));
    assert(B.reflow(plan, {ages: [18, 19]}).conflicts.some(c => c.note.startsWith('21+')));
    assert(!B.reflow(plan).conflicts.some(c => c.note.startsWith('21+')));
    assert(!B.reflow(plan, {ages: [25, 26]}).conflicts.some(c => c.note.startsWith('21+')));
}
const flight = B.reflow(B.buildSuggested('2026-11-29')).items[0];
assert(flight.locked);
assert.equal(flight.textTime, 'Add flight time');
assert.equal(flight.start, null);
assert.equal(flight.end, null);
console.log('Day Builder logic checks passed. Default 11/26:');
baseline.items.forEach(i => console.log(B.range(i.start, i.end) + '  ' + i.title));

// I1: booking lead times are not activity durations; genuine durations still parse.
for (const text of ['within 24 h', '24 h in advance', 'book 48 h ahead', 'Full refund with 48 h notice.']) {
    assert.equal(B.parseDuration(text), null, text);
}
for (const [text, minutes] of [['About 1.5 h', 90], ['~45 min', 45], ['2 h tour', 120], ['allow about 1.5 h from check-in', 90]]) {
    assert.equal(B.parseDuration(text), minutes, text);
}
const shuttle = B.reflow(B.buildSuggested('2026-11-28')).items.find(i => i.id === '2026-11-28-11');
assert.equal(shuttle.duration, 60, 'shuttle uses existing 60-minute default');
assert(shuttle.duration > 0 && shuttle.duration <= 60);
assert.deepEqual([shuttle.start, shuttle.end], [1245, 1305]);

// Connector mode follows trip advice, with item overrides and close walks.
const modeDay = {date:'2026-11-26',car:{level:'Not needed'},items:[
 {id:'a',place:'A',preferred:600,duration:30,lat:21,lng:-158},
 {id:'b',place:'B',preferred:700,duration:30,lat:21.1,lng:-158}
]};
assert.match(B.reflow(modeDay).items[1].travel.label,/^Uber ~/);
assert.match(B.reflow({...modeDay,car:{level:'Required'}}).items[1].travel.label,/^Drive ~/);
modeDay.items[1].transportMode='rideshare';
assert.match(B.reflow({...modeDay,car:{level:'Required'}}).items[1].travel.label,/^Uber ~/);
modeDay.items[1].lat=21.001;
assert.match(B.reflow(modeDay).items[1].travel.label,/^Walk ~/);
