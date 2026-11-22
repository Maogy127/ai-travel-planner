/* Ordering, budget fit and per-item booking targets. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ctx = {console, setTimeout, URL, URLSearchParams, location: {search: '?fast=1'}, matchMedia: () => ({matches: true}), Date, Set, Map,
  localStorage: {getItem() { return null; }, setItem() {}}, document: {}};
ctx.window = ctx;
vm.createContext(ctx);
for (const name of ['styles', 'catalog', 'oahu', 'engine', 'diet', 'ai', 'affiliates', 'daybuilder', 'pickcatalog', 'pickscheduler']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8').replace('window.DayBuilder = {', 'window.DayBuilder = {convert,'), ctx);
}

const B = ctx.GoNowBudget;
const students = {who: 'friends', adults: 4, kids: 0, ages: [19, 20, 21, 22], budget: 1500, budgetChoice: '1500', start: '2026-11-25', end: '2026-11-29', destination: 'Oahu', foodLoves: [], mustdos: ''};
assert.equal(B.partySize(students), 4);
assert.equal(B.perPersonPerDay(students), 75);
assert.equal(B.maxRank(students), 2);
assert.equal(B.fits({price: '$$$$', name: 'La Mer', meals: ['dinner']}, students), false);
assert.equal(B.fits({price: '$$', name: 'Highway Inn', meals: ['lunch', 'dinner']}, students), true);
assert.equal(B.fits({price: '$150 pp', name: 'Kualoa'}, students), false);
assert.equal(B.fits({price: '$$$$', name: 'La Mer', meals: ['dinner']}, {...students, foodLoves: ['Fine dining']}), true);
assert.equal(B.fits({price: '$$$$', name: 'La Mer at Halekulani', meals: ['dinner']}, {...students, mustdos: 'dinner at La Mer'}), true);
assert.equal(B.maxRank({budget: 6000, who: 'couple', ages: [18, 19], start: '2026-11-25', end: '2026-11-29'}), 4);
console.log('PASS budget ranks a $1,500 trip for four below fine dining');

const c = ctx.GONOW_PICKS.oahu;
const listed = ctx.PickCatalog.filter(c.restaurants, '', 'All', students);
assert(!listed.some(i => i.id === 'lamer' || i.price === '$$$$'));
assert(ctx.PickCatalog.filter(c.restaurants, 'la mer', 'All', students).some(i => i.id === 'lamer'));
const auto = ctx.PickScheduler.schedule({...students, level: 'active', picks: {activities: ['lanikai', 'hanauma', 'makapuu', 'koko-crater'], restaurants: ['kalapawai']}}, c);
assert(!auto.days.some(d => d.items.some(i => /la mer|senia/i.test(i.title))));
const mealAt = t => t < 630 ? 'breakfast' : t < 870 ? 'lunch' : t < 1080 ? 'snack' : 'dinner';
for (const d of auto.days) {
  const slots = d.items.filter(i => i.kind === 'meal' && i.start != null).map(i => mealAt(i.start));
  assert.equal(new Set(slots).size, slots.length, d.date);
}
const east = auto.days.find(d => d.items.some(i => i.id === 'hanauma'));
const ids = east.items.map(i => i.id);
const at = id => ids.indexOf(id);
assert(at('makapuu') >= 0 && at('koko-crater') >= 0 && at('makapuu') < at('hanauma') && at('koko-crater') < at('hanauma'));
assert(at('lanikai') < 0 || at('lanikai') < at('hanauma'));
assert(!ids.slice(at('hanauma') + 1).includes('lanikai'));
console.log('PASS tight budget skips La Mer and keeps one meal per slot');

(async () => {
  const plan = await ctx.AI.generatePlan({...students, origin: 'Los Angeles', styles: ['scenic', 'food'], personal: true, stay: 'Hostel'}, {fast: true});
  assert(!plan.days.some(d => d.items.some(i => /la mer|senia/i.test(i.title))));
  const kyoto = await ctx.AI.generatePlan({...students, destination: 'Kyoto', templateOahu: true, styles: ['food', 'culture'], pace: 'Moderate'}, {fast: true});
  for (const day of kyoto.days) {
    const lunches = day.items.filter(i => /lunch/i.test(i.title));
    const dinners = day.items.filter(i => /dinner/i.test(i.title));
    assert(lunches.length <= 1, day.date + ' ' + lunches.map(i => i.title).join(' / '));
    assert(dinners.length <= 1);
  }
  console.log('PASS generated Oahu drops fine dining and Kyoto has one lunch');
})().catch(e => { console.error(e); process.exitCode = 1; });

const values = {destination: 'Oahu, Hawaii', start: '2026-11-25', end: '2026-11-29', adults: 4, fromIata: 'LAX', toIata: 'HNL', yymmdd_start: '261125', yymmdd_end: '261129', query: 'Oahu'};
const kualoa = ctx.gonowItemBooking({title: 'Kualoa Ranch — Jurassic Adventure (not UTV)', sources: ['https://www.kualoa.com/tours-and-activities/jurassic-adventure-tour']}, {kind: 'book', destination: 'Oahu, Hawaii', values});
assert.equal(kualoa.href, 'https://www.kualoa.com/tours-and-activities/jurassic-adventure-tour');
assert.equal(kualoa.testid, 'item-book');
const hotel = ctx.gonowItemBooking({title: 'Check in at The Kahala Hotel & Resort', kind: 'stay'}, {kind: 'stay', destination: 'Oahu, Hawaii', stay: 'The Kahala Hotel & Resort', values});
assert(hotel.href.startsWith('https://www.booking.com/'));
assert(decodeURIComponent(hotel.href).toLowerCase().includes('kahala'));
assert(hotel.href.toLowerCase().includes('oahu'));
const flights = ctx.gonowItemBooking({title: 'Land at HNL', kind: 'flight'}, {kind: 'flight', values});
assert(flights.href.includes('/LAX/HNL/261125/261129'));
assert.equal(flights.partner, 'skyscanner');
const kyotoFlights = ctx.gonowItemBooking({title: 'Flight'}, {kind: 'flight', values: {...values, destination: 'Kyoto', toIata: 'KIX'}});
assert(kyotoFlights.href.includes('/LAX/KIX/'));
const hike = ctx.gonowItemBooking({title: 'Guided nature hike'}, {kind: 'book', destination: 'Lisbon', values: {...values, destination: 'Lisbon', toIata: 'LIS', query: 'Lisbon'}});
assert(hike.partner === 'getyourguide' && decodeURIComponent(hike.href).includes('Lisbon'));
const uber = ctx.gonowItemBooking({title: 'Uber Reserve to Diamond Head'}, {kind: 'book', destination: 'Oahu, Hawaii', values});
assert(uber.href.startsWith('https://www.uber.com/'));
console.log('PASS each Book target matches that stop');
