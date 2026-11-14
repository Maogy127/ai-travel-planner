const assert=require('assert');const {match,rank}=require('../js/diet');
const unknown={kind:'meal',title:'Seafood café'}, supported={kind:'meal',title:'Cafe',desc:'Vegan options listed'};
assert.equal(match(unknown,['Vegan']).status,'unknown');
assert.equal(match(supported,['Vegan']).status,'supported');
assert.equal(match({title:'Lunch near hotel · Vegan'},['Vegan']).status,'unknown');
assert.equal(match({tags:['gluten-free']},['Gluten-free']).status,'supported');
assert.equal(match(supported,['Vegan','Dairy-free']).status,'unknown');
assert.deepStrictEqual(rank([unknown,supported,unknown],['Vegan']),[supported,unknown,unknown]);
assert.equal(match(unknown,['No restrictions']).reason,'No diet preference set');
console.log('PASS diet evidence, unknowns, preference exclusivity and stable ranking');

global.window={};require('../js/oahu');for(const meal of window.OAHU_SAMPLE.days.flatMap(d=>d.items).filter(i=>i.kind==='meal'))assert.equal(match(meal,['Vegan']).status,'unknown');
