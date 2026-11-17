// Offline real-builder render/export smoke. Chromium layout remains supervisor-run.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const nodes = new Map();
function node(key) {
  if (!nodes.has(key)) {
    const el = {
      innerHTML: '', textContent: '', value: '', isConnected: true, className: '', hidden: false,
      style: {}, dataset: {}, children: [],
      addEventListener(event, fn) { this[event] = fn; },
      querySelectorAll() { return []; },
      querySelector(selector) { return node(String(key) + ' ' + selector); },
      closest() { return el; },
      focus() {}, blur() {}, click() { if (typeof this.onclick === 'function') this.onclick(); },
      setAttribute() {}, getAttribute() { return ''; }, removeAttribute() {}, hasAttribute() { return false; },
      showModal() {}, close() {}, remove() {}, append() {}, prepend() {}, after() {}, before() {},
      insertAdjacentElement() { return el; },
      insertAdjacentHTML(position, html) { this.innerHTML = (this.innerHTML || '') + String(html); },
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
      getBoundingClientRect() { return {width: 100, height: 40, top: 0, left: 0, bottom: 40, right: 100}; },
    };
    nodes.set(key, new Proxy(el, {get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol') return undefined;
      return () => target;
    }}));
  }
  return nodes.get(key);
}
const memory = new Map();
const mediaListeners=new Map(),windowListeners=new Map();
const ctx = {
  document: { addEventListener() {}, removeEventListener() {}, documentElement: { classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } } }, body: node('body'), getElementById: node, querySelector: selector => selector === '[data-testid="tab-content"]' ? null : node(selector), querySelectorAll: () => [], createElement: tag => node('el-' + tag + '-' + Math.random()), createTextNode: text => ({textContent: String(text)}) },
  localStorage: {get length(){return memory.size},key:i=>[...memory.keys()][i],getItem: k => memory.has(k)?memory.get(k):null,setItem: (k,v) => memory.set(k,v),removeItem:k=>memory.delete(k)},
  TextEncoder, TextDecoder, URL, URLSearchParams, location:{search:'?fast=1', hash:'', href:'http://local/index.html?fast=1'}, navigator:{},
  requestAnimationFrame: fn=>fn(), setTimeout, clearTimeout, setInterval, clearInterval, console,
  matchMedia: query => ({matches: false, addEventListener(event,fn) {mediaListeners.set(query,fn);}}),
};
ctx.window=ctx;ctx.scrollTo=()=>{};ctx.addEventListener=(event,fn)=>{if(!windowListeners.has(event))windowListeners.set(event,[]);windowListeners.get(event).push(fn);};ctx.history={state:null,pushState(s){this.state=s},replaceState(s){this.state=s}};
vm.createContext(ctx);
const jsRoot = fs.existsSync(`${__dirname}/../site/js/app.js`) ? `${__dirname}/../site/js/` : `${__dirname}/../js/`;
for (const f of ['styles','catalog','oahu','engine','ai','credits','localinfo','affiliates','rings','diet','checkin','jetlag','dashboard','daybuilder','pickcatalog','pickscheduler','app']) vm.runInContext(fs.readFileSync(`${jsRoot}${f}.js`,'utf8').replace('window.__gonow= {','window.__renderHelpers={builderContext,planBanner,dayHeadHTML,dayModel,rememberTrip,openSaved}; window.__gonow= {'),ctx);
const api=ctx.__gonow;
const click=id=>node(`[data-testid="${id}"]`).click();
function smoke(label){
 const helpers=ctx.__renderHelpers, plan=api.state.plan;
 assert(plan && plan.days.length>0);
 helpers.planBanner(plan);
 for(let i=0;i<plan.days.length;i++){
  const html=helpers.dayHeadHTML(plan.days[i],i,helpers.dayModel(plan.days[i],i));
  assert(html.includes('wellness-rings'));
  if(plan.id.startsWith('template-'))assert.equal((html.match(/data-testid="travel-chip"/g)||[]).length,Math.max(0,plan.days[i].items.length-1)) // Only this day's transfers.;
 }
 const context=helpers.builderContext();let heads=0;
 const head=context.dayHead;context.dayHead=(...args)=>{heads++;return head(...args);};
 const builder=ctx.DayBuilder.mount(node('smoke-'+label),{...context,plan});
 for(const day of plan.days)builder.selectDay(day.date,false);
 assert(heads>=plan.days.length,'day headers evaluated');
 builder.schedule();builder.exportState();builder.renderPrint(true);builder.renderPrint(false);
 assert(ctx.DayBuilder.trayItems().every(i=>i.id && i.title));
}
(async()=>{
 api.go('start');click('demo-oahu');
 await new Promise(r=>setTimeout(r,20));
 assert.equal(api.state.screen,'plan');
 assert.equal(JSON.parse(memory.get('gonow:trips'))[0].snapshot,null);
 api.go('prep');assert.equal(api.state.screen,'plan');
 click('confirm-plan');assert.equal(api.state.screen,'prep');
 assert.equal(JSON.parse(memory.get('gonow:trips'))[0].confirmed,true);
 click('prep-continue');
 smoke('demo');
 // Approval must edit runtime days, preserve bookings, and survive duplicate/stale snapshots.
 const originalBuilder=ctx.DayBuilder.importForPlan(ctx.DayBuilder.exportState(),api.state.plan);
 for(const day of api.state.plan.days)originalBuilder.days[day.date] ||= ctx.DayBuilder.buildSuggested(day.date);
 const groupTrip=JSON.parse(JSON.stringify(api.currentTrip()));groupTrip.builder=originalBuilder;
 const group={id:'approval-regression',trip:groupTrip,locks:{lamer:true},planContent:{lamer:{time:'7:00 PM'}}};
 ctx.goNowAccount={owner:()=>true};
 function approvedDinner(){
  const dinner=ctx.DayBuilder.schedule().days.find(d=>d.date==='2026-11-26').items.find(i=>i.id==='lamer');
  assert.equal(dinner.preferred,1140);assert.equal(dinner.start,1140);
  assert.equal(dinner.locked,true);assert.equal(dinner.booked,true);
 }
 api.acceptGroup(group);approvedDinner();
 api.applyGroupChange({itemId:'lamer',change:{time:'7:00 PM'}});approvedDinner();
 group.trip.updatedAt='later-stale-builder';api.acceptGroup(group);approvedDinner();
 ctx.goNowAccount.owner=()=>false;
 group.trip.updatedAt='member-snapshot';api.acceptGroup(group);approvedDinner();
 api.go('plan');approvedDinner();
 delete ctx.goNowAccount;
 memory.set('gonow:daybuilder:'+api.state.plan.id,JSON.stringify(originalBuilder));api.go('plan');

 // Item E: builder headers must detect the raw ride even when scheduling omits it.
 const lastDay=api.state.plan.days.at(-1);
 function assertFlyHome(day){
  const html=ctx.__renderHelpers.dayHeadHTML(day,api.state.plan.days.length-1,ctx.__renderHelpers.dayModel(day,api.state.plan.days.length-1));
  const header=html.split('</figure>')[0];
  assert(header.includes('ring-sleep'));
  assert(!/ring-move|ring-rec|ring-rest-break/.test(header));
  assert(header.includes('departs'));
  assert(!html.includes('data-testid="day-pace-link"'));
  return header;
 }
 // Final audit: sleep duration appears once outside the accessible SVG label.
 const flyHeader=assertFlyHome(lastDay);
 assert(flyHeader.includes('Short night · Rest on your flight'));
 assert.equal((flyHeader.replace(/<svg[\s\S]*?<\/svg>/g,'').match(/5h55/g)||[]).length,1);
 const savedItems=lastDay.items;
 lastDay.items=[{kind:'travel',title:'Uber Reserve to HNL',time:'4:55 AM'}];
 ctx.DayBuilder.resetSession();
 // Preceding sleep ends 30 minutes before the 4:55 AM airport ride.
 assert(assertFlyHome(lastDay).includes('Short night · Rest on your flight'));
 lastDay.items=savedItems;

 assert.equal(api.state.plan.id,'oahu-demo-2026-11');
 ctx.DayBuilder.resetSession();
 const defaultRoot=node('default-regression');
 let defaultBuilder=ctx.DayBuilder.mount(defaultRoot,{...ctx.__renderHelpers.builderContext(),plan:api.state.plan});
 assert.equal(defaultBuilder.date(),'2026-11-26');
 const defaultTimeline=defaultBuilder.schedule().days[1].items;
 assert.equal(defaultTimeline[0].start,335);
 assert(defaultTimeline[1].title.includes('Diamond Head'));
 console.log('PASS default selected date',defaultBuilder.date(),'timeline',defaultTimeline.map(i=>ctx.DayBuilder.range(i.start,i.end)+' '+i.title).join(' → '));
 assert(node('default-regression .db-content').innerHTML.includes('aria-label="Unlock time"'));
 assert(node('default-regression .db-content').innerHTML.includes('aria-label="Unlock time"'));
 const renderContext=ctx.__renderHelpers.builderContext();
 const dinner=defaultTimeline.find(i=>i.title.includes('La Mer'));
 assert.equal(renderContext.titleFor(dinner.sourceId||dinner.id,'2026-11-26',dinner),'Birthday dinner — La Mer at Halekulani');
 const rest=defaultTimeline.find(i=>i.title.includes('Free time at the Kahala'));
 const restHTML=renderContext.detail(rest.sourceId||rest.id,'2026-11-26',rest);
 assert(restHTML.includes('db-photo')&&restHTML.includes('images/activity-kahala-lagoon.jpg'),'rest stop retains its credited photo');
 const transport=defaultTimeline.find(i=>i.kind==='travel');
 assert(!renderContext.detail(transport.sourceId||transport.id,'2026-11-26',transport).includes('db-photo'),'transport stays photoless');
 const departure=ctx.DayBuilder.buildSuggested('2026-11-29').items;
 assert.equal(departure.filter(i=>i.locked).length,1);
 assert.equal(departure.filter(i=>i.flight).length,1);
 const flight=departure.find(i=>i.flight);
 assert.equal(renderContext.titleFor(flight.sourceId||flight.id,'2026-11-29',flight),'Flight (add your time)');
 defaultBuilder.selectDay('2026-11-29',false);
 // Final audit: the Return column supplies direction; sample time is explicit.
 const flightMarkup=node('default-regression .db-content').innerHTML;
 assert(flightMarkup.includes('Sample · ~10:00 AM'));
 assert(flightMarkup.includes('aria-label="Sample · departs ~10:00 AM"'));
 assert(flightMarkup.includes('db-flight-card'));
 assert.equal((node('default-regression .db-content').innerHTML.match(/data-testid="edit-flight"/g)||[]).length,1);
 // Final audit: real renderer preserves number/time and accessible direction for
 // provided flights; the scheduler/export label remains fully explanatory.
 const compactPlan=JSON.parse(JSON.stringify(api.state.plan));
 const compactRoot=node('compact-flight-regression');
 const compactBuilder=ctx.DayBuilder.mount(compactRoot,{plan:compactPlan,
   flightAnswers:{...api.state.answers,flightsStep:true,arrivalFlight:'HA 11',arrivalTime:'17:30',returnTime:'20:00'}});
 compactBuilder.selectDay('2026-11-25',false);
 const compactMarkup=node('compact-flight-regression .db-content').innerHTML;
 assert(compactMarkup.includes('>HA 11 · 5:30 PM</strong>'));
 assert(compactMarkup.includes('aria-label="HA 11 · lands 5:30 PM"'));
 defaultBuilder=ctx.DayBuilder.mount(defaultRoot,{...ctx.__renderHelpers.builderContext(),plan:api.state.plan});
 defaultBuilder.selectDay('2026-11-26',false);
 const priorEdits=api.state.edits;
 api.state.edits={items:{'2026-11-26-0':{note:'Calendar note'}},removed:['2026-11-26-2']};
 const ics=api.buildICS().replace(/\r\n /g,'');
 console.log('ICS removed stop: Uber to Twin Fin (Kualoa shuttle stop); selected date:',defaultBuilder.date());
 assert(ics.includes('TZID=Pacific/Honolulu')&&ics.includes('BEGIN:VTIMEZONE'));
 assert(ics.includes('Diamond Head')&&ics.includes('Kualoa')&&ics.includes('Calendar note'));
 assert(!ics.includes('SUMMARY:Uber to Twin Fin'),'calendar omits the removed transfer');
 api.state.edits=priorEdits;
 const detail={open:false};const originalDetails=node('view').querySelectorAll;
 // The app view is the #view node; media-only entry must open closed details.
 const viewNode=node('view');
 const appView=viewNode;
 appView.querySelectorAll=selector=>selector==='details'?[detail]:[];
 mediaListeners.get('print')({matches:true});
 assert.equal(detail.open,true,'print media opens closed itinerary disclosures');
 for(const listener of windowListeners.get('beforeprint')||[])listener();
 assert.equal(detail.open,true,'beforeprint and matchMedia are idempotent together');
 mediaListeners.get('print')({matches:false});
 assert.equal(detail.open,false);
 appView.querySelectorAll=originalDetails;
 defaultBuilder.selectDay('2026-11-28',false);
 const travelerBeforeSwap=api.state.answers.who;
 api.state.answers.who='solo';
 const swapBefore=defaultBuilder.schedule().days[3].items.find(i=>!i.locked&&i.kind!=='travel'&&i.kind!=='prep');
 assert(defaultBuilder.swapItem(swapBefore.id,{title:'Beach walk',start:swapBefore.start,end:swapBefore.end}));
 ctx.__renderHelpers.rememberTrip();
 const savedPlanId=api.state.plan.id;
 api.state.answers.who='solo';
 ctx.__renderHelpers.openSaved(api.state.tripId,'plan');
 assert.equal(api.state.plan.id,savedPlanId,'dashboard reopens the stored plan rather than regenerating another template');
 defaultBuilder=ctx.DayBuilder.mount(defaultRoot,{...ctx.__renderHelpers.builderContext(),plan:api.state.plan});
 assert.equal(api.state.answers.who,'solo');
 const restored=defaultBuilder.schedule().days[3].items.find(i=>i.id===swapBefore.id);
 assert(restored&&restored.title==='Beach walk');
 assert.equal(restored.start,swapBefore.start);assert.equal(restored.end,swapBefore.end);
 assert.equal(!!restored.locked,!!swapBefore.locked);
 console.log('PASS solo swap preserves id, title, time and locks through dashboard reopen and remount');
 const tripsBeforeShare=memory.get('gonow:trips');
 api.state.shared=true;api.state.sharedEdits={};api.state.sharedBuilder=null;
 api.go('plan');
 assert.equal(api.state.screen,'plan','shared copies skip first-visit prep');
 assert(node('view .shell').innerHTML.includes('data-testid="shared-banner"'));
 assert([...nodes.values()].some(n=>n.dataset.testid==='db-root'&&!n.hidden));
 api.go('prep');click('prep-continue');
 assert.equal(api.state.shared,true,'Continue does not adopt a shared copy');
 assert(node('view .shell').innerHTML.includes('data-testid="shared-banner"'));
 assert.equal(memory.get('gonow:trips'),tripsBeforeShare,'shared Continue does not save a personal trip');
 memory.delete('gonow.prep.v1');
 const adoptedSchedule=JSON.stringify(ctx.DayBuilder.schedule());
 click('adopt-shared');
 assert.equal(api.state.shared,false);
 assert.equal(api.state.screen,'plan','adoption skips first-visit prep for a fresh recipient');
 assert([...nodes.values()].some(n=>n.dataset.testid==='db-root'&&!n.hidden));
 assert.equal(JSON.stringify(ctx.DayBuilder.schedule()),adoptedSchedule,'adoption preserves the builder schedule');
 assert(Object.values(JSON.parse(memory.get('gonow.prep.v1'))).some(r=>r.seen),'adoption marks prep seen');
 console.log('PASS shared copy opens list builder with banner and remains shared after Trip prep Continue');
 api.state.answers.who=travelerBeforeSwap;
 // Item F: exercise protected reset through the real event handler, plus compact custom-item sharing.
 const resetRoot=node('reset-simplify');
 const resetDate='2026-11-26',suggested=ctx.DayBuilder.buildSuggested(resetDate);
 const protectedItem={id:'own-booked',title:'My booking',preferred:1380,duration:30,custom:true,booked:true,locked:true,manualTime:true,place:'Beach'};
 const ownFlexible={...protectedItem,id:'own-flexible',title:'My walk',preferred:1320,locked:false,booked:false};
 const userLock={...suggested.items.find(i=>i.id==='photos'),locked:true,userLocked:true,preferred:1050,duration:40};
 memory.set('gonow:daybuilder:'+api.state.plan.id,JSON.stringify({days:{[resetDate]:{...suggested,items:[ownFlexible,protectedItem,userLock],unscheduled:[]}}}));
 const resetBuilder=ctx.DayBuilder.mount(resetRoot,{plan:api.state.plan});
 resetBuilder.selectDay(resetDate,false);
 const resetContent=()=>node('reset-simplify .db-content').innerHTML;
 assert(resetContent().includes('data-testid="day-reset"')&&resetContent().includes('data-testid="day-add-own"'));
 assert(!/data-testid="(?:day-add|db-reset|db-tray-toggle|db-booking-toggle|db-booking-form)"|id="db-chest"|Anchor it/.test(resetContent()));
 // Item F: removal goes to Needs a time; visible and accessible labels must agree.
 assert(resetContent().includes('aria-label="Remove from day My walk"'));
 assert(resetContent().includes('<span>Remove from day</span>'));
 assert(!/To ideas|Move to ideas|Activity ideas/.test(resetContent()));
 assert(!resetContent().split('data-db-id="own-flexible"')[1].split('data-testid="db-pair"')[0].includes('db-locked-tag'),'unbooked custom item has no static Locked tag');
 const sharedOwn=ctx.DayBuilder.importDays(resetBuilder.exportState()).days[resetDate].items;
 assert.strictEqual(sharedOwn.find(i=>i.id==='own-flexible').booked,false,'sharing preserves unbooked choice');
 assert.strictEqual(sharedOwn.find(i=>i.id==='own-booked').booked,true,'sharing preserves booked choice');
 function resetAction(name){const button={dataset:{dbAction:name},closest:()=>null};resetRoot.click({target:{closest:s=>s==='[data-db-action]'?button:null},stopPropagation(){}});}
 resetAction('reset');assert(resetContent().includes('Reset this day? Locked and booked items stay.'));
 assert(resetBuilder.getDay().items.some(i=>i.id==='own-flexible'),'opening confirmation leaves the day alone');
 resetAction('reset-cancel');assert(resetBuilder.getDay().items.some(i=>i.id==='own-flexible'));
 resetAction('reset');resetAction('reset-confirm');
 const resetItems=resetBuilder.getDay().items;
 assert(!resetItems.some(i=>i.id==='own-flexible'));
 assert(resetItems.some(i=>i.id==='own-booked'&&i.preferred===1380&&i.locked));
 assert(resetItems.some(i=>i.id==='photos'&&i.preferred===1050&&i.duration===40&&i.userLocked));
 assert.equal(resetItems.filter(i=>i.id==='photos').length,1,'protected suggestion is not duplicated');
 assert(suggested.items.every(i=>resetItems.some(r=>r.id===i.id)),'missing suggestions restored');
 console.log('PASS direct day actions, reset confirmation/cancel/protected items, unbooked tag and sharing');
 // Drive the actual delegated transfer controls, including an untimed move.
 const transferRoot=node('transfer-regression');
 memory.delete('gonow:daybuilder:oahu-demo-2026-11');
 const transfer=ctx.DayBuilder.mount(transferRoot,{plan:api.state.plan});
 transfer.selectDay('2026-11-26',false);
 const moving=transfer.getDay().items.find(i=>i.id==='2026-11-26-1');
 function action(id,zone,name){
  const row={dataset:{dbId:id,dbZone:zone}};
  const button={dataset:{dbAction:name},closest:s=>s==='[data-db-id]'?row:null};
  const target={closest:s=>s==='[data-db-action]'?button:null};
  transferRoot.click({target,stopPropagation(){}});
 }
 function latestDialog(testid){return [...nodes.values()].filter(n=>n.dataset.testid===testid).at(-1);}
 function submitTransfer(dialog,date,start){
  const form=dialog.querySelector('form');
  form.elements={date:{value:date},start:{value:start},end:{value:''}};
  form.onsubmit({target:form,preventDefault(){}});
 }
 // Booking actions remain usable even though the lock indicator is static.
 const bookingHTML=node('transfer-regression .db-content').innerHTML.split('data-db-id="lamer"')[1].split('data-testid="db-pair"')[0];
 assert(bookingHTML.includes('data-testid="db-more"'));
 assert(bookingHTML.includes('data-db-action="move-day"'));
 assert(bookingHTML.includes('data-db-action="edit-time"'));
 const indicator=bookingHTML.match(/<span[^>]*data-testid="db-lock"[^>]*>/)[0];
 assert(!/aria-pressed|data-db-action|tabindex|role=/.test(indicator));
 action('lamer','day','move-day');
 let reservationUnlock=latestDialog('unlock-confirm');
 assert(reservationUnlock,'booking move still asks for confirmation');
 reservationUnlock.querySelector('[data-testid=unlock-decline]').onclick();
 assert(transfer.getDay().items.find(i=>i.id==='lamer').locked,'declining retains reservation lock');
 const unlockCount=()=>[...nodes.values()].filter(n=>n.dataset.testid==='unlock-confirm').length,beforeUnlocks=unlockCount();
 node('transfer-regression [data-testid=activity-time-form]').elements={start:{disabled:false,focus(){}}};
 action('lamer','day','edit-time');
 assert.equal(unlockCount(),beforeUnlocks,'time edits on bookings open directly, no unlock step');
 assert(transfer.getDay().items.find(i=>i.id==='lamer').locked,'a booking keeps its lock while its time is edited');
 assert(node('transfer-regression .db-content').innerHTML.includes('data-testid="activity-time-form"'));
 assert(!/<fieldset disabled/.test(node('transfer-regression .db-content').innerHTML),'the time fields are editable');
 console.log('PASS booking menu, static lock indicator, move decline and direct time edit on bookings');
 action(moving.id,'day','move-day');
 const unlock=latestDialog('unlock-confirm');
 if(unlock)unlock.querySelector('[data-testid=unlock-accept]').onclick();
 submitTransfer(latestDialog('move-day-dialog'),'2026-11-27','');
 assert(transfer.getDay().unscheduled.some(i=>i.id===moving.id));
 const beforeSchedule=JSON.stringify(transfer.getDay());
 action(moving.id,'tray','schedule');
 submitTransfer(latestDialog('schedule-dialog'),'2026-11-27','15:00');
 const conflict=latestDialog('move-conflict');
 assert(conflict && conflict.innerHTML.includes('Black Friday shopping'));
 assert.equal(JSON.stringify(transfer.getDay()),beforeSchedule,'conflict waits for a choice');
 conflict.querySelector('[data-testid=conflict-keep]').onclick();
 assert(!transfer.getDay().unscheduled.some(i=>i.id===moving.id));
 assert.equal(transfer.schedule().days[2].items.find(i=>i.id===moving.id).start,900);
 console.log('PASS untimed move then schedule at 15:00 offers shopping conflict before Keep both');
 // Exercise menu opening/closing and viewport coordinates with measured rectangles.
 const attributes={'aria-expanded':'false'};
 const menu={hidden:true,style:{},getBoundingClientRect:()=>{assert.equal(menu.hidden,false,'unhide before measuring');assert.equal(menu.style.display,'block');return {width:260,height:326};},querySelector:()=>({focus(){}})};
 const menuRow={querySelector:()=>menu};
 const trigger={dataset:{dbAction:'more'},closest:()=>menuRow,
  getAttribute:k=>attributes[k],setAttribute:(k,v)=>attributes[k]=v,
  getBoundingClientRect:()=>({left:1100,top:746,bottom:790})};
 const originalQuery=transferRoot.querySelectorAll;
 transferRoot.querySelectorAll=selector=>selector==='[data-testid=db-more][aria-expanded=true]' && attributes['aria-expanded']==='true'?[trigger]:[];
 for(const width of [1280,390]){
  ctx.document.documentElement.clientWidth=width;ctx.innerHeight=800;
  const target={closest:s=>s==='[data-db-action]'?trigger:null};
  transferRoot.click({target,stopPropagation(){}});
  assert.equal(menu.hidden,false);assert.equal(attributes['aria-expanded'],'true');
  assert.equal(menu.style.position,'fixed');
  assert(Number.parseFloat(menu.style.left)>=16 && Number.parseFloat(menu.style.left)+260<=width-16);
  assert(Number.parseFloat(menu.style.top)>=16 && Number.parseFloat(menu.style.top)+326<=784);
  transferRoot.click({target,stopPropagation(){}});
  assert.equal(menu.hidden,true);assert.equal(attributes['aria-expanded'],'false');
 }
 transferRoot.querySelectorAll=originalQuery;
 console.log('PASS More menu toggles and clamps to viewport at 1280 and 390');

 const demoAnswers={...api.state.answers};
 const head=()=>ctx.__renderHelpers.dayHeadHTML(api.state.plan.days[1],1,ctx.__renderHelpers.dayModel(api.state.plan.days[1],1)).match(/aria-label="Sleep[^"]*"/)[0];
 const baseline=head();
 Object.assign(api.state.answers,{dietNeeds:['Vegan'],bedtime:'',wake:''});
 api.state.plan=await ctx.AI.generatePlan(api.state.answers,{fast:true});smoke('cleared sleep');
 assert.notEqual(head(),baseline);
 Object.assign(api.state.answers,{bedtime:'22:30',wake:'06:30'});
 api.state.plan=await ctx.AI.generatePlan(api.state.answers,{fast:true});smoke('restored sleep');
 assert.equal(api.state.plan.id,'oahu-demo-2026-11');assert.equal(head(),baseline);
 Object.assign(api.state.answers,demoAnswers);
 console.log('PASS default compact ring restored after dietary and sleep personalization');
 console.log('PASS real demo builder mount and day helpers');
 for(const destination of ['Oahu','Lisbon']){
  Object.assign(api.state.answers,{destination,templateOahu:true,start:'2027-04-10',end:'2027-04-14'});
  api.state.plan=await ctx.AI.generatePlan(api.state.answers,{fast:true});
  api.go('plan');if(api.state.screen==='prep')click('prep-continue');
  smoke(destination);
  delete api.state.plan.weather;smoke(destination+' without weather');
  console.log('PASS real '+destination+' template builder mount and day helpers');
 }
 // Pick plans retain exact places, duration and reservations through the real builder.
 Object.assign(api.state.answers,{destination:'Oahu',start:'2026-11-25',end:'2026-11-29',level:'active',ages:[18,19],picks:{activities:['diamond-head','dive','laniakea','waimea'],restaurants:['lamer','senia']}});
 const picked=ctx.PickScheduler.schedule(api.state.answers,ctx.GONOW_PICKS.oahu);
 assert.equal(picked.unfit.length,0);
 api.state.plan={...ctx.Engine.buildTemplatePlan(api.state.answers,ctx.Engine.matchDestination('Oahu')),id:'picks-render-test',days:picked.days};
 ctx.DayBuilder.resetSession();
 const pickedBuilder=ctx.DayBuilder.mount(node('picked-plan'),{...ctx.__renderHelpers.builderContext(),plan:api.state.plan});
 const scheduled=pickedBuilder.schedule().days.flatMap(d=>d.items);
 for(const item of scheduled)assert.equal((item.notes||[]).length,0,JSON.stringify(item));
 for(const id of ['diamond-head','dive','laniakea','waimea','lamer','senia'])assert(scheduled.some(i=>i.id===id),id);
 assert.equal(scheduled.find(i=>i.id==='lamer').start,1170);
 console.log('PASS picked plan real DayBuilder.schedule preserves all picks without conflict warnings');
 // Exercise the full.py export fixture through the actual builder and ICS code.
 const exportIds=JSON.parse(fs.readFileSync('tests/test_full.py','utf8').match(/OAHU_EXPORT_PICKS = (\[[\s\S]*?\])/)[1].replace(/'/g,'"'));
 const catalog=ctx.GONOW_PICKS.oahu;
 api.state.answers.picks={activities:exportIds.filter(id=>catalog.activities.some(i=>i.id===id)),restaurants:['lamer','senia',...exportIds.filter(id=>catalog.restaurants.some(i=>i.id===id))]};
 const fullPicks=ctx.PickScheduler.schedule(api.state.answers,catalog);
 assert.equal(fullPicks.unfit.length,0);
 api.state.plan={...api.state.plan,id:'oahu-picks-export',days:fullPicks.days};
 ctx.DayBuilder.resetSession();
 const exportBuilder=ctx.DayBuilder.mount(node('export-plan'),{...ctx.__renderHelpers.builderContext(),plan:api.state.plan});
 for(const date of ['2026-11-26','2026-11-27']){
  exportBuilder.selectDay(date,false);
  const html=node('export-plan .db-content').innerHTML;
  // Confirmed bookings use static tags instead of dead unlock toggles.
  const buttons=html.match(/<span[^>]*data-testid="db-locked-tag"[^>]*>[\s\S]*?<\/span>/g)||[];
  assert(buttons.length>0);
  for(const button of buttons){assert.equal((button.match(/<svg/g)||[]).length,1);assert(button.includes('<small>Locked</small></span>'));}
  assert(!html.includes('class="db-lock"'),'static tag is the only booking lock indicator');
 }
 api.state.edits={items:{'pick-checkin':{note:'Shared café note, bring water; enjoy 🌺'}},removed:['udon']};
 const fullICS=api.buildICS();const unfolded=fullICS.replace(/\r\n /g,'');
 assert((fullICS.match(/BEGIN:VEVENT/g)||[]).length>=12);
 assert(unfolded.includes('Diamond Head')&&unfolded.includes('Kualoa'));
 assert(unfolded.includes('Shared café note\\, bring water\\; enjoy 🌺'));
 assert(!unfolded.includes('SUMMARY:'+catalog.restaurants.find(i=>i.id==='udon').name+'\r\n'));
 console.log('PASS full pick fixture ICS event count, researched places, escaped note/removal and single visible Locked toggle');

})().catch(e=>{console.error(e.stack);process.exitCode=1;});
