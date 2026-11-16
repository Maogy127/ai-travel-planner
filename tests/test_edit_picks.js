const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{},console,Date,Set,Map,localStorage:{getItem(){return null;}},document:{}};ctx.window=ctx;vm.createContext(ctx);
for(const f of ['oahu','daybuilder','pickcatalog','pickscheduler'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),ctx);
const c=ctx.GONOW_PICKS.oahu,a={start:'2026-11-25',end:'2026-11-29',ages:[18,19],level:'active',picks:{activities:['kahala','bishop-museum','pearl-harbor'],restaurants:['lamer','senia']}};
const original=ctx.PickScheduler.schedule(a,c),p={...original,start:a.start,end:a.end},raw={days:{}};
for(const d of p.days)raw.days[d.date]={items:d.items.map(i=>ctx.DayBuilder.convert(i))};
const find=(days,id)=>Object.entries(days).flatMap(([date,d])=>d.items.map(i=>({date,...i}))).find(i=>(i.sourceId||i.id)===id);
find(raw.days,'kahala');for(const d of Object.values(raw.days))for(const i of d.items){if(i.sourceId==='kahala')i.locked=true;if(i.sourceId==='bishop-museum'){i.manualTime=true;i.preferred+=15;}}
const picks={activities:['bishop-museum','laniakea','waimea'],restaurants:['lamer','senia']};
const r=ctx.PickScheduler.update(p,raw,picks,a,c),days=Object.fromEntries(r.days.map(d=>[d.date,d]));
for(const id of ['kahala','bishop-museum','lamer','senia']){const before=find(raw.days,id),after=find(days,id);assert(after,id);assert.equal(after.date,before.date);assert.equal(after.start,before.preferred);}
assert(!find(days,'pearl-harbor'));for(const id of ['laniakea','waimea'])assert(find(days,id),id);assert.equal(r.unfit.length,0);
assert.equal(JSON.stringify(r),JSON.stringify(ctx.PickScheduler.update(p,raw,picks,a,c)));
const keep=ctx.PickScheduler.update(p,raw,{...a.picks,activities:a.picks.activities.concat('laniakea')},a,c);
assert.equal(find(Object.fromEntries(keep.days.map(d=>[d.date,d])),'pearl-harbor').start,find(raw.days,'pearl-harbor').preferred);
console.log('PASS incremental picks: locks, manual times, removal, additions, stable free slots, deterministic');
