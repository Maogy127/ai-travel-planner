/* Evidence is explicit dietary claims in title/desc, or dedicated dietary tags.
   A generated title mentioning a cuisine preference is not a venue claim. */
(function(root){
'use strict';
function match(item,prefs){
 const selected=(prefs||[]).filter(p=>p!=='No restrictions');
 const text=[item.title,item.desc].join(' ').toLowerCase();
 const tags=(Array.isArray(item.tags)?item.tags:[]).map(t=>String(t).toLowerCase());
 if(!selected.length)return {status:'unknown',reason:'No diet preference set'};
 const supported=selected.filter(p=>{
   const label=p.toLowerCase(), pattern=label.replace('-', '[- ]');
   return tags.includes(label)||new RegExp('\\b'+pattern+' (?:options|menu|meals|dishes)\\b').test(text);
 });
 if(supported.length===selected.length)return {status:'supported',reason:supported.join(', ')+' options listed'};
 return {status:'unknown',reason:'Diet info not confirmed — check the menu'};
}
function rank(items,prefs){return items.map((item,index)=>({item,index,yes:item.kind==='meal'&&match(item,prefs).status==='supported'})).sort((a,b)=>Number(b.yes)-Number(a.yes)||a.index-b.index).map(x=>x.item);}
root.GoNowDiet={match,rank};if(typeof module!=='undefined')module.exports=root.GoNowDiet;
})(typeof window==='undefined'?globalThis:window);
