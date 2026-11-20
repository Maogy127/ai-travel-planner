// Google Places (New) provider: field mask, key header, mapping, cache, fallback to OSM; cache pruning.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{},AbortController,setTimeout,clearTimeout,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/placesource.js','utf8'),ctx);
const S=ctx.window.GoNowPlaceSource,fixture=(city,kind)=>JSON.parse(fs.readFileSync(`tests/fixtures/${city}_${kind}.json`));
const memory=()=>{const map=new Map();return {map,get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const place=(id,name,type,extra={})=>({id,displayName:{text:name},location:{latitude:47.6+id.length/100,longitude:-122.33},primaryType:type,types:[type],formattedAddress:'1 Main St',googleMapsUri:'https://maps.google.com/?cid='+id,photos:[{name:'places/'+id+'/photos/p1',authorAttributions:[{displayName:'Ana',uri:'https://maps.google.com/contrib/1'}]}],rating:4,userRatingCount:100,businessStatus:'OPERATIONAL',...extra});
(async()=>{
 const calls=[];const g=S.create({storage:memory(),googleKey:'TESTKEY',sleep:async()=>{},fetch:async(url,init)=>{calls.push({url,init});if(!url.includes('googleapis'))throw Error('offline');const q=JSON.parse(init.body).textQuery;return {ok:true,json:async()=>({places:/restaurants/.test(q)?[place('r2','Steak Two','restaurant'),place('r9','Tiny New Spot','restaurant',{userRatingCount:4}),place('r8','Closed Diner','restaurant',{businessStatus:'CLOSED_PERMANENTLY'})]:/cafes/.test(q)?[place('r1','Cafe Uno','cafe')]:/parks/.test(q)?[place('a2','Big Park','park',{regularOpeningHours:{periods:[{open:{day:0,hour:0,minute:0}}]}})]:[place('a1','Art Museum','museum',{rating:4.64,userRatingCount:60163,regularOpeningHours:{periods:[1,2,3,4,5].map(d=>({open:{day:d,hour:10,minute:0},close:{day:d,hour:17,minute:30}})),weekdayDescriptions:['Monday: 10:00\u202fAM\u2009\u2013\u20095:30\u202fPM']}}),place('r1','Cafe Uno','cafe')]})};}});
 const r=await g.load('Seattle');
 assert.equal(r.source,'google');const gcalls=()=>calls.filter(c=>c.url.includes('googleapis'));assert.equal(gcalls().length,4,'one Text Search per category');assert.equal(calls.filter(c=>!c.url.includes('googleapis')).length,0,'OpenStreetMap is a last resort: not called when Google answers');
 for(const c of gcalls()){assert.equal(c.url,'https://places.googleapis.com/v1/places:searchText');assert.equal(c.init.headers['X-Goog-Api-Key'],'TESTKEY');const mask=c.init.headers['X-Goog-FieldMask'];assert(!/priceLevel|website|reviews|phone|editorial|\*/.test(mask),'tight field mask: '+mask);assert(/places\.rating/.test(mask)&&/regularOpeningHours\.periods/.test(mask));assert(/places\.photos/.test(mask)&&/places\.location/.test(mask));}
 assert.deepEqual(r.catalog.activities.map(p=>p.name),['Art Museum','Big Park']);assert.deepEqual(r.catalog.restaurants.map(p=>p.name),['Cafe Uno','Steak Two'],'deduped; under 30 reviews and closed places dropped');
 assert.deepEqual([...r.catalog.restaurants[0].meals],['breakfast','lunch','snack']);assert.deepEqual([...r.catalog.restaurants[1].meals],['lunch','dinner']);
 assert.equal(r.catalog.activities[0].photo,'gplace:places/a1/photos/p1','stored photo is key-free');assert(!JSON.stringify(r.catalog).includes('TESTKEY'),'no key in cached data');ctx.window.GONOW_PLACES_CONFIG={GOOGLE_PLACES_KEY:'CFGKEY'};assert.equal(S.photoSrc('gplace:places/a1/photos/p1'),'https://places.googleapis.com/v1/places/a1/photos/p1/media?maxWidthPx=480&key=CFGKEY');assert.equal(S.photoSrc('images/oahu.jpg'),'images/oahu.jpg');assert.equal(S.photoSrc('gplace:bad name'),'');ctx.window.GONOW_PLACES_CONFIG=undefined;assert.equal(r.catalog.activities[0].creditName,'Ana');
 const art=r.catalog.activities[0],park=r.catalog.activities[1];
 assert.equal(art.rating,4.6);assert.equal(art.ratingCount,60163);assert.equal(S.cardLine(art),'Museum · ★ 4.6 (60.2k)');
 assert.deepEqual(JSON.parse(JSON.stringify(art.parsedHours.week)),[[],[[600,1050]],[[600,1050]],[[600,1050]],[[600,1050]],[[600,1050]],[]]);
 assert(!S.allows(art.parsedHours,'2026-11-29',600,60),'closed Sunday');assert(S.allows(art.parsedHours,'2026-11-30',600,60));
 assert.equal(art.openingHours,'Monday: 10:00 AM – 5:30 PM');assert(park.parsedHours.week.every(d=>d[0][0]===0&&d[0][1]===1440),'open 24 hours');
 assert.equal(r.catalog.restaurants[0].parsedHours,null,'no hours listed');assert.equal(S.cardLine(r.catalog.restaurants[0]),'Cafe · ★ 4.0 (100)');
 await g.load('Seattle');assert.equal(gcalls().length,4,'cached');
 // Google failure falls back to OpenStreetMap; no key means OSM only.
 const urls=[];const f=S.create({storage:memory(),googleKey:'K',sleep:async()=>{},fetch:async url=>{urls.push(url);if(url.includes('googleapis'))return {ok:false,status:403};return {ok:true,json:async()=>fixture('seattle',url.includes('nominatim')?'nominatim':'overpass')};}});
 const fr=await f.load('Seattle');assert.equal(fr.source,'osm');assert(fr.catalog.activities.length>0);assert(urls.some(u=>u.includes('googleapis'))&&urls.some(u=>u.includes('overpass')));
 const n=[];await S.create({storage:memory(),googleKey:'',sleep:async()=>{},fetch:async url=>{n.push(url);return {ok:true,json:async()=>fixture('seattle',url.includes('nominatim')?'nominatim':'overpass')};}}).load('Seattle');assert(!n.some(u=>u.includes('googleapis')),'empty key never calls Google');
 // Overpass: about 8 s per server.
 const timeouts=[];let realSet=ctx.setTimeout;
 const t=S.create({storage:memory(),sleep:async()=>{},fetch:async(url,init)=>{if(url.includes('nominatim'))return {ok:true,json:async()=>fixture('seattle','nominatim')};throw Error('down');}});
 const started=Date.now();assert((await t.load('Seattle')).fallback);assert(Date.now()-started<2000,'fails fast when servers refuse');
 // Cache pruning: expired rows go, live rows are capped, the geocode stamp stays.
 const m=memory();m.setItem('gonow:places:last-geocode','1');m.setItem('gonow:places:old',JSON.stringify({value:1,until:5}));for(let i=0;i<5;i++)m.setItem('gonow:places:k'+i,JSON.stringify({value:i,until:1000+i}));m.setItem('gonow:trips','[]');
 S.prune(m,false,3,10);assert(!m.map.has('gonow:places:old'));assert.deepEqual([...m.map.keys()].filter(k=>/k\d/.test(k)).sort(),['gonow:places:k2','gonow:places:k3','gonow:places:k4']);assert(m.map.has('gonow:places:last-geocode')&&m.map.has('gonow:trips'));
 S.prune(m,true);assert.deepEqual([...m.map.keys()].sort(),['gonow:places:last-geocode','gonow:trips']);
 // Raw Overpass responses are slimmed before caching.
 const sm=memory();await S.create({storage:sm,sleep:async()=>{},fetch:async url=>({ok:true,json:async()=>fixture('seattle',url.includes('nominatim')?'nominatim':'overpass')})}).load('Seattle');
 const near=[...sm.map.entries()].find(([k])=>k.includes(':near:'));assert(near);const el=JSON.parse(near[1]).value.elements[0];assert(Object.keys(el.tags).every(k=>!/^(website|phone|wheelchair)$/.test(k)));
 // Daily safety cap: past the limit no Google request is made and the fallback is used quietly.
 {const st=memory();const gc=[];const capped=S.create({storage:st,googleKey:'K',dailyLimit:6,sleep:async()=>{},fetch:async(url,init)=>{if(url.includes('googleapis')){gc.push(url);return {ok:true,json:async()=>({places:[place('x1','Spot','museum'),place('x2','Food','restaurant')]})};}return {ok:true,json:async()=>fixture('seattle',url.includes('nominatim')?'nominatim':'overpass')};}});
  assert.equal((await capped.load('Seattle')).source,'google');assert.equal(gc.length,4);
  const second=await capped.load('Portland');assert.equal(gc.length,4,'cap reached: no more Google calls');assert.equal(second.source,'osm','falls back quietly');
  assert.equal(JSON.parse(st.getItem('gonow:places-budget')).n,4);}
 // Shared per-city ID list: details by ID with a field mask (no 'places.' prefix); new searches publish IDs only.
 {const dc=[];let saved=null;const ids=Array.from({length:10},(_,i)=>({id:'ChIJ'+'abcdefghij'[i]+'xxxxxxxx',cat:i<6?'sights':'restaurants'}));
  const sh=S.create({storage:memory(),googleKey:'K',sleep:async()=>{},sharedIds:async slug=>{assert.equal(slug,'seattle');return ids;},saveIds:(...a)=>{saved=a;},fetch:async(url,init)=>{if(!url.includes('googleapis'))throw Error('offline');dc.push({url,init});const id=decodeURIComponent(url.split('/places/')[1]);return {ok:true,json:async()=>place(id,'P '+id,/^ChIJ[g-j]/.test(id)?'restaurant':'museum',{formattedAddress:'1 Pike St, Seattle, WA 98101, USA'})};}});
  const res=await sh.load('Seattle');assert.equal(res.source,'google');assert.equal(dc.length,10,'one details call per ID');
  assert(dc.every(c=>!c.init.method&&!/places\./.test(c.init.headers['X-Goog-FieldMask'])&&/businessStatus/.test(c.init.headers['X-Goog-FieldMask'])));
  assert.equal(res.catalog.activities.length,6);assert.equal(res.catalog.restaurants.length,4);assert.equal(saved,null,'IDs only published after a search');
  const pub=S.create({storage:memory(),googleKey:'K',sleep:async()=>{},sharedIds:async()=>null,saveIds:(...a)=>{saved=a;},fetch:async(url,init)=>{if(!url.includes('googleapis'))throw Error('offline');const q=JSON.parse(init.body).textQuery;return {ok:true,json:async()=>({places:/restaurants|cafes/.test(q)?[place('r1','Cafe Uno','cafe')]:[place('a1','Art Museum','museum')]})};}});
  let partial=null;await pub.load('Seattle',null,{onPartial:c=>{partial=c;}});
  assert.equal(saved[0],'seattle');assert(saved[2].every(x=>Object.keys(x).sort().join()==='cat,id'),'only place IDs + category are shared');
  assert(partial===null||partial.partial===true);}
 // Shared lists come from other users: fetched places must really be in/near the city, or they are dropped.
 {const ids=Array.from({length:10},(_,i)=>({id:'ChIJ'+'abcdefghij'[i]+'xxxxxxxx',cat:i<6?'sights':'restaurants'}));
  const far=new Set(['ChIJaxxxxxxxx','ChIJgxxxxxxxx']);let searches=0;
  const mk=addr=>S.create({storage:memory(),googleKey:'K',sleep:async()=>{},sharedIds:async()=>ids,fetch:async(url,init)=>{if(!url.includes('googleapis'))throw Error('offline');if(url.includes('searchText')){searches++;return {ok:true,json:async()=>({places:[place('s1','Space Needle','tourist_attraction'),place('s2','Pike Place','market'),place('s3','Kerry Park','park')]})};}
   const id=decodeURIComponent(url.split('/places/')[1]);const junk=far.has(id);return {ok:true,json:async()=>place(id,'P '+id,/^ChIJ[g-j]/.test(id)?'restaurant':'museum',junk?{formattedAddress:'Shibuya, Tokyo, Japan',location:{latitude:35.66,longitude:139.7}}:{formattedAddress:addr})};}});
  const r1=await mk('1 Pike St, Seattle, WA').load('Seattle');
  assert.equal(r1.source,'google');assert.equal(searches,0,'shared list used');
  assert(![...r1.catalog.activities,...r1.catalog.restaurants].some(p=>far.has(p.placeId)),'far-away junk IDs dropped');
  assert.equal(r1.catalog.activities.length+r1.catalog.restaurants.length,8);
  const r2=await mk('1 Main St, Springfield').load('Seattle');
  assert.equal(searches,4,'a list whose places are not in the city is ignored; fresh category searches instead');
  assert.equal(r2.source,'google');}
 // Google down + OSM slow: the OSM fallback is capped, so the worst case stays near 5 s (simulated with a hanging fetch).
 {const st0=Date.now();const slow=S.create({storage:memory(),googleKey:'K',sleep:async()=>{},fetch:(url)=>url.includes('googleapis')?Promise.reject(Error('down')):new Promise(()=>{})});
  const out=await slow.load('Lagos');assert(out.fallback,'both down: clear fallback');const took=Date.now()-st0;assert(took<6000&&took>=4500,'capped at about 5 s: '+took);}
 console.log('PASS google places provider, tight field mask, rating and hours, fallback, fast failure, cache prune and slim cache');
})().catch(e=>{console.error(e);process.exit(1);});
