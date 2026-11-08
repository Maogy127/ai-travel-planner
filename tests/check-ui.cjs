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
  document: { addEventListener() {}, removeEventListener() {}, documentElement: { classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } } }, body: node('body'), getElementById: node, querySelector: node, querySelectorAll: () => [], createElement: tag => node('el-' + tag + '-' + Math.random()), createTextNode: text => ({textContent: String(text)}) },
  localStorage: {get length(){return memory.size},key:i=>[...memory.keys()][i],getItem: k => memory.has(k)?memory.get(k):null,setItem: (k,v) => memory.set(k,v),removeItem:k=>memory.delete(k)},
  URL, URLSearchParams, location:{search:'?fast=1', hash:'', href:'http://local/index.html?fast=1'}, navigator:{},
  setTimeout, clearTimeout, setInterval, clearInterval, console,
  matchMedia: () => ({matches: false, addEventListener() {}}),
};
ctx.window=ctx;ctx.scrollTo=()=>{};ctx.addEventListener=()=>{};ctx.history={state:null,pushState(s){this.state=s},replaceState(s){this.state=s}};
vm.createContext(ctx);
const jsRoot = fs.existsSync(`${__dirname}/../site/js/app.js`) ? `${__dirname}/../site/js/` : `${__dirname}/../js/`;
for (const f of ['catalog','oahu','engine','ai','credits','localinfo','affiliates','app']) vm.runInContext(fs.readFileSync(`${jsRoot}${f}.js`,'utf8'),ctx);
const api=ctx.__gonow;
const click=id=>node(`[data-testid="${id}"]`).click();
(async()=>{
  assert(node('view').innerHTML.includes('Photo:'));
  assert(node('view').innerHTML.includes(ctx.PHOTO_CREDITS[0].alt));
  node('photo-credits').onclick();
  assert.equal((node('view').innerHTML.match(/class="card credit-card"/g)||[]).length, ctx.PHOTO_CREDITS.length);
  assert.ok(ctx.PHOTO_CREDITS.length >= 22);
  assert.ok(ctx.PHOTO_CREDITS.some(c => c.source === 'Wikimedia Commons' && c.photoUrl.includes('commons.wikimedia.org')));
  assert(node('view').innerHTML.includes('Pexels License'));
  api.go('start');click('demo-oahu');
  await new Promise(r=>setTimeout(r,20));
  assert.equal(api.state.screen,'plan');
  assert(!node('view').innerHTML.includes('curated-notice'));
  assert(node('view').innerHTML.includes('Day 1 · Wed 25'));
  assert(node('view').innerHTML.includes('Nov 25–29, 2026'));
  assert(node('toast').innerHTML.includes('ready'));
  api.go('recommendations');assert.equal(node('toast').innerHTML,'');
  Object.assign(api.state.answers,{start:'2027-01-01',end:'2027-01-05',food:['Vegan'],pace:'Easy',stay:'My Hotel',mustdos:'Museum visit'});
  api.go('fork');click('fork-yes');api.go('musts');click('q-continue');
  await new Promise(r=>setTimeout(r,20));
  assert(node('view').innerHTML.includes('curated-notice'));
  click('build-template');await new Promise(r=>setTimeout(r,20));
  const html=node('view').innerHTML;
  assert(api.state.plan.id.startsWith('template-oahu'));
  for(const text of ['Vegan','Staying: My Hotel','Museum visit','You requested this','Jan 1–5, 2027','Day 1 · Fri, Jan 1','age-rules']) assert(html.includes(text),text);
  assert(!html.includes('banner-photo'));
  assert.equal(api.state.plan.days[1].items.filter(i=>['rest','activity'].includes(i.kind)&&!i.requested).length,2);
  api.go('credits');assert.equal(node('toast').innerHTML,'');
  console.log('PASS: hero/credits, demo routing, human dates/day chips, navigation toast clearing, mismatch notice, personalized Oahu template and age rules.');
})().catch(e=>{console.error(e);process.exitCode=1;});
