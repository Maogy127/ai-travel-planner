/* Shared exact aliases; full place names remain as entered. */
(function(root){'use strict';
var aliases={
    la:['Los Angeles (LAX)','LAX'],lax:['Los Angeles (LAX)','LAX'],
    sf:['San Francisco (SFO)','SFO'],sfo:['San Francisco (SFO)','SFO'],
    ny:['New York (NYC)','NYC'],nyc:['New York (NYC)','NYC'],
    jfk:['New York (JFK)','JFK'],ewr:['New York (EWR)','EWR'],lga:['New York (LGA)','LGA'],
    dc:['Washington DC'],iad:['Washington DC (IAD)','IAD'],dca:['Washington DC (DCA)','DCA'],
    sea:['Seattle (SEA)','SEA'],hk:['Hong Kong (HKG)','HKG'],hkg:['Hong Kong (HKG)','HKG'],
    kl:['Kuala Lumpur (KUL)','KUL'],kul:['Kuala Lumpur (KUL)','KUL'],
    uk:['United Kingdom'],us:['United States'],usa:['United States'],
    hnl:['Honolulu (HNL)','HNL'],ord:['Chicago (ORD)','ORD'],lhr:['London (LHR)','LHR'],
    nrt:['Tokyo (NRT)','NRT'],hnd:['Tokyo (HND)','HND'],pvg:['Shanghai (PVG)','PVG'],pek:['Beijing (PEK)','PEK']
};
function normalize(value){var name=String(value||'').trim(),alias=aliases[name.toLowerCase()];
    if(alias)return Object.assign({name:alias[0],matched:true},alias[1]?{code:alias[1]}:{});
    if(/^[a-z]{3}$/i.test(name))return {name:name.toUpperCase(),code:name.toUpperCase(),matched:false};
    return {name:name,matched:false};
}
function isJunk(value){return (String(value||'').match(/\p{L}/gu)||[]).length<2;}
var api={normalize:normalize,isJunk:isJunk};root.GoNowPlaces=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
