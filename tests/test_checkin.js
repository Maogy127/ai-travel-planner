const assert=require('node:assert/strict');
const C=require('../js/checkin.js');
const R=require('../js/rings.js');
for(const [text,want] of [
 ['legs sore, slept badly',{soreness:'some',sleep:'poor'}],
 ['腿很酸，没睡好',{soreness:'a lot',sleep:'poor'}],
 ['not sore',{soreness:'none'}],['不酸',{soreness:'none'}],
 ['exhausted, poor sleep, low mood',{energy:'low',sleep:'poor',mood:'low'}],
 ['energized, slept well, happy',{energy:'high',sleep:'great',mood:'good'}],
 ['累，没精神，失眠，不开心',{energy:'low',sleep:'poor',mood:'low'}],
 ['精神很好，精力充沛，睡得很好，开心',{energy:'high',sleep:'great',mood:'good'}],
 ['really sore, aching, stiff',{soreness:'a lot'}],['特别疼',{soreness:'a lot'}]
])assert.deepEqual(C.parse(text),want,text);
const items=[{id:'h',title:'Hike',start:480,end:570,duration:90},{id:'l',title:'Strength',locked:true,duration:45},{id:'s',title:'Strength',duration:30},{id:'t',title:'Tempo run',duration:30},{id:'m',title:'Lunch',kind:'meal',duration:60},{id:'w',title:'Scenic adventure',wellness:{type:'vigorous'},duration:45}];
for(const c of [{energy:'low'},{soreness:'some'},{soreness:'a lot'},{sleep:'poor'}]){
 const original=JSON.stringify(items),r=C.suggest(items,c,{goals:R.LEVEL_GOALS.athlete});
 assert.deepEqual(r.suggestions.map(s=>s.id),['h','s','t','w']);
 assert.equal(r.goals.move,54);assert.equal(r.goals.rec,55);assert.equal(r.goals.sleep,8.5);
 assert.equal(r.suggestions[0].alternative.start,480);assert.equal(r.suggestions[0].alternative.end,570);assert.equal(r.suggestions[0].alternative.duration,90);
 assert.equal(JSON.stringify(items),original);
}
assert.equal(C.suggest(items,{energy:'high'}).suggestions[0].type,'add');
assert.equal(C.suggest(items,{energy:'high',sleep:'poor'}).suggestions[0].type,'swap');
assert.deepEqual(C.suggest(items,{energy:'ok',soreness:'none',sleep:'ok'}).suggestions,[]);
assert.deepEqual(C.suggest(items,{skipped:true,energy:'low'}).suggestions,[]);
const goal=R.selectLevel('gentle','athlete');assert.equal(C.score(items,goal,[],{}, {soreness:'some'}).goals.move,54);assert.equal(C.score(items,goal,[],{},{}).goals.move,90);
const html=R.render(C.score([],goal,[],{},{}));assert(html.includes('No recovery block today. Rest is part of the plan —'));assert(!/\b(missed|failed|behind|fell short|only|not enough)\b/i.test(html.replace(/<[^>]*>/g,'')));
const memory=new Map();global.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
C.put('gonow.checkin.v1','2026-11-26','traveler-0',{done:true,soreness:'some',dismissed:['h']});
C.put('gonow.checkin.v1','2026-11-26','traveler-1',{skipped:true});
assert.equal(C.get('gonow.checkin.v1','2026-11-26','traveler-0').soreness,'some');assert(C.get('gonow.checkin.v1','2026-11-26','traveler-1').skipped);assert.deepEqual(C.get('gonow.checkin.v1','2026-11-27','traveler-0'),{});
console.log('PASS check-in parser, immutable suggestions, locks, goal precedence, persistence and encouraging copy');

// Personal alternatives change one score without mutating shared activities.
const affected=C.score([{...items[0],title:'Beach walk',wellness:{type:'walk'}}],goal,[],{}, {soreness:'some'});
const untouched=C.score([items[0]],goal,[],{}, {});
assert.equal(affected.values.move,45);assert.equal(untouched.values.move,90);
global.window={};require('../js/oahu');require('../js/daybuilder');
const B=window.DayBuilder,day=B.buildSuggested('2026-11-28'),hike=day.items.find(i=>/hike|hiking/i.test(i.title+' '+(i.wellness?.type||'')));
assert(hike&&!hike.locked);
Object.assign(hike,{title:'Beach walk',wellness:{type:'walk'},checkinSwap:true,manualTime:true});
const restored=B.importDays(B.exportDays({'2026-11-28':day},''));
assert.equal(restored.days['2026-11-28'].items.find(i=>i.id===hike.id).title,'Beach walk');
console.log('PASS personal score isolation and swapped activity snapshot round trip');

// The destination date, not the browser's date, controls today's optional UI.
const midnight=new Date('2026-11-27T05:00:00Z');
assert.equal(C.today('Pacific/Honolulu',null,midnight),'2026-11-26');
assert.equal(C.today('Asia/Tokyo',null,midnight),'2026-11-27');
assert.equal(C.today('Pacific/Honolulu','2026-11-28',midnight),'2026-11-28');
for(const bad of ['2026-02-29','2026-11-31','2026-1-01','garbage',null]){
 assert.equal(C.validDate(bad),null);
 assert.equal(C.today('Pacific/Honolulu',bad,midnight),'2026-11-26');
}
assert.equal(C.validDate('2028-02-29'),'2028-02-29');
console.log('PASS destination-local date, validated override and leap dates');
