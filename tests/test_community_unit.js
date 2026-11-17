// Community post builder: private fields and flights stay out of public posts; size cap.
const assert=require('assert');global.window={};const C=require('../js/community.js');
const trip={id:'trip-1',destination:'Oahu, Hawaii',start:'2026-11-25',end:'2026-11-29',answers:{destination:'Oahu',ages:['18','19'],who:'couple',budget:'5000+',styles:['hotel','scenic'],flightTime:'8:00 AM'},
 plan:{id:'oahu-picks-1',title:'Oahu',meta:'5 days · Couple · Ages 18 & 19',ageRules:['Under 21'],days:[{date:'2026-11-25',theme:'Arrive',items:[{id:'f',kind:'flight',title:'HA 11 · lands 1:00 PM'},{id:'a',title:'Beach',note:'Room 1204',confirmation:'ABC123'}]},{date:'2026-11-26',theme:'Kahala',items:[{id:'b',title:'Est. departs ~10:00 AM'},{id:'c',title:'Kahala sunset',desc:'Nice'}]}]}};
const builder={days:{'2026-11-25':{items:[{id:'x',kind:'flight',title:'Flight'},{id:'y',title:'Beach',notes:'gate code 1234'}],unscheduled:[]}}};
const post=C.tripPost(trip,builder);const s=JSON.stringify(post);
assert.equal(post.kind,'trip');assert.equal(post.title,'5 days in Oahu');assert.equal(post.photo,'');
for(const bad of ['Ages','18 & 19','ABC123','Room 1204','gate code','HA 11','departs','"ages"','"budget"','flightTime','ageRules'])assert(!s.includes(bad),'leaked '+bad);
assert.deepEqual(post.days.map(d=>d.stops),[['Beach'],['Kahala sunset']]);
assert.equal(post.trip.plan.meta,'2 days');assert.deepEqual(post.trip.answers.styles,['hotel','scenic']);
assert.equal(post.trip.builder.days['2026-11-25'].items.length,1);
const huge={...trip,plan:{...trip.plan,days:trip.plan.days.map(d=>({...d,items:Array(400).fill(0).map((_,i)=>({id:'i'+i,title:'x'.repeat(400)}))}))}};
assert.equal(C.tripPost(huge,null),null,'oversized trips are refused');
const c=C.checkinPost('Leonard’s Bakery'+'x'.repeat(100),'Honolulu','y'.repeat(300));assert.equal(c.title.length,80);assert.equal(c.note.length,140);assert.equal(c.kind,'checkin');
console.log('PASS community posts strip private fields and flights, cap sizes');
