/* Optional day adaptation: movement goal ×0.6, recovery +15 minutes, sleep unchanged. */
(function(root){
'use strict';
function parse(text){
 const t=String(text||'').toLowerCase(), r={};
 if(/tired|exhausted|low energy|累|没精神/.test(t))r.energy='low';
 if(/energized|great energy|精神很好|精力充沛/.test(t))r.energy='high';
 if(/sore|aching|stiff|酸|疼|痛/.test(t))r.soreness='some';
 if(/very sore|really sore|很酸|特别疼/.test(t))r.soreness='a lot';
 if(/not sore|不酸/.test(t))r.soreness='none';
 if(/slept badly|poor sleep|didn.t sleep|没睡好|失眠/.test(t))r.sleep='poor';
 if(/slept well|great sleep|睡得很好/.test(t))r.sleep='great';
 if(/happy|great mood|开心/.test(t))r.mood='good';
 if(/sad|\bdown\b|low mood|不开心|心情不好/.test(t))r.mood='low';
 return r;
}
function gentle(c){return !!c&&!c.skipped&&(c.energy==='low'||['some','a lot'].includes(c.soreness)||c.sleep==='poor');}
function suggest(items,c,options){
 options=options||{}; c=c||{}; const low=gentle(c), goals=Object.assign({},options.goals||{move:60,rec:30,sleep:8});
 if(low){goals.move*=.6;goals.rec+=15;}
 const suggestions=[];
 if(low)(items||[]).forEach(i=>{if(i.locked||['travel','prep','meal','stay'].includes(i.kind))return;const text=[i.title,i.wellness&&i.wellness.type].join(' ');if(!/hike|hiking|tempo.*run|strength|vigorous/i.test(text))return;
 const stretch=/strength/i.test(text); suggestions.push({id:i.id,type:'swap',alternative:{title:stretch?'Gentle stretch':'Beach walk',wellness:{type:stretch?'recovery':'walk'},duration:i.duration,start:i.start,end:i.end,desc:'A gentler option at the same time.'}});
 });
 if(!low&&!c.skipped&&c.energy==='high')suggestions.push({id:'extra',type:'add',alternative:{title:'Sunrise run',duration:30,preferred:Math.max(0,Math.min(...(items||[]).map(i=>Number(i.start)||480),480)-30),wellness:{type:'movement'}}});
 return {goals,suggestions};
}
function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch(e){return {};}}
function get(key,date,id){return (read(key)[date]||{})[id]||{};}
function put(key,date,id,value){const all=read(key);all[date]=all[date]||{};all[date][id]=value;try{localStorage.setItem(key,JSON.stringify(all));}catch(e){} }
function score(items,level,next,prefs,c){const result=root.GoNowRings.scoreDay(items,level,next,prefs), adjusted=suggest(items,c,{goals:result.goals});result.goals=adjusted.goals;['move','rec','sleep'].forEach(k=>result[k]=Math.min(1,result.values[k]/result.goals[k]));return result;}
const api={parse,gentle,suggest,get,put,score};root.GoNowCheckin=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
