/* Offline regression coverage for the reviewed budget-fix paths. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ctx = {console,setTimeout,URLSearchParams,location:{search:'?fast=1'},matchMedia:()=>({matches:false})};
ctx.window=ctx;
vm.createContext(ctx);
for(const name of ['styles','catalog','oahu','engine','diet','ai','rings'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8'),ctx);
(async()=>{
 const answers={origin:'LA',destination:'Oahu',start:'2026-11-25',end:'2026-11-29',who:'couple',ages:[30,31],styles:['scenic','food'],stayUnsure:true,level:'athlete',pace:'Full-on',personal:true};
 const template=await ctx.AI.generatePlan({...answers,templateOahu:true},{fast:true});
 assert(template.id.startsWith('template-'));
 for(const day of template.days){
  const titles=day.items.map(i=>i.title.toLowerCase());
  assert.equal(new Set(titles).size,titles.length);
  const breakfast=day.items.filter(i=>/breakfast/i.test(i.title));
  assert(breakfast.length<=1);
  assert(breakfast.every(i=>/^([1-9]|10):\d\d AM$|^11:00 AM$/.test(i.time)));
 }
 assert(template.meta.includes('Couple'));
 console.log('PASS personalized Oahu retains unique meals, morning breakfast and capitalized group');
 const demo=await ctx.AI.generatePlan(answers,{fast:true,demo:true});
 assert.equal(demo.id,'oahu-demo-2026-11');
 assert(demo.curatedMismatch);
 console.log('PASS explicit demo remains curated and flags mismatched answers');
 const forkNo={...answers,includeFlights:false,personal:false,mustdos:'',stay:''};
 for(const options of [{}, {demo:true}]){
  const curated=await ctx.AI.generatePlan(forkNo,{fast:true,...options});
  assert.equal(curated.id,'oahu-demo-2026-11');
  assert(curated.curatedMismatch);
  const titles=curated.days.flatMap(day=>day.items).map(item=>item.title).join(' ');
  assert(titles.includes('Diamond Head') && titles.includes('Kualoa'));
 }
 assert((await ctx.AI.generatePlan({...forkNo,templateOahu:true},{fast:true})).id.startsWith('template-'));
 console.log('PASS fork-no Oahu without flights retains researched stops unless template explicitly requested');
 assert.equal(ctx.GoNowRings.summary({sleep:8,move:90,rec:30}),'Sleep 8h00 · Move 90 min · Recover 30 min');
 assert.equal(ctx.GoNowRings.summary({sleep:7+5/60,move:60,rec:20}),'Sleep 7h05 · Move 60 min · Recover 20 min');
 console.log('PASS shared dashboard/day ring formatting pads minutes');
})().catch(e=>{console.error(e);process.exitCode=1;});
