const assert=require('assert'),fs=require('fs'),vm=require('vm');
const ctx={window:{},console,URLSearchParams,location:{search:'?fast=1'},setTimeout,matchMedia:()=>({matches:false})};
vm.createContext(ctx);
for(const file of ['styles','catalog','oahu','engine','ai']){
 vm.runInContext(fs.readFileSync(`${__dirname}/../js/${file}.js`,'utf8'),ctx);Object.assign(ctx,ctx.window);
}
const plain=x=>JSON.parse(JSON.stringify(x));
const expected=[
 ['hotel','Staying at the hotel','Pool, spa, great food on site'],
 ['wandering','Wandering around','Neighborhoods, markets, no fixed plan'],
 ['scenic','Scenic spots','Views, viewpoints, photo stops'],
 ['food','Food & cafés','Local favorites, healthy cafés'],
 ['culture','Culture & history','Museums, temples, local stories'],
 ['nature','Nature & beaches','Parks, gardens, shorelines']
];
assert.deepStrictEqual(plain(ctx.GONOW_STYLES),expected);
for(const [input,output] of [
 [['relaxing','scenic'],['scenic']],[['adventure','nature'],['nature']],
 [['relaxing','adventure'],['nature']],[['adventure','scenic','food'],['nature','scenic']],
 [['unknown','food','culture'],['food','culture']],[null,[]],[['hotel','hotel'],['hotel']]
])assert.deepStrictEqual(plain(ctx.GoNowStyles.normalize(input)),output);
const keys=expected.map(x=>x[0]);
for(const d of ctx.CATALOG){
 assert.deepStrictEqual(Object.keys(d.styles).sort(),keys.slice().sort());
 assert.deepStrictEqual(Object.keys(d.activities).sort(),keys.slice().sort());
 for(const style of keys){
  // Throw if generation tries to read a legacy key, including computed properties.
  const activities=new Proxy(d.activities,{get(target,key){assert(!['relaxing','adventure'].includes(key));return target[key];}});
  const plan=ctx.Engine.buildTemplatePlan({styles:[style],flexible:true,length:4,month:6,pace:'Moderate'}, {...d,activities});
  assert(plan.days[1].items.some(it=>d.activities[style].includes(it.title)),`${d.id}/${style}`);
 }
}
for(const file of ['engine','ai','app']){
 const source=fs.readFileSync(`${__dirname}/../js/${file}.js`,'utf8');
 assert(!/(['"])(?:relaxing|adventure)\1|\.activities\.(?:relaxing|adventure)\b/.test(source),file);
}
(async()=>{
 const base={destination:'Oahu',origin:'Los Angeles (LAX)',start:'2026-11-25',end:'2026-11-29',who:'couple',stay:'The Kahala Hotel & Resort',pace:'Moderate',budget:6000,mustdos:'Diamond Head, Kualoa Ranch, intro dive, parasailing, birthday dinner 11/26 7:30 PM, Black Friday shopping',ages:[18,19],personal:true};
 for(const styles of [['hotel','scenic'],['scenic'],['relaxing','scenic']])assert.equal((await ctx.AI.generatePlan({...base,styles})).curatedMismatch,false);
 assert.equal((await ctx.AI.generatePlan({...base,styles:['food','culture']})).curatedMismatch,true);
 const adult=await ctx.AI.generatePlan({...base,styles:['scenic'],ages:[30,31],stay:'My hotel',templateOahu:true});
 assert.notEqual(adult.id,'oahu-demo-2026-11');assert(adult.meta.includes('30 & 31'));assert(!adult.meta.includes('18 & 19'));assert(adult.stay.includes('My hotel'));assert(!(adult.ageRules||[]).some(t=>/under 21|18 & 19/.test(t)));
 assert.equal(ctx.Engine.recommend({...base,styles:['relaxing','adventure']}).length,11);
 console.log('PASS styles: exact options, migration, all destinations/interests, legacy-read guards and demo matcher');
})().catch(e=>{console.error(e);process.exitCode=1;});
