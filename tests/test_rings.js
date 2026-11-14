const assert=require('assert');const {scoreDay,LEVEL_GOALS}=require('../js/rings.js');
const day=[{start:480,end:510,title:'Walk',kind:'activity'},{start:750,end:795,title:'Rest',kind:'rest'},{start:1170,end:1200,title:'Dinner',kind:'meal'}];
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
