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
for(const [title,wellness,credit,group] of [['Steep hike',null,90,'Movement'],['Walk',null,60,'Movement'],['Massage',null,60,'Recovery'],['Pool / beach downtime',null,30,'Recovery'],['Diamond Head',{type:'hike',weight:1},90,'Movement']]){
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

// Full sample with assumed home sleep and per-day destination adjustment.
const J=require('../js/jetlag');
const sample=window.OAHU_SAMPLE.days;
const scheduled=sample.map(d=>B.reflow(B.buildSuggested(d.date)).items);
const expected=[[415/60,0,0],[7.25,90,30],[370/60,60,0],[8,142.5,0],[8,0,0]];
scheduled.forEach((items,i)=>{const value=scoreDay(items,'unsure',scheduled[i+1],J.adjustment({date:sample[i].date,day:i+1,origin:'Los Angeles'})).values;assert.deepStrictEqual([value.sleep,value.move,value.rec],expected[i]);});
console.log('PASS all five Oahu adjusted ring totals');

// budget-fix: displayed-day sleep refers to the preceding night, jet lag applied once.
const morningExpected=[[8,0,0],[7.5,90,30],[8,60,0],[370/60,142.5,0],[8,0,0]];
scheduled.forEach((items,i)=>{
 const prefs={...J.adjustment({date:sample[i].date,day:i+1,origin:'Los Angeles'}),previousItems:scheduled[i-1]||[],usualBedtime:'22:30',jetlagAdjusted:i<2,stay:'the Kahala'};
 const result=scoreDay(items,'active',null,prefs);
 assert.deepStrictEqual(Object.values(result.values),morningExpected[i]);
 // Ring trim replaces the detailed sleep/pace prose with one estimate sentence.
 if(i===1){const html=render(result);assert(html.includes('Sleep estimate:'));assert(!html.includes('Goals come from'));}
});
const R=require('../js/rings');
assert(!R.shortNight(7,8)); // exactly one hour short; above 85%
assert(R.shortNight(410/60,8)); // 6h50 >85%, but >60 minutes short
assert(!R.shortNight(.85*4,4)); // exactly 85%, less than an hour short
assert(R.shortNight(.85*4-1/60,4)); // strictly below 85%
assert(!R.shortNight(7+1/60,8));assert(R.shortNight(7-1/60,8));
const locked=[{id:'ride',title:'Uber',start:335,end:350,duration:15},{id:'slot',title:'Diamond Head',start:360,end:450,duration:90,locked:true}];
const snapshot=JSON.stringify(locked);assert.equal(R.proposal(locked,'later'),null);assert(!B.canShiftUnlocked(locked,'slot',390));assert(!B.canShiftUnlocked(locked,'ride',365));assert.equal(JSON.stringify(locked),snapshot);
assert.deepStrictEqual(R.proposal([{id:'walk',title:'Walk',start:600,end:630}], 'later'),{id:'walk',title:'Walk',start:630,end:660});
assert.equal(R.freeGap([{start:600,end:630}]),630);
// Ring trim: one working rest action replaces duplicate recovery prose.
const emptyHtml=render(scoreDay([],'active'));assert(emptyHtml.includes('No rest today · Add a pool break?'));assert(!emptyHtml.includes('No recovery block'));
console.log('PASS budget-fix morning sleep table, strict nudge boundaries, locked shift guard and contextual breakdown');

// budget-fix: the day has one clickable summary; details and advice stay collapsed.
const compactDay=render(scoreDay(day,'active'),{compact:true,caption:false});
assert.equal((compactDay.match(/data-testid="ring-breakdown-toggle"/g)||[]).length,1);
// Ring trim gives the disclosure its own small, explicit label.
assert(compactDay.includes('>How we count</button>'));
assert(compactDay.includes('aria-expanded="false"'));
assert(/<div hidden[^>]*data-testid="ring-breakdown"/.test(compactDay));
assert(!compactDay.includes('<figcaption>'));
assert(!compactDay.includes('class="ring-values"'));
console.log('PASS one compact, keyboard-accessible day ring summary with collapsed breakdown');
// Polish 1: omit the empty recovery segment in every compact summary.
const {summary}=require('../js/rings.js');
assert(!summary({sleep:8,move:30,rec:0}).includes('Recover 0 min'));
assert(summary({sleep:8,move:30,rec:15}).includes('Recover 15 min'));

const flightHtml=render(scoreDay([],'active'),{compact:true,flyHome:true,flightLabel:'Flight 1:30 PM'});
assert(!flightHtml.includes('ring-move'));assert(!flightHtml.includes('goal '));assert(flightHtml.includes('Flight 1:30 PM'));
for(const html of [emptyHtml,compactDay,flightHtml]){
 assert((html.match(/class="ring-encouragement"/g)||[]).length<=1);
 for(const copy of ['From getting back','Goals come from','Not counted:','No recovery block'])assert(!html.includes(copy));
 assert(!/<h4>[^<]+<\/h4><ul><\/ul>/.test(html));
}
// Ring trim: short sleep takes precedence over rest and easy-day suggestions.
const shortResult=scoreDay([],'active');shortResult.values.sleep=5+55/60;
const shortHtml=render(shortResult,{compact:true,flyHome:true,flightLabel:'Flight 8:00 AM'});
// Final audit: duration belongs only to the compact summary; advice gives an action.
assert(shortHtml.includes('Short night · Rest on your flight'));
assert(shortHtml.includes('aria-label="Sleep 5h55 · Flight 8:00 AM"'));
assert.equal((shortHtml.replace(/<svg[\s\S]*?<\/svg>/g,'').match(/5h55/g)||[]).length,1);
assert(!shortHtml.includes('ring-rest-break'));
assert.equal((shortHtml.match(/class="ring-encouragement"/g)||[]).length,1);
const easyHtml=render(scoreDay(day,'active'));
assert(easyHtml.includes('Easy day — a short walk is plenty.'));
assert.equal((emptyHtml.match(/No rest today/g)||[]).length,1);
assert.equal((emptyHtml.match(/Plan estimates, not medical advice/g)||[]).length,1);
console.log('PASS ring trim priorities, one rest action, concise panel and flight-only sleep');
