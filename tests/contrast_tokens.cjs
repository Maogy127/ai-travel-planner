const fs=require('fs'),assert=require('assert');
const css=fs.readFileSync(require('path').join(__dirname,'../css/styles.css'),'utf8');
const tokens=Object.fromEntries([...css.match(/:root\s*\{([^}]+)/)[1].matchAll(/--([\w-]+)\s*:\s*(#[\da-f]{6})\s*;/gi)].map(m=>[m[1],m[2]]));
function luminance(hex){return hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);}
function contrast(a,b){let x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const pairs=[['ink','bg'],['ink-2','bg'],['ink-2','surface'],['accent-text','bg'],['accent-text','surface'],['#FFFFFF','accent-text'],['ink','soft'],['sleep-text','surface'],['move-text','surface'],['rec-text','surface'],['sleep','surface',3],['move','surface',3],['rec','surface',3],['boundary','surface',3],['boundary','soft',3],['focus','bg',3]];
if(require.main===module)for(const [a,b,min=4.5] of pairs){const r=contrast(tokens[a]||a,tokens[b]||b);console.log(`${r>=min?'PASS':'FAIL'} ${a} / ${b}: ${r.toFixed(2)}:1 (>=${min})`);assert(r>=min);}
module.exports={tokens,contrast,pairs};
