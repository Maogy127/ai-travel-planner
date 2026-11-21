const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const ctx={window:{},AbortController,setTimeout,clearTimeout,console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/placesource.js','utf8'),ctx);
const S=ctx.window.GoNowPlaceSource;
const memory=()=>{const map=new Map();return {map,get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const paris=JSON.parse(fs.readFileSync('tests/fixtures/cities/paris.json','utf8'));
const fixture=(city,kind)=>JSON.parse(fs.readFileSync(`tests/fixtures/${city}_${kind}.json`));
(async()=>{
  // Unknown cities never fetch a snapshot file (Lagos must stay on the live path and its timeout cap).
  const none=[];
  const noIndex=S.create({storage:memory(),sleep:async()=>{},fetch:async url=>{none.push(url);throw Error('offline');}});
  assert.equal((await noIndex.load('Paris')).fallback,true);
  assert(!none.some(u=>/data\/cities\//.test(u)),'no snapshot request without an index');

  ctx.window.GONOW_CITY_INDEX={version:1,base:'data/cities/',cities:[
    {slug:'paris',name:'Paris',aliases:['paris, france']},
    {slug:'seattle',name:'Seattle',aliases:['sea']}
  ]};

  // Snapshot wins: no Nominatim, Overpass or Google, even when a key is present.
  const calls=[];
  const source=S.create({storage:memory(),googleKey:'TESTKEY',snapshotBase:'tests/fixtures/cities/',sleep:async()=>{},fetch:async(url,init)=>{
    calls.push(url);
    if(url.endsWith('paris.json'))return {ok:true,json:async()=>paris};
    throw Error('should not live-fetch '+url);
  }});
  const started=Date.now();
  const result=await source.load('Paris');
  const elapsed=Date.now()-started;
  assert.equal(result.source,'snapshot');
  assert.equal(result.catalog.city,'Paris');
  assert.equal(result.catalog.activities[0].name,'Louvre Museum');
  assert.equal(result.catalog.restaurants[0].name,'Café de Flore');
  assert(result.catalog.activities.some(p=>p.name==='Les Bains du Marais'),'wellness spots appear in the activity list');
  assert.equal(result.catalog.wellness.length,1);
  assert(S.allows(result.catalog.activities[0].parsedHours,'2026-11-18',600,60),'revived hours');
  assert(!S.allows(result.catalog.activities[0].parsedHours,'2026-11-17',600,60),'closed Tuesday');
  assert.equal(calls.length,1);
  assert(calls[0].endsWith('paris.json'));
  assert(elapsed<200,'snapshot load is local and fast: '+elapsed);
  const again=await source.load('  PARIS  ');
  assert.equal(again.source,'snapshot');
  assert.equal(calls.length,1,'cached snapshot makes no second fetch');
  assert.equal((await source.load('Paris, France')).source,'snapshot');

  // Aliases and city-index matching.
  assert.equal(S.matchSnapshot('Paris').slug,'paris');
  assert.equal(S.matchSnapshot('paris, france').slug,'paris');
  assert.equal(S.matchSnapshot('Lagos'),null);

  // A missing snapshot file falls through to the live lookup.
  const urls=[];
  const missing=S.create({storage:memory(),snapshotBase:'tests/fixtures/cities/',sleep:async()=>{},fetch:async url=>{
    urls.push(url);
    if(url.includes('cities/seattle.json'))return {ok:false,status:404};
    if(url.includes('nominatim'))return {ok:true,json:async()=>fixture('seattle','nominatim')};
    if(url.includes('overpass'))return {ok:true,json:async()=>fixture('seattle','overpass')};
    return {ok:true,json:async()=>fixture('seattle','wikipedia')};
  }});
  const live=await missing.load('Seattle');
  assert.equal(live.source,'osm');
  assert.equal(live.catalog.activities[0].name,'Seattle Art Museum');
  assert(urls.some(u=>u.endsWith('seattle.json')));
  assert(urls.some(u=>u.includes('overpass')));

  // Hotel-centred lookups try the live path first; a failed live call may use the city snapshot.
  const hotelCalls=[];
  const hotel=S.create({storage:memory(),snapshotBase:'tests/fixtures/cities/',sleep:async()=>{},fetch:async url=>{
    hotelCalls.push(url);
    if(url.endsWith('paris.json'))return {ok:true,json:async()=>paris};
    throw Error('live down');
  }});
  const atHotel=await hotel.load('Paris',{lat:48.86,lng:2.34});
  assert.equal(atHotel.source,'snapshot');
  assert(hotelCalls.some(u=>u.includes('nominatim')||u.includes('overpass')),'hotel path attempts a live lookup first');

  const lagosTimes=[];
  const lagos=S.create({storage:memory(),now:()=>Date.now(),sleep:async()=>{},fetch:async url=>{
    lagosTimes.push(url);
    throw Error('down');
  }});
  const t0=Date.now();
  const lagosResult=await lagos.load('Lagos');
  const took=Date.now()-t0;
  assert(lagosResult.fallback);
  assert(!lagosTimes.some(u=>/data\/cities\//.test(u)||/fixtures\/cities\//.test(u)),'unknown cities never fetch a snapshot');
  assert(took<2000,'unknown-city failure does not wait on a snapshot timeout: '+took);

  // file:// pages cannot fetch data/cities/*.json; skip the snapshot so the console stays quiet.
  const fileCalls=[];
  ctx.window.location={protocol:'file:',href:'file:///tmp/index.html'};
  const fileSrc=S.create({storage:memory(),snapshotBase:'data/cities/',sleep:async()=>{},fetch:async url=>{
    fileCalls.push(url);
    throw Error('offline');
  }});
  const fileResult=await fileSrc.load('Paris');
  assert(fileResult.fallback,'file:// falls through when a snapshot cannot be fetched');
  assert(!fileCalls.some(u=>/cities\/paris\.json/.test(u)),'file:// pages do not request city snapshots');
  delete ctx.window.location;

  console.log('PASS city prewarm snapshots load first, merge wellness, revive hours, alias match, and fall back to live');
})().catch(e=>{console.error(e);process.exitCode=1;});
