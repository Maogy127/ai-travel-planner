const assert=require('assert');const {scoreDay,LEVEL_GOALS}=require('../js/rings.js');
const day=[{start:480,end:510,title:'Walk',kind:'activity'},{start:750,end:795,title:'Meditation',kind:'rest'},{start:1170,end:1200,title:'Dinner',kind:'meal'}];
const r=scoreDay(day,'unsure');assert.deepStrictEqual(r.values,{sleep:10,move:15,rec:45});assert.strictEqual(r.move,1/3);assert.strictEqual(r.rec,1);
for(const level of Object.keys(LEVEL_GOALS))for(const items of [day,[],[{start:1430,end:1500,title:'Running',duration:100000}],[{duration:-10,title:'Rest'}]]){const result=scoreDay(items,level);for(const k of ['sleep','move','rec'])assert(result[k]>=0&&result[k]<=1);}
assert(scoreDay(day,'gentle').move>scoreDay(day,'athlete').move);assert.notStrictEqual(scoreDay(day,'active').goals.sleep,scoreDay(day,'gentle').goals.sleep);
assert.strictEqual(scoreDay([{start:1380,end:1440,title:'Dinner'}],'active',[{start:360}]).values.sleep,4.5);
assert.deepStrictEqual(scoreDay(day,'unknown'),r);assert.deepStrictEqual(scoreDay(day,'unsure'),r);console.log('PASS rings deterministic values, clamp, level targets, next morning and defaults');
assert.deepStrictEqual(LEVEL_GOALS,{gentle:{sleep:7.5,move:30,rec:20},active:{sleep:8,move:60,rec:30},athlete:{sleep:8.5,move:90,rec:40},unsure:{sleep:8,move:45,rec:25}});
const {selectLevel,render}=require('../js/rings.js');
assert.equal(selectLevel('gentle','trip'),'gentle');
assert.equal(selectLevel('gentle','athlete'),'athlete');
assert.deepStrictEqual(scoreDay(day,selectLevel('active','athlete')).goals,LEVEL_GOALS.athlete);
assert.deepStrictEqual(scoreDay(day,'gentle').goals,LEVEL_GOALS.gentle); // independent traveler
assert.equal(scoreDay(day,'active',[],{bedtime:'22:30',wake:'06:30'}).values.sleep,8);
assert.equal(scoreDay(day,'active',[{start:390}],{bedtime:'22:30',wake:'06:30'}).values.sleep,7.5);
assert(render(scoreDay(day,'athlete')).includes('8 h 30 m'));
console.log('PASS centralized goals, day override, traveler independence and optional sleep window');
global.window={};require('../js/oahu');require('../js/daybuilder');
const B=window.DayBuilder;
const items=B.reflow(B.buildSuggested('2026-11-26')).items;
const next=B.reflow(B.buildSuggested('2026-11-27')).items;
const demo=scoreDay(items,'unsure',next);
assert.equal(demo.values.move,90);assert.equal(demo.values.rec,30);assert.equal(demo.values.sleep,8.25);
assert.equal(demo.breakdown.length,2);assert(demo.breakdown.find(b=>b.group==='Recovery').capped);
for(const [title,wellness,credit,group] of [['Steep hike',null,90,'Movement'],['Walk',null,90,'Movement'],['Massage',null,60,'Recovery'],['Pool / beach downtime',null,30,'Recovery'],['Diamond Head',{type:'hike',weight:1},90,'Movement']]){
 const r=scoreDay([{title,wellness,start:0,end:240}]);assert.equal(r.breakdown[0].credited,credit);assert.equal(r.breakdown[0].group,group);
}
assert.equal(scoreDay([{title:'Safari truck tour',kind:'activity',duration:150},{title:'Free time',kind:'rest',duration:120},{title:'Walking transfer',kind:'travel',duration:30}]).breakdown.length,0);
console.log('PASS actual DayBuilder Day 2: sleep 8.25 h, movement 90, recovery 30; caps and exclusions');

// I1: default Day 4 ends at 21:45; 60-minute wind-down and default 08:00
// wake (Day 5 has unknown flight time) leave exactly 9 h 15 m of sleep.
const saturday=B.reflow(B.buildSuggested('2026-11-28')).items;
const sunday=B.reflow(B.buildSuggested('2026-11-29')).items;
assert.equal(scoreDay(saturday,'unsure',sunday).values.sleep,9.25);
const corrupt=saturday.map(i=>i.id==='2026-11-28-11'?{...i,end:2685}:i);
assert.equal(scoreDay(corrupt,'unsure',sunday).values.sleep,10,'implausible end falls back to known start');
assert.equal(scoreDay([{start:1380,end:1620,kind:'travel'}],'unsure').values.sleep,5,'last activity capped at 26:00');
assert.equal(scoreDay([{start:1245,duration:1440,kind:'travel'}],'unsure').values.sleep,10,'missing end with bad duration is guarded too');
console.log('PASS I1 Day 4 sleep 9 h 15 m and corrupt-duration sleep guards');
