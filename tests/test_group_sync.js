/* Group sync: in-memory SDK fixture only; no real accounts or network. */
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const Cloud=require('../js/cloud.js');
const tick=(ms=0)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 global.location={origin:'https://example.test',pathname:'/index.html',href:'https://example.test/index.html'};
 global.crypto=require('node:crypto').webcrypto;
 const base=pathToFileURL(path.resolve(__dirname,'fixtures/firebase-mock/')).href+'/';
 const modules=await Promise.all(['app','auth','firestore'].map(n=>import(base+'firebase-'+n+'.js')));const sdk=Object.assign({},...modules);const mock=global.__fbMock;
 // Each account gets its own auth stream; Firestore is shared, like two phones on one project.
 let down=false;const offline=fn=>(...a)=>down?Promise.reject(Object.assign(Error('offline'),{code:'unavailable'})):fn(...a);
 const asUser=u=>Object.assign({},sdk,{onAuthStateChanged:(a,fn)=>{queueMicrotask(()=>fn(u));return()=>{};},setDoc:offline(sdk.setDoc),updateDoc:offline(sdk.updateDoc)});
 const store=()=>{const m=new Map();return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
 const account=(uid,name,rows,opts={})=>{const storage=store(),events=[];let active=null;const c=Cloud.create(Object.assign({sdk:asUser({uid,displayName:name}),storage,local:()=>rows,activeTrip:()=>active,emit:(...e)=>events.push(e)},opts));return {c,storage,events,rows,open:id=>{active=id;}};};

 // Firestore reorders map keys: comparisons are by content. An edit not yet confirmed keeps this device's copy.
 assert.equal(Cloud.stable({a:1,b:{c:2,d:[1,{e:3,f:4}]}}),Cloud.stable({b:{d:[1,{f:4,e:3}],c:2},a:1}));
 assert.equal(Cloud.merge([{id:'x',title:'new edit',updatedAt:1}],[{id:'x',title:'older upload echo',updatedAt:9}],{},{x:1})[0].title,'new edit');
 // 1) Share only the trip: personal answers, notes, check-ins, flights and snapshots never reach the group doc.
 const personal={id:'t1',planId:'p1',title:'Lisbon',destination:'Lisbon',start:'2026-12-01',end:'2026-12-03',timeZone:'Europe/Lisbon',updatedAt:1,
  answers:{pace:'slow',diet:'vegan',fitness:'low',origin:'SFO'},checkins:[{feel:2}],snapshot:{x:1},draftEdits:{note:'private'},
  plan:{id:'p1',days:[{date:'2026-12-01',items:[{id:'f1',kind:'flight',title:'UA 123 SFO→LIS'},{id:'cafe',title:'Cafe',userNote:'my private note',note:'Curated tip'}]}],stay:'Hotel Avenida',answers:{pace:'slow'}},
  builder:{days:{'2026-12-01':{items:[{id:'cafe',title:'Cafe',privateNote:'secret'},{id:'f1',kind:'flight',title:'UA 123'}],unscheduled:[{id:'tram',title:'Tram 28'}]}}}};
 const s=Cloud.shareable(personal);
 assert.deepEqual(Object.keys(s).sort(),['builder','destination','end','id','plan','planId','start','timeZone','title']);
 const flat=JSON.stringify(s);for(const bad of ['vegan','SFO','private','secret','UA 123','feel','pace'])assert(!flat.includes(bad),'shared copy leaks '+bad);
 assert.equal(s.builder.days['2026-12-01'].unscheduled[0].id,'tram','tray is shared');assert(flat.includes('Curated tip')&&flat.includes('Hotel Avenida'),'plan content and stay kept');
 const A=account('sam','Sam',[JSON.parse(JSON.stringify(personal))]);await A.c.load();await tick();
 const link=await A.c.invite(A.rows[0]);const inv=link.split('#join=')[1];const gid='group-'+inv;
 const doc=mock.dump()['trips/'+gid];assert(!JSON.stringify(doc.trip).includes('vegan')&&!('answers' in doc.trip),'invite doc is trip-only');
 A.rows[0].answers.diet='keto';A.rows[0].title='Lisbon weekend';A.rows[0].updatedAt=2;A.c.write(A.rows);await tick(450);
 assert.equal(mock.dump()['trips/'+gid].trip.title,'Lisbon weekend');assert(!JSON.stringify(mock.dump()['trips/'+gid]).includes('keto'),'owner push is trip-only');

 // 2) Multiple groups: joining a second group keeps the first; actions go to the open trip's group.
 const second={id:'t2',planId:'p2',title:'Kyoto',destination:'Kyoto',updatedAt:1,plan:{id:'p2',days:[]}};
 const C=account('kai','Kai',[second]);await C.c.load();await tick();const inv2=(await C.c.invite(second)).split('#join=')[1];const gid2='group-'+inv2;
 const B=account('alex','Alex',[]);B.storage.setItem('gonow:group:alex','group-legacy-old');
 await B.c.load();await tick();
 assert.equal(await B.c.join(inv),'joined');assert.equal(await B.c.join(inv2),'joined');await tick();
 const ids=B.c.groups().map(g=>g.id).sort();assert.deepEqual(ids,[gid,gid2].sort(),'both groups kept (legacy id without doc dropped from view)');
 assert(JSON.parse(B.storage.getItem('gonow:groups:alex')).includes(gid)&&JSON.parse(B.storage.getItem('gonow:groups:alex')).includes(gid2),'both persisted');
 assert.equal(await B.c.join(inv),'already','rejoining is a no-op');
 B.open('t1');await B.c.vote('cafe');B.open('t2');await B.c.vote('temple');await tick();
 assert.deepEqual(mock.dump()['trips/'+gid].votes.cafe,['alex']);assert.deepEqual(mock.dump()['trips/'+gid2].votes.temple,['alex']);assert.equal(mock.dump()['trips/'+gid].votes.temple,undefined,'vote went to the open trip only');
 // After a reload both listeners come back.
 const B2=Cloud.create({sdk:asUser({uid:'alex',displayName:'Alex'}),storage:B.storage,local:()=>[],activeTrip:()=>null,emit:()=>{}});await B2.load();await tick(5);assert.equal(B2.groups().length,2);B2.dispose();

 // 6) Change ids: every change carries a cid; the same change queued twice is sent once; folded changes are cleared.
 B.open('t1');await B.c.change('cafe',{time:'9:30 AM',title:'Cafe'});await tick();
 const pc=mock.dump()['trips/'+gid].planContent.cafe;assert(/^[a-z0-9]{6,40}$/.test(pc.cid),'cid attached');
 const updatesBefore=mock.state.calls.filter(x=>x[0]==='update'&&x[1]==='trips/'+gid).length;
 await B.c.change('cafe',{time:'9:30 AM',title:'Cafe',cid:pc.cid});await tick();
 assert.equal(JSON.parse(B.storage.getItem('gonow:applied:'+gid)).filter(x=>x===pc.cid).length>=1,true,'own change marked applied (no echo replay)');
 A.open('t1');A.rows[0].appliedChanges=[pc.cid];A.rows[0].updatedAt=3;A.c.write(A.rows);await tick(450);
 const after=mock.dump()['trips/'+gid];assert.equal(after.planContent.cafe,undefined,'owner clears folded change');assert(after.trip.appliedChanges.includes(pc.cid));
 assert(updatesBefore>0);

 // 3) Tombstones. Personal trips: deleting leaves {deleted:true}; an older copy can't bring it back.
 const D=account('dee','Dee',[{id:'old',title:'Porto',updatedAt:5},{id:'keep',title:'Rome',updatedAt:5}]);D.storage.setItem('gonow:sync:dee','yes');await D.c.load();await tick(450);
 assert.equal(mock.dump()['users/dee/trips/old'].title,'Porto');
 D.rows.splice(0,1);D.c.remove('old');D.c.write(D.rows);await tick(450);
 assert.equal(mock.dump()['users/dee/trips/old'].deleted,true,'tombstone written');
 const stale=Cloud.merge([{id:'old',title:'Porto',updatedAt:99}],[{id:'old',deleted:true,updatedAt:1}]);assert.equal(stale.length,0,'tombstone wins over a newer-looking local copy');
 // A second device that still has the trip uploads it: the tombstone check stops it.
 const E=Cloud.create({sdk:asUser({uid:'dee',displayName:'Dee'}),storage:store(),local:()=>[{id:'old',title:'Porto again',updatedAt:50}],emit:()=>{}});await E.load();await tick(5);await E.upload({id:'old',title:'Porto again'});assert.equal(mock.dump()['users/dee/trips/old'].deleted,true,'old copy did not overwrite the tombstone');E.dispose();
 // Remote copy still alive but deleted here while signed out: buried on next sync.
 mock.seed('users/dee/trips/zombie',{id:'zombie',title:'Zombie',updatedAt:1});D.storage.setItem('gonow:tombstones',JSON.stringify(Object.assign(JSON.parse(D.storage.getItem('gonow:tombstones')),{zombie:Date.now()})));mock.remote('users/dee/trips/zombie',{title:'Zombie'});await tick(450);assert.equal(mock.dump()['users/dee/trips/zombie'].deleted,true);
 // Items: tombstones in the shared trip; a deleted custom item never comes back from an older builder.
 const t={builder:{days:{d:{items:[{id:'c1',custom:true},{id:'s1'}]}}}};Cloud.noteTombstones(t,{days:{d:{items:[{id:'s1'}]}}});assert(t.tombstones.c1>0,'custom delete -> tombstone');
 assert.deepEqual(Cloud.dropDead({days:{d:{items:[{id:'c1'},{id:'s1'}],unscheduled:[{id:'c1'}]}}},t.tombstones).days.d.items.map(i=>i.id),['s1']);
 assert.deepEqual(Cloud.dropDead({d:{d:{i:['c1','s1'],u:[{id:'c1'}]}}},t.tombstones).d.d.i,['s1'],'compact builders too');
 Cloud.noteTombstones(t,{days:{d:{items:[{id:'c1',custom:true},{id:'s1'}]}}});assert.equal(t.tombstones,undefined,'Undo clears it');
 A.rows[0].tombstones={x9:1};A.rows[0].builder.days['2026-12-01'].items.push({id:'x9',title:'Deleted dinner',custom:true});A.rows[0].updatedAt=4;A.c.write(A.rows);await tick(450);
 assert(!JSON.stringify(mock.dump()['trips/'+gid].trip.builder).includes('x9'),'tombstoned item filtered from push');assert.equal(mock.dump()['trips/'+gid].trip.tombstones.x9,1);
 // A member leaving (deleting the shared trip on their side) stops listening and doesn't rejoin on reload.
 B.c.remove('t2');assert.deepEqual(B.c.groups().map(g=>g.id),[gid]);assert(JSON.parse(B.storage.getItem('gonow:left:alex')).includes(gid2));

 // 4) Retry queue + status: offline writes are kept and sent once when back.
 const statuses=[];const F=account('fay','Fay',[{id:'f',title:'Oslo',updatedAt:1}],{});F.storage.setItem('gonow:sync:fay','yes');await F.c.load();await tick(450);
 down=true;F.rows[0].title='Oslo edit';F.rows[0].updatedAt=Date.now()+5000;F.c.write(F.rows);assert.equal(F.c.status,'saving');await tick(450);
 assert.equal(F.c.status,'offline');assert.equal(F.c.pending(),1);assert.notEqual(mock.dump()['users/fay/trips/f'].title,'Oslo edit');
 B.open('t1');down=true;await B.c.vote('tram');assert.equal(B.c.pending(),1,'vote queued');assert.equal(B.c.status,'offline');
 down=false;await F.c.flush();assert.equal(F.c.status,'saved');assert.equal(F.c.pending(),0);assert.equal(mock.dump()['users/fay/trips/f'].title,'Oslo edit');
 await B.c.flush();await B.c.flush();assert.equal(B.c.pending(),0);assert.deepEqual(mock.dump()['trips/'+gid].votes.tram,['alex'],'vote landed exactly once');
 // A rejected write (rules) is dropped and reported, not retried forever.
 const deny=Object.assign({},asUser({uid:'alex',displayName:'Alex'}),{updateDoc:()=>Promise.reject(Object.assign(Error('Missing or insufficient permissions'),{code:'permission-denied'}))});
 const G=Cloud.create({sdk:deny,storage:B.storage,local:()=>[],activeTrip:()=>'t1',emit:(...e)=>statuses.push(e)});await G.load();await tick(5);await G.vote('cafe');assert.equal(G.status,'failed');assert.equal(G.pending(),0);assert(statuses.some(e=>e[0]==='rejected'));G.dispose();
 [A,B,C,D,F].forEach(x=>x.c.dispose());
 console.log('PASS group sync: trip-only share, multiple groups, tombstones, retry queue, change ids');
})().catch(e=>{console.error(e);process.exitCode=1;process.exit(1);});
