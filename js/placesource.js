/* On-demand public place data. No requests are made until load/enrich is called. */
(function(){
'use strict';
const CONTACT='gonow-preview@users.noreply.github.com', DAY=86400000;
const OVERPASS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
const normalize=q=>String(q||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
function slug(q){
 const text=normalize(q).normalize('NFD').replace(/[\u0300-\u036f]/g,''),base=text.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 // Keep distinct IDs for destinations written in scripts without ASCII letters.
 if(/[^\x00-\x7f]/.test(text)){let hash=2166136261;for(const c of text)hash=Math.imul(hash^c.codePointAt(0),16777619);return (base||'city')+'-'+(hash>>>0).toString(36);}
 return base||'city';
}
function parseHours(raw){
 if(!raw)return null;
 if(raw==='24/7')return {week:Array.from({length:7},()=>[[0,1440]])};
 if(/^(off|closed)$/.test(raw))return {week:Array.from({length:7},()=>[])};
 const week=Array.from({length:7},()=>[]),names=['Su','Mo','Tu','We','Th','Fr','Sa'];
 for(const part of raw.split(';')){
  const m=part.trim().match(/^(?:(((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:[-,](?:Mo|Tu|We|Th|Fr|Sa|Su))*) )?)(off|closed|\d{2}:\d{2}-\d{2}:\d{2}(?:,\d{2}:\d{2}-\d{2}:\d{2})*)$/);
  if(!m)return null;
  let days=[];
  if(!m[1])days=[0,1,2,3,4,5,6];else for(const group of m[1].trim().split(',')){
   const [a,b]=group.split('-').map(x=>names.indexOf(x));days.push(a);
   if(b!==undefined){let d=a;while(d!==b){d=(d+1)%7;days.push(d);}}
  }
  const ranges=[];
  if(!/off|closed/.test(m[3]))for(const range of m[3].split(',')){
   const [a,b]=range.split('-').map(t=>{const [h,m]=t.split(':').map(Number);return h<=24&&m<60&&(h<24||m===0)?h*60+m:NaN;});
   if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)return null;ranges.push([a,b]);
  }
  days.forEach(d=>week[d]=ranges);
 }
 return {week};
}
function allows(hours,date,start,duration){return !hours||hours.week[new Date(date+'T12:00:00Z').getUTCDay()].some(([a,b])=>start>=a&&start+duration<=b);}
function wellnessKind(t){return (t.natural==='hot_spring'||t.leisure==='hot_spring'||t.amenity==='public_bath')?'hotspring':(t.leisure==='sauna'||t.amenity==='sauna')?'sauna':t.leisure==='fitness_centre'?'fitness':(t.amenity==='massage'||t.shop==='massage')?'massage':(t.leisure==='spa'||t.amenity==='spa'||t.amenity==='bath')?'spa':'';}
function category(t){return (['restaurant','cafe'].includes(t.amenity)?t.amenity:'')||wellnessKind(t)||(t.leisure==='park'?'park':t.natural==='beach'?'beach':t.tourism)||'attraction';}
const labels={park:'Park',beach:'Beach',museum:'Museum',viewpoint:'Viewpoint',attraction:'Attraction',zoo:'Zoo',aquarium:'Aquarium',gallery:'Gallery',restaurant:'Restaurant',cafe:'Cafe',spa:'Spa',sauna:'Sauna',hotspring:'Hot spring',fitness:'Fitness',massage:'Massage'};
const estimates=k=>({duration:['museum','zoo','aquarium'].includes(k)?120:['spa','sauna','hotspring'].includes(k)?90:60,effort:['park','beach','viewpoint','fitness'].includes(k)?'Moderate est.':'Easy est.'});
const durationLabel=p=>(p.duration/60)+' h est.';
const ratingLabel=p=>p.rating?'★ '+p.rating.toFixed(1)+(p.ratingCount?' ('+(p.ratingCount>=1000?Math.round(p.ratingCount/100)/10+'k':p.ratingCount)+')':''):'';
const cardLine=p=>p.category+' · '+(p.rating?ratingLabel(p):(p.cuisine||durationLabel(p)));
// v2: 1.5px line icons on a soft state gradient (no emoji / dingbats).
const icons={park:'park',beach:'wave',museum:'museum',viewpoint:'view',attraction:'spot',zoo:'spot',aquarium:'wave',gallery:'museum',restaurant:'bowl',cafe:'cup',spa:'flower',sauna:'flower',hotspring:'wave',fitness:'flower',massage:'flower'};
const lineIcon=n=>root.GoNowIcons?root.GoNowIcons.icon(n,40):'';
function placeholder(p){return '<div class="place-placeholder" data-testid="place-placeholder" role="img" aria-label="'+(labels[p.type]||'Attraction')+' illustration">'+lineIcon(icons[p.type]||'spot')+'</div>';}
const root=typeof window==='undefined'?globalThis:window;
// Drops expired place-cache entries and keeps at most `max` (oldest first). `all` clears the cache to free space.
function prune(storage,all=false,max=40,now=Date.now()){try{const rows=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(!k||!k.startsWith('gonow:places:')||k==='gonow:places:last-geocode')continue;let until=0;try{until=JSON.parse(storage.getItem(k)).until||0;}catch(e){}rows.push([k,until]);}rows.filter(r=>all||r[1]<=now).forEach(r=>storage.removeItem(r[0]));const live=rows.filter(r=>!all&&r[1]>now).sort((a,b)=>a[1]-b[1]);live.slice(0,Math.max(0,live.length-max)).forEach(r=>storage.removeItem(r[0]));}catch(e){}}
function create(options={}){
 const request=options.fetch||((...args)=>window.fetch(...args)),now=options.now||Date.now,sleep=options.sleep||(ms=>new Promise(r=>setTimeout(r,ms))),storage=options.storage||window.localStorage;
 let geoTail=Promise.resolve(),lastGeo=-Infinity,overTail=Promise.resolve();
 try{lastGeo=Number(storage.getItem('gonow:places:last-geocode'))||-Infinity;}catch(e){}
 const inflight=new Map();
 function read(key){try{const v=JSON.parse(storage.getItem('gonow:places:'+key));return v&&v.until>now()?v.value:null;}catch(e){return null;}}
 function write(key,value,ttl){const data=JSON.stringify({value,until:now()+ttl});try{storage.setItem('gonow:places:'+key,data);}catch(e){prune(storage,false,10,now());try{storage.setItem('gonow:places:'+key,data);}catch(e2){}}return value;}
 prune(storage,false,40,now());
 async function json(url,init={}){const {timeout=15000,...rest}=init,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const r=await request(url,{...rest,signal:controller.signal});if(!r.ok)throw Error('Unavailable');return await r.json();}finally{clearTimeout(timer);}}
 function cached(key,ttl,fn){const hit=read(key);if(hit)return Promise.resolve(hit);if(inflight.has(key))return inflight.get(key);const p=Promise.resolve().then(fn).then(v=>write(key,v,ttl)).finally(()=>inflight.delete(key));inflight.set(key,p);return p;}
 function geocode(query){return cached('geo:'+normalize(query),180*DAY,()=>{const job=geoTail.then(async()=>{
  // A destination submission, never an autocomplete request. Settle rapid navigation first.
  await sleep(300);await sleep(Math.max(0,1000-(now()-lastGeo)));lastGeo=now();try{storage.setItem('gonow:places:last-geocode',String(lastGeo));}catch(e){}
  const rows=await json('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(query)+'&email='+encodeURIComponent(CONTACT));
  if(!rows.length||!Number.isFinite(+rows[0].lat)||!Number.isFinite(+rows[0].lon))throw Error('No city');return {lat:+rows[0].lat,lng:+rows[0].lon};
 });geoTail=job.catch(()=>{});return job;});}
 function nearby(center,radius=10000){const key='near:'+center.lat.toFixed(3)+','+center.lng.toFixed(3)+':'+radius;return cached(key,7*DAY,()=>{
  const job=overTail.then(async()=>{const around='(around:'+radius+','+center.lat+','+center.lng+')',query='[out:json][timeout:20];(nwr'+around+'[tourism~"^(attraction|museum|viewpoint|zoo|aquarium|gallery)$"][name];nwr'+around+'[leisure=park][name];nwr'+around+'[natural=beach][name];nwr'+around+'[amenity~"^(restaurant|cafe)$"][name];nwr'+around+'[leisure~"^(spa|sauna|fitness_centre)$"][name];nwr'+around+'[amenity~"^(spa|sauna|public_bath|massage)$"][name];nwr'+around+'[natural=hot_spring][name];);out center tags 160;';
   // Public Overpass instances often return 502/504 under load: try the main instance, then one alternate, then fall back.
   // About 8 s per server so a down service fails fast (Places gives a retry button).
   for(let attempt=0;attempt<2;attempt++){try{return await json(OVERPASS[attempt],{timeout:8000,method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query)});}catch(e){if(attempt)throw e;await sleep(300);}}
  }).then(slim);overTail=job.catch(()=>{});return job;
 });}
 // Cache only what catalog() reads, not the full tag dump.
 const KEEP=['name','name:en','tourism','leisure','natural','amenity','addr:suburb','addr:housenumber','addr:street','addr:city','fee','charge','cuisine','opening_hours','wikipedia','wikidata'];
 function slim(data){return {elements:(data.elements||[]).filter(e=>e.tags&&e.tags.name).map(e=>({type:e.type,id:e.id,lat:e.lat,lon:e.lon,center:e.center,tags:Object.fromEntries(KEEP.filter(k=>e.tags[k]!==undefined).map(k=>[k,e.tags[k]])),n:Object.keys(e.tags).length}))};}
 function catalog(data,center,city){
  const seen=new Set(),distance=p=>Math.hypot(p.lat-center.lat,(p.lng-center.lng)*Math.cos(center.lat*Math.PI/180));
  const rows=(data.elements||[]).filter(e=>e.tags&&e.tags.name).map(e=>{const t=e.tags,k=category(t),point=e.center||e,dining=['restaurant','cafe'].includes(k),well=!!wellnessKind(t);return {id:'osm-'+e.type+'-'+e.id,name:t['name:en']||t.name,type:k,category:labels[k]||'Attraction',lat:+point.lat,lng:+point.lon,area:t['addr:suburb']||city,address:[t['addr:housenumber'],t['addr:street'],t['addr:city']].filter(Boolean).join(' '),...estimates(k),needsTicket:t.fee==='yes'||!!t.charge,price:'',intro:'',photo:'',generic:true,section:'popular',cuisine:t.cuisine?t.cuisine.replace(/[_;]/g,' '):k==='cafe'?'Coffee':'',...(dining?{meals:k==='cafe'?['breakfast','lunch','snack']:['lunch','dinner']}:{}),...(well?{wellness:true}:{}),openingHours:t.opening_hours||'',parsedHours:parseHours(t.opening_hours),hours:parseHours(t.opening_hours)||{},closed:[],closedDates:[],tags:[],wikipedia:t.wikipedia,wikidata:t.wikidata,mapUrl:'https://www.openstreetmap.org/'+e.type+'/'+e.id,notability:Number(!!t.wikipedia)+Number(!!t.wikidata),richness:e.n||Object.keys(t).length};}).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  rows.sort((a,b)=>b.notability-a.notability||b.richness-a.richness||distance(a)-distance(b));
  const unique=rows.filter(p=>{const n=normalize(p.name);if(seen.has(n))return false;seen.add(n);return true;});
  const well=p=>!!p.wellness;return {generic:true,source:'osm',city,center,activities:unique.filter(p=>!p.meals&&!well(p)),restaurants:unique.filter(p=>p.meals),wellness:unique.filter(well)};
 }
 // Speed: Google first (3 s per request); OpenStreetMap starts only if Google fails or is still loading after 1.2 s, hard 4.5 s cap,
 // so the worst case is about 5.7 s. Results are cached per city for a day, so repeat cities are instant.
 const GOOGLE_TIMEOUT=3000, OSM_CAP=4500, OSM_HEAD_START=1200;
 const cap=(p,ms)=>Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(Error('timeout')),ms))]);
 async function osm(city,hotel){const center=hotel&&Number.isFinite(hotel.lat)&&Number.isFinite(hotel.lng)?hotel:await geocode(city);return catalog(await nearby(center),center,city);}
 async function load(city,hotel,opts={}){const key=googleKey();
  // Warm city: the day-old Google catalog answers at once, without waking the OpenStreetMap fallback.
  const warm=key&&read(googleCacheKey(city,hotel));if(warm)return {catalog:warm,fallback:false,source:'google'};
  const atHotel=!!hotelCenter(hotel);
  // Static pre-warmed snapshots load first so popular cities never wait on a live Overpass/Places call.
  if(!atHotel&&!opts.liveOnly){const snap=await snapshot(city);if(snap)return {catalog:snap,fallback:false,source:'snapshot'};}
  // OpenStreetMap is the last resort: it only starts if Google fails or is still loading after OSM_HEAD_START,
  // and it has a hard cap, so the worst case stays near 6 s.
  let osmTask=null;const startOsm=()=>osmTask||(osmTask=cap(osm(city,hotel),OSM_CAP).then(c=>({catalog:c,fallback:false,source:'osm'}),()=>null));
  if(key){const slow=setTimeout(startOsm,OSM_HEAD_START);try{const catalog=await google(city,hotel,key,opts);clearTimeout(slow);return {catalog,fallback:false,source:'google'};}catch(e){clearTimeout(slow);/* Fall through to OpenStreetMap. */}}
  const live=await startOsm();if(live)return live;
  if(atHotel&&!opts.liveOnly){const snap=await snapshot(city);if(snap)return {catalog:snap,fallback:false,source:'snapshot'};}
  return {catalog:null,fallback:true};}

 const SNAPSHOT_VERSION=1;
 function snapshotIndex(){const idx=root.GONOW_CITY_INDEX;return idx&&idx.version===SNAPSHOT_VERSION&&Array.isArray(idx.cities)?idx:null;}
 function matchSnapshot(city){
  const index=snapshotIndex();if(!index)return null;
  const q=normalize(city),s=slug(city);
  const alias=root.GoNowPlaces&&root.GoNowPlaces.normalize?normalize(root.GoNowPlaces.normalize(city).name):'';
  return index.cities.find(c=>c.slug===s||normalize(c.name)===q||(alias&&normalize(c.name)===alias)||(c.aliases||[]).some(a=>normalize(a)===q||(alias&&normalize(a)===alias)||slug(a)===s))||null;
 }
 function snapshotUrl(meta){
  const index=snapshotIndex()||{},base=options.snapshotBase!=null?options.snapshotBase:(index.base||'data/cities/');
  return String(base).replace(/\/?$/,'/')+meta.slug+'.json';
 }
 function revivePlace(p){
  const parsed=p.parsedHours||parseHours(p.openingHours)||null;
  return Object.assign({},p,{parsedHours:parsed,hours:p.hours&&Number.isFinite(p.hours.open)?p.hours:(parsed||{}),generic:true,section:p.section||'popular',photo:p.photo||'',intro:p.intro||'',price:p.price||'',closed:p.closed||[],closedDates:p.closedDates||[],tags:p.tags||[]});
 }
 function snapshotFromFile(url){
  try{
   if(String(url).startsWith('file:'))return true;
   // Browsers cannot fetch sibling JSON from a file:// page (and they log a console error if we try).
   if(root.location&&root.location.protocol==='file:'&&!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(String(url)))return true;
  }catch(e){}
  return false;
 }
 function snapshot(city){
  const meta=matchSnapshot(city);if(!meta)return Promise.resolve(null);
  if(snapshotFromFile(snapshotUrl(meta)))return Promise.resolve(null);
  const key='snap:'+SNAPSHOT_VERSION+':'+meta.slug;
  return cached(key,30*DAY,async()=>{
   const data=await json(snapshotUrl(meta),{timeout:4000});
   if(!data||data.version!==SNAPSHOT_VERSION||!Array.isArray(data.activities)||!Array.isArray(data.restaurants))throw Error('bad snapshot');
   const wellness=(data.wellness||[]).map(revivePlace);
   const acts=data.activities.map(revivePlace),seen=new Set(acts.map(p=>normalize(p.name)));
   const merged=acts.concat(wellness.filter(p=>{const n=normalize(p.name);if(p.meals||seen.has(n))return false;seen.add(n);return true;}));
   return {generic:true,source:'snapshot',city:data.city||meta.name,center:data.center||null,activities:merged,restaurants:data.restaurants.map(revivePlace),wellness};
  }).catch(()=>null);
 }
 function googleKey(){return String(options.googleKey!==undefined?options.googleKey:(root.GONOW_PLACES_CONFIG&&root.GONOW_PLACES_CONFIG.GOOGLE_PLACES_KEY)||'').trim();}
 // App-side safety cap: at most LIMIT Places API requests per browser per day (Cloud quotas can't be lowered on
 // the trial account). Past the cap the app quietly uses the cached city, the shared ID list or the fallback.
 const LIMIT=options.dailyLimit||40, BUDGET='gonow:places-budget';
 function today(){return new Date(now()).toISOString().slice(0,10);}
 function budget(){try{const b=JSON.parse(storage.getItem(BUDGET)||'null');return b&&b.day===today()?b:{day:today(),n:0};}catch(e){return {day:today(),n:0};}}
 function spend(n){const b=budget();if(b.n+n>LIMIT)return false;b.n+=n;try{storage.setItem(BUDGET,JSON.stringify(b));}catch(e){}return true;}
 // Places API (New). Tight field masks: rating and hours put this on the Enterprise SKU; no reviews, website, phone or price.
 const PLACE_FIELDS='id,displayName,location,primaryType,types,formattedAddress,googleMapsUri,businessStatus,photos.name,photos.authorAttributions,rating,userRatingCount,regularOpeningHours.periods,regularOpeningHours.weekdayDescriptions';
 const FIELDS=PLACE_FIELDS.split(',').map(f=>'places.'+f).join(',');
 // One Text Search per category for more precise results.
 const CATEGORIES=[['sights','top sights and attractions in '],['restaurants','best restaurants in '],['cafes','best cafes and coffee in '],['outdoors','parks, beaches, hikes and wellness in ']];
 function search(text,center,key){return json('https://places.googleapis.com/v1/places:searchText',{timeout:GOOGLE_TIMEOUT,method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':FIELDS},body:JSON.stringify({textQuery:text,maxResultCount:20,languageCode:'en',...(center?{locationBias:{circle:{center:{latitude:center.lat,longitude:center.lng},radius:10000}}}:{})})});}
 function details(id,key){return json('https://places.googleapis.com/v1/places/'+encodeURIComponent(id),{timeout:GOOGLE_TIMEOUT,headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':PLACE_FIELDS}});}
 // Keep open, well-reviewed places, best first: rating × log(reviews).
 const MIN_REVIEWS=30;
 function score(p){const r=+p.rating||0,n=+p.userRatingCount||0;return r*Math.log10(n+1);}
 function keep(list){return (list||[]).filter(p=>p&&(!p.businessStatus||p.businessStatus==='OPERATIONAL')&&(+p.userRatingCount||0)>=MIN_REVIEWS).sort((a,b)=>score(b)-score(a));}
 function hotelCenter(hotel){return hotel&&Number.isFinite(hotel.lat)&&Number.isFinite(hotel.lng)?{lat:hotel.lat,lng:hotel.lng}:null;}
// Shared lists are written by other users, so a fetched place only counts if it really is in/near the city:
// the anchor is the median position of places whose fresh Google address names the city (at least 3 needed),
// and every kept place must be within 50 km of it. Junk or far-away IDs never show up.
function fold(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function inCity(rows,city){const name=fold(String(city).split(',')[0]).trim();if(name.length<2)return [];
 const pos=r=>r.p&&r.p.location&&Number.isFinite(+r.p.location.latitude)&&Number.isFinite(+r.p.location.longitude)?{lat:+r.p.location.latitude,lng:+r.p.location.longitude}:null;
 const named=rows.filter(r=>pos(r)&&fold(r.p.formattedAddress).includes(name));if(named.length<3)return [];
 const mid=v=>{const a=v.slice().sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};const anchor={lat:mid(named.map(r=>pos(r).lat)),lng:mid(named.map(r=>pos(r).lng))};
 return rows.filter(r=>{const p=pos(r);return p&&km(anchor,p)<=50;});}
function km(a,b){const R=6371,d=x=>x*Math.PI/180,dl=d(b.lat-a.lat),dg=d(b.lng-a.lng),h=Math.sin(dl/2)**2+Math.cos(d(a.lat))*Math.cos(d(b.lat))*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
function googleCacheKey(city,hotel){const center=hotelCenter(hotel);return 'google:'+normalize(city)+':'+(center?center.lat.toFixed(3)+','+center.lng.toFixed(3):'');}
function google(city,hotel,key,opts={}){const center=hotelCenter(hotel);
  return cached(googleCacheKey(city,hotel),DAY,async()=>{
   // 1) A shared list of place IDs for this city (IDs are the only Google data stored long-term); details are fetched fresh.
   let shared=null;if(!center&&options.sharedIds){try{shared=await cap(Promise.resolve(options.sharedIds(slug(city))),800);}catch(e){shared=null;}}
   if(Array.isArray(shared)&&shared.length>=8){const list=shared.filter(x=>x&&/^[\w-]{10,300}$/.test(x.id)).slice(0,24);
    if(list.length&&spend(list.length)){const got=await Promise.all(list.map(x=>details(x.id,key).then(p=>({p,cat:x.cat}),()=>null)));const ok=got.filter(Boolean);
     const near=inCity(ok,city);if(near.length>=6){const by=c=>keep(near.filter(x=>x.cat===c).map(x=>x.p));return googleCatalog([...by('sights'),...by('outdoors')],[...by('restaurants'),...by('cafes')],city,center,key);}}}
   // 2) Category searches in parallel. The first half that lands (sights+outdoors or food) can render while the rest loads.
   if(!spend(CATEGORIES.length))throw Error('daily cap');
   const results={};const tasks=CATEGORIES.map(([cat,q])=>search(q+city,center,key).then(r=>{results[cat]=keep(r.places);},()=>{results[cat]=[];}).then(()=>{
    if(opts.onPartial&&results.sights&&results.outdoors&&!(results.restaurants&&results.cafes)){try{opts.onPartial(Object.assign(googleCatalog([...results.sights,...results.outdoors],[],city,center,key),{partial:true}));}catch(e){}}}));
   await Promise.all(tasks);
   const sights=[...results.sights,...results.outdoors],food=[...results.restaurants,...results.cafes];
   // A thin result (small town, all under 30 reviews) is not cached; the OpenStreetMap fallback gets a turn.
   if(sights.length+food.length<3)throw Error('too few places');
   const out=googleCatalog(sights,food,city,center,key);
   if(!center&&options.saveIds){const ids=[];const add=(list,cat)=>list.slice(0,6).forEach(p=>{if(!ids.some(x=>x.id===p.id))ids.push({id:p.id,cat});});add(results.sights,'sights');add(results.outdoors,'outdoors');add(results.restaurants,'restaurants');add(results.cafes,'cafes');
    try{Promise.resolve(options.saveIds(slug(city),city,ids)).catch(()=>{});}catch(e){}}
   return out;});}
 // Google periods -> the same {week:[[start,end],...]} shape parseHours returns (0 = Sunday, minutes from midnight).
 function googleHours(h){const periods=h&&Array.isArray(h.periods)?h.periods:null;if(!periods||!periods.length)return null;const week=[[],[],[],[],[],[],[]];
  for(const p of periods){const o=p&&p.open;if(!o||!Number.isInteger(o.day)||o.day<0||o.day>6)continue;const a=(o.hour||0)*60+(o.minute||0);
   if(!p.close){if(periods.length===1&&a===0){week.forEach(d=>d.push([0,1440]));break;}continue;}
   const c=p.close,b=c.day===o.day?(c.hour||0)*60+(c.minute||0):1440;if(b>a)week[o.day].push([a,b]);}
  return week.some(d=>d.length)?{week}:null;}
 function googleRating(p){const r=+p.rating,n=+p.userRatingCount;return Number.isFinite(r)&&r>0?{rating:Math.round(r*10)/10,ratingCount:Number.isFinite(n)?n:0}:{};}
 function googleCatalog(sights,food,city,center,key){
  const DINING=/restaurant|cafe|coffee|bakery|bar|food|meal|diner|bistro/;const BREAKFAST=/breakfast|brunch|cafe|coffee|bakery/;
  const kind=t=>{const types=[t.primaryType||'',...(t.types||[])].join(' ');return /museum/.test(types)?'museum':/art_gallery/.test(types)?'gallery':/zoo/.test(types)?'zoo':/aquarium/.test(types)?'aquarium':/beach/.test(types)?'beach':/park|garden|hiking/.test(types)?'park':/observation|viewpoint|scenic/.test(types)?'viewpoint':/cafe|coffee|bakery/.test(types)?'cafe':DINING.test(types)?'restaurant':'attraction';};
  const seen=new Set();const rows=[...sights,...food].filter(p=>p&&p.id&&p.displayName&&p.location&&!seen.has(p.id)&&seen.add(p.id)).map((p,i)=>{const k=kind(p),dining=['restaurant','cafe'].includes(k),photo=p.photos&&p.photos[0],author=photo&&photo.authorAttributions&&photo.authorAttributions[0];
   return {id:'g-'+p.id,placeId:p.id,name:p.displayName.text,type:k,category:labels[k]||'Attraction',lat:+p.location.latitude,lng:+p.location.longitude,area:city,address:p.formattedAddress||'',...estimates(k),needsTicket:false,price:'',intro:'',
    photo:photo&&photo.name&&/^places\/[\w-]+\/photos\/[\w-]+$/.test(photo.name)?'gplace:'+photo.name:'',creditUrl:author&&author.uri||p.googleMapsUri||'',creditName:author&&author.displayName||'Google Maps',
    generic:true,section:'popular',source:'google',cuisine:dining?(k==='cafe'?'Coffee':''):'',...(dining?{meals:BREAKFAST.test([p.primaryType,...(p.types||[])].join(' '))?['breakfast','lunch','snack']:['lunch','dinner']}:{}),...googleRating(p),openingHours:p.regularOpeningHours&&Array.isArray(p.regularOpeningHours.weekdayDescriptions)?p.regularOpeningHours.weekdayDescriptions.map(String).join('; ').replace(/[\u202f\u2009]/g,' '):'',parsedHours:googleHours(p.regularOpeningHours),hours:{},closed:[],closedDates:[],tags:[],mapUrl:p.googleMapsUri||'',rank:i};}).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  const middle=center||(rows.length?{lat:rows.reduce((a,p)=>a+p.lat,0)/rows.length,lng:rows.reduce((a,p)=>a+p.lng,0)/rows.length}:null);
  if(!rows.length)throw Error('No places');
  return {generic:true,source:'google',city,center:middle,activities:rows.filter(p=>!p.meals),restaurants:rows.filter(p=>p.meals)};}
 function enrich(place){return cached('photo:'+(place.wikipedia||place.wikidata||place.id),30*DAY,async()=>{
  let wiki=place.wikipedia;
  if(!wiki&&/^Q\d+$/.test(place.wikidata||'')){
   const data=await json('https://www.wikidata.org/wiki/Special:EntityData/'+place.wikidata+'.json'),entity=data.entities[place.wikidata],site=entity.sitelinks&&(entity.sitelinks.enwiki||Object.values(entity.sitelinks).find(s=>/^[a-z]+wiki$/.test(s.site)));
   if(site)wiki=site.site.replace(/wiki$/,'')+':'+site.title;
   else {const file=entity.claims&&entity.claims.P18&&entity.claims.P18[0].mainsnak.datavalue.value;if(file)return {photo:'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(file)+'?width=500',creditUrl:'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(file)};}
  }
  if(!wiki)return {};
  const m=wiki.match(/^([a-z-]+):(.+)$/);if(!m)return {};
  const data=await json('https://'+m[1]+'.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(m[2]));
  return {photo:data.thumbnail&&data.thumbnail.source||'',intro:(data.extract||'').split(/(?<=[.!?])\s/)[0],creditUrl:data.content_urls&&data.content_urls.desktop&&data.content_urls.desktop.page||'https://'+m[1]+'.wikipedia.org/wiki/'+encodeURIComponent(m[2])};
 }).then(data=>Object.assign(place,data)).catch(()=>place);}
 return {load,geocode,nearby,enrich,catalog,snapshot,matchSnapshot};
}
// Google photos are stored as key-free 'gplace:<photo name>' tokens; the URL (with the key) is built only at render time.
// Photo loads are billed too: at most PHOTO_LIMIT distinct Google photos per browser per day, then placeholders.
const PHOTO_LIMIT=150;
function photoAllowed(name){try{const ls=root.localStorage,day=new Date().toISOString().slice(0,10);let b=JSON.parse(ls.getItem('gonow:places-photos')||'null');if(!b||b.day!==day)b={day,seen:[]};if(b.seen.includes(name))return true;if(b.seen.length>=PHOTO_LIMIT)return false;b.seen.push(name);ls.setItem('gonow:places-photos',JSON.stringify(b));return true;}catch(e){return true;}}
function photoSrc(v){v=String(v||'');const m=/^gplace:(places\/[\w-]+\/photos\/[\w-]+)$/.exec(v);if(!m)return /^gplace:/.test(v)?'':v;if(!photoAllowed(m[1]))return '';const cfg=root.GONOW_PLACES_CONFIG,key=String(cfg&&cfg.GOOGLE_PLACES_KEY||'').trim();return key?'https://places.googleapis.com/v1/'+m[1]+'/media?maxWidthPx=480&key='+encodeURIComponent(key):'';}
window.GoNowPlaceSource={photoSrc,create,prune,parseHours,allows,estimates,durationLabel,cardLine,ratingLabel,placeholder,slug,normalize,CONTACT,matchSnapshot:function(city){const idx=root.GONOW_CITY_INDEX;if(!idx||idx.version!==1||!Array.isArray(idx.cities))return null;const q=normalize(city),s=slug(city);return idx.cities.find(c=>c.slug===s||normalize(c.name)===q||(c.aliases||[]).some(a=>normalize(a)===q||slug(a)===s))||null;}};
})();
