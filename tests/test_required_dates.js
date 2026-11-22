const assert=require('assert'),fs=require('fs'),vm=require('vm');
const ctx={window:{},console,URLSearchParams,location:{search:'?fast=1'},setTimeout,matchMedia:()=>({matches:false})};
vm.createContext(ctx);
for(const file of ['styles','catalog','oahu','engine','ai']){
  vm.runInContext(fs.readFileSync(`${__dirname}/../js/${file}.js`,'utf8'),ctx);Object.assign(ctx,ctx.window);
}
const E=ctx.Engine;
const base={origin:'Los Angeles (LAX)',destination:'Oahu',start:'2027-03-01',end:'2027-03-05',includeFlights:true,budget:3000,pace:'Moderate'};

const chosen=E.planMeta('2027-03-01','2027-03-05',5,{who:'couple',ages:[30,31]});
assert.match(chosen,/Mar 1–5, 2027 · 5 days · Couple · Ages 30 & 31/);

const skippedWho=E.planMeta('2027-03-01','2027-03-05',5,{whoSkipped:true,who:'couple',ages:[25,25],agesSkipped:true});
assert.equal(skippedWho,'Mar 1–5, 2027 · 5 days');
assert(!/Couple|Ages|25/.test(skippedWho));

const skippedAges=E.planMeta('2027-03-01','2027-03-05',5,{who:'couple',ages:[25,25],agesSkipped:true});
assert.equal(skippedAges,'Mar 1–5, 2027 · 5 days · Couple');
assert(!/Ages|25/.test(skippedAges));

const empty=E.planMeta('2027-03-01','2027-03-05',5,{who:'',ages:[]});
assert.equal(empty,'Mar 1–5, 2027 · 5 days');

assert.equal(E.partyCount({whoSkipped:true,agesSkipped:true,ages:[],adults:2,kids:0}),2);
assert.equal(E.partyCount({who:'solo',ages:[40]}),1);
assert.deepEqual(E.knownAges({ages:[25,25],agesSkipped:true}),[]);
assert.equal(E.knownWho({who:'couple',whoSkipped:true}),'');

const invented=E.applyAgeRules(JSON.parse(JSON.stringify(ctx.OAHU_SAMPLE)),{...base,who:'couple',ages:[10,25],agesSkipped:true});
assert.deepEqual(invented.ageRules,[]);
assert(!invented.ageRules.some(t=>/kids|21|surcharge/.test(t)));

const knownKids=E.applyAgeRules(JSON.parse(JSON.stringify(ctx.OAHU_SAMPLE)),{...base,who:'family',ages:[40,10]});
assert(knownKids.ageRules.some(t=>t.includes('Traveling with kids')));

const plan=E.buildTemplatePlan({...base,whoSkipped:true,who:'',agesSkipped:true,ages:[],styles:[],styleSkipped:true},E.matchDestination('Oahu'));
assert.equal(plan.meta,'Mar 1–5, 2027 · 5 days');
assert(!/Couple|Ages|25 & 25|Travelers/.test(plan.meta));
assert.equal(plan.days.length,5);
assert(plan.days.some(d=>d.items.some(i=>i.kind==='activity'||i.title)),'internal mix still fills days');

const rec=E.recommend({...base,styles:[],styleSkipped:true})[0];
const why=rec.whyFits.join(' ');
assert(!/Scenic viewpoints|Neighborhood walks|Comfortable hotel stays/.test(why),'recommendations do not claim skipped styles');
assert(rec.whyFits.length>=1);

const chosenRec=E.recommend({...base,styles:['scenic'],styleSkipped:false})[0];
assert(/Scenic viewpoints/.test(chosenRec.whyFits.join(' ')));

assert.deepEqual(ctx.GoNowStyles.normalize([]),[]);
assert.deepEqual(ctx.GoNowStyles.normalize(['scenic','wandering']),['scenic','wandering']);

console.log('PASS required dates: no invented date/who/age/style claims, Skip-safe summaries, internal mix still plans');
