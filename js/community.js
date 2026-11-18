/* Profile and Community pages. Public cards are read by anyone; only the owner writes or deletes theirs; reports are create-only.
   Until real posts exist, the feed is seeded with sample content labeled "Example". */
(function(root){
'use strict';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cut=(s,n)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const HOME='gonow:home-city';
const REASONS=[['spam','Spam'],['inappropriate','Inappropriate'],['wrong','Wrong info']];
// Keys that can carry personal details; removed before a trip is made public.
const PRIVATE=/^(note|notes|confirmation|confirmationCode|bookingRef|reference|phone|email|travelers|travellers|ages|who|budget|flightNumber|flightTime|flightNo|returnFlight|arrivalTime|departureTime|hotelCoordinates|hotelCoords|ageRules)$/;
function scrub(v){if(Array.isArray(v))return v.map(scrub);if(v&&typeof v==='object'){const o={};for(const [k,x] of Object.entries(v)){if(PRIVATE.test(k)||x===undefined)continue;o[k]=scrub(x);}return o;}return v;}
const isFlight=i=>i&&(i.kind==='flight'||i.flight||/^(Est\. )?(lands|departs)\b/i.test(String(i.title||'')));
// Public copies never carry the hotel, banner text or outbound links; the hotel name is replaced in item text.
function hide(v,hotel,avoid){if(!hotel)return v;const away=String(avoid||'').toLowerCase();const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const core=String(hotel).replace(/\b(the|hotel|resort|inn|suites?|spa|and|&|by|marriott|hilton|hyatt|a|an)\b/gi,' ').replace(/[^\p{L}\p{N}' -]/gu,' ').trim().split(/\s+/).filter(w=>w.length>=4&&!away.includes(w.toLowerCase()));const terms=[String(hotel)].concat(core.length?[core.join(' ')]:[]).map(esc);const re=new RegExp('(?:the\\s+)?(?:'+terms.join('|')+')(?:\\s+(?:hotel|resort)(?:\\s*(?:&|and)\\s*(?:resort|spa))?)?(?!\\s+(?:beach|mall|ave|avenue|st|street|park|bay))','gi');return hideWith(v,re);}
function hideWith(v,re){if(typeof v==='string')return v.replace(re,'your hotel');if(Array.isArray(v))return v.map(x=>hideWith(x,re));if(v&&typeof v==='object'){const o={};for(const [k,x] of Object.entries(v))o[k]=hideWith(x,re);return o;}return v;}
const LINKS=/^(url|href|link|links|sources|mapUrl|bookingUrl|creditUrl|photoUrl|website)$/;
function unlink(v){if(Array.isArray(v))return v.map(unlink);if(v&&typeof v==='object'){const o={};for(const [k,x] of Object.entries(v)){if(LINKS.test(k))continue;o[k]=unlink(x);}return o;}return v;}
function hotelOf(trip,plan){const h=String(trip&&trip.answers&&trip.answers.stay||plan&&plan.stay||'').trim();return h.length>=3?h:'';}
function cleanPlan(plan,hotel,avoid){if(!plan)return null;const p=hide(unlink(scrub(JSON.parse(JSON.stringify(plan)))),hotel,avoid);delete p.stay;delete p.banner;p.meta=(p.days||[]).length+' days';(p.days||[]).forEach(d=>{d.items=(d.items||[]).filter(i=>!isFlight(i));d.items.forEach(i=>{if(i.kind==='stay'||/check[- ]?in/i.test(i.title||'')){i.desc='';delete i.place;delete i.address;delete i.location;}});});return p;}
function cleanBuilder(b,hotel,avoid){if(!b||!b.days)return null;const o=hide(unlink(scrub(JSON.parse(JSON.stringify(b)))),hotel,avoid);Object.values(o.days||{}).forEach(d=>{if(d.items)d.items=d.items.filter(i=>!isFlight(i));if(d.unscheduled)d.unscheduled=d.unscheduled.filter(i=>!isFlight(i));});return o;}
function nightsOf(t){const a=Date.parse(t.start),b=Date.parse(t.end);return Number.isFinite(a)&&Number.isFinite(b)?Math.max(1,Math.round((b-a)/864e5)+1):((t.plan&&t.plan.days||[]).length||1);}
function dayLines(plan){return (plan&&plan.days||[]).slice(0,21).map(d=>({theme:cut(d.theme,60),stops:(d.items||[]).filter(i=>!isFlight(i)).slice(0,12).map(i=>cut(i.title,80))}));}
function cover(destination){const m=root.Engine&&root.Engine.matchDestination&&root.Engine.matchDestination(destination||'');const id=m&&m.id;return id&&/^[a-z]+$/.test(id)?'images/'+id+'.jpg':'';}
// The public card for a trip: only places, day themes and a cleaned copy of the plan.
function tripPost(trip,builder){const hotel=hotelOf(trip,trip.plan),avoid=[trip.destination,trip.answers&&trip.answers.destination,trip.plan&&trip.plan.title].join(' '),plan=cleanPlan(trip.plan,hotel,avoid);const dest=cut(trip.destination||plan&&plan.title,80);const days=nightsOf(trip);
 const post={kind:'trip',title:cut(days+' days in '+dest.split(',')[0],80),line:cut(dayLines(plan).map(d=>d.theme).filter(Boolean).slice(0,3).join(' · '),120),destination:dest,photo:cover(dest),days:dayLines(plan),
  trip:{destination:dest,nights:days,start:String(trip.start||'').slice(0,10),end:String(trip.end||'').slice(0,10),answers:{destination:dest,styles:(trip.answers&&trip.answers.styles||[]).slice(0,6),level:trip.answers&&trip.answers.level||''},plan,builder:cleanBuilder(builder,hotel,avoid)}};
 if(JSON.stringify(post).length>300000){delete post.trip.builder;}if(JSON.stringify(post).length>300000)return null;return post;}
function checkinPost(place,city,note){return {kind:'checkin',title:cut(place,80),line:cut(note,140)||cut(city,80),destination:cut(city,80),place:cut(place,80),note:cut(note,140),photo:cover(city)};}
const safeId=s=>String(s).replace(/[^A-Za-z0-9_-]/g,'-').slice(0,120);

function create(app){
 let posts=null,loading=null,examples=null,tab='all',status='';
 const cloud=()=>root.goNowAccount,user=()=>cloud()&&cloud().user;
 function loadExamples(){if(examples)return Promise.resolve(examples);if(root.GONOW_COMMUNITY_EXAMPLES){examples=root.GONOW_COMMUNITY_EXAMPLES;return Promise.resolve(examples);}return new Promise(resolve=>{const s=document.createElement('script');s.src='js/community-examples.js?v='+(root.GONOW_CACHE_TAG||'1');s.onload=()=>{examples=root.GONOW_COMMUNITY_EXAMPLES||[];resolve(examples);};s.onerror=()=>{examples=[];resolve(examples);};document.head.append(s);});}
 function refresh(){if(loading)return loading;loading=Promise.all([loadExamples(),cloud()&&cloud().communityList?cloud().communityList().catch(()=>null):Promise.resolve(null)]).then(([ex,live])=>{posts=(live||[]).filter(p=>p&&(p.kind==='trip'||p.kind==='checkin')&&p.title);status=live?'':'offline';return posts;}).finally(()=>{loading=null;});return loading;}
 const all=()=>[...(posts||[]),...(examples||[]).map(p=>Object.assign({example:true},p))];
 function media(p){return p.photo&&/^images\/[a-z-]+\.jpg$/.test(p.photo)?'<img loading="lazy" src="'+esc(p.photo)+'" alt="">':'<span class="community-placeholder" aria-hidden="true">'+esc((p.destination||p.title||'?').trim()[0]||'?')+'</span>';}
 // Design preview (Xiaohongshu-style feed). Extra photos, likes and the extra cards below are example data only.
 const EXTRA={'ex-oahu':['images/activity-diamond-head.jpg','images/activity-kualoa.jpg','images/activity-lanikai.jpg','images/food-giovannis.jpg'],'ex-lisbon':[],'ex-kyoto':[],'ex-c-giovannis':['images/activity-sharks-cove.jpg'],'ex-c-leonards':['images/activity-waikiki-sunset.jpg']};
 const MOCK=[['ex-m-bali','Slow week in Bali','Rice terraces, yoga, sunsets','Bali','images/bali.jpg'],['ex-m-reykjavik','Reykjavik, lights & lagoons','Hot springs and the Golden Circle','Reykjavik','images/reykjavik.jpg'],['ex-m-barcelona','Barcelona long weekend','Tapas, Gaudí and the beach','Barcelona','images/barcelona.jpg'],['ex-m-banff','Banff lakes road trip','Moraine, Louise and easy hikes','Banff','images/banff.jpg'],['ex-m-capetown','Cape Town in 6 days','Table Mountain and the Cape','Cape Town','images/capetown.jpg']].map(([id,title,line,destination,photo])=>({id,kind:'trip',title,line,destination,photo,mock:true}));
 const hash=s=>{let h=7;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h;};
 const likes=p=>p.example?18+hash(p.id)%420:null;
 const photos=p=>[p.photo,...(EXTRA[p.id]||[])].filter(x=>x&&/^images\/[a-z-]+\.jpg$/.test(x));
 const byline=p=>p.example?'Example':(p.ownerName||'Traveler');
 const avatar=p=>'<span class="cx-avatar" aria-hidden="true">'+esc(byline(p).trim()[0]||'T')+'</span>';
 function card(p){const tall=hash(p.id)%3;return '<button class="community-card cx-card cx-h'+tall+'" data-testid="community-card" data-post="'+esc(p.id)+'"><span class="community-media">'+media(p)+(p.example?'<span class="example-tag" data-testid="example-tag">Example</span>':'')+'</span><strong>'+esc(p.title)+'</strong><small class="cx-line">'+esc(p.kind==='checkin'?(p.destination+(p.note?' · '+p.note:'')):p.line||p.destination)+'</small><span class="cx-meta">'+avatar(p)+'<span class="cx-name">'+esc(byline(p))+'</span>'+(likes(p)!==null?'<span class="cx-likes" aria-label="'+likes(p)+' likes">♡ '+likes(p)+'</span>':'')+'</span></button>';}
 function mine(p){const u=user();return !!(u&&!p.example&&p.ownerId===u.uid);}
 let query='';
 const TABS=[['all','For you'],['trip','Nearby trips'],['checkin','Food']];
 function community(view){
  if(!TABS.some(([k])=>k===tab))tab='all';
  const q=query.trim().toLowerCase();
  const list=all().concat(examples?MOCK.map(p=>Object.assign({example:true},p)):[]).filter(p=>tab==='all'||p.kind===tab).filter(p=>!q||[p.title,p.destination,p.line,p.note].join(' ').toLowerCase().includes(q));
  view.innerHTML='<section class="shell community-page cx-page" data-testid="community-page"><h1 tabindex="-1" id="step-title">Community</h1><p class="muted cx-note">Design preview · cards marked Example use sample data.</p>'+
   '<label class="cx-search"><span class="sr-only">Search community</span><input type="search" data-testid="community-search" placeholder="Search trips, cities, food" value="'+esc(query)+'"></label>'+
   '<div class="community-tabs cx-tabs" role="tablist">'+TABS.map(([k,l])=>'<button role="tab" data-testid="community-tab-'+(k==='all'?'foryou':k)+'" aria-selected="'+(tab===k)+'" data-tab="'+k+'">'+l+'</button>').join('')+'</div>'+
   (tab==='checkin'?'<button class="outline" data-testid="checkin-start">Check in at a restaurant</button>':'')+
   (posts===null?'<p class="muted" data-testid="community-loading">Loading…</p>':'')+(status==='offline'&&posts!==null?'<p class="muted" data-testid="community-offline">Showing examples. Couldn’t reach the community right now.</p>':'')+
   '<div class="community-grid cx-feed" data-testid="community-grid">'+list.map(card).join('')+'</div>'+(posts!==null&&!list.length?'<p class="muted">Nothing shared yet.</p>':'')+
   '<button class="cx-fab" data-testid="community-fab" aria-label="Share a trip">＋ Share</button></section>';
  view.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;community(view);});
  const search=view.querySelector('[data-testid=community-search]');search.oninput=()=>{query=search.value;const at=search.selectionStart;community(view);const again=view.querySelector('[data-testid=community-search]');again.focus();try{again.setSelectionRange(at,at);}catch(e){}};
  const pool=()=>all().concat(MOCK.map(p=>Object.assign({example:true},p)));
  view.querySelectorAll('[data-post]').forEach(b=>b.onclick=()=>details(pool().find(p=>String(p.id)===b.dataset.post),view));
  const start=view.querySelector('[data-testid=checkin-start]');if(start)start.onclick=()=>checkinForm(view);
  view.querySelector('[data-testid=community-fab]').onclick=()=>shareSheet();
  if(posts===null)refresh().then(()=>{if(app.state.screen==='community')community(view);});
 }
 function shareSheet(){if(!user()){root.GoNowAccounts&&root.GoNowAccounts.signin();return;}const trips=app.readTrips().filter(t=>t&&t.plan);
  const s=sheet('<h2>Share a trip</h2>'+(trips.length?'<p class="muted">Only places and days are shared. Your hotel, notes, flights and bookings stay private.</p><div class="cx-share-list">'+trips.slice(0,12).map(t=>'<button class="outline" data-share-trip="'+esc(t.id)+'">'+esc(t.destination||t.title||'Trip')+'<small>'+esc(app.dateRange(t))+'</small></button>').join('')+'</div>':'<p class="muted">Plan a trip first, then share it here.</p>'),'community-share-sheet');
  s.querySelectorAll('[data-share-trip]').forEach(b=>b.onclick=()=>{const want=b.dataset.shareTrip;s.close();app.openSaved(want,'plan');
   // Share only once the chosen trip is the open one, never whichever trip was open before.
   let n=0;const wait=setInterval(()=>{const t=app.currentTrip&&app.currentTrip();if(t&&t.id===want){clearInterval(wait);shareCurrent();}else if(++n>30){clearInterval(wait);app.toast('Couldn’t open that trip. Try again.');}},100);});}
 function sheet(html,testid){const s=document.getElementById('sheet');s.dataset.testid=testid;s.className='community-sheet';s.innerHTML='<button class="account-close" data-close aria-label="Close">×</button>'+html;s.querySelector('[data-close]').onclick=()=>s.close();if(!s.open)s.showModal();return s;}
 function details(p,view){if(!p)return;const days=p.kind==='trip'?(p.days||[]):[];const pics=photos(p);
  const carousel=pics.length?'<div class="cx-carousel" data-testid="community-photos" tabindex="0" aria-label="Photos, swipe for more">'+pics.map((src,i)=>'<img src="'+esc(src)+'" alt="Photo '+(i+1)+' of '+pics.length+'" loading="lazy">').join('')+'</div>'+(pics.length>1?'<p class="cx-dots" aria-hidden="true">'+pics.map((_,i)=>'<span'+(i?'':' class="on"')+'></span>').join('')+'</p>':''):'<div class="community-detail-media">'+media(p)+'</div>';
  const s=sheet(carousel+(p.example?'<span class="example-tag">Example</span>':'')+'<h2>'+esc(p.title)+'</h2><p class="cx-meta cx-detail-by">'+avatar(p)+'<span>'+esc(byline(p))+'</span><span class="muted">· '+esc(p.destination||'')+'</span></p>'+
   (p.line&&p.kind==='trip'?'<p>'+esc(p.line)+'</p>':'')+(p.kind==='checkin'&&p.note?'<p>'+esc(p.note)+'</p>':'')+
   (days.length?'<h3 class="cx-sub">Trip days</h3><ol class="community-days" data-testid="community-days">'+days.map((d,i)=>'<li><details><summary>Day '+(i+1)+(d.theme?' · '+esc(d.theme):'')+'</summary><p>'+esc((d.stops||[]).join(' · ')||'Free time')+'</p></details></li>').join('')+'</ol>':'')+
   '<div class="cx-actions" data-testid="community-social"><button type="button" class="cx-act" data-act="like" aria-pressed="false">♡ <span>'+(likes(p)??'Like')+'</span></button><button type="button" class="cx-act" data-act="save" aria-pressed="false">☆ Save</button><button type="button" class="cx-act" data-act="comment">💬 Comments</button></div><p class="muted cx-soon" hidden data-testid="community-soon">Likes, saves and comments are a design preview and aren’t saved yet.</p>'+
   '<div class="row community-actions">'+(p.kind==='trip'&&p.trip?'<button class="primary" data-testid="community-copy">Copy this trip</button>':'')+(mine(p)?'<button class="outline" data-testid="community-remove">Remove from community</button>':'')+(!p.example&&!mine(p)?'<button class="link" data-testid="community-report">Report</button>':'')+'</div>','community-details');
  s.classList.add('cx-detail');
  const car=s.querySelector('.cx-carousel');if(car)car.onscroll=()=>{const i=Math.round(car.scrollLeft/Math.max(1,car.clientWidth));s.querySelectorAll('.cx-dots span').forEach((d,k)=>d.classList.toggle('on',k===i));};
  s.querySelectorAll('.cx-act').forEach(b=>b.onclick=()=>{s.querySelector('[data-testid=community-soon]').hidden=false;if(b.dataset.act!=='comment')b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));});
  const copy=s.querySelector('[data-testid=community-copy]');if(copy)copy.onclick=()=>{s.close();app.copyTrip(p);};
  const rm=s.querySelector('[data-testid=community-remove]');if(rm)rm.onclick=async()=>{try{await cloud().communityRemove(p.id);posts=(posts||[]).filter(x=>x.id!==p.id);forget(p.id);s.close();app.toast('Removed from community');community(view);}catch(e){app.toast('Couldn’t remove it. Try again.');}};
  const rep=s.querySelector('[data-testid=community-report]');if(rep)rep.onclick=()=>report(p);}
 function report(p){if(!user()){root.GoNowAccounts&&root.GoNowAccounts.signin();return;}
  const s=sheet('<h2>Report this post</h2><form data-testid="report-form">'+REASONS.map(([v,l],i)=>'<label class="checkrow"><input type="radio" name="reason" value="'+v+'"'+(i?'':' checked')+'> <span>'+l+'</span></label>').join('')+'<button class="primary" data-testid="report-send">Send report</button></form>','report-sheet');
  s.querySelector('form').onsubmit=async e=>{e.preventDefault();try{await cloud().report(p.id,s.querySelector('input[name=reason]:checked').value);s.close();app.toast('Thanks. We’ll take a look.');}catch(err){app.toast('Couldn’t send the report. Try again.');}};}
 function restaurantsFromTrips(){const names=new Map();app.readTrips().forEach(t=>(t.plan&&t.plan.days||[]).forEach(d=>(d.items||[]).forEach(i=>{if((i.kind==='meal'||i.kind==='food'||i.meal||i.restaurant)&&i.title&&!/near hotel|^lunch$|^dinner$/i.test(i.title))names.set(cut(i.title,80),cut(t.destination,80));})));return [...names.entries()].slice(0,40);}
 function checkinForm(view){if(!user()){root.GoNowAccounts&&root.GoNowAccounts.signin();return;}if(user().isAnonymous){app.toast('Sign in with Google or email to post');return;}const known=restaurantsFromTrips();
  const s=sheet('<h2>Check in</h2><form data-testid="checkin-form"><label>Restaurant<input name="place" required maxlength="80" list="checkin-places" data-testid="checkin-place"></label><datalist id="checkin-places">'+known.map(([n])=>'<option value="'+esc(n)+'">').join('')+'</datalist><label>City<input name="city" required maxlength="80" data-testid="checkin-city"></label><label>One line about it<input name="note" maxlength="140" data-testid="checkin-note"></label><button class="primary" data-testid="checkin-post">Post check-in</button></form>','checkin-sheet');
  const f=s.querySelector('form');f.place.oninput=()=>{const hit=known.find(([n])=>n===f.place.value);if(hit&&!f.city.value)f.city.value=hit[1];};
  f.onsubmit=async e=>{e.preventDefault();try{const post=checkinPost(f.place.value,f.city.value,f.note.value);post.ownerName='Traveler';post.id='c_'+safeId(user().uid)+'_'+Date.now().toString(36);await cloud().communityShare(post);posts=[Object.assign({},post,{ownerId:user().uid})].concat(posts||[]);s.close();app.toast('Check-in posted');community(view);}catch(err){app.toast('Couldn’t post. Try again.');}};}
 // Share-to-community for the current trip (opt-in; the owner can remove it).
 const sharedKey=tripId=>'gonow:community:'+(user()?user().uid:'')+':'+tripId;
 const sharedId=tripId=>{try{return localStorage.getItem(sharedKey(tripId));}catch(e){return null;}};
 function forget(postId){try{Object.keys(localStorage).filter(k=>k.indexOf('gonow:community:')===0&&localStorage.getItem(k)===postId).forEach(k=>localStorage.removeItem(k));}catch(e){}}
 async function shareCurrent(){const trip=app.currentTrip();if(!trip||!trip.plan)return;if(!user()){root.GoNowAccounts&&root.GoNowAccounts.signin();return;}if(user().isAnonymous){app.toast('Sign in with Google or email to share publicly');return;}
  const existing=sharedId(trip.id);
  if(existing){try{await cloud().communityRemove(existing);forget(existing);posts=posts&&posts.filter(p=>p.id!==existing);app.toast('Removed from community');}catch(e){app.toast('Couldn’t remove it. Try again.');}shareItem();return;}
  const s=sheet('<h2>Share to community?</h2><p class="muted">Anyone can see its places and days. Your hotel, notes, flights and bookings stay private.</p><label class="checkrow"><input type="checkbox" data-testid="community-show-name"> <span>Show my first name</span></label><div class="row"><button class="primary" data-testid="community-share-confirm">Share</button><button class="outline" data-close-2>Cancel</button></div>','community-share-sheet');
  s.querySelector('[data-close-2]').onclick=()=>s.close();
  s.querySelector('[data-testid=community-share-confirm]').onclick=async()=>{const post=tripPost(trip,app.builderFor(trip));if(!post){s.close();app.toast('This trip is too large to share');return;}post.ownerName=s.querySelector('[data-testid=community-show-name]').checked?cut(String(user().displayName||'').split(/\s+/)[0],40)||'Traveler':'Traveler';post.id='t_'+safeId(user().uid)+'_'+safeId(trip.id);try{await cloud().communityShare(post);localStorage.setItem(sharedKey(trip.id),post.id);posts=null;s.close();app.toast('Shared to community');}catch(e){s.close();app.toast('Couldn’t share. Try again.');}shareItem();};}
 function shareItem(){const menu=document.querySelector('[data-testid=share-menu]');if(!menu)return;const trip=app.currentTrip();let item=menu.querySelector('[data-testid=community-share]');if(!trip||!trip.plan||app.state.shared){if(item)item.remove();return;}
  if(!item){item=document.createElement('button');item.type='button';item.dataset.testid='community-share';item.setAttribute('role','menuitem');item.tabIndex=-1;menu.append(item);}const label=sharedId(trip.id)?'Remove from community':'Share to community';if(item.textContent!==label)item.textContent=label;}
 // Profile: signed-in users; guests get a one-line sign-in prompt.
 function homeCity(){try{return localStorage.getItem(HOME)||'';}catch(e){return '';}}
 function initials(n){return String(n||'T').split(/[\s@]+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'T';}
 function tripRow(t){const confirmed=app.tripConfirmed(t);return '<button class="profile-trip" data-testid="profile-trip" data-open="'+esc(t.id)+'" data-mode="plan"><span>'+esc(cut(t.destination||t.title||'Trip',60))+'</span><small>'+esc(app.dateRange(t))+'</small><span class="profile-tag">'+(confirmed?'Confirmed':'Draft')+'</span></button>';}
 function profile(view){const u=user();
  if(!u){view.innerHTML='<section class="shell profile-page" data-testid="profile-page"><h1 tabindex="-1" id="step-title">Profile</h1><p class="muted" data-testid="profile-guest">Sign in to see your trips on any device.</p><button class="primary" data-testid="profile-sign-in">Sign in</button></section>';view.querySelector('[data-testid=profile-sign-in]').onclick=()=>root.GoNowAccounts&&root.GoNowAccounts.signin();return;}
  const trips=app.readTrips(),drafts=trips.filter(t=>!app.tripConfirmed(t)),done=trips.filter(t=>app.tripConfirmed(t));
  const g=cloud().currentGroup,owned=trips.filter(t=>{try{return !!localStorage.getItem('gonow:invite:'+u.uid+':'+t.id);}catch(e){return false;}});
  const groups=owned.map(t=>({id:t.id,name:cut(t.destination||t.title,60),line:'You’re the organizer'}));
  if(g&&g.trip&&!groups.some(x=>x.id===g.trip.id))groups.push({id:g.trip.id,name:cut(g.trip.destination||g.trip.title||'Group trip',60),line:(g.memberIds||[]).length+' people · with '+cut(g.ownerName,40)});
  const name=u.displayName||u.email||'Traveler';
  view.innerHTML='<section class="shell profile-page" data-testid="profile-page"><div class="profile-head">'+(u.photoURL&&/^https:\/\//.test(u.photoURL)?'<img class="profile-avatar" data-testid="profile-avatar" src="'+esc(u.photoURL)+'" alt="" referrerpolicy="no-referrer">':'<span class="profile-avatar" data-testid="profile-avatar" aria-hidden="true">'+esc(initials(name))+'</span>')+'<div><h1 tabindex="-1" id="step-title" data-testid="profile-name">'+esc(name)+'</h1><button class="link" data-testid="profile-edit-name">Edit name</button></div></div>'+
   '<form class="profile-name-form" data-testid="profile-name-form" hidden><label>Display name<input name="name" maxlength="40" required value="'+esc(u.displayName||'')+'"></label><button class="primary">Save</button></form>'+
   '<form class="profile-home" data-testid="profile-home-form"><label>Home city<input name="home" maxlength="60" data-testid="home-city" value="'+esc(homeCity())+'" placeholder="Los Angeles" autocomplete="address-level2"></label><button class="outline" data-testid="home-city-save">Save</button></form><p class="muted profile-hint">Used for time differences on your plans.</p>'+
   '<h2>My trips</h2>'+(trips.length?'<details open data-testid="profile-drafts"><summary>Drafts · '+drafts.length+'</summary>'+drafts.map(tripRow).join('')+'</details><details open data-testid="profile-confirmed"><summary>Confirmed · '+done.length+'</summary>'+done.map(tripRow).join('')+'</details>':'<p class="muted">No trips yet.</p>')+
   '<h2>Group trips</h2>'+(groups.length?groups.map(x=>'<button class="profile-trip" data-testid="profile-group" data-open="'+esc(x.id)+'" data-mode="plan"><span>'+esc(x.name)+'</span><small>'+esc(x.line)+'</small></button>').join(''):'<p class="muted" data-testid="profile-no-groups">No group trips yet. Use Invite friends on a plan.</p>')+
   '<button class="outline profile-signout" data-testid="sign-out" data-signout>Sign out</button></section>';
  const nf=view.querySelector('[data-testid=profile-name-form]');view.querySelector('[data-testid=profile-edit-name]').onclick=()=>{nf.hidden=!nf.hidden;if(!nf.hidden)nf.name.focus();};
  nf.onsubmit=async e=>{e.preventDefault();try{await cloud().saveProfile({displayName:cut(nf.name.value,40)});app.toast('Name saved');profile(view);}catch(err){app.toast('Couldn’t save your name');}};
  const hf=view.querySelector('[data-testid=profile-home-form]');hf.onsubmit=e=>{e.preventDefault();const v=cut(hf.home.value,60);try{if(v)localStorage.setItem(HOME,v);else localStorage.removeItem(HOME);}catch(err){}if(cloud().saveProfile)cloud().saveProfile({homeCity:v}).catch(()=>{});app.toast(v?'Home city saved':'Home city cleared');};
  view.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>app.openSaved(b.dataset.open,b.dataset.mode));
  view.querySelector('[data-signout]').onclick=()=>cloud().signOut().then(()=>app.go('home'));}
 function render(screen,view){if(screen==='profile')profile(view);else community(view);}
 document.addEventListener('click',e=>{if(e.target.closest('[data-testid=community-share]'))shareCurrent();});
 const target=document.getElementById('view');if(target)new MutationObserver(shareItem).observe(target,{childList:true,subtree:true});
 return {render,refresh,tripPost,homeCity,_posts:()=>posts};
}
root.GoNowCommunity={create,tripPost,checkinPost,cleanPlan,cleanBuilder,scrub};
if(typeof module!=='undefined')module.exports=root.GoNowCommunity;
})(typeof window==='undefined'?globalThis:window);
