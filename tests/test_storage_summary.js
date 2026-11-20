/* Save-state copy: in-memory SDK fixture only; no real accounts or network. */
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const Cloud=require('../js/cloud.js');
(async()=>{
 global.location={origin:'https://example.test',pathname:'/index.html',href:'https://example.test/index.html'};
 global.crypto=require('node:crypto').webcrypto;
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const guest=Cloud.create({storage,importer:()=>Promise.reject(Error('blocked'))});
 assert.equal(guest.storageSummary(true),'Saved on this device. Sign in to sync.');
 assert.equal(guest.storageSummary(),'Saved on this device');
 const base=pathToFileURL(path.resolve(__dirname,'fixtures/firebase-mock/')).href+'/';
 const modules=await Promise.all(['app','auth','firestore'].map(n=>import(base+'firebase-'+n+'.js')));
 const sdk=Object.assign({},...modules);
 const rows=[{id:'one',updatedAt:1,title:'Local'}];
 const c=Cloud.create({sdk,storage,local:()=>rows});await c.load();await c.google();
 assert.equal(c.storageSummary(),'Saved on this device','before consent');
 await c.sync(false);assert.equal(c.storageSummary(),'Saved on this device','Not now stays local');
 await c.sync(true);assert.equal(c.storageSummary(),'Saved to your account','after successful upload');
 // A failed upload must never claim the account copy is current.
 const failing=Object.assign({},sdk,{setDoc:()=>Promise.reject(Error('offline'))});
 const values2=new Map(),storage2={getItem:k=>values2.get(k),setItem:(k,v)=>values2.set(k,v)};
 const f=Cloud.create({sdk:failing,storage:storage2,local:()=>rows});await f.load();await f.google();
 await assert.rejects(f.sync(true));assert.equal(f.storageSummary(),'Saved on this device','failed upload');
 rows[0].title='Edited';f.write(rows);await new Promise(r=>setTimeout(r,400));assert.equal(f.storageSummary(),'Saved on this device','failed write');
 c.dispose();f.dispose();guest.dispose();
 console.log('PASS storage summary guest, Not now, uploaded and failed states');
})().catch(e=>{console.error(e);process.exitCode=1;});
