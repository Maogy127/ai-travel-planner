#!/usr/bin/env node
/* Build static, versioned place snapshots for popular cities from free OSM/Wikidata sources.
   Never calls Google Places. Respects Overpass rate limits. Resumable. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data/cities');
const RAW = process.env.PREWARM_RAW || '/tmp/gonow-prewarm-raw';
const VERSION = 1;
const CONTACT = 'gonow-preview@users.noreply.github.com';
const UA = 'GoNow-prewarm/1.0 (https://github.com/Maogy127/ai-travel-planner; ' + CONTACT + ')';
const OVERPASS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];
const SLEEP_MS = process.argv.includes('--no-overpass') ? 1500 : 7000;
const BETWEEN_QUERY_MS = 3000;
const RETRIES = 4;

const CITIES = [
  {slug:'los-angeles', name:'Los Angeles', lat:34.0522, lng:-118.2437, radius:20000, aliases:['la','lax','los angeles (lax)','los angeles, ca']},
  {slug:'new-york', name:'New York', lat:40.7128, lng:-74.0060, radius:15000, aliases:['nyc','ny','new york city','new york (nyc)','manhattan']},
  {slug:'san-francisco', name:'San Francisco', lat:37.7749, lng:-122.4194, radius:12000, aliases:['sf','sfo','san francisco (sfo)']},
  {slug:'honolulu', name:'Honolulu', lat:21.3069, lng:-157.8583, radius:25000, aliases:['oahu','waikiki','hawaii','honolulu (hnl)','hnl']},
  {slug:'las-vegas', name:'Las Vegas', lat:36.1699, lng:-115.1398, radius:15000, aliases:['vegas']},
  {slug:'seattle', name:'Seattle', lat:47.6062, lng:-122.3321, radius:12000, aliases:['sea','seattle (sea)']},
  {slug:'chicago', name:'Chicago', lat:41.8781, lng:-87.6298, radius:14000, aliases:['ord','chicago (ord)']},
  {slug:'miami', name:'Miami', lat:25.7617, lng:-80.1918, radius:14000, aliases:[]},
  {slug:'san-diego', name:'San Diego', lat:32.7157, lng:-117.1611, radius:16000, aliases:[]},
  {slug:'washington-dc', name:'Washington DC', lat:38.9072, lng:-77.0369, radius:12000, aliases:['dc','washington','washington, dc','iad','dca']},
  {slug:'boston', name:'Boston', lat:42.3601, lng:-71.0589, radius:12000, aliases:[]},
  {slug:'austin', name:'Austin', lat:30.2672, lng:-97.7431, radius:14000, aliases:[]},
  {slug:'denver', name:'Denver', lat:39.7392, lng:-104.9903, radius:14000, aliases:[]},
  {slug:'portland', name:'Portland', lat:45.5152, lng:-122.6784, radius:12000, aliases:['portland, or']},
  {slug:'new-orleans', name:'New Orleans', lat:29.9511, lng:-90.0715, radius:12000, aliases:['nola']},
  {slug:'nashville', name:'Nashville', lat:36.1627, lng:-86.7816, radius:12000, aliases:[]},
  {slug:'phoenix', name:'Phoenix', lat:33.4484, lng:-112.0740, radius:16000, aliases:[]},
  {slug:'philadelphia', name:'Philadelphia', lat:39.9526, lng:-75.1652, radius:12000, aliases:['philly']},
  {slug:'tokyo', name:'Tokyo', lat:35.6762, lng:139.6503, radius:14000, aliases:['tokyo, japan','nrt','hnd','tokyo (nrt)','tokyo (hnd)']},
  {slug:'kyoto', name:'Kyoto', lat:35.0116, lng:135.7681, radius:14000, aliases:['kyoto, japan']},
  {slug:'osaka', name:'Osaka', lat:34.6937, lng:135.5023, radius:14000, aliases:[]},
  {slug:'seoul', name:'Seoul', lat:37.5665, lng:126.9780, radius:14000, aliases:[]},
  {slug:'shanghai', name:'Shanghai', lat:31.2304, lng:121.4737, radius:14000, aliases:['pvg','shanghai (pvg)']},
  {slug:'beijing', name:'Beijing', lat:39.9042, lng:116.4074, radius:14000, aliases:['pek','beijing (pek)']},
  {slug:'hong-kong', name:'Hong Kong', lat:22.3193, lng:114.1694, radius:14000, aliases:['hk','hkg','hong kong (hkg)']},
  {slug:'taipei', name:'Taipei', lat:25.0330, lng:121.5654, radius:14000, aliases:[]},
  {slug:'singapore', name:'Singapore', lat:1.3521, lng:103.8198, radius:14000, aliases:[]},
  {slug:'bangkok', name:'Bangkok', lat:13.7563, lng:100.5018, radius:14000, aliases:[]},
  {slug:'bali', name:'Bali', lat:-8.5500, lng:115.2000, radius:30000, aliases:['ubud','denpasar','canggu','seminyak','bali, indonesia']},
  {slug:'london', name:'London', lat:51.5074, lng:-0.1278, radius:12000, aliases:['london, uk','lhr','london (lhr)']},
  {slug:'paris', name:'Paris', lat:48.8566, lng:2.3522, radius:10000, aliases:['paris, france']},
  {slug:'barcelona', name:'Barcelona', lat:41.3874, lng:2.1686, radius:10000, aliases:['barcelona, spain']},
  {slug:'rome', name:'Rome', lat:41.9028, lng:12.4964, radius:10000, aliases:['roma']},
  {slug:'lisbon', name:'Lisbon', lat:38.7223, lng:-9.1393, radius:10000, aliases:['lisboa','lisbon, portugal']},
  {slug:'amsterdam', name:'Amsterdam', lat:52.3676, lng:4.9041, radius:10000, aliases:[]},
  {slug:'berlin', name:'Berlin', lat:52.5200, lng:13.4050, radius:12000, aliases:[]},
  {slug:'madrid', name:'Madrid', lat:40.4168, lng:-3.7038, radius:10000, aliases:[]},
  {slug:'prague', name:'Prague', lat:50.0755, lng:14.4378, radius:10000, aliases:['praha']},
  {slug:'vienna', name:'Vienna', lat:48.2082, lng:16.3738, radius:10000, aliases:['wien']},
  {slug:'florence', name:'Florence', lat:43.7696, lng:11.2558, radius:8000, aliases:['firenze']},
  {slug:'venice', name:'Venice', lat:45.4408, lng:12.3155, radius:8000, aliases:['venezia']},
  {slug:'athens', name:'Athens', lat:37.9838, lng:23.7275, radius:10000, aliases:[]},
  {slug:'istanbul', name:'Istanbul', lat:41.0082, lng:28.9784, radius:14000, aliases:[]},
  {slug:'dubai', name:'Dubai', lat:25.2048, lng:55.2708, radius:18000, aliases:[]},
  {slug:'sydney', name:'Sydney', lat:-33.8688, lng:151.2093, radius:14000, aliases:[]},
  {slug:'melbourne', name:'Melbourne', lat:-37.8136, lng:144.9631, radius:12000, aliases:[]},
  {slug:'auckland', name:'Auckland', lat:-36.8509, lng:174.7645, radius:14000, aliases:[]},
  {slug:'vancouver', name:'Vancouver', lat:49.2827, lng:-123.1207, radius:12000, aliases:[]},
  {slug:'toronto', name:'Toronto', lat:43.6532, lng:-79.3832, radius:12000, aliases:[]},
  {slug:'mexico-city', name:'Mexico City', lat:19.4326, lng:-99.1332, radius:14000, aliases:['cdmx','ciudad de mexico']}
];

function loadSource(){
  const ctx = {window:{}, AbortController, setTimeout, clearTimeout, console, Date};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/placesource.js'), 'utf8'), ctx);
  return ctx.window.GoNowPlaceSource;
}
const S = loadSource();
const source = S.create({storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{},key:()=>null,length:0}, fetch: async () => { throw new Error('no live fetch in catalog helper'); }, sleep: async () => {}, now: Date.now});

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function fetchText(url, init, timeout=90000){
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, Object.assign({signal: ac.signal, headers: {'User-Agent': UA, 'Accept': 'application/json'}}, init||{}));
    const body = await res.text();
    return {ok: res.ok, status: res.status, body};
  } finally { clearTimeout(t); }
}

function overpassQuery(city){
  const a = `(around:${city.radius},${city.lat},${city.lng})`;
  return `[out:json][timeout:75];
(nwr${a}[tourism~"^(attraction|museum|viewpoint|zoo|aquarium|gallery)$"][name];);
out center tags 80;
(nwr${a}[leisure=park][name];);
out center tags 40;
(nwr${a}[natural=beach][name];);
out center tags 20;
(nwr${a}[amenity~"^(restaurant|cafe)$"][name];);
out center tags 70;
(nwr${a}[leisure~"^(spa|sauna|fitness_centre)$"][name];
 nwr${a}[amenity~"^(spa|sauna|public_bath|massage)$"][name];
 nwr${a}[natural=hot_spring][name];);
out center tags 30;`;
}

async function overpass(city){
  const rawFile = path.join(RAW, city.slug + '-overpass.json');
  if (fs.existsSync(rawFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
      if (Array.isArray(data.elements) && data.elements.length >= 8) {
        console.log('  overpass cache hit', city.slug, data.elements.length);
        return data;
      }
    } catch (e) {}
  }
  if (process.argv.includes('--no-overpass')) throw new Error('no local extract');
  const q = overpassQuery(city);
  let lastErr;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const url = OVERPASS[attempt % OVERPASS.length];
    try {
      if (attempt) await sleep(Math.min(60000, 8000 * Math.pow(2, attempt - 1)));
      console.log('  overpass', city.slug, 'try', attempt + 1, url.split('/')[2]);
      const r = await fetchText(url, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded', 'User-Agent': UA}, body:'data=' + encodeURIComponent(q)}, 95000);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + r.body.slice(0, 180));
      const data = JSON.parse(r.body);
      if (!Array.isArray(data.elements)) throw new Error('no elements');
      const stamp=data.osm3s && data.osm3s.timestamp_osm_base;
      if (stamp && !/^\d{4}-/.test(String(stamp))) throw new Error('stale overpass dataset');
      if (data.elements.length < 8) throw new Error('too few overpass elements: '+data.elements.length);
      fs.mkdirSync(RAW, {recursive:true});
      fs.writeFileSync(rawFile, JSON.stringify(data));
      console.log('  overpass ok', city.slug, data.elements.length, 'elements');
      return data;
    } catch (e) {
      lastErr = e;
      console.warn('  overpass fail', city.slug, e.message || e);
    }
  }
  throw lastErr || new Error('overpass failed');
}

function wikidataQuery(city){
  const radiusKm = Math.max(5, Math.min(30, Math.round(city.radius / 1000)));
  const types = [
    'wd:Q33506','wd:Q570116','wd:Q22698','wd:Q40080','wd:Q43501','wd:Q2281788',
    'wd:Q1007870','wd:Q207694','wd:Q11707','wd:Q30022','wd:Q177380','wd:Q243345',
    'wd:Q57036','wd:Q214628','wd:Q19701637','wd:Q6017631','wd:Q5003624','wd:Q16917'
  ].join(' ');
  return `SELECT DISTINCT ?item ?itemLabel ?coord ?type ?typeLabel ?enwiki WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord.
    bd:serviceParam wikibase:center "Point(${city.lng} ${city.lat})"^^geo:wktLiteral.
    bd:serviceParam wikibase:radius "${radiusKm}".
  }
  ?item wdt:P31 ?type.
  VALUES ?type { ${types} }
  OPTIONAL { ?enwiki schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 200`;
}

const WD_TYPE = {
  Q33506:'museum', Q207694:'museum', Q16917:'museum', Q570116:'attraction',
  Q22698:'park', Q40080:'beach', Q43501:'zoo', Q2281788:'aquarium',
  Q1007870:'gallery', Q11707:'restaurant', Q30022:'cafe',
  Q177380:'hotspring', Q243345:'hotspring', Q57036:'sauna', Q214628:'spa',
  Q19701637:'fitness', Q6017631:'viewpoint', Q5003624:'viewpoint'
};

async function wikidata(city){
  const rawFile = path.join(RAW, city.slug + '-wikidata.json');
  if (fs.existsSync(rawFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
      if (data.results && Array.isArray(data.results.bindings)) {
        console.log('  wikidata cache hit', city.slug, data.results.bindings.length);
        return data;
      }
    } catch (e) {}
  }
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt) await sleep(5000 * (attempt + 1));
      const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(wikidataQuery(city));
      console.log('  wikidata', city.slug, 'try', attempt + 1);
      const r = await fetchText(url, {headers:{'User-Agent': UA, 'Accept':'application/sparql-results+json'}}, 45000);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + r.body.slice(0, 180));
      const data = JSON.parse(r.body);
      fs.mkdirSync(RAW, {recursive:true});
      fs.writeFileSync(rawFile, JSON.stringify(data));
      console.log('  wikidata ok', city.slug, (data.results.bindings||[]).length);
      return data;
    } catch (e) {
      lastErr = e;
      console.warn('  wikidata fail', city.slug, e.message || e);
    }
  }
  console.warn('  wikidata skipped', city.slug, lastErr && lastErr.message);
  return {results:{bindings:[]}};
}

function parseWkt(value){
  const m = /Point\(\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*\)/i.exec(value || '');
  return m ? {lng:+m[1], lat:+m[2]} : null;
}

function wdPlaces(city, data){
  const rows = [];
  for (const b of (data.results && data.results.bindings) || []) {
    const id = (b.item && b.item.value || '').split('/').pop();
    const name = b.itemLabel && b.itemLabel.value;
    const typeId = (b.type && b.type.value || '').split('/').pop();
    const k = WD_TYPE[typeId] || 'attraction';
    const pt = parseWkt(b.coord && b.coord.value);
    if (!id || !name || name === id || !pt) continue;
    const wiki = b.enwiki && b.enwiki.value ? 'en:' + decodeURIComponent(b.enwiki.value.split('/wiki/').pop()) : '';
    const dining = k === 'restaurant' || k === 'cafe';
    const well = ['spa','sauna','hotspring','fitness','massage'].includes(k);
    const est = S.estimates(k);
    rows.push({
      id:'wd-'+id, name, type:k, category:(S.labels && null) || undefined,
      lat:pt.lat, lng:pt.lng, area:city.name, address:'', duration:est.duration, effort:est.effort,
      needsTicket:false, price:'', intro:'', photo:'', generic:true, section:'popular',
      cuisine:k==='cafe'?'Coffee':'', ...(dining?{meals:k==='cafe'?['breakfast','lunch','snack']:['lunch','dinner']}:{}),
      ...(well?{wellness:true}:{}), openingHours:'', parsedHours:null, hours:{}, closed:[], closedDates:[], tags:[],
      wikipedia:wiki, wikidata:id, mapUrl:'https://www.wikidata.org/wiki/'+id, notability:2, richness:4
    });
  }
  return rows;
}

function labelOf(k){
  return {park:'Park',beach:'Beach',museum:'Museum',viewpoint:'Viewpoint',attraction:'Attraction',zoo:'Zoo',aquarium:'Aquarium',gallery:'Gallery',restaurant:'Restaurant',cafe:'Cafe',spa:'Spa',sauna:'Sauna',hotspring:'Hot spring',fitness:'Fitness',massage:'Massage'}[k] || 'Attraction';
}

const GENERIC_NAME = /^(the\s+)?((heritage\s+|history\s+|science\s+)?(museum|gallery|park|garden|attraction|cafe|restaurant|spa|sauna|gym|beach|zoo|aquarium|viewpoint|fitness(\s+cent(?:re|er))?)s?)$/i;
const GENERIC_INSTITUTION = /\b(resources?\s+cent(?:re|er)s?|exhibition\s+cent(?:re|er)s?|conservation\s+(?:resources?\s+)?cent(?:re|er)s?|interpretation\s+cent(?:re|er)s?|housing authority(?:\s+exhibition\s+cent(?:re|er))?)\b/i;
function foldName(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
const WELLNESS_KEEP = /yoga|pilates|medita|onsen|sento|hammam|hamam|ayurved|hot\s*spring|bathhouse|bath\s*house|thermal|therme|public\s+bath|wellness\s+spa|qigong|tai\s*chi|mindful/i;
const GYMISH = /fitness|gym|equinox|anytime\s+fitness|planet\s+fitness|gold'?s\s+gym|virgin\s+active|john\s+reed|snap\s+fit|smart\s+fit|puregym|f45|crossfit|nuffield|david\s+lloyd|les\s+mills|lifetime\s+fitness|soulcycle|solidcore|pure\s+barre|mcfit|holmes\s+place/i;
const DEFUNCT = /leverian\s+collection|museum of practical geology|amora london|royal united services (institute|museum)|victoria and albert museum spiral|london museum and institute of natural history|^health exhibition cent/i;

function isBareOrGenericName(p){
  const n = String(p.name || '').trim();
  if (!n || /^Q\d+$/i.test(n)) return true;
  if (GENERIC_NAME.test(n)) return true;
  if (GENERIC_INSTITUTION.test(n) && !p.wikipedia) return true;
  return false;
}

function keepWellness(p){
  const n = foldName(p.name);
  const typ = p.type;
  if (['spa','sauna','hotspring'].includes(typ)) return !GENERIC_NAME.test(n);
  if (typ === 'massage') return true;
  if (typ === 'fitness' || GYMISH.test(n)) return WELLNESS_KEEP.test(n);
  return true;
}

function isDefunct(p){
  return DEFUNCT.test(String(p.name || ''));
}

function qualityFilter(list, kind){
  return list.filter(p => {
    if (isBareOrGenericName(p) || isDefunct(p)) return false;
    if (kind === 'wellness' && !keepWellness(p)) return false;
    return true;
  });
}

function isIconic(p){
  return (p.sitelinks || 0) >= 12;
}

function capList(list, n, caps){
  if(!caps)return list.slice(0,n);
  const used={}, picked=[];
  const have=new Set();
  const take=p=>{picked.push(p);have.add(p.id||p.name);used[p.type]=(used[p.type]||0)+1;};
  // Highly notable places are taken first and are not dropped by type caps.
  for(const p of list){if(picked.length>=n)break;if(isIconic(p))take(p);}
  for(const p of list){if(picked.length>=n)break;if(have.has(p.id||p.name))continue;if(caps[p.type]&&(used[p.type]||0)>=caps[p.type])continue;take(p);}
  if(picked.length<n){for(const p of list){if(picked.length>=n)break;if(!have.has(p.id||p.name))take(p);}}
  return picked;
}

function lean(p){
  const out = {
    id:p.id, name:p.name, type:p.type, category:p.category || labelOf(p.type),
    lat:p.lat, lng:p.lng, area:p.area || '', address:p.address || '',
    duration:p.duration, effort:p.effort, needsTicket:!!p.needsTicket,
    generic:true, section:'popular'
  };
  if (p.cuisine) out.cuisine = p.cuisine;
  if (p.meals) out.meals = p.meals;
  if (p.wellness) out.wellness = true;
  if (p.openingHours) out.openingHours = p.openingHours;
  if (p.parsedHours) out.parsedHours = p.parsedHours;
  if (p.wikipedia) out.wikipedia = p.wikipedia;
  if (p.wikidata) out.wikidata = p.wikidata;
  if (p.mapUrl) out.mapUrl = p.mapUrl;
  if (p.notability) out.notability = p.notability;
  return out;
}

function nameKey(n){
  return S.normalize(n)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s*\([^)]*\)\s*/g,' ')
    .replace(/^(the|el|la|le|les|los|las)\s+/,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
}

function mergeCatalog(osmCat, extra, city){
  const take = list => {
    const out=[], byId=new Map(), byKey=new Map();
    for (const p of list) {
      if (!p.name || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      if (!p.category) p.category = labelOf(p.type);
      const k = nameKey(p.name);
      const prev = (p.wikidata && byId.get(p.wikidata)) || (k && byKey.get(k));
      if (prev) {
        const better = ((p.name.includes('(') && !prev.name.includes('(')) || (p.sitelinks||0) > (prev.sitelinks||0));
        if (better) Object.assign(prev, p);
        continue;
      }
      out.push(p);
      if (p.wikidata) byId.set(p.wikidata, p);
      if (k) byKey.set(k, p);
    }
    return out;
  };
  const activities = qualityFilter(take([...(osmCat.activities||[]), ...extra.filter(p => !p.meals && !p.wellness)]), 'activities');
  const restaurants = qualityFilter(take([...(osmCat.restaurants||[]), ...extra.filter(p => p.meals)]), 'restaurants');
  const wellness = qualityFilter(take([...(osmCat.wellness||[]), ...extra.filter(p => p.wellness)]), 'wellness');
  // Prefer Wikipedia/Wikidata sitelinks, then type, then distance to the city center.
  const dist = p => Math.hypot(p.lat - city.lat, (p.lng - city.lng) * Math.cos(city.lat * Math.PI / 180));
  const TYPE_RANK={museum:6,gallery:6,attraction:5,viewpoint:5,zoo:5,aquarium:5,beach:5,spa:4,hotspring:4,sauna:4,restaurant:3,cafe:3,park:2,fitness:1,massage:3};
  const score = p => (p.sitelinks||0)*10 + (p.notability||0);
  const rank = (a,b) => score(b) - score(a) || (TYPE_RANK[b.type]||2) - (TYPE_RANK[a.type]||2) || dist(a) - dist(b);
  activities.sort(rank); restaurants.sort(rank); wellness.sort(rank);
  return {
    activities: capList(activities, 50, {museum:16,park:8,gallery:8}).map(lean),
    restaurants: capList(restaurants, 40, {cafe:16}).map(lean),
    wellness: capList(wellness, 20, {fitness:2}).map(lean)
  };
}

function writeIndex(citiesMeta){
  const index = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    source: 'OpenStreetMap (ODbL) and Wikidata (CC0)',
    base: 'data/cities/',
    cities: citiesMeta
  };
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  const js = '/* Generated by tools/prewarm-cities.cjs. Versioned city snapshot index; lazy-loaded per city. */\nwindow.GONOW_CITY_INDEX=' + JSON.stringify(index) + ';\n';
  fs.writeFileSync(path.join(ROOT, 'js/city-index.js'), js);
}

function existingMeta(){
  const metas = [];
  for (const city of CITIES) {
    const file = path.join(OUT, city.slug + '.json');
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.version === VERSION && Array.isArray(data.activities) && Array.isArray(data.restaurants)) {
        metas.push(metaFor(city, data, fs.statSync(file).size));
      }
    } catch (e) {}
  }
  return metas;
}

function metaFor(city, data, bytes){
  return {
    slug: city.slug,
    name: city.name,
    aliases: [city.name, city.slug.replace(/-/g, ' ')].concat(city.aliases || []),
    file: city.slug + '.json',
    center: {lat: city.lat, lng: city.lng},
    activities: (data.activities||[]).length,
    restaurants: (data.restaurants||[]).length,
    wellness: (data.wellness||[]).length,
    bytes
  };
}

async function sitelinksFor(slug, ids){
  const unique = [...new Set((ids||[]).filter(id => id && /^Q\d+$/.test(id)))];
  const rawFile = path.join(RAW, slug + '-sitelinks.json');
  let map = {};
  if (fs.existsSync(rawFile)) {
    try { map = JSON.parse(fs.readFileSync(rawFile, 'utf8')) || {}; } catch (e) { map = {}; }
  }
  const missing = unique.filter(id => map[id] == null);
  for (let i = 0; i < missing.length; i += 80) {
    const batch = missing.slice(i, i + 80);
    const query = 'SELECT ?item ?sitelinks WHERE { VALUES ?item { ' + batch.map(id => 'wd:'+id).join(' ') + ' } ?item wikibase:sitelinks ?sitelinks. }';
    const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        if (attempt) await sleep(4000 * (attempt + 1));
        const r = await fetchText(url, {headers:{'User-Agent': UA, 'Accept':'application/sparql-results+json'}}, 45000);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = JSON.parse(r.body);
        for (const b of (data.results && data.results.bindings) || []) {
          const id = (b.item && b.item.value || '').split('/').pop();
          const n = b.sitelinks && Number(b.sitelinks.value);
          if (id && Number.isFinite(n)) map[id] = n;
        }
        for (const id of batch) if (map[id] == null) map[id] = 0;
        ok = true;
      } catch (e) {
        console.warn('  sitelinks fail', slug, e.message || e);
      }
    }
  }
  fs.mkdirSync(RAW, {recursive:true});
  fs.writeFileSync(rawFile, JSON.stringify(map));
  return map;
}

function applySitelinks(lists, map){
  for (const list of lists) {
    for (const p of list || []) {
      if (p.wikidata && map[p.wikidata] != null) p.sitelinks = map[p.wikidata];
    }
  }
}

async function buildCity(city, force){
  const dest = path.join(OUT, city.slug + '.json');
  if (!force && fs.existsSync(dest)) {
    try {
      const data = JSON.parse(fs.readFileSync(dest, 'utf8'));
      if (data.version === VERSION && (data.activities||[]).length + (data.restaurants||[]).length >= 8) {
        console.log('skip', city.slug, 'already built');
        return {city, data, bytes: fs.statSync(dest).size, skipped: true};
      }
    } catch (e) {}
  }
  console.log('build', city.slug);
  let osmData = {elements:[]}, osmErr = null;
  try { osmData = await overpass(city); }
  catch (e) { osmErr = e; console.warn('  OSM missing for', city.slug, e.message || e); }
  await sleep(BETWEEN_QUERY_MS);
  const wd = await wikidata(city);
  const center = {lat: city.lat, lng: city.lng};
  const osmCat = (osmData.elements && osmData.elements.length)
    ? source.catalog(osmData, center, city.name)
    : {activities:[], restaurants:[], wellness:[]};
  const extra = wdPlaces(city, wd);
  const ids = []
    .concat(osmCat.activities||[], osmCat.restaurants||[], osmCat.wellness||[], extra)
    .map(p => p.wikidata).filter(Boolean);
  const sl = await sitelinksFor(city.slug, ids);
  applySitelinks([osmCat.activities, osmCat.restaurants, osmCat.wellness, extra], sl);
  const merged = mergeCatalog(osmCat, extra, city);
  const total = merged.activities.length + merged.restaurants.length + merged.wellness.length;
  if (total < 5) throw new Error('too few places (' + total + ')' + (osmErr ? '; OSM: ' + osmErr.message : ''));
  const out = {
    version: VERSION,
    slug: city.slug,
    city: city.name,
    aliases: [city.name].concat(city.aliases || []),
    center,
    radius: city.radius,
    source: 'osm+wikidata',
    license: 'OpenStreetMap data © OpenStreetMap contributors, ODbL. Wikidata, CC0.',
    fetchedAt: new Date().toISOString(),
    activities: merged.activities,
    restaurants: merged.restaurants,
    wellness: merged.wellness
  };
  fs.mkdirSync(OUT, {recursive:true});
  const body = JSON.stringify(out);
  fs.writeFileSync(dest, body);
  console.log('  wrote', city.slug, 'a', out.activities.length, 'r', out.restaurants.length, 'w', out.wellness.length, 'bytes', body.length);
  return {city, data: out, bytes: body.length};
}

async function main(){
  const force = process.argv.includes('--force');
  const only = process.argv.filter(a => a.startsWith('--only=')).map(a => a.slice(7));
  const list = only.length ? CITIES.filter(c => only.includes(c.slug) || only.includes(c.name.toLowerCase())) : CITIES;
  if (!list.length) throw new Error('no cities matched');
  fs.mkdirSync(OUT, {recursive:true});
  const metas = existingMeta();
  writeIndex(metas);
  const failures = [];
  for (let i = 0; i < list.length; i++) {
    const city = list[i];
    try {
      const result = await buildCity(city, force);
      const m = metaFor(city, result.data, result.bytes);
      const idx = metas.findIndex(x => x.slug === city.slug);
      if (idx >= 0) metas[idx] = m; else metas.push(m);
      writeIndex(metas);
      if (!result.skipped && i < list.length - 1) await sleep(SLEEP_MS);
    } catch (e) {
      console.error('FAIL', city.slug, e.message || e);
      failures.push({slug: city.slug, error: String(e.message || e)});
      fs.writeFileSync(path.join(RAW, 'failures.json'), JSON.stringify(failures, null, 2));
      await sleep(SLEEP_MS);
    }
  }
  writeIndex(metas);
  const summary = {built: metas.length, expected: CITIES.length, failures};
  fs.writeFileSync(path.join(RAW, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('DONE', JSON.stringify(summary));
  if (failures.length && metas.length < 30) process.exitCode = 1;
}

module.exports = {CITIES, VERSION, isBareOrGenericName, keepWellness, isDefunct, qualityFilter, isIconic, capList, placeQuality:{GENERIC_NAME,GENERIC_INSTITUTION,WELLNESS_KEEP}};
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
