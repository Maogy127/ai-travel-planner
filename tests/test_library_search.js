// City snapshot + ranked library search: node tests/test_library_search.js
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
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
const rootDir = path.resolve(__dirname, '..');
const ctx = {
  document: { addEventListener() {}, removeEventListener() {}, documentElement: { classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } } }, body: node('body'), getElementById: node, querySelector: selector => selector === '[data-testid="tab-content"]' ? null : node(selector), querySelectorAll: () => [], createElement: tag => node('el-' + tag + '-' + Math.random()), createTextNode: text => ({textContent: String(text)}) },
  localStorage: {get length(){return memory.size},key:i=>[...memory.keys()][i],getItem: k => memory.has(k)?memory.get(k):null,setItem: (k,v) => memory.set(k,v),removeItem:k=>memory.delete(k)},
  TextEncoder, TextDecoder, URL, URLSearchParams, location:{search:'?fast=1', hash:'', href:'http://local/index.html?fast=1', protocol:'http:'}, navigator:{},
  requestAnimationFrame: fn=>fn(), setTimeout, clearTimeout, setInterval, clearInterval, console,
  matchMedia: query => ({matches: false, addEventListener() {}}),
  AbortController, fetch: async (url) => {
    const raw=String(url);
    const file=raw.replace(/^https?:\/\/[^/]+\//,'').split('?')[0];
    const local=path.join(rootDir, file);
    if (fs.existsSync(local)) {
      const body=fs.readFileSync(local,'utf8');
      return {ok:true, status:200, json:async()=>JSON.parse(body), text:async()=>body};
    }
    return {ok:false, status:404, json:async()=>{throw new Error('missing '+raw);}, text:async()=>''};
  }
};
ctx.window=ctx;ctx.scrollTo=()=>{};ctx.addEventListener=()=>{};ctx.history={state:null,pushState(s){this.state=s},replaceState(s){this.state=s}};
vm.createContext(ctx);
const jsRoot = fs.existsSync(`${__dirname}/../site/js/app.js`) ? `${__dirname}/../site/js/` : `${__dirname}/../js/`;
for (const f of ['styles','catalog','oahu','engine','ai','credits','localinfo','affiliates','rings','diet','checkin','jetlag','dashboard','daybuilder','city-index','placesource','app']) {
  vm.runInContext(fs.readFileSync(`${jsRoot}${f}.js`,'utf8').replace('window.__gonow= {','window.__renderHelpers={builderContext,libraryEntries,renderLibraryResults,ensureLibrary,ensureCitySnapshot,libraryOpen,libraryRank}; window.__gonow= {'),ctx);
}
const api=ctx.__gonow;
const h=ctx.__renderHelpers;
const aside=node('sheet'),host=aside.querySelector('[data-testid=activity-results]');

(async()=>{
  api.state.answers={destination:'Shanghai',start:'2026-11-25',end:'2026-11-28',ages:[]};
  api.state.plan={id:'shanghai-picks-test',title:'Shanghai days',start:'2026-11-25',end:'2026-11-28',days:[{date:'2026-11-25',items:[]}]};
  const catalog=await h.ensureCitySnapshot();
  assert(catalog && catalog.activities && catalog.activities.length>=10, 'shanghai snapshot should load');
  const entries=h.libraryEntries();
  const bunds=entries.filter(e=>/^The Bund\b/i.test(e.title));
  assert(bunds.length===1, 'bund should appear once from snapshot');
  assert(entries.some(e=>e.kind==='meal'), 'restaurants should be searchable');
  h.renderLibraryResults(aside,'bund');
  assert(host.innerHTML.includes('The Bund'));
  assert(host.innerHTML.includes('activity-expand'));
  assert(!host.innerHTML.includes('Time (optional)'));
  h.renderLibraryResults(aside,'museum');
  const titles=[...host.innerHTML.matchAll(/<h3>(.*?)<\/h3>/g)].map(m=>m[1]);
  const named=titles.findIndex(t=>/Shanghai Museum/i.test(t));
  const categoryOnly=titles.findIndex(t=>/Power Station of Art/i.test(t));
  assert(named>=0 && categoryOnly>=0 && named<categoryOnly, 'title museum hits should rank above category-only hits: '+titles.slice(0,8).join(' | '));
  assert(h.libraryRank(entries.find(e=>/Power Station of Art/i.test(e.title)),'museum')===1);
  assert(h.libraryRank(entries.find(e=>/Shanghai Museum/i.test(e.title)),'museum')===3);

  api.go('start');
  const click=id=>node(`[data-testid="${id}"]`).click();
  click('demo-oahu');
  await new Promise(r=>setTimeout(r,20));
  ctx.DayBuilder.mount(node('sheet-builder'),{...h.builderContext(),plan:api.state.plan});
  const oahu=h.libraryEntries();
  assert(!oahu.some(e=>/USS Missouri/i.test(e.title)), 'Oahu must not swap in the Honolulu snapshot');
  assert(oahu.some(e=>/Magic Island/i.test(e.title)), 'Oahu keeps the curated tray');
  console.log('PASS city snapshot search, ranked matching, compact markup, and Oahu curated catalog');
})().catch(error=>{console.error(error);process.exitCode=1;});
