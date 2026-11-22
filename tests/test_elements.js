// Element mapping: activities get 1-2 elements; days celebrate at 4+; no "missing" copy.
const assert=require('assert');
global.window=global;
require('../js/oahu.js');
require('../js/pickcatalog.js');
const E=require('../js/elements.js');

assert.deepEqual(E.ORDER,['water','fire','wood','wind','earth']);
assert.equal(E.COLORS.fire,'#C23B22');
assert.equal(E.COLORS.wood,'#7FA046');
assert.equal(E.COLORS.water,'#A897BC');
assert.equal(E.COLORS.wind,'#D9C8A6');
assert.equal(E.COLORS.earth,'#F2B820');
assert.equal(E.of({kind:'travel',title:'Uber to the beach'}).length,0);
assert.equal(E.of({kind:'flight',title:'Flight home'}).length,0);
assert.equal(E.of({kind:'prep',title:'Get ready'}).length,0);
assert.equal(E.skipped({kind:'activity',flight:true}),true);
console.log('PASS skip travel, flight and prep; palette tokens match v2');

assert.deepEqual(E.of({kind:'meal',title:'Dinner at the Kahala'}),['earth']);
assert.deepEqual(E.of({kind:'stay',title:'Check in at The Kahala Hotel & Resort'}),['earth']);
assert.deepEqual(E.of({title:'Meditating by a lake',kind:'rest'}),['water','wind']);
assert.deepEqual(E.of({title:'Beach yoga',kind:'activity'}),['water','wind']);
assert.deepEqual(E.of({title:'Morning pilates',kind:'activity'}),['wood','wind']);
assert.deepEqual(E.of({title:'A short walk in the garden',kind:'activity'}),['wood']);
assert.deepEqual(E.of({title:'Strength session',kind:'activity',effort:'Active'}),['fire','wood']);
assert.deepEqual(E.of({title:'Museum afternoon',kind:'activity',category:'Culture'}),['wind']);
assert.deepEqual(E.of({title:'Black Friday shopping — Ala Moana Center',kind:'activity'}),[]);
assert.deepEqual(E.of({title:'Neighborhood café breakfast',kind:'activity',style:'food'}),['earth']);
assert.deepEqual(E.of({title:'Guided nature hike',kind:'activity',style:'nature',effort:'Moderate'}),['fire','wood']);
assert.deepEqual(E.of({title:'Hotel wellness afternoon',kind:'rest',style:'hotel'}),['wind']);
assert.deepEqual(E.of({title:'Pool or hotel lounge downtime',kind:'rest'}),['water','wind']);
console.log('PASS inclusive beginners and generic catalog styles');

const curated={
  'diamond-head':['fire','wood'],
  kualoa:['wood'],
  dive:['water','fire'],
  parasail:['water','wind'],
  lanikai:['fire','wood'],
  makapuu:['fire','wood'],
  kahala:['water','wind'],
  waikiki:['water','wind'],
  hanauma:['water'],
  'pearl-harbor':['wind'],
  'bishop-museum':['wind'],
  pcc:['wind'],
  iolani:['wind'],
  waimea:['water','wind'],
  manoa:['fire','wood'],
  'koko-crater':['fire','wood'],
  surf:['water','fire'],
  'sharks-cove':['water'],
  dole:['wood','earth'],
  'magic-island':['water','wind'],
  'ala-moana':[],
  'royal-hawaiian-center':[],
  laniakea:['water','wind'],
  'kahala-downtime':['water','wind']
};
const picks=(global.GONOW_PICKS||window.GONOW_PICKS).oahu.activities;
picks.forEach(p=>{
  const got=E.of(p);
  assert.deepEqual(got,curated[p.id],p.id+' '+p.name+' -> '+got+' expected '+curated[p.id]);
  assert(got.length<=2,p.id+' has more than two elements');
});
(global.GONOW_PICKS||window.GONOW_PICKS).oahu.restaurants.forEach(r=>{
  assert.deepEqual(E.of(Object.assign({kind:'meal'},r)),['earth'],r.id);
});
console.log('PASS curated Oahu picks and restaurants');

const sample=window.OAHU_SAMPLE;
const expectedDays={
  '2026-11-25':['earth'],
  '2026-11-26':['water','fire','wood','wind','earth'],
  '2026-11-27':['water','fire','earth'],
  '2026-11-28':['water','fire','wood','wind','earth'],
  '2026-11-29':[]
};
sample.days.forEach(d=>{
  const got=E.day(d.items);
  assert.deepEqual(got.ids,expectedDays[d.date],d.date+' '+d.theme+' -> '+got.ids);
  if(got.count>=4)assert.equal(got.celebrated,true);
  else assert.equal(got.celebrated,false);
});
assert.equal(E.celebrateLine(5),'All five elements, in one day.');
assert.equal(E.celebrateLine(4),'Four elements, quietly gathered.');
assert.equal(E.celebrateLine(3),'');
assert.equal(E.tripLine(4),'A day that gathered its elements.');
const copy=[E.celebrateLine(5),E.celebrateLine(4),E.celebrateLine(3),E.tripLine(5),E.tripLine(4),E.tripLine(3),E.rowHTML([{kind:'meal',title:'Dinner'}]),E.rowHTML(sample.days[0].items),E.rowHTML(sample.days[1].items)].join('\n');
assert(!/missing|still need|you have not|left to collect|还差|缺了/i.test(copy),'nagging copy: '+copy);
assert(!/missing|still need|还差/i.test(E.rowHTML(sample.days[0].items)));
assert(E.rowHTML(sample.days[1].items).includes('All five elements, in one day.'));
assert(E.rowHTML(sample.days[1].items).includes('data-testid="day-elements"'));
assert(E.iconsHTML(sample.days[1].items.find(i=>i.kind==='sight'&&/Diamond Head/.test(i.title))).includes('data-testid="item-elements"'));
assert.equal(E.detailHTML({title:'Beach yoga',kind:'activity'}),'<p class="el-detail" data-testid="item-elements-detail">Water · 水 · Wind · 风</p>');
console.log('PASS demo days, celebration copy, and no missing-element language');
const intro=E.introHTML()+E.introInner();
assert(intro.includes('Travel that balances you:')&&intro.includes('水 · 火 · 木 · 风 · 土'));
assert(intro.includes('Swim, sea, spa')&&intro.includes('Movement intensity')&&intro.includes('Hikes, walks, pilates')&&intro.includes('Yoga, meditation, sunsets')&&intro.includes('Good food and sleep'));
assert(intro.includes('All five elements, in one day.')&&intro.includes('How it works'));
assert(!/missing|still need|还差/i.test(intro));
console.log('PASS home intro names all five elements without nagging');
