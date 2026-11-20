// Community post builder: private fields and flights stay out of public posts; size cap.
const assert=require('assert');global.window={};const C=require('../js/community.js');
const trip={id:'trip-1',destination:'Oahu, Hawaii',start:'2026-11-25',end:'2026-11-29',answers:{destination:'Oahu',stay:'Kahala Hotel & Resort',ages:['18','19'],who:'couple',budget:'5000+',styles:['hotel','scenic'],flightTime:'8:00 AM'},
 plan:{id:'oahu-picks-1',title:'Oahu',stay:'Kahala Hotel & Resort',banner:'Booked for Sam',costs:[{label:'x',sources:['javascript:alert(1)']}],meta:'5 days · Couple · Ages 18 & 19',ageRules:['Under 21'],days:[{date:'2026-11-25',theme:'Arrive',items:[{id:'f',kind:'flight',title:'HA 11 · lands 1:00 PM'},{id:'a',title:'Beach',note:'Room 1204',confirmation:'ABC123'}]},{date:'2026-11-26',theme:'Kahala',items:[{id:'b',title:'Est. departs ~10:00 AM'},{id:'c',title:'Kahala sunset',desc:'Nice'},{id:'d',title:'Dinner at Kahala Hotel & Resort',url:'javascript:alert(1)'}]}]}};
const builder={days:{'2026-11-25':{items:[{id:'x',kind:'flight',title:'Flight'},{id:'y',title:'Beach',notes:'gate code 1234'}],unscheduled:[]}}};
const post=C.tripPost(trip,builder);const s=JSON.stringify(post);
assert.equal(post.kind,'trip');assert.equal(post.title,'5 days in Oahu');assert.equal(post.photo,'');
for(const bad of ['Kahala Hotel','Booked for Sam','javascript:','Ages','18 & 19','ABC123','Room 1204','gate code','HA 11','departs','"ages"','"budget"','flightTime','ageRules'])assert(!s.includes(bad),'leaked '+bad);
assert.deepEqual(post.days.map(d=>d.stops),[['Beach'],['your hotel sunset','Dinner at your hotel']]);assert(!('stay' in post.trip.plan)&&!('banner' in post.trip.plan));
assert.equal(post.trip.plan.meta,'2 days');assert.deepEqual(post.trip.answers.styles,['hotel','scenic']);
assert.equal(post.trip.builder.days['2026-11-25'].items.length,1);
const huge={...trip,plan:{...trip.plan,days:trip.plan.days.map(d=>({...d,items:Array(400).fill(0).map((_,i)=>({id:'i'+i,title:'x'.repeat(400)}))}))}};
assert.equal(C.tripPost(huge,null),null,'oversized trips are refused');
const c=C.checkinPost('Leonard’s Bakery'+'x'.repeat(100),'Honolulu','y'.repeat(300));assert.equal(c.title.length,80);assert.equal(c.note.length,140);assert.equal(c.kind,'checkin');
console.log('PASS community posts strip private fields and flights, cap sizes');
// Case-insensitive hotel scrub.
{const t={id:'t',destination:'Oahu',answers:{stay:'Kahala Hotel'},plan:{id:'p',days:[{date:'2026-11-25',theme:'x',items:[{id:'a',title:'Dinner at the KAHALA hotel',place:'kahala hotel lobby'}]}]}};const p=C.tripPost(t,null);assert(!/kahala hotel/i.test(JSON.stringify(p)),'case-insensitive hotel scrub');console.log('PASS case-insensitive hotel scrub');}
// Short hotel names ("the Kahala") are hidden too; nearby public places stay.
{const p=C.cleanPlan({days:[{items:[{title:'Dinner at the Kahala'},{title:'Kahala Beach sunset'}]}]},'The Kahala Hotel & Resort');assert(p.days[0].items[0].title==='Dinner at your hotel'&&p.days[0].items[1].title==='Kahala Beach sunset','short hotel name hidden');console.log('PASS short hotel name hidden');}
// A hotel named after the city does not blank the city name.
{const t={id:'t2',destination:'Lisbon',answers:{stay:'Hotel Lisbon'},plan:{title:'Lisbon',days:[{items:[{title:'Walk old Lisbon'},{title:'Back to Hotel Lisbon'}]}]}};const p=C.tripPost(t,null);const ts=p.days[0].stops;assert(ts[0]==='Walk old Lisbon'&&ts[1]==='Back to your hotel'&&p.title.includes('Lisbon'),'city kept: '+JSON.stringify(ts));console.log('PASS hotel named after city keeps city');}
