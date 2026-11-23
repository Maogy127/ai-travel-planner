/* Five elements as a light game inside a trip. Wellness stays the plan;
   this layer only adds check-ins, an optional morning card, one nudge,
   a same-element swap, and a recap. */
(function(root){
'use strict';
const ORDER=['water','fire','wood','wind','earth'];
const NAMES={water:'Water',fire:'Fire',wood:'Wood',wind:'Wind',earth:'Earth'};
const KEY='gonow:wuxing:v1';
const DEMO=['2026-11-26-1','2026-11-26-4','2026-11-26-8','2026-11-26-9','2026-11-26-11','2026-11-27-1','2026-11-28-2','2026-11-28-7','2026-11-28-9'];
let wired=false, justEarned='';

function els(){return root.GoNowElements;}
function appState(){return root.__gonow&&root.__gonow.state;}
function readAll(){try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(e){return {};}}
function tripId(){
  const s=appState();
  return (s&&(s.tripId||(s.plan&&s.plan.id)))||'';
}
function blank(){return {intro:false,challenger:false,checks:{},challenges:{},badges:{},nudges:{},seedVersion:0};}
function load(){
  const id=tripId(); if(!id)return blank();
  const all=readAll();
  const saved=all[id]||blank();
  const s=appState();
  const trip=s&&root.__gonow.currentTrip&&root.__gonow.currentTrip();
  if(trip&&trip.wuxing&&trip.wuxing.updatedAt>(saved.updatedAt||0))return Object.assign(blank(),trip.wuxing);
  return Object.assign(blank(),saved);
}
function save(data){
  const id=tripId(); if(!id)return data;
  data.updatedAt=Date.now();
  const all=readAll(); all[id]=data;
  try{localStorage.setItem(KEY,JSON.stringify(all));}catch(e){}
  try{
    const raw=JSON.parse(localStorage.getItem('gonow:trips')||'[]');
    const trip=raw.find(t=>t&&t.id===id);
    if(trip){trip.wuxing=data;localStorage.setItem('gonow:trips',JSON.stringify(raw));if(root.goNowAccount&&root.goNowAccount.write)root.goNowAccount.write(raw);}
  }catch(e){}
  return data;
}
function plan(){const s=appState();return s&&s.plan;}
function answers(){const s=appState();return (s&&s.answers)||{};}
function days(){
  const built=root.DayBuilder&&root.DayBuilder.schedule&&root.DayBuilder.schedule();
  if(built&&built.days&&built.days.length)return built.days;
  const p=plan(); return p&&p.days||[];
}
function dayItems(day){return (day&&day.items)||[];}
function ofItem(item){return els()?els().of(item):[];}
function short(title){
  return String(title||'this stop').replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu,'').split(/ [—–-] /)[0].trim();
}
function elementOf(day){
  const present=[];
  dayItems(day).forEach(it=>ofItem(it).forEach(id=>{if(!present.includes(id))present.push(id);}));
  const list=present.length?present:['earth'];
  const n=Number(String(day.date||'1').slice(-2))||1;
  return list[n%list.length];
}
function sunsetMinute(){
  const text=(plan()&&plan().weather&&plan().weather.text)||'';
  const m=String(text).match(/sunset approx\. (\d{1,2}:\d{2})\s*(AM|PM)/i);
  if(m&&root.DayBuilder&&root.DayBuilder.parseClock)return root.DayBuilder.parseClock(m[1]+' '+m[2]);
  return 17*60+48;
}
function clockOf(n){return root.DayBuilder&&root.DayBuilder.clock?root.DayBuilder.clock(n):'';}
function feasibleStop(it, day){
  if(!day||it.start==null)return true;
  const flight=dayItems(day).find(x=>x.kind==='flight'||x.flight);
  if(flight&&it!==flight&&it.start<(flight.start||0))return false;
  if(/sunset|beach|ocean|sea|swim|snorkel|dive|pool/i.test(it.title||'')&&it.start>=sunsetMinute())return false;
  return true;
}
function challengeText(element, items, day){
  const stop=(items||[]).find(it=>ofItem(it).includes(element)&&!['travel','flight','prep'].includes(it.kind)&&feasibleStop(it, day));
  const name=stop?short(stop.title):'today’s plan';
  if(element==='water'){
    if(stop&&/parasail/i.test(stop.title))return 'If you go up at '+name+', keep the harness on and skip it when the wind feels like too much.';
    if(stop&&/beach|pool|ocean|sea|dive|sunset/i.test(stop.title)&&feasibleStop(stop, day))return 'Visit the water at '+name+' and stay only as deep as feels easy.';
    return 'Drink a full glass of water before '+name+'.';
  }
  if(element==='fire')return stop?'Take the lively part of '+name+' at a pace where you can still talk.':'Take a short walk at a pace where you can still talk.';
  if(element==='wood')return stop?'Start '+name+' with an easy walk, and turn back whenever you like.':'Take an easy walk and turn back whenever you like.';
  if(element==='wind')return 'Take three slow breaths'+(stop?' before '+name:'')+'.';
  if(stop&&/check[- ]?in|settle in|hotel/i.test(stop.title))return 'After you check in, sit quietly for a few minutes before dinner.';
  return stop?'Sit down for '+name+' and leave your phone in your bag.':'Sit down for a few minutes and leave your phone in your bag.';
}
function checkedElements(day, data){
  const found=new Set();
  dayItems(day).forEach(it=>{
    const id=it.sourceId||it.id;
    if(data.checks[id]||data.checks[it.id])ofItem(it).forEach(el=>found.add(el));
  });
  const card=data.challenges[day.date];
  if(card&&card.done)found.add(card.element);
  return ORDER.filter(id=>found.has(id));
}
function plannedElements(day){
  const found=new Set();
  dayItems(day).forEach(it=>ofItem(it).forEach(id=>found.add(id)));
  return ORDER.filter(id=>found.has(id));
}
function seed(data){
  const p=plan();
  if(!p||p.id!=='oahu-demo-2026-11'||data.seedVersion===2)return data;
  data.checks={};
  DEMO.forEach(id=>{data.checks[id]=true;});
  data.badges={'2026-11-26':true};
  data.seedVersion=2;
  return save(data);
}
function badgeLabel(date){
  const local=new Date(date+'T12:00:00');
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if(!Number.isFinite(local.getTime()))return 'Every element';
  return 'Every element · '+days[local.getDay()]+', '+months[local.getMonth()]+' '+local.getDate();
}
function mixProfile(tally){
  const counts=ORDER.map(id=>({id,n:tally[id]||0}));
  const total=counts.reduce((n,x)=>n+x.n,0);
  const present=counts.filter(x=>x.n>0).sort((a,b)=>b.n-a.n||ORDER.indexOf(a.id)-ORDER.indexOf(b.id));
  if(!total||!present.length)return {kind:'empty',ids:[],total:0,counts:counts};
  const top=present[0].n;
  const tied=present.filter(x=>x.n===top);
  const share=top/total;
  if(tied.length>=4||(present.length>=4&&share<=0.25))return {kind:'balanced',ids:tied.map(x=>x.id),total:total,counts:counts};
  return {kind:'lead',ids:tied.map(x=>x.id),total:total,counts:counts};
}
function counts(data){
  const tally={}; ORDER.forEach(id=>tally[id]=0);
  days().forEach(day=>{
    checkedElements(day,data).forEach(id=>{tally[id]++;});
    if(!Object.keys(data.checks).length)plannedElements(day).forEach(id=>{tally[id]++;});
  });
  const total=ORDER.reduce((n,id)=>n+tally[id],0)||1;
  return {tally,total};
}
function travelerTitle(data){
  const profile=mixProfile((data&&data.tally)||counts(data).tally);
  if(profile.kind==='empty')return 'Your element story';
  if(profile.kind==='balanced')return 'You were a balanced traveler · all five elements';
  if(profile.ids.length>=2)return 'You were a '+profile.ids.map(id=>NAMES[id]).join('–')+' traveler';
  return 'You were a '+NAMES[profile.ids[0]]+' traveler';
}
function summaryLine(data){
  const profile=mixProfile((data&&data.tally)||counts(data).tally);
  if(profile.kind==='empty')return 'Check in a few stops and this recap will fill in.';
  if(profile.kind==='balanced')return 'All five elements showed up in even measure. Ocean, effort, walks, quiet, and meals each had a place.';
  const id=profile.ids[0];
  const share=Math.round(profile.counts.find(x=>x.id===id).n/profile.total*100);
  const lines={
    water:'Water led the trip ('+share+'%). Time near the ocean, with meals and walks to land the day.',
    fire:'Fire led the trip ('+share+'%). The effort stayed lively, with quieter stops around it.',
    wood:'Wood led the trip ('+share+'%). Walks and open air carried the days.',
    wind:'Wind led the trip ('+share+'%). Quiet moments sat beside the busier stops.',
    earth:'Earth led the trip ('+share+'%). Meals and rest gave the days a place to settle.'
  };
  if(profile.ids.length>=2)return NAMES[profile.ids[0]]+' and '+NAMES[profile.ids[1]]+' led together ('+share+'% each). The other elements stayed lighter.';
  return lines[id];
}
function mixHTML(data){
  const profile=mixProfile(counts(data).tally);
  const marks={water:'水',fire:'火',wood:'木',wind:'风',earth:'土'};
  return '<ul class="wuxing-mix" data-testid="wuxing-mix">'+profile.counts.map(row=>{
    const pct=profile.total?Math.round(row.n/profile.total*100):0;
    return '<li><span class="wuxing-mix-name">'+marks[row.id]+' '+NAMES[row.id]+'</span><span class="wuxing-mix-track" aria-hidden="true"><span class="wuxing-mix-fill el-'+row.id+'" style="width:'+pct+'%"></span></span><span class="wuxing-mix-pct">'+pct+'%</span></li>';
  }).join('')+'</ul>';
}
function catalog(){
  const picks=root.GONOW_PICKS&&root.GONOW_PICKS.oahu;
  const lists=picks?picks.activities.concat(picks.restaurants):[];
  return lists;
}
function mealRole(item){
  const title=String(item.title||item.name||'').toLowerCase();
  if(/\bbreakfast|grab-and-go\b/.test(title))return 'breakfast';
  if(/\blunch\b/.test(title))return 'lunch';
  if(/\bdinner|supper\b/.test(title))return 'dinner';
  if(/\bbrunch\b/.test(title))return 'breakfast';
  if(/\bsnack\b/.test(title))return 'snack';
  if(Array.isArray(item.meals)&&item.meals.length===1)return item.meals[0];
  if((item.kind==='meal'||item.meals)&&item.start!=null)return item.start<630?'breakfast':item.start<870?'lunch':item.start<1080?'snack':'dinner';
  return '';
}
function fineDining(pick){
  return root.GoNowBudget&&root.GoNowBudget.priceRank(pick.price)>=4||/\b(fine dining|tasting menu|omakase|la mer)\b/i.test((pick.name||'')+' '+(pick.cuisine||'')+' '+(pick.intro||''));
}
function fitsPick(pick, a){
  if(pick.meals&&root.GoNowDiet){
    const hit=root.GoNowDiet.match({kind:'meal',title:pick.name,desc:pick.intro||'',tags:pick.tags||[]},a);
    if(hit.status==='conflict')return false;
  }
  if(!root.GoNowBudget)return !fineDining(pick);
  if(root.GoNowBudget.explicit(a, pick))return true;
  if(fineDining(pick)&&!root.GoNowBudget.wantsFineDining(a))return false;
  return root.GoNowBudget.fits(pick, a);
}
function sameRole(pick, item){
  const meal=mealRole(item);
  const pickMeal=Array.isArray(pick.meals)&&pick.meals.length;
  if(meal)return pickMeal&&pick.meals.includes(meal);
  if(item.kind==='meal'||item.meals)return !!pickMeal;
  return !pickMeal;
}
function openAt(pick, item, date){
  const start=Number.isFinite(item.start)?item.start:null;
  if(start==null)return true;
  const length=Math.min(item.duration||45, pick.duration||45, 90);
  const hrs=pick.hours||{};
  if(hrs.open!=null&&(start<Number(hrs.open)||start+Math.min(length,30)>Number(hrs.close)))return false;
  if(/sunset/i.test(pick.name||'')&&(start<sunsetMinute()-90||start>=sunsetMinute()))return false;
  if(/sunrise/i.test(pick.name||'')&&start>8*60)return false;
  if(/dive|snorkel|surf|parasail/i.test(pick.name||'')&&(start<8*60||start>=sunsetMinute()-60))return false;
  if(date&&root.DayBuilder&&root.DayBuilder.closedOn&&root.DayBuilder.closedOn(Object.assign({title:pick.name}, pick), date))return false;
  return true;
}
function sameEnergy(pick, item){
  const calm=item.kind==='rest'||/free time|downtime|pool|sunset photo|picnic/i.test(item.title||'');
  const bold=/dive|scuba|snorkel|surf|parasail|summit|jurassic|utv|cliff|hike|crater|falls|pillbox|lighthouse|waimea|sharks cove|north shore/i.test(pick.name||'');
  if(calm&&bold)return false;
  const itemBold=/dive|scuba|parasail|hike|crater|pillbox|lighthouse|trail/i.test(item.title||'');
  const pickCalm=/sunset photo|pool & beach|free time/i.test(pick.name||'');
  if(itemBold&&pickCalm)return false;
  return true;
}
function alternatives(element, item, date){
  const a=answers();
  const title=String(item.title||'').toLowerCase();
  return catalog().filter(pick=>{
    if(!pick||!pick.name||title.includes(String(pick.name).toLowerCase()))return false;
    if(/north shore|waimea|pipeline|laniakea|sharks cove|sunset beach/i.test((pick.name||'')+' '+(pick.area||'')))return false;
    if(!sameRole(pick, item)||!sameEnergy(pick, item)||!openAt(pick, item, date))return false;
    const shaped={title:pick.name,kind:pick.meals?'meal':'activity',category:pick.category,tags:pick.tags,effort:pick.effort,style:pick.meals?'food':''};
    if(!ofItem(shaped).includes(element))return false;
    return fitsPick(pick, a);
  }).slice(0,4);
}
function missingElement(day){
  const have=plannedElements(day);
  if(have.length>=5||have.length===0)return '';
  const missing=ORDER.filter(id=>!have.includes(id));
  if(have.length===1)return missing[0];
  return missing.includes('earth')?'earth':missing[0];
}
function arrivalCursor(day, items){
  let cursor=8*60;
  const flight=items.find(it=>it.kind==='flight'||it.flight);
  if(flight)cursor=Math.max(cursor,(flight.start||0)+(flight.duration||0));
  const a=answers();
  const arrivalDay=day&&day.date&&(day.date===(a.start||(plan()&&plan().start)));
  if(arrivalDay&&!flight&&a.arrivalTime&&root.DayBuilder&&root.DayBuilder.parseClock){
    const at=root.DayBuilder.parseClock(a.arrivalTime);
    if(at!=null)cursor=Math.max(cursor, at);
  }
  const checkin=items.find(it=>/check[- ]?in/i.test(it.title||'')||(arrivalDay&&it.kind==='stay'));
  if(arrivalDay&&checkin)cursor=Math.max(cursor, checkin.start||cursor);
  return {cursor:cursor, checkin:checkin};
}
function freeWindows(day){
  const items=dayItems(day).filter(it=>it.start!=null).sort((a,b)=>a.start-b.start);
  const windows=[];
  const gate=arrivalCursor(day, items);
  let cursor=gate.cursor;
  items.forEach(it=>{
    const end=(it.start||0)+(it.duration||0);
    const transit=it===gate.checkin;
    if(!transit&&it.start-cursor>=30)windows.push([cursor, it.start]);
    cursor=Math.max(cursor, end);
  });
  if(22*60-cursor>=30)windows.push([cursor, 22*60]);
  return windows;
}
function placeIn(windows, length, earliest, latest){
  const win=windows.find(([a,b])=>b-a>=length+10&&a>=earliest&&a+length<=latest);
  return win?win[0]:null;
}
function atHotel(day, start){
  const stay=dayItems(day).find(it=>it.kind==='stay'||/check[- ]?in|hotel/i.test(it.title||''));
  if(!stay||stay.start==null)return false;
  return start>=(stay.start||0)+(stay.duration||0);
}
function suggestionFor(element, day){
  if(!day)return null;
  const windows=freeWindows(day);
  if(!windows.length)return null;
  const set=sunsetMinute();
  const skip=/dive|scuba|parasail|summit|jurassic|utv|cliff|snorkel|hike|crater|turtle|north shore|sunset|sunrise/i;
  const gentleName=/beach|walk|garden|cafe|pool|park|tea|picnic/i;
  const match=catalog().find(pick=>{
    const name=pick.name||'';
    if(skip.test(name)||!gentleName.test(name)||(pick.duration||60)>40)return false;
    const length=Math.min(pick.duration||30, 30);
    const daylight=/beach|ocean|pool/i.test(name);
    const latest=daylight?Math.min((pick.hours&&pick.hours.close)||set, set-15):(pick.hours&&pick.hours.close)||21*60+30;
    const start=placeIn(windows, length, 8*60, latest);
    if(start==null)return false;
    const hrs=pick.hours||{};
    if(hrs.open!=null&&(start<Number(hrs.open)||start+length>Number(hrs.close)))return false;
    const shaped={title:name,kind:pick.meals?'meal':'activity',category:pick.category,tags:pick.tags,effort:pick.effort};
    if(!ofItem(shaped).includes(element)||!fitsPick(pick, answers()))return false;
    pick._start=start;pick._length=length;
    return true;
  });
  if(match)return {title:match.name,place:match.area||'Nearby',duration:match._length,kind:match.meals?'meal':'activity',start:match._start};
  if(element==='water'){
    const start=placeIn(windows, 20, set, 22*60);
    if(start!=null&&atHotel(day, start))return {title:'A few quiet minutes by the hotel pool',place:'Your hotel',duration:20,kind:'activity',start:start};
    return null;
  }
  const indoor={
    fire:{title:'A short walk near the hotel',place:'Your hotel',duration:15,kind:'activity'},
    wood:{title:'An easy loop near the hotel',place:'Your hotel',duration:20,kind:'activity'},
    wind:{title:'Five quiet minutes outside',place:'Your hotel',duration:10,kind:'activity'},
    earth:{title:'A seated snack',place:'Your hotel',duration:20,kind:'meal'}
  };
  const idea=indoor[element];
  if(!idea)return null;
  const start=placeIn(windows, idea.duration, 8*60, 21*60+30);
  if(start==null||!atHotel(day, start))return null;
  return Object.assign(idea,{start:start});
}
function catSVG(){
  return '<svg class="jindou" viewBox="0 0 64 64" width="48" height="48" aria-hidden="true"><ellipse cx="32" cy="40" rx="18" ry="14" fill="#6B4226"/><circle cx="32" cy="28" r="16" fill="#7A4A2A"/><circle cx="22" cy="18" r="5" fill="#7A4A2A"/><circle cx="42" cy="18" r="5" fill="#7A4A2A"/><circle cx="22" cy="18" r="2.4" fill="#F3D2B5"/><circle cx="42" cy="18" r="2.4" fill="#F3D2B5"/><ellipse cx="32" cy="46" rx="10" ry="8" fill="#F3D2B5"/><circle cx="26" cy="28" r="2.2" fill="#2A211C"/><circle cx="38" cy="28" r="2.2" fill="#2A211C"/><path d="M29 33h6l-3 2z" fill="#C4896A"/><path d="M18 36c-4 2-4 8 0 8M46 36c4 2 4 8 0 8" fill="none" stroke="#6B4226" stroke-width="2"/></svg>';
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function paintDay(card, data){
  const date=card.getAttribute('data-date')||'';
  const day=days().find(d=>d.date===date);
  if(!day)return;
  card.querySelectorAll('[data-wuxing]').forEach(n=>n.remove());
  const items=dayItems(day);
  items.forEach(it=>{
    const id=it.sourceId||it.id;
    const row=card.querySelector('[data-db-source="'+id+'"], [data-db-id="'+id+'"]');
    if(!row||row.querySelector('[data-testid=element-checkin]'))return;
    if(!ofItem(it).length)return;
    const host=row.querySelector('.db-meta')||row.querySelector('.db-activity');
    if(!host)return;
    const on=!!(data.checks[id]||data.checks[it.id]);
    host.insertAdjacentHTML('beforeend','<button type="button" class="element-checkin'+(on?' is-on':'')+'" data-wuxing="1" data-testid="element-checkin" data-id="'+esc(id)+'" aria-pressed="'+on+'">'+(on?'Checked in':'Check in')+'</button>');
  });
  const lit=checkedElements(day,data);
  const row=card.querySelector('[data-testid=day-elements]');
  if(row){
    row.querySelectorAll('.el-dot').forEach(dot=>{
      const id=ORDER.find(k=>dot.classList.contains('el-'+k));
      dot.classList.toggle('is-on',lit.includes(id));
    });
    let line=row.querySelector('[data-testid=elements-celebrate]');
    if(lit.length>=5){
      if(!line){row.insertAdjacentHTML('beforeend','<p class="el-celebrate" data-testid="elements-celebrate">A day that gathered every element.</p>');line=row.querySelector('[data-testid=elements-celebrate]');}
      else line.textContent='A day that gathered every element.';
      row.classList.add('is-celebrated');
      if(justEarned===date)row.classList.add('is-wuxing-pop');
      if(!data.badges[date]){data.badges[date]=true;save(data);}
    }
  }
  const head=card.querySelector('.day-head')||card;
  if(data.challenger){
    const element=elementOf(day);
    const cardState=data.challenges[date]||{element:element,done:false};
    const flipped=!!cardState.flipped;
    head.insertAdjacentHTML('beforeend','<section class="element-challenge" data-wuxing="1" data-testid="element-challenge" data-date="'+esc(date)+'">'+(flipped
      ?'<p class="element-kicker">Today is '+(NAMES[cardState.element||element]==='Earth'?'an':'a')+' '+NAMES[cardState.element||element]+' day</p><p>'+esc(cardState.text||challengeText(element,items,day))+'</p><button type="button" class="outline" data-testid="element-challenge-done" data-date="'+esc(date)+'" aria-pressed="'+(cardState.done?'true':'false')+'">'+(cardState.done?'Challenge done':'I did this')+'</button>'
      :'<button type="button" class="element-flip" data-testid="element-flip" data-date="'+esc(date)+'">Flip today’s element</button>')+'</section>');
  }
  const miss=missingElement(day);
  if(miss&&data.nudges[date]!=='dismissed'&&lit.length<5){
    const idea=suggestionFor(miss, day);
    if(!idea)return;
    head.insertAdjacentHTML('beforeend','<aside class="balance-buddy" data-wuxing="1" data-testid="balance-buddy"><div class="jindou-wrap">'+catSVG()+'</div><div><p><strong>Jindou</strong> · 金豆</p><p>This day leans away from '+NAMES[miss].toLowerCase()+'. '+esc(idea.title)+' would balance it.</p><div class="row"><button type="button" class="outline" data-testid="buddy-add" data-date="'+esc(date)+'" data-title="'+esc(idea.title)+'" data-place="'+esc(idea.place)+'" data-duration="'+idea.duration+'" data-kind="'+esc(idea.kind)+'" data-time="'+esc(clockOf(idea.start))+'">Add it</button><button type="button" data-testid="buddy-dismiss" data-date="'+esc(date)+'">Not now</button></div></div></aside>');
    if(data.nudges[date]!=='shown'){data.nudges[date]='shown';save(data);}
  }
}
function barHTML(data){
  const badges=Object.keys(data.badges);
  const badgeLine=badges.length?badges.map(badgeLabel).join(' · '):'Check in stops to earn a day badge.';
  const intro=data.intro?'':'<p class="wuxing-intro" data-testid="wuxing-intro">Inspired by 五行 (Wu Xing), the five elements of Chinese tradition. Check in a stop to light its element. <button type="button" data-testid="wuxing-intro-dismiss">Got it</button></p>';
  return '<section class="wuxing-bar" data-testid="wuxing-bar">'+intro
    +'<div class="wuxing-tools"><label class="wuxing-toggle"><input type="checkbox" data-testid="challenger-toggle"'+(data.challenger?' checked':'')+'> Challenger mode</label>'
    +'<button type="button" class="outline" data-testid="wuxing-recap-open">Preview trip recap</button></div>'
    +'<p class="wuxing-badges" data-testid="element-badges">'+esc(badgeLine)+'</p></section>';
}
function refresh(){
  const p=plan(); if(!p||!els()||!root.document)return;
  let data=seed(load());
  const header=document.querySelector('.plan-header');
  const old=document.querySelector('[data-testid=wuxing-bar]');
  if(old)old.remove();
  if(header)header.insertAdjacentHTML('afterend',barHTML(data));
  document.querySelectorAll('[data-date]').forEach(card=>{
    if(card.matches('[data-testid=plan-day], .db-daycard'))paintDay(card,data);
  });
  justEarned='';
}
function openRecap(data){
  const badges=Object.keys(data.badges);
  const dlg=document.createElement('dialog');
  dlg.className='wuxing-recap';
  dlg.setAttribute('data-testid','wuxing-recap');
  dlg.innerHTML='<h2>'+esc(travelerTitle(data))+'</h2>'+mixHTML(data)+'<p data-testid="wuxing-summary">'+esc(summaryLine(data))+'</p>'+(badges.length?'<ul class="wuxing-badge-list" data-testid="wuxing-recap-badges">'+badges.map(date=>'<li>'+esc(badgeLabel(date))+'</li>').join('')+'</ul>':'<p>No day badges yet.</p>')+'<div class="wuxing-recap-actions"><button type="button" class="primary" data-testid="wuxing-share">Share to Community</button><button type="button" class="outline" data-testid="wuxing-recap-close">Close</button></div>';
  document.body.appendChild(dlg);
  dlg.showModal();
  dlg.querySelector('[data-testid=wuxing-recap-close]').onclick=()=>{dlg.close();dlg.remove();};
  dlg.querySelector('[data-testid=wuxing-share]').onclick=()=>shareRecap(data,dlg);
}
function shareRecap(data,dlg){
  const text=travelerTitle(data)+'. '+summaryLine(data);
  const cloud=root.goNowAccount;
  const user=cloud&&(cloud.user||(cloud.currentUser&&cloud.currentUser()));
  if(user&&!user.isAnonymous&&cloud.communityShare){
    const post={kind:'trip',title:travelerTitle(data),line:summaryLine(data),destination:(plan()&&plan().title)||'Trip',note:text};
    Promise.resolve(cloud.communityShare(post)).then(()=>{toast('Shared to Community');dlg.close();dlg.remove();}).catch(()=>{toast('Couldn’t reach Community. The recap stays on this device.');});
    return;
  }
  try{if(navigator.clipboard)navigator.clipboard.writeText(text);}catch(e){}
  toast('Sign in to post this recap to Community. A copy is on your clipboard.');
}
function toast(message){
  let el=document.querySelector('[data-testid=wuxing-toast]');
  if(!el){el=document.createElement('p');el.dataset.testid='wuxing-toast';el.className='wuxing-toast';document.body.appendChild(el);}
  el.textContent=message;
}
function onClick(e){
  const t=e.target.closest('[data-testid]');
  if(!t)return;
  const id=t.dataset.testid;
  if(id==='challenger-toggle'){const data=load();data.challenger=t.checked;save(data);refresh();return;}
  if(id==='wuxing-intro-dismiss'){const data=load();data.intro=true;save(data);refresh();return;}
  if(id==='wuxing-recap-open'){openRecap(load());return;}
  if(id==='element-flip'){
    const data=load(); const date=t.dataset.date; const day=days().find(d=>d.date===date); if(!day)return;
    const element=elementOf(day);
    data.challenges[date]={element:element,text:challengeText(element,dayItems(day),day),flipped:true,done:false};
    save(data);refresh();return;
  }
  if(id==='element-challenge-done'){
    const data=load(); const date=t.dataset.date; const card=data.challenges[date]; if(!card)return;
    card.done=!card.done; save(data);
    const day=days().find(d=>d.date===date);
    if(day&&checkedElements(day,data).length>=5)justEarned=date;
    refresh();return;
  }
  if(id==='element-checkin'){
    e.stopPropagation();
    const data=load(); const itemId=t.dataset.id;
    data.checks[itemId]=!data.checks[itemId];
    const day=days().find(d=>dayItems(d).some(it=>(it.sourceId||it.id)===itemId));
    if(day&&checkedElements(day,data).length>=5)justEarned=day.date;
    save(data);refresh();return;
  }
  if(id==='buddy-dismiss'){const data=load();data.nudges[t.dataset.date]='dismissed';save(data);refresh();return;}
  if(id==='buddy-add'){
    const date=t.dataset.date;
    const result=root.DayBuilder&&root.DayBuilder.addToDay?root.DayBuilder.addToDay(date,{title:t.dataset.title,place:t.dataset.place,duration:Number(t.dataset.duration)||30,time:t.dataset.time||'',kind:t.dataset.kind||'activity'}):{ok:false};
    const data=load(); data.nudges[date]='dismissed'; save(data);
    toast(result&&result.ok?'Added '+t.dataset.title+'. This does not book it.':(result&&result.reason)||'Couldn’t add that stop.');
    refresh();return;
  }
  if(id==='element-swap'){
    e.stopPropagation();
    const row=t.closest('[data-db-id]'); if(!row)return;
    const itemId=row.getAttribute('data-db-source')||row.getAttribute('data-db-id');
    const day=days().find(d=>dayItems(d).some(it=>(it.sourceId||it.id)===itemId||it.id===row.getAttribute('data-db-id')));
    const item=day&&dayItems(day).find(it=>(it.sourceId||it.id)===itemId||it.id===row.getAttribute('data-db-id'));
    if(!item)return;
    if(item.kind==='stay'||/check[- ]?in/i.test(item.title||'')){toast('This stay stays put. Use Check in to light its element.');return;}
    openSwap(item,t.dataset.element,day);
  }
}
function openSwap(item, element, day){
  const options=alternatives(element,item,day&&day.date);
  const locked=!!(item.locked||item.booked);
  const dlg=document.createElement('dialog');
  dlg.className='wuxing-swap';
  dlg.setAttribute('data-testid','element-swap-sheet');
  dlg.innerHTML='<h2>Other '+esc(NAMES[element]||'element')+' places</h2><p class="muted">'+(locked?'This booking stays put. These ideas match this kind of stop, this time, and your budget.':'Same kind of stop, open at this time, and within your budget and diet. One tap swaps it. You can undo.')+'</p>'+(options.length?options.map((pick,i)=>'<button type="button" data-testid="element-swap-option" data-index="'+i+'">'+esc(pick.name)+' · '+esc(pick.area||'Nearby')+'</button>').join(''):'<p>Nothing else fits this time and budget.</p>')+'<button type="button" data-testid="element-swap-close">Close</button>';
  document.body.appendChild(dlg); dlg.showModal();
  dlg.querySelector('[data-testid=element-swap-close]').onclick=()=>{dlg.close();dlg.remove();};
  dlg.querySelectorAll('[data-testid=element-swap-option]').forEach(btn=>btn.onclick=()=>{
    if(locked){toast('That booking stays. You can add the other place on a free day.');return;}
    const pick=options[+btn.dataset.index];
    const before=root.DayBuilder.exportState();
    const ok=root.DayBuilder.swapItem(item.id,{title:pick.name,place:pick.area||pick.name,sourceId:pick.id,kind:pick.meals?'meal':'activity',duration:Math.min(pick.duration||item.duration||60,item.duration||90)});
    dlg.close();dlg.remove();
    if(!ok){toast('That stop stays as it is.');return;}
    toast('Swapped to '+pick.name+'.');
    const undo=document.querySelector('[data-testid=wuxing-toast]');
    if(undo){undo.insertAdjacentHTML('beforeend',' <button type="button" data-testid="element-swap-undo">Undo</button>');undo.querySelector('button').onclick=()=>{root.DayBuilder.restoreState(before);toast('Swap undone.');};}
  });
}
function boot(){
  if(!root.document||wired)return;
  wired=true;
  document.addEventListener('click',onClick);
}
boot();
const api={refresh,load,save,challengeText,travelerTitle,summaryLine,badgeLabel,mixProfile,elementOf,checkedElements,alternatives,suggestionFor,ORDER,NAMES};
root.GoNowWuXing=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
