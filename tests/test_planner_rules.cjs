// Offline real-builder render/export smoke. Chromium layout remains supervisor-run.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const nodes = new Map();
function node(key) {
  if (!nodes.has(key)) {
    const el = {
      innerHTML: '', textContent: '', value: '', isConnected: true, className: '', hidden: false,
      style: {setProperty() {}}, dataset: {}, children: [],
      addEventListener(event, fn) { this[event] = fn; },
      querySelectorAll() { return []; },
      querySelector(selector) { return node(String(key) + ' ' + selector); },
      closest() { return el; },
      focus() {}, blur() {}, click() { if (typeof this.onclick === 'function') this.onclick(); },
      setAttribute() {}, getAttribute() { return ''; }, removeAttribute() {}, hasAttribute() { return false; },
      showModal() {}, close() {}, remove() { this.removed=true; }, append(child) {child.parentNode=this;}, prepend() {}, after() {}, before() {},
      insertAdjacentElement() { return el; },
      insertAdjacentHTML(position, html) { this.innerHTML = (this.innerHTML || '') + String(html); },
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
      getBoundingClientRect() { return {width: 100, height: 40, top: 0, left: 0, bottom: 40, right: 100}; },
    };
    nodes.set(key, new Proxy(el, {get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol') return undefined;
      return () => target;
    }}));
  }
  return nodes.get(key);
}
const memory = new Map();
const mediaListeners=new Map(),windowListeners=new Map();
const ctx = {
  document: { addEventListener() {}, removeEventListener() {}, documentElement: { classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } } }, body: node('body'), getElementById: node, querySelector: selector => selector === '[data-testid="tab-content"]' ? null : node(selector), querySelectorAll: selector => selector==='[data-testid=blocked-message]'?[...nodes.values()].filter(n=>n.dataset.testid==='blocked-message'&&!n.removed):[], createElement: tag => node('el-' + tag + '-' + Math.random()), createTextNode: text => ({textContent: String(text)}) },
  localStorage: {get length(){return memory.size},key:i=>[...memory.keys()][i],getItem: k => memory.has(k)?memory.get(k):null,setItem: (k,v) => memory.set(k,v),removeItem:k=>memory.delete(k)},
  TextEncoder, TextDecoder, URL, URLSearchParams, location:{search:'?fast=1', hash:'', href:'http://local/index.html?fast=1'}, navigator:{},
  requestAnimationFrame: fn=>fn(), setTimeout, clearTimeout, setInterval, clearInterval, console,
  matchMedia: query => ({matches: false, addEventListener(event,fn) {mediaListeners.set(query,fn);}}),
};
ctx.window=ctx;ctx.scrollTo=()=>{};ctx.addEventListener=(event,fn)=>{if(!windowListeners.has(event))windowListeners.set(event,[]);windowListeners.get(event).push(fn);};ctx.history={state:null,pushState(s){this.state=s},replaceState(s){this.state=s}};
vm.createContext(ctx);
const jsRoot = fs.existsSync(`${__dirname}/../site/js/app.js`) ? `${__dirname}/../site/js/` : `${__dirname}/../js/`;
for (const f of ['styles','catalog','oahu','engine','ai','credits','localinfo','affiliates','rings','diet','checkin','jetlag','dashboard','daybuilder','app']) vm.runInContext(fs.readFileSync(`${jsRoot}${f}.js`,'utf8').replace('window.__gonow= {','window.__renderHelpers={builderContext,prepTasks,prepRemaining,prepScreen}; window.__gonow= {'),ctx);
const api=ctx.__gonow;
const click=id=>node(`[data-testid="${id}"]`).click();
const B=ctx.DayBuilder;
const closed={id:'museum',title:'Bishop Museum',place:'Museum',preferred:720,duration:60};
assert.equal(B.closedOn(closed,'2026-11-26').reason,'Thanksgiving');
assert.equal(B.closedOn(closed,'2026-11-27'),null);
assert(B.closedOn({closed:[{weekdays:[0],reason:'Sunday'}]},'2026-11-29'));
assert(!B.closedOn({title:'Beach'},'2026-11-26'));
assert.equal(B.nearestAllowed(closed,'2026-11-26'),'2026-11-27');
const rejected=B.reflow({date:'2026-11-26',items:[closed]});
assert.equal(rejected.items.length,0);assert.equal(rejected.unscheduled[0].id,'museum');
assert.equal(B.blockedOn({title:'Diamond Head',preferred:300,duration:60},'2026-11-26'),'Outside opening hours');
const dive={title:'Scuba dive',tags:['dive'],preferred:540,duration:180};
assert(B.blockedOn(dive,'2026-11-28',{flightTime:'8:00 AM'}));
assert(!B.blockedOn(dive,'2026-11-28',{flightTime:'12:00 PM'}),'exactly 24h is allowed');
assert.equal(B.reflow({date:'2026-11-28',items:[dive]},{flightTime:'8:00 AM'}).items.length,0);
assert(B.reflow({date:'2026-11-27',items:[dive]},{flightTime:'8:00 AM'}).items.some(i=>i.tags?.includes('dive')));
const root=node('rules-root');
const builder=B.mount(root);
function suggestion(){const msg=[...nodes.values()].filter(n=>n.dataset.testid==='blocked-message').at(-1);assert(msg.innerHTML.includes('data-testid="blocked-reason"'));assert(msg.innerHTML.includes('data-testid="blocked-suggest"'));assert(msg.innerHTML.includes('data-testid="blocked-dismiss"'));assert(msg.innerHTML.includes('Bishop Museum')||msg.innerHTML.includes('Dive too close to flight')||msg.innerHTML.includes('outside hours'));assert(msg.parentNode!==root);return msg.querySelector('button');}
let result=builder.addToDay('2026-11-26',{title:'Bishop Museum',time:'12:00'});
assert.equal(result.ok,false);assert.equal(result.reason,'Closed Thu, Nov 26');assert.equal(result.suggestion,'2026-11-27');
assert(!builder.schedule().days.flatMap(d=>d.items).some(i=>i.title==='Bishop Museum'));
suggestion().click();assert([...nodes.values()].filter(n=>n.dataset.testid==='blocked-message').at(-1).removed);assert(builder.schedule().days.find(d=>d.date==='2026-11-27').items.some(i=>i.title==='Bishop Museum'));
result=builder.addToDay('2026-11-28',{...dive,time:'09:00'});
assert.equal(result.ok,false);assert.equal(result.suggestion,'2026-11-27');suggestion().click();
assert(builder.schedule().days.find(d=>d.date==='2026-11-27').items.some(i=>i.title==='Scuba dive'));
// Place and title-suffix fallbacks share short, untruncated venue copy.
for (const spec of [
 {title:'Black Friday shopping — Ala Moana Center',place:'Ala Moana Center'},
 {title:'Black Friday shopping — Ala Moana Centre'},
 {title:'Black Friday shopping — Ala Moana State Monument'},
]) {
 assert.equal(builder.addToDay('2026-11-26',{...spec,time:'12:00'}).reason,'Closed Thu, Nov 26');
 const msg=[...nodes.values()].filter(n=>n.dataset.testid==='blocked-message').at(-1);
 assert(msg.innerHTML.includes('data-testid="blocked-reason">Ala Moana closed Thu</span>'));
 assert(msg.innerHTML.includes('<span class="db-blocked-actions"><button'));
}
// Dismiss and a successful add both clear feedback without changing blocked schedules.
let origin=node('library-entry');
builder.addToDay('2026-11-26',{title:'Bishop Museum',time:'12:00',origin});
let message=[...nodes.values()].filter(n=>n.dataset.testid==='blocked-message').at(-1);
assert.equal(message.parentNode,origin);message.querySelector('[data-testid=blocked-dismiss]').click();assert(message.removed);
builder.addToDay('2026-11-26',{title:'Bishop Museum',time:'12:00'});
message=[...nodes.values()].filter(n=>n.dataset.testid==='blocked-message').at(-1);
assert(message.parentNode!==root);builder.addToDay('2026-11-27',{title:'Walk',time:'16:00'});assert(message.removed);
// Exercise the actual move dialog handler, preserving the original on rejection.
function move(id,target){
 const row={dataset:{dbId:id,dbZone:'day'}};
 const button={dataset:{dbAction:'move-day'},closest:()=>row};
 root.click({target:{closest:selector=>selector==='[data-db-action]'?button:null}});
 const dialog=[...nodes.values()].filter(n=>n.dataset.testid==='move-day-dialog').at(-1);
 const form=dialog.querySelector('form');form.elements={date:{value:target},start:{value:'12:00'}};
 form.requestSubmit=()=>form.onsubmit({preventDefault(){},target:form});form.requestSubmit();
 return form;
}
let museum=builder.getDay().items.find(i=>i.title==='Bishop Museum');
move(museum.id,'2026-11-26');
assert(builder.schedule().days.find(d=>d.date==='2026-11-27').items.some(i=>i.id===museum.id));
assert(!builder.schedule().days.find(d=>d.date==='2026-11-26').items.some(i=>i.id===museum.id));
suggestion().click();
const scuba=builder.getDay().items.find(i=>i.title==='Scuba dive');
move(scuba.id,'2026-11-28');assert(suggestion());
assert(builder.schedule().days.find(d=>d.date==='2026-11-27').items.some(i=>i.id===scuba.id));
console.log('PASS closedOn, hours, reflow rejection, dive boundary, manual add/move and suggestions');
const template=ctx.Engine.buildTemplatePlan({destination:'Oahu',start:'2026-11-25',end:'2026-11-29',ages:[30],styles:['culture'],mustdos:'Bishop Museum'},ctx.Engine.matchDestination('Oahu'));
assert(!template.days.find(d=>d.date==='2026-11-26').items.some(i=>/Bishop Museum/.test(i.title)));
assert(template.days.find(d=>d.date==='2026-11-26').unscheduled.some(i=>/Bishop Museum/.test(i.title)));
const diveTemplate=ctx.Engine.buildTemplatePlan({destination:'Oahu',start:'2026-11-28',end:'2026-11-29',ages:[30],styles:['culture'],mustdos:'Scuba dive'},ctx.Engine.matchDestination('Oahu'));
assert(!diveTemplate.days.flatMap(d=>d.items).some(i=>/Scuba dive/.test(i.title)));
// A same-day time edit can cross the 24-hour boundary.
const editPlan={id:'rule-edit',end:'2026-11-28',days:[{date:'2026-11-26',items:[]},{date:'2026-11-27',items:[{id:'early-dive',title:'Scuba dive',time:'6:00 AM',desc:'About 1 h',kind:'activity'}]},{date:'2026-11-28',items:[]}]};
memory.set('gonow:daybuilder:rule-edit',JSON.stringify({flightTime:'8:00 AM'}));
const editRoot=node('edit-rule-root'),editBuilder=B.mount(editRoot,{plan:editPlan});editBuilder.selectDay('2026-11-27',false);
const form=node('edit-form');form.matches=selector=>selector==='.db-time-editor';form.closest=()=>({dataset:{dbId:'early-dive'}});form.elements={start:{value:'09:00',setAttribute(){}},duration:{value:'60',setAttribute(){}},end:{value:'10:00',dataset:{},setAttribute(){}}};form.dataset={lastManual:'duration'};form.checkValidity=()=>true;
editRoot.submit({preventDefault(){},target:form});
assert.equal(editBuilder.getDay().items[0].preferred,360);assert(suggestion());
suggestion().click();assert(editBuilder.schedule().days.find(d=>d.date==='2026-11-26').items.some(i=>i.id==='early-dive'));
console.log('PASS engine templates reject closure/diving and time-edit suggestion moves safely');
(async()=>{
 api.go('start');click('demo-oahu');await new Promise(r=>setTimeout(r,20));click('confirm-plan');
 const H=ctx.__renderHelpers;
 const tasks=H.prepTasks().filter(t=>t.group==='before');
 assert.equal(H.prepRemaining(),tasks.length);
 assert(tasks.every(t=>['book','id','insurance','visa'].includes(t.kind)&&t.text.length<=48&&t.text.split(/\s+/).length<=8));
 memory.set('gonow.prep.v1',JSON.stringify({[api.state.tripId]:{checked:{'notice-obsolete':true,'notice-Thanksgiving':true}}}));
 assert.equal(H.prepRemaining(),tasks.length);
 assert(!node('view').innerHTML.includes('prep-day-notes'));
 const tripsBefore=memory.get('gonow:trips'),savedTrips=JSON.parse(tripsBefore),saved=savedTrips.find(t=>t.id===api.state.tripId);
 saved.builder={days:Object.fromEntries(api.state.plan.days.map(d=>[d.date,{date:d.date,items:[],unscheduled:[]}]))};
 memory.set('gonow:trips',JSON.stringify(savedTrips));api.state.viewing='finished';
 assert.equal(H.prepRemaining(),tasks.length,'frozen prep ignores later draft removals');
 api.state.viewing='draft';assert.equal(H.prepRemaining(),1,'draft prep honors removed builder bookings');
 memory.set('gonow:trips',tripsBefore);api.state.viewing='draft';
 console.log('PASS frozen action count remains isolated from draft builder changes');
 api.state.answers.destination='Lisbon';api.state.answers.origin='Los Angeles';
 assert(H.prepTasks().some(t=>t.kind==='visa'));
 api.state.answers.international=true;
 assert(H.prepTasks().some(t=>t.kind==='visa'));assert(H.prepTasks().some(t=>t.text==='Bring passport'));
 api.state.answers.mode='local';api.state.plan.days.forEach(d=>d.items.forEach(i=>{i.booked=true;}));
 H.prepScreen();assert(!node('view').innerHTML.includes('id="trip-essentials"'));assert.equal(H.prepRemaining(),0);
 console.log('PASS action-only prep, short copy, legacy ticks, international actions and empty section hidden');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
