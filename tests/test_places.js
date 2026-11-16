const assert=require('assert'),P=require('../js/places'),J=require('../js/jetlag');
for(const [input,name] of Object.entries({la:'Los Angeles (LAX)',LA:'Los Angeles (LAX)',nyc:'New York (NYC)',sf:'San Francisco (SFO)',lax:'Los Angeles (LAX)','Los Angeles':'Los Angeles',PDX:'PDX',pdx:'PDX',zz:'zz'})){
  assert.equal(P.normalize(input).name,name);assert(!P.isJunk(input));
}
for(const input of ['', '1','!!','x','a1'])assert(P.isJunk(input));
assert(P.normalize('LA').matched);assert(!P.normalize('Los Angeles').matched);
for(const [input,zone,offset] of [['la','America/Los_Angeles',-480],['nyc','America/New_York',-300],['hk','Asia/Hong_Kong',480],['kl','Asia/Kuala_Lumpur',480],['iad','America/New_York',-300],['dca','America/New_York',-300]]){
  const home=J.home(P.normalize(input).name);assert.equal(home.tz,zone);assert.equal(J.offset('2026-11-25',home.tz),offset);
}
global.window={GoNowPlaces:P};require('../js/catalog');require('../js/engine');
assert.equal(window.Engine.matchDestination('hnl').id,'oahu');
for(const input of ['nyc','ny','jfk','ewr','lga'])assert.equal(window.Engine.matchDestination(P.normalize(input).name).id,'newyork');
assert.equal(window.Engine.matchDestination(P.normalize('la').name).id,'custom');
console.log('PASS place aliases, junk, custom codes, destination matching and normalized time zones');
