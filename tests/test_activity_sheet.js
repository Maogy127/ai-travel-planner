// Activity sheet regression: node tests/test_activity_sheet.js; no browser or network.
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
for (const f of ['styles','catalog','oahu','engine','ai','credits','localinfo','affiliates','rings','diet','checkin','jetlag','dashboard','daybuilder','app']) vm.runInContext(fs.readFileSync(`${jsRoot}${f}.js`,'utf8').replace('window.__gonow= {','window.__renderHelpers={builderContext,libraryEntries,renderLibraryResults,ensureLibrary,ensureCitySnapshot,libraryOpen,libraryRank}; window.__gonow= {'),ctx);
const api=ctx.__gonow;
const click=id=>node(`[data-testid="${id}"]`).click();
(async()=>{
 api.go('start');click('demo-oahu');await new Promise(r=>setTimeout(r,20));
 const h=ctx.__renderHelpers;
 ctx.DayBuilder.mount(node('sheet-builder'),{...h.builderContext(),plan:api.state.plan});
 const aside=node('sheet'),host=aside.querySelector('[data-testid=activity-results]');
 h.renderLibraryResults(aside,'a');
 for(const title of host.innerHTML.matchAll(/<h3>(.*?)<\/h3>/g))assert(title[1].length<=32,title[1]);
 h.renderLibraryResults(aside,'');assert.equal(host.innerHTML,'');
 h.renderLibraryResults(aside,'zzzz-not-a-place');assert(host.innerHTML.includes('No places found'));
 h.renderLibraryResults(aside,'Ala Moana');
 assert(host.innerHTML.includes('>Black Friday shopping</h3>'));
 assert(host.innerHTML.includes('activity-expand'));
 assert(!host.innerHTML.includes('Time (optional)'));
 assert(!host.innerHTML.includes('class="library-actions"'));
 const friday=h.libraryEntries().find(e=>e.title.includes('Black Friday shopping'));
 assert(friday);h.libraryOpen.add(friday.id);h.renderLibraryResults(aside,'Ala Moana');
 assert(host.innerHTML.includes('Time (optional)'));
 assert(host.innerHTML.includes('class="library-actions"'));
 assert(host.innerHTML.includes('>Add</button>'));
 assert(host.innerHTML.includes('>Edit time</button>'));
 assert(host.innerHTML.includes('>Add again</button>'));
 assert(!/Add to trip|Edit scheduled time|Optional clock time/.test(host.innerHTML));
 h.renderLibraryResults(aside,'cocktail');
 assert(host.innerHTML.includes('Requires age 21+'));
 assert(!host.innerHTML.includes('Time (optional)'));
 const bar=h.libraryEntries().find(e=>/Sunset bar/.test(e.title));
 assert(bar);h.libraryOpen.add(bar.id);h.renderLibraryResults(aside,'cocktail');
 assert(host.innerHTML.includes('activity-add" disabled'));
 assert(!host.innerHTML.includes('activity-add-again'));
 assert.equal((host.innerHTML.match(/Alcohol service is 21/g)||[]).length,1);
 h.renderLibraryResults(aside,'optional drinks');
 const dinner=h.libraryEntries().find(e=>/optional drinks/i.test(e.title));
 assert(dinner);h.libraryOpen.add(dinner.id);h.renderLibraryResults(aside,'optional drinks');
 assert(!host.innerHTML.includes('activity-add" disabled'));
 assert(!host.innerHTML.includes('activity-age-notice'));
 assert(host.innerHTML.includes('does not block'));
 const sunset=h.libraryEntries().filter(e=>h.libraryRank(e,'sunset')>0);
 assert(sunset.some(e=>/sunset/i.test(e.title)));
 const ranked=sunset.slice().sort((a,b)=>h.libraryRank(b,'sunset')-h.libraryRank(a,'sunset'));
 assert(h.libraryRank(ranked[0],'sunset')===3);
 const barEntry=h.libraryEntries().find(e=>/Sunset bar/.test(e.title));
 assert.equal(h.libraryRank(barEntry,'alcohol'),1);
 assert(h.libraryEntries().filter(e=>h.libraryRank(e,'alcohol')>0).every(e=>!(e.title+' '+(e.place||'')).toLowerCase().includes('alcohol')));
 const island=h.libraryEntries().find(e=>/Magic Island/.test(e.title));
 assert.equal(h.libraryRank(island,'5:48'),1);
 assert.equal(h.libraryRank(island,'sight'),1);
 console.log('PASS activity search copy, compact expand, existing-only actions and preserved age rules');
})().catch(error=>{console.error(error);process.exitCode=1;});
