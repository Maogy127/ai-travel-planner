// v2 theme engine: every text pair stays WCAG AA at every dial position and in Focus; states and labels map as specced.
const assert=require('assert');
const T=require('../js/v2.js');
const pairs=[['accent-text','soft'],['accent-text','card-2'],['ink-2','card-2'],['on-accent','ink'],['bg','ink'],['ink','bg'],['ink','surface'],['ink-2','bg'],['ink-2','surface'],['accent-text','bg'],['accent-text','surface'],['on-accent','accent'],['ink','soft'],['ink-2','soft'],['ink','accent-soft'],['move-text','surface'],['rec-text','surface'],['sleep-text','surface'],['boundary','surface',3],['boundary','soft',3]];
for(let i=0;i<=100;i++){const k=T.at(i/100);for(const [a,b,min=4.5] of pairs){const r=T.contrast(k[a],k[b]);assert(r>=min,`${i/100} ${a}/${b} ${r.toFixed(2)}`);}
  for(const v of Object.values(k))assert(/^#[0-9A-F]{6}$/.test(v),v);}
console.log('PASS AA text pairs at all 101 dial positions');
const f=T.focusTokens();for(const [a,b,min=4.5] of pairs){assert(T.contrast(f[a],f[b])>=min,'focus '+a+'/'+b);}console.log('PASS Focus pairs AA');
// Exact spec palettes at each label.
assert.deepEqual([T.at(0).bg,T.at(0).surface,T.at(0).accent,T.at(0).sleep],['#EBD8C3','#F5E9DA','#8C3D49','#C78C95']);
assert.deepEqual([T.at(.5).bg,T.at(.5).surface,T.at(.5).accent,T.at(.5).sleep],['#F3EADB','#FBF5EA','#56684A','#A897BC']);
assert.deepEqual([T.at(1).bg,T.at(1).surface,T.at(1).accent,T.at(1).sleep],['#F6F1E7','#FFFBF3','#C23B22','#F2B820']);
console.log('PASS Tired T2 / Calm C2 / Energized anchors exact');
assert.equal(T.stateName(.1),'tired');assert.equal(T.stateName(.23),'tired');assert.equal(T.stateName(.24),'calm');assert.equal(T.stateName(.66),'calm');assert.equal(T.stateName(.67),'energized');
console.log('PASS thresholds Low < .24 <= Steady <= .66 < High');
// Never pure white / black in the palette.
for(let i=0;i<=10;i++)for(const v of Object.values(T.at(i/10)))assert(!['#FFFFFF','#000000'].includes(v));
console.log('PASS no pure white or black');
// Mid-blend is OKLCH (hue path), not sRGB.
const mid=T.mix('#56684A','#C23B22',.5),srgb='#8C523'+'6';assert.notEqual(mid,srgb);console.log('PASS OKLCH blend');
const css=require('fs').readFileSync(require('path').join(__dirname,'../css/styles.css'),'utf8');
const root=Object.fromEntries([...css.match(/:root\s*\{([^}]+)/)[1].matchAll(/--([\w-]+)\s*:\s*(#[\da-f]{6})\s*;/gi)].map(m=>[m[1],m[2].toUpperCase()]));
const e=T.at(1);for(const k of ['bg','surface','ink','ink-2','accent','accent-text','soft','line','boundary','sleep','move','rec','sleep-text','move-text','rec-text','accent-soft','card-2'])assert.equal(root[k],e[k],k);
console.log('PASS static :root tokens match the Energized engine output');
