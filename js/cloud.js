(function(root){
'use strict';
const SDK_BASE='https://www.gstatic.com/firebasejs/10.12.2/';
const stamp=v=>v&&typeof v.toMillis==='function'?v.toMillis():v&&typeof v.seconds==='number'?v.seconds*1000+(v.nanoseconds||0)/1e6:typeof v==='number'?v:Date.parse(v)||0;
// Newest copy of each trip wins. Tombstones (a deleted trip, locally or in the account) are final: an older copy,
// another device or a late upload can never bring the trip back.
function merge(local,remote,tombs={}){const rows=new Map(local.filter(t=>!tombs[t.id]).map(t=>[t.id,t]));remote.forEach(t=>{if(t.deleted){rows.delete(t.id);return;}if(tombs[t.id])return;if(!rows.has(t.id)||stamp(t.updatedAt)>stamp(rows.get(t.id).updatedAt))rows.set(t.id,t);});return [...rows.values()];}
// What a group sees: the trip itself (places, days, times, order, locks via the day plan), never anyone's personal
// answers (pace, diet, fitness, origin, budget, ages), feel check-ins, private notes, flights or confirmation snapshot.
const SHARED_KEYS=['id','planId','title','destination','start','end','timeZone','plan','builder','tombstones','appliedChanges'];
const PRIVATE_FIELDS=/^(answers|userNote|privateNote|feel|feels|checkins?|diet|fitness|pace|origin|ages|budget|flightNumber|confirmation|bookingRef|group)$/;
function scrubShared(v){if(Array.isArray(v))return v.filter(x=>!(x&&typeof x==='object'&&x.kind==='flight')).map(scrubShared);if(v&&typeof v==='object'){const o={};Object.keys(v).forEach(k=>{if(PRIVATE_FIELDS.test(k)||v[k]===undefined)return;o[k]=scrubShared(v[k]);});return o;}return v;}
function shareable(trip){const out={};SHARED_KEYS.forEach(k=>{if(trip&&trip[k]!==undefined&&trip[k]!==null)out[k]=k==='plan'||k==='builder'?scrubShared(trip[k]):JSON.parse(JSON.stringify(trip[k]));});if(out.plan)delete out.plan.answers;return out;}
const CID=/^[A-Za-z0-9_-]{6,40}$/;
function newCid(){const b=new Uint8Array(9);(root.crypto||globalThis.crypto).getRandomValues(b);return Array.from(b,x=>x.toString(36).padStart(2,'0')).join('').slice(0,16);}
// Day plans come in two shapes: full {days:{date:{items,unscheduled}}} and compact {d:{date:{i,u}}}.
const itemId=i=>typeof i==='string'?i:i&&i.id;
function builderItems(b){const out=[];if(!b||typeof b!=='object')return out;Object.values(b.days||{}).forEach(d=>[...(d&&d.items||[]),...(d&&d.unscheduled||[])].forEach(i=>out.push(i)));Object.values(b.d||{}).forEach(d=>[...(d&&d.i||[]),...(d&&d.u||[])].forEach(i=>out.push(i)));return out;}
function dropDead(builder,t){if(!builder||!t||!Object.keys(t).length)return builder;const b=JSON.parse(JSON.stringify(builder));const keep=i=>!t[itemId(i)];Object.values(b.days||{}).forEach(d=>{if(d.items)d.items=d.items.filter(keep);if(d.unscheduled)d.unscheduled=d.unscheduled.filter(keep);});Object.values(b.d||{}).forEach(d=>{if(d.i)d.i=d.i.filter(keep);if(d.u)d.u=d.u.filter(keep);});return b;}
// A custom item that disappears from the day plan is deleted: it leaves a tombstone so an older copy can't restore it.
// An id that is back in the plan (Undo, re-added) clears its tombstone.
function noteTombstones(trip,next){const before=builderItems(trip.builder).filter(i=>i&&(i.custom||i.c)).map(itemId),now=new Set(builderItems(next).map(itemId));const t=Object.assign({},trip.tombstones||{});let changed=false;before.forEach(id=>{if(id&&!now.has(id)&&!t[id]){t[id]=Date.now();changed=true;}});Object.keys(t).forEach(id=>{if(now.has(id)){delete t[id];changed=true;}});if(changed){if(Object.keys(t).length)trip.tombstones=t;else delete trip.tombstones;}return trip;}
function create(options={}){
 const DAY=86400000;let sdk,auth,db,pending,user=null,stopTrips,timer,baseline=new Map(),disposed=false,saved=false,status='idle',retryTimer,retryN=0,flushing=null,lastGroupId=null;
 // One listener per group trip the user belongs to (owner or member); switching trips never drops another group.
 const groups=new Map(),stops=new Map();
 const storage=options.storage||root.localStorage,emit=options.emit||(()=>{}),local=options.local||(()=>[]);
 const remember=(k,v)=>{try{storage.setItem(k,v);}catch(e){}},read=k=>{try{return storage.getItem(k);}catch(e){return null;}};
 const json=(k,d)=>{try{const v=JSON.parse(read(k));return v==null?d:v;}catch(e){return d;}},keep=(k,v)=>remember(k,JSON.stringify(v));
 const TOMBS='gonow:tombstones',tombs=()=>json(TOMBS,{});
 const outboxKey=()=>'gonow:outbox:'+(user?user.uid:''),dirtyKey=()=>'gonow:dirty:'+(user?user.uid:'');
 function setStatus(next){if(status===next)return;status=next;emit('status',next);}
 async function load(){if(sdk)return sdk;if(pending)return pending;pending=(async()=>{let timeout;try{const importer=options.importer||(url=>import(url));const base=root.GONOW_FIREBASE_SDK_BASE||SDK_BASE;const modules=await Promise.race([options.sdk?Promise.resolve([options.sdk]):Promise.all(['app','auth','firestore'].map(n=>importer(base+'firebase-'+n+'.js'))),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('timeout')),options.timeout||8000);})]);sdk=Object.assign({},...modules);const app=sdk.initializeApp(root.GONOW_FIREBASE_CONFIG);auth=sdk.getAuth(app);db=sdk.getFirestore(app);sdk.onAuthStateChanged(auth,changed);return sdk;}catch(e){sdk=null;emit('unavailable');return null;}finally{clearTimeout(timeout);if(!sdk)pending=null;}})();return pending;}
 function groupIds(){if(!user)return [];const list=json('gonow:groups:'+user.uid,[]);const legacy=read('gonow:group:'+user.uid);if(legacy&&!list.includes(legacy))list.push(legacy);const left=json('gonow:left:'+user.uid,[]);return list.filter(id=>typeof id==='string'&&!left.includes(id));}
 function unwatchAll(){stops.forEach(stop=>{try{stop();}catch(e){}});stops.clear();groups.clear();}
 async function changed(next){if(disposed)return;user=next;saved=false;unwatchAll();if(stopTrips)stopTrips();baseline=new Map(local().map(t=>[t.id,JSON.stringify(t)]));remember('gonow:account-session',user?'yes':'');emit('auth',user);if(!user){setStatus('idle');return;}restoreProfile();
  const key='gonow:sync:'+user.uid;if(!['yes','no'].includes(read(key))&&local().length)emit('sync');
  groupIds().forEach(id=>watch(id));
  let first=true;stopTrips=sdk.onSnapshot(sdk.collection(db,'users',user.uid,'trips'),snap=>{const remote=snap.docs.map(d=>Object.assign({},d.data(),{id:d.id}));const t=tombs();let grew=false;remote.forEach(r=>{if(r.deleted&&!t[r.id]){t[r.id]=stamp(r.deletedAt)||Date.now();grew=true;}});if(grew)keep(TOMBS,t);const stale=remote.filter(r=>!r.deleted&&t[r.id]);
   // First snapshot after sign-in: local trips missing from (or newer than) the account copy are queued for upload.
   const ahead=first?local().filter(l=>!t[l.id]&&!remote.some(r=>r.id===l.id&&(r.deleted||stamp(r.updatedAt)>=stamp(l.updatedAt)))):[];first=false;
   if((stale.length||ahead.length)&&read('gonow:sync:'+user.uid)==='yes'){const dirty=json(dirtyKey(),{});ahead.forEach(l=>{dirty[l.id]=dirty[l.id]||1;});stale.forEach(r=>{dirty[r.id]='deleted';});keep(dirtyKey(),dirty);clearTimeout(timer);timer=setTimeout(flush,350);}emit('trips',merge(local(),remote,t));},()=>{});
  // Anything that failed to upload last time (offline, closed tab) is retried now.
  flush();
 }
 async function sync(yes){if(!user)return;saved=false;setStatus('saving');remember('gonow:sync:'+user.uid,yes?'yes':'no');if(yes){const dirty=json(dirtyKey(),{});local().forEach(t=>{dirty[t.id]=1;});keep(dirtyKey(),dirty);await flush();}baseline=new Map(local().map(t=>[t.id,JSON.stringify(t)]));saved=!!yes&&status==='saved';if(!yes)setStatus(groups.size?'saved':'idle');emit('synced');}
 function clean(trip){return JSON.parse(JSON.stringify(trip,(k,v)=>k==='group'?undefined:v));}
 // Firestore keeps offline writes pending instead of failing; past this the status says "Offline, will sync".
 const WRITE_WAIT=10000;
 function timed(p){let t;return Promise.race([p,new Promise((_,no)=>{t=setTimeout(()=>no(Object.assign(Error('offline'),{code:'unavailable'})),WRITE_WAIT);})]).finally(()=>clearTimeout(t));}
 async function upload(trip){if(!user||!sdk)return;const ref=sdk.doc(db,'users',user.uid,'trips',trip.id);
  // Never overwrite a tombstone left by another device.
  try{const cur=await timed(sdk.getDoc(ref));if(cur.exists()&&cur.data().deleted){const t=tombs();t[trip.id]=stamp(cur.data().deletedAt)||Date.now();keep(TOMBS,t);emit('trips',merge(local(),[Object.assign({},cur.data(),{id:trip.id})],t));return;}}catch(e){if(e&&e.code==='unavailable')throw e;}
  await timed(sdk.setDoc(ref,Object.assign({},clean(trip),{updatedAt:sdk.serverTimestamp()})));}
 async function bury(id){if(!user||!sdk)return;await timed(sdk.setDoc(sdk.doc(db,'users',user.uid,'trips',id),{id,deleted:true,deletedAt:sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp()}));}
 // Local changes are marked dirty and kept until the account copy confirms them; failures retry with backoff.
 function write(trips){clearTimeout(timer);saved=false;if(!user)return;const uid=user.uid;const syncing=read('gonow:sync:'+uid)==='yes';const owning=[...groups.values()].some(g=>g.ownerId===uid);if(!syncing&&!owning)return;
  if(syncing){const dirty=json(dirtyKey(),{});trips.filter(t=>baseline.get(t.id)!==JSON.stringify(t)).forEach(t=>{dirty[t.id]=1;});[...baseline.keys()].filter(id=>!trips.some(t=>t.id===id)).forEach(id=>{const t=tombs();if(!t[id]){t[id]=Date.now();keep(TOMBS,t);}dirty[id]='deleted';});keep(dirtyKey(),dirty);baseline=new Map(trips.map(t=>[t.id,JSON.stringify(t)]));}
  setStatus('saving');timer=setTimeout(()=>{if(user&&user.uid===uid)flush();},350);}
 // Deleting a trip: a tombstone everywhere (local + account), and members simply leave the group copy.
 function remove(tripId){const t=tombs();t[tripId]=Date.now();keep(TOMBS,t);if(!user)return;const g=[...groups.values()].find(g=>g.trip&&g.trip.id===tripId);if(g&&g.ownerId!==user.uid)leave(g.id);if(read('gonow:sync:'+user.uid)==='yes'){const dirty=json(dirtyKey(),{});dirty[tripId]='deleted';keep(dirtyKey(),dirty);baseline.delete(tripId);setStatus('saving');clearTimeout(timer);timer=setTimeout(flush,350);}}
 function leave(id){if(!user)return;const left=json('gonow:left:'+user.uid,[]);if(!left.includes(id)){left.push(id);keep('gonow:left:'+user.uid,left.slice(-50));}const stop=stops.get(id);if(stop)stop();stops.delete(id);groups.delete(id);keep('gonow:groups:'+user.uid,json('gonow:groups:'+user.uid,[]).filter(x=>x!==id));}
 function enqueue(op){if(!user)return;op.cid=op.cid||newCid();const box=json(outboxKey(),[]);if(!box.some(o=>o.cid===op.cid))box.push(op);keep(outboxKey(),box.slice(-200));setStatus('saving');return flush();}
 function opData(op){if(op.type==='vote')return {lastChange:{by:user.uid,itemId:op.itemId},['votes.'+op.itemId]:op.on?sdk.arrayUnion(user.uid):sdk.arrayRemove(user.uid)};
  if(op.type==='content')return {lastChange:{by:user.uid,itemId:op.itemId},['planContent.'+op.itemId]:op.change};
  if(op.type==='suggest')return {lastChange:{by:user.uid,itemId:user.uid+'_'+op.itemId},['suggestions.'+user.uid+'_'+op.itemId]:{by:user.uid,name:String(user.displayName||'Traveler').slice(0,40),itemId:op.itemId,change:op.change}};
  if(op.type==='lock')return {['locks.'+op.itemId]:op.value};
  if(op.type==='approve'){const data={['suggestions.'+op.id]:sdk.deleteField()};if(op.change)data['planContent.'+op.itemId]=op.change;return data;}return null;}
 const offlineError=e=>!e||e.code==='unavailable'||e.code==='deadline-exceeded'||/offline|network|unavailable/i.test(String(e.message||e));
 async function flush(){if(!user||!sdk)return;if(flushing)return flushing;clearTimeout(retryTimer);flushing=(async()=>{let failed=null;const uid=user.uid;
  if(root.navigator&&root.navigator.onLine===false){setStatus('offline');schedule();return;}
  // 1) Personal trips (account sync on).
  if(read('gonow:sync:'+uid)==='yes'){const dirty=json(dirtyKey(),{});for(const id of Object.keys(dirty)){try{if(dirty[id]==='deleted'||tombs()[id])await bury(id);else{const trip=local().find(t=>t.id===id);if(trip)await upload(trip);}const now=json(dirtyKey(),{});if(now[id]===dirty[id])delete now[id];keep(dirtyKey(),now);}catch(e){failed=failed||e;}}if(!failed)saved=true;}
  // 2) Shared copies of trips this user owns.
  try{await pushGroups(local());}catch(e){failed=failed||e;}
  // 3) Group changes (votes, edits, suggestions, approvals, locks), each sent once by its change id.
  for(const op of json(outboxKey(),[])){const g=groups.get(op.gid);if(!g&&stops.size){const box=json(outboxKey(),[]).filter(o=>o.cid!==op.cid);keep(outboxKey(),box);continue;}try{const data=opData(op);if(data)await timed(sdk.updateDoc(sdk.doc(db,'trips',op.gid),data));keep(outboxKey(),json(outboxKey(),[]).filter(o=>o.cid!==op.cid));}catch(e){if(!offlineError(e)){keep(outboxKey(),json(outboxKey(),[]).filter(o=>o.cid!==op.cid));emit('rejected',op);}failed=failed||e;}}
  if(failed){setStatus(offlineError(failed)?'offline':'failed');schedule();emit('sync-failed');}else{retryN=0;setStatus('saved');emit('saved');}})();try{await flushing;}finally{flushing=null;}}
 function schedule(){clearTimeout(retryTimer);const wait=[2000,5000,15000,30000,60000][Math.min(retryN++,4)];retryTimer=setTimeout(flush,wait);}
 if(root.addEventListener)root.addEventListener('online',()=>{if(user)flush();});
 function pendingCount(){return Object.keys(json(dirtyKey(),{})).length+json(outboxKey(),[]).length;}
 // The owner's device is the source of truth for each shared plan, whether or not account sync is on. Only the
 // shareable part is sent; deleted items stay deleted (tombstones are merged, never dropped); folded member changes
 // are recorded by id and cleared from the queue.
 async function pushGroups(trips){if(!user)return;for(const g of groups.values()){if(g.ownerId!==user.uid||!g.trip)continue;const trip=trips.find(t=>t.id===g.trip.id);if(!trip)continue;const next=shareable(trip);if(!next.builder&&g.trip.builder)next.builder=g.trip.builder;
   const t=Object.assign({},g.trip.tombstones||{},next.tombstones||{});if(Object.keys(t).length){next.tombstones=t;next.builder=dropDead(next.builder,t);}
   const applied=[...new Set([...(g.trip.appliedChanges||[]),...(next.appliedChanges||[])])].slice(-300);if(applied.length)next.appliedChanges=applied;
   const done=Object.entries(g.planContent||{}).filter(([,c])=>c&&c.cid&&applied.includes(c.cid)).map(([k])=>k).filter(k=>SAFE.test(k));
   if(JSON.stringify(next)===JSON.stringify(g.trip)&&!done.length)continue;
   const before=Object.values(g.trip.builder?.days||{}).flatMap(d=>d.items||[]);const after=Object.values(next.builder?.days||{}).flatMap(d=>d.items||[]);const added=after.find(i=>!before.some(b=>b.id===i.id));
   const data={trip:next};done.forEach(k=>{data['planContent.'+k]=sdk.deleteField();});if(added)data.lastChange={by:user.uid,text:(user.displayName||'Traveler')+' added '+added.title,at:Date.now()};
   await timed(sdk.updateDoc(sdk.doc(db,'trips',g.id),data));groups.set(g.id,Object.assign({},g,{trip:next}));}}
 async function google(){if(await load())return sdk.signInWithPopup(auth,new sdk.GoogleAuthProvider());}
 async function email(address){if(!await load())return false;await sdk.sendSignInLinkToEmail(auth,address,{url:root.location.href,handleCodeInApp:true});remember('gonow:email',address);return true;}
 async function completeEmail(address){if(!await load()||!sdk.isSignInWithEmailLink(auth,root.location.href))return false;address=address||read('gonow:email');if(!address){emit('email-needed');return false;}await sdk.signInWithEmailLink(auth,address,root.location.href);return true;}
 async function anonymous(name){if(!await load())throw Error('unavailable');const result=await sdk.signInAnonymously(auth);await sdk.updateProfile(result.user,{displayName:name});user=result.user;emit('auth',user);return user;}
 // The group of the trip that is open; with no trip open, the most recently active group.
 function active(){const tid=options.activeTrip&&options.activeTrip();if(tid){for(const g of groups.values())if(g.trip&&g.trip.id===tid)return g;return null;}return groups.get(lastGroupId)||null;}
 function current(){return active();}
 function latest(){return active()||groups.get(lastGroupId)||null;}
 function owner(g){g=g||current();return !!(g&&user&&g.ownerId===user.uid);}
 function watch(id,justJoined){if(!user)return;const list=json('gonow:groups:'+user.uid,[]);if(!list.includes(id)){list.push(id);keep('gonow:groups:'+user.uid,list.slice(-20));}keep('gonow:left:'+user.uid,json('gonow:left:'+user.uid,[]).filter(x=>x!==id));remember('gonow:group:'+user.uid,id);lastGroupId=id;if(stops.has(id))return;
  stops.set(id,sdk.onSnapshot(sdk.doc(db,'trips',id),snap=>{if(!snap.exists()){if(groups.has(id)){groups.delete(id);emit('ended',id);}return;}const previous=groups.get(id);const g=Object.assign({},snap.data(),{id});groups.set(id,g);emit('group',Object.assign({},g,{justJoined:!!(justJoined&&!previous)}));if(previous&&g.lastChange?.text&&g.lastChange.by!==user.uid&&JSON.stringify(previous.lastChange)!==JSON.stringify(g.lastChange))emit('notice',g.lastChange.text);},()=>{}));}
 const INVITE_DAYS=30,link=id=>root.location.origin+root.location.pathname+'#join='+id;
 function newInviteId(){const bytes=new Uint8Array(18);root.crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
 async function invite(trip){if(!user)return null;const key='gonow:invite:'+user.uid+':'+trip.id,savedInvite=read(key);
  if(savedInvite){const association=JSON.parse(savedInvite);watch(association.id);const g=groups.get(association.id);
   // Expired links are rotated in place: members stay, the old link stops working.
   if(g&&owner(g)&&Number(g.inviteExpiresAt)&&g.inviteExpiresAt<Date.now()){const inviteId=newInviteId(),old=g.inviteId;await sdk.setDoc(sdk.doc(db,'invites',inviteId),{tripId:g.id,ownerId:user.uid});await sdk.updateDoc(sdk.doc(db,'trips',g.id),{inviteId,inviteExpiresAt:Date.now()+INVITE_DAYS*DAY});if(old)await sdk.deleteDoc(sdk.doc(db,'invites',old)).catch(()=>{});remember(key,JSON.stringify({id:g.id,inviteId}));return link(inviteId);}
   return link(association.inviteId);}
  for(const g of groups.values())if(g.trip&&g.trip.id===trip.id)return link(g.inviteId);
  const inviteId=newInviteId();const id='group-'+inviteId;const name=String(user.displayName||'Traveler').slice(0,40);const locks={};[...Object.values(trip.builder?.days||{}),...(trip.plan?.days||[])].forEach(d=>(d.items||[]).forEach(i=>{if(i.locked||i.booked||i.fixedBooking)locks[i.id]=true;}));const data={ownerId:user.uid,ownerName:name,members:{[user.uid]:{name,joinedAt:Date.now()}},memberIds:[user.uid],inviteId,inviteExpiresAt:Date.now()+INVITE_DAYS*DAY,trip:shareable(trip),votes:{},locks,suggestions:{},createdAt:sdk.serverTimestamp()};await sdk.setDoc(sdk.doc(db,'trips',id),data);await sdk.setDoc(sdk.doc(db,'invites',inviteId),{tripId:id,ownerId:user.uid});remember(key,JSON.stringify({id,inviteId}));watch(id);return link(inviteId);}
 // Owner only: deletes the invite and the shared copy. Members lose access; local trips are untouched.
 async function stopSharing(tripId){if(!user||!sdk)return false;const key='gonow:invite:'+user.uid+':'+tripId,savedInvite=read(key);let association=null;try{association=JSON.parse(savedInvite);}catch(e){}if(!association){for(const g of groups.values())if(owner(g)&&g.trip&&g.trip.id===tripId)association={id:g.id,inviteId:g.inviteId};}if(!association)return false;const g=groups.get(association.id);if(g&&!owner(g))return false;try{storage.removeItem(key);}catch(e){}keep('gonow:groups:'+user.uid,json('gonow:groups:'+user.uid,[]).filter(x=>x!==association.id));if(read('gonow:group:'+user.uid)===association.id)try{storage.removeItem('gonow:group:'+user.uid);}catch(e){}const stop=stops.get(association.id);if(stop)stop();stops.delete(association.id);groups.delete(association.id);await sdk.deleteDoc(sdk.doc(db,'invites',association.inviteId)).catch(()=>{});await sdk.deleteDoc(sdk.doc(db,'trips',association.id));return true;}
 // Returns 'joined', 'already' (owner or returning member), or 'missing' (revoked/unknown link). Other groups stay.
 async function join(inviteId){if(!user)return false;const invite=await sdk.getDoc(sdk.doc(db,'invites',inviteId));if(!invite.exists())return 'missing';const id=invite.data().tripId;let already=false;try{const trip=await sdk.getDoc(sdk.doc(db,'trips',id));if(!trip.exists())return 'missing';already=(trip.data().memberIds||[]).includes(user.uid);}catch(e){/* Not a member yet: the rules hide the trip until the join write. */}
  if(!already)await sdk.updateDoc(sdk.doc(db,'trips',id),{['members.'+user.uid]:{name:String(user.displayName||'Traveler').slice(0,40),joinedAt:Date.now()},memberIds:sdk.arrayUnion(user.uid),joinInvite:inviteId});watch(id,true);return already?'already':'joined';}
 const SAFE=/^[A-Za-z0-9_-]{1,120}$/;
 async function vote(id){const g=current();if(!g||!user||!SAFE.test(String(id)))return;const old=g.votes?.[id]||[];const on=!old.includes(user.uid);
  // Optimistic: the badge updates at once; the write is queued and retried until it lands.
  g.votes=Object.assign({},g.votes,{[id]:on?[...old,user.uid]:old.filter(x=>x!==user.uid)});emit('group',g);await enqueue({type:'vote',gid:g.id,itemId:id,on});}
 function sort(picks){const g=current();return picks.map((p,i)=>({p,i})).sort((a,b)=>(g?.votes?.[b.p.id||b.p]?.length||0)-(g?.votes?.[a.p.id||a.p]?.length||0)||a.i-b.i).map(x=>x.p);}
 // Every change carries a unique id, so a retried or duplicated change applies exactly once on every device.
 async function change(itemId,change){const g=current();if(!g||!SAFE.test(String(itemId)))return false;change=Object.assign({},change);if(!CID.test(String(change.cid||'')))change.cid=newCid();
  if(!owner(g)&&g.locks?.[itemId]){await enqueue({type:'suggest',gid:g.id,itemId,change,cid:change.cid});emit('notice','Sent to '+g.ownerName+' for OK');return true;}
  g.planContent=Object.assign({},g.planContent,{[itemId]:change});
  // Already applied here (it is this device's own edit): never replay it when the snapshot echoes it back.
  const ak='gonow:applied:'+g.id,done=json(ak,[]);done.push(change.cid);keep(ak,done.slice(-500));await enqueue({type:'content',gid:g.id,itemId,change,cid:change.cid});return false;}
 async function approve(id,yes){const g=current();if(!owner(g))return;const s=g.suggestions?.[id];if(!s)return;
  // A malformed or oddly keyed suggestion can only be dismissed; FieldPath avoids dotted-path parsing.
  if(!SAFE.test(id)){if(sdk.FieldPath)await sdk.updateDoc(sdk.doc(db,'trips',g.id),new sdk.FieldPath('suggestions',id),sdk.deleteField());return;}
  const valid=yes&&s.change&&typeof s.change==='object'&&SAFE.test(String(s.itemId||''));const change=valid?Object.assign({},s.change,{cid:CID.test(String(s.change.cid||''))?s.change.cid:newCid()}):null;
  await enqueue({type:'approve',gid:g.id,id,itemId:s.itemId,change,cid:'ap'+(change?change.cid:newCid())});if(valid)emit('apply',{itemId:s.itemId,change,gid:g.id});}
 function lock(id,value){const g=current();if(!owner(g)||!SAFE.test(String(id)))return Promise.resolve();return enqueue({type:'lock',gid:g.id,itemId:id,value:!!value});}
 async function communityList(){if(!await load())return null;const snap=await sdk.getDocs(sdk.query(sdk.collection(db,'community'),sdk.orderBy('createdAt','desc'),sdk.limit(30)));return snap.docs.map(d=>Object.assign({},d.data(),{id:d.id}));}
 async function communityShare(post){if(!user||!sdk)throw Error('signin');const {id,...data}=post;if(!SAFE.test(String(id)))throw Error('id');await sdk.setDoc(sdk.doc(db,'community',id),Object.assign(data,{ownerId:user.uid,ownerName:String(data.ownerName||'Traveler').slice(0,40),createdAt:sdk.serverTimestamp()}));return id;}
 async function communityRemove(id){if(!user||!sdk)throw Error('signin');await sdk.deleteDoc(sdk.doc(db,'community',id));}
 // Shared per-city place-ID lists (Google ToS: only place IDs are kept long-term; details are fetched fresh).
 const CITY=/^[a-z0-9-]{1,80}$/,PLACE_ID=/^[\w-]{10,300}$/,CATS=['sights','restaurants','cafes','outdoors'];
 // Shared per-city place-ID lists (Google ToS: IDs only). Stored as "category:placeId" strings, append-only, max 32.
 const PLACE_CAP=32,ENTRY=/^(sights|restaurants|cafes|outdoors):([\w-]{10,300})$/;
 const entries=ids=>(Array.isArray(ids)?ids:[]).map(x=>typeof x==='string'&&ENTRY.exec(x)).filter(Boolean).map(m=>({id:m[2],cat:m[1]}));
 async function placeIds(slug){if(!sdk||!CITY.test(String(slug)))return null;const snap=await sdk.getDoc(sdk.doc(db,'placeLists',slug));if(!snap.exists())return null;const seen=new Set();return entries(snap.data().ids).filter(x=>!seen.has(x.id)&&seen.add(x.id));}
 // Signed-in (non-guest) accounts only. Appends new IDs after the existing ones (never drops any); skips when full or
 // nothing is new. A lost race or a rules denial is ignored: the shared list is only a speed-up.
 async function savePlaceIds(slug,city,ids){try{if(!user||user.isAnonymous||!sdk||!CITY.test(String(slug)))return false;
  const fresh=(ids||[]).filter(x=>x&&PLACE_ID.test(x.id)&&CATS.includes(x.cat)).map(x=>x.cat+':'+x.id);
  const ref=sdk.doc(db,'placeLists',slug),snap=await sdk.getDoc(ref),old=snap.exists()&&Array.isArray(snap.data().ids)?snap.data().ids.filter(x=>typeof x==='string'):null;
  const have=new Set((old||[]).map(x=>x.split(':')[1]));const add=[];fresh.forEach(x=>{const id=x.split(':')[1];if(!have.has(id)){have.add(id);add.push(x);}});
  const next=(old||[]).concat(add).slice(0,PLACE_CAP);
  if(old?next.length<=old.length:next.length<8)return false;
  await sdk.setDoc(ref,{city:old?snap.data().city:String(city||slug).slice(0,80),ids:next,by:user.uid,updatedAt:sdk.serverTimestamp()});return true;}catch(e){return false;}}
 async function report(targetId,reason){if(!user||!sdk)throw Error('signin');await sdk.addDoc(sdk.collection(db,'reports'),{targetId:String(targetId).slice(0,200),reason,by:user.uid,at:sdk.serverTimestamp()});return true;}
 async function saveProfile(p){if(!user||!sdk)throw Error('signin');if(p.displayName){await sdk.updateProfile(user,{displayName:p.displayName});emit('auth',user);}if(p.homeCity!==undefined)await sdk.setDoc(sdk.doc(db,'users',user.uid,'profile','main'),{homeCity:String(p.homeCity).slice(0,60),updatedAt:sdk.serverTimestamp()});}
 async function restoreProfile(){try{if(read('gonow:home-city'))return;const snap=await sdk.getDoc(sdk.doc(db,'users',user.uid,'profile','main'));const city=snap.exists()&&snap.data().homeCity;if(city)remember('gonow:home-city',String(city).slice(0,60));}catch(e){}}
 function storageSummary(home=false){return user&&read('gonow:sync:'+user.uid)==='yes'?(saved?'Saved to your account':'Saved on this device'):home&&!user?'Saved on this device. Sign in to sync.':'Saved on this device';}
 function groupList(){return [...groups.values()].map(g=>({id:g.id,tripId:g.trip&&g.trip.id,title:g.trip&&(g.trip.title||g.trip.destination),owner:owner(g),ownerName:g.ownerName,members:(g.memberIds||[]).length}));}
 return {placeIds,savePlaceIds,storageSummary,stopSharing,communityList,communityShare,communityRemove,report,saveProfile,get currentGroup(){return latest();},load,google,email,completeEmail,anonymous,sync,write,remove,leave,flush,pending:pendingCount,get status(){return status;},upload,invite,join,vote,sort,change,approve,lock,groups:groupList,groupFor:tripId=>{for(const g of groups.values())if(g.trip&&g.trip.id===tripId)return g;return null;},signOut:async()=>{if(sdk)await sdk.signOut(auth);},owner:()=>owner(),get user(){return user;},get group(){return current();},dispose(){disposed=true;clearTimeout(timer);clearTimeout(retryTimer);if(stopTrips)stopTrips();unwatchAll();}};
}
root.GoNowCloud={create,merge,shareable,dropDead,noteTombstones,builderItems,SDK_BASE};if(typeof module!=='undefined')module.exports=root.GoNowCloud;
})(typeof window==='undefined'?globalThis:window);
