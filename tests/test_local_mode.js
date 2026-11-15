const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const local=require('../js/local.js');
const context={window:{}};vm.runInNewContext(fs.readFileSync('js/catalog.js','utf8'),context);
const catalog=context.window.CATALOG;
const titles=new Set(Object.values(catalog.find(d=>d.id==='oahu').activities).flat().map(t=>t.replace(/near your stay/g,'nearby')));
const generic=new Set(['morning walk or run','healthy breakfast','park or trail time','midday rest and recovery','light dinner','wind-down']);
for(const city of ['Oahu','HONOLULU','Waikiki',"O'ahu",'Oʻahu']){
 for(const [length,n] of [['half',1],['full',1],['weekend',2]]){
  for(const level of ['gentle','active','athlete','unsure']){
   const answers={localCity:city,localLength:length,level,activities:['hiking']};
   const before=JSON.stringify(answers);
   const p=local.generate(answers,catalog);
   assert.equal(JSON.stringify(answers),before);assert.equal(p.days.length,n);assert.equal(p.comingSoon,false);
   for(const day of p.days)for(const b of day.blocks){assert(titles.has(b.title),b.title);assert.equal(b.source,'catalog');assert(/^(?:[1-9]|1[0-2]):[0-5]\d (?:AM|PM)$/.test(b.time),b.time);assert(b.note);assert(!/near your stay/.test(b.title));if(b.kind==='meal')assert(!/check access/.test(b.note));}
   assert(!/hotel|flight|cost|price|booking/i.test(JSON.stringify(p)));
  }
 }
}
for(const length of ['half','full','weekend']){
 const p=local.generate({localCity:'Austin',localLength:length},catalog);
 assert.equal(p.comingSoon,true);assert.equal(p.days.length,length==='weekend'?2:1);
 for(const day of p.days)for(const b of day.blocks){assert(/^(?:[1-9]|1[0-2]):[0-5]\d (?:AM|PM)$/.test(b.time),b.time);assert(generic.has(b.title));assert(!/[A-Z]/.test(b.title));}
 assert(!/hotel|flight|cost|price|booking/i.test(JSON.stringify(p)));
}
const plan=level=>local.generate({localCity:'Oahu',localLength:'full',level},catalog).days[0].blocks;
assert(plan('gentle').length<plan('active').length);assert(plan('active').length<plan('athlete').length);
assert(!plan('gentle').some(b=>/hike|snorkel/.test(b.title)));assert(plan('athlete').some(b=>/hike/.test(b.title)));
assert.equal(plan('unsure').length,plan('active').length);
const interested=activity=>local.generate({localCity:'Oahu',localLength:'half',activities:[activity]},catalog).days[0].blocks.map(b=>b.title);
assert.notDeepEqual(interested('hiking'),interested('walking'));
console.log('PASS local generator: catalog provenance, aliases, lengths, pace, interests, generic fallback, no travel costs');

const minutes=t=>(Number(t.split(':')[0])%12+(/PM$/.test(t)?12:0))*60;
for(const level of ['gentle','active','athlete']){const times=plan(level).map(b=>minutes(b.time));assert.deepEqual(times,times.slice().sort((a,b)=>a-b));}
assert(plan('active').some(b=>b.time==='12:00 PM'));
