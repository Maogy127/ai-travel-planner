(function(root){
'use strict';
function parseToday(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!isNaN(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value?value:null;}
function localDate(zone,now){var p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now||new Date()).map(function(x){return [x.type,x.value];}));return p.year+'-'+p.month+'-'+p.day;}
function status(trip,options){options=options||{};var today=parseToday(options.today)||localDate(options.timeZone||trip.timeZone,options.now);if(!trip.snapshot)return {label:'Draft',kind:'draft',today:today};if(parseToday(trip.start)&&parseToday(trip.end)&&today>=trip.start&&today<=trip.end)return {label:'In progress',kind:'progress',today:today};if(parseToday(trip.start)&&trip.start>today){var n=Math.round((Date.parse(trip.start)-Date.parse(today))/86400000);return {label:'Upcoming · '+n+' days',kind:'upcoming',days:n,today:today};}return {label:'Ready',kind:'ready',today:today};}
var api={parseToday:parseToday,localDate:localDate,status:status};root.GoNowDashboard=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
