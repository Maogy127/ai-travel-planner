// Demo audit: node tests/test_demo_days.js; no browser or network.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const nodes = new Map();
function node(key) {
  if (!nodes.has(key)) {
    const el = {
      innerHTML: '', textContent: '', value: '', isConnected: true, className: '', hidden: false,
      style: {}, dataset: {}, children: [],
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
for (const f of ['styles','catalog','oahu','engine','ai','credits','localinfo','affiliates','rings','diet','checkin','jetlag','dashboard','daybuilder','app']) vm.runInContext(fs.readFileSync(`${jsRoot}${f}.js`,'utf8').replace('window.__gonow= {','window.__renderHelpers={builderContext,planBanner,dayHeadHTML,dayModel,rememberTrip,openSaved,normalizeAnswers,trackChoice,trackToggle,section,pruneEmptySections,paceDayHTML,bindHotel}; window.__gonow= {'),ctx);
const api=ctx.__gonow;
const click=id=>node(`[data-testid="${id}"]`).click();
(async()=>{
 api.go('start');click('demo-oahu');await new Promise(r=>setTimeout(r,20));
 const h=ctx.__renderHelpers;
 const credits=JSON.parse(fs.readFileSync(`${__dirname}/../credits.json`,'utf8'));
 const expectedPhotos={
  '2026-11-25-0':'hnl','2026-11-25-1':'kahala-hotel',
  '2026-11-26-1':'diamond-head-summit','2026-11-26-5':'kualoa',
  '2026-11-26-8':'kahala-lagoon','2026-11-26-11':'halekulani',
  '2026-11-27-1':'kewalo','2026-11-28-1':'lanikai',
  '2026-11-28-4':'makapuu','2026-11-28-9':'waikiki-sunset','2026-11-29-0':'hnl'
 };
 for(const track of ['together','each']){
  api.state.answers.track=track;
  const context=h.builderContext();
  const mounted=ctx.DayBuilder.mount(node('demo-'+track),{...context,plan:api.state.plan});
  for(const day of ctx.OAHU_SAMPLE.days){
   // Standalone source data and the actual app mount must both stay clear.
   for(const result of [ctx.DayBuilder.reflow(ctx.DayBuilder.buildSuggested(day.date),{ages:[18,19],track}),mounted.schedule().days.find(d=>d.date===day.date)]){
    assert.equal((result.conflicts||[]).length,0,`${track} ${day.date}: ${JSON.stringify(result.conflicts)}`);
    assert.equal((result.unscheduled||[]).filter(i=>i.blockedReason).length,0,`${day.date}: blocked demo stop`);
    for(const item of result.items){
     assert.equal((item.notes||[]).length,0,item.title);
     const title=context.titleFor(item.sourceId,day.date,item)||item.title;
     const m=title.match(/\b(\d{1,2}(:\d{2})?\s?(AM|PM))\b/i);
     if(m){const clock=m[1].match(/(\d{1,2})(?::(\d{2}))?\s?(AM|PM)/i);const minutes=(+clock[1]%12)*60+ +(clock[2]||0)+(clock[3].toUpperCase()==='PM'?720:0);assert.equal(item.start,minutes,title);}
     const photo=context.photoFor(item.sourceId);
     if(photo){assert.equal(photo,'images/activity-'+expectedPhotos[item.sourceId]+'.jpg',title);assert(fs.existsSync(`${__dirname}/../${photo}`));assert(credits.some(c=>'images/'+c.id+'.jpg'===photo));}
    }
    if(day.date==='2026-11-26'){
     const diamond=result.items.find(i=>/Diamond Head —/.test(i.title));
     assert(diamond.locked);assert.equal(diamond.start,360);assert.equal(diamond.end,450);
     assert(/diamond-head-summit/.test(context.photoFor(diamond.sourceId)));
     assert(!/kualoa/.test(context.photoFor(diamond.sourceId)));
     assert(result.items.find(i=>i.to==='Diamond Head').end<=diamond.start);
    }
    if(day.date==='2026-11-28')assert(result.items.some(i=>i.sourceId==='2026-11-28-9'),'Waikiki sunset stays scheduled');
   }
   mounted.selectDay(day.date,false);
   assert(!node('demo-'+track+' .db-content').innerHTML.includes('data-testid="db-note"'));
   console.log('PASS demo day',track,day.date);
  }
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
