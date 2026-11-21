// Free AI (js/gemini.js) and the AI-guided scheduler. Pure Node: no network, no SDK, AI is mocked.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const mem={};const ls={getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v);},removeItem:k=>{delete mem[k];}};
const ctx={console,Date,Set,Map,Intl,URLSearchParams,Promise,setTimeout,clearTimeout,localStorage:ls,document:{},navigator:{onLine:true}};ctx.window=ctx;vm.createContext(ctx);
for(const f of ['oahu','daybuilder','pickcatalog','pickscheduler','gemini'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),ctx);
const AI=ctx.GoNowAI,c=ctx.GONOW_PICKS.oahu;
const dates=['2026-11-25','2026-11-26','2026-11-27','2026-11-28','2026-11-29'];
const items=[{id:'diamond-head',title:'Diamond Head',date:'2026-11-26',start:360,kind:'activity',category:'Outdoors'},{id:'senia',title:'Senia',date:'2026-11-27',start:1110,kind:'meal'},
 {id:'leonards',title:"Leonard's Bakery",date:'2026-11-27',start:540,kind:'meal'},{id:'bishop-museum',title:'Bishop Museum',date:'2026-11-28',start:600,kind:'activity',category:'Culture'},
 {id:'arrival-flight',title:'Lands HNL',date:'2026-11-25',start:900,kind:'flight',locked:true},{id:'kualoa',title:'Kualoa Ranch',date:'2026-11-27',start:780,kind:'activity',category:'Outdoors'}];

// 1. Simple edits never need AI.
let ops=AI.localEdit('Move the hike to the morning',items,dates);assert.deepEqual(JSON.parse(JSON.stringify(ops)),[{type:'move',id:'diamond-head',date:'2026-11-26',start:480}]);
ops=AI.localEdit('move bishop museum to friday at 2 pm',items,dates);assert.deepEqual(JSON.parse(JSON.stringify(ops)),[{type:'move',id:'bishop-museum',date:'2026-11-27',start:840}]);
ops=AI.localEdit('Please move dinner to 7:30pm.',items,dates);assert.equal(ops[0].id,'senia');assert.equal(ops[0].start,1170);
ops=AI.localEdit('push the ranch an hour later',items,dates);assert.equal(ops[0].id,'kualoa');assert.equal(ops[0].start,840);
ops=AI.localEdit('move breakfast 30 minutes earlier',items,dates);assert.equal(ops[0].id,'leonards');assert.equal(ops[0].start,510);
ops=AI.localEdit('Move Kualoa to day 4',items,dates);assert.equal(ops[0].date,'2026-11-28');assert.equal(ops[0].start,780);
ops=AI.localEdit('remove the museum',items,dates);assert.deepEqual(JSON.parse(JSON.stringify(ops)),[{type:'remove',id:'bishop-museum'}]);
assert.equal(AI.localEdit('move the flight to the morning',items,dates),null,'locked stops are never matched');
assert.equal(AI.localEdit('make the trip more relaxing',items,dates),null,'free-form requests go to AI');
assert.equal(AI.localEdit('move it somewhere nice',items,dates),null);
assert.equal(AI.target('the evening',dates).start,1080);assert.equal(AI.target('the afternoon',dates).start,840);assert.equal(AI.target('noon',dates).start,720);assert.equal(AI.target('Sat',dates).date,'2026-11-28');assert.equal(AI.target('14:15',dates).start,855);
console.log('PASS simple edits parse locally (move to part of day, weekday + time, clock, earlier/later, day N, remove; locked and vague requests skipped)');

// 2. AI answers are validated against the plan before anything changes.
let r=AI.readEdit({changes:[{action:'move',id:'kualoa',date:'2026-11-28',time:'08:00'},{action:'move',id:'arrival-flight',time:'10:00'},{action:'move',id:'nope',time:'10:00'},{action:'remove',id:'senia'},{action:'move',id:'leonards',time:'03:00'}],say:'Done 🙂 moved the ranch'},items,dates);
assert.deepEqual(JSON.parse(JSON.stringify(r.ops)),[{type:'move',id:'kualoa',date:'2026-11-28',start:480},{type:'remove',id:'senia'}]);assert.equal(r.say,'Done moved the ranch','emoji stripped');
const input={dates,picks:[{id:'diamond-head'},{id:'senia'},{id:'kualoa'}]};
let plan=AI.readPlan({days:[{date:'2026-11-27',stops:[{id:'kualoa',time:'08:00'},{id:'senia',time:'19:00'},{id:'ghost',time:'09:00'}]},{date:'2026-11-26',stops:[{id:'diamond-head',time:'06:30'},{id:'kualoa',time:'10:00'}]},{date:'2027-01-01',stops:[{id:'senia',time:'12:00'}]}],note:'Hikes early, dinner by the water 🌅'},input);
assert.deepEqual(JSON.parse(JSON.stringify(plan.stops)),[{id:'diamond-head',date:'2026-11-26',start:390},{id:'kualoa',date:'2026-11-27',start:480},{id:'senia',date:'2026-11-27',start:1140}]);
assert.equal(plan.note,'Hikes early, dinner by the water');
assert.throws(()=>AI.readPlan({days:[]},input));
const prompt=AI.planPrompt({...input,destination:'Oahu',pace:'gentle',capacity:300,arrival:'19:00',leave:'10:00',feel:{'2026-11-26':'Low'},weather:{'2026-11-26':'80° / 70° · 70% rain'}});
assert(/Pace gentle: at most 300 minutes/.test(prompt)&&/70% rain/.test(prompt)&&/"Low"/.test(prompt)&&/No emoji/.test(prompt));
assert(/never change stops marked locked/i.test(AI.editPrompt('x',items,dates)));
console.log('PASS AI plan and edit answers are validated (unknown ids, locked stops, bad dates/times dropped; notes trimmed, no emoji); prompt carries pace, feel and weather');

// 3. The rule-based planner checks every AI proposal.
const a={start:'2026-11-25',end:'2026-11-29',ages:[18,19],level:'active',mustdos:'Diamond Head',picks:{activities:['diamond-head','pearl-harbor','bishop-museum','laniakea','waimea'],restaurants:['lamer','senia']}};
const base=ctx.PickScheduler.schedule(a,c);
const where=(res,id)=>{for(const d of res.days){const i=d.items.find(x=>x.id===id);if(i)return {date:d.date,start:i.start};}return null;};
const wish=[{id:'bishop-museum',date:'2026-11-28',start:600},{id:'pearl-harbor',date:'2026-11-27',start:480},{id:'diamond-head',date:'2026-11-25',start:600},{id:'lamer',date:'2026-11-26',start:720}];
const ai=ctx.PickScheduler.schedule(a,c,{prefer:wish});
assert.deepEqual(JSON.parse(JSON.stringify(where(ai,'bishop-museum'))),{date:'2026-11-28',start:600});
assert.equal(where(ai,'pearl-harbor').date,'2026-11-27');assert(Math.abs(where(ai,'pearl-harbor').start-480)<=120);
assert.notEqual(where(ai,'diamond-head').date,'2026-11-25','arrival day keeps meals only');
assert.deepEqual(where(ai,'lamer'),where(base,'lamer'),'a booked table keeps its date and time');
assert.equal(ai.unfit.length,0);assert.equal(ai.bookingIssues.length,0);assert(ai.aiPlaced>=2);
for(const d of ai.days)for(const i of d.items){assert(!ctx.DayBuilder.closedOn(i,d.date));}
for(const d of ai.days){const used=d.items.filter(i=>i.pick).reduce((s,i)=>s+i.duration,0);assert(used<=ctx.PickScheduler.capacity(a),d.date);}
const gentle={...a,level:'gentle'},g=ctx.PickScheduler.schedule(gentle,c,{prefer:wish});for(const d of g.days)assert(d.items.filter(i=>i.pick).reduce((s,i)=>s+i.duration,0)<=300);
assert.equal(base.aiPlaced,0);
console.log('PASS AI proposals go through the planner: hours, closed days, bookings, arrival day, pace capacity (Gentle 300 min) all still hold');

// 4. Free-tier limits pause AI instead of paying.
const now=Date.parse('2026-11-20T23:30:00Z');// 3:30 PM Pacific
assert.equal(AI.msToPacificMidnight(now),8.5*3600000);
let k=AI.classify({code:'fetch-error',message:'[429 ] Resource exhausted',customErrorData:{status:429,errorDetails:[{quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}},now);assert.equal(k.kind,'day');assert.equal(k.until,now+8.5*3600000);
k=AI.classify({message:'429 RESOURCE_EXHAUSTED GenerateRequestsPerMinutePerProjectPerModel-FreeTier retryDelay":"22s"'},now);assert.equal(k.kind,'minute');assert.equal(k.until,now+22000);
k=AI.classify({message:'Firebase AI Logic API has not been used in project 937789728448 before or it is disabled. SERVICE_DISABLED'},now);assert.equal(k.kind,'off');
k=AI.classify({message:'Failed to fetch'},now);assert.equal(k.kind,'network');
k=AI.classify({code:'fetch-error',message:'[429 ] Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.'},now);assert.equal(k.kind,'off');assert.equal(k.until,now+600000);
k=AI.classify({message:'429 You exceeded your current quota, please check your plan and billing details. GenerateRequestsPerDayPerProjectPerModel-FreeTier'},now);assert.equal(k.kind,'day');
ctx.GONOW_AI_CONFIG={enabled:true,deviceDailyLimit:2};
assert.equal(AI.status().state,'ready');
ls.setItem('gonow:ai:pause',JSON.stringify({kind:'day',until:Date.now()+3600000}));assert.equal(AI.status().state,'resting');assert(/until tomorrow/.test(AI.status().line));assert.equal(AI.available(),false);
ls.setItem('gonow:ai:pause',JSON.stringify({kind:'off',until:Date.now()+3600000}));assert(/switched on/.test(AI.status().line));
ls.setItem('gonow:ai:pause',JSON.stringify({kind:'day',until:Date.now()-1}));assert.equal(AI.status().state,'ready','pause ends at reset');
ls.setItem('gonow:ai:uses',JSON.stringify({day:AI.pacificDay(Date.now()),n:2}));assert.equal(AI.status().state,'resting','device share of the free quota');
ls.removeItem('gonow:ai:uses');ctx.GONOW_AI_CONFIG={enabled:false};assert.equal(AI.status().state,'off');
console.log('PASS free-tier limits: per-day 429 pauses until midnight Pacific, per-minute uses retryDelay, API off pauses 10 min, device daily share, off switch');

// 5. Edits and plans through the mock: simple edits spend no AI calls; a failure pauses and falls back.
(async()=>{
 ctx.GONOW_AI_CONFIG={enabled:true,deviceDailyLimit:25};ls.removeItem('gonow:ai:pause');let calls=0;
 ctx.GONOW_AI_MOCK=(kind,p)=>{calls++;assert(/Request: "make day 3 easier"/.test(p));return {changes:[{action:'remove',id:'kualoa'}],say:'Took Kualoa off Friday'};};
 let e=await AI.edit('Move the hike to the morning',items,dates);assert.equal(e.by,'local');assert.equal(calls,0);
 e=await AI.edit('make day 3 easier',items,dates);assert.equal(e.by,'ai');assert.equal(calls,1);assert.equal(e.ops[0].id,'kualoa');assert.equal(e.say,'Took Kualoa off Friday');
 ctx.GONOW_AI_MOCK=()=>{throw Object.assign(Error('[429] quota'),{customErrorData:{status:429,errorDetails:[{quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}});};
 await assert.rejects(AI.planFromPicks(input));assert.equal(AI.status().state,'resting');
 e=await AI.edit('make day 3 easier',items,dates);assert.equal(e.by,'none');assert.equal(e.ops.length,0);assert(/resting/.test(e.say));
 e=await AI.edit('remove the museum',items,dates);assert.equal(e.by,'local','simple edits still work at the limit');
 console.log('PASS mocked AI: simple edits use no AI call, AI edits are applied, a daily-limit error pauses AI and simple edits keep working');

 // 6. Weather: Open-Meteo forecast inside 16 days, last year otherwise; no key.
 let reqs=AI.weatherRequests(21.3,-157.8,['2026-11-25','2026-11-26'],'2026-11-20');assert.equal(reqs.length,1);assert.equal(reqs[0].kind,'forecast');assert(/api\.open-meteo\.com\/v1\/forecast/.test(reqs[0].url)&&/start_date=2026-11-25/.test(reqs[0].url)&&!/key/i.test(reqs[0].url));
 reqs=AI.weatherRequests(21.3,-157.8,['2026-12-05','2026-12-06','2026-12-07'],'2026-11-20');assert.deepEqual(reqs.map(r=>r.kind),['forecast','lastYear']);assert.deepEqual(reqs[0].dates,['2026-12-05']);assert(/archive-api/.test(reqs[1].url)&&/start_date=2025-12-06/.test(reqs[1].url));
 assert.equal(AI.lastYear('2028-02-29'),'2027-03-01');
 const fc=AI.readWeather(reqs[0],{daily:{time:['2026-12-05'],weather_code:[61],temperature_2m_max:[80.4],temperature_2m_min:[70.2],precipitation_probability_max:[70]}});
 assert.equal(AI.weatherLine(fc['2026-12-05']),'80° / 70° · 70% rain');assert.equal(fc['2026-12-05'].icon,'rain');assert(AI.wet(fc['2026-12-05']));
 const ly=AI.readWeather(reqs[1],{daily:{time:['2025-12-06','2025-12-07'],weather_code:[1,3],temperature_2m_max:[81,79],temperature_2m_min:[71,69],precipitation_sum:[0,2.1]}});
 assert.equal(AI.weatherLine(ly['2026-12-06']),'Last year 81° / 71°');assert.equal(AI.weatherLine(ly['2026-12-07']),'Last year 79° / 69° · rainy');assert.equal(ly['2026-12-06'].icon,'sun');
 let fetched=[];ctx.GONOW_WEATHER_FETCH=u=>{fetched.push(u);return Promise.resolve({ok:true,json:()=>Promise.resolve({daily:{time:['2026-11-25'],weather_code:[2],temperature_2m_max:[82],temperature_2m_min:[72],precipitation_probability_max:[10]}})});};
 const w1=await AI.weather(21.3,-157.8,['2026-11-25'],Date.parse('2026-11-20T12:00:00Z'));assert.equal(AI.weatherLine(w1['2026-11-25']),'82° / 72° · 10% rain');
 await AI.weather(21.3,-157.8,['2026-11-25'],Date.parse('2026-11-20T13:00:00Z'));assert.equal(fetched.length,1,'cached for 3 hours');
 ctx.GONOW_WEATHER_FETCH=()=>Promise.reject(Error('offline'));assert.deepEqual(JSON.parse(JSON.stringify(await AI.weather(1,2,['2026-11-25'],Date.parse('2026-11-20T12:00:00Z')))),{});
 console.log('PASS weather: Open-Meteo forecast/last-year split, no key, line copy, rain flag, 3 h cache, offline gives nothing (no error)');
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
