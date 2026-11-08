/* Pure state coverage that runs without a browser or network. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
const context = {window: {}, document: {}};
vm.createContext(context);
for (const name of ['oahu', 'daybuilder']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), context);
}
const db = context.window.DayBuilder;
const date = '2026-11-26';
const day = db.buildSuggested(date);
assert.equal(day.unscheduled.length, 0);
const baseline = JSON.stringify(db.reflow(day));
day.unscheduled.push({id: 'unscheduled-instance', sourceId: 'own:sentinel', title: 'Sentinel',
    place: 'Other', duration: 60, estimate: true, locked: false});
assert.equal(JSON.stringify(db.reflow(day)), baseline);
const exported = db.exportDays({[date]: day}, '');
assert.equal(exported.d[date].u[0].title, 'Sentinel');
assert.equal('preferred' in exported.d[date].u[0], false);
assert.equal('start' in exported.d[date].u[0], false);
const imported = db.importDays(exported).days[date];
assert.equal(imported.unscheduled[0].id, 'unscheduled-instance');
assert.equal(imported.unscheduled[0].preferred, null);
assert.equal(imported.unscheduled[0].custom, true);
assert.equal(imported.items.length, day.items.length);
// Export is detached, as required by generated snapshots.
day.unscheduled[0].title = 'Draft changed';
day.items.pop();
assert.equal(exported.d[date].u[0].title, 'Sentinel');
assert.equal(db.importDays(exported).days[date].items.length, imported.items.length);
delete exported.d[date].u;
assert.equal(db.importDays(exported).days[date].unscheduled.length, 0);
assert.equal(db.buildSuggested(date).unscheduled.length, 0);
for (const [date, id, start, end] of [
    ['2026-11-26', 'lamer', 1170, 1290], ['2026-11-27', 'senia', 1080, 1200]
]) {
    const item = db.reflow(db.buildSuggested(date)).items.find(i => i.id === id);
    assert.equal(item.start, start);
    assert.equal(item.end, end);
}
console.log('PASS unscheduled state, export/import, older shares, detached snapshots, reservation anchors');
