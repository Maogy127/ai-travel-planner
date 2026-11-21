#!/usr/bin/env node
/* Cold lookup timing: snapshot vs live Overpass (no Google Places). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const ctx = {window:{}, AbortController, setTimeout, clearTimeout, console, Date};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/city-index.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/placesource.js'), 'utf8'), ctx);
const S = ctx.window.GoNowPlaceSource;
const memory = () => { const map = new Map(); return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i]??null,get length(){return map.size;}}; };

async function timeLoad(label, city, opts){
  const t0 = Date.now();
  const source = S.create({
    storage: memory(),
    googleKey: '',
    snapshotBase: path.join(ROOT, 'data/cities') + '/',
    sleep: (ms) => new Promise(r => setTimeout(r, ms)),
    fetch: (...args) => fetch(...args)
  });
  const result = await source.load(city, null, opts);
  const ms = Date.now() - t0;
  return {label, city, ms, source: result.source || (result.fallback ? 'fallback' : 'none'), activities: result.catalog && result.catalog.activities ? result.catalog.activities.length : 0, restaurants: result.catalog && result.catalog.restaurants ? result.catalog.restaurants.length : 0, fallback: !!result.fallback};
}

(async () => {
  const cities = process.argv.slice(2).length ? process.argv.slice(2) : ['Shanghai', 'Hong Kong', 'Honolulu', 'Paris', 'Seattle'];
  const rows = [];
  for (const city of cities) {
    try { rows.push(await timeLoad('snapshot', city, {})); }
    catch (e) { rows.push({label:'snapshot', city, error: String(e.message||e)}); }
    try { rows.push(await timeLoad('live', city, {liveOnly:true})); }
    catch (e) { rows.push({label:'live', city, error: String(e.message||e)}); }
  }
  console.log(JSON.stringify(rows, null, 2));
  fs.mkdirSync('/tmp/gonow-prewarm-raw', {recursive:true});
  fs.writeFileSync('/tmp/gonow-prewarm-raw/timing.json', JSON.stringify(rows, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
