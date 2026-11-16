/* Pure local scheduling: constrained picks first, then area clusters and free slots. */
(function(){
'use strict';
const minute=t=>{if(typeof t==='number')return t;if(/[AP]M/i.test(String(t)))return window.DayBuilder.parseClock(String(t));const m=String(t||'').match(/^(\d+):(\d+)/);return m?+m[1]*60 + +m[2]:null;};
// Match the legacy Moderate default when the pace question was skipped.
const pace=a=>['gentle','active','athlete'].includes(a.level)?a.level:({'Easy':'gentle','Moderate':'active','Full-on':'athlete'}[a.pace]||'active');
const capacity=a=>({gentle:300,active:420,athlete:540}[pace(a)]);
function departure(a){const sample=!a.generic&&a.start==='2026-11-25'&&a.end==='2026-11-29';const flight=minute(a.flightTime||a.builderFlightTime)??(sample?480:null);return {flight,leave:flight===null?600:Math.max(0,flight-185)};}

const travel=(a,b)=>!a||!b?0:window.DayBuilder.estimateTravel(a,b).minutes;
function scheduleOnce(a,catalog,attempt=0){
 const start=a.start||'2026-11-25',end=a.end||'2026-11-29',days=[];
 for(let t=Date.parse(start+'T12:00:00Z');t<=Date.parse(end+'T12:00:00Z')&&days.length<31;t+=86400000)days.push({date:new Date(t).toISOString().slice(0,10),theme:'',items:[],prep:[],unscheduled:[]});
 const picks=a.picks||{},all=[...catalog.activities,...catalog.restaurants].map(p=>catalog.generic?{...p,area:p.area||'',duration:p.duration||60,price:p.price||'',intro:p.intro||'',closed:p.closed||[],hours:p.parsedHours||p.hours||{}}:p),selected=all.filter(i=>i.reservation||i.locked||i.booked||(picks.activities||[]).includes(i.id)||(picks.restaurants||[]).includes(i.id));
 const unfit=[],bookingIssues=[];const {flight,leave}=departure({...a,start,end,generic:catalog.generic});
 function fits(p,d,t){
  const length=p.duration||60,close=d.date===end?Math.min(1320,leave):1320;
  if(d.date===end&&leave<=600&&(!p.meals||!p.meals.includes('breakfast')||length>60))return false;
  if(d.date===start&&!p.meals)return false;
  if(t<(d.date===start?1140:360)||t+length+(d.date===end?travel(p,{area:"Airport"}):0)>close)return false;
  const hrs=p.ruleHours&&(!p.ruleHours.date||p.ruleHours.date===d.date)?p.ruleHours:p.hours;
  if(hrs&&hrs.open!=null&&(t<minute(hrs.open)||t+length>minute(hrs.close)))return false;
  if(window.DayBuilder.closedOn({...p,title:p.name},d.date))return false;
  if(window.DayBuilder.blockedOn({...p,title:p.name,preferred:t,duration:length},d.date,{departureDate:end,flightTime:flight?window.DayBuilder.clock(flight):''}))return false;
  if(d.items.reduce((s,i)=>s+i.duration,0)+length>capacity(a))return false;
  return !d.items.some(i=>t<i.start+i.duration+travel(p,i.pick)+((i.tags||[]).includes('dive')?30:0)&&t+length+travel(p,i.pick)+((p.tags||[]).includes('dive')?30:0)>i.start);
 }
 const ordered=selected.slice().sort((x,y)=>Number(!!(y.reservation||y.locked||y.booked))-Number(!!(x.reservation||x.locked||x.booked))||Number(!!y.meals)-Number(!!x.meals)||Number(y.fixed!=null)-Number(x.fixed!=null)||(attempt%2?y.area.localeCompare(x.area):x.area.localeCompare(y.area))||(attempt%3?x.duration-y.duration:y.duration-x.duration));
 for(const p of ordered){
  if(p.minAge&&(a.ages||[]).some(age=>String(age).trim()!==''&&Number(age)<p.minAge)){((p.reservation||p.locked||p.booked)?bookingIssues:unfit).push(p);continue;}
  let placed=false;
  const rotated=days.slice(attempt%days.length).concat(days.slice(0,attempt%days.length));
  const proximity=d=>{const activities=d.items.filter(i=>i.kind==='activity');return activities.length?Math.min(...activities.map(i=>travel(p,i.pick))):999;};
  const candidates=rotated.sort((x,y)=>p.meals?Number(x.date===start)-Number(y.date===start)||proximity(x)-proximity(y):y.items.filter(i=>i.pick.area===p.area).length-x.items.filter(i=>i.pick.area===p.area).length);
  for(const d of candidates){
   if(p.reservation&&d.date!==p.reservation.date)continue;
   let slots=[];
   if(p.reservation)slots=[minute(p.reservation.time)];else if(p.fixed!=null)slots=[p.fixed];else if(p.meals){for(const meal of (p.meals.includes('breakfast')?['breakfast']:p.meals)){const range={breakfast:[420,600],lunch:[690,810],dinner:[1080,1200],snack:[870,1020]}[meal];for(let t=range[0];t+ p.duration<=range[1];t+=15)slots.push(t);}}else for(let t=540;t+p.duration<=1080;t+=15)slots.push(t);
   const t=slots.find(t=>fits(p,d,t));if(t===undefined)continue;
   d.items.push({id:p.id,title:p.name,kind:p.meals?'meal':'activity',time:window.DayBuilder.clock(t),start:t,duration:p.duration,desc:'About '+p.duration+' min. '+p.intro,category:p.category||'Food',area:p.area,lat:p.lat,lng:p.lng,movementMinutes:/Active|Moderate/.test(p.effort)?p.duration:0,wellness:/Active|Moderate/.test(p.effort)?{type:'movement'}:undefined,costEstimate:p.generic?undefined:p.meals?({'$':15,'$$':30,'$$$$':150}[p.price]||30):Number(((p.price||'').match(/\d+/)||[0])[0]),place:p.area,photo:p.photo,price:p.price,locked:!!(p.reservation||p.locked||p.booked),booked:!!(p.reservation||p.booked),bookable:!!p.bookable,closed:p.closed,hours:p.ruleHours&&(!p.ruleHours.date||p.ruleHours.date===d.date)?p.ruleHours:p.hours,tags:p.tags||[],prep:p.bookable?[{type:'book',text:'Reserve '+p.name}]:[],bring:[],sources:[],pick:p});placed=true;break;
  }
  if(!placed)((p.reservation||p.locked||p.booked)?bookingIssues:unfit).push(p);
 }
 for(const d of days){d.items.sort((a,b)=>a.start-b.start);const names=[...new Set(d.items.filter(i=>i.kind==='activity').map(i=>i.area))];d.theme=names.slice(0,2).join(' & ')||[...new Set(d.items.map(i=>i.area))].slice(0,1).join('')||(d.date===end?'Fly home':'Arrive & settle in');}
 if(days.length)days[days.length-1].items.push({id:'pick-airport',title:catalog.generic?'Leave for the airport':'Uber to HNL',kind:'travel',time:window.DayBuilder.clock(leave),start:leave,duration:35,locked:true,desc:'Leave for the airport.',prep:[],bring:[],sources:[]});
 if(days[0]){days[0].unscheduled=unfit.map(p=>({id:p.id,title:p.name,place:p.area,duration:p.duration,kind:p.meals?'meal':'activity',custom:true,tags:p.tags||[],closed:p.closed,hours:p.hours}));if(!days[0].items.some(i=>i.start<1140))days[0].items.unshift({id:'pick-checkin',title:'Hotel check-in',kind:'stay',time:'6:00 PM',desc:'About 30 min. Settle in.',duration:30,prep:[],bring:[],sources:[]});}
 if(days[0]&&!days[0].items.some(i=>i.kind==='meal'||i.start>=1110))days[0].items.push({id:'pick-arrival-meal',title:'Evening meal near hotel',kind:'meal',time:'7:30 PM',desc:'About 60 min. Choose nearby.',duration:60,prep:[],bring:[],sources:[]});
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
window.PickScheduler={schedule,remove,swap,capacity,travel,reason,pace,departure};
})();
