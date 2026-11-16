const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{},console,Date,Set,Map,localStorage:{getItem(){return null;}},document:{}};ctx.window=ctx;vm.createContext(ctx);
for(const f of ['oahu','daybuilder','pickcatalog','pickscheduler'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),ctx);
const estimate=ctx.DayBuilder.estimateTravel,origin={lat:21,lng:-158};
const point=km=>({lat:21+km/111,lng:-158});
assert(Math.abs(estimate(origin,point(1)).roadKm-1.4)<1e-8);
assert.equal(estimate(origin,point(0.6)).minutes,10);
assert(estimate(origin,point(0.6)).label.startsWith('Uber'));
assert(estimate(origin,point(0.5)).label.startsWith('Walk'));
assert.equal(estimate(origin,origin).minutes,5);
assert(estimate(origin,point(2),'Drive').label.startsWith('Drive'));
for(let km=0;km<60;km+=0.13)assert.equal(estimate(origin,point(km)).minutes%5,0);
const c=ctx.GONOW_PICKS.oahu,leonards=c.restaurants.find(i=>i.id==='leonards'),helenas=c.restaurants.find(i=>i.id==='helenas');
assert(estimate(leonards,helenas).minutes>=15);
const a={start:'2026-11-25',end:'2026-11-29',level:'active',ages:[30,30],picks:{activities:['diamond-head','waimea','laniakea'],restaurants:c.restaurants.map(i=>i.id)}};
const plan=ctx.PickScheduler.schedule(a,c);
for(const day of plan.days){const picks=day.items.filter(i=>i.pick);for(let n=1;n<picks.length;n++){
 const prev=picks[n-1],next=picks[n];assert(next.start>=prev.start+prev.duration+estimate(prev.pick,next.pick).minutes,day.date+' '+prev.id+' → '+next.id);
}}
console.log('PASS road factor, mode, minimum, walking threshold, rounding, bakery route and scheduler travel buffers');
