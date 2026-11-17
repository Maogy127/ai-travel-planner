// Google Places (New) provider: field mask, key header, mapping, cache, fallback to OSM; cache pruning.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{},AbortController,setTimeout,clearTimeout,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/placesource.js','utf8'),ctx);
const S=ctx.window.GoNowPlaceSource,fixture=(city,kind)=>JSON.parse(fs.readFileSync(`tests/fixtures/${city}_${kind}.json`));
const memory=()=>{const map=new Map();return {map,get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const place=(id,name,type,extra={})=>({id,displayName:{text:name},location:{latitude:47.6+id.length/100,longitude:-122.33},primaryType:type,types:[type],formattedAddress:'1 Main St',googleMapsUri:'https://maps.google.com/?cid='+id,photos:[{name:'places/'+id+'/photos/p1',authorAttributions:[{displayName:'Ana',uri:'https://maps.google.com/contrib/1'}]}],...extra});
(async()=>{
 const calls=[];const g=S.create({storage:memory(),googleKey:'TESTKEY',sleep:async()=>{},fetch:async(url,init)=>{calls.push({url,init});const q=JSON.parse(init.body).textQuery;return {ok:true,json:async()=>({places:/restaurants/.test(q)?[place('r1','Cafe Uno','cafe'),place('r2','Steak Two','restaurant')]:[place('a1','Art Museum','museum',{rating:4.64,userRatingCount:60163,regularOpeningHours:{periods:[1,2,3,4,5].map(d=>({open:{day:d,hour:10,minute:0},close:{day:d,hour:17,minute:30}})),weekdayDescriptions:['Monday: 10:00\u202fAM\u2009\u2013\u20095:30\u202fPM']}}),place('a2','Big Park','park',{regularOpeningHours:{periods:[{open:{day:0,hour:0,minute:0}}]}}),place('r1','Cafe Uno','cafe')]})};}});
 const r=await g.load('Seattle');
 assert.equal(r.source,'google');assert.equal(calls.length,2,'two Text Search calls');
 for(const c of calls){assert.equal(c.url,'https://places.googleapis.com/v1/places:searchText');assert.equal(c.init.headers['X-Goog-Api-Key'],'TESTKEY');const mask=c.init.headers['X-Goog-FieldMask'];assert(!/priceLevel|website|reviews|phone|editorial|\*/.test(mask),'tight field mask: '+mask);assert(/places\.rating/.test(mask)&&/regularOpeningHours\.periods/.test(mask));assert(/places\.photos/.test(mask)&&/places\.location/.test(mask));}
 assert.deepEqual(r.catalog.activities.map(p=>p.name),['Art Museum','Big Park']);assert.deepEqual(r.catalog.restaurants.map(p=>p.name),['Cafe Uno','Steak Two'],'deduped');
 assert.deepEqual([...r.catalog.restaurants[0].meals],['breakfast','lunch','snack']);assert.deepEqual([...r.catalog.restaurants[1].meals],['lunch','dinner']);
 assert(r.catalog.activities[0].photo.startsWith('https://places.googleapis.com/v1/places/a1/photos/p1/media?maxWidthPx=480&key='));assert.equal(r.catalog.activities[0].creditName,'Ana');
 const art=r.catalog.activities[0],park=r.catalog.activities[1];
 assert.equal(art.rating,4.6);assert.equal(art.ratingCount,60163);assert.equal(S.cardLine(art),'Museum · ★ 4.6 (60.2k)');
 assert.deepEqual(JSON.parse(JSON.stringify(art.parsedHours.week)),[[],[[600,1050]],[[600,1050]],[[600,1050]],[[600,1050]],[[600,1050]],[]]);
 assert(!S.allows(art.parsedHours,'2026-11-29',600,60),'closed Sunday');assert(S.allows(art.parsedHours,'2026-11-30',600,60));
 assert.equal(art.openingHours,'Monday: 10:00 AM – 5:30 PM');assert(park.parsedHours.week.every(d=>d[0][0]===0&&d[0][1]===1440),'open 24 hours');
 assert.equal(r.catalog.restaurants[0].parsedHours,null,'no hours listed');assert.equal(S.cardLine(r.catalog.restaurants[0]),'Cafe · Coffee');
 await g.load('Seattle');assert.equal(calls.length,2,'cached');
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
 console.log('PASS google places provider, tight field mask, rating and hours, fallback, fast failure, cache prune and slim cache');
})().catch(e=>{console.error(e);process.exit(1);});
