const assert=require('assert');
const Q=require('../tools/prewarm-cities.cjs');

assert(Q.isBareOrGenericName({name:'Museum'}));
assert(Q.isBareOrGenericName({name:'the park'}));
assert(Q.isBareOrGenericName({name:'Q16900567'}));
assert(Q.isBareOrGenericName({name:'Conservation Resource Centre'}));
assert(Q.isBareOrGenericName({name:'Green Education and Resources Centre'}));
assert(Q.isBareOrGenericName({name:'Hong Kong Housing Authority Exhibition Centre'}));
assert(!Q.isBareOrGenericName({name:'Hong Kong Museum of History',wikipedia:'en:Hong Kong Museum of History'}));
assert(!Q.isBareOrGenericName({name:'National Gallery',wikipedia:'en:National Gallery'}));
assert(!Q.isBareOrGenericName({name:'British Museum'}));

assert(!Q.keepWellness({type:'fitness',name:'YN Fitness'}));
assert(!Q.keepWellness({type:'fitness',name:'Anytime Fitness'}));
assert(!Q.keepWellness({type:'fitness',name:'Virgin Active'}));
assert(Q.keepWellness({type:'fitness',name:'JustPilates'}));
assert(Q.keepWellness({type:'fitness',name:'Espai de meditació'}));
assert(Q.keepWellness({type:'spa',name:'Covent Garden Health Spa'}));
assert(Q.keepWellness({type:'hotspring',name:'Onsen Tamago'}));
assert(!Q.keepWellness({type:'sauna',name:'Sauna'}));

assert(Q.isDefunct({name:'Leverian collection'}));
assert(Q.isDefunct({name:'Amora London'}));
assert(Q.isDefunct({name:'The Museum of Practical Geology'}));
assert(!Q.isDefunct({name:'Wellcome Collection'}));
assert(!Q.isDefunct({name:'National Gallery'}));

const gyms=Q.qualityFilter([
  {name:'Anytime Fitness',type:'fitness',lat:1,lng:1},
  {name:'Yoga House',type:'fitness',lat:1,lng:1},
  {name:'Onsen A',type:'hotspring',lat:1,lng:1}
],'wellness');
assert.deepEqual(gyms.map(p=>p.name),['Yoga House','Onsen A']);

const iconic={name:'British Museum',type:'museum',sitelinks:200};
const minor={name:'Local Museum',type:'museum',sitelinks:2};
const parks=Array.from({length:10},(_,i)=>({name:'Park '+i,type:'park',sitelinks:3}));
const picked=Q.capList([minor, ...parks, iconic], 8, {museum:1,park:8});
assert(picked.some(p=>p.name==='British Museum'),'iconic museum is kept despite the museum cap');

console.log('PASS prewarm quality filters, wellness keep list and iconic cap exemption');
