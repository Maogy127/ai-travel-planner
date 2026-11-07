const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{},URLSearchParams,location:{search:'?fast=1'},setTimeout,Promise,matchMedia:()=>({matches:false})};vm.createContext(ctx);
const jsRoot=fs.existsSync(__dirname+'/../site/js/oahu.js')?__dirname+'/../site/js/':__dirname+'/../js/';
for(const f of ['catalog','oahu','engine','ai']){vm.runInContext(fs.readFileSync(jsRoot+f+'.js','utf8'),ctx);Object.assign(ctx,ctx.window);}
const {Engine:E,CATALOG:C,OAHU_SAMPLE:O,AI}=ctx.window;
const a={origin:'Los Angeles (LAX)',destination:'Oahu',start:'2026-11-25',end:'2026-11-29',who:'couple',ages:[18,19],styles:['relaxing','scenic'],includeFlights:true,budget:3000};
assert.equal(C.length,11);for(const d of C){assert.equal(d.climate.length,12);assert.equal(E.matchDestination(d.name).id,d.id);assert.equal(Object.keys(d.flights).length,7);}
assert.equal(E.originRegion(a),'usWest');assert.equal(E.originRegion({origin:'Unknown village'}),'other');assert.equal(E.matchDestination('Waikiki').id,'oahu');assert.equal(E.matchDestination('Paris').id,'custom');
const r=E.recommend(a);assert.equal(r.length,11);assert(r[0].score>=r[1].score);assert(r.every(d=>d.total===Object.values(d.breakdown).reduce((a,b)=>a+b,0)));
for(const pace of ['Easy','Moderate','Full-on']){const p=E.buildTemplatePlan({...a,destination:'Kyoto',pace,mustdos:'Birthday dinner, Photo walk'},E.matchDestination('Kyoto'));assert.equal(p.days.length,5);assert(p.days.flatMap(d=>d.items).filter(i=>i.requested).length===2);assert(p.days[0].items.some(i=>i.kind==='stay'));assert.equal(p.days[4].items.length,1);E.applyAgeRules(p,a);assert(p.days.every(d=>d.car.level==='No rental car'));const ids=new Set(p.packing.flatMap(g=>g.items).map(i=>i.id));assert(p.days.flatMap(d=>d.items).every(i=>i.bring.every(id=>ids.has(id))));}
assert.equal(E.tripDays({...a,end:'2026-12-29'}),10);const ids=new Set(O.packing.flatMap(g=>g.items).map(i=>i.id));assert(O.days.flatMap(d=>d.items).every(i=>i.bring.every(id=>ids.has(id))));assert(!ids.has('license'));assert(O.tips.every(t=>t.url&&t.sourceType));assert.equal(O.days.length,5);
const young=E.applyAgeRules(JSON.parse(JSON.stringify(O)),{...a,ages:[23,24]});assert(young.ageRules[0].includes('surcharge'));
AI.generatePlan(a).then(p=>{assert.equal(p.id,'oahu-demo-2026-11');assert(p.ageRules.length>=2);assert(p.days.every(d=>d.car.level==='No rental car'));assert.notEqual(p,O);console.log('PASS: catalog, aliases, recommendations, budget arithmetic, template pace, requests, day cap, age rules, packing references and AI routing.');});
