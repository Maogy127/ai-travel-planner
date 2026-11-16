/* Destination-local flight windows; estimates never imply a flight lookup. */
(function(root){
'use strict';
const parse=s=>{if(typeof s==='number')return s>=0&&s<1440?s:null;const m=String(s||'').trim().match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)?$/i);if(!m||+m[1]>(m[3]?12:23)||(m[3]&&+m[1]<1))return null;return (m[3]?+m[1]%12*60+(m[3].toUpperCase()==='PM'?720:0):+m[1]*60)+ +m[2];};
const clock=n=>(Math.floor(n/60)%12||12)+':'+String(n%60).padStart(2,'0')+(n<720?' AM':' PM');
function migrate(a){if(!a.returnTime&&a.flightTime)a.returnTime=a.flightTime;delete a.flightTime;return a;}
function route(a){
 const j=root.GoNowJetlag,home=j?j.home(a.origin):{tz:'America/Los_Angeles'},dest=j?j.home(a.destination):{tz:'Pacific/Honolulu'};
 const zones={kyoto:'Asia/Tokyo',bali:'Asia/Makassar',lisbon:'Europe/Lisbon',barcelona:'Europe/Madrid',cancun:'America/Cancun',reykjavik:'Atlantic/Reykjavik',banff:'America/Edmonton',costarica:'America/Costa_Rica',capetown:'Africa/Johannesburg'};
 const known=root.Engine&&root.Engine.matchDestination?root.Engine.matchDestination(a.destination):null;
 const key=String(a.destination||'').toLowerCase().replace(/\s/g,'');dest.tz=known&&known.tz||zones[key]||dest.tz;
 const countries=z=>/Honolulu|America\/(Los_Angeles|New_York|Chicago)/.test(z)?'US':/Tokyo/.test(z)?'JP':z;
 let international=countries(home.tz)!==countries(dest.tz);
 if(root.Engine&&root.Engine.originRegion){const r=root.Engine.originRegion(a);if(/^us/.test(r)&&known&&known.country)international=known.country!=='USA';if(r==='canada'&&known&&known.country)international=known.country!=='Canada';}
 const region=root.Engine&&root.Engine.originRegion?root.Engine.originRegion(a):'west';
 const hawaii=/oahu|hawaii|honolulu|hnl/i.test(a.destination||'');
 const hours=hawaii?({usWest:6,usEast:11,usCentral:9,eastAsia:10,canada:7,europe:17}[region]||(/New_York/.test(home.tz)?11:/Asia/.test(home.tz)?10:6)):international?(/Tokyo/.test(dest.tz)?12:/Europe/.test(dest.tz)?(region==='usEast'?7:11):10):home.tz===dest.tz?2.5:5.5;
 const date=a.start||'2026-11-25',delta=j?j.offset(date,dest.tz)-j.offset(date,home.tz): -120;
 return {international,hours,landing:((540+hours*60+delta)%1440+1440)%1440,departure:((1080-hours*60+delta)%1440+1440)%1440};
}
function windowFor(a){a=migrate({...a});const r=route(a),landing=parse(a.arrivalTime)??r.landing,departure=parse(a.returnTime)??r.departure;
 const road=root.DayBuilder?root.DayBuilder.estimateTravel({area:a.stay||'Hotel'},{area:'Airport'}).minutes:35;
 return {landing,departure,arrivalStart:landing+75,leave:Math.max(0,departure-(r.international?180:120)-road),road,international:r.international,arrivalEstimated:parse(a.arrivalTime)===null,returnEstimated:parse(a.returnTime)===null};}
function label(a,direction){const w=windowFor(a),arrival=direction==='arrival',number=a[arrival?'arrivalFlight':'returnFlight']||'',est=w[arrival?'arrivalEstimated':'returnEstimated'];return (number?number+' · ':'')+(est?'Est. ':'')+(arrival?'lands ':'departs ')+(est?'~':'')+clock(w[arrival?'landing':'departure']);}
function fields(a,escape){const e=escape||String;return '<p>Times at your destination</p>'+['arrival','return'].map((k,i)=>'<div class="flight-row"><strong>'+ (i?'Return':'Arrival')+'</strong><label>Flight number (optional)<input data-flight-field="'+k+'Flight" data-testid="'+k+'-flight" placeholder="'+(i?'Flight number':'HA 11')+'" value="'+e(a[k+'Flight']||'')+'"></label><label>'+ (i?'Departs · last day':'Lands · day 1')+'<input type="time" data-flight-field="'+k+'Time" data-testid="'+k+'-time" value="'+e(parse(a[k+'Time'])===null?'':String(Math.floor(parse(a[k+'Time'])/60)).padStart(2,'0')+':'+String(parse(a[k+'Time'])%60).padStart(2,'0'))+'"></label></div>').join('')+'<span data-flight-booking-hook hidden></span>';}
root.GoNowFlights={parse,clock,migrate,route,windowFor,label,fields};
})(typeof window==='undefined'?globalThis:window);
/* Pure local scheduling: constrained picks first, then area clusters and free slots. */
(function(){
'use strict';
const minute=t=>{if(typeof t==='number')return t;if(/[AP]M/i.test(String(t)))return window.DayBuilder.parseClock(String(t));const m=String(t||'').match(/^(\d+):(\d+)/);return m?+m[1]*60 + +m[2]:null;};
// Match the legacy Moderate default when the pace question was skipped.
const pace=a=>['gentle','active','athlete'].includes(a.level)?a.level:({'Easy':'gentle','Moderate':'active','Full-on':'athlete'}[a.pace]||'active');
const capacity=a=>({gentle:300,active:420,athlete:540}[pace(a)]);
function departure(a){if(window.GoNowFlights&&(a.flightsStep||a.returnTime||a.arrivalTime)){const w=window.GoNowFlights.windowFor(a);return {flight:w.departure,leave:w.leave};}const sample=!a.generic&&a.start==='2026-11-25'&&a.end==='2026-11-29';const flight=minute(a.flightTime||a.builderFlightTime)??(sample?480:null);return {flight,leave:flight===null?600:Math.max(0,flight-185)};}

const travel=(a,b)=>!a||!b?0:window.DayBuilder.estimateTravel(a,b).minutes;
function scheduleOnce(a,catalog,attempt=0,seed){
 const start=a.start||'2026-11-25',end=a.end||'2026-11-29',days=[];
 for(let t=Date.parse(start+'T12:00:00Z');t<=Date.parse(end+'T12:00:00Z')&&days.length<31;t+=86400000)days.push({date:new Date(t).toISOString().slice(0,10),theme:'',items:[],prep:[],unscheduled:[]});
 const picks=a.picks||{},all=[...catalog.activities,...catalog.restaurants].map(p=>catalog.generic?{...p,area:p.area||'',duration:p.duration||60,price:p.price||'',intro:p.intro||'',closed:p.closed||[],hours:p.parsedHours||p.hours||{}}:p),selected=all.filter(i=>i.reservation||i.locked||i.booked||(picks.activities||[]).includes(i.id)||(picks.restaurants||[]).includes(i.id));
 if(seed)days.forEach(d=>{d.items=JSON.parse(JSON.stringify(seed[d.date]||[]));});
 const fw=window.GoNowFlights.windowFor(a);const unfit=[],bookingIssues=[];const {flight,leave}=departure({...a,start,end,generic:catalog.generic});
 function fits(p,d,t){
  const length=p.duration||60,close=d.date===end?Math.min(1320,leave):1320;
  if(d.date===end&&a.flightsStep&&fw.departure<=480)return false;
  if(d.date===end&&leave<=600&&(!p.meals||!p.meals.includes('breakfast')||length>60))return false;
  if(d.date===start&&!p.meals)return false;
  if(t<(d.date===start?Math.max(1140,fw.arrivalStart):360)||t+length+(d.date===end?(a.flightsStep||a.returnTime||a.arrivalTime?Math.max(0,travel(p,{area:"Airport"})-fw.road):travel(p,{area:"Airport"})):0)>close)return false;
  const hrs=p.ruleHours&&(!p.ruleHours.date||p.ruleHours.date===d.date)?p.ruleHours:p.hours;
  if(hrs&&hrs.open!=null&&(t<minute(hrs.open)||t+length>minute(hrs.close)))return false;
  if(window.DayBuilder.closedOn({...p,title:p.name},d.date))return false;
  if(window.DayBuilder.blockedOn({...p,title:p.name,preferred:t,duration:length},d.date,{departureDate:end,flightTime:flight?window.DayBuilder.clock(flight):''}))return false;
  if(d.items.reduce((s,i)=>s+i.duration,0)+length>capacity(a))return false;
  return !d.items.some(i=>t<i.start+i.duration+travel(p,i.pick||i)+((i.tags||[]).includes('dive')?30:0)&&t+length+travel(p,i.pick||i)+((p.tags||[]).includes('dive')?30:0)>i.start);
 }
 let ordered=selected.slice().sort((x,y)=>Number(!!(y.reservation||y.locked||y.booked))-Number(!!(x.reservation||x.locked||x.booked))||Number(!!y.meals)-Number(!!x.meals)||Number(y.fixed!=null)-Number(x.fixed!=null)||(attempt%2?y.area.localeCompare(x.area):x.area.localeCompare(y.area))||(attempt%3?x.duration-y.duration:y.duration-x.duration));
 if(window.goNowAccount?.group)ordered=window.goNowAccount.sort(ordered);
 for(const p of ordered){
  if(days.some(d=>d.items.some(i=>(i.sourceId||i.id)===p.id)))continue;
  if(p.minAge&&(a.ages||[]).some(age=>String(age).trim()!==''&&Number(age)<p.minAge)){((p.reservation||p.locked||p.booked)?bookingIssues:unfit).push(p);continue;}
  let placed=false;
  const rotated=days.slice(attempt%days.length).concat(days.slice(0,attempt%days.length));
  const proximity=d=>{const activities=d.items.filter(i=>i.kind==='activity');return activities.length?Math.min(...activities.map(i=>travel(p,i.pick||i))):999;};
  const candidates=rotated.sort((x,y)=>p.meals?Number(x.date===start)-Number(y.date===start)||proximity(x)-proximity(y):y.items.filter(i=>i.pick&&i.pick.area===p.area).length-x.items.filter(i=>i.pick&&i.pick.area===p.area).length);
  for(const d of candidates){
   if(p.reservation&&d.date!==p.reservation.date)continue;
   let slots=[];
   if(p.reservation)slots=[minute(p.reservation.time)];else if(p.fixed!=null)slots=[p.fixed];else if(p.meals){for(const meal of (p.meals.includes('breakfast')?['breakfast']:p.meals)){const range={breakfast:[420,600],lunch:[690,810],dinner:[1080,1200],snack:[870,1020]}[meal];for(let t=range[0];t+ p.duration<=range[1];t+=15)slots.push(t);}}else for(let t=540;t+p.duration<=1080;t+=15)slots.push(t);
   const t=slots.find(t=>fits(p,d,t));if(t===undefined)continue;
   d.items.push({id:p.id,title:p.name,kind:p.meals?'meal':'activity',time:window.DayBuilder.clock(t),start:t,duration:p.duration,desc:'About '+p.duration+' min. '+p.intro,category:p.category||'Food',area:p.area,lat:p.lat,lng:p.lng,movementMinutes:/Active|Moderate/.test(p.effort)?p.duration:0,wellness:/Active|Moderate/.test(p.effort)?{type:'movement'}:undefined,costEstimate:p.generic?undefined:p.meals?({'$':15,'$$':30,'$$$$':150}[p.price]||30):Number(((p.price||'').match(/\d+/)||[0])[0]),place:p.area,photo:p.photo,price:p.price,locked:!!(p.reservation||p.locked||p.booked),booked:!!(p.reservation||p.booked),bookable:!!p.bookable,needsTicket:!!p.needsTicket,booking:p.booking,tour:p.tour,closed:p.closed,hours:p.ruleHours&&(!p.ruleHours.date||p.ruleHours.date===d.date)?p.ruleHours:p.hours,tags:p.tags||[],prep:p.bookable?[{type:'book',text:'Reserve '+p.name}]:[],bring:[],sources:[],pick:p});placed=true;break;
  }
  if(!placed)((p.reservation||p.locked||p.booked)?bookingIssues:unfit).push(p);
 }
 for(const d of days){d.items.sort((a,b)=>a.start-b.start);const names=[...new Set(d.items.filter(i=>i.kind==='activity').map(i=>i.area))];d.theme=names.slice(0,2).join(' & ')||[...new Set(d.items.map(i=>i.area))].slice(0,1).join('')||(d.date===end?'Fly home':'Arrive & settle in');}
 if(!seed&&days.length)days[days.length-1].items.push({id:'pick-airport',title:catalog.generic?'Leave for the airport':'Uber to HNL',kind:'travel',time:window.DayBuilder.clock(leave),start:leave,duration:a.flightsStep?fw.road:35,locked:true,desc:a.flightsStep?'About '+fw.road+' min.':'Leave for the airport.',prep:[],bring:[],sources:[]});
 if(days[0]){days[0].unscheduled=unfit.map(p=>({id:p.id,title:p.name,place:p.area,duration:p.duration,kind:p.meals?'meal':'activity',custom:true,tags:p.tags||[],closed:p.closed,hours:p.hours}));if(!seed&&fw.arrivalStart<1410&&!days[0].items.some(i=>i.start<1140))days[0].items.unshift({id:'pick-checkin',title:'Hotel check-in',kind:'stay',time:window.DayBuilder.clock(Math.max(1080,fw.arrivalStart)),desc:'About 30 min. Settle in.',duration:30,prep:[],bring:[],sources:[]});}
 if(!seed&&days[0]&&Math.max(1170,fw.arrivalStart+30)+60<=1440&&!days[0].items.some(i=>i.kind==='meal'||i.start>=1110))days[0].items.push({id:'pick-arrival-meal',title:'Evening meal near hotel',kind:'meal',time:window.DayBuilder.clock(Math.max(1170,fw.arrivalStart+30)),desc:'About 60 min. Choose nearby.',duration:60,prep:[],bring:[],sources:[]});
 if(a.flightsStep&&!seed){days[0].items.unshift({id:'arrival-flight',title:window.GoNowFlights.label(a,'arrival'),kind:'flight',time:window.DayBuilder.clock(fw.landing),duration:0,locked:true,flightDirection:'arrival',prep:[],bring:[],sources:[]});days.at(-1).items.push({id:'return-flight',title:window.GoNowFlights.label(a,'return'),kind:'flight',time:window.DayBuilder.clock(fw.departure),duration:0,locked:true,flightDirection:'return',prep:[],bring:[],sources:[]});}
 return {days,unfit:unfit.map(p=>({...p,reason:reason(p,{...a,start,end})})),bookingIssues,flightTime:flight===null?'':window.DayBuilder.clock(flight),leaveTime:leave,pace:pace(a)};
}
function schedule(a,catalog){
 let best=scheduleOnce(a,catalog);
 // Repack in alternative area, duration and day orders before reporting unfit.
 for(let attempt=1;best.unfit.length&&attempt<18;attempt++){
  const candidate=scheduleOnce(a,catalog,attempt);
  if(candidate.bookingIssues.length<best.bookingIssues.length||candidate.bookingIssues.length===best.bookingIssues.length&&candidate.unfit.length<best.unfit.length)best=candidate;
 }
 return best;
}
// Builder times and locks are authoritative; keep all surviving slots first.
function update(prevPlan,builderState,newPicks,answers,catalog){
 const copy=x=>JSON.parse(JSON.stringify(x)),a={...answers,picks:copy(newPicks),start:prevPlan.start,end:prevPlan.end};
 catalog=catalog||answers.catalog||(window.GONOW_PICKS&&(window.GONOW_PICKS[prevPlan.destinationId]||window.GONOW_PICKS.oahu))||{activities:[],restaurants:[]};
 const selected=new Set([...(newPicks.activities||[]),...(newPicks.restaurants||[])]),old=new Set(prevPlan.days.flatMap(d=>d.items.filter(i=>i.pick).map(i=>i.id)));
 const raw=builderState&&builderState.d?window.DayBuilder.importForPlan(builderState,prevPlan):builderState||{},seed={};
 for(const d of prevPlan.days){
  seed[d.date]=(raw.days&&raw.days[d.date]?raw.days[d.date].items:d.items).filter(i=>!old.has(i.sourceId||i.id)||selected.has(i.sourceId||i.id)||i.locked||i.booked).map(i=>{
   const original=d.items.find(p=>p.id===(i.sourceId||i.id))||prevPlan.days.flatMap(d=>d.items).find(p=>p.id===(i.sourceId||i.id))||{};
   const start=i.preferred!==undefined?i.preferred:minute(i.time);
   return {...copy(original),...copy(i),start,time:start===null?i.time:window.DayBuilder.clock(start),pick:original.pick};
  });
 }
 let result=scheduleOnce(a,catalog,0,seed);
 for(let attempt=1;result.unfit.length&&attempt<18;attempt++){const trial=scheduleOnce(a,catalog,attempt,seed);if(trial.unfit.length<result.unfit.length)result=trial;}
 // Only additions may overflow. Retry by releasing movable picks if necessary.
 if(result.unfit.length){
  const fixed={};for(const [date,items] of Object.entries(seed))fixed[date]=items.filter(i=>!i.pick||i.locked||i.booked||i.manualTime);
  for(let attempt=0;result.unfit.length&&attempt<18;attempt++){
   const retry=scheduleOnce(a,catalog,attempt,fixed);
   if(retry.unfit.length<result.unfit.length&&!retry.unfit.some(i=>old.has(i.id)))result=retry;
  }
 }
 result.unfit=result.unfit.filter(i=>!old.has(i.id)&&!i.locked&&!i.booked&&!i.reservation);
 return result;
}
function reason(p,a){
 if(p.reservation){
  const date=p.reservation.date,day=new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'});
  return 'Booked '+day+' · '+(date<a.start||date>a.end?'outside your dates':date===a.start||date===a.end?'on your travel day':'time conflict');
 }
 if(p.locked||p.booked)return 'Booked · time conflict';
 const dates=[];for(let t=Date.parse(a.start+'T12:00:00Z');t<=Date.parse(a.end+'T12:00:00Z');t+=86400000)dates.push(new Date(t).toISOString().slice(0,10));return dates.length&&dates.every(d=>window.DayBuilder.closedOn({...p,title:p.name},d))?'Closed those days':'No time left';
}
function remove(a,id){for(const key of ['activities','restaurants'])a.picks[key]=(a.picks[key]||[]).filter(x=>x!==id);return a;}
// Generic food also has a category; use meal membership for its selection list.
function swap(a,id,catalog){const all=[...catalog.activities,...catalog.restaurants],old=all.find(i=>i.id===id);if(!old)return null;for(const next of all.filter(i=>i.id!==id&&(old.meals?!!i.meals&&(old.generic?i.category===old.category:i.section===old.section):!i.meals&&i.category===old.category)&&!Object.values(a.picks).flat().includes(i.id))){const copy=JSON.parse(JSON.stringify(a));remove(copy,id);copy.picks[old.meals?'restaurants':'activities'].push(next.id);if(!schedule(copy,catalog).unfit.some(i=>i.id===next.id)){a.picks=copy.picks;return next;}}return null;}
window.PickScheduler={schedule,update,remove,swap,capacity,travel,reason,pace,departure};
})();
