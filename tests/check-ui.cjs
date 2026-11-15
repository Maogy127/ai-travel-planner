// Render checks for classic scripts without a browser; layout is tested by verify-ui.py.
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
const ctx = {
  document: { addEventListener() {}, removeEventListener() {}, documentElement: { classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } } }, body: node('body'), getElementById: node, querySelector: selector => selector === '[data-testid="tab-content"]' ? null : node(selector), querySelectorAll: () => [], createElement: tag => node('el-' + tag + '-' + Math.random()), createTextNode: text => ({textContent: String(text)}) },
  localStorage: {get length(){return memory.size},key:i=>[...memory.keys()][i],getItem: k => memory.has(k)?memory.get(k):null,setItem: (k,v) => memory.set(k,v),removeItem:k=>memory.delete(k)},
  URL, URLSearchParams, location:{search:'?fast=1', hash:'', href:'http://local/index.html?fast=1'}, navigator:{},
  setTimeout, clearTimeout, setInterval, clearInterval, console,
  matchMedia: () => ({matches: false, addEventListener() {}}),
};
ctx.window=ctx;ctx.scrollTo=()=>{};ctx.addEventListener=()=>{};ctx.history={state:null,pushState(s){this.state=s},replaceState(s){this.state=s}};
vm.createContext(ctx);
const jsRoot = fs.existsSync(`${__dirname}/../site/js/app.js`) ? `${__dirname}/../site/js/` : `${__dirname}/../js/`;
for (const f of ['styles','catalog','oahu','engine','ai','credits','localinfo','affiliates','rings','diet','local','checkin','jetlag','dashboard','app']) vm.runInContext(fs.readFileSync(`${jsRoot}${f}.js`,'utf8'),ctx);
const api=ctx.__gonow;
const click=id=>node(`[data-testid="${id}"]`).click();
(async()=>{
  assert(node('view').innerHTML.includes('Come home better than you left.'));
  assert(!node('view').innerHTML.includes('sample-rings'));
assert(!node('view').innerHTML.includes('wellness-rings'));
assert(!node('view').innerHTML.includes('rank-badge'));
  node('photo-credits').onclick();
  assert.equal((node('view').innerHTML.match(/class="card credit-card"/g)||[]).length, ctx.PHOTO_CREDITS.length);
  assert.ok(ctx.PHOTO_CREDITS.length >= 22);
  assert.ok(ctx.PHOTO_CREDITS.some(c => c.source === 'Wikimedia Commons' && c.photoUrl.includes('commons.wikimedia.org')));
  assert(node('view').innerHTML.includes('Pexels License'));
  const normalize=text=>text.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().toLowerCase();
  for(const mode of ['trip','local']){
    api.state.answers.mode=mode;
    for(const step of (mode==='trip'?['dates','budget','who','ages','style','food','pace','musts']:['style','food','pace'])){
      node('view .question').innerHTML='';
      api.go(step);
      const html=node('view').innerHTML;
      const kicker=normalize(node('view .question').innerHTML.match(/<span>(.*?)<\/span>/)[1]);
      const title=normalize(html.match(/<h1[^>]*>(.*?)<\/h1>/)[1]);
      const subtitle=normalize(html.match(/<h1[^>]*>.*?<\/h1>\s*<p[^>]*>(.*?)<\/p>/)[1]);
      for(const copy of [title,subtitle, ...(step==='budget'?['What does this budget cover?']:[])].map(normalize)){
        assert(!copy.includes(kicker)&&!kicker.includes(copy),`${mode}/${step}: repeated copy`);
        const intent=t=>t.replace(/^(choose|pick) /,'select ').match(/^(select up to two|select what your budget)/)?.[0];
        assert(!intent(kicker)||intent(kicker)!==intent(copy),`${mode}/${step}: repeated instruction`);
      }
      if(step==='musts'){
        assert(!html.includes('A booked hotel'));assert(html.includes('Where are you staying?<input'));
        assert(html.indexOf('data-testid="stay-unsure"')>html.indexOf('data-testid="stay"'));
        api.state.answers.stay='Booked place';click('stay-unsure');
        assert.equal(api.state.answers.stay,'');assert(api.state.answers.stayUnsure);
        assert(node('view').innerHTML.includes('disabled aria-disabled="true"'));
      }
      if(step==='pace')assert(html.includes('Pace &amp; activities: '));
    }
  }
  api.state.answers.mode='local';api.state.answers.localCity='Oahu';api.go('local-plan');
  assert(!/source:/i.test(node('view').innerHTML));
  assert(node('view').innerHTML.includes('<time>8:00 AM</time>'));
  for(const time of node('view').innerHTML.matchAll(/<time>(.*?)<\/time>/g))assert(/^(?:[1-9]|1[0-2]):[0-5]\d (?:AM|PM)$/.test(time[1]));
  api.state.answers.mode='trip';
  api.go('start');click('demo-oahu');
  await new Promise(r=>setTimeout(r,20));
  assert.equal(api.state.screen,'prep');
  assert.equal((node('view').innerHTML.match(/data-testid="prep-section"/g)||[]).length,3);
  assert(!node('toast').innerHTML.includes('Your plan is ready.'));
  assert(node('view').innerHTML.includes('Before you go · 14 notes'));
  const assertPacking = n => {
    const html=node('view').innerHTML;
    assert(html.includes('Packed '+n+' of 51'));
    assert.equal((html.match(/id="packing-status"/g)||[]).length,1);
    assert(!/prep-packing-count|Packing \d+\/\d+/.test(html));
  };
  assertPacking(0);
  // Bind a real prep checkbox handler through the VM's DOM boundary.
  const packId=node('view').innerHTML.match(/data-prep-id="pack-([^" ]+)"/)[1];
  const packCheckbox={dataset:{prepId:'pack-'+packId,packId},checked:true};
  node('view').querySelectorAll=selector=>selector==='[data-prep-id]'?[packCheckbox]:[];
  api.go('prep');
  packCheckbox.onchange();
  assert.equal(node('packing-status').textContent,'Packed 1 of 51');
  assert.equal(node('[data-testid="trip-prep-button"]').textContent,'Trip prep · 14 left');
  api.go('prep');assertPacking(1);
  click('reset-packing');
  node('sheet [data-testid="modal-0"]').click();
  assertPacking(0);
  assert.equal(Object.values(api.state.packed).filter(Boolean).length,0);
  node('view').querySelectorAll=()=>[];
  assert(!node('view').innerHTML.includes('<small>From: '));
  assert(node('view').innerHTML.includes('class="prep-day-notes"'));
  click('prep-continue');
  assert(!node('toast').innerHTML.includes('Your plan is ready.'));
  assert.equal(api.state.screen,'plan');
  assert(node('view').innerHTML.includes('id="tab-content"'));
  assert(!/tab-packing|tab-tips|open-packing|tile-grid/.test(node('view').innerHTML));
  // Exercise the merged path with only the builder mount boundary stubbed.
  let mounted=false;
  ctx.DayBuilder={mount(root,context){mounted=true;assert.equal(root.dataset.testid,'db-root');assert.equal(typeof context.dayHead,'function');assert.equal(root.hidden,false);}};
  node('[data-testid="treasure-map"]').hidden=true;
  api.go('plan');assert(mounted);
  assert(!node('view').innerHTML.includes('class="itinerary-days"'));
  delete ctx.DayBuilder;
  api.go('plan');
  // This VM omits DayBuilder; supply the finished marker it normally exports.
  const dashboardTrips=JSON.parse(memory.get('gonow:trips'));dashboardTrips[0].snapshot={};
  memory.set('gonow:trips',JSON.stringify(dashboardTrips));
  for(const f of ['jetlag','checkin','daybuilder'])vm.runInContext(fs.readFileSync(`${jsRoot}${f}.js`,'utf8'),ctx);
  ctx.location.search='?fast=1&today=2026-11-26';
  api.go('home');
  assert(node('view').innerHTML.includes('data-testid="dashboard"'));
  assert.equal((node('view').innerHTML.match(/data-testid="trip-card"/g)||[]).length,1);
  assert(node('view').innerHTML.includes('In progress'));
  assert(node('view').innerHTML.includes('data-testid="today-block"'));
  assert(node('view').innerHTML.includes('Next · 5:35 AM'));
  ctx.DayBuilder=undefined;api.go('plan');ctx.location.search='?fast=1';
  const prepTrip=api.state.tripId;
  assert(JSON.parse(memory.get('gonow.prep.v1'))[prepTrip].seen);
  api.go('plan');assert.equal(api.state.screen,'plan');
  api.state.tripId='independent-prep-trip';api.go('plan');assert.equal(api.state.screen,'prep');
  api.state.tripId=prepTrip;api.go('plan');assert.equal(api.state.screen,'plan');
  assert(!node('view').innerHTML.includes('curated-notice'));
  assert(node('view').innerHTML.includes('Day 1 · Wed 25'));
  assert(node('view').innerHTML.includes('Nov 25–29, 2026'));
  assert.equal(node('toast').innerHTML,''); // Continue clears the ready toast.
  api.go('recommendations');assert.equal(node('toast').innerHTML,'');
  Object.assign(api.state.answers,{templateOahu:true,start:'2027-01-01',end:'2027-01-05',dietNeeds:['Vegan'],level:'gentle',stay:'My Hotel',mustdos:'Museum visit'});
  api.go('fork');click('fork-yes');api.go('musts');click('q-continue');
  await new Promise(r=>setTimeout(r,20));
  if(api.state.screen==='prep') click('prep-continue');
  assert(!node('view').innerHTML.includes('curated-notice'));
  const html=node('view').innerHTML;
  assert(api.state.plan.id.startsWith('template-oahu'));
  for(const text of ['Check the menu','Staying: My Hotel','Museum visit','You requested this','Jan 1–5, 2027','Day 1 · Fri, Jan 1']) assert(html.includes(text),text);
  assert(!html.includes('banner-photo')); // Explicit Oahu templates suppress the curated photo.
  assert.equal(api.state.plan.days[1].items.filter(i=>['rest','activity'].includes(i.kind)&&!i.requested).length,2);
  assert(html.includes('data-testid="diet-tag"'));
  assert(html.includes('Check the menu'));
  api.state.answers.dietNeeds=['Vegan'];
  const meal=api.state.plan.days.flatMap(d=>d.items).find(i=>i.kind==='meal');
  meal.desc='Vegan options listed';
  api.go('plan');
  assert(node('view').innerHTML.includes('data-testid="diet-tag"'));
  assert(node('view').innerHTML.includes('Vegan options listed'));
  assert(!node('view').innerHTML.includes('Diet info not confirmed — check the menu'));
  api.go('credits');assert.equal(node('toast').innerHTML,'');
  for(const [pace,level] of [['Easy','gentle'],['Moderate','active'],['Full-on','athlete']]){
    memory.set('gonow:answers',JSON.stringify({pace}));
    vm.runInContext(fs.readFileSync(`${jsRoot}app.js`,'utf8'),ctx);
    assert(node('view').innerHTML.includes('data-testid="dashboard"'));
    assert.equal(ctx.__gonow.state.answers.level,level);
    assert.equal(ctx.__gonow.state.answers.pace,pace);
  }
  memory.set('gonow:answers',JSON.stringify({styles:['relaxing','adventure']}));
  vm.runInContext(fs.readFileSync(`${jsRoot}app.js`,'utf8'),ctx);
  assert.equal(JSON.stringify(ctx.__gonow.state.answers.styles),'["nature"]');
  // An existing level takes precedence over an older legacy pace.
  memory.set('gonow:answers',JSON.stringify({pace:'Full-on',level:'unsure'}));
  vm.runInContext(fs.readFileSync(`${jsRoot}app.js`,'utf8'),ctx);
  assert.equal(ctx.__gonow.state.answers.level,'unsure');
  assert.equal(ctx.__gonow.state.answers.pace,'Moderate');
  console.log('PASS: hero/credits, demo routing, human dates/day chips, navigation toast clearing, automatic personalized Oahu template and age rules.');
})().catch(e=>{console.error(e);process.exitCode=1;});
