/* On-demand public place data. No requests are made until load/enrich is called. */
(function(){
'use strict';
const CONTACT='gonow-preview@users.noreply.github.com', DAY=86400000;
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
function category(t){return (['restaurant','cafe'].includes(t.amenity)?t.amenity:'')|| (t.leisure==='park'?'park':t.natural==='beach'?'beach':t.tourism)||'attraction';}
const labels={park:'Park',beach:'Beach',museum:'Museum',viewpoint:'Viewpoint',attraction:'Attraction',zoo:'Zoo',aquarium:'Aquarium',gallery:'Gallery',restaurant:'Restaurant',cafe:'Cafe'};
const estimates=k=>({duration:['museum','zoo','aquarium'].includes(k)?120:60,effort:['park','beach','viewpoint'].includes(k)?'Moderate est.':'Easy est.'});
const durationLabel=p=>(p.duration/60)+' h est.';
const cardLine=p=>p.category+' · '+(p.cuisine||durationLabel(p));
const icons={park:'♧',beach:'≈',museum:'▥',viewpoint:'△',attraction:'◇',zoo:'◇',aquarium:'≈',gallery:'▥',restaurant:'♨',cafe:'☕'};
function placeholder(p){return '<div class="place-placeholder" data-testid="place-placeholder" role="img" aria-label="'+(labels[p.type]||'Attraction')+' illustration">'+(icons[p.type]||'◇')+'</div>';}
function create(options={}){
 const request=options.fetch||((...args)=>window.fetch(...args)),now=options.now||Date.now,sleep=options.sleep||(ms=>new Promise(r=>setTimeout(r,ms))),storage=options.storage||window.localStorage;
 let geoTail=Promise.resolve(),lastGeo=-Infinity,overTail=Promise.resolve();
 try{lastGeo=Number(storage.getItem('gonow:places:last-geocode'))||-Infinity;}catch(e){}
 const inflight=new Map();
 function read(key){try{const v=JSON.parse(storage.getItem('gonow:places:'+key));return v&&v.until>now()?v.value:null;}catch(e){return null;}}
 function write(key,value,ttl){try{storage.setItem('gonow:places:'+key,JSON.stringify({value,until:now()+ttl}));}catch(e){}return value;}
 async function json(url,init={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await request(url,{...init,signal:controller.signal});if(!r.ok)throw Error('Unavailable');return await r.json();}finally{clearTimeout(timer);}}
 function cached(key,ttl,fn){const hit=read(key);if(hit)return Promise.resolve(hit);if(inflight.has(key))return inflight.get(key);const p=Promise.resolve().then(fn).then(v=>write(key,v,ttl)).finally(()=>inflight.delete(key));inflight.set(key,p);return p;}
 function geocode(query){return cached('geo:'+normalize(query),180*DAY,()=>{const job=geoTail.then(async()=>{
  // A destination submission, never an autocomplete request. Settle rapid navigation first.
  await sleep(300);await sleep(Math.max(0,1000-(now()-lastGeo)));lastGeo=now();try{storage.setItem('gonow:places:last-geocode',String(lastGeo));}catch(e){}
  const rows=await json('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(query)+'&email='+encodeURIComponent(CONTACT));
  if(!rows.length||!Number.isFinite(+rows[0].lat)||!Number.isFinite(+rows[0].lon))throw Error('No city');return {lat:+rows[0].lat,lng:+rows[0].lon};
 });geoTail=job.catch(()=>{});return job;});}
 function nearby(center,radius=10000){const key='near:'+center.lat.toFixed(3)+','+center.lng.toFixed(3)+':'+radius;return cached(key,7*DAY,()=>{
  const job=overTail.then(async()=>{const around='(around:'+radius+','+center.lat+','+center.lng+')',query='[out:json][timeout:20];(nwr'+around+'[tourism~"^(attraction|museum|viewpoint|zoo|aquarium|gallery)$"][name];nwr'+around+'[leisure=park][name];nwr'+around+'[natural=beach][name];nwr'+around+'[amenity~"^(restaurant|cafe)$"][name];);out center tags 160;';
   for(let attempt=0;attempt<2;attempt++){try{return await json('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query)});}catch(e){if(attempt)throw e;await sleep(1500);}}
  });overTail=job.catch(()=>{});return job;
 });}
 function catalog(data,center,city){
  const seen=new Set(),distance=p=>Math.hypot(p.lat-center.lat,(p.lng-center.lng)*Math.cos(center.lat*Math.PI/180));
  const rows=(data.elements||[]).filter(e=>e.tags&&e.tags.name).map(e=>{const t=e.tags,k=category(t),point=e.center||e,dining=['restaurant','cafe'].includes(k);return {id:'osm-'+e.type+'-'+e.id,name:t['name:en']||t.name,type:k,category:labels[k]||'Attraction',lat:+point.lat,lng:+point.lon,area:t['addr:suburb']||city,address:[t['addr:housenumber'],t['addr:street'],t['addr:city']].filter(Boolean).join(' '),...estimates(k),price:'',intro:'',photo:'',generic:true,section:'popular',cuisine:t.cuisine?t.cuisine.replace(/[_;]/g,' '):k==='cafe'?'Coffee':'',...(dining?{meals:k==='cafe'?['breakfast','lunch','snack']:['lunch','dinner']}:{}),openingHours:t.opening_hours||'',parsedHours:parseHours(t.opening_hours),hours:parseHours(t.opening_hours)||{},closed:[],closedDates:[],tags:[],wikipedia:t.wikipedia,wikidata:t.wikidata,mapUrl:'https://www.openstreetmap.org/'+e.type+'/'+e.id,notability:Number(!!t.wikipedia)+Number(!!t.wikidata),richness:Object.keys(t).length};}).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  rows.sort((a,b)=>b.notability-a.notability||b.richness-a.richness||distance(a)-distance(b));
  const unique=rows.filter(p=>{const n=normalize(p.name);if(seen.has(n))return false;seen.add(n);return true;});
  return {generic:true,city,center,activities:unique.filter(p=>!p.meals),restaurants:unique.filter(p=>p.meals)};
 }
 async function load(city,hotel){try{const center=hotel&&Number.isFinite(hotel.lat)&&Number.isFinite(hotel.lng)?hotel:await geocode(city);return {catalog:catalog(await nearby(center),center,city),fallback:false};}catch(e){return {catalog:null,fallback:true};}}
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
 return {load,geocode,nearby,enrich,catalog};
}
window.GoNowPlaceSource={create,parseHours,allows,estimates,durationLabel,cardLine,placeholder,slug,normalize,CONTACT};
})();
