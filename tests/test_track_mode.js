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
      showModal() {}, close() {}, remove() {}, append() {}, prepend() {}, after() {}, before() {},
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
  document: { addEventListener() {}, removeEventListener() {}, documentElement: { classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } } }, body: node('body'), getElementById: node, querySelector: selector => selector === '[data-testid="tab-content"]' ? null : node(selector), querySelectorAll: () => [], createElement: tag => node('el-' + tag + '-' + Math.random()), createTextNode: text => ({textContent: String(text)}) },
  localStorage: {get length(){return memory.size},key:i=>[...memory.keys()][i],getItem: k => memory.has(k)?memory.get(k):null,setItem: (k,v) => memory.set(k,v),removeItem:k=>memory.delete(k)},
  TextEncoder, TextDecoder, URL, URLSearchParams, location:{search:'?fast=1', hash:'', href:'http://local/index.html?fast=1'}, navigator:{},
  requestAnimationFrame: fn=>fn(), setTimeout, clearTimeout, setInterval, clearInterval, console,
  matchMedia: query => ({matches: false, addEventListener(event,fn) {mediaListeners.set(query,fn);}}),
};
ctx.window=ctx;ctx.scrollTo=()=>{};ctx.addEventListener=(event,fn)=>{if(!windowListeners.has(event))windowListeners.set(event,[]);windowListeners.get(event).push(fn);};ctx.history={state:null,pushState(s){this.state=s},replaceState(s){this.state=s}};
vm.createContext(ctx);
const jsRoot = fs.existsSync(`${__dirname}/../site/js/app.js`) ? `${__dirname}/../site/js/` : `${__dirname}/../js/`;
for (const f of ['styles','catalog','oahu','engine','ai','credits','localinfo','affiliates','rings','diet','checkin','jetlag','dashboard','daybuilder','app']) vm.runInContext(fs.readFileSync(`${jsRoot}${f}.js`,'utf8').replace('window.__gonow= {','window.__renderHelpers={builderContext,planBanner,dayHeadHTML,dayModel,rememberTrip,openSaved,normalizeAnswers,trackChoice,trackToggle,section,pruneEmptySections,paceDayHTML,sleepNudgeHTML,bindPace,bindHotel}; window.__gonow= {'),ctx);
const api=ctx.__gonow;
const click=id=>node(`[data-testid="${id}"]`).click();
function smoke(label){
 const helpers=ctx.__renderHelpers, plan=api.state.plan;
 assert(plan && plan.days.length>0);
 helpers.planBanner(plan);
 for(let i=0;i<plan.days.length;i++){
  const html=helpers.dayHeadHTML(plan.days[i],i,helpers.dayModel(plan.days[i],i));
  assert(html.includes('wellness-rings'));
  if(plan.id.startsWith('template-'))assert((html.match(/data-testid="travel-chip"/g)||[]).length>3);
 }
 const context=helpers.builderContext();let heads=0;
 const head=context.dayHead;context.dayHead=(...args)=>{heads++;return head(...args);};
 const builder=ctx.DayBuilder.mount(node('smoke-'+label),{...context,plan});
 for(const day of plan.days)builder.selectDay(day.date,false);
 assert(heads>=plan.days.length,'day headers evaluated');
 builder.schedule();builder.exportState();builder.renderPrint(true);builder.renderPrint(false);
 assert(ctx.DayBuilder.trayItems().every(i=>i.id && i.title));
}

(async()=>{
 const h=ctx.__renderHelpers;let a=api.state.answers;
 for(const who of ['solo','couple','friends','family']){
   Object.assign(a,{who,adults:3,kids:who==='family'?1:0,track:'together'});
   api.go('who');
   assert.equal(h.trackChoice().includes('track-choice'),who!=='solo');
   if(who!=='solo')assert(/value="together" checked/.test(h.trackChoice()));
 }
 const migrate=x=>h.normalizeAnswers(x).track;
 assert.equal(migrate({travelers:[]}), 'together');
 assert.equal(migrate({travelers:[{level:'active'},{level:'active'}]}),'together');
 assert.equal(migrate({travelers:[{level:'active'},{level:'unsure'}]}),'together');
 assert.equal(migrate({travelers:[{level:'active'},{level:'gentle'}]}),'each');
 assert.equal(migrate({travelers:[{name:'Sam'}]}),'each');
 assert.equal(migrate({travelers:[{name:'Traveler 2'}]}),'together');
 memory.set('gonow.checkin.v1',JSON.stringify({'2026-11-28':{'traveler-0':{done:true}}}));
 assert.equal(migrate({}),'together');
 memory.set('gonow.checkin.v1',JSON.stringify({'2026-11-28':{'traveler-1':{done:true}}}));
 assert.equal(migrate({}),'each');assert.equal(migrate({track:'together'}),'together');
 memory.delete('gonow.checkin.v1');
 assert.equal(h.section('Empty','<p> &nbsp; </p>'),'');
 assert(h.section('Controls','<input>'));assert(h.section('Text','<p>Hello</p>'));
 let removed=[];
 const head=(tag,body)=>({tagName:tag,nextSibling:body?{nodeName:'DIV',outerHTML:body,nextSibling:null}:null,remove(){removed.push(tag)},parentElement:{tagName:'DETAILS',remove(){removed.push('DETAILS')}}});
 h.pruneEmptySections({querySelectorAll:()=>[head('H2','<p> </p>'),head('SUMMARY','<div></div>'),head('H3','<input>'),head('H4','<p>Content</p>')]});
 assert.deepEqual(removed,['DETAILS','H2']);

 api.go('start');click('demo-oahu');await new Promise(r=>setTimeout(r,20));
 const sample=api.state.plan;a=api.state.answers;
 for(const destination of ['Oahu sample','Oahu','Lisbon']){
  Object.assign(a,{destination,templateOahu:true,start:'2027-04-10',end:'2027-04-14',ages:[30,31,32],level:'active'});
  api.state.plan=destination==='Oahu sample'?sample:await ctx.AI.generatePlan(a,{fast:true});api.state.screen='plan';
  for(const [who,track,n] of [['solo','together',1],['couple','together',2],['couple','each',2],['friends','each',3]]){
   Object.assign(a,{who,track,adults:n,kids:0,travelers:[]});
   for(const [i,day] of api.state.plan.days.entries()){
    const html=h.dayHeadHTML(day,i,h.dayModel(day,i));
    assert(!/Sleep timing|Suggestions|day-guidance|Transport &amp; conditions|Typical conditions|Staying at/.test(html));
    assert.equal((html.match(/Getting around · /g)||[]).length,day.car&&(day.car.level||day.car.note)?1:0);
    const noTransport=h.dayHeadHTML({...day,car:{}},i,h.dayModel(day,i));
    assert.equal(noTransport.includes('data-testid="day-info"'),api.state.plan.id.startsWith('template-')&&day.items.length>1); // Template routes are real content.
    for(const id of ['traveler-name','traveler-pace','group-section'])assert.equal(html.includes('data-testid="'+id+'"'),track==='each');
    assert.equal((html.match(/data-testid="traveler-name"/g)||[]).length,track==='each'?n:0);
    assert.equal((html.match(/<summary[^>]*>Pace/g)||[]).length,1);
    assert(!html.includes('Pace not set yet'));
    assert(!/<(?:summary|h[2-4])[^>]*>[^<]*<\/(?:summary|h[2-4])>\s*<\/(?:details|section)>/.test(html));
    assert(!/<summary>[^<]*<\/summary>\s*<\/details>/.test(html));
   }
   console.log('PASS all days',destination,who,track,n);
  }
 }
 // Short-night header stays conditional, compact, and preserves reserved times.
 const nudgeDay={date:'2026-11-26'}, reserved=[{id:'early',title:'Reserved tour',start:335,end:400,locked:true}];
 const nudgeContext={previous:{date:'2026-11-25',items:[]},ringResult:{values:{sleep:5.75},goals:{sleep:8},sleepDetail:{first:reserved[0]}}};
 const nudge=h.sleepNudgeHTML(nudgeDay,reserved,nudgeContext);
 assert(nudge.includes('Short night · 5h45 sleep'));
 assert(nudge.includes('sleep-nudge-keep') && nudge.includes('sleep-nudge-accept'));
 assert(nudge.includes('reserved times') && !nudge.includes('data-testid="sleep-proposal-apply"'));
 // Airport-first and fixed-flight mornings never offer a later start.
 for(const flags of [{kind:'flight'},{id:'pick-airport'},{kind:'travel',title:'Uber to HNL'},{locked:true,airport:true},{locked:true,tags:['flight']}]){
  assert.equal(h.sleepNudgeHTML(nudgeDay,[{...reserved[0],...flags}],nudgeContext),'');
 }
 assert(nudge.includes('>Later start</button>')&&nudge.includes('>Keep</button>')); // Short labels retain existing actions.
 const proposal={hidden:true}, buttons={};let nudgeRemoved=false;
 const box={dataset:{date:nudgeDay.date},remove(){nudgeRemoved=true},querySelector(selector){
  if(selector==='[data-testid=sleep-proposal]')return proposal;
  if(selector==='[data-testid=sleep-proposal-apply]')return null;
  return buttons[selector] ||= {};
 }};
 h.bindPace({querySelectorAll:selector=>selector==='[data-testid=sleep-nudge]'?[box]:[]});
 buttons['[data-testid=sleep-nudge-accept]'].onclick();assert.equal(proposal.hidden,false);
 buttons['[data-testid=sleep-proposal-cancel]'].onclick();assert.equal(proposal.hidden,true);
 buttons['[data-testid=sleep-nudge-keep]'].onclick();assert(nudgeRemoved);
 assert.equal(h.sleepNudgeHTML(nudgeDay,reserved,nudgeContext),'');
 memory.delete('gonow.sleep-nudge.'+nudgeDay.date);
 nudgeContext.ringResult.values.sleep=7.5;
 assert.equal(h.sleepNudgeHTML(nudgeDay,reserved,nudgeContext),'');
 console.log('PASS short-night copy, reserved protection, suggestion/cancel and persisted keep');
 Object.assign(a,{who:'couple',track:'together'});h.bindHotel();click('track-toggle');assert.equal(a.track,'each');
 assert.equal(JSON.parse(memory.get('gonow:answers')).track,'each');
 assert.equal(JSON.parse(memory.get('gonow:trips')).find(t=>t.id===api.state.tripId).answers.track,'each');
 click('track-toggle');assert.equal(a.track,'together');
 Object.assign(a,{who:'solo'});assert.equal(h.trackToggle(),'');
 console.log('PASS track choices, migration, one-tap persistence, section helper and pace audits');
})().catch(e=>{console.error(e);process.exitCode=1;});
