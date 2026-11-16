const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const ctx={window:{},console,Date,Set,Map,localStorage:{getItem(){return null;}},document:{},};ctx.window=ctx;vm.createContext(ctx);
for(const f of ['oahu','daybuilder','pickcatalog','pickscheduler'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8').replace('window.DayBuilder = {','window.DayBuilder = {convert,'),ctx);
const c=ctx.GONOW_PICKS.oahu,credits=JSON.parse(fs.readFileSync('credits.json'));
for(const i of [...c.activities,...c.restaurants]){assert(i.name.length<=32,i.name);assert(fs.existsSync(i.photo),i.photo);assert(credits.some(x=>'images/'+x.id+'.jpg'===i.photo));assert(i.sampleReviews.length===2);if(i.category)assert(['Outdoors','Water','Culture','Shopping','Chill'].includes(i.category));}
const a={start:'2026-11-25',end:'2026-11-29',ages:[18,19],level:'active',mustdos:'Diamond Head',picks:{activities:['diamond-head','pearl-harbor','bishop-museum','laniakea','waimea'],restaurants:['lamer','senia']}};
assert(ctx.PickCatalog.must(c.activities[0],a));assert(!ctx.PickCatalog.eligible({minAge:21},a));assert.equal(ctx.PickCatalog.filter(c.activities,'turtle','All',a).length,1);
const result=ctx.PickScheduler.schedule(a,c);assert.equal(result.unfit.length,0,JSON.stringify(result.unfit));
const all=result.days.flatMap(d=>d.items);assert.equal(all.filter(i=>i.pick).length,7);assert.equal(all.find(i=>i.id==='diamond-head').time,'6:00 AM');assert.equal(all.find(i=>i.id==='lamer').time,'7:30 PM');assert.equal(all.find(i=>i.id==='senia').time,'6:00 PM');
for(const d of result.days)for(const i of d.items)assert(!ctx.DayBuilder.closedOn(i,d.date));
assert.equal(result.days.find(d=>d.items.some(i=>i.id==='waimea')).date,result.days.find(d=>d.items.some(i=>i.id==='laniakea')).date);
const crowded={...a,picks:{activities:c.activities.map(i=>i.id),restaurants:c.restaurants.map(i=>i.id)}};const big=ctx.PickScheduler.schedule(crowded,c);assert(big.unfit.length);assert.equal(new Set([...big.days.flatMap(d=>d.items.filter(i=>i.pick).map(i=>i.id)),...big.unfit.map(i=>i.id)]).size,c.activities.length+c.restaurants.length);
const id=big.unfit[0].id;ctx.PickScheduler.remove(crowded,id);assert(!Object.values(crowded.picks).flat().includes(id));ctx.PickScheduler.swap(a,'bishop-museum',c);
console.log('PASS pick catalog, matching, filters, scheduling, closures, reservations, clustering, unfit and helpers');
for(const i of c.activities){
 const derived=ctx.DayBuilder.operatingRules({title:i.name});
 for(const closure of derived.closed||[])assert(i.closed.some(r=>JSON.stringify(r)===JSON.stringify(closure)),i.id);
 assert(!/\n/.test(`${i.duration/60} h · ${i.effort} · ${i.price}`));
}
assert(ctx.DayBuilder.closedOn({...c.activities.find(i=>i.id==='hanauma'),title:'Hanauma Bay snorkel'},'2026-11-30'));
assert(ctx.DayBuilder.closedOn({...c.activities.find(i=>i.id==='pcc'),title:'Polynesian Cultural Center'},'2026-11-29'));
assert.equal(ctx.PickCatalog.filter(c.activities,'','Water',{ages:[9,19]}).some(i=>i.id==='dive'),false);
assert(ctx.PickCatalog.filter(c.activities,'','Outdoors',a).every(i=>i.category==='Outdoors'));
assert(ctx.PickCatalog.filter(c.restaurants,'','Breakfast',a).every(i=>i.meals.includes('breakfast')));
for(const d of result.days){
 assert(!d.items.some(i=>['pearl-harbor','bishop-museum'].includes(i.id)&&d.date==='2026-11-26'));
 for(const i of d.items.filter(i=>i.pick&&i.pick.meals&&!i.locked)){
  const windows={breakfast:[420,600],lunch:[690,840],dinner:[1050,1230],snack:[870,1020]};
  assert(i.pick.meals.some(m=>i.start>=windows[m][0]&&i.start+i.duration<=windows[m][1]));
 }
}
const diving=ctx.PickScheduler.schedule({...a,flightTime:'8:00 PM',picks:{activities:['dive'],restaurants:[]}},c);
assert.equal(diving.unfit.length,0);
for(const d of diving.days)for(const i of d.items.filter(i=>i.id==='dive'))assert(Date.parse(a.end+'T20:00:00Z')-Date.parse(d.date+'T00:00:00Z')-(i.start+i.duration)*60000>=86400000);
const swapAnswers=JSON.parse(JSON.stringify(a));const alternative=ctx.PickScheduler.swap(swapAnswers,'bishop-museum',c);assert(alternative);assert.equal(alternative.category,'Culture');assert(!Object.values(swapAnswers.picks).flat().includes('bishop-museum'));
console.log('PASS shared closure truth, exact child ages, meal filters, dive-flight buffer and fitting swap');
const meals=ctx.PickScheduler.schedule({...a,picks:{activities:[],restaurants:c.restaurants.map(i=>i.id)}},c);
assert.equal(meals.unfit.length,0);
for(const d of meals.days)for(const i of d.items.filter(i=>i.pick&&!i.locked)){
 const windows={breakfast:[420,600],lunch:[690,840],dinner:[1050,1230],snack:[870,1020]};
 assert(i.pick.meals.some(m=>i.start>=windows[m][0]&&i.start+i.duration<=windows[m][1]),i.id);
}
console.log('PASS all 13 restaurants fit; non-reserved meals stay in meal windows');
const photos=[...c.activities,...c.restaurants].map(i=>i.photo);
assert.equal(new Set(photos).size,photos.length,'one distinct photo per catalog place');
assert(!c.activities.some(i=>['black-friday','royal-market'].includes(i.id)));
assert.equal(ctx.PickCatalog.duration(45),'45 min');assert.equal(ctx.PickCatalog.duration(90),'1.5 h');assert.equal(ctx.PickCatalog.duration(120),'2 h');
assert.equal(ctx.PickCatalog.count(0,0,420),'Picked 0');
assert.equal(ctx.PickCatalog.count(1,90,420),'Picked 1 · about 1 day');
assert.equal(ctx.PickCatalog.count(5,850,420),'Picked 5 · about 3 days');
assert(result.days.every(d=>d.theme&&d.theme!=='Your picks')); // Derived one-line day subtitles.
assert(all.find(i=>i.id==='diamond-head').wellness.type==='movement');
assert(all.find(i=>i.id==='diamond-head').movementMinutes>0);
assert.equal(ctx.PickScheduler.reason(c.restaurants.find(i=>i.id==='senia'),{start:'2026-11-25',end:'2026-11-26'}),'Booked Fri · outside your dates');
const app=fs.readFileSync('js/app.js','utf8'),db=fs.readFileSync('js/daybuilder.js','utf8');
assert(app.includes('No, pick places now')&&app.includes('Choose activities and food next.')&&app.includes("btn('Pick places →', 'fork-no'"));
assert(app.includes('!a.personal&&!(a.picks&&a.picks.initialized)'));
assert(app.includes("(d.theme?'<p>'"));
assert(app.includes('canSwap=!i.reservation&&PickScheduler.swap'));
assert(!db.includes("${canLock ? lockChip : ''}"));
console.log('PASS unique credited photos, count/duration copy, fork, pick themes, movement, single lock and unfit reasons/actions');
// A booking on a conservative departure day needs a booking-specific explanation.
assert.equal(ctx.PickScheduler.reason(c.restaurants.find(i=>i.id==='lamer'),{...crowded,end:'2026-11-26'}),'Booked Thu · on your travel day');
assert.equal(JSON.stringify(ctx.PickScheduler.schedule(a,c)),JSON.stringify(ctx.PickScheduler.schedule(JSON.parse(JSON.stringify(a)),c)),'same picks rebuild deterministically');
const pccOnly={...a,flightTime:'4:00 PM',end:'2026-11-26',picks:{activities:['pcc'],restaurants:[]}};
assert(ctx.PickScheduler.schedule(pccOnly,c).unfit.some(i=>i.id==='pcc'));
const fitting=ctx.PickScheduler.swap(pccOnly,'pcc',c);assert(fitting);
assert(!ctx.PickScheduler.schedule(pccOnly,c).unfit.some(i=>i.id===fitting.id));

// Keep the Python export fixture in sync and prove every selected stop fits.
const exportFixture=fs.readFileSync('tests/test_full.py','utf8').match(/OAHU_EXPORT_PICKS = (\[[\s\S]*?\])/)[1];
const exportIds=JSON.parse(exportFixture.replace(/'/g,'"'));
const exportAnswers={...a,level:'unsure',picks:{activities:exportIds.filter(id=>c.activities.some(i=>i.id===id)),restaurants:['lamer','senia',...exportIds.filter(id=>c.restaurants.some(i=>i.id===id))]}};
const exportPlan=ctx.PickScheduler.schedule(exportAnswers,c);
assert.equal(exportPlan.unfit.length,0,JSON.stringify(exportPlan.unfit));
assert.equal(exportPlan.days.flatMap(d=>d.items).length,16,'13 picks plus check-in, arrival meal and airport transfer');
assert.deepEqual(exportPlan.days.map(d=>d.date),['2026-11-25','2026-11-26','2026-11-27','2026-11-28','2026-11-29']);
console.log('PASS Python ICS fixture schedules every pick across Nov 25–29 with 16 stops after removal');

// Run the app's actual checkout/export functions without a browser.
ctx.TextEncoder=TextEncoder;ctx.addEventListener=()=>{};
for(const name of ['styles','catalog','engine','diet'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
function appFunction(name,next){const start=app.indexOf('    function '+name+'(');const end=app.indexOf('    function '+next+'(',start);assert(start>=0&&end>start);vm.runInContext(app.slice(start,end),ctx);}
vm.runInContext(app.slice(app.indexOf('    function isPickPlan('),app.indexOf('    var KEY=')),ctx);
ctx.state={answers:{...exportAnswers,destination:'Oahu',mode:'trip',styles:[]},edits:{items:{'diamond-head':{note:'Meet, then hike; together'}}},tripId:null};
ctx.readTrips=()=>[];ctx.pickCatalog=()=>c;ctx.ITEM_PHOTOS={};ctx.showPlan=p=>{ctx.state.plan=p;};
appFunction('checkoutPicks','pickScreen');ctx.checkoutPicks();
const pickedPlan=ctx.state.plan;
assert.equal(pickedPlan.id,'oahu-picks-2026-11-25');ctx.checkoutPicks();assert.equal(ctx.state.plan.id,pickedPlan.id);
assert(ctx.isOahuPlan(pickedPlan));assert(ctx.isOahuPlan(ctx.OAHU_SAMPLE));
assert(!ctx.isPickPlan(ctx.OAHU_SAMPLE));assert(ctx.isPickPlan(pickedPlan));
assert(!ctx.isOahuPlan({id:'tokyo-picks-2026-11-25',destinationId:'tokyo'}));
assert(!ctx.isOahuPlan({id:'template-tokyo-2026-11-25'}));
assert(ctx.isOahuPlan({...pickedPlan,id:'picks-legacy',destinationId:undefined}));
const editedDays=pickedPlan.days.map(d=>({date:d.date,items:ctx.DayBuilder.reflow({date:d.date,items:d.items.filter(i=>i.id!=='pick-checkin').map(i=>ctx.DayBuilder.convert(i)),unscheduled:[]},{dates:pickedPlan.days.map(d=>d.date)}).items}));
ctx.DayBuilder.schedule=()=>({days:editedDays});ctx.DayBuilder.sourceOf=i=>i.sourceId||i.id;
ctx.builderContext=()=>({});ctx.dayModel=d=>({items:d.items});ctx.parseClock=ctx.DayBuilder.parseClock;
appFunction('builderExport','staticPlanBody');vm.runInContext(app.slice(app.indexOf('    function icsEscape('),app.indexOf('    var printSnapshot;')),ctx);
const calendar=ctx.buildICS().replace(/\r\n /g,'');
assert(calendar.includes('BEGIN:VTIMEZONE'));assert(calendar.includes('DTSTART;TZID=Pacific/Honolulu:'));
assert(calendar.includes('Diamond Head'));assert(calendar.includes('Kualoa'));
assert(calendar.includes('Note: Meet\\, then hike\\; together'));
assert(!calendar.includes('SUMMARY:Hotel check-in'));
assert.equal(ctx.builderExport().length,5);
console.log('PASS destination IDs, demo/pick/other classification, real pick ICS timezone, notes and removed builder stop');

// Sharing must carry builder data for pick plans, just as it does for the demo.
let sharedData;
ctx.DayBuilder.exportState=()=>({d:{'2026-11-25':{i:[],u:[]}}});
ctx.encodeTrip=data=>{sharedData=data;return 'encoded';};ctx.location={href:'file:///index.html'};
ctx.esc=String;ctx.showModal=()=>{};ctx.get=()=>({select(){}});ctx.navigator={};ctx.earn=()=>{};
appFunction('shareTrip','restoreShared');ctx.shareTrip();
assert(sharedData.db,'pick share includes builder state');assert.equal(sharedData.id,pickedPlan.id);
assert.equal(sharedData.edits.items['diamond-head'].note,'Meet, then hike; together');
console.log('PASS pick share includes DayBuilder state and notes');

// Search every supported field independently for both catalog types.
for(const items of [c.activities,c.restaurants]){
 for(const field of ['name','cuisine','area','category','tags']){
  const item={id:'search-fixture',[field]:field==='tags'?['Mānoa ʻIolani']: 'Mānoa ʻIolani'};
  for(const query of ['MANOA','iolani','MĀNOA','ʻIOLANI'])assert.equal(ctx.PickCatalog.filter([item],query,'All',{}).length,1,field+' '+query);
 }
 assert.equal(ctx.PickCatalog.filter(items,'no-such-place','All',{}).length,0);
 assert.equal(ctx.PickCatalog.filter(items,'','All',{}).length,items.length);
}
assert(ctx.PickCatalog.filter(c.restaurants,'poke','All',{}).some(i=>i.id==='poke'));
assert(ctx.PickCatalog.filter(c.restaurants,'acai','All',{}).some(i=>i.id==='acai'));
assert(ctx.PickCatalog.filter(c.activities,'manoa','All',{}).some(i=>i.id==='manoa'));
assert(ctx.PickCatalog.filter(c.activities,'iolani','All',{}).some(i=>i.id==='iolani'));
ctx.extra=['food','pace','musts'];appFunction('pickBackPage','pickCatalog');
for(const screen of ['fork','food','pace','musts']){
 ctx.state.answers.pickBack=screen;assert.equal(ctx.pickBackPage(),screen);
}
delete ctx.state.answers.pickBack;
ctx.state.answers.personal=false;assert.equal(ctx.pickBackPage(),'fork');
ctx.state.answers.personal=true;assert.equal(ctx.pickBackPage(),'musts');
assert(app.includes("state.answers.pickBack=['fork'].concat(extra).includes(state.screen)?state.screen:pickBackPage()"));
assert(app.includes("on('change-answers', function() {\n            go('dates');"));
assert(app.includes('No matches · try another word'));
console.log('PASS normalized search across all fields, fork/personalized Back and Draft answer editing');

// Polish 1: early sample departure, fallback cutoff, shared pace and protected bookings.
assert.equal(ctx.PickScheduler.departure(a).flight,480);
assert.equal(result.leaveTime,295);
assert(result.days.at(-1).items.every(i=>!i.pick));
assert(result.days.at(-1).items.some(i=>i.id==='pick-airport'&&i.start===295));
assert.equal(result.days.find(d=>d.items.some(i=>i.id==='lamer')).date,'2026-11-26');
assert(big.unfit.every(i=>!i.reservation&&!i.locked&&!i.booked));
const short=ctx.PickScheduler.schedule({...a,end:'2026-11-26'},c);
assert(short.bookingIssues.some(i=>i.id==='senia'));
assert(!short.unfit.some(i=>i.reservation));
assert.equal(ctx.PickScheduler.pace({level:'gentle',pace:'Full-on'}),'gentle');
assert.equal(ctx.PickScheduler.pace({level:'unsure',pace:'Easy'}),'gentle');
assert.equal(ctx.PickScheduler.pace({level:'unsure'}),'active');
assert.equal(ctx.PickScheduler.capacity({pace:'Easy'}),300);
const fallback=ctx.PickScheduler.schedule({...a,start:'2026-12-01',end:'2026-12-02',picks:{activities:['diamond-head'],restaurants:['leonards']}},c);
assert.equal(fallback.leaveTime,600);
assert(fallback.unfit.some(i=>i.id==='diamond-head'));
assert(ctx.PickScheduler.reason(fallback.unfit[0],{...a,start:'2026-12-01',end:'2026-12-02'}));
assert(fallback.days.at(-1).items.filter(i=>i.pick).every(i=>i.kind==='meal'&&i.start>=420&&i.start+i.duration<=600));
const breakfast=ctx.PickScheduler.schedule({...a,picks:{activities:['diamond-head','hanauma'],restaurants:['leonards','lamer','senia']}},c);
const leonards=breakfast.days.flatMap(d=>d.items).find(i=>i.id==='leonards');
assert(leonards&&leonards.start>=420&&leonards.start+leonards.duration<=600);
for(const d of breakfast.days)for(const i of d.items.filter(i=>i.pick?.meals&&!i.locked)){
 const windows={breakfast:[420,600],lunch:[690,810],dinner:[1080,1200],snack:[870,1020]};
 assert(i.pick.meals.some(m=>i.start>=windows[m][0]&&i.start+i.duration<=windows[m][1]));
}
console.log('PASS polish departure/default cutoff, no silent losses, protected bookings, pace and morning bakery');

const shortIds=new Set([...short.days.flatMap(d=>d.items.filter(i=>i.pick).map(i=>i.id)),...short.unfit.map(i=>i.id),...short.bookingIssues.map(i=>i.id)]);
assert.equal(shortIds.size,7,'every pick is scheduled or explained, including bookings');
assert.equal(ctx.PickScheduler.departure({...a,builderFlightTime:'11:00 AM'}).leave,475);
assert.equal(ctx.PickScheduler.departure({...a,flightTime:'9:00 AM',builderFlightTime:'11:00 AM'}).leave,355);

// Restaurants reserve meal windows before long activities in the full-catalog stress case.
const stressMeals=big.days.flatMap(d=>d.items).filter(i=>i.pick?.meals);
assert(stressMeals.length>=8,`Only ${stressMeals.length} restaurants fit`);
for(const i of stressMeals){
 const windows={breakfast:[420,600],lunch:[690,810],snack:[870,1020],dinner:[1080,1200]};
 assert(i.pick.meals.some(m=>i.start>=windows[m][0]&&(i.locked?i.start:i.start+i.duration)<=windows[m][1]),i.id+' outside meal windows');
}
console.log('PASS full-catalog stress fits '+stressMeals.length+' restaurants in meal windows');
