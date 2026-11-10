/* Run: node tests/daybuilder_logic.js (no browser or network). */
const assert=require('node:assert/strict');
global.window=global;
const jsRoot=require('fs').existsSync(require('path').join(__dirname,'../site/js/oahu.js'))?require('path').join(__dirname,'../site/js'):require('path').join(__dirname,'../js');
require(jsRoot+'/oahu.js');require(jsRoot+'/daybuilder.js');
const db=DayBuilder,day=db.buildSuggested('2026-11-26'),result=db.reflow(day);
assert.equal(result.conflicts.length,0);
assert.deepEqual(result.items.slice(6).map(i=>[db.range(i.start,i.end),i.title]),[
 ['1:00 PM–2:00 PM','Kualoa shuttle back to Waikiki'],['2:00 PM–2:20 PM','Uber to the Kahala'],['2:30 PM–4:30 PM','Free time at the Kahala (pool / beach downtime)'],['4:30 PM–5:30 PM','Get ready / change + makeup'],['5:40 PM–6:40 PM','Kahala Beach “Jennie” palms — sunset photos'],['7:30 PM–9:30 PM','Birthday dinner — La Mer at Halekulani']]);
assert.equal(result.items.at(-1).travel.depart,1135);
assert.equal(result.items.at(-1).travel.arrive,1155);
const original=JSON.stringify(day);
day.items.splice(day.items.findIndex(i=>i.id==='photos'),0,db.trayItems()[1]);
const parasail=db.reflow(day);
assert(!parasail.items.some(i=>i.flex));
assert.deepEqual(parasail.items.slice(8).map(i=>[i.id,db.range(i.start,i.end)]),[
 ['chest-1','2:50 PM–4:20 PM'],['prep-dress','4:50 PM–5:50 PM'],
 ['photos','6:00 PM–7:00 PM'],['lamer','7:30 PM–9:30 PM']]);
assert(parasail.conflicts.some(c=>c.note.includes("you'd miss La Mer")));
assert.equal(parasail.items.at(-1).travel.late,true);
assert.equal(parasail.items.at(-1).travel.depart,1135);
assert.equal(parasail.items.at(-1).travel.arrive,1155);
const diveDay=db.buildSuggested('2026-11-26');
diveDay.items.splice(diveDay.items.findIndex(i=>i.id==='photos'),0,db.trayItems()[0]);
const late=db.reflow(diveDay);
assert(!late.items.some(i=>i.flex));
assert(late.conflicts.some(c=>/^Ends .* — you'd miss La Mer$/.test(c.note)));

assert(!late.items.at(-1).notes);
assert(late.items.at(-1).travel.late);
assert.equal(late.conflicts.length,late.items.reduce((n,i)=>n+(i.notes||[]).length,0));
for(const sourceDay of OAHU_SAMPLE.days) assert.equal(db.reflow(db.buildSuggested(sourceDay.date)).conflicts.length,0);
// Flexible time shrinks to the available slack and hides below 15 minutes.
for (const [anchor,expected] of [[660,30],[645,15],[644,null]]) {
 const fit=db.reflow({date:'2026-11-26',items:[
  {id:'free',title:'Free',place:'Kahala',preferred:540,duration:120,flex:true},
  {id:'activity',title:'Activity',place:'Kahala',duration:60},
  {id:'anchor',title:'Anchor',place:'Kewalo Basin',preferred:anchor,duration:60,locked:true}
 ]});
 assert.equal(fit.items.find(i=>i.flex)?.duration??null,expected);
}
const dive=db.trayItems()[0];
assert(db.reflow({date:'2026-11-28',items:[dive]}).conflicts.some(c=>c.source===OAHU_SOURCES.dan));
assert(db.reflow({date:'2026-11-27',items:[dive]}).items.some(i=>i.kind==='prep'));
assert(db.reflow({date:'2026-11-26',items:[db.trayItems().at(-1)]},{ages:[18,19]}).conflicts.some(c=>c.note.includes('21+')));
assert.equal(db.reflow({date:'2026-11-26',items:[db.trayItems().at(-1)]},{ages:[25]}).conflicts.length,0);
const before=JSON.stringify(day);db.reflow(day);assert.equal(JSON.stringify(day),before);
assert.equal(db.commuteMinutes('Other','Kahala'),30);
assert.equal(db.commuteMinutes('Kahala','Kahala'),0);
assert.equal(JSON.stringify(db.buildSuggested('2026-11-26')),original);
for(const i of result.items)console.log(db.range(i.start,i.end)+'  '+i.title);
console.log('La Mer travel: '+db.clock(result.items.at(-1).travel.depart)+' → '+db.clock(result.items.at(-1).travel.arrive));
console.log('All logic checks passed; default conflicts: '+result.conflicts.length);

for (const minutes of [1080,1098,1099]) {
 const r=db.reflow({date:'2026-11-26',items:[{id:'photo',title:'Photos',place:'Kahala palms',preferred:minutes,duration:60,tags:['sunset']}]});
 assert.equal(r.conflicts[0].note,minutes>1098?'After dark — sunset ~5:48 PM':'Starts after sunset (~5:48 PM)');
}
for (const [time, warned] of [['8:00 AM', true],['11:00 PM',false]]) {
 const r=db.reflow({date:'2026-11-28',items:[{...dive,preferred:540}]},{flightTime:time});
 assert.equal(r.conflicts.some(c=>c.note.includes('24 hrs')),warned);
}
assert.equal(db.buildSuggested('2026-11-29').items[0].title,'Flight (add your time)');
assert.deepEqual(result.items.find(i=>i.id==='lamer').walkBack,{depart:1120,arrive:1130});
// Exercise mounted rendering and event announcements without relying on a page-global #live.
{
 const listeners = {}, content = {innerHTML: ''}, live = {textContent: ''};
 let rootWrites = 0;
 const root = {
  set innerHTML(value) { rootWrites++; assert(value.includes('data-testid="db-live"')); },
  querySelector(selector) {
   if (selector === '.db-content') return content;
   if (selector === '[data-testid=db-live]') return live;
   return {focus() {}};
  },
  querySelectorAll() { return []; },
  addEventListener(type, fn) { listeners[type] = fn; }
 };
 global.document = {documentElement: {classList: {contains() {return false;}}}};
 global.localStorage = {getItem() {return null;}, setItem() {}};
 window.matchMedia = () => ({matches: false});
 const mounted = db.mount(root);
 assert(content.innerHTML.includes('5:30 PM · Walk ~10 min · arrive 5:40 PM'));
 assert(content.innerHTML.includes('6:40 PM · Walk ~10 min · arrive 6:50 PM'));
 assert(content.innerHTML.includes('6:55 PM · Uber ~20 min · arrive 7:15 PM'));
 assert(content.innerHTML.includes('aria-label="Edit time: 5:40 PM to 6:40 PM"'));
 const click = (action, id, zone='day') => {
  const row = {dataset: {dbId: id, dbZone: zone}};
  const button = {dataset: {dbAction: action}, closest() {return row;}};
  listeners.click({target: {closest() {return button;}}});
 };
 click('reset');
 click('down', 'photos');
 assert(live.textContent.includes('After dark — sunset ~5:48 PM'));
 assert.equal(rootWrites, 1, 'the live node survives every render');
 assert(mounted.getDay().items.findIndex(i=>i.id==='photos') > mounted.getDay().items.findIndex(i=>i.id==='lamer'));
 // A title-only add must not match a library item with an omitted sourceId.
 const added = mounted.addToDay('2026-11-26', {title: 'Unique unscheduled sentinel'});
 assert.equal(added.ok, true);
 const custom = mounted.getDay().unscheduled.find(i=>i.id===added.id);
 assert.equal(custom.title, 'Unique unscheduled sentinel');
 assert.equal(custom.custom, true);
 assert.equal(custom.preferred, null);
 assert.equal(custom.locked, false);
 assert(!mounted.getDay().items.some(i=>i.id===added.id));
 assert.equal(mounted.exportState().d['2026-11-26'].u.find(i=>i.id===added.id).title, custom.title);
 for (const spec of [{chestId: 'chest-bar'}, {sourceId: db.trayItems()[0].sourceId}]) {
  const base = db.trayItems().find(i=>spec.chestId ? i.id===spec.chestId : i.sourceId===spec.sourceId);
  const libraryAdd = mounted.addToDay('2026-11-26', {...spec, title: 'Ignored library override'});
  assert.equal(libraryAdd.ok, true);
  assert.equal(mounted.getDay().unscheduled.find(i=>i.id===libraryAdd.id).title, base.title);
 }
}
console.log('Mounted rendering and conflict announcements passed.');

// 11/27: Senia is a locked 6:00–8:00 PM booking after the dive and Ala Moana.
{
 const fri=db.reflow(db.buildSuggested('2026-11-27'));
 assert.equal(fri.conflicts.length,0,'default 11/27 is clear');
 assert.deepEqual(fri.items.map(i=>[db.range(i.start,i.end),i.title]),[
  ['7:15 AM–7:45 AM','Uber to Kewalo Basin (Dive Oʻahu)'],['8:00 AM–11:00 AM','Beginner intro dive — Dive Oʻahu, Kewalo Basin'],
  ['11:00 AM–11:30 AM','Rinse off & change'],['11:50 AM–12:30 PM','Lunch at Ala Moana Center'],
  ['12:35 PM–3:30 PM','Black Friday shopping — Ala Moana Center'],['3:30 PM–4:00 PM','Uber from Ala Moana to The Kahala'],
  ['4:00 PM–5:00 PM','Shower, change + makeup'],['6:00 PM–8:00 PM','Dinner — Senia (Chinatown)'],['8:00 PM–8:35 PM','Uber back to the Kahala']]);
 const senia=fri.items.find(i=>i.id==='senia');
 assert(senia.locked&&senia.start===1080&&senia.end===1200);
 assert.deepEqual(senia.travel,{minutes:35,label:'Uber ~30–40 min, est. $20–30',depart:1030,arrive:1065,late:false});
 const at=id=>fri.items.findIndex(i=>i.id===id);
 assert(at('uber-kahala')<at('prep-senia')&&at('prep-senia')<at('senia'),'Uber and prep come before Senia');
 assert.equal(fri.items[at('senia')-1].kind,'prep');
 assert.equal(fri.items.find(i=>i.id==='lunch-1127').travel.label,'Walk ~20 min');
 // Reordering: the hotel Uber before shopping pushes everything past 6:00.
 const reorder=db.buildSuggested('2026-11-27'),u=reorder.items.findIndex(i=>i.id==='uber-kahala');
 reorder.items.splice(u-1,0,reorder.items.splice(u,1)[0]);
 const moved=db.reflow(reorder);
 assert(moved.conflicts.some(c=>/you'd miss Senia$/.test(c.note)));
 assert.deepEqual([moved.items.find(i=>i.id==='senia').start,moved.items.find(i=>i.id==='senia').end],[1080,1200]);
 assert(!moved.items.find(i=>i.id==='senia').notes,'the lock is never blamed');
 // Inserting the parasail before the hotel Uber also overflows into dinner.
 const extra=db.buildSuggested('2026-11-27');
 extra.items.splice(extra.items.findIndex(i=>i.id==='uber-kahala'),0,db.trayItems()[1]);
 const pushed=db.reflow(extra);
 assert(pushed.conflicts.some(c=>c.note.endsWith("you'd miss Senia")));
 assert.equal(pushed.items.find(i=>i.id==='senia').start,1080);
 assert(pushed.items.find(i=>i.id==='senia').travel.late);
 // 11/26 La Mer remains unchanged.
 assert.equal(db.reflow(db.buildSuggested('2026-11-26')).items.find(i=>i.id==='lamer').start,1170);
 for(const i of fri.items)console.log(db.range(i.start,i.end)+'  '+i.title+(i.locked?'  [locked]':''));
 console.log('11/27 Senia lock checks passed.');
}

const sunsetDay=db.buildSuggested('2026-11-26');
Object.assign(sunsetDay.items.find(i=>i.id==='photos'),{preferred:1200,manualTime:true});
const sunsetResult=db.reflow(sunsetDay), sunsetPhoto=sunsetResult.items.find(i=>i.id==='photos');
assert(sunsetPhoto.notes.some(n=>n.includes('After dark')));
assert(sunsetPhoto.notes.some(n=>n.includes('Overlaps')));
assert.deepEqual([sunsetResult.items.find(i=>i.id==='lamer').start,sunsetResult.items.find(i=>i.id==='lamer').end],[1170,1290]);
assert(sunsetResult.items.some(i=>i.travel || i.kind==='prep'));

// Travel departures reuse manual activity reflow and compact share persistence.
{
 const day=db.buildSuggested('2026-11-27');
 const automatic=db.reflow(day).items.find(i=>i.id==='uber-home');
 Object.assign(day.items.find(i=>i.id==='uber-kahala'),{preferred:1080,duration:30,manualTime:true,estimate:true});
 const result=db.reflow(day), ride=result.items.find(i=>i.id==='uber-kahala');
 assert.deepEqual([ride.start,ride.end],[1080,1110]);
 assert(ride.notes.some(n=>n.includes('Overlaps')));
 assert.deepEqual(result.items.filter(i=>i.id==='senia').map(i=>[i.start,i.end]),[[1080,1200]]);
 assert.equal(result.items.find(i=>i.id==='prep-senia').start,1110);
 assert.equal(result.items.find(i=>i.id==='uber-home').start,automatic.start);
 const restored=db.importDays(db.exportDays({'2026-11-27':day},''));
 assert.deepEqual(db.reflow(restored.days['2026-11-27']).items.map(i=>[i.start,i.end]),result.items.map(i=>[i.start,i.end]));
 console.log('Travel departure reflow and persistence passed.');
}
