// Rules to publish (firestore.rules): place-ID lists are append-only; Community and reports are closed to writes.
// Emulator only (project demo-gonow-rules); never run against production.
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,deleteDoc,updateDoc,addDoc,collection,query,orderBy,limit,serverTimestamp} from 'firebase/firestore';
import {readFile} from 'node:fs/promises';
import {test,after,beforeEach} from 'node:test';
const env=await initializeTestEnvironment({projectId:'demo-gonow-rules',firestore:{rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8'),host:'127.0.0.1',port:8080}});
after(()=>env.cleanup());
const as=(uid,provider='google.com')=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).firestore();
const anon=()=>env.unauthenticatedContext().firestore();
const ids=(n,from=0)=>Array.from({length:n},(_,i)=>['sights','restaurants','cafes','outdoors'][(i+from)%4]+':ChIJplace'+(i+from)+'xxxx');
const list=(uid,extra={})=>({city:'Seattle',ids:ids(10),by:uid,updatedAt:serverTimestamp(),...extra});
const seed=async(n=10)=>env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'placeLists/seattle'),{city:'Seattle',ids:ids(n),by:'alex',updatedAt:new Date()});});
beforeEach(async()=>{await env.clearFirestore();});
test('PL1 anyone reads a city list; signed-in account creates one',async()=>{
 await assertSucceeds(setDoc(doc(as('sam'),'placeLists/seattle'),list('sam')));
 await assertSucceeds(getDoc(doc(anon(),'placeLists/seattle')));
});
test('PL2 signed-out and anonymous (guest) users cannot write',async()=>{
 await assertFails(setDoc(doc(anon(),'placeLists/tokyo'),list('sam')));
 await assertFails(setDoc(doc(as('sam','anonymous'),'placeLists/tokyo'),list('sam')));
 await seed(); await assertFails(setDoc(doc(as('sam','anonymous'),'placeLists/seattle'),list('sam',{ids:[...ids(10),...ids(2,10)]})));
});
test('PL3 overwrite that drops or replaces existing IDs is denied',async()=>{
 await seed();
 await assertFails(setDoc(doc(as('sam'),'placeLists/seattle'),list('sam',{ids:ids(10,100)})),'replace all');
 await assertFails(setDoc(doc(as('sam'),'placeLists/seattle'),list('sam',{ids:[...ids(9),...ids(3,100)]})),'drop one, add three');
 await assertFails(setDoc(doc(as('sam'),'placeLists/seattle'),list('sam',{ids:ids(10)})),'no-op rewrite');
 await assertFails(setDoc(doc(as('sam'),'placeLists/seattle'),list('sam',{ids:ids(10).map(x=>'cafes:'+x.split(':')[1])})),'recategorize');
});
test('PL4 append is allowed (all existing kept, by = writer, server time)',async()=>{
 await seed();
 await assertSucceeds(setDoc(doc(as('sam'),'placeLists/seattle'),list('sam',{ids:[...ids(10),...ids(4,10)]})));
 await assertFails(setDoc(doc(as('sam'),'placeLists/seattle'),list('alex',{ids:[...ids(14),...ids(1,14)]})),'by must be the writer');
 await assertFails(setDoc(doc(as('sam'),'placeLists/seattle'),list('sam',{ids:[...ids(14),...ids(1,14)],updatedAt:new Date(0)})),'updatedAt must be request.time');
 await assertFails(setDoc(doc(as('sam'),'placeLists/seattle'),list('sam',{city:'Tacoma',ids:[...ids(14),...ids(1,14)]})),'city label fixed');
});
test('PL5 oversize and malformed entries are denied',async()=>{
 await assertFails(setDoc(doc(as('sam'),'placeLists/tokyo'),list('sam',{ids:ids(33)})),'create over 32');
 await assertFails(setDoc(doc(as('sam'),'placeLists/tokyo'),list('sam',{ids:ids(7)})),'create under 8');
 await seed(30); await assertFails(setDoc(doc(as('sam'),'placeLists/seattle'),list('sam',{ids:[...ids(30),...ids(3,30)]})),'append past 32');
 await assertSucceeds(setDoc(doc(as('sam'),'placeLists/seattle'),list('sam',{ids:[...ids(30),...ids(2,30)]})),'append up to 32');
 await assertFails(setDoc(doc(as('sam'),'placeLists/seattle'),list('sam',{ids:[...ids(32),...ids(1,32)]})),'full list stays full');
 const bad=v=>list('sam',{ids:[...ids(9),v]});
 for(const [why,v] of [['bad chars','sights:ChIJ bad/../id'],['too short','sights:abc'],['too long','sights:'+'x'.repeat(301)],['not a string',12345678901],['bad category','hotels:ChIJokokokok'],['extra text','sights:ChIJokokokok Space Needle'],['missing cat','ChIJokokokok'],['a map',{id:'ChIJokokokok',cat:'sights'}],['duplicate','sights:ChIJplace0xxxx']])
  await assertFails(setDoc(doc(as('sam'),'placeLists/tokyo'),bad(v)),why);
 await assertFails(setDoc(doc(as('sam'),'placeLists/tokyo'),list('sam',{photos:['x']})),'no other Google fields');
 await assertFails(setDoc(doc(as('sam'),'placeLists/Bad City'),list('sam')),'city id format');
 await assertSucceeds(setDoc(doc(as('sam'),'placeLists/tokyo'),bad('cafes:ChIJN1t_tDeuEmsRUsoyG83frY4')),'real-looking ID ok');
});
test('PL6 delete is denied for everyone',async()=>{
 await seed(); await assertFails(deleteDoc(doc(as('alex'),'placeLists/seattle'))); await assertFails(deleteDoc(doc(as('sam'),'placeLists/seattle')));
});
test('CL1 Community is closed to writes; the (empty) feed is readable',async()=>{
 await assertSucceeds(getDocs(query(collection(anon(),'community'),orderBy('createdAt','desc'),limit(30))));
 await assertFails(setDoc(doc(as('sam'),'community/t_sam_trip1'),{kind:'trip',ownerId:'sam',title:'x',createdAt:serverTimestamp()}));
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'community/t_sam_old'),{ownerId:'sam',title:'x'});});
 await assertFails(updateDoc(doc(as('sam'),'community/t_sam_old'),{title:'y'}));
 await assertFails(deleteDoc(doc(as('sam'),'community/t_sam_old')));
});
test('CL2 reports cannot be written or read',async()=>{
 await assertFails(addDoc(collection(as('sam'),'reports'),{targetId:'t',reason:'spam',by:'sam',at:serverTimestamp()}));
 await assertFails(getDocs(collection(as('sam'),'reports')));
});
test('CL3 profile and private trips unchanged',async()=>{
 await assertSucceeds(setDoc(doc(as('sam'),'users/sam/profile/main'),{homeCity:'New York'}));
 await assertFails(getDoc(doc(as('alex'),'users/sam/profile/main')));
 await assertSucceeds(setDoc(doc(as('sam','anonymous'),'users/sam/trips/a'),{x:1}));
});
