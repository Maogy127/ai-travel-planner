'use strict';
const assert=require('node:assert/strict');
global.window={}; require('../js/oahu');require('../js/daybuilder');
const B=window.DayBuilder;
for(const [title,old,want] of [
 ['Diamond Head — 6:00 AM entry slot',360,'Diamond Head'],
 ['Museum 9 AM slot',540,'Museum'],
 ['Beach — sunset photos',1080,'Beach'],
 ['Beach — sunrise',360,'Beach'],
 ['Sunset Beach walk',1080,'Sunset Beach walk'],
 ['Sunrise café',360,'Sunrise café'],
 ['Beach — sunset photos',360,'Beach — sunset photos'],
 ['Dinner — local tasting menu',1080,'Dinner — local tasting menu']
])assert.equal(B.cleanTimeTitle(title,old),want);
const day=B.reflow(B.buildSuggested('2026-11-27')).items;
const hits=B.overlaps(day,900,90,'moved');
assert(hits.some(i=>/shopping/i.test(i.title)));
assert(hits.some(i=>/Shower/i.test(i.title)));
assert(hits.some(i=>i.kind==='travel'));
const items=[{id:'a',title:'Shopping',start:755,end:930},{id:'b',title:'Ride',start:930,end:960},{id:'c',title:'Shower',start:960,end:1020},{id:'d',title:'Dinner',start:1080,end:1200,locked:true}];
const before=JSON.stringify(items);
assert(B.shiftConflicts(items,900,90,'moved').error.includes('Dinner'));
assert.equal(JSON.stringify(items),before,'failed cascade is atomic');
const shifted=B.shiftConflicts(items.slice(0,3),900,90,'moved').items;
assert.deepEqual(shifted.map(i=>[i.start,i.end]),[[990,1165],[1165,1195],[1195,1255]]);
assert.deepEqual(B.overlaps(items,930,30,'b').map(i=>i.id),[],'touching endpoints do not overlap');
assert.equal(JSON.stringify(items),before);
console.log('PASS title cleanup, actual Nov 27 overlaps, cascade, locked protection and immutability');

// Export a cross-day title change and preserve its provenance and movement credit.
require('../js/rings');
const source=B.buildSuggested('2026-11-26'),target=B.buildSuggested('2026-11-27');
const originalMove=window.GoNowRings.scoreDay(B.reflow(source).items,'athlete').values.move;
const originalTarget=window.GoNowRings.scoreDay(B.reflow(target).items,'athlete').values.move;
const index=source.items.findIndex(i=>i.id==='2026-11-26-1');
const moved=source.items.splice(index,1)[0];
moved.originalTitle=moved.title;moved.title=B.cleanTimeTitle(moved.title,moved.preferred);
Object.assign(moved,{preferred:900,manualTime:true,locked:false});target.items.push(moved);
const snapshot=B.exportDays({[source.date]:source,[target.date]:target},'');
const restored=B.importDays(snapshot).days;
const restoredItem=restored[target.date].items.find(i=>i.id===moved.id);
assert.equal(restoredItem.title,'Diamond Head');
assert.equal(restoredItem.originalTitle,'Diamond Head — 6:00 AM entry slot');
assert.equal(window.GoNowRings.scoreDay(B.reflow(restored[source.date]).items,'athlete').values.move,originalMove-90);
assert.equal(window.GoNowRings.scoreDay(B.reflow(restored[target.date]).items,'athlete').values.move,originalTarget+90);
console.log('PASS originalTitle snapshot round trip and movement recomputation on both days');

// Replaced derived prep stays unscheduled instead of reappearing before dinner.
const prepDay=B.buildSuggested('2026-11-27');
const shower=B.reflow(prepDay).items.find(i=>/Shower/.test(i.title));
assert(shower);
prepDay.unscheduled.push({...shower,needsTime:true,preferred:null});
assert(!B.reflow(prepDay).items.some(i=>i.id===shower.id));
const prepRoundTrip=B.importDays(B.exportDays({[prepDay.date]:prepDay},''));
assert(prepRoundTrip.days[prepDay.date].unscheduled.some(i=>i.id===shower.id && i.needsTime));
assert(!B.reflow(prepRoundTrip.days[prepDay.date]).items.some(i=>i.id===shower.id));
console.log('PASS replaced derived Shower prep stays in Needs a time through reflow and snapshot');
