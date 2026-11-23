/* Five elements as a light game inside a trip. Wellness stays the plan;
   this layer only adds check-ins, an optional morning card, one nudge,
   a same-element swap, and a recap. */
(function(root){
'use strict';
const ORDER=['water','fire','wood','wind','earth'];
const NAMES={water:'Water',fire:'Fire',wood:'Wood',wind:'Wind',earth:'Earth'};
const KEY='gonow:wuxing:v1';
const DEMO=['2026-11-26-1','2026-11-26-4','2026-11-26-8'];
let wired=false, justEarned='';

function els(){return root.GoNowElements;}
function appState(){return root.__gonow&&root.__gonow.state;}
function readAll(){try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(e){return {};}}
function tripId(){
  const s=appState();
  return (s&&(s.tripId||(s.plan&&s.plan.id)))||'';
}
function blank(){return {intro:false,challenger:false,checks:{},challenges:{},badges:{},nudges:{},seeded:false};}
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
function challengeText(element, items){
  const stop=items.find(it=>ofItem(it).includes(element)&&!['travel','flight','prep'].includes(it.kind));
  const name=stop?short(stop.title):'today’s plan';
  if(element==='water'){
    if(stop&&/beach|pool|ocean|sea|dive|sunset/i.test(stop.title))return 'Visit the water at '+name+' and stay only as deep as feels easy.';
    return 'Drink a full glass of water before '+name+'.';
  }
  if(element==='fire')return 'Take the lively part of '+name+' at a pace where you can still talk.';
  if(element==='wood')return 'Start '+name+' with an easy walk, and turn back whenever you like.';
  if(element==='wind')return 'Take three slow breaths before '+name+'.';
  if(stop&&/check[- ]?in|settle in|hotel/i.test(stop.title))return 'After you check in, sit quietly for a few minutes before dinner.';
  return 'Sit down for '+name+' and leave your phone in your bag.';
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
  if(!p||p.id!=='oahu-demo-2026-11'||data.seeded)return data;
  DEMO.forEach(id=>{data.checks[id]=true;});
  data.badges['2026-11-26']=true;
  data.seeded=true;
  return save(data);
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
  const {tally}=counts(data);
  const top=ORDER.slice().sort((a,b)=>tally[b]-tally[a]||ORDER.indexOf(a)-ORDER.indexOf(b)).filter(id=>tally[id]>0);
  if(top.length>=2)return 'You were a '+NAMES[top[0]]+'–'+NAMES[top[1]]+' traveler';
  if(top.length===1)return 'You were a '+NAMES[top[0]]+' traveler';
  return 'Your element story';
}
function summaryLine(data){
  const {tally,total}=counts(data);
  const top=ORDER.slice().sort((a,b)=>tally[b]-tally[a]).filter(id=>tally[id]>0)[0];
  if(!top)return 'Check in a few stops and this recap will fill in.';
  const share=Math.round(tally[top]/total*100);
  const lines={
    water:'Water led the trip ('+share+'%). Time near the ocean, with meals and walks to land the day.',
    fire:'Fire led the trip ('+share+'%). You kept the effort lively and still left room to rest.',
    wood:'Wood led the trip ('+share+'%). Walks and open air carried the days.',
    wind:'Wind led the trip ('+share+'%). Quiet moments sat beside the busier stops.',
    earth:'Earth led the trip ('+share+'%). Meals and rest gave the days a place to settle.'
  };
  return lines[top];
}
function catalog(){
  const picks=root.GONOW_PICKS&&root.GONOW_PICKS.oahu;
  const lists=picks?picks.activities.concat(picks.restaurants):[];
  return lists;
}
function fitsPick(pick, a){
  if(pick.meals&&root.GoNowDiet){
    const hit=root.GoNowDiet.match({kind:'meal',title:pick.name,desc:pick.intro||'',tags:pick.tags||[]},a);
    if(hit.status==='conflict')return false;
  }
  if(root.GoNowBudget&&pick.price&&!root.GoNowBudget.fits(pick,a))return false;
  return true;
}
function alternatives(element, item){
  const a=answers();
  const title=String(item.title||'').toLowerCase();
  return catalog().filter(pick=>{
    if(!pick||!pick.name||title.includes(String(pick.name).toLowerCase()))return false;
    const shaped={title:pick.name,kind:pick.meals?'meal':'activity',category:pick.category,tags:pick.tags,effort:pick.effort};
    if(!ofItem(shaped).includes(element))return false;
    return fitsPick(pick,a);
  }).slice(0,4);
}
function missingElement(day){
  const have=plannedElements(day);
  if(have.length>=5||have.length===0)return '';
  const missing=ORDER.filter(id=>!have.includes(id));
  if(have.length===1)return missing[0];
  return missing.includes('earth')?'earth':missing[0];
}
function suggestionFor(element){
  const gentleName=/beach|walk|garden|sunset|cafe|pool|park|tea|picnic/i;
  const skip=/dive|scuba|parasail|summit|jurassic|utv|cliff|snorkel|hike|crater/i;
  const match=catalog().find(pick=>{
    if(skip.test(pick.name||'')||!gentleName.test(pick.name||'')||(pick.duration||60)>60)return false;
    const shaped={title:pick.name,kind:pick.meals?'meal':'activity',category:pick.category,tags:pick.tags,effort:pick.effort};
    return ofItem(shaped).includes(element)&&fitsPick(pick,answers());
  });
  if(match)return {title:match.name,place:match.area||'Nearby',duration:Math.min(match.duration||60,60),kind:match.meals?'meal':'activity'};
  const gentle={
    water:{title:'Quiet time by the water',place:'Near your hotel',duration:20,kind:'activity'},
    fire:{title:'A short brisk walk',place:'Near your hotel',duration:10,kind:'activity'},
    wood:{title:'Easy walk near your hotel',place:'Near your hotel',duration:30,kind:'activity'},
    wind:{title:'Five quiet minutes outside',place:'Near your hotel',duration:10,kind:'activity'},
    earth:{title:'A seated snack',place:'Near your hotel',duration:20,kind:'meal'}
  };
  return gentle[element];
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
      ?'<p class="element-kicker">Today is a '+NAMES[cardState.element||element]+' day</p><p>'+esc(cardState.text||challengeText(element,items))+'</p><button type="button" class="outline" data-testid="element-challenge-done" data-date="'+esc(date)+'" aria-pressed="'+(cardState.done?'true':'false')+'">'+(cardState.done?'Challenge done':'I did this')+'</button>'
      :'<button type="button" class="element-flip" data-testid="element-flip" data-date="'+esc(date)+'">Flip today’s element</button>')+'</section>');
  }
  const miss=missingElement(day);
  if(miss&&data.nudges[date]!=='dismissed'&&lit.length<5){
    const idea=suggestionFor(miss);
    head.insertAdjacentHTML('beforeend','<aside class="balance-buddy" data-wuxing="1" data-testid="balance-buddy"><div class="jindou-wrap">'+catSVG()+'</div><div><p><strong>Jindou</strong> · 金豆</p><p>This day leans away from '+NAMES[miss].toLowerCase()+'. '+esc(idea.title)+' would balance it.</p><div class="row"><button type="button" class="outline" data-testid="buddy-add" data-date="'+esc(date)+'" data-title="'+esc(idea.title)+'" data-place="'+esc(idea.place)+'" data-duration="'+idea.duration+'" data-kind="'+esc(idea.kind)+'">Add it</button><button type="button" data-testid="buddy-dismiss" data-date="'+esc(date)+'">Not now</button></div></div></aside>');
    if(data.nudges[date]!=='shown'){data.nudges[date]='shown';save(data);}
  }
}
function barHTML(data){
  const badges=Object.keys(data.badges);
  const badgeLine=badges.length?badges.map(date=>'Day badge · '+date).join(' · '):'Check in stops to earn a day badge.';
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
  const {tally,total}=counts(data);
  const bits=ORDER.filter(id=>tally[id]).map(id=>NAMES[id]+'\u00a0'+Math.round(tally[id]/total*100)+'%').join(' · ');
  const badges=Object.keys(data.badges);
  const dlg=document.createElement('dialog');
  dlg.className='wuxing-recap';
  dlg.setAttribute('data-testid','wuxing-recap');
  dlg.innerHTML='<h2>'+esc(travelerTitle(data))+'</h2><p data-testid="wuxing-percents">'+esc(bits||'No elements yet')+'</p><p>'+esc(summaryLine(data))+'</p>'+(badges.length?'<p data-testid="wuxing-recap-badges">Badges · '+esc(badges.join(', '))+'</p>':'<p>No day badges yet.</p>')+'<div class="row"><button type="button" class="primary" data-testid="wuxing-share">Share to Community</button><button type="button" data-testid="wuxing-recap-close">Close</button></div>';
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
    data.challenges[date]={element:element,text:challengeText(element,dayItems(day)),flipped:true,done:false};
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
    const result=root.DayBuilder&&root.DayBuilder.addToDay?root.DayBuilder.addToDay(date,{title:t.dataset.title,place:t.dataset.place,duration:Number(t.dataset.duration)||30,time:'15:30',kind:t.dataset.kind||'activity'}):{ok:false};
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
    openSwap(item,t.dataset.element,day&&day.date);
  }
}
function openSwap(item, element, date){
  const options=alternatives(element,item);
  const locked=!!(item.locked||item.booked);
  const dlg=document.createElement('dialog');
  dlg.className='wuxing-swap';
  dlg.setAttribute('data-testid','element-swap-sheet');
  dlg.innerHTML='<h2>Other '+esc(NAMES[element]||'element')+' places</h2><p class="muted">'+(locked?'This booking stays put. These are ideas for another time.':'Same element, and they fit your budget and diet. One tap swaps it. You can undo.')+'</p>'+(options.length?options.map((pick,i)=>'<button type="button" data-testid="element-swap-option" data-index="'+i+'">'+esc(pick.name)+' · '+esc(pick.area||'Nearby')+'</button>').join(''):'<p>Nothing else nearby fits that element.</p>')+'<button type="button" data-testid="element-swap-close">Close</button>';
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
const api={refresh,load,save,challengeText,travelerTitle,summaryLine,elementOf,checkedElements,alternatives,suggestionFor,ORDER,NAMES};
root.GoNowWuXing=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
