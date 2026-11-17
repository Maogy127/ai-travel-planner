// Supervisor only: npm package + Firestore emulator required; never run against production.
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,arrayUnion,getDocs,collection} from 'firebase/firestore';
import {readFile} from 'node:fs/promises';
import {test,after,beforeEach} from 'node:test';
const env=await initializeTestEnvironment({projectId:'demo-gonow-rules',firestore:{rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8'),host:'127.0.0.1',port:8080}});
after(()=>env.cleanup());
const databases=new Map();
const db=id=>{if(!databases.has(id))databases.set(id,env.authenticatedContext(id).firestore());return databases.get(id);};
const trip={ownerId:'owner',ownerName:'Sam',members:{owner:{name:'Sam'},member:{name:'Alex'}},memberIds:['owner','member'],inviteId:'secret-invite',votes:{},suggestions:{},locks:{meal:true},trip:{id:'one'}};
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async ctx=>{const adminDb=ctx.firestore();await setDoc(doc(adminDb,'trips/one'),trip);await setDoc(doc(adminDb,'invites/secret-invite'),{tripId:'one',ownerId:'owner'});});});
test('private trips belong to the account',async()=>{await assertSucceeds(setDoc(doc(db('owner'),'users/owner/trips/x'),{}));await assertFails(getDoc(doc(db('member'),'users/owner/trips/x')));await assertFails(setDoc(doc(db('member'),'users/owner/trips/x'),{}));});
test('create requires self as owner and sole member',async()=>{await assertSucceeds(setDoc(doc(db('owner'),'trips/group-secret-invite'),{...trip,memberIds:['owner'],members:{owner:{name:'Sam'}}}));await assertFails(setDoc(doc(db('member'),'trips/forged'),{...trip,memberIds:['owner'],members:{owner:{}}}));});
test('only members read',async()=>{await assertSucceeds(getDoc(doc(db('member'),'trips/one')));await assertFails(getDoc(doc(db('stranger'),'trips/one')));});
test('members vote but cannot change membership, locks or owner',async()=>{await assertSucceeds(updateDoc(doc(db('member'),'trips/one'),{'votes.meal':['member'],lastChange:{by:'member',itemId:'meal'}}));for(const patch of [{members:{member:{}}},{memberIds:['member']},{locks:{}},{ownerId:'member'},{inviteId:'fake'}])await assertFails(updateDoc(doc(db('member'),'trips/one'),patch));});
const join=(who,invite='secret-invite',extra={})=>updateDoc(doc(db(who),'trips/one'),{['members.'+who]:{name:who},memberIds:arrayUnion(who),joinInvite:invite,...extra});
test('invite holder may add exactly self',async()=>{await assertSucceeds(join('new'));await assertSucceeds(getDoc(doc(db('new'),'trips/one')));});
test('wrong invite cannot join',async()=>{await assertFails(join('new','wrong'));});
test('cannot add another person or alter an existing member while joining',async()=>{await assertFails(join('new','secret-invite',{'members.other':{name:'Other'},memberIds:arrayUnion('new','other')}));await assertFails(join('new','secret-invite',{'members.owner':{name:'forged'}}));});
test('only owner deletes or changes owner fields',async()=>{await assertFails(deleteDoc(doc(db('member'),'trips/one')));await assertFails(updateDoc(doc(db('owner'),'trips/one'),{ownerId:'member'}));await assertSucceeds(deleteDoc(doc(db('owner'),'trips/one')));});
test('signed in including anonymous-auth users can resolve invites',async()=>{await assertSucceeds(getDoc(doc(db('new'),'invites/secret-invite')));await assertSucceeds(getDoc(doc(env.authenticatedContext('anon',{firebase:{sign_in_provider:'anonymous'}}).firestore(),'invites/secret-invite')));await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'invites/secret-invite')));});
test('invite writes require the actual trip owner',async()=>{await assertSucceeds(setDoc(doc(db('owner'),'invites/new'),{tripId:'one',ownerId:'owner'}));await assertFails(setDoc(doc(db('member'),'invites/forged'),{tripId:'one',ownerId:'member'}));await assertFails(updateDoc(doc(db('member'),'invites/secret-invite'),{tripId:'other'}));});

test('invite discovery and retargeting are forbidden',async()=>{
 await assertFails(getDocs(collection(db('member'),'invites')));
 await assertFails(updateDoc(doc(db('owner'),'invites/secret-invite'),{ownerId:'member'}));
 await assertFails(updateDoc(doc(db('owner'),'invites/secret-invite'),{tripId:'missing'}));
});
test('members cannot bypass locks or impersonate collaborators',async()=>{
 const ref=doc(db('member'),'trips/one');
 await assertSucceeds(updateDoc(ref,{'suggestions.member_meal':{by:'member',name:'Alex',itemId:'meal',change:{time:'7:00 PM'}},lastChange:{by:'member',itemId:'member_meal'}}));
 for(const patch of [{trip:{id:'one',time:'forged'}},{'planContent.meal':{time:'7:00 PM'}},{'votes.meal':['owner']},{'suggestions.owner_meal':{by:'owner',itemId:'meal',change:{time:'7:00 PM'}}}])await assertFails(updateDoc(ref,{...patch,lastChange:{by:'member',itemId:'meal'}}));
 await assertSucceeds(updateDoc(doc(db('owner'),'trips/one'),{'suggestions.owner_meal':{by:'owner',itemId:'meal',change:{time:'7:00 PM'}}}));
 await assertFails(updateDoc(ref,{suggestions:{},lastChange:{by:'member',itemId:'owner_meal'}}));
 await assertFails(updateDoc(ref,{'suggestions.owner_meal':{by:'member',itemId:'meal',change:{time:'8:00 PM'}},lastChange:{by:'member',itemId:'owner_meal'}}));
 await assertSucceeds(updateDoc(ref,{'planContent.walk':{time:'7:00 PM'},lastChange:{by:'member',itemId:'walk'}}));
 await assertFails(updateDoc(ref,{'planContent.walk':{time:'8:00 PM'},'planContent.other':{time:'9:00 PM'},lastChange:{by:'member',itemId:'walk'}}));
 await assertSucceeds(updateDoc(doc(db('owner'),'trips/one'),{'planContent.meal':{time:'7:00 PM'}}));
});
