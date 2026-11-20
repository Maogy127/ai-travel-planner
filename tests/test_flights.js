/* Destination clock estimates, migrations and scheduler boundaries, without network. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const c={console,Date,Intl,Set,Map};c.window=c;vm.createContext(c);
for(const file of ['styles','catalog','oahu','daybuilder','places','engine','jetlag','pickcatalog','pickscheduler'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),c);
const F=c.GoNowFlights,B=c.DayBuilder,a={origin:'Los Angeles',destination:'Oahu',start:'2026-11-25',end:'2026-11-29',flightsStep:true,ages:[25,25],picks:{activities:['diamond-head'],restaurants:[]}};
const domestic=F.windowFor({...a,returnTime:'08:00'}),international=F.windowFor({...a,origin:'Tokyo',returnTime:'08:00'});
assert.equal(domestic.international,false);assert.equal(international.international,true);
assert.equal(domestic.leave,480-120-domestic.road);assert.equal(international.leave,480-180-international.road);
assert.equal(F.windowFor({...a,arrivalTime:'17:30'}).arrivalStart,1125);
assert.equal(F.windowFor({...a,arrivalTime:'5:30 PM'}).arrivalStart,1125);
assert.equal(F.route(a).landing,780,'9 AM LAX + 6h - 2h local offset = 1 PM HNL');
assert.notEqual(F.route({...a,origin:'New York'}).landing,F.route(a).landing,'origin changes local landing estimate');
assert.equal(F.route({...a,destination:'Kyoto'}).international,true);
assert.equal(F.route({...a,destination:'Seattle'}).hours,2.5);
assert.equal(F.windowFor(a).departure,F.route(a).departure,'return estimate uses route duration and time zones');
for(const invalid of ['25:00','12:60','13:00 PM'])assert.equal(F.parse(invalid),null);
const old={flightTime:'8:00 AM'};F.migrate(old);assert.equal(old.returnTime,'8:00 AM');assert(!('flightTime'in old));F.migrate(old);assert.equal(old.returnTime,'8:00 AM');
assert.equal(F.migrate({flightTime:'08:00',returnTime:'10:00'}).returnTime,'10:00','new return field wins migration');
assert.equal(F.label({...a,arrivalFlight:' HA 11 ',arrivalTime:'17:30'},'arrival'),' HA 11  · lands 5:30 PM','flight number stays verbatim');
assert(F.label(a,'arrival').startsWith('Est. lands ~'));
const late=c.PickScheduler.schedule({...a,arrivalTime:'23:30'},c.GONOW_PICKS.oahu);
assert(late.days[0].items.every(i=>i.kind==='flight'),'late landing leaves no same-day activity after midnight');
for(const generic of [false,true]){
 const catalog=generic?{generic:true,activities:[],restaurants:[]}:c.GONOW_PICKS.oahu;
 const p=c.PickScheduler.schedule({...a,arrivalTime:'17:30',returnTime:'08:00'},catalog);
 assert(p.days[0].items.filter(i=>!['flight','travel'].includes(i.kind)).every(i=>F.parse(i.time)>=1125));
 assert(p.days.at(-1).items.every(i=>['flight','travel'].includes(i.kind)),'early return leaves only airport and flight');
 assert(p.days[0].items.some(i=>i.flightDirection==='arrival'));assert(p.days.at(-1).items.some(i=>i.flightDirection==='return'));
}
const legacy=c.Engine.buildTemplatePlan({...a,arrivalTime:'17:30',returnTime:'08:00'},c.Engine.matchDestination('Oahu'));
assert(legacy.days[0].items.filter(i=>i.kind!=='flight').every(i=>F.parse(i.time)>=1125));assert(legacy.days.at(-1).items.every(i=>['flight','travel'].includes(i.kind)));
const locked={id:'locked',title:'La Mer',kind:'meal',place:'Hotel',preferred:1200,duration:120,locked:true};
const r=B.reflow({date:a.start,items:[locked]},{flightAnswers:{...a,arrivalTime:'21:00'}});
assert.equal(r.items[0].start,1200);assert(r.items[0].notes.some(n=>n==='La Mer conflicts with your flight'));
const middle=B.buildSuggested('2026-11-26');
assert.equal(JSON.stringify(B.reflow(middle,{flightAnswers:a}).items),JSON.stringify(B.reflow(middle,{flightAnswers:{...a,returnTime:'08:00'}}).items),'middle day unchanged');
console.log('PASS flight estimates, local cutoff math, migration, verbatim number, pick/legacy cutoffs, locked conflict and middle-day stability');

// Exercise the real sheet/save/remount path with the same lightweight DOM approach
// as the existing builder suites. Browser layout is reserved for the supervisor.
function node(){
 const cache=new Map();return {innerHTML:'',textContent:'',dataset:{},style:{},isConnected:true,fields:[],
 classList:{add(){},remove(){},toggle(){},contains(){return false;}},
 addEventListener(k,fn){this[k]=fn;},querySelectorAll(s){return s==='[data-flight-field]'?this.fields:[];},
 querySelector(s){if(!cache.has(s))cache.set(s,node());return cache.get(s);},
 setAttribute(){},getAttribute(){return '';},removeAttribute(){},focus(){},remove(){},showModal(){},close(){},append(){},
 getBoundingClientRect(){return {width:100,height:40,top:0,bottom:40,left:0,right:100};}};
}
let sheet;
const memory=new Map();
c.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
c.document={body:{append(el){sheet=el;}},documentElement:{classList:{add(){},remove(){},toggle(){},contains(){return false;}}},
 createElement:()=>node(),querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},removeEventListener(){}};
c.matchMedia=()=>({matches:false,addEventListener(){}});c.addEventListener=()=>{};c.requestAnimationFrame=fn=>fn();
function changeFlight(root,fields){
 root.click({target:{closest:s=>s.includes('edit-flight')?{dataset:{testid:'edit-flight'}}:null}});
 assert(sheet&&sheet.innerHTML.includes('Edit flights'));
 sheet.fields=Object.entries(fields).map(([key,value])=>({dataset:{flightField:key},value}));
 sheet.querySelector('[data-save-flights]').onclick();
}
const demo=JSON.parse(JSON.stringify(c.OAHU_SAMPLE)),fa={origin:'Los Angeles',destination:'Oahu'},root=node();
const mounted=B.mount(root,{plan:demo,flightAnswers:fa,saveFlights:x=>Object.assign(fa,x)});
const untouched=JSON.stringify(mounted.schedule().days.slice(1,-1));
changeFlight(root,{arrivalTime:'17:30',returnTime:'08:00',arrivalFlight:'HA 11',returnFlight:' Return 7 '});
const edited=mounted.schedule();
assert.equal(JSON.stringify(edited.days.slice(1,-1)),untouched,'editing real demo sheet leaves middle days identical');
assert(edited.days.at(-1).items.some(i=>i.kind==='travel'&&/HNL/.test(i.title)),'demo keeps a separate airport ride');
assert(edited.days.at(-1).items.some(i=>i.kind==='flight'&&i.title===' Return 7  · departs 8:00 AM'));
assert(edited.days.at(-1).items.every(i=>['flight','travel'].includes(i.kind)));
assert.equal(fa.returnTime,'08:00');assert(!('flightTime'in fa));
const remounted=B.mount(node(),{plan:demo,flightAnswers:fa});
assert.equal(JSON.stringify(remounted.schedule().days),JSON.stringify(edited.days),'saved flight edit survives actual builder remount');
const shared=B.importForPlan(remounted.exportState(),demo);
assert(shared.days[demo.end].items.some(i=>i.kind==='flight'),'shared builder retains flight anchor');
console.log('PASS actual demo flight sheet, canonical answers, separate airport ride, unchanged middle days, persistence and share import');
const oldDemo=JSON.parse(JSON.stringify(c.OAHU_SAMPLE));
memory.clear();B.mount(node(),{plan:oldDemo});
const oldDeparture=B.buildSuggested(oldDemo.end);
assert(oldDeparture.items[0].flight&&oldDeparture.items[0].title==='Flight (add your time)');
memory.set('gonow:daybuilder:'+oldDemo.id,JSON.stringify({days:{[oldDemo.end]:oldDeparture},flightTime:'8:00 AM'}));
const migrated=F.migrate({origin:'Los Angeles',destination:'Oahu',flightTime:'8:00 AM'});
const restored=B.mount(node(),{plan:oldDemo,flightAnswers:migrated}).schedule().days.at(-1).items;
assert.equal(restored.filter(i=>i.kind==='flight').length,1,'old saved departure migrates to one flight');
assert.equal(restored.filter(i=>i.kind==='travel').length,1,'old saved combined airport card survives as a ride');
console.log('PASS saved legacy demo flight/airport migration');
