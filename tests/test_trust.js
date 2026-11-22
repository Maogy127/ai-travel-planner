/* Flight length, place labels, sleep floor, and preference picks. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const c={console,Date,Intl,Set,Map,JSON};c.window=c;vm.createContext(c);
for(const file of ['jetlag','styles','catalog','engine','diet','daybuilder','placesource','pickcatalog','pickscheduler','rings'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),c);
const J=c.GoNowJetlag,F=c.GoNowFlights,P=c.GoNowPlaceSource,C=c.PickCatalog,R=c.GoNowRings;
const summer=J.flightEstimate('Tokyo','Los Angeles','2026-07-15');
const winter=J.flightEstimate('Tokyo','Los Angeles','2026-11-25');
assert(summer.air>=10&&summer.air<=12,'air '+summer.air);
assert(summer.door>=16&&summer.door<=17.5,'door '+summer.door);
assert(Math.abs(summer.clockHours)>=16&&Math.abs(winter.clockHours)>=16);
assert(F.durationLine({origin:'Tokyo',destination:'Los Angeles',start:'2026-07-15'}).includes('in the air'));
assert(F.durationLine({origin:'Tokyo',destination:'Los Angeles',start:'2026-07-15'}).includes('door to door'));
const oahu=F.route({origin:'Los Angeles',destination:'Oahu',start:'2026-11-25'});
assert.equal(oahu.hours,5.5);
const seattle=F.route({origin:'Los Angeles',destination:'Seattle',start:'2026-11-25'});
assert.equal(seattle.hours,2.5);
console.log('PASS flight estimates label air time and door to door');

function place(city,p){return P.labelPlace(Object.assign({category:'Attraction',type:'attraction'},p),city);}
assert.equal(place('Honolulu',{name:'Waikīkī Aquarium',category:'Aquarium',lat:21.2657,lng:-157.8217,area:'Honolulu'}).area,'Waikiki');
assert.equal(place('Honolulu',{name:'Lanikai Beach',category:'Beach',lat:21.3915,lng:-157.7146,area:'Honolulu'}).area,'Lanikai');
assert.equal(place('Honolulu',{name:'USS Arizona',lat:21.3649,lng:-157.9501,area:'Honolulu'}).area,'Pearl Harbor');
assert.equal(place('Honolulu',{name:'Iolani Palace (ʻ)',lat:21.3067,lng:-157.859,area:'Honolulu'}).name,'Iolani Palace');
assert.equal(place('Barcelona',{name:'Platja de la Barceloneta',category:'Beach',lat:41.3797,lng:2.1934,area:'Barcelona'}).area,'Barceloneta');
assert.equal(place('Barcelona',{name:'Museu de la Xocolata',category:'Cafe',lat:41.3871,lng:2.1818,area:'Barcelona'}).category,'Museum');
assert.equal(place('Barcelona',{name:'Plaça de Tetuan',category:'Park',lat:41.3949,lng:2.1755,area:'Barcelona'}).category,'Attraction');
assert.equal(place('Barcelona',{name:'Monestir de Sant Cugat',category:'Museum',lat:41.4738,lng:2.0854,area:'Barcelona'}).area,'Sant Cugat');
assert.equal(place('Kyoto',{name:'Ninna temple',area:'右京区',lat:35.03,lng:135.71}).area,'Ukyo');
console.log('PASS neighborhoods and categories');

const night=[{title:'Dinner',kind:'meal',start:1260,end:1320}];
const morning=[{title:'Temple',kind:'activity',start:480,end:600}];
const shifted=R.scoreDay(morning,'active',[],{bedtime:'17:30',wake:'01:30',previousItems:night,usualBedtime:'22:30'});
assert(shifted.values.sleep>=7,'short night '+shifted.values.sleep);
console.log('PASS a shifted wake does not invent a short night');

const nyc=JSON.parse(fs.readFileSync('data/cities/new-york.json','utf8'));
const persona={dietNeeds:['Vegetarian'],foodLoves:['Seafood'],activities:['Walking'],level:'gentle',budget:1500,budgetChoice:'1500',who:'solo',ages:[30],start:'2026-12-02',end:'2026-12-06'};
const ids=C.choose(nyc.restaurants,persona,3);
const names=ids.map(id=>nyc.restaurants.find(r=>r.id===id).name);
assert(!names.some(n=>/Katz|Delmonico|oyster|seafood|sushi|fish/i.test(n)),names.join(', '));
const shown=C.filter(nyc.restaurants,'', 'All', persona).slice(0,5).map(r=>r.name);
assert(!shown.some(n=>/Katz|Delmonico|oyster|Bernardin|Masa/i.test(n)),shown.join(', '));
assert(C.why(nyc.restaurants.find(r=>/Katz/i.test(r.name)),persona).includes('Vegetarian'));
const seafood=C.filter(nyc.restaurants,'','All',{foodLoves:['Seafood'],budget:4000,budgetChoice:'5000+',who:'couple',ages:[35,36]});
assert(/seafood|sushi|fish/i.test(seafood[0].cuisine+' '+seafood[0].name),seafood[0].name);
console.log('PASS preferences skip Katz’s and Delmonico’s for a vegetarian traveler');
