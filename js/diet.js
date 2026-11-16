/* Shared food migration, explicit dietary evidence, and preference ranking. */
(function(root){
'use strict';
const needs=['Vegetarian','Vegan','Gluten-free','Dairy-free','Halal'];
const loves=['Local classics','Seafood','Street food / casual','Fine dining','Healthy cafés & bowls','High protein','Low carb'];
const balanceCopy='Big dinner tonight — a lighter lunch and an easy evening stroll keep the day feeling good.';
function migrate(a){
 if(!Array.isArray(a.dietNeeds)){
  a.dietNeeds=[];a.foodLoves=a.foodLoves||[];
  [...(a.food||[]),...(a.diet||[])].forEach(v=>{if(needs.includes(v))a.dietNeeds.push(v);else if(loves.includes(v))a.foodLoves.push(v);else if(v==='Coffee & bakeries')a.foodLoves.push('Healthy cafés & bowls');});
 }
 if(!Array.isArray(a.allergens)){
  a.allergens=[];let rest=String(a.allergies||'');
  [[/\b(?:tree[ -]?nuts?|peanuts?|nuts?)\b|坚果|花生/gi,'Nuts'],[/\b(?:shellfish|shrimp|crab|lobster)\b|贝|虾|蟹/gi,'Shellfish']].forEach(([re,key])=>{if(re.test(rest)){a.allergens.push(key);re.lastIndex=0;rest=rest.replace(re,' ');}});
  rest=rest.replace(/\b(?:and|allerg(?:y|ies|ic)(?: to)?)\b/gi,' ').replace(/^[\s,;、，]+|[\s,;、，]+$/g,'').trim();
  a.allergyOther=a.allergyOther||rest;if(a.allergyOther)a.allergens.push('Other');
 }
 ['dietNeeds','foodLoves','allergens'].forEach(k=>a[k]=[...new Set(a[k]||[])]);
 a.allergyOther=a.allergyOther||'';a.dietNotes=a.dietNotes||'';return a;
}
function data(item){return [item.title,item.desc,...(item.tags||[])].join(' ').toLowerCase();}
function match(item,prefs){
 const a=Array.isArray(prefs)?{dietNeeds:prefs.filter(p=>needs.includes(p)),allergens:[]}:prefs||{};
 const other=(a.allergens||[]).includes('Other');
 const selected=[...(a.dietNeeds||[]),...(a.allergens||[]).filter(v=>v!=='Other')];const text=data(item).replace(/(?:shellfish|nut)[- ]free(?: menu)?/g,'');
 const conflicts=selected.filter(p=>p==='Shellfish'?/shellfish|shrimp|crab|lobster|seafood[- ](?:only|restaurant)|oyster bar/.test(text):p==='Nuts'?/contains? (?:tree )?nuts|peanuts|nut[- ]based|\bnuts\b/.test(text):['Vegetarian','Vegan'].includes(p)?(text.includes('no '+p.toLowerCase()+' options')||/meat[- ]only/.test(text)):p==='Gluten-free'?/contains gluten|no gluten[- ]free options/.test(text):p==='Dairy-free'?/contains dairy|no dairy[- ]free options/.test(text):/not halal|non[- ]halal/.test(text));
 if(conflicts.length)return {status:'conflict',needs:conflicts,reason:'Check the menu for '+conflicts.join(', ')};
 if(!selected.length&&!other)return {status:'unknown',reason:Array.isArray(prefs)?'No diet preference set':'Check the menu'};
 const supported=selected.filter(p=>{
  const label=p.toLowerCase(), tags=(item.tags||[]).map(t=>String(t).toLowerCase());
  if(['Nuts','Shellfish'].includes(p))return tags.includes(p==='Nuts'?'nut-free':'shellfish-free')||data(item).includes((p==='Nuts'?'nut':'shellfish')+'-free menu');
  return tags.includes(label)||new RegExp('\\b'+label.replace('-','[- ]')+' (?:options|menu|meals|dishes)\\b').test(text);
 });
 return supported.length===selected.length&&!other?{status:'supported',reason:supported.join(', ')+' options listed'}:{status:'unknown',reason:'Check the menu'};
}
function rank(items,prefs){const a=Array.isArray(prefs)?{dietNeeds:prefs}:prefs||{};return items.filter(i=>i.kind!=='meal'||match(i,a).status!=='conflict').map((item,index)=>({item,index,score:(a.foodLoves||[]).filter(p=>data(item).includes(p.toLowerCase())).length+(item.kind==='meal'&&match(item,a).status==='supported'?1:0)})).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.item);}
function fineDining(item){return item.kind==='meal'&&/fine dining|tasting menu|la mer/i.test(data(item));}
function balance(items){return items.some(fineDining)?balanceCopy:'';}
function safeMeal(item,a){if(item.kind!=='meal'||match(item,a).status!=='conflict'||item.locked||item.booked||item.requested||/your reservation|booked|locked/i.test(item.desc||''))return item;return Object.assign({},item,{title:'A place that fits your needs',desc:'Choose a place that fits your needs. Check the menu before booking.',tags:[],sources:[],prep:[],tips:[],bring:[],price:'',bestTime:'',bookable:false,dietReplacement:true});}
root.GoNowDiet={needs,loves,migrate,match,rank,fineDining,balance,balanceCopy,safeMeal};if(typeof module!=='undefined')module.exports=root.GoNowDiet;
})(typeof window==='undefined'?globalThis:window);
