const assert=require('assert'),T=require('../js/timepicker');
for(let h=0;h<24;h++)for(let m=0;m<60;m+=15){const s=T.clock(h*60+m);assert.equal(T.parse(s),h*60+m);assert.equal(T.from12(h%12||12,m,h>=12),s);}
assert.equal(T.display('00:00'),'12:00 AM');assert.equal(T.display('12:00'),'12:00 PM');assert.equal(T.step('23:45',15),'00:00');assert.equal(T.step('00:00',-15),'23:45');assert.equal(T.parse('10:30 --'),null);console.log('PASS timepicker round trips, noon/midnight, quarter-hour wrap');

assert.equal(T.parse('10:30 PM'),1350);assert.equal(T.parse('12:00 AM'),0);assert.equal(T.parse('12:00 PM'),720);assert.equal(T.parse('13:00 PM'),null);
