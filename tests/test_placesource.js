const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{},AbortController,setTimeout,clearTimeout,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/placesource.js','utf8'),ctx);
const S=ctx.window.GoNowPlaceSource,fixture=(city,kind)=>JSON.parse(fs.readFileSync(`tests/fixtures/${city}_${kind}.json`));
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
(async()=>{
 let time=0,calls=[],geoTimes=[];
 const source=S.create({storage:memory(),now:()=>time,sleep:async ms=>{time+=ms;},fetch:async(url,init)=>{
  calls.push({url,init});let city=url.includes('Tokyo')?'tokyo':'seattle';
  if(url.includes('nominatim')){geoTimes.push(time);return {ok:true,json:async()=>fixture(city,'nominatim')};}
  if(url.includes('overpass')){assert.equal(init.method,'POST');assert.equal(init.headers['Content-Type'],'application/x-www-form-urlencoded');assert(init.body.startsWith('data='));assert(decodeURIComponent(init.body).includes('out center tags 160'));city=decodeURIComponent(init.body).includes('35.6762')?'tokyo':'seattle';return {ok:true,json:async()=>fixture(city,'overpass')};}
  return {ok:true,json:async()=>fixture(url.includes('Tokyo')?'tokyo':'seattle','wikipedia')};
 }});
 assert.equal(calls.length,0,'no network at construction');
 assert.notEqual(S.slug('東京'),S.slug('京都'));assert.equal(S.slug('São Paulo'),'sao-paulo');
 const result=await source.load('Seattle'),c=result.catalog;assert(!result.fallback);assert.equal(c.activities.length,3);assert.equal(c.restaurants.length,1);
 assert.equal(c.activities[0].name,'Seattle Art Museum','notability first and duplicate removed');assert.equal(c.activities[1].name,'Space Needle');
 assert.equal(c.activities[2].name,'Olympic Sculpture Park');assert.equal(S.cardLine(c.activities[0]),'Museum · 2 h est.');assert.equal(S.cardLine(c.restaurants[0]),'Cafe · coffee shop');
 assert.equal(c.activities[0].photo,'');assert(S.placeholder(c.activities[2]).includes('Park illustration'));assert(!S.placeholder(c.activities[2]).includes('<img'));
 assert(!calls.some(c=>c.url.includes('wikipedia')),'load never eagerly requests photos');
 await source.enrich(c.activities[0]);assert(c.activities[0].photo.includes('wikimedia'));assert(c.activities[0].intro.includes('museum'));assert(c.activities[0].creditUrl.includes('wikipedia'));
 const count=calls.length;await source.enrich(c.activities[0]);await source.load('  SEATTLE  ');assert.equal(calls.length,count,'cached load/enrichment makes no fetch');
 await Promise.all([source.geocode('Tokyo'),source.geocode('Lisbon')]);assert(geoTimes.every((t,i)=>!i||t-geoTimes[i-1]>=1000),'Nominatim starts spaced at least one second');
 assert(calls[0].url.includes('email='+encodeURIComponent(S.CONTACT)));
 const tokyo=await source.load('Tokyo');assert.equal(tokyo.catalog.activities[0].name,'Tokyo National Museum');
 const h=S.parseHours('Mo-Fr 09:00-17:00; Sa 10:00-16:00');assert(S.allows(h,'2026-11-16',540,120));assert(!S.allows(h,'2026-11-22',600,60));assert(!S.allows(h,'2026-11-21',900,120));
 assert(S.allows(S.parseHours('24/7'),'2026-11-22',0,1440));assert(!S.allows(S.parseHours('off'),'2026-11-16',600,60));assert(!S.allows(S.parseHours('Tu-Su 10:00-18:00'),'2026-11-16',600,60));
 for(const invalid of ['',null,'sunrise-sunset','Mo 25:00-26:00','Mo 22:00-02:00','PH off'])assert.equal(S.parseHours(invalid),null);
 const split=S.parseHours('Mo 09:00-12:00,14:00-18:00');assert(!S.allows(split,'2026-11-16',690,90));assert(S.allows(null,'2026-11-16',0,1440));
 let failures=0,waits=[];const bad=S.create({storage:memory(),sleep:async ms=>waits.push(ms),fetch:async url=>{failures++;if(url.includes('nominatim'))return {ok:true,json:async()=>fixture('seattle','nominatim')};throw Error('offline');}});
 assert((await bad.load('Seattle')).fallback);assert.equal(failures,3,'one geocode and two bounded place attempts');assert(waits.includes(1500));
 assert((await S.create({storage:memory(),sleep:async()=>{},fetch:async()=>{throw Error('offline');}}).load('Tokyo')).fallback);
 // Generic weekly hours survive scheduling and DayBuilder conversion/reflow rules.
 ctx.window.DayBuilder=undefined;ctx.window=ctx;ctx.localStorage=memory();ctx.document={};ctx.Date=Date;
 for(const f of ['oahu','daybuilder','pickscheduler'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8').replace('window.DayBuilder = {','window.DayBuilder = {convert,'),ctx);
 const a={destination:'Seattle',start:'2026-11-15',end:'2026-11-20',picks:{activities:c.activities.map(p=>p.id),restaurants:c.restaurants.map(p=>p.id)}};
 const scheduled=ctx.PickScheduler.schedule(a,c);assert.equal(scheduled.unfit.length,0);
 for(const day of scheduled.days)for(const item of day.items.filter(i=>i.pick)){assert(S.allows(item.pick.parsedHours,day.date,item.start,item.duration));assert(!ctx.DayBuilder.blockedOn(ctx.DayBuilder.convert(item),day.date));}
 assert.equal(scheduled.days.at(-1).items.at(-1).title,'Leave for the airport');
 const swapCatalog={...c,restaurants:[...c.restaurants,{...c.restaurants[0],id:'another-cafe'}]};
 const swapAnswers=JSON.parse(JSON.stringify(a));assert(ctx.PickScheduler.swap(swapAnswers,c.restaurants[0].id,swapCatalog));assert(swapAnswers.picks.restaurants.includes('another-cafe'));assert(!swapAnswers.picks.activities.includes('another-cafe'));
 const museum=c.activities[0];assert(ctx.DayBuilder.closedOn({...museum,title:museum.name},'2026-11-16'));assert(ctx.DayBuilder.blockedOn({...museum,title:museum.name,preferred:1080},'2026-11-17'));
 // Ranking tie breakers, hotel-centred queries, empty results and expiry.
 const ranked=source.catalog({elements:[
  {type:'node',id:1,lat:47.7,lon:-122.3,tags:{name:'Rich',tourism:'museum',website:'https://example.org'}},
  {type:'node',id:2,lat:47.6062,lon:-122.3321,tags:{name:'Near',tourism:'museum'}},
  {type:'node',id:3,lat:48,lon:-122,tags:{name:'Far',tourism:'museum'}},
 ]},c.center,'Seattle');assert.equal(ranked.activities.map(p=>p.name).join(','),'Rich,Near,Far');
 let hotelCalls=[];const hotelSource=S.create({storage:memory(),fetch:async url=>{hotelCalls.push(url);return {ok:true,json:async()=>({elements:[]})};}});
 const empty=await hotelSource.load('Seattle',{lat:47.6,lng:-122.3});assert.equal(empty.catalog.activities.length,0);assert(!hotelCalls.some(u=>u.includes('nominatim')));
 const beforeExpiry=calls.length;time+=8*86400000;await source.load('Seattle');assert.equal(calls.length,beforeExpiry+1,'place cache expires after seven days; city cache lasts longer');
 // Exercise the app's actual checkout with generic catalogs as the Oahu suite does.
 const app=fs.readFileSync('js/app.js','utf8');ctx.GoNowPlaceSource=S;
 ctx.Engine={buildTemplatePlan:a=>({start:a.start,end:a.end,days:[]}),matchDestination:()=>({id:'custom'}),dateRange:()=>'',applyAgeRules:p=>p};
 ctx.readTrips=()=>[];ctx.ITEM_PHOTOS={};ctx.showPlan=p=>ctx.state.plan=p;
 vm.runInContext(app.slice(app.indexOf('    function checkoutPicks('),app.indexOf('    function pickScreen(')),ctx);
 for(const [city,cat] of [['Seattle',c],['Tokyo',tokyo.catalog]]){
  ctx.state={answers:{...a,destination:city,ages:[18,19]},tripId:null};ctx.pickCatalog=()=>cat;ctx.checkoutPicks();
  assert.equal(ctx.state.plan.id,city.toLowerCase()+'-picks-'+a.start);assert(ctx.state.plan.days.some(d=>d.items.some(i=>i.pick)));
 }
 // Exercise loading, rejected lookup and loaded rendering with the real app function.
 vm.runInContext(fs.readFileSync('js/pickcatalog.js','utf8'),ctx);
 const elements={'pick-results':{},'pick-count':{}},handlers={};
 const input={};ctx.document={getElementById:id=>elements[id]};
 ctx.view={innerHTML:'',querySelector:()=>input,querySelectorAll:()=>[]};
 ctx.nearbyKey=()=> 'Seattle';ctx.nearbyCatalogs={};ctx.pickFilter='All';ctx.pickQuery='';
 ctx.state={screen:'pick-activities',answers:{destination:'Seattle'}};
 ctx.esc=s=>s;ctx.btn=(label,id)=>`<button data-testid="${id}">${label}</button>`;
 ctx.on=(id,fn)=>handlers[id]=fn;ctx.save=()=>{};ctx.normalizeAnswers=a=>a;
 ctx.get=()=>{throw Error('ID-only elements must use getElementById');};
 let rejectLookup;ctx.nearbySource={load:()=>new Promise((resolve,reject)=>{rejectLookup=reject;})};
 ctx.generate=(resume,without)=>{ctx.usedFallback=without;};
 vm.runInContext(app.slice(app.indexOf('    function nearbyPickScreen('),app.indexOf('    function generate(')),ctx);
 ctx.nearbyPickScreen();assert(ctx.view.innerHTML.includes('Finding places near Seattle'));
 assert(!ctx.view.innerHTML.includes('pick-chips'));await Promise.resolve();rejectLookup(Error('CORS'));
 await new Promise(resolve=>setImmediate(resolve));
 assert(ctx.view.innerHTML.includes('data-testid="place-failure"'));assert(!ctx.view.innerHTML.includes('pick-chips'));
 handlers['pick-fallback']();assert(ctx.usedFallback);
 ctx.nearbyCatalogs.Seattle=c;ctx.state.answers={destination:'Seattle',picks:{city:'Seattle',activities:[],restaurants:[]}};
 ctx.nearbyPickScreen();assert(elements['pick-results'].innerHTML.includes('data-testid="pick-card"'));
 assert(ctx.view.innerHTML.includes('pick-chips'));assert(elements['pick-count'].textContent);
 console.log('PASS any-city ranking, dedupe, cache, lazy photos, placeholders, estimates, rate limit, hours, scheduler and fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
