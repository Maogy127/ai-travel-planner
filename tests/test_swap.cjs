'use strict';
const assert=require('node:assert/strict');
global.window={};require('../js/daybuilder.js');
const B=window.DayBuilder;
const item={start:540,end:660,lat:0,lng:0};
const pick=(id,extra={})=>({id,name:id,duration:30,lat:0,lng:0,...extra});
const args={item,next:{start:660,lat:0,lng:0},date:'2026-11-26',catalog:[pick('far',{lng:.1}),pick('near'),pick('long',{duration:116}),pick('closed',{closedDates:['2026-11-26']}),pick('late',{hours:{open:600,close:900}}),pick('used'),pick('travel',{lng:5})],inPlan:['used']};
assert.deepEqual(B.slotCandidates(args).map(r=>r.pick.id),['near','far']);
assert.equal(B.slotCandidates({...args,catalog:[pick('unknown')]}).length,1);
assert.equal(B.slotCandidates({...args,catalog:[pick('week',{hours:{week:Array.from({length:7},()=>[])}})]}).length,0);
assert.equal(B.slotCandidates({...args,catalog:[pick('shut',{closedDays:[4]})]}).length,0);
assert.equal(B.slotCandidates({...args,catalog:[pick('exact',{duration:115})]})[0].slot,115);
assert.equal(B.slotCandidates({item, next:{start:660,lat:0,lng:0}, catalog:[pick('date',{closedDates:['2026-11-26']})],date:'2026-11-26'}).length,0);
console.log('PASS swap duration, hours, closures, travel, distance order and in-plan exclusions');
// Copy-audit additions: meals swap for restaurants serving that meal (and may be quicker); activities never get restaurants.
{
 const food=(id,meals,extra={})=>pick(id,{meals,duration:60,...extra});
 const cat=[food('cafe',['breakfast']),food('bistro',['dinner']),pick('museum',{duration:30})];
 const breakfast={title:'Grab-and-go breakfast',kind:'meal',start:540,end:560,lat:0,lng:0};
 const rows=B.slotCandidates({item:breakfast,next:{start:560,kind:'travel'},catalog:cat,date:'2026-11-26'});
 assert.deepEqual(rows.map(r=>r.pick.id),['cafe']);assert.equal(rows[0].duration,20,'meal shortened to the 20-min slot');
 assert.deepEqual(B.slotCandidates({item:{title:'Museum visit',start:540,end:660,lat:0,lng:0},catalog:cat,date:'2026-11-26'}).map(r=>r.pick.id),['museum']);
 assert.equal(B.slotCandidates({item:{...breakfast,end:550},next:{start:550,kind:'travel'},catalog:cat,date:'2026-11-26'}).length,0,'under 15 min is not a meal');
 console.log('PASS swap kind matching and flexible meal length');
}
