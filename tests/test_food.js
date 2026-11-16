const assert=require('assert');const fs=require('fs');const D=require('../js/diet');
let a=D.migrate({food:['Seafood','Vegan','No preference','Coffee & bakeries','Halal'],diet:['High protein','No restrictions','Vegan','Dairy-free'],allergies:'peanuts, shrimp, sesame'});
assert.deepStrictEqual(a.dietNeeds,['Vegan','Halal','Dairy-free']);assert.deepStrictEqual(a.foodLoves,['Seafood','Healthy cafés & bowls','High protein']);assert.deepStrictEqual(a.allergens,['Nuts','Shellfish','Other']);assert.equal(a.allergyOther,'sesame');
assert.deepStrictEqual(D.migrate(JSON.parse(JSON.stringify(a))),a);
for(const allergies of ['nut, peanut, tree nut, shellfish, shrimp, crab, lobster','坚果、花生、贝、虾、蟹']){const b=D.migrate({allergies});assert.deepStrictEqual(b.allergens,['Nuts','Shellfish']);assert.equal(b.allergyOther,'');}
const unknown={kind:'meal',title:'Neighborhood cafe'},nut={kind:'meal',desc:'contains nuts'},shell={kind:'meal',tags:['shellfish']},yes={kind:'meal',tags:['vegan','nut-free','shellfish-free']};
const constraints={dietNeeds:['Vegan'],allergens:['Nuts','Shellfish']};
assert.equal(D.match(nut,constraints).status,'conflict');assert.equal(D.match(shell,constraints).status,'conflict');assert.equal(D.match(unknown,constraints).reason,'Check the menu');assert.equal(D.match(yes,constraints).status,'supported');assert.deepStrictEqual(D.rank([nut,shell,unknown,yes],constraints),[yes,unknown]);
assert.equal(D.match({kind:'meal',title:'Poke cafe'},{allergens:['Shellfish']}).status,'unknown');
assert.equal(D.match({kind:'meal',title:'Steakhouse'},['Vegetarian']).status,'unknown');assert.equal(D.match({desc:'Steakhouse with no vegetarian options'},['Vegetarian']).status,'conflict');
assert.equal(D.safeMeal(shell,constraints).title,'A place that fits your needs');assert.equal(D.safeMeal({...shell,booked:true},constraints).booked,true);
const fine={kind:'meal',title:'La Mer dinner'},sea={kind:'meal',tags:['Seafood']};assert.deepStrictEqual(D.rank([fine,sea,unknown],{foodLoves:['Seafood']}),[sea,fine,unknown]);assert(D.fineDining(fine));assert(D.fineDining({kind:'meal',desc:'tasting menu'}));assert.equal(D.balance([unknown]),'');assert.equal(D.balance([fine]),D.balanceCopy);
const banned=/\b(?:unhealthy|guilt|guilty|cheat|junk|bad|sinful|indulgent|burn off|earn|punish|damage|splurge)\b/i;
for(const copy of [D.balanceCopy,...D.needs,...D.loves,D.safeMeal(shell,constraints).desc,D.match(unknown,constraints).reason,D.match(shell,constraints).reason])assert(!banned.test(copy),copy);
const app=fs.readFileSync('js/app.js','utf8');assert(!/state\.answers\.(?:food|diet|allergies)(?![A-Za-z])/.test(app.replace(/state\.answers\.food=\[\];/g,'')));assert(!/a\.(?:food|allergies)\b/.test(fs.readFileSync('js/engine.js','utf8')));
console.log('PASS food migration, explicit constraints, unknowns, ranking, reservation retention and gentle dinner copy');

const foodCopy=app.slice(app.indexOf('function foodQuestion()'),app.indexOf('function bindWellnessDetails'));assert(!banned.test(foodCopy));

assert(!app.includes('data-testid="dinner-balance"'));
const local=require('../js/local');
const localPlan=local.generate({localCity:'Honolulu',localLength:'full',allergens:['Shellfish']},[{id:'oahu',activities:{food:['Seafood restaurant','Neighborhood cafe'],nature:['Park'],wandering:['Walk'],scenic:['View'],culture:['Museum']}}]);
assert(!localPlan.days.flatMap(d=>d.blocks).some(b=>b.title==='Seafood restaurant'));
assert(localPlan.days.flatMap(d=>d.blocks).some(b=>b.kind==='meal'&&b.title==='Neighborhood cafe'));
