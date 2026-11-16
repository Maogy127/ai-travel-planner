/* Offline regression coverage for the reviewed budget-fix paths. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ctx = {console,setTimeout,URLSearchParams,location:{search:'?fast=1'},matchMedia:()=>({matches:false})};
ctx.window=ctx;
vm.createContext(ctx);
for(const name of ['styles','catalog','oahu','engine','diet','ai','rings'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx);
(async()=>{
 const answers={origin:'LA',destination:'Oahu',start:'2026-11-25',end:'2026-11-29',who:'couple',ages:[30,31],styles:['scenic','food'],stayUnsure:true,level:'athlete',pace:'Full-on',personal:true};
 const template=await ctx.AI.generatePlan({...answers,templateOahu:true},{fast:true});
 assert(template.id.startsWith('template-'));
 for(const day of template.days){
  const titles=day.items.map(i=>i.title.toLowerCase());
  assert.equal(new Set(titles).size,titles.length);
  const breakfast=day.items.filter(i=>/breakfast/i.test(i.title));
  assert(breakfast.length<=1);
  assert(breakfast.every(i=>/^([1-9]|10):\d\d AM$|^11:00 AM$/.test(i.time)));
 }
 assert(template.meta.includes('Couple'));
 console.log('PASS personalized Oahu retains unique meals, morning breakfast and capitalized group');
 const demo=await ctx.AI.generatePlan(answers,{fast:true,demo:true});
 assert.equal(demo.id,'oahu-demo-2026-11');
 assert(demo.curatedMismatch);
 console.log('PASS explicit demo remains curated and flags mismatched answers');
 const forkNo={...answers,includeFlights:false,personal:false,mustdos:'',stay:''};
 for(const options of [{}, {demo:true}]){
  const curated=await ctx.AI.generatePlan(forkNo,{fast:true,...options});
  assert.equal(curated.id,'oahu-demo-2026-11');
  assert(curated.curatedMismatch);
  const titles=curated.days.flatMap(day=>day.items).map(item=>item.title).join(' ');
  assert(titles.includes('Diamond Head') && titles.includes('Kualoa'));
 }
 assert((await ctx.AI.generatePlan({...forkNo,templateOahu:true},{fast:true})).id.startsWith('template-'));
 console.log('PASS fork-no Oahu without flights retains researched stops unless template explicitly requested');
 assert.equal(ctx.GoNowRings.summary({sleep:8,move:90,rec:30}),'Sleep 8h00 · Move 90 min · Recover 30 min');
 assert.equal(ctx.GoNowRings.summary({sleep:7+5/60,move:60,rec:20}),'Sleep 7h05 · Move 60 min · Recover 20 min');
 console.log('PASS shared dashboard/day ring formatting pads minutes');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Exercise the same pure formatting helpers used by Trip prep and plan headers.
const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
for(const name of ['noteCount','groupPaceLabel','icon']){
 const body=app.match(new RegExp('    function '+name+'\\([^]*?\\n    }'));
 // Single-line helpers need only their declaration line; icon spans several lines.
 const source=name==='icon'?body[0]:app.split('\n').find(line=>line.includes('function '+name+'('));
 vm.runInContext(source,ctx);
}
ctx.paceLabels={gentle:'Gentle',active:'Active',athlete:'Athlete',unsure:'Not sure'};ctx.esc=x=>x;
assert.equal(ctx.noteCount(1),'1 note');assert.equal(ctx.noteCount(0),'0 notes');assert.equal(ctx.noteCount(3),'3 notes');
assert.equal(ctx.groupPaceLabel([{level:'active'},{level:'active'}]),'Both: Active pace');
assert.equal(ctx.groupPaceLabel(Array(3).fill({level:'gentle'})),'Everyone: Gentle pace');
assert.equal(ctx.groupPaceLabel([{name:'You',level:'active'},{name:'Partner',level:'gentle'}]),'You: Active · Partner: Gentle');
const paths=ctx.GONOW_STYLES.map(([key])=>ctx.icon(key).match(/<path d="([^"]+)"/)[1]);
assert.equal(new Set(paths).size,6);assert(!paths.includes(ctx.icon('style').match(/<path d="([^"]+)"/)[1]));
console.log('PASS note pluralization, group pace labels and six distinct style icons');

for(const size of [1,2,3])assert.equal(ctx.groupPaceLabel(Array(size).fill({level:'unsure'})),'Pace not set yet');

// Check the real prep selector independently of DOM layout and packing ticks.
for(const name of ['normalizePrep','prepTasks','prepRemaining']){
 const start=app.indexOf('    function '+name+'('),end=app.indexOf('\n    function ',start+1);
 vm.runInContext(app.slice(start,end),ctx);
}
ctx.state={plan:ctx.OAHU_SAMPLE};
ctx.state.packMeta={};
{const start=app.indexOf('    function packingGroups('),end=app.indexOf('    function packingItem(',start);vm.runInContext(app.slice(start,end),ctx);}
ctx.prepRecord=()=>({checked:{}});
const prep=ctx.prepTasks(),notes=prep.filter(t=>t.group==='before'),packs=prep.filter(t=>t.group==='pack');
assert.equal(notes.length,7);const rides=notes.find(t=>t.id==='book-uber-reserve');assert.equal(rides.legacyIds.length,4);assert.equal(rides.rides.length,4);assert.equal(rides.text,'Book 4 Uber Reserve rides');assert(notes.some(t=>t.date));
assert.equal(new Set(notes.map(t=>ctx.normalizePrep(t.text))).size,notes.length);
assert(notes.every(t=>['book','id','insurance','visa'].includes(t.kind)));
assert(notes.every(t=>t.text.length<=48&&t.text.split(/\s+/).length<=8));
assert(!notes.some(t=>/Thanksgiving|No flying/.test(t.text)));
ctx.prepRecord=()=>({checked:{'notice-old':true}});
assert.equal(ctx.prepRemaining(),notes.length);
assert.equal(ctx.prepRemaining(),notes.length);
ctx.prepRecord=()=>({checked:Object.fromEntries(notes.map(t=>[t.id,true]))});
assert.equal(ctx.prepRemaining(),0,'Unpacked items must not block All set');
assert(!app.includes('<small>From: '));
assert(packs.some(t=>t.text==='Reservation QR codes'));
console.log(`PASS demo prep: ${notes.length} left, ${notes.length} notes, ${packs.length} packing items`);

// Saved-list parsing and explicit confirmation must survive stale/corrupt storage.
for(const name of ['readTrips','tripConfirmed']){
 vm.runInContext(app.split('\n').find(line=>line.includes('function '+name+'(')),ctx);
}
ctx.TRIPS='gonow:trips';
for(const raw of ['{bad','null','{}','[null,{},7,"trip"]']){
 ctx.localStorage={getItem:()=>raw};assert.equal(ctx.readTrips().length,0);
}
ctx.localStorage={getItem:()=>'[{"id":"old","snapshot":{}},{"id":"draft"}]'};
const saved=ctx.readTrips();assert.equal(saved.length,2);
assert(ctx.tripConfirmed(saved[0]));assert(!ctx.tripConfirmed(saved[1]));
assert(ctx.tripConfirmed({confirmed:true}));assert(!ctx.tripConfirmed({confirmed:'true'}));
console.log('PASS malformed saved lists and confirmed/legacy trip detection');

const recordBody=app.match(/    function prepRecord\([^]*?\n    function savePrep/)[0].replace(/\n    function savePrep$/, '');
vm.runInContext(recordBody,ctx);
ctx.prepTripKey=()=> 'legacy-rides';ctx.state.packed={};
for(const done of [4,3,0]){
 const checked=Object.fromEntries(rides.legacyIds.map((id,i)=>[id,i<done]));
 ctx.read=()=>({'legacy-rides':{checked}});
 assert.equal(ctx.prepRecord().checked[rides.id],done===4);
}
console.log('PASS merged ride legacy ticks require every ride');

assert(!notes.some(t=>t.text==='Bring photo ID'));
assert(notes.some(t=>t.text==='Get travel insurance'));
assert(app.includes("it.id!=='insurance'"));
assert(!app.includes('Confirm to start prep.'));
const paceSource=app.slice(app.indexOf('    function paceDayHTML('),app.indexOf('    function sleepNudgeHTML('));
assert(!/Sleep timing|Suggestions|day-guidance|wind-down|jetlag-note/.test(paceSource));
const headSource=app.slice(app.indexOf('    function dayHeadHTML('),app.indexOf('    function dayHeadHTML(')+1700);
assert(!/Transport &amp; conditions|Typical conditions|Staying at/.test(headSource));
assert(app.includes('Getting around · ')); // Hint marks a tappable info row.
console.log('PASS minimal day header, Draft hint removal and prep dedupe copy');

assert.equal(packs.length,50);
assert(!packs.some(t=>/insurance/i.test(t.text)));
ctx.state.answers={international:true};
const savedPlan=ctx.state.plan;
ctx.state.plan={title:'Generic',days:[],packing:[{group:'Documents',items:[{id:'passport',name:'Passport'},{id:'insurance',name:'Travel insurance details'}]}]};
const generic=ctx.prepTasks();
assert(generic.some(t=>t.kind==='visa'));assert(!generic.some(t=>t.kind==='id'));
assert.equal(generic.filter(t=>/insurance/i.test(t.text)).length,1);
ctx.state.plan=savedPlan;
console.log('PASS generic packing insurance and international passport dedupe');
