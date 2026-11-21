/* Oahu Day Builder: user intent is saved; times, travel and prep are derived. */
(function () {
'use strict';
let KEY = 'gonow:daybuilder:oahu-demo-2026-11';
let planSource=null;
// Templates need not carry the curated sample's weather or optional fields.
const sourcePlan=()=>{
    const plan=planSource||window.OAHU_SAMPLE||{};
    return {...plan, days:Array.isArray(plan.days)?plan.days:[], weather:{text:'',...plan.weather}};
};
const HOTEL = 'Kahala';
let stayOverride='';
const WAIKIKI = 'Waikiki';
const clone = value => JSON.parse(JSON.stringify(value));
// Remove only trailing clock/slot labels, or a trailing sunrise/sunset label
// when the old clock is in that period. Preserve descriptive words elsewhere.
function cleanTimeTitle(title, oldStart) {
    return String(title).replace(/\s*[—–]\s*\d{1,2}(?::\d{2})?\s*[AP]M\b.*$/i, '')
        .replace(/\s*(?:[—–]\s*)?\d{1,2}(?::\d{2})?\s*[AP]M\s+(?:entry\s+)?slot\b.*$/i, '')
        .replace(/\s*[—–]\s*(sunrise|sunset)(?:\s+photos)?$/i, (all, word) =>
            oldStart != null && (word.toLowerCase() === 'sunrise' ? oldStart < 600 : oldStart >= 960) ? '' : all).trim();
}
function overlaps(items, start, duration, id) {
    return items.filter(i => i.id !== id && Number.isFinite(i.start) && i.start < start + duration && i.end > start);
}
function canShiftUnlocked(items,id,start){
    const item=items.find(i=>i.id===id);
    return !!item&&!item.locked&&Number.isFinite(start)&&start>=0&&start+item.duration<=1440&&!overlaps(items,start,item.duration,id).length;
}
function shiftConflicts(items, start, duration, id) {
    const result = clone(items).filter(i => i.id !== id).sort((a,b) => a.start-b.start);
    let end = start + duration;
    for (const item of result) {
        if (item.end <= start) continue;
        if (item.start < end) {
            if (item.locked) return {error:'Cannot shift past locked item: ' + item.title};
            const length = item.end-item.start;
            item.start = item.preferred = end; item.end = end + length; item.manualTime = true; item.shifted = true;
            if (item.end > 1440) return {error:'There is not enough time left in this day.'};
            end = item.end;
        } else break;
    }
    return {items:result};
}
const clean = value => String(value).replace(/\p{Extended_Pictographic}/gu, '').trim();
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function parse(text) {
    const match = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    return match ? (+match[1] % 12) * 60 + +match[2] + (match[3].toUpperCase() === 'PM' ? 720 : 0) : null;
}
function clock(minutes) {
    return (Math.floor(minutes / 60) % 12 || 12) + ':' + String(minutes % 60).padStart(2, '0') + (minutes >= 720 ? ' PM' : ' AM');
}
function range(start, end) {
    return clock(start) + '–' + clock(end);
}
function place(title) {
    if (/Kewalo|dive|parasail/i.test(title)) return 'Kewalo Basin';
    if (/Kualoa|Aunty Pat|Jurassic|Grab-and-go breakfast/i.test(title)) return 'Kualoa Ranch';
    if (/Diamond Head.*entry|Reserve to Diamond/i.test(title)) return 'Diamond Head';
    if (/Senia|Chinatown/i.test(title)) return 'Chinatown';
    if (/Kahala|palms/i.test(title)) return HOTEL;
    if (/Ala Moana|Magic Island|Makai Market/i.test(title)) return 'Ala Moana';
    if (/Lanikai|Kailua/i.test(title)) return 'Kailua';
    if (/Makapu/i.test(title)) return 'Makapuu';
    if (/HNL/i.test(title)) return 'HNL';
    return WAIKIKI;
}
// oahu.js Nov 26 dinner/return: 15–20 / 20–30 min; Nov 27 dive: 20–30 min;
// Nov 26 Diamond Head exit: 15–20 min; Kualoa shuttle: 55–70 min;
// Nov 28 Kailua departure: 40–45 min, Kailua→Makapuu: 25–35 min.
// Nov 27 Kewalo→Ala Moana: 15–20 min walk; Kahala↔Senia (Chinatown): 30–40 min.
const routes = {
    'Kahala palms|Waikiki': 30, 'Kahala|Waikiki': 20, 'Kahala|Kewalo Basin': 30, 'Diamond Head|Waikiki': 20,
    'Kualoa Ranch|Waikiki': 60, 'Kahala|Kailua': 45, 'Kailua|Makapuu': 35, 'Kahala|Chinatown': 35,
    'Kewalo Basin|Ala Moana': 20
};
const walks = new Set(['Kewalo Basin|Ala Moana']);
const isWalk = (from, to) => walks.has(from + '|' + to) || walks.has(to + '|' + from);
// Short names used in "you'd miss …" notes for dressy dinners.
const venue = booking => booking.short || (booking.dressy ? 'La Mer' : booking.title);
function commuteMinutes(from, to) {
    // oahu.js Nov 26 prep/photos: ten minutes along the beach and back.
    if ([from, to].includes('Kahala palms') && [from, to].includes(HOTEL)) return 10;
    if (from === to) return 0;
    return routes[from + '|' + to] ?? routes[to + '|' + from] ?? 30;
}
function roadMode(item = {}, day = {}, ctx = {}) {
    const plan = sourcePlan(), sourceDay = plan.days.find(d => d.date === day.date) || {};
    const mode = item.transportMode || item.pick?.transportMode || ctx.transportMode || day.transportMode || plan.transportMode;
    if (/uber|rideshare|lyft|taxi/i.test(mode || '')) return 'Uber';
    if (/walk/i.test(mode || '')) return 'Walk';
    if (/drive|car/i.test(mode || '')) return 'Drive';
    const car = day.car || sourceDay.car || plan.car;
    const level = typeof car === 'string' ? car : car?.level || '';
    if (/required|recommended|needed/i.test(level) && !/not needed/i.test(level)) return 'Drive';
    return /not needed|no car|rideshare|uber/i.test(level + ' ' + (car?.note || '')) ? 'Uber' : 'Drive';
}
// Shared road estimate for coordinate legs and pick scheduling.
function estimateTravel(a,b,mode='Uber') {
    if(![a?.lat,a?.lng,b?.lat,b?.lng].every(Number.isFinite)) {
        const minutes=a?.area&&a.area===b?.area?10:30;
        return {minutes,label:mode+' ~'+minutes+' min'};
    }
    const roadKm=1.4*Math.hypot((a.lat-b.lat)*111,(a.lng-b.lng)*111*Math.cos(b.lat*Math.PI/180));
    const walking=roadKm<=0.8;
    const minutes=Math.max(walking?5:10,Math.round(roadKm/(walking?4.5:roadKm>10?35:25)*60/5)*5);
    return {roadKm,minutes,label:(walking?'Walk':mode==='Walk'?'Uber':mode)+' ~'+minutes+' min'};
}
// Candidates must fit the outgoing road leg as well as the activity itself.
// Meals swap for restaurants serving that meal; activities swap for activities.
const MEAL_WORD=/\b(breakfast|brunch|lunch|dinner|supper)\b/i;
function mealSlot(item) {
    const m=String(item?.title||'').match(MEAL_WORD);
    if(m)return ({brunch:'breakfast',supper:'dinner'})[m[1].toLowerCase()]||m[1].toLowerCase();
    return item?.kind==='meal'?'any':null;
}
function slotCandidates({item,previous,next,catalog,inPlan=[],date,mode='Uber'}) {
    // An untitled meal takes its slot from the clock, so a 7 AM bakery is swapped for breakfast places only.
    const byClock=t=>!Number.isFinite(t)?'any':t<630?'breakfast':t<900?'lunch':t>=1020?'dinner':'any';
    let meal=mealSlot(item);if(meal==='any')meal=byClock(item.start??item.preferred);
    const food=p=>Array.isArray(p.meals)&&p.meals.length>0;
    return catalog.filter(p=>!inPlan.includes(p.id)&&(meal?food(p)&&(meal==='any'||p.meals.includes(meal)):!food(p))).map(p=>{
        // A following travel row already covers the road leg, so it is not counted twice.
        // Without coordinates on both ends, keep the plan's existing gap instead of guessing a 30-min ride.
        const known=next&&[p.lat,p.lng,next.lat,next.lng].every(Number.isFinite);
        const travel=next&&next.kind!=='travel'&&known?estimateTravel(p,next,mode):{minutes:next&&Number.isFinite(item.end)?Math.max(0,next.start-item.end):0,label:''};
        const slot=(next?.start??item.end)-item.start-travel.minutes;
        const natural=Number(p.duration)||60;
        // A meal can be quicker than usual (min 15 min); activities keep their full time.
        const duration=meal?Math.min(natural,slot):natural;
        const candidate={...p,title:p.name,preferred:item.start,duration,hours:p.parsedHours||p.hours,
            closed:[...(p.closed||[]),...(p.closedDates||[]).map(date=>({date})),...(p.closedDays?.length?[{weekdays:p.closedDays}]:[])]};
        const distance=estimateTravel(previous||item,p);
        return {pick:p,duration,slot,travel,candidate,distance:distance.roadKm??distance.minutes};
    }).filter(r=>r.duration>=(meal==='breakfast'?15:meal?30:1)&&r.duration<=r.slot&&!blockedOn(r.candidate,date))
      .sort((a,b)=>a.distance-b.distance||a.pick.name.localeCompare(b.pick.name));
}
function leg(from, to, mode = 'Drive') {
    const minutes = from === to ? 5 : commuteMinutes(from, to);
    const label = (from === to || minutes === 10 || isWalk(from,to) ? 'Walk' : mode) + ' ~' + Math.max(5,Math.round(minutes/5)*5) + ' min';
    return {minutes, label};
}
// Reservation windows and booking lead times are not activity durations.
function parseDuration(text) {
    text = String(text || '');
    const pattern = /\b(\d+(?:\.\d+)?)\s*(h(?:ours?|rs?)?|min(?:utes?)?)\b/gi;
    for (const match of text.matchAll(pattern)) {
        const before = text.slice(0, match.index);
        const after = text.slice(match.index + match[0].length);
        if (/\b(?:within|book|reserve|arrive|leave)\s*(?:about\s*)?$/i.test(before) ||
            /^\s*(?:in advance|ahead|notice|early|before|after)\b/i.test(after)) continue;
        if (!/(?:\babout|\ballow|[~≈])\s*$/i.test(before) &&
            !/(?:^|[.!?]\s*)$/.test(before) &&
            !/^\s*(?:tour|hike|walk|ride|class|session|open-air)\b/i.test(after)) continue;
        return +match[1] * (/^h/i.test(match[2]) ? 60 : 1);
    }
    return null;
}
function duration(item) {
    return parseDuration(item.desc) ?? 60;
}
function convert(item = {}) {
    return {
        fixedBooking:item.fixedBooking, flight:item.flight, flightDirection:item.flightDirection, airport:item.airport, inboundRide:item.inboundRide, transportMode:item.transportMode, locked:!!item.locked, category:item.category, area:item.area, lat:item.lat, lng:item.lng, photo:item.photo, price:item.price, costEstimate:item.costEstimate, movementMinutes:item.movementMinutes, closed:item.closed, hours:item.hours, rules:item.rules, needsTicket:item.needsTicket, booking:item.booking, tour:item.tour, bookingLabel:item.bookingLabel, bookable:item.bookable, booked:item.booked, id: item.id, sourceId: item.id, desc: item.desc, wellness: item.wellness, title: clean(item.title || 'Activity'), place: item.pick ? item.place : place(item.title || 'Activity'), preferred: parse(item.time),
        duration: item.kind==='flight'?0:item.pick ? item.duration : duration(item), manualTime:!!item.pick, walkNext: /approx\. 5 min walk/.test(item.travelToNext || ''), kind: item.kind, tags: item.tags || (/intro dive/i.test(item.title) ? ['dive'] : /sunset/i.test(item.title) ? ['sunset'] : []),
        estimate: !/(?:About|allow about|2\.5)\s*\d*\.?\d* h\b/i.test(item.desc),
        detail: parse(item.time) === null ? item.time + ' · confirm flight time' : ''
    };
}
function operatingRules(item) {
    if (['travel','flight'].includes(item.kind)) return item;
    const title=String(item.title||'').toLowerCase();
    const rule=Object.assign({},...(window.OAHU_PLACE_RULES||[]).filter(r=>(r.titleStart ? title.startsWith(r.name.toLowerCase()) : title.includes(r.name.toLowerCase()))));
    return {...rule,...item,closed:item.closed||rule?.closed,hours:item.hours||rule?.hours};
}
function closedOn(item,date) {
    const rules=operatingRules(item);
    if(rules.hours?.week && !rules.hours.week[new Date(date+'T12:00:00Z').getUTCDay()].length)return {weekdays:[new Date(date+'T12:00:00Z').getUTCDay()]};
    return (rules.closed||[]).find(r=>r.date===date || (r.weekdays||[]).includes(new Date(date+'T12:00:00Z').getUTCDay())) || null;
}
function shortDate(date) { return new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}); }
function blockedOn(item,date,ctx={}) {
    if(closedOn(item,date))return 'Closed '+shortDate(date);
    const start=item.preferred ?? item.start ?? 540, end=start+(item.duration||60);
    const rules=operatingRules(item);
    if(rules.hours?.week && !rules.hours.week[new Date(date+'T12:00:00Z').getUTCDay()].some(([a,b])=>start>=a&&end<=b))return 'Outside opening hours';
    if(rules.hours && (!rules.hours.date||rules.hours.date===date) && (start<rules.hours.open || end>rules.hours.close))return 'Outside opening hours';
    if(!['travel','flight'].includes(item.kind) && ((item.tags||[]).includes('dive') || /\b(?:dive|diving|scuba)\b/i.test(item.title||''))) {
        const departure=ctx.departureDate||sourcePlan().end||sourcePlan().days.at(-1)?.date;
        if(departure){
            // An unknown flight uses midnight: safe for any departure time.
            const flight=Date.parse(departure+'T00:00:00Z')/60000+(parse(ctx.flightTime||'')||0);
            if(flight-(Date.parse(date+'T00:00:00Z')/60000+end)<1440)return 'No diving within 24h of your flight';
        }
    }
    return null;
}
function nearestAllowed(item,date,ctx={}) {
    return (ctx.dates||sourcePlan().days.map(d=>d.date)).slice().sort((a,b)=>Math.abs(Date.parse(a)-Date.parse(date))-Math.abs(Date.parse(b)-Date.parse(date)) || b.localeCompare(a)).find(d=>!blockedOn(item,d,ctx)) || null;
}
function buildSuggested(date) {
    const day = sourcePlan().days.find(day => day.date === date);
    if (!day) return {date, items: [], unscheduled: []};
    const sourceItems=(day.items || []).filter(Boolean);
    let items = sourceItems.map((item,index)=>convert({...item,id:item.id||date+'-'+index}));
    if (planSource && planSource.id !== 'oahu-demo-2026-11') {
        items.forEach((item,index)=>{item.locked=!!sourceItems[index].locked;if(item.preferred===null)item.textTime=sourceItems[index].time;});
        return {date, items, unscheduled:clone(day.unscheduled||[])};
    }
    items.forEach((item, index) => {
        if (item.kind === 'travel' && items[index + 1]) {
            item.to = items[index + 1].place;
            const minutes = (day.items[index].travelToNext || day.items[index].desc).match(/(\d+)(?:[–-](\d+))? min/);
            if (minutes) item.duration = +(minutes[2] || minutes[1]);
        }
    });
    if (date === '2026-11-26') {
        // Morning source ranges use the upper end, except the documented 2 PM return.
        const morningDurations = [15, 90, 20, 70, 15, 150, 60];
        items.forEach((item, index) => {
            if (index < morningDurations.length) item.duration = morningDurations[index];
            else item.duration = duration(day.items[index]);
            item.estimate = false;
        });
        // The locked reservation documents its full 7:30–9:30 PM window.
        items[12].duration = 120;
        Object.assign(items[0], {place: HOTEL, to: 'Diamond Head'});
        Object.assign(items[1], {preferred: 360, duration: 90, locked: true});
        Object.assign(items[2], {place: 'Diamond Head', to: WAIKIKI});
        Object.assign(items[3], {place: WAIKIKI, to: 'Kualoa Ranch', locked: true, fixedBooking: true});
        Object.assign(items[6], {place: 'Kualoa Ranch', to: WAIKIKI, locked: true, fixedBooking: true});
        Object.assign(items[7], {id: 'return-hotel', place: WAIKIKI, to: HOTEL});
        Object.assign(items[8], {id: 'free', flex: true});
        Object.assign(items[9], {id: 'prep-dress', kind: 'prep', place: HOTEL});
        Object.assign(items[10], {id: 'photos', place: 'Kahala palms', tags: ['sunset']});
        Object.assign(items[12], {id: 'lamer', place: WAIKIKI, locked: true, dressy: true});
        // Dinner travel becomes a connector; the hotel return remains on the day card.
        items[12].inboundRide = {...items[11], duration: 20};
        // The absorbed rides keep their card details inside the dinner box.
        items[12].extraSources = [items[11].sourceId, items[13].sourceId];
        items.splice(13, 1);
        items.splice(11, 1);
        items[items.findIndex(i => i.id === 'lamer')].prepBlock = items.find(i => i.kind === 'prep');
        items = items.filter(i => i.kind !== 'prep');
    }
    if (date === '2026-11-27') {
        // Dive, Ala Moana, hotel prep, then the locked 6:00–8:00 PM Senia booking.
        const [ride, dive, lunch, shop, toHotel, prep, toDinner, dinner, home] = items;
        [[ride, 30], [dive, 180], [lunch, 40], [shop, 175]].forEach(([item, minutes]) => { item.duration = minutes; });
        items.forEach(item => { item.estimate = false; });
        Object.assign(ride, {place: HOTEL, to: 'Kewalo Basin'});
        Object.assign(dive, {id: 'dive-1127'});
        Object.assign(lunch, {id: 'lunch-1127'});
        Object.assign(shop, {id: 'shopping'});
        Object.assign(toHotel, {id: 'uber-kahala', place: 'Ala Moana', to: HOTEL, duration: 30, pickup: true});
        Object.assign(prep, {id: 'prep-senia', kind: 'prep', place: HOTEL, duration: 60});
        Object.assign(dinner, {id: 'senia', place: 'Chinatown', locked: true, dressy: true, short: 'Senia', venue: 'Senia',
            duration: 120, prepBlock: prep,
            inboundRide: {...toDinner, place: HOTEL, duration: 35, label: 'Uber ~30–40 min, est. $20–30'},
            extraSources: [toDinner.sourceId]});
        Object.assign(home, {id: 'uber-home', place: 'Chinatown', to: HOTEL, duration: 35, pickup: true});
        items = [ride, dive, lunch, shop, toHotel, dinner, home];
    }

    if (!day.flightsEdited && date === '2026-11-25' && items.find(i => /flight|(?:arriv|land).*HNL/i.test(i.title))) Object.assign(items.find(i => /flight|(?:arriv|land).*HNL/i.test(i.title)), {flight:true, locked:true, textTime:'Add flight time', preferred:null, detail:'Sample arrival: 5:30 PM — add your actual flight time.'});

    // The flight remains an unknown-time anchor until the traveler supplies a time.
    if (!day.flightsEdited && date === '2026-11-29') items.filter(item => /flight|HNL/i.test(item.title)).slice(-1).forEach(item => {
        item.locked = true;
        item.title = 'Flight (add your time)';
        item.flight = true;
        item.textTime = 'Add flight time';
        item.detail = '';
        item.preferred = null;
    });
    return {date, items, unscheduled: clone(day.unscheduled||[])};
}
// Source ideas remain available for Swap and the draft activity library.
const chestOnly = [{id: 'magic-island', time: '5:15 PM', kind: 'sight', title: 'Magic Island sunset',
    desc: 'Ala Moana Beach Park. Be in place by about 5:30 PM; sunset about 5:48 PM.'}];
function trayItems() {
    const all = sourcePlan().days.flatMap(day => day.items || []).filter(Boolean);
    if (planSource && planSource.id !== 'oahu-demo-2026-11') {
        return all.filter(item=>!['travel','flight','stay'].includes(item.kind)).map((item,index)=>({
            ...convert({...item,id:item.id||'idea-'+index}), sourceId:item.id||'idea-'+index,
            id:'chest-'+index, preferred:null, locked:false
        }));
    }
    const patterns = [/Beginner intro dive/, /Waikiki parasail/, /Jurassic Adventure/, /Black Friday shopping/,
        /^Royal Hawaiian Center/, /palms — sunset/, /^Magic Island/, /^Waikiki Beach sunset/, /Free time at the Kahala/,
        /Lanikai Pillbox/, /^Makapuʻu Lighthouse Trail/, /Diamond Head —/];
    return patterns.map((pattern, index) => {
        const source = all.find(item => pattern.test(item.title)) || chestOnly.find(item => pattern.test(item.title));
        if (!source) return null;
        const item = convert(source);
        Object.assign(item, {sourceId: item.id, id: 'chest-' + index, preferred: null, locked: false});
        if (index === 5) Object.assign(item, {place: 'Kahala palms', duration: 60, estimate: false});
        if (index === 8) item.title = 'Hotel downtime';
        return item;
    }).filter(Boolean).concat([{id: 'chest-bar', title: 'Sunset bar / cocktails', place: WAIKIKI, duration: 60,
        estimate: true, tags: ['alcohol'], detail: '21+'}]);
}
// Reuse the same connector/reflow path for template hotel changes. Untimed
// arrival/departure blocks retain their position and descriptive clock labels.
function replanStay(items, oldStay, newStay) {
    const prepared=items.map(item=>{
        const copy=clone(item);
        ['place','from','to','title','desc'].forEach(k=>{if(typeof copy[k]==='string'&&oldStay)copy[k]=copy[k].split(oldStay).join(newStay);});
        if(copy.kind==='stay'){copy.place=newStay;copy.desc=newStay;}
        if(copy.from===oldStay)copy.from=newStay;
        return copy;
    });
    const timed=prepared.filter(i=>Number.isFinite(i.start)||parse(i.time||'')!==null);
    if(!timed.length)return prepared;
    const result=reflow({items:timed.map(i=>({...i,place:i.place||i.title,preferred:Number.isFinite(i.start)?i.start:parse(i.time),duration:Number.isFinite(i.duration)?i.duration:Number.isFinite(i.end)&&Number.isFinite(i.start)?i.end-i.start:60}))}).items;
    return prepared.map(item=>{
        const updated=result.find(i=>i.id===item.id);
        if(!updated)return item;
        if(item.locked){updated.start=Number.isFinite(item.start)?item.start:updated.start;updated.end=Number.isFinite(item.end)?item.end:updated.end;}
        updated.time=clock(updated.start);
        if(updated.travel)updated.travelToNext=updated.travel.label+' · from '+newStay+' area — confirm route';
        return updated;
    });
}
function reflow(day, ctx = {}) {
    const output = [];
    const fa=ctx.flightAnswers, active=fa&&(fa.flightsStep||fa.arrivalTime||fa.returnTime), fw=active&&window.GoNowFlights?window.GoNowFlights.windowFor(fa):null;
    const first=sourcePlan().days[0]?.date,last=sourcePlan().days.at(-1)?.date;
    const boundary=fw&&(day.date===first||day.date===last);

    const ages = (Array.isArray(ctx.ages)?ctx.ages:[]).filter(function(x){return (typeof x==='number'||typeof x==='string')&&String(x).trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=110;}).map(Number);
    const rejected=[];
    // A time the traveler set by hand stays put; opening hours become a heads-up instead of moving it off the day.
    const overridden=(item,reason)=>item.hoursOk&&/opening hours/i.test(reason||'');
    const raw = clone(day.items).filter(item=>{const reason=blockedOn(item,day.date,ctx);if(boundary&&item.locked&&/flight/i.test(reason||''))return true;if(overridden(item,reason))return true;if(reason)rejected.push({...item,blockedReason:reason});return !reason;});
    raw.forEach(item => { delete item.notes; delete item.noteSources; delete item.notePriority; delete item.noteSource; });
    if(stayOverride)raw.forEach(item=>{['place','to'].forEach(k=>{if(item[k]===HOTEL)item[k]=stayOverride;});if(item.prepBlock&&item.prepBlock.place===HOTEL)item.prepBlock.place=stayOverride;});
    let previous = null;
    function warn(item, note, source) {
        item.notes ||= [];
        item.noteSources ||= [];
        if (item.notes.includes(note)) return;
        item.notes.push(note);
        item.noteSources.push(source);
    }
    // Prep belongs before sunset photos, but never after the dressy booking.
    const dinner = raw.find(item => item.dressy);
    const prepId=dinner?.prepBlock?.id || 'prep-dress';
    if (dinner && !raw.some(i=>i.id===prepId) && !(day.unscheduled||[]).some(i=>i.id===prepId)) {
        let at = raw.findIndex(item => item.id === 'photos');
        if (at < 0 || at > raw.indexOf(dinner)) at = raw.indexOf(dinner);
        raw.splice(at, 0, dinner.prepBlock || {id: 'prep-dress', title: 'Get ready / change + makeup', place: stayOverride||HOTEL,
            duration: 60, preferred: 990, kind: 'prep'});
    }
    for (let index = 0; index < raw.length; index++) {
        const item = raw[index];
        if (item.textTime) {
            item.start = null;
            item.end = null;
            output.push(item);
            continue;
        }
        const mode = roadMode(item, day, ctx);
        let travel = previous ? leg(previous.to || previous.place, item.place, mode) : {minutes: 0, label: ''};
        if(previous&&[previous.lat,previous.lng,item.lat,item.lng].every(Number.isFinite)){
            travel=estimateTravel(previous,item,mode);
        }
        if (previous?.place === 'Kahala palms' && item.place === WAIKIKI) {
            item.walkBack = {depart: previous.end, arrive: previous.end + 10};
            travel = leg(HOTEL, WAIKIKI, mode);
            if (item.inboundRide) travel = {minutes: item.inboundRide.duration, label: mode + ' ~' + item.inboundRide.duration + ' min'};
        } else if (item.inboundRide?.label && previous && (previous.to || previous.place) === item.inboundRide.place) {
            travel = {minutes: item.inboundRide.duration, label: mode + ' ~' + item.inboundRide.duration + ' min'};
        }
        // Explicit rides already include arrival travel; free time and prep share a hotel room.
        if ((previous?.kind === 'travel' && previous.to === item.place) || (previous?.flex && item.kind === 'prep')) travel = {minutes: 0, label: ''};
        if (previous?.walkNext && previous.place === item.place) travel = {minutes: 5, label: 'Walk ~5 min'};
        // A ride booked from where you already are needs no connector.
        if (item.pickup && previous && (previous.to || previous.place) === item.place) travel = {minutes: 0, label: ''};
        const earliest = Math.max(previous ? previous.end + travel.minutes + (item.walkBack ? 10 : 0) : 0, boundary&&day.date===first&&!['flight','travel'].includes(item.kind)?fw.arrivalStart:0);
        item.start = (item.manualTime || item.locked) && item.preferred !== null ? item.preferred : Math.max(earliest, item.preferred ?? (previous ? 0 : 540));
        if (item.flex && !item.locked && !item.manualTime) {
            // Work backwards from the next anchor, reserving every intervening
            // activity, ride, automatic rinse and the dressy arrival buffer.
            const anchor = raw.findIndex((next, at) => at > index && next.locked && !next.textTime);
            let latest = anchor < 0 ? 1440 : raw[anchor].preferred - (raw[anchor].dressy ? 15 : 0);
            let destination = anchor < 0 ? null : raw[anchor].place;
            const end = anchor < 0 ? raw.length : anchor;
            for (let at = end - 1; at > index; at--) {
                const next = raw[at];
                if (destination) latest -= commuteMinutes(next.to || next.place, destination);
                latest -= next.flex ? 0 : next.duration + ((next.tags || []).includes('dive') ? 30 : 0);
                if (!next.flex && next.preferred != null && next.preferred > latest) latest = -Infinity;
                destination = next.place;
            }
            if (destination) latest -= commuteMinutes(item.place, destination);
            item.duration = Math.max(0, Math.min(item.duration, latest - item.start));
            if (item.duration < 15) continue;
        }
        if(boundary&&day.date===first&&!item.locked&&!['flight','travel'].includes(item.kind))item.start=Math.max(item.start,earliest);
        item.end = item.start + item.duration;
        if(boundary&&!['flight','travel'].includes(item.kind)){
            const conflict=(day.date===first&&(item.start<fw.arrivalStart||item.end>1440))||(day.date===last&&(fw.departure<=480||item.end>fw.leave||/flight/i.test(blockedOn({...item,preferred:item.start},day.date,ctx)||'')));
            if(conflict){if(item.locked)warn(item,item.title+' conflicts with your flight');else {rejected.push(item);continue;}}
        }
        const block=blockedOn({...item,preferred:item.start},day.date,ctx);
        if(overridden(item,block))warn(item,'May be closed at this time');
        else if(block&&!(boundary&&item.locked&&/flight/i.test(block))){rejected.push({...item,blockedReason:block});continue;}
        if (previous) {
            const buffer = item.dressy ? 15 : 0;
            const depart = item.locked && !item.textTime ? item.start - buffer - travel.minutes : previous.end;
            item.travel = {...travel, depart, arrive: depart + travel.minutes, late: item.locked && earliest + buffer > item.start};
            if (item.travel.late) item.travel.label += ' · leave by ' + clock(depart);
            if (item.locked && !item.textTime && earliest + buffer > item.start) {
                warn(previous, 'Ends ' + clock(previous.end) + " — you'd miss " + venue(item), undefined, 0);
            }
            // An explicit ride already includes travel: no redundant short walk.
            if (!travel.minutes || (previous.kind === 'travel' && previous.to === item.place)) item.travel = null;
        }
        if ((item.tags || []).some(tag => tag === 'alcohol' || tag === 'bar') && ages.some(age => age < 21)) {
            warn(item, '21+ only in the US — skip or go alcohol-free', undefined, 3);
        }
        if ((item.tags || []).includes('rental')) warn(item, "Check the operator's age rules", undefined, 3);
        for (const booking of raw.filter(booking => booking.locked && !booking.textTime && booking.id !== item.id)) {
            const beforeBooking = index < raw.indexOf(booking);
            const requiredTravel = commuteMinutes(item.to || item.place, booking.place);
            if (!item.locked && beforeBooking && item.end + requiredTravel + (booking.dressy ? 15 : 0) > booking.preferred) {
                warn(item, 'Ends ' + clock(item.end) + " — you'd miss " + venue(booking), undefined, 0);
            }
            if ((!item.locked || item.custom) && item.start < booking.preferred + booking.duration && item.end > booking.preferred) {
                warn(item, 'Overlaps ' + venue(booking), undefined, 1);
            }
        }
        const sunset = String(sourcePlan().weather.text || '').match(/sunset approx\. (\d{1,2}:\d{2} PM)/i);
        if ((item.tags || []).includes('sunset') && sunset && item.start > parse(sunset[1])) {
            warn(item, item.start > parse(sunset[1]) + 30 ? 'After dark — sunset ~' + sunset[1] : 'Starts after sunset (~' + sunset[1] + ')', undefined, item.start > parse(sunset[1]) + 30 ? -1 : 4);
        }
        output.push(item);
        previous = item;
        if ((item.tags || []).includes('dive')) {
            const prep = {id: 'prep-' + item.id, title: 'Rinse off & change', place: item.place,
                start: item.end, end: item.end + 30, duration: 30, kind: 'prep', detail: '~30 min'};
            output.push(prep);
            previous = prep;
        }
    }
    return {items: output, unscheduled:rejected, conflicts: output.flatMap(item => (item.notes || []).map((note, index) => ({
        id: item.id, note, source: item.noteSources[index]
    })))};
}
const svg = path => `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const icons = {
    handle: svg('<path d="M8 5h1m6 0h1M8 12h1m6 0h1M8 19h1m6 0h1"/>'),
    up: svg('<path d="M5 12l7-7 7 7M12 5v14"/>'),
    down: svg('<path d="M5 12l7 7 7-7M12 5v14"/>'),
    remove: svg('<path d="M3 11h18v10H3ZM3 11V8a5 5 0 015-5h8a5 5 0 015 5v3M10 10h4v5h-4Z"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4M12 15v2"/>'),
    unlock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.6-1.7M12 15v2"/>'),
    add: '+ Add', delete: svg('<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>')
};
const labels = {handle: 'Move', up: 'Move up', down: 'Move down', remove: 'Remove from day', add: 'Add to day', delete: 'Delete booking'};
function button(action, title, disabled = false) {
    const label = esc(labels[action] + ' ' + title);
    return `<button type="button" data-testid="db-${action}" data-db-action="${action}"${disabled ? ' disabled aria-disabled="true"' : ''} aria-label="${label}" title="${label}">${icons[action]}</button>`;
}

// Page-session state that survives planRender remounts (selected day, open boxes, shared copy).
const session = {date: '2026-11-26', open: new Set(), shared: null, sharedKey: null, active: null};
const reducedMotion = () => (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    document.documentElement.classList.contains('reduce-motion');
const sourceCache = {};
// Saved days from before sourceId existed map renamed ids back to their card item.
function sourceOf(item, date) {
    if (item.sourceId) return item.sourceId;
    if (!sourceCache[date]) sourceCache[date] = new Map(buildSuggested(date).items.map(i => [i.id, i.sourceId]));
    return sourceCache[date].get(item.id) || item.id;
}
const fixedBooking = item => !!(item.booked || (item.custom && item.booked !== false) || item.flight || item.kind === 'flight' || item.fixedBooking);
const lockable = item => !item.textTime && item.kind !== 'prep';
const uidFor = (date, id) => (date + '-' + id).replace(/[^\w-]/g, '_');
// Locking pins the shown start and end; unlocking restores the item's own preference.
function toggleLock(item, shown) {
    if (fixedBooking(item)) return !!item.locked;
    if (item.locked) {
        item.locked = false;
        if (item.userLocked) {
            item.preferred = item.basePreferred ?? null;
            if (item.baseDuration != null) item.duration = item.baseDuration;
        }
        delete item.userLocked; delete item.basePreferred; delete item.baseDuration;
        return false;
    }
    item.basePreferred = item.preferred ?? null;
    item.baseDuration = item.duration;
    if (shown && shown.start != null) {
        item.preferred = shown.start;
        item.duration = shown.end - shown.start;
    }
    item.locked = true;
    item.userLocked = true;
    return true;
}
// Compact share form: only days that differ from the suggested day.
function exportDays(days, flightTime) {
    const out = {};
    const tray = trayItems();
    Object.entries(days || {}).forEach(([date, day]) => {
        const base = buildSuggested(date).items;
        const pool = base.concat(tray);
        const items = day.items.map(item => {
            if (item.custom) return {c: 1, b:item.booked, cl:item.closed, hr:item.hours, tg:item.tags, ru:item.rules, ot:item.originalTitle, id: item.id, t: String(item.title).slice(0, 100), p: item.preferred, d: item.duration, pl: item.place, s: item.sourceId, m: item.manualTime, e: item.estimate, l: item.locked ? 1 : 0, ...(item.hoursOk ? {h: 1} : {})};
            const original = pool.find(candidate => candidate.id === item.id);
            if (original && !item.routeReview && !item.originalTitle && !item.manualTime && !!original.locked === !!item.locked && original.preferred === item.preferred && original.duration === item.duration) return item.id;
            const entry = {id: item.id, s: item.sourceId, m: item.manualTime, e: item.estimate, l: item.locked ? 1 : 0, p: item.preferred, d: item.duration};
            if(item.overlapNote)entry.ov=item.overlapNote;
            // A hand-set time outside opening hours is kept (with a heads-up) after reload.
            if(item.hoursOk)entry.h=1;
            if(item.routeReview)entry.rv=item.title;
            if(item.originalTitle){entry.ot=item.originalTitle;entry.tt=item.title;}
            if (item.checkinSwap) entry.a = item.title;
            if (item.userLocked) Object.assign(entry, {u: 1, bp: item.basePreferred, bd: item.baseDuration});
            return entry;
        });
        const trayIds = [];
        const u = (day.unscheduled || []).map(({id,sourceId,title,originalTitle,needsTime,place,duration,estimate,locked}) => ({id,sourceId,title,originalTitle,needsTime,place,duration,estimate,locked}));
        if (JSON.stringify(items) !== JSON.stringify(base.map(item => item.id)) || u.length) {
            out[date] = {cg:!!day.chronological, i: items, t: trayIds, u};
        }
    });
    return Object.keys(out).length || flightTime ? {f: flightTime || '', d: out} : null;
}
function importDays(data) {
    const days = {};
    const minutes = value => (value === null || (Number.isFinite(value) && value >= 0 && value <= 1440)) ? value : undefined;
    if (!data || typeof data !== 'object') return {days, flightTime: ''};
    const dates = new Set(sourcePlan().days.map(day => day.date));
    Object.entries(data.d && typeof data.d === 'object' ? data.d : {}).forEach(([date, day]) => {
        if (!dates.has(date) || !day || !Array.isArray(day.i) || !Array.isArray(day.t)) return;
        const tray = trayItems();
        const pool = sourcePlan().days.flatMap(d => buildSuggested(d.date).items).concat(tray);
        const find = id => { const found = pool.find(item => item.id === id); return found ? clone(found) : null; };
        const items = day.i.map(entry => {
            if (typeof entry === 'string') return find(entry);
            if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') return null;
            if (entry.c) {
                const start = minutes(entry.p), length = minutes(entry.d);
                if (typeof entry.t !== 'string' || !entry.t.trim() || (start === undefined) || !length) return null;
                return {closed:entry.cl,hours:entry.hr,tags:entry.tg,rules:entry.ru,originalTitle:entry.ot, id: entry.id.slice(0, 40), title: entry.t.slice(0, 100), preferred: start, duration: length,
                    place: typeof entry.pl === 'string' ? entry.pl.slice(0, 40) : 'Other', locked: !!entry.l, booked:entry.b, custom: true, sourceId: entry.s || entry.id, manualTime: !!entry.m, estimate: entry.e !== false, ...(entry.h ? {hoursOk: true} : {})};
            }
            const item = find(entry.id) || pool.find(i => i.sourceId === entry.s) && clone(pool.find(i => i.sourceId === entry.s));
            if (!item) return null;
            if (['Beach walk','Gentle stretch'].includes(entry.a)) Object.assign(item,{title:entry.a,wellness:{type:entry.a==='Beach walk'?'walk':'recovery'},checkinSwap:true});
            if(entry.ov)item.overlapNote=entry.ov;
            if(entry.rv){item.title=entry.rv;item.routeReview=true;}
            if(entry.ot){item.originalTitle=entry.ot;item.title=entry.tt;}
            item.id = entry.id; item.manualTime = !!entry.m; if (entry.e !== undefined) item.estimate = entry.e; if (entry.h) item.hoursOk = true;
            item.locked = fixedBooking(item) || !!entry.l;
            if (minutes(entry.p) !== undefined) item.preferred = entry.p;
            if (minutes(entry.d)) item.duration = entry.d;
            if (entry.u && item.locked) Object.assign(item, {userLocked: true, basePreferred: minutes(entry.bp) ?? null, baseDuration: minutes(entry.bd) ?? item.duration});
            return item;
        }).filter(Boolean);
        days[date] = {date, chronological:!!day.cg, items, unscheduled: (day.u || []).filter(e => e && typeof e.id === "string" && typeof e.title === "string" && e.duration > 0).map(e => ({...clone(pool.find(i => i.sourceId === e.sourceId) || {}), ...e, custom: !pool.some(i => i.sourceId === e.sourceId), preferred:null}))};
    });
    return {days, flightTime: typeof data.f === 'string' && parse(data.f) !== null ? data.f : ''};
}

function importForPlan(data,plan) {
    const previous=planSource;
    try {planSource=plan;return importDays(data);} finally {planSource=previous;}
}
function mount(root, ctx = {}) {
    const nextPlan=ctx.plan||null;
    // Disconnect the prior mount before headers ask for the current schedule.
    session.active=null;
    const nextKey='gonow:daybuilder:'+(nextPlan?.id||'oahu-demo-2026-11');
    if(KEY!==nextKey){session.date=nextPlan?.id==='oahu-demo-2026-11'?'2026-11-26':nextPlan?.days?.[0]?.date||'2026-11-26';session.open.clear();Object.keys(sourceCache).forEach(k=>delete sourceCache[k]);}
    KEY=nextKey;planSource=nextPlan;
    if(!sourcePlan().days.some(d=>d.date===session.date))session.date=sourcePlan().days[0]?.date||'2026-11-26';
    // Reconstruct flight anchors before importing saved or shared builder IDs.
    // In the untouched demo the existing sample cards remain unchanged.
    const flightAnswers=ctx.flightAnswers;
    if(window.GoNowFlights&&flightAnswers&&(flightAnswers.flightsStep||flightAnswers.arrivalTime||flightAnswers.returnTime)){
        const w=window.GoNowFlights.windowFor(flightAnswers),ends=[sourcePlan().days[0],sourcePlan().days.at(-1)];
        ends.forEach((d,index)=>{
            const direction=index?'return':'arrival',at=index?w.departure:w.landing;
            let anchor=d.items.find(i=>i.flightDirection===direction||i.kind==='flight'||(!index&&/land at|arrival flight/i.test(i.title)));
            if(!anchor){anchor={id:direction+'-flight',prep:[],bring:[],sources:[]};d.items.push(anchor);}
            Object.assign(anchor,{title:window.GoNowFlights.label(flightAnswers,direction),flightDirection:direction,kind:'flight',time:clock(at),duration:0,locked:true});
            if(index)d.items.filter(i=>i.kind==='travel'&&/airport|HNL/i.test(i.title)).forEach(i=>{i.time=clock(w.leave);i.desc='About '+w.road+' min.';});
            d.flightsEdited=true;
        });
    }
    let saved = {};
    if (ctx.shared) {
        const key = JSON.stringify(ctx.initial || null);
        if (!session.shared || session.sharedKey !== key) {
            session.shared = importDays(ctx.initial);
            session.sharedKey = key;
        }
        saved = session.shared;
    } else {
        session.shared = null;
        session.sharedKey = null;
        try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    }
    const days = saved.days || {};
    if(window.GoNowFlights&&flightAnswers&&(flightAnswers.flightsStep||flightAnswers.arrivalTime||flightAnswers.returnTime)){
        const w=window.GoNowFlights.windowFor(flightAnswers);
        [sourcePlan().days[0],sourcePlan().days.at(-1)].forEach((d,index)=>{
            const stored=days[d.date];if(!stored)return;
            if(index)stored.items.filter(i=>i.flight&&i.kind==='travel'&&/airport|HNL/i.test(i.title+' '+(d.items.find(s=>s.id===i.id)?.title||''))).forEach(i=>{
                Object.assign(i,{flight:false,title:d.items.find(s=>s.id===i.id)?.title||'Leave for the airport',preferred:w.leave,duration:w.road,manualTime:true});delete i.textTime;delete i.detail;
            });
            d.items.filter(i=>i.flightDirection).forEach(i=>{if(!stored.items.some(s=>s.id===i.id))stored.items.push(convert(i));});
        });
    }
    if (ctx.shared) saved.days = days;
    let flightTime = saved.flightTime || sourcePlan().flightTime || '';
    if(window.GoNowFlights&&flightAnswers&&(flightAnswers.flightsStep||flightAnswers.arrivalTime||flightAnswers.returnTime))flightTime=clock(window.GoNowFlights.windowFor(flightAnswers).departure);
    if(/^\d{1,2}:\d{2}$/.test(flightTime)){const parts=flightTime.split(':').map(Number);flightTime=clock(parts[0]*60+parts[1]);}
    if (ctx.dock) root.classList.add('db-dock');
    root.innerHTML = ctx.dock
        ? '<div class="db-workspace"><div class="db-content"></div><aside class="db-dock-tray" id="activity-tray" data-testid="activity-tray"></aside></div><div class="db-print-all"></div><div class="db-sr" role="status" aria-live="polite" data-testid="db-live"></div>'
        : '<div class="db-content"></div><div class="db-print-all"></div><div class="db-sr" role="status" aria-live="polite" data-testid="db-live"></div>';
    const content = root.querySelector('.db-content');
    const printAll = root.querySelector('.db-print-all');
    const live = root.querySelector('[data-testid=db-live]');
    let previousConflicts = new Map();
    let addedConflicts = [];
    let date = session.date;
    let resetOpen = false;
    let editingTime = null;
    let picked = null;
    let drag = null;
    let lastResult = {items: []};
    let suppressClick = false;

    function current() {
        if (!days[date]) days[date] = buildSuggested(date);
        days[date].unscheduled ||= [];
        return days[date];
    }
    function draftItems() {
        return sourcePlan().days.flatMap(d => visibleItems(days[d.date] || buildSuggested(d.date), d.date));
    }
    function ruleContext(){return {...ctx,flightTime,departureDate:sourcePlan().end};}
    function clearBlocked(){document.querySelectorAll?.('[data-testid=blocked-message]').forEach(node=>node.remove());}
    function block(item,on,applySuggestion,origin){
        const reason=blockedOn(item,on,ruleContext());
        if(!reason)return null;
        const suggestion=nearestAllowed(item,on,ruleContext());
        document.querySelectorAll?.('[data-testid=blocked-message]').forEach(node=>node.remove());
        root.querySelector('[data-testid=blocked-message]')?.remove();
        const message=document.createElement('div');
        message.dataset.testid='blocked-message';message.setAttribute('aria-live','polite');message.setAttribute('role','status');
        const weekday=value=>new Date(value+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'});
        const title=String(item.title||'Activity');
        const place=String(item.place&&item.place!=='Other'?item.place:title.split(/ [—–] /).at(-1)).replace(/(?: (?:Center|Centre|State Monument))+$/i,'').trim();
        const text=/diving/i.test(reason)?'Dive too close to flight':place+(/closed/i.test(reason)?' closed '+weekday(on):' outside hours');
        message.innerHTML='<span data-testid="blocked-reason">'+esc(text)+'</span>'+'<span class="db-blocked-actions">'+(suggestion?'<button type="button" data-testid="blocked-suggest">Add to '+weekday(suggestion)+'</button>':'')+'<button type="button" data-testid="blocked-dismiss" aria-label="Dismiss">×</button></span>';
        const destination=origin||root.querySelector('[data-db-id="'+item.id+'"]')||root.querySelector('[data-testid=db-day-list]');
        root.querySelector('dialog[open]')?.close();
        destination.append(message);
        destination.scrollIntoView?.({block:'nearest',behavior:'auto'});
        message.querySelector('[data-testid=blocked-dismiss]').onclick=()=>message.remove();
        if(suggestion)message.querySelector('button').onclick=()=>{message.remove();applySuggestion(suggestion);};
        return {ok:false,reason,suggestion};
    }
    function addToDay(nextDate, spec) {
        if (!spec) return {ok: false, reason: 'Missing activity'};
        if (!sourcePlan().days.some(d => d.date === nextDate)) return {ok:false, reason:'Choose a trip date'};
        if (spec.time && toTime(spec.time) === null) return {ok:false, reason:'Enter a clock time'};
        const pool = sourcePlan().days.flatMap(d => buildSuggested(d.date).items).concat(trayItems());
        const base = spec.chestId ? pool.find(i => i.id === spec.chestId)
            : spec.sourceId ? pool.find(i => i.sourceId === spec.sourceId) : null;
        const identity = spec.sourceId || base?.sourceId || base?.id || ('own:' + String(spec.title || '').trim().toLowerCase());

        let item = base ? clone(base) : {title:String(spec.title || '').trim().slice(0,100), place:spec.place || 'Other', duration:Number(spec.duration) || 60, estimate:true, custom:true};
        if (!item.title) return {ok:false, reason:'Name the activity'};
        if(spec.wellness)item.wellness=clone(spec.wellness);
        Object.assign(item, {sourceId:identity, preferred:null, locked:false, closed:spec.closed || item.closed,hours:spec.hours || item.hours, rules:spec.rules || item.rules || [], tags:spec.tags || item.tags || []});
        delete item.textTime; delete item.flight;
        item.preferred=spec.time?toTime(spec.time):null;
        const blocked=block(item,nextDate,on=>addToDay(on,spec),spec.origin||root.querySelector('[data-testid=db-day-list]'));if(blocked)return blocked;
        item.id = 'instance-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
        selectDay(nextDate, false);
        const d = current();
        if (spec.time) { item.preferred = toTime(spec.time); item.manualTime = true; d.items.push(item); } else d.unscheduled.push(item);
        save();
        render({id: item.id, zone: 'day'});
        if (spec.schedule) openTransfer(item.id, 'tray', 'schedule');
        announce(item.title + ' added. This does not book the stop.');
        return {ok: true, id: item.id};
    }
    function announce(message) {
        live.textContent = message + (addedConflicts.length ? ' Heads-up: ' + addedConflicts.join('; ')  : '');
        addedConflicts = [];
    }
    function save() {
        clearBlocked();
        if(ctx.saveDraft&&!ctx.shared)ctx.saveDraft({days,flightTime});
        if (ctx.shared) { saved.flightTime = flightTime; return; }
        try { localStorage.setItem(KEY, JSON.stringify({days, flightTime})); } catch (e) {}
    }
    function hiddenSet(on) {
        return ctx.hidden ? ctx.hidden(on) : new Set();
    }
    function visibleItems(day, on) {
        const hidden = hiddenSet(on);
        return day.items.filter(item => !hidden.has(sourceOf(item, on)));
    }
    // Mode changes (Relax, an edited clock time) adjust a copy used for reflow.
    // Saved order, locks and custom items stay as the traveler left them.
    function adjustedItems(items, on) {
        if (!ctx.adjust) return items;
        return items.map(item => {
            if (item.manualTime) return item;
            const change = ctx.adjust(sourceOf(item, on), on, item);
            return change ? {...item, ...change} : item;
        });
    }
    function dayResult(stored, on) {
        let intent=adjustedItems(visibleItems(stored,on),on);
        if(ctx.flightAnswers&&(ctx.flightAnswers.flightsStep||ctx.flightAnswers.arrivalTime||ctx.flightAnswers.returnTime)&&window.GoNowFlights){
            const a=ctx.flightAnswers,w=window.GoNowFlights.windowFor(a),first=sourcePlan().days[0].date,last=sourcePlan().days.at(-1).date;
            if(on===first||on===last)intent=intent.map(i=>{
                const direction=i.flightDirection||((i.flight||i.kind==='flight')?(on===first?'arrival':'return'):null);
                if(direction){const copy={...i,title:window.GoNowFlights.label(a,direction),flight:false,flightDirection:direction,kind:'flight',duration:0,preferred:direction==='arrival'?w.landing:w.departure,locked:true};delete copy.textTime;delete copy.detail;return copy;}
                if(on===last&&i.kind==='travel'&&/airport|HNL/i.test(i.title))return {...i,preferred:w.leave,duration:w.road,manualTime:true};
                return i;
            });
        }
        const result=reflow({...stored,items:stored.chronological?intent.map(i=>({...i,manualTime:true})):intent}, {...ctx,flightTime});
        if(stored.chronological)result.items.sort((a,b)=>(a.start ?? Infinity)-(b.start ?? Infinity));
        return result;
    }
    function schedule() {
        return {
            flightTime,
            days: sourcePlan().days.map(day => {
                const stored = days[day.date] || buildSuggested(day.date);
                return {date: day.date, items: dayResult(stored, day.date).items};
            })
        };
    }
    function listFor(zone) {
        return zone === 'tray' ? current().unscheduled : current().items;
    }
    function openSwap(id) {
        const on=date, shown=dayResult(current(),on).items, index=shown.findIndex(i=>i.id===id), item=shown[index];
        const suggesting=!!(item?.locked&&window.goNowAccount?.group&&!window.goNowAccount.owner());
        if(!item||((item.locked||item.booked)&&!suggesting))return;
        const catalog=ctx.swapCatalog();
        if(catalog===null){
            // Places for this city are still loading (new session or device): wait briefly, then open.
            const wait=document.createElement('dialog');wait.setAttribute('data-testid','swap-sheet');wait.className='swap-sheet';wait.innerHTML='<button type="button" data-close aria-label="Close">×</button><h2>Swap</h2><p role="status" data-testid="swap-loading">Loading places…</p>';
            root.appendChild(wait);wait.showModal();let tries=0;const close=()=>{clearInterval(timer);wait.close();wait.remove();};wait.querySelector('[data-close]').onclick=close;
            const timer=setInterval(()=>{const next=ctx.swapCatalog();if(next!==null||++tries>40){close();if(next&&next.length)openSwap(id);else announce('Couldn’t load places. Try again.');}},500);
            return;
        }
        const identify=i=>catalog.find(p=>p.id===i.sourceId||p.id===i.id||String(i.title||'').toLowerCase().includes(p.name.toLowerCase()));
        const used=schedule().days.flatMap(d=>d.items.map(i=>identify(i)?.id||i.sourceId||i.id));
        const origin=identify(shown[index-1]||{})||identify(item)||item;
        const candidates=slotCandidates({item,previous:origin,next:shown[index+1],catalog,inPlan:used,date:on,mode:roadMode(item,{date:on},ctx)});
        const sheet=document.createElement('dialog');sheet.setAttribute('data-testid','swap-sheet');sheet.className='swap-sheet';
        sheet.innerHTML='<button type="button" data-close aria-label="Close">×</button><h2>Swap</h2><input type="search" aria-label="Search places" placeholder="Search places"><div data-results></div><button type="button" data-testid="swap-free">Remove, keep time free</button>';
        const finish=choice=>{
            if(suggesting){const p=choice?.pick;window.goNowAccount.change(id,p?{action:'swap',title:item.title,alternative:{title:p.name,sourceId:p.id,place:p.area||p.name,duration:choice.duration}}:{action:'remove',title:item.title});sheet.close();sheet.remove();return;}
            const before=clone(days), restorePicks=ctx.swapPicks?.(identify(item),choice?.pick);
            days[on]={...current(),chronological:true,items:shown.filter(i=>i.id!==id).map(i=>({...i,preferred:i.start,manualTime:true}))};
            if(choice){const p=choice.pick;days[on].items.push({id:p.id,sourceId:p.id,custom:true,title:p.name,place:p.area||p.name,lat:p.lat,lng:p.lng,kind:p.meals?.length?'meal':'activity',preferred:item.start,duration:Math.min(choice.duration,choice.slot),manualTime:true,hours:p.hours,closed:choice.candidate.closed});}
            days[on].items.sort((a,b)=>a.preferred-b.preferred);
            sheet.close();sheet.remove();save();render();
            ctx.undo?.('Swapped ·',()=>{Object.keys(days).forEach(k=>delete days[k]);Object.assign(days,before);restorePicks?.();save();render();});
        };
        const results=sheet.querySelector('[data-results]');
        function filter(){const q=sheet.querySelector('input').value.toLowerCase();const rows=candidates.filter(r=>(r.pick.name+' '+r.pick.category).toLowerCase().includes(q)).slice(0,5);results.innerHTML=rows.map((r,n)=>'<button type="button" data-testid="swap-option" data-choice="'+n+'">'+esc(r.pick.name)+' · '+r.duration+' min'+(r.travel.label?' · '+esc(r.travel.label):'')+'</button>').join('')||'<p>'+(q?'No matches':'Nothing else fits this time')+'</p>';results.querySelectorAll('button').forEach(b=>b.onclick=()=>finish(rows[+b.dataset.choice]));}
        sheet.querySelector('input').oninput=filter;sheet.querySelector('[data-close]').onclick=()=>{sheet.close();sheet.remove();};sheet.querySelector('[data-testid=swap-free]').onclick=()=>finish(null);
        root.appendChild(sheet);filter();sheet.showModal();
    }
    function positionMessage(id, zone) {
        const list = zone === 'tray' ? current().unscheduled : visibleItems(current(), date);
        const index = list.findIndex(i => i.id === id);
        return `${list[index].title}, position ${index + 1} of ${list.length}.`;
    }
    function lockButton(i, title, uid) {
        if (fixedBooking(i)) return `<span class="db-lock-toggle db-fixed-lock" data-testid="db-lock"><span data-testid="db-locked-tag">${icons.lock}<small>Locked</small></span></span>`;
        const label = i.locked ? 'Unlock time' : 'Lock ' + title;
        return `<button type="button" class="db-lock-toggle" data-testid="db-lock" data-db-action="lock" aria-pressed="${!!i.locked}" aria-label="${esc(label)}" aria-describedby="db-title-${uid}" title="${esc(label + ' — ' + title)}">${icons[i.locked ? 'lock' : 'unlock']}${i.locked ? '<small>Locked</small>' : ''}</button>`;
    }
    function pair(i, tray, options = {}) {
        const on = options.date || date;
        const print = !!options.print;
        const uid = uidFor(on, i.id);
        const src = sourceOf(i, on);
        const transport = ['travel','flight'].includes(i.kind) || i.flight;
        const flightDirection=i.flightDirection||(i.flight?(on===sourcePlan().days[0].date?'arrival':'return'):null);
        const flightEdit= !tray&&!print&&(flightDirection||(i.id==='pick-airport'&&!sourcePlan().days.find(d=>d.date===on)?.items.some(i=>i.kind==='flight')));
        const cardFlightTime = on === '2026-11-25' ? (i.manualTime && i.preferred != null ? clock(i.preferred) : '') : flightTime;
        const transportType = i.flight || /flight|land at|airport/i.test(i.title) ? 'plane' : /shuttle/i.test(i.title) ? 'shuttle' : /bus/i.test(i.title) ? 'bus' : 'car';
        const paths = {plane:'M2 13l8-3V3l2-1 2 1v7l8 3v2l-8-1v5l3 2v1l-5-1-5 1v-1l3-2v-5l-8 1Z',car:'M4 10l2-6h12l2 6M3 10h18v9H3ZM6 19v3m12-3v3M6 14h2m8 0h2',bus:'M5 3h14v16H5ZM5 11h14M8 19v3m8-3v3M8 15h1m6 0h1',shuttle:'M3 6h14l4 6v7H3ZM3 12h18M7 6v6m6-6v6M6 19v3m12-3v3'};
        const transportIcon = `<svg class="transport-icon" data-transport-icon="${transportType}" aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="${paths[transportType]}"/></svg>`;
        const hhmm = n => String(Math.floor(n / 60)).padStart(2,'0') + ':' + String(n % 60).padStart(2,'0');
        const canEditTime = !ctx.shared && !tray && !print && !flightEdit && !i.textTime && i.kind !== 'prep';
        const travelTime = i.kind === 'travel';
        // Reuse persisted manualTime/estimate and duration; explicit arrival is start + duration.
        const arrivalEstimate = travelTime && (!i.manualTime || i.estimate);
        const showArrivalEstimate = travelTime && i.manualTime && i.estimate;
        const editor = canEditTime && editingTime === on + '|' + i.id ? `<form class="db-time-editor" data-testid="activity-time-form" novalidate><p>${travelTime ? 'Edit departure time' : 'Edit scheduled time'}${i.locked || i.booked ? ' · stays locked' : ''}</p><fieldset><legend>${travelTime ? 'Travel time' : 'Activity time'}</legend><label>${travelTime ? 'Departure' : 'Start'}<input name="start" type="time" value="${hhmm(i.start)}" required></label><label>${travelTime ? 'Arrival' : 'End'} <span data-time-estimate>${travelTime ? (arrivalEstimate ? '(est. from travel duration)' : '') : i.estimate ? '(estimate from default duration)' : ''}</span><input name="end" type="time" ${travelTime && !arrivalEstimate ? 'data-manual="true"' : ''} value="${hhmm(i.end)}"></label><label ${travelTime ? 'hidden' : ''}>Duration (minutes)<input name="duration" type="number" min="1" value="${Math.max(1, (i.end ?? 0) - (i.start ?? 0)) || i.duration}"></label><button>${travelTime ? 'Save departure time' : 'Save activity time'}</button></fieldset><p role="alert" data-testid="activity-time-error"></p><button type="button" data-db-action="close-time">Close time editor</button></form>` : '';
        const blocker = tray ? (i.rules || []).find(r => !r.optional && !r.unconfirmed && r.minAge && (Array.isArray(ctx.ages)?ctx.ages:[]).filter(function(x){return (typeof x==='number'||typeof x==='string')&&String(x).trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=110;}).map(Number).some(age => age < r.minAge)) : null;
        const detail = (ctx.detail ? ctx.detail(src, on, i) : '') + (tray ? (i.rules || []).map(r => `<p>${esc(r.text || r)}</p>`).join('') : '');
        const open = !!detail && (print || session.open.has(on + '|' + i.id));
        const title = i.flight&&!ctx.flightAnswers?.flightsStep?(flightDirection==='arrival'?'Sample · lands ~5:30 PM':'Sample · departs ~10:00 AM'):(!tray && ctx.titleFor && ctx.titleFor(src, on, i)) || i.title;
        // Arrival/Return supplies direction; retain full wording for assistive technology.
        const cardTitle = flightDirection ? title.replace(/\b(?:lands|departs)\s*/i, '') : title;
        const movable = !i.locked && i.kind !== 'prep' && !print;
        const canLock = !tray && !print && (lockable(i) || fixedBooking(i));
        const classes = ['db-pair', transport && 'db-transport', flightDirection && 'db-flight-card', i.notes && 'db-conflict', i.locked && 'db-locked', i.userLocked && 'db-user-locked',
            i.kind === 'prep' && 'db-prep', i.flex && 'db-free', detail && 'db-expandable', open && 'is-open',
            picked?.id === i.id && picked.zone === (tray ? 'tray' : 'day') && 'db-picked'].filter(Boolean).join(' ');
        const moves = tray ? button('handle', title) + `<button type="button" data-testid="schedule-item" data-db-action="schedule">${i.needsTime ? 'Pick a time' : 'Schedule'}</button>${i.needsTime ? '<small>Needs a time</small>' : ''}` : (movable ? button('handle', title) + button('up', title) + button('down', title) + button('remove', title) : '');
        const actions = !tray && !print && i.kind !== 'prep' ? '<div class="db-item-actions"><button type="button" data-db-action="again">Add it again</button><button type="button" data-db-action="move-day">Move to another day</button></div>' : '';
        const lockChip = i.locked ? '<span class="db-lock"><svg width="12" height="14" viewBox="0 0 14 16" aria-hidden="true"><path d="M3 7V4a4 4 0 018 0v3M1 7h12v8H1Z" fill="none" stroke="currentColor"/></svg> Locked</span>' : '';
        const menuLabels = {handle: 'Drag to reorder', up: 'Move up', down: 'Move down', remove: 'Remove from day', delete: 'Delete booking'};
        const menuMoves = (moves + (i.custom && !print ? button('delete', title) : '')).replace(/(<button[^>]*data-db-action="([^"]+)"[^>]*>)([\s\S]*?)(<\/button>)/g,
            (_, start, action, icon, end) => start + icon + '<span>' + menuLabels[action] + '</span>' + end);
        const groupMember=!!(window.goNowAccount?.group&&!window.goNowAccount.owner());
        const swapAction = !tray && !print && ((!i.locked&&!i.booked)||groupMember) && !['prep','flight','travel','hotel'].includes(i.kind) && !/^check[ -]?(in|out)\b/i.test(i.title||'') && ctx.swapCatalog ? '<button data-testid="db-swap" data-db-action="swap">Swap</button>' : '';
        const availableActions = actions;
        const memberRemove=i.locked&&groupMember?button('remove',title).replace('</button>','<span>Remove from day</span></button>'):'';
        const menuItems = (swapAction + menuMoves + memberRemove + availableActions.replace('>Add it again', '>'+(window.GoNowIcons ? window.GoNowIcons.icon('plus',16) : '')+' Add it again').replace('>Move to another day', '>'+(window.GoNowIcons ? window.GoNowIcons.icon('arrow',16) : '')+' Move to another day')).replace(/<button /g, '<button role="menuitem" ');
        const hasMenu = !tray && !print && (i.custom || i.kind !== 'prep');
        const menuButton = hasMenu ? `<button type="button" data-testid="db-more" data-db-action="more" aria-haspopup="menu" aria-expanded="false" aria-controls="db-more-${uid}" aria-label="More actions for ${esc(title)}">${window.GoNowIcons ? window.GoNowIcons.icon('more',20) : ''}</button>` : '';
        const menu = hasMenu ? `<div hidden id="db-more-${uid}" data-testid="db-more-menu" role="menu">${menuItems}</div>` : '';
        const controls = moves || canLock || hasMenu ? `<div class="db-controls">${tray ? moves : menuButton}${canLock ? lockButton(i, title, uid) : ''}</div>` : '';
        const durationText = `${i.estimate ? '~' : ''}${i.duration} min`;
        const noteId = 'db-note-' + uid;
        const described = i.notes?.length ? ` aria-describedby="${esc(i.notes.map((_, index) => noteId + '-' + index).join(' '))}"` : '';
        const placeText = tray ? '' : `${esc(i.place)}${i.estimate ? ' · ' + durationText : ''}`;
        const heading = detail
            ? `<button type="button" class="db-expand" data-db-action="expand" data-testid="db-expand" id="db-title-${uid}" aria-expanded="${open}" aria-controls="db-detail-${uid}"${flightDirection ? ` aria-label="${esc(title)}"` : ''}><strong title="${esc(title)}">${esc(cardTitle)}</strong>${tray ? `<small>${placeText}</small>` : ''}</button>`
            : `<strong id="db-title-${uid}" title="${esc(title)}"${flightDirection ? ` aria-label="${esc(title)}"` : ''}>${esc(cardTitle)}</strong>${tray ? `<small>${placeText}</small>` : ''}`;
        const compact=(a,b)=>{const [x,xm]=clock(a).split(' '),[y,ym]=clock(b).split(' ');return `<span>${x}<span class="${xm===ym?'db-mer-dup':''}"> ${xm}</span></span><span>–${y} ${ym}</span>`;};
        const timeEl = tray ? '' : `<${canEditTime ? 'button type="button" data-db-action="edit-time"' : 'div'} class="db-time" data-testid="db-time" aria-label="${canEditTime ? 'Edit time: ' : ''}${esc(i.flight ? cardFlightTime || i.textTime : i.textTime || clock(i.start) + ' to ' + clock(i.end) + (showArrivalEstimate ? ' estimated arrival' : ''))}">${i.flight||i.flightDirection ? (flightDirection==='arrival'?'Arrival':'Return') : i.textTime ? esc(i.textTime) : compact(i.start,i.end)+(showArrivalEstimate ? '<span> est.</span>' : '')}</${canEditTime ? 'button' : 'div'}>`;
        const plus = detail && !tray && !print ? `<button type="button" class="db-plus" data-db-action="expand" aria-expanded="${open}" aria-controls="db-detail-${uid}" aria-label="Details for ${esc(title)}">${window.GoNowIcons ? window.GoNowIcons.icon('plus',18) : ''}</button>` : '';
        const lockedLabel = !fixedBooking(i) ? 'Locked time — unlock to move' : 'Locked booking — times are fixed';
        return `<div class="${classes}" data-testid="db-pair" data-db-id="${esc(i.id)}" data-db-zone="${tray ? 'tray' : 'day'}"${src ? ` data-db-source="${esc(src)}"` : ''}${described}${i.locked && !print ? ' tabindex="0" aria-label="' + esc(title + '. ' + lockedLabel) + '"' : ''}>
            ${transport ? transportIcon : !tray && ['activity','meal','sight'].includes(i.kind) && ctx.photoFor && ctx.photoFor(src) ? `<img class="db-thumb" src="${esc(ctx.photoFor(src))}" alt=""${ctx.photoCredit && ctx.photoCredit(src) ? ` title="${esc(ctx.photoCredit(src))}"` : ''}>` : ''}
            <div class="db-activity" data-testid="db-activity">
                ${heading}${tray ? '' : `<div class="db-meta">${timeEl}${canLock ? (i.locked ? `<span class="db-mini-lock" aria-hidden="true">${icons.lock}</span>` : '') : lockChip}${placeText && !transport ? `<small class="db-place">${placeText}</small>` : ''}</div>`}${flightEdit?`<input type="hidden" aria-label="Flight time" data-testid="db-flight-time" value="${Number.isFinite(i.preferred)?String(Math.floor(i.preferred/60)).padStart(2,'0')+':'+String(i.preferred%60).padStart(2,'0'):''}"><span data-testid="add-flight-time"><button type="button" data-testid="edit-flight" aria-haspopup="dialog" ${ctx.shared?'disabled':''}>Edit flight</button></span>`:''}${blocker ? `<small>Requires age ${esc(blocker.minAge)}+</small>` : ''}

                ${!tray && i.detail ? `<small>${esc(i.detail)}</small>` : ''}
                ${tray && !canLock ? lockChip : ''}
                ${i.kind === 'prep' ? '<span class="db-tag">auto</span>' : ''}
                ${tray ? controls : ''}
                ${i.overlapNote && !(i.notes || []).includes(i.overlapNote) ? `<p class="db-note">${esc(i.overlapNote)}</p>` : ''}${(i.notes || []).map((note, index) => `<p class="db-note ${/conflicts with your flight/.test(note)?'flight-conflict-notice':''}" id="${esc(noteId + '-' + index)}" data-testid="db-note"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="M8 1L15 14H1Z" fill="none" stroke="currentColor"/><path d="M8 5v4m0 2v1" stroke="currentColor"/></svg>${/conflicts with your flight/.test(note)?'<span class="flight-conflict-text" title="'+esc(note)+'">'+esc(note)+'</span> · <button data-flight-conflict-edit>Edit</button>':'Heads-up: '+esc(note)}${note.includes('diving') ? ` <a href="${esc(window.OAHU_SOURCES.dan)}" target="_blank" rel="noopener">DAN guidance</a>` : ''}</p>`).join('')}
            </div>
            ${tray ? '' : (controls || plus ? `<div class="db-side">${controls}${plus}</div>` : '')}
            ${menu}
            ${editor}
            ${detail ? `<div class="db-detail" id="db-detail-${uid}" data-testid="db-detail" role="region" aria-labelledby="db-title-${uid}"${open ? '' : ' hidden'}>${detail}</div>` : ''}</div>`;
    }
    function openTime(on, id) {
        if (ctx.shared) return;
        const item = (days[on] || buildSuggested(on)).items.find(i => i.id === id);
        if (item?.locked && window.goNowAccount?.group && !window.goNowAccount.owner()) { suggestLocked(item, 'time'); return; }
        editingTime = on + '|' + id;
        selectDay(on, false);
        root.querySelector('.db-dock-tray')?.classList.remove('is-open');
        document.querySelector('[data-testid=tray-toggle]')?.setAttribute('aria-expanded', 'false');
        const form = root.querySelector('[data-testid=activity-time-form]');
        if (form) {
            form.scrollIntoView({block: 'nearest'});
            (form.elements.start.disabled ? form.querySelector('[data-db-action=close-time]') : form.elements.start).focus();
        }
    }
    const toTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? Number(value.slice(0,2))*60 + Number(value.slice(3)) : null;
    function suggestLocked(item, action, extra={}) {
        const cloud=window.goNowAccount;if(!cloud?.group||cloud.owner())return false;
        if(action==='time'){
            const dialog=document.createElement('dialog');dialog.dataset.testid='group-time-suggestion';
            dialog.innerHTML='<form><label>Time<input type="time" required name="time"></label><button>Send suggestion</button><button type="button" data-close>Cancel</button></form>';
            document.body.append(dialog);dialog.showModal();dialog.oncancel=()=>dialog.remove();dialog.querySelector('[data-close]').onclick=()=>dialog.remove();
            dialog.querySelector('form').onsubmit=e=>{e.preventDefault();cloud.change(item.id,{time:clock(toTime(dialog.querySelector('input').value)),title:item.title});dialog.remove();};
        }else cloud.change(item.id,{action,title:item.title,...extra});
        return true;
    }
    function confirmUnlock(item, apply) {
        if(suggestLocked(item,'time'))return;
        const dialog = document.createElement('dialog');
        dialog.dataset.testid = 'unlock-confirm';
        dialog.addEventListener('cancel', () => dialog.remove());
        dialog.innerHTML = '<p>Unlock this item’s reserved time before changing it?</p><button data-testid="unlock-accept">Unlock this item</button><button data-testid="unlock-decline">Keep reserved time</button>';
        root.append(dialog); dialog.showModal();
        dialog.querySelector('[data-testid=unlock-decline]').onclick = () => dialog.remove();
        dialog.querySelector('[data-testid=unlock-accept]').onclick = () => { // Explicit move/time confirmation can release a reservation; the static tag cannot.
            if (fixedBooking(item)) item.locked = false;
            else toggleLock(item, lastResult.items.find(i => i.id === item.id));
            window.goNowAccount?.lock(item.id,false);
            save(); dialog.remove(); apply(); };
    }
    function reviewTransfers(day,item) {
        if(item.kind==='travel')return;
        day.items.forEach(ride=>{
            if(ride.kind==='travel' && (ride.place===item.place || ride.to===item.place || ride.from===item.place || ride.title.includes(item.place)) && !ride.routeReview) {
                ride.title+=' — route changed; review this transfer';ride.routeReview=true;
            }
        });
    }
    // Reorder rules: order wins. After a move, add or remove, the day's unlocked items
    // run back to back in the new order (previous end + travel), starting from the
    // day's first unlocked start time. Hand-set times on unlocked items are released
    // (lock an item to keep its time). Locked and booked items never move. If an
    // item cannot fit before a locked one, it goes right after it; if it cannot fit
    // the day at all, it goes to Needs a time. Only then is a conflict shown.
    const movable = i => i && !i.locked && !i.booked && !i.textTime && i.kind !== 'flight' && i.kind !== 'prep' && !fixedBooking(i);
    function releaseDay(on, movedId, before) {
        const d = days[on]; if (!d) return;
        const prior = dayResult(before || d, on).items;
        const lead = prior.find(i => movable(i) && i.start != null);
        d.chronological = false;
        d.items.forEach(i => {
            if (!movable(i)) return;
            i.preferred = null; delete i.manualTime; delete i.hoursOk; delete i.overlapNote; delete i.shifted;
        });
        const first = d.items.find(movable);
        if (first && lead) first.preferred = lead.start;
        // A reorder never silently drops a stop: if the new order runs it past opening hours,
        // it stays with a "May be closed" heads-up.
        keepOpen(on); settleDay(on); keepOpen(on); return overflowDay(on);
    }
    function keepOpen(on) { const d = days[on]; for (let n = 0; n < 8; n++) { const h = dayResult(d, on).unscheduled.find(i => /opening hours/i.test(i.blockedReason || '') && d.items.some(x => x.id === i.id)); if (!h) return; d.items.find(x => x.id === h.id).hoursOk = true; } }
    function settleDay(on) {
        const d = days[on]; if (!d) return;
        const misses = r => r.items.filter(i => !i.locked && (i.notes || []).some(t => /you'd miss/.test(t))).length;
        for (let n = 0; n < 8; n++) {
            const r = dayResult(d, on), count = misses(r);
            if (!count) return;
            const late = r.items.find(i => !i.locked && (i.notes || []).some(t => /you'd miss/.test(t)));
            const anchor = r.items.slice(r.items.indexOf(late) + 1).find(i => i.locked && !i.textTime);
            const at = anchor ? d.items.findIndex(i => i.id === anchor.id) : -1;
            if (at < 0) return;
            const victimAt = d.items.slice(0, at).map((i, k) => [i, k]).filter(([i]) => movable(i) && i.kind !== 'travel').map(([, k]) => k).pop();
            if (victimAt === undefined) return;
            const saved = clone(d.items);
            const [victim] = d.items.splice(victimAt, 1);
            d.items.splice(d.items.findIndex(i => i.id === anchor.id) + 1, 0, victim);
            const next = dayResult(d, on);
            if (misses(next) >= count || next.unscheduled.filter(i => !/opening hours/i.test(i.blockedReason || '')).length > r.unscheduled.filter(i => !/opening hours/i.test(i.blockedReason || '')).length) { d.items = saved; return; }
            keepOpen(on);
        }
    }
    // Anything that now runs past midnight goes to Needs a time instead of a fake late slot.
    function overflowDay(on) {
        const d = days[on]; if (!d) return [];
        const late = dayResult(d, on).items.filter(i => movable(i) && i.kind !== 'travel' && i.end != null && i.end > 1440).map(i => i.id);
        late.forEach(id => { const at = d.items.findIndex(i => i.id === id); if (at < 0) return; const [item] = d.items.splice(at, 1); Object.assign(item, {needsTime: true, preferred: null}); (d.unscheduled ||= []).push(item); });
        return late;
    }
    function sortDay(on) {
        const d=days[on];
        d.chronological=true;
        d.items.sort((a,b)=>(a.preferred ?? Infinity)-(b.preferred ?? Infinity));
    }
    function resolveTime(on, item, start, duration, apply, options={}) {
        const proposed={...item,start,preferred:start,duration};
        if(!(options.explicit&&/opening hours/i.test(blockedOn(proposed,on,ruleContext())||''))&&block(proposed,on,target=>{ // A suggested move leaves the original untouched until accepted.
            Object.values(days).forEach(d=>{d.items=d.items.filter(i=>i.id!==item.id);d.unscheduled=(d.unscheduled||[]).filter(i=>i.id!==item.id);});
            days[target] ||= buildSuggested(target);days[target].items.push({...item,preferred:start,manualTime:true,duration});
            root.querySelector('dialog[open]')?.remove();save();selectDay(target,false);
        }))return;
        days[on] ||= buildSuggested(on);
        const shown=dayResult(days[on],on).items;
        const hits=overlaps(shown,start,duration,item.id);
        // Preserve existing displayed clocks BEFORE moving the edited item.
        // Otherwise reflow would push every following flexible stop later first.
        const freeze=()=>days[on].items.forEach(raw=>{const v=shown.find(i=>i.id===raw.id);if(raw.id!==item.id&&v&&v.start!=null)Object.assign(raw,{preferred:v.start,duration:v.end-v.start});if(raw.prepBlock){const prep=shown.find(i=>i.id===raw.prepBlock.id);if(prep)Object.assign(raw.prepBlock,{preferred:prep.start,manualTime:true});}});
        if(!hits.length){freeze();apply();return;}
        const dialog=document.createElement('dialog');
        dialog.dataset.testid='move-conflict'; dialog.setAttribute('role','alertdialog');
        dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','conflict-title');
        dialog.innerHTML='<h2 id="conflict-title">This time overlaps</h2><ul>'+hits.map(i=>'<li>'+esc(i.title)+' · '+range(i.start,i.end)+'</li>').join('')+'</ul>'+hits.map(i=>'<button type="button" data-testid="conflict-replace" data-id="'+esc(i.id)+'" '+(i.locked?'disabled':'')+'>Replace '+esc(i.title)+'</button>'+(i.locked?'<p>Locked reservation — unlock it first to replace.</p>':'')).join('')+'<button type="button" data-testid="conflict-shift">Shift it later</button><button type="button" data-testid="conflict-keep">Keep both</button><button type="button" data-cancel>Cancel</button><p role="status"></p>';
        const opener=document.activeElement;
        root.append(dialog);dialog.showModal();
        const close=()=>{dialog.close();dialog.remove();opener?.focus();};
        dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
        dialog.addEventListener('keydown',e=>{
            if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
            if(e.key==='Tab'){e.preventDefault();e.stopPropagation();const buttons=[...dialog.querySelectorAll('button:not(:disabled)')];const at=buttons.indexOf(document.activeElement);buttons[(at+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}
        });
        dialog.querySelector('[data-cancel]').onclick=close;
        dialog.querySelectorAll('[data-testid=conflict-replace]').forEach(b=>b.onclick=()=>{
            const before=clone(days);
            const d=days[on], index=d.items.findIndex(i=>i.id===b.dataset.id);
            const derived=index<0 && shown.find(i=>i.id===b.dataset.id && i.kind==='prep');
            const candidate=index>=0?d.items[index]:derived;
            if(!candidate||candidate.locked)return;
            freeze();
            const replaced=index>=0?d.items.splice(index,1)[0]:clone(derived);
            replaced.needsTime=true;replaced.preferred=null;d.unscheduled.push(replaced);
            close();apply();
            if(ctx.undo)ctx.undo('Item moved to Needs a time.',()=>{Object.keys(days).forEach(k=>delete days[k]);Object.assign(days,before);save();render();});
        });
        dialog.querySelector('[data-testid=conflict-shift]').onclick=()=>{
            const shifted=shiftConflicts(shown,start,duration,item.id);
            if(shifted.error){dialog.querySelector('[role=status]').textContent=shifted.error;return;}
            const unsafe=shifted.items.find(i=>blockedOn({...i,preferred:i.start,duration:i.end-i.start},on,ruleContext()));
            if(unsafe){block({...unsafe,preferred:unsafe.start},on,target=>addToDay(target,{...unsafe,time:clock(unsafe.start)}));return;}
            freeze();
            shifted.items.forEach(v=>{const raw=days[on].items.find(i=>i.id===v.id);if(raw&&v.shifted){if(raw.preferred!==v.start){raw.originalTitle ||= raw.title;raw.title=cleanTimeTitle(raw.title,raw.preferred);}Object.assign(raw,{preferred:v.start,duration:v.end-v.start,manualTime:true});}});
            close();apply();
        };
        dialog.querySelector('[data-testid=conflict-keep]').onclick=()=>{freeze();item.overlapNote='Overlaps another stop — allow extra flexibility.';close();apply();};
    }
    function openTransfer(id, zone, mode) {
        const list = listFor(zone);
        let item = list.find(i => i.id === id);
        if(!item && zone==='tray'){item=lastResult.unscheduled.find(i=>i.id===id);if(item){current().items=current().items.filter(i=>i.id!==id);list.push(item);}}
        if (!item) return;
        const suggesting=!!(item.locked&&mode!=='again'&&window.goNowAccount?.group&&!window.goNowAccount.owner());
        if (item.locked && mode !== 'again' && !suggesting) { confirmUnlock(item, () => openTransfer(id, zone, mode)); return; }
        const dialog = document.createElement('dialog');
        dialog.addEventListener('cancel', () => dialog.remove());
        dialog.dataset.testid = mode === 'again' ? 'add-again-dialog' : mode === 'move-day' ? 'move-day-dialog' : 'schedule-dialog';
        const title = mode === 'again' ? 'Add it again' : mode === 'move-day' ? 'Move to another day' : 'Schedule';
        const explanation = mode === 'again' ? 'Creates a separate copy. The original stays where it is.' : mode === 'move-day' ? 'Moves this same item. It leaves the original day.' : '';
        dialog.setAttribute('aria-labelledby', 'db-transfer-title');
        dialog.innerHTML = `<h2 id="db-transfer-title">${title}</h2>${explanation ? `<p>${explanation}</p>` : ''}<form><label>Target date<select name="date">${sourcePlan().days.map(d => `<option ${d.date === date ? 'selected' : ''}>${d.date}</option>`).join('')}</select></label><label>${mode === 'move-day' ? 'Time on new day' : 'Start clock time (AM/PM)'}${mode === 'schedule' ? '' : ' — optional'}<input name="start" type="time" value="${mode === 'move-day' ? ((n)=>n == null ? '' : String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'))(lastResult.items.find(i => i.id === id)?.start) : ''}" ${mode === 'schedule' ? 'required' : ''}></label>${mode === 'schedule' ? '<label>End clock time (AM/PM) — optional<input name="end" type="time"></label><p>Start only: end is an estimate from default duration.</p>' : ''}<button>${mode === 'again' ? 'Add a copy' : mode === 'move-day' ? 'Move' : 'Schedule'}</button><button type="button" data-cancel>Cancel</button><p role="alert"></p></form>`;
        root.append(dialog); dialog.showModal();
        dialog.querySelector('[data-cancel]').onclick = () => dialog.remove();
        dialog.querySelector('form').onsubmit = e => {
            e.preventDefault(); const form = e.target, target = form.elements.date.value, start = toTime(form.elements.start.value);
            if(suggesting){const change={action:'move-day',date:target,title:item.title};if(start!==null)change.time=clock(start);window.goNowAccount.change(id,change);dialog.remove();return;}
            if(mode === 'schedule' && start === null){form.querySelector('[role=alert]').textContent='Pick a start time.';return;}
            const end = form.elements.end?.value ? toTime(form.elements.end.value) : null;
            if (end !== null && (start === null || end <= start)) { form.querySelector('[role=alert]').textContent = 'End must be after start'; return; }
            const copy = clone(item);
            if (mode === 'again') copy.id = 'instance-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);

            copy.locked = false; delete copy.start; delete copy.end; delete copy.textTime; delete copy.travel; delete copy.notes; delete copy.userLocked; delete copy.basePreferred; delete copy.baseDuration;
            copy.originalTitle ||= copy.title;
            copy.title = cleanTimeTitle(copy.title, item.preferred);
            copy.preferred = start; delete copy.manualTime;
            const apply = () => { const before=clone(days[date]||current());
            if(mode !== 'again') list.splice(list.findIndex(i => i.id === id), 1);
            if(mode === 'move-day') {
                const old=days[date];
                reviewTransfers(old,item);
                if(target!==date)releaseDay(date,null,before);
            }
            days[target] ||= buildSuggested(target); days[target].unscheduled ||= [];
            if (start === null) {copy.needsTime=true; days[target].unscheduled.push(copy);}
            else { copy.manualTime = true; copy.estimate = end === null; if (end !== null) copy.duration = end-start; days[target].items.push(copy); }
            if(start !== null) sortDay(target);
            dialog.remove(); editingTime = null; save(); selectDay(target, false);
            if (start !== null) { root.querySelector('.db-dock-tray')?.classList.remove('is-open'); document.querySelector('[data-testid=tray-toggle]')?.setAttribute('aria-expanded','false'); }
            };
            if (start === null) {if(!block(copy,target,on=>{form.elements.date.value=on;form.requestSubmit();}))apply();}
            else resolveTime(target, copy, start, end === null ? copy.duration : end-start, apply);
        };
    }
    function openOwn(name = '', focusStart = false) {
        if(root.querySelector('[data-testid=add-own-sheet]'))return;
        const dialog=document.createElement('dialog');dialog.className='add-own-sheet';dialog.dataset.testid='add-own-sheet';
        dialog.setAttribute('aria-labelledby','add-own-title');
        dialog.innerHTML=`<h2 id="add-own-title">Add my own</h2><form novalidate><label>Name<input name="name" data-testid="add-own-name" required maxlength="100"></label><label>Start<input name="start" data-testid="add-own-start" type="time" required></label><label>End <small>(optional)</small><input name="end" data-testid="add-own-end" type="time"></label><label>Place <small>(optional)</small><input name="place" data-testid="add-own-place" maxlength="100"></label><label class="row"><input name="booked" type="checkbox" data-testid="add-own-booked">Booked</label><p role="alert" data-testid="add-own-note"></p><div class="row"><button data-testid="add-own-submit">Add</button><button type="button" data-own-cancel>Cancel</button></div></form>`;
        root.append(dialog);
        const close=()=>{dialog.close();dialog.remove();root.querySelector('[data-testid=day-add-own]')?.focus();};
        dialog.oncancel=e=>{e.preventDefault();close();};dialog.querySelector('[data-own-cancel]').onclick=close;
        const form=dialog.querySelector('form');form.elements.name.value=name;
        form.onsubmit=e=>{
            e.preventDefault();const title=form.elements.name.value.trim(),start=toTime(form.elements.start.value),end=form.elements.end.value?toTime(form.elements.end.value):null;
            const note=dialog.querySelector('[role=alert]');
            if(!title || start===null){note.textContent='Add a name and start time';return;}
            if(end!==null && end<=start){note.textContent='End must be after start';return;}
            const item={id:'custom-'+Date.now(),title,preferred:start,duration:end===null?60:end-start,estimate:end===null,place:form.elements.place.value.trim()||'Other',locked:form.elements.booked.checked,booked:form.elements.booked.checked,custom:true,manualTime:true};
            if(block(item,date,on=>addToDay(on,{...item,time:clock(start)}),dialog))return;
            const d=current(),at=d.items.findIndex(i=>(i.preferred ?? 1440)>start);
            d.items.splice(at<0?d.items.length:at,0,item);
            // Use displayed intervals, including bookings with derived times.
            const overlap=overlaps(lastResult.items,start,item.duration,item.id).find(i=>i.locked);
            if(overlap)item.overlapNote='Overlaps '+venue(overlap);
            close();save();render({id:item.id,zone:'day'});announce('Item added.'+(overlap?' Overlaps '+venue(overlap):''));
        };
        dialog.showModal();form.elements[focusStart?'start':'name'].focus();
    }
    root.addEventListener('add-own',e=>openOwn(e.detail?.name || '',!!e.detail?.focusStart));
    function closeTime() {
        const id = editingTime?.slice(editingTime.indexOf('|') + 1);
        editingTime = null;
        render();
        Array.from(root.querySelectorAll('[data-db-id]')).find(r => r.dataset.dbId === id)?.querySelector('[data-db-action=edit-time]')?.focus();
    }
    function timeInstances(identity) {
        return sourcePlan().days.flatMap(d => dayResult(days[d.date] || buildSuggested(d.date), d.date).items
            .filter(i => (i.sourceId || i.id) === identity && !i.textTime && !i.flight && !['prep','travel'].includes(i.kind))
            .map(i => ({id:i.id, date:d.date, time:range(i.start,i.end)})));
    }
    root.addEventListener('keydown', e => {
        if (e.key === 'Escape' && editingTime && !root.querySelector('dialog[open]')) { e.preventDefault(); e.stopImmediatePropagation(); closeTime(); }
    });
    function alreadyOnDay(item) {
        return draftItems().some(existing => (existing.sourceId || existing.id) === (item.sourceId || item.id));
    }
    function timelineHTML(result, options) {
        return result.items.map(i => {
            const travel = i.travel?.label ? `<div class="db-travel${i.travel.late ? ' db-travel-late' : ''}" data-testid="db-travel">${esc(i.travel.label)}</div>` : '';
            return (i.walkBack ? `<div class="db-travel" data-testid="db-travel">Walk ~10 min</div>` : '') + (travel ? '<div data-testid="travel-chip">'+travel+'</div>' : '') + pair(i, false, options);
        }).join('');
    }
    function dayIndex(on) {
        return sourcePlan().days.findIndex(day => day.date === on);
    }
    function render(focus) {
        const d = current();
        const result = dayResult(d, date);
        lastResult = result;
        addedConflicts = result.conflicts.filter(c => !previousConflicts.has(c.id + '|' + c.note)).map(c => result.items.find(i => i.id === c.id).title + ' — ' + c.note);
        previousConflicts = new Map(result.conflicts.map(c => [c.id + '|' + c.note, true]));
        const summary = result.conflicts.length ? `${result.conflicts.length} heads-up` : 'All clear';
        const chips = sourcePlan().days.map((day, index) => {
            const weekday = new Date(day.date + 'T12:00:00Z').toLocaleDateString('en-US', {weekday: 'short', timeZone: 'UTC'});
            const label = weekday + ' ' + Number(day.date.slice(-2));
            // v2 date strip: weekday, big date numeral, and a dot when the day has stops (no dot = empty day).
            const filled = (day.date === date ? result : dayResult(days[day.date] || buildSuggested(day.date), day.date)).items.length > 0;
            return `<button type="button" data-db-action="day" data-date="${day.date}" data-testid="db-day-${day.date}" aria-pressed="${day.date === date}"${ctx.dayHead ? ` aria-label="Day ${index + 1} · ${label}${filled ? '' : ' · nothing planned'}"` : ''} class="db-date${filled ? '' : ' db-date-empty'}">${ctx.dayHead ? `<span class="db-day-num">Day ${index + 1}</span> ` : ''}<span class="db-wd">${weekday}</span> <span class="db-dn">${Number(day.date.slice(-2))}</span></button>`;
        }).join('');
        const index = dayIndex(date);
        const card = inner => ctx.dayHead
            ? `<section class="card day db-daycard" id="day-${index}" data-testid="plan-day" data-date="${date}">${ctx.dayHead(date)}${inner}${ctx.dayFooter ? ctx.dayFooter(date) : ''}</section>`
            : inner;
        content.innerHTML = `<div class="db-heading"><h2>${ctx.dayHead ? 'Your days' : 'Build your day'}</h2><span class="db-summary" data-testid="db-summary">${summary}</span></div>
            <div class="db-days" data-testid="db-day" role="group" aria-label="Oahu day">${chips}</div>
            ${card(`<div class="day-primary-actions"><button type="button" data-testid="day-reset" data-db-action="reset">Reset to suggested</button><button type="button" data-testid="day-add-own" data-db-action="add-own">+ Add my own</button></div>
            ${resetOpen ? '<div class="day-reset-prompt"><span>Reset this day? Locked and booked items stay.</span><div><button type="button" data-db-action="reset-confirm" data-testid="day-reset-confirm">Reset</button><button type="button" data-db-action="reset-cancel" data-testid="day-reset-cancel">Cancel</button></div></div>' : ''}
            <div class="db-day" data-testid="db-day-list">${result.items.length ? timelineHTML(result) : '<p class="db-empty" data-testid="day-empty">Nothing planned yet · rest easy</p>'}</div>
            ${ctx.dayExtras ? ctx.dayExtras(date) : ''}
            ${ctx.shared && d.unscheduled.length ? `<section data-testid="unscheduled-section"><h3>Unscheduled</h3><ul>${d.unscheduled.map(i => `<li>${esc(i.title)}</li>`).join('')}</ul></section>` : ''}
`)}`;
        if (!reducedMotion()) {
            root.querySelectorAll('.db-conflict').forEach(element => {
                element.classList.add('db-shake');
                element.addEventListener('animationend', () => element.classList.remove('db-shake'), {once: true});
            });
        }
        root.querySelectorAll('[aria-describedby]').forEach(row => row.matches('[data-db-id]') && row.querySelector('[data-db-action=handle]')?.setAttribute('aria-describedby', row.getAttribute('aria-describedby')));
        if (ctx.afterRender) ctx.afterRender(content, date);
        const pending=d.unscheduled;
        if(pending.length && !ctx.shared && typeof content.querySelector === 'function') {
            content.querySelector('[data-testid=db-day-list]').insertAdjacentHTML('afterend','<section data-testid="needs-time"><h3>Needs a time</h3></section>');
            // Only untimed items get scheduling controls; the day has no ideas chest.
            const tray=document.createElement('div');tray.className='db-tray';tray.dataset.testid='db-tray';tray.innerHTML=pending.map(i=>pair(i,true)).join('');
            content.querySelector('[data-testid=needs-time]').append(tray);
        }
        if (focus) {
            const row = Array.from(root.querySelectorAll('[data-db-id]')).find(e => e.dataset.dbId === focus.id && e.dataset.dbZone === focus.zone);
            const target=row?.querySelector(`[data-db-action="${focus.action || 'handle'}"]`);
            if(target?.closest('[role=menu]')){const panel=target.closest('[role=menu]');panel.hidden=false;const trigger=row.querySelector('[data-testid=db-more]');if(trigger){trigger.setAttribute('aria-expanded','true');positionMenu(trigger,panel);}}
            (target || row)?.focus({preventScroll: true});
        }
        return result;
    }
    // Print shows every day once, with every box open and no controls.
    function renderPrint(on) {
        if (!on) {
            if (!content.isConnected) (root.querySelector('.db-workspace') || root).prepend(content);
            printAll.innerHTML = ''; root.classList.remove('db-printing'); return;
        }
        printAll.innerHTML = sourcePlan().days.map(day => {
            const stored = days[day.date] || buildSuggested(day.date);
            const result = dayResult(stored, day.date);
            return `<section class="card day db-print-day" data-date="${day.date}">${ctx.dayHead ? ctx.dayHead(day.date, {print: true}) : ''}<div class="db-day">${timelineHTML(result, {print: true, date: day.date})}</div>${ctx.dayExtras ? ctx.dayExtras(day.date, {print: true}) : ''}</section>`;
        }).join('');
        printAll.querySelectorAll('[data-testid]').forEach(element => element.removeAttribute('data-testid'));
        printAll.querySelectorAll('.db-print-day').forEach(element=>element.setAttribute('data-testid','plan-day'));
        printAll.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
        printAll.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
        printAll.querySelectorAll('input[type=checkbox]').forEach(box => box.replaceWith(document.createTextNode(box.checked || box.hasAttribute('checked') ? '☑ ' : '☐ ')));
        printAll.querySelectorAll('details').forEach(element => { element.open = true; });
        // Keep the screen disclosures out of the print DOM, rather than hiding
        // their bodies behind a display:none ancestor. Restore the same nodes.
        content.remove();
        root.classList.add('db-printing');
    }
    function setExpanded(row, force) {
        const toggle = row?.querySelector('[data-db-action=expand]');
        if (!toggle) return false;
        const toggles = row.querySelectorAll(':scope [data-db-action=expand]');
        const panel = row.querySelector('.db-detail');
        const on = force ?? toggle.getAttribute('aria-expanded') !== 'true';
        const key = date + '|' + row.dataset.dbId;
        toggles.forEach(t => t.setAttribute('aria-expanded', String(on)));
        panel.hidden = !on;
        row.classList.toggle('is-open', on);
        if (on) session.open.add(key); else session.open.delete(key);
        panel.classList.remove('db-pop');
        if (on && !reducedMotion()) {
            void panel.offsetWidth;
            panel.classList.add('db-pop');
        }
        return true;
    }
    function selectDay(next, focusChip = true) {
        if (!sourcePlan().days.some(day => day.date === next)) return;
        date = next;
        session.date = next;
        resetOpen = false;
        picked = null;
        render();
        if (focusChip) root.querySelector(`[data-testid="db-day-${date}"]`).focus({preventScroll: true});
    }

    // Position is an insertion boundary in the destination list, before removal.
    function change(id, zone, action, target) {
        const snapshot=clone(current());
        const list = listFor(zone);
        const index = list.findIndex(i => i.id === id);
        const item = list[index];
        if(item?.locked&&suggestLocked(item,action,{target}))return;
        if (!item || item.locked || item.kind === 'prep') return;
        if (zone === 'tray' && action === 'add') { openTransfer(id, zone, 'schedule'); return; }
        let destination = list;
        let at = index;
        if (action === 'add' || action === 'remove') {
            zone = action === 'add' ? 'day' : 'tray';
            destination = listFor(zone);
            const photos = destination.findIndex(i => i.id === 'photos');
            at = target ?? (action === 'add' && photos >= 0 ? photos : destination.length);
        } else if (action === 'up' || action === 'down') {
            // Step over items hidden by Remove or the relaxed version of the day.
            const hidden = zone === 'day' ? hiddenSet(date) : new Set();
            const step = action === 'up' ? -1 : 1;
            at = index + step;
            while (at >= 0 && at < list.length && hidden.has(sourceOf(list[at], date))) at += step;
            at = Math.max(0, Math.min(list.length - 1, at));
        } else if (action === 'position') {
            at = target > index ? target - 1 : target;
        }
        if(['up','down','position'].includes(action))current().chronological=false;
        list.splice(index, 1);
        if (zone === 'tray') { item.preferred = null; delete item.manualTime; delete item.start; delete item.end; }
        if (zone !== 'tray' || !destination.some(existing => existing.id === item.id)) destination.splice(at, 0, item);
        // Reordering inside Needs a time leaves the day's clock alone.
        const overflowed = zone === 'tray' && destination === list ? [] : releaseDay(date, zone === 'day' ? id : null, snapshot) || [];
        // Items the reflow moved to Needs a time are expected, not a reason to undo the move.
        const unsafe=dayResult(current(),date).unscheduled.find(i=>!overflowed.includes(i.id)&&!dayResult(snapshot,date).unscheduled.some(old=>old.id===i.id));
        if(unsafe){days[date]=snapshot;block({...unsafe,preferred:unsafe.start??unsafe.preferred},date,target=>{days[date].items=days[date].items.filter(i=>i.id!==unsafe.id);addToDay(target,{...unsafe,time:clock(unsafe.start??unsafe.preferred??540)});});return;}
        session.open.delete(date + '|' + id);
        save();
        render({id, zone});
        announce(positionMessage(id, zone));
    }
    function lock(id) {
        if(window.goNowAccount?.group&&!window.goNowAccount.owner())return;
        const item = current().items.find(i => i.id === id);
        if (!item || !lockable(item) || fixedBooking(item)) return;
        const shown = lastResult.items.find(i => i.id === id);
        if (item.locked && item.userLocked) { confirmUnlock(item, () => { save(); render({id, zone:'day', action:'lock'}); announce('Unlocked ' + item.title + ' — it moves with the day again.'); }); return; }
        const locked = toggleLock(item, shown);
        window.goNowAccount?.lock(id,locked);
        save();
        const result = render({id, zone: 'day', action: 'lock'});
        const now = result.items.find(i => i.id === id);
        if (!locked && editingTime === date + '|' + id) root.querySelector('[data-testid=activity-time-form] [name=start]')?.focus();
        announce(locked ? `Locked ${item.title} at ${now && now.start != null ? range(now.start, now.end) : 'its time'}.` : `Unlocked ${item.title} — it moves with the day again.`);
    }

    // The popup stays in the card for action lookup and drag delegation, outside the controls row.
    function positionMenu(trigger, panel) {
        // Keep the popup in its card for delegated actions, but use viewport
        // coordinates so tall cards and scrolling containers cannot clip it.
        panel.hidden = false;
        panel.style.display = 'block';
        panel.style.position = 'fixed';
        panel.style.top = '16px';
        panel.style.left = '16px';
        panel.style.maxHeight = `${Math.max(44, window.innerHeight - 32)}px`;
        panel.style.overflowY = 'auto';
        const anchor = trigger.getBoundingClientRect();
        const bounds = panel.getBoundingClientRect();
        const left = Math.max(16, Math.min(anchor.left, document.documentElement.clientWidth - bounds.width - 16));
        const top = Math.max(16, Math.min(anchor.bottom + bounds.height <= window.innerHeight - 16 ? anchor.bottom : anchor.top - bounds.height, window.innerHeight - bounds.height - 16));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
    }
    window.addEventListener?.('resize', () => {
        if (root.isConnected) root.querySelectorAll('[data-testid=db-more][aria-expanded=true]').forEach(b => positionMenu(b, b.closest('[data-db-id]').querySelector('[data-testid=db-more-menu]')));
    });
    function closeMenus(focus=false){root.querySelectorAll('[data-testid=db-more][aria-expanded=true]').forEach(b=>{b.setAttribute('aria-expanded','false');b.closest('[data-db-id]').querySelector('[data-testid=db-more-menu]').hidden=true;b.closest('[data-db-id]').querySelector('[data-testid=db-more-menu]').style.display='';if(focus)b.focus();});}
    const outsideMenuClick = e => {
        if(root.isConnected === false){document.removeEventListener('click',outsideMenuClick);return;}
        if(!e.target.closest('[data-testid=db-more], [data-testid=db-more-menu]')&&!drag)closeMenus(true);
    };
    document.addEventListener?.('click',outsideMenuClick);
    root.addEventListener('keydown',e=>{
        const menu=e.target.closest('[data-testid=db-more-menu]');
        if(!menu)return;
        if(e.key==='Tab'){closeMenus();return;}
        if(e.key==='Escape'&&!picked&&!drag){e.preventDefault();e.stopImmediatePropagation();closeMenus(true);return;}
        if(['ArrowUp','ArrowDown'].includes(e.key)&&!picked){e.preventDefault();e.stopImmediatePropagation();const items=[...menu.querySelectorAll('button:not(:disabled)')];const n=items.indexOf(document.activeElement);items[(n+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
    });
    root.addEventListener('click', e => {
        const flightEditButton=e.target.closest('[data-testid=edit-flight],[data-flight-conflict-edit]');
        if(flightEditButton&&(flightEditButton.dataset.testid==='edit-flight'||flightEditButton.dataset.flightConflictEdit!==undefined)){editFlights();return;}
        const flightButton=e.target.closest('[data-testid=add-flight-time]');
        if(flightButton){flightButton.previousElementSibling.dataset.flightDirection=date==='2026-11-25'?'arrival':'departure';window.GoNowTimepicker.open(flightButton.previousElementSibling,flightButton);return;}
        if (suppressClick) { suppressClick = false; if (e.target.closest('[data-db-id]')) return; }
        const anchor = e.target.closest('a[href^="#item-"]');
        const href = anchor && anchor.getAttribute && anchor.getAttribute('href');
        if (href && href.startsWith('#item-')) {
            const id = href.slice(6).replace(/["\\]/g, '\\$&');
            const row = root.querySelector(`.db-content [data-db-source="${id}"]`);
            if (row && setExpanded(row, true)) {
                e.preventDefault();
                row.scrollIntoView({block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth'});
                row.querySelector('[data-db-action=expand]').focus({preventScroll: true});
            }
            return;
        }
        const b = e.target.closest('[data-db-action]');
        if (!b) {
            // A click on the box itself (not a control, link, field or the open panel) toggles it.
            const row = e.target.closest('.db-content [data-db-id][data-db-zone=day]');
            if (row && !e.target.closest('a,button,input,select,textarea,label,summary,details,.db-detail,.db-time-editor')) setExpanded(row);
            return;
        }
        const action = b.dataset.dbAction;
        const row = b.closest('[data-db-id]');
        if(action==='more'){ e.stopPropagation();const panel=b.closest('[data-db-id]').querySelector('[data-testid=db-more-menu]');const open=b.getAttribute('aria-expanded')!=='true';closeMenus();panel.hidden=!open;b.setAttribute('aria-expanded',String(open));if(open){positionMenu(b,panel);panel.querySelector('button')?.focus({preventScroll:true});}return;}
        if(action!=='handle')closeMenus();
        if(action==='swap'){openSwap(row.dataset.dbId);
        } else if (['again','move-day','schedule'].includes(action)) { openTransfer(row.dataset.dbId, row.dataset.dbZone, action);
        } else if (action === 'edit-time') {
            openTime(date, row.dataset.dbId);
        } else if (action === 'close-time') {
            closeTime();
        } else if (action === 'day') {
            selectDay(b.dataset.date);
        } else if (action === 'expand') {
            setExpanded(row);
        } else if (action === 'lock') {
            lock(row.dataset.dbId);
        } else if (action === 'add-own') {
            openOwn();
        } else if (action === 'reset' || action === 'reset-cancel') {
            resetOpen = action === 'reset'; render();
            root.querySelector('[data-testid='+(resetOpen ? 'day-reset-confirm' : 'day-reset')+']').focus();
        } else if (action === 'reset-confirm') {
            const kept=current().items.filter(i=>i.locked || i.booked || i.fixedBooking);
            const suggested=buildSuggested(date);
            const ids=new Set(kept.map(i=>i.id));
            suggested.items=suggested.items.filter(i=>!ids.has(i.id));
            kept.forEach(i=>{const at=suggested.items.findIndex(v=>(v.preferred ?? 1440)>(i.preferred ?? 1440));suggested.items.splice(at<0?suggested.items.length:at,0,i);});
            days[date]=suggested; picked=null; resetOpen=false; save(); render();
            root.querySelector('[data-testid=day-reset]').focus(); announce('Reset to suggested.');
        } else if (action === 'delete') {
            let nextRow = row.nextElementSibling;
            while (nextRow && !nextRow.dataset.dbId) nextRow = nextRow.nextElementSibling;
            const next = nextRow?.dataset.dbId;
            current().items = current().items.filter(i => i.id !== row.dataset.dbId);
            save();
            render();
            (root.querySelector(`[data-db-id="${next}"] button`) || root.querySelector(`[data-db-id="${next}"][tabindex]`) || root.querySelector('[data-testid=day-add-own]')).focus();
            announce('Booking deleted');
        } else if (action !== 'handle') {
            change(row.dataset.dbId, row.dataset.dbZone, action);
        }
    });
    // Start, End and Duration stay in sync: Start keeps the duration, End sets the duration, Duration sets the end.
    // Listen to change too: some mobile time pickers only fire change.
    const hm = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? Number(v.slice(0,2))*60 + Number(v.slice(3)) : null;
    const fmt = m => m >= 0 && m < 1440 ? String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0') : '';
    function syncTime(e) {
        const form = e.target.closest('.db-time-editor');
        if (!form || !['start','end','duration'].includes(e.target.name)) return;
        const {start, end, duration} = form.elements, s = hm(start.value), en = hm(end.value), d = Number(duration.value);
        if (e.target.name !== 'start') { form.dataset.touched = 'true'; form.dataset.lastManual = e.target.name; if (e.target.name === 'end') end.dataset.manual = 'true'; form.querySelector('[data-time-estimate]').textContent = ''; }
        if (e.target.name === 'start' && s !== null && d > 0) end.value = fmt(s + d);
        if (e.target.name === 'end' && s !== null && en !== null && en > s) duration.value = String(en - s);
        if (e.target.name === 'duration' && s !== null && d > 0) end.value = fmt(s + d);
    }
    root.addEventListener('input', syncTime);
    root.addEventListener('change', syncTime);
    function editFlights(){
        if(ctx.shared||!window.GoNowFlights)return;
        const a={...(ctx.flightAnswers||{})};window.GoNowFlights.migrate(a);
        // Keep the curated sample's times until the traveler edits them.
        if(!a.flightsStep&&sourcePlan().id==='oahu-demo-2026-11'){a.arrivalTime ||= '17:30';a.returnTime ||= flightTime||'';}
        const sheet=document.createElement('dialog');sheet.className='flight-sheet';sheet.innerHTML='<h2>Edit flights</h2>'+window.GoNowFlights.fields(a,esc)+'<button data-save-flights>Save flights</button><button data-close-flights>Cancel</button>';document.body.append(sheet);
        const close=()=>{sheet.close();sheet.remove();root.querySelector('[data-testid=edit-flight]')?.focus();};
        sheet.querySelector('[data-close-flights]').onclick=close;sheet.oncancel=e=>{e.preventDefault();close();};
        sheet.querySelector('[data-save-flights]').onclick=()=>{
            sheet.querySelectorAll('[data-flight-field]').forEach(el=>a[el.dataset.flightField]=el.value);a.flightsStep=true;
            ctx.flightAnswers=a;ctx.saveFlights?.(a);const fw=window.GoNowFlights.windowFor(a);flightTime=clock(fw.departure);
            const endpoints=[sourcePlan().days[0],sourcePlan().days.at(-1)];
            endpoints.forEach((d,index)=>{
                const stored=days[d.date]||buildSuggested(d.date);days[d.date]=stored;
                const direction=index?'return':'arrival',at=index?fw.departure:fw.landing;
                let anchor=stored.items.find(i=>i.flight||i.kind==='flight');
                // The demo's departure used one airport card for both ride and flight.
                // Keep that card as the ride, and give the flight its own anchor.
                if(index&&anchor?.kind==='travel'){
                    const source=d.items.find(i=>i.id===anchor.id);
                    Object.assign(anchor,{flight:false,title:source?.title||'Leave for the airport',preferred:fw.leave,duration:fw.road,manualTime:true});
                    delete anchor.textTime;delete anchor.detail;anchor=null;
                }
                if(!anchor){anchor=convert({id:direction+'-flight',title:'Flight',kind:'flight',time:clock(at),duration:0});stored.items.push(anchor);}
                Object.assign(anchor,{title:window.GoNowFlights.label(a,direction),flightDirection:direction,flight:false,kind:'flight',preferred:at,duration:0,locked:true,manualTime:true});delete anchor.textTime;delete anchor.detail;
                if(index)stored.items.filter(i=>i.kind==='travel'&&/airport|HNL/i.test(i.title)).forEach(i=>{Object.assign(i,{preferred:fw.leave,duration:fw.road,manualTime:true});});
                stored.chronological=false;stored.items.sort((x,y)=>(x.preferred??0)-(y.preferred??0));
                d.flightsEdited=true;
                let source=d.items.find(i=>i.id===anchor.id);
                if(!source){source={id:anchor.id,prep:[],bring:[],sources:[]};d.items.push(source);}
                Object.assign(source,{title:anchor.title,flightDirection:direction,kind:'flight',time:clock(at),duration:0,locked:true});
            });
            save();close();render();announce('Flights updated');
        };sheet.showModal();sheet.querySelector('input').focus();
    }
    root.addEventListener('change', e => {
        if (e.target.matches('[data-testid=db-flight-time]')) {
            const [h, m] = e.target.value.split(':').map(Number);
            if(!Number.isFinite(h)||!Number.isFinite(m))return;
            if(date==='2026-11-25'){const item=current().items.find(i=>i.flight);Object.assign(item,{preferred:h*60+m,manualTime:true});}
            else flightTime = clock(h * 60 + m);
            if(ctx.flightAnswers){const a=ctx.flightAnswers;window.GoNowFlights?.migrate(a);a[date===sourcePlan().days[0].date?'arrivalTime':'returnTime']=e.target.value;ctx.saveFlights?.(a);}
            save(); render(); root.querySelector('[data-testid=add-flight-time]').focus(); announce('Flight time updated');
        }
    });
    root.addEventListener('submit', e => {
        if (e.target.matches('.db-time-editor')) {
            e.preventDefault();
            const form = e.target, row = form.closest('[data-db-id]');
            days[date] ||= buildSuggested(date);
            const item = current().items.find(i => i.id === row.dataset.dbId);
            if (!item) return;
            if (item.locked && suggestLocked(item, 'time')) return;
            const start = hm(form.elements.start.value);
            const durationField = form.elements.duration;
            const endField = form.elements.end;
            const end = hm(endField.value);
            // The last field the traveler edited wins; Start alone keeps the duration.
            const length = form.dataset.lastManual === 'end' && end !== null ? end - start : Number(durationField.value) || (end !== null ? end - start : item.duration);
            if (start === null || !Number.isFinite(length) || length <= 0 || start + length > 1440 || !form.checkValidity()) {
                form.querySelector('[role=alert]').textContent = 'Enter valid times. End must be after start.';
                form.setAttribute('aria-invalid','true');
                [form.elements.start, endField, durationField].forEach(field => field.setAttribute('aria-invalid','true')); return;
            }
            const touched = !!form.dataset.touched || endField.dataset.manual === 'true';
            // An explicit time is the traveler's call: opening hours only warn (the card shows the heads-up).
            resolveTime(date,item,start,length,()=>{
            reviewTransfers(current(),item);
            item.originalTitle ||= item.title; item.title=cleanTimeTitle(item.title,item.preferred);
            Object.assign(item,{preferred:start,duration:length,manualTime:true,estimate: !touched,hoursOk:!!blockedOn({...item,preferred:start,duration:length},date,ruleContext())});
            sortDay(date); save(); closeTime(); announce(item.kind === 'travel' ? 'Departure time updated.' : 'Activity time updated.');
            },{explicit:true});
            return;
        }

    });
    root.addEventListener('keydown', e => {
        if (e.key === 'Escape' && drag) {
            e.preventDefault();
            cancelDrag();
            announce('Move cancelled');
            return;
        }
        const row = e.target.closest('[data-db-id]');
        if (!row || e.target.closest('.db-detail')) return;
        // A focused locked box opens with Enter or Space, like its title button.
        if (e.target === row && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            setExpanded(row);
            return;
        }
        if (!e.target.matches('input,select') && row.classList.contains('db-locked') && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            announce(row.classList.contains('db-user-locked') ? 'Locked time — unlock to move' : 'Locked booking — times are fixed');
            return;
        }
        const handle = e.target.closest('[data-db-action="handle"]');
        if (!handle || handle.disabled) return;
        const {dbId: id, dbZone: zone} = row.dataset;
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (picked) {
                picked = null;
                render({id, zone});
                announce('Dropped ' + positionMessage(id, zone).replace(', position', ' at position'));
            } else {
                picked = {id, zone, snapshot: clone(current())};
                const list = listFor(zone);
                const index = list.findIndex(i => i.id === id);
                render({id, zone});
                announce(`Picked up ${list[index].title}. Position ${index + 1} of ${list.length}.`);
            }
        } else if (picked && ['ArrowUp', 'ArrowDown'].includes(e.key)) {
            e.preventDefault();
            change(id, zone, e.key === 'ArrowUp' ? 'up' : 'down');
        } else if (picked && e.key === 'Escape') {
            e.preventDefault();
            days[date] = picked.snapshot;
            picked = null;
            save();
            render({id, zone});
            announce('Move cancelled');
        }
    });

    function cancelDrag() {
        if (!drag) return;
        root.querySelectorAll('.db-drop-target').forEach(e => e.classList.remove('db-drop-target'));
        drag.ghost?.remove();
        drag.indicator?.remove();
        const {handle, pointerId, active} = drag;
        drag = null;
        if (active) {
            // The click that ends a drag never toggles a box open.
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
        }
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        root.classList.remove('db-dragging');
        root.querySelector('.db-dock-tray')?.classList.remove('db-drag-source');
    }
    function dropTarget(x, y) {
        const hit = document.elementFromPoint(x, y);
        const tray = hit?.closest('[data-testid="db-tray"]');
        const day = hit?.closest('[data-testid="db-day-list"]');
        if (!tray && !day) return null;
        const zone = tray ? 'tray' : 'day';
        const list = listFor(zone);
        const row = hit.closest('[data-db-id]');
        let at = list.length;
        let bounds = (tray || day).getBoundingClientRect();
        let lineY = bounds.bottom;
        if (row) {
            bounds = row.getBoundingClientRect();
            const after = y > bounds.top + bounds.height / 2;
            // Auto prep is not persisted; drop adjacent to the next actual item.
            let index = list.findIndex(i => i.id === row.dataset.dbId);
            if (index < 0) {
                let next = row.nextElementSibling;
                while (next && !next.dataset.dbId) next = next.nextElementSibling;
                index = next ? list.findIndex(i => i.id === next.dataset.dbId) : list.length;
                at = index < 0 ? list.length : index;
            } else at = index + (after ? 1 : 0);
            lineY = after ? bounds.bottom : bounds.top;
        }
        return {zone, at, bounds, lineY, row};
    }
    root.addEventListener('pointerdown', e => {
        const handle = e.target.closest('[data-db-action="handle"]');
        if (!handle || handle.disabled || e.button !== 0 || picked) return;
        const row = handle.closest('[data-db-id]');
        drag = {id: row.dataset.dbId, zone: row.dataset.dbZone, handle, pointerId: e.pointerId,
            x: e.clientX, y: e.clientY, active: false};
        handle.focus({preventScroll: true});
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    root.addEventListener('pointermove', e => {
        if (!drag) return;
        if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) {
            drag.active = true;
            const row = drag.handle.closest('[data-db-id]');
            // A box being dragged travels closed.
            setExpanded(row, false);
            drag.ghost = row.cloneNode(true);
            drag.ghost.className = 'db-pair db-ghost';
            drag.ghost.removeAttribute('data-testid');
            drag.ghost.querySelectorAll('[data-testid]').forEach(el => el.removeAttribute('data-testid'));
            drag.ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
            drag.ghost.querySelector('.db-detail')?.remove();
            drag.ghost.setAttribute('aria-hidden', 'true');
            document.body.appendChild(drag.ghost);
            drag.indicator = document.createElement('div');
            drag.indicator.className = 'db-drop-indicator';
            document.body.appendChild(drag.indicator);
            root.classList.add('db-dragging');
            if (drag.zone === 'tray') root.querySelector('.db-dock-tray')?.classList.add('db-drag-source');
        }
        if (!drag.active) return;
        drag.ghost.style.left = Math.min(e.clientX + 12, window.innerWidth - Math.min(320, window.innerWidth - 24)) + 'px';
        drag.ghost.style.top = e.clientY + 12 + 'px';
        const target = dropTarget(e.clientX, e.clientY);
        root.querySelectorAll('.db-drop-target').forEach(e => e.classList.remove('db-drop-target'));
        target?.row?.classList.add('db-drop-target');
        drag.indicator.hidden = !target;
        if (target) Object.assign(drag.indicator.style, {left: target.bounds.left + 'px', top: target.lineY + 'px', width: target.bounds.width + 'px'});
        if (e.clientY < 55) window.scrollBy(0, -12);
        else if (e.clientY > window.innerHeight - 55) window.scrollBy(0, 12);
    });
    root.addEventListener('pointerup', e => {
        if (!drag) return;
        const moving = drag;
        const target = moving.active ? dropTarget(e.clientX, e.clientY) : null;
        cancelDrag();
        if (!target) return;
        change(moving.id, moving.zone, target.zone === moving.zone ? 'position' : target.zone === 'tray' ? 'remove' : 'add', target.at);
    });
    const escapeDrag = e => {
        if(!root.isConnected){document.removeEventListener('keydown',escapeDrag,true);return;}
        if(e.key==='Escape'&&drag){e.preventDefault();e.stopImmediatePropagation();cancelDrag();announce('Move cancelled');}
    };
    document.addEventListener?.('keydown',escapeDrag,true);
    root.addEventListener('pointercancel', cancelDrag);
    root.addEventListener('lostpointercapture', () => { if (drag) cancelDrag(); });
    const api = {
        shiftUnlocked: (on,id,start) => {
            const stored=days[on]||buildSuggested(on),item=stored.items.find(i=>i.id===id);
            if(!item||item.locked)return false;
            if(block({...item,start,preferred:start},on,target=>addToDay(target,{...item,time:clock(start)})))return false;
            const before=dayResult(stored,on).items,visible=before.find(i=>i.id===id);
            if(!visible||!canShiftUnlocked(before,id,start))return false;
            const copy=clone(stored),target=copy.items.find(i=>i.id===id);Object.assign(target,{preferred:start,manualTime:true});
            const after=dayResult(copy,on).items;
            if(before.some(i=>i.locked&&!after.some(j=>j.id===i.id&&j.start===i.start&&j.end===i.end)))return false;
            days[on]=copy;save();render();return true;
        },
        swapItem: (id, alternative) => { const item=current().items.find(i=>i.id===id); if(item?.locked&&suggestLocked(item,'swap',{alternative}))return false; if(!item || item.locked)return false; if(block({...item,...alternative},date,target=>addToDay(target,alternative)))return false; Object.assign(item, alternative, {id:item.id, preferred:alternative.start ?? item.preferred, manualTime:true, duration:item.duration, checkinSwap:true}); delete item.textTime; save(); render(); return true; },
        // Plan edits from GoNowAI (voice or typed). Every move still passes the opening-hours and dive rules and the reflow.
        editableItems: () => sourcePlan().days.flatMap(day => {
            const stored = days[day.date] || buildSuggested(day.date);
            const fixed = i => !!(i.locked || i.booked || ['flight','travel','stay'].includes(i.kind));
            return dayResult(stored, day.date).items.map(i => ({id:i.id, title:String(i.title||''), date:day.date, start:i.start ?? null, kind:i.kind||'activity', category:i.category||'', locked:fixed(i)}))
                .concat((stored.unscheduled||[]).map(i => ({id:i.id, title:String(i.title||''), date:day.date, start:null, kind:i.kind||'activity', category:i.category||'', locked:fixed(i)})));
        }),
        applyEdits: ops => {
            const before = clone(days), dates = sourcePlan().days.map(d => d.date), done = [];
            const ensure = on => { if (!days[on]) days[on] = buildSuggested(on); days[on].unscheduled ||= []; return days[on]; };
            const find = id => { for (const on of dates) { const day = ensure(on); for (const zone of ['items','unscheduled']) { const at = day[zone].findIndex(i => i.id === id); if (at >= 0) return {on, zone, at, item: day[zone][at]}; } } return null; };
            for (const op of ops || []) {
                const f = op && find(op.id);
                if (!f) { done.push({...op, ok:false, reason:'missing'}); continue; }
                const title = String(f.item.title || 'Stop');
                if (f.item.locked || f.item.booked || ['flight','travel','stay'].includes(f.item.kind)) { done.push({...op, ok:false, reason:'locked', title}); continue; }
                if (op.type === 'remove') {
                    if (f.zone === 'unscheduled') { done.push({...op, ok:false, reason:'already', title}); continue; }
                    ensure(f.on).items.splice(f.at, 1); ensure(f.on).unscheduled.push({...f.item, preferred:null, manualTime:false});
                    done.push({...op, ok:true, title, from:f.on}); continue;
                }
                if (op.type !== 'move' || !Number.isFinite(op.start)) { done.push({...op, ok:false, reason:'unclear', title}); continue; }
                const to = dates.includes(op.date) ? op.date : f.on, moved = {...f.item, preferred:op.start, manualTime:true};
                const reason = blockedOn(moved, to, ruleContext());
                if (reason) { done.push({...op, ok:false, reason, title, date:to}); continue; }
                ensure(f.on)[f.zone].splice(f.at, 1);
                const list = ensure(to).items, place = start => { const at = list.findIndex(i => (i.preferred ?? Infinity) > start); list.splice(at < 0 ? list.length : at, 0, moved); };
                // Never stack two stops: try the asked time, then the nearest free time within 3 hours.
                const clash = () => { const shown = dayResult(ensure(to), to).items, me = shown.find(i => i.id === moved.id); return !me || me.start == null || shown.some(i => i.id !== moved.id && i.start != null && i.end != null && me.start < i.end && me.end > i.start); };
                const tries = [0]; for (let n = 15; n <= 180; n += 15) tries.push(n, -n);
                let fitted = false;
                for (const shift of tries) {
                    const start = op.start + shift; if (start < 360 || start + (moved.duration || 60) > 1380) continue;
                    if (blockedOn({...moved, preferred:start}, to, ruleContext())) continue;
                    moved.preferred = start; place(start);
                    if (!clash()) { fitted = true; break; }
                    list.splice(list.indexOf(moved), 1);
                }
                if (!fitted) { moved.preferred = op.start; place(op.start); }
                done.push({...op, ok:true, title, from:f.on, date:to, nudged: fitted && moved.preferred !== op.start, overlap: !fitted});
            }
            if (!done.some(d => d.ok)) { Object.keys(days).forEach(k => delete days[k]); Object.assign(days, before); return {results:done, before:null}; }
            save();
            // Where each moved stop landed after the reflow (it may be nudged, or wait in Needs a time).
            done.filter(d => d.ok && d.type === 'move').forEach(d => { const shown = dayResult(days[d.date], d.date).items.find(i => i.id === d.id); d.landed = shown ? shown.start ?? null : null; });
            const moved = done.find(d => d.ok && d.type === 'move');
            if (moved && moved.date !== date) selectDay(moved.date, false); else render();
            return {results:done, before};
        },
        restore: snapshot => { if (!snapshot) return; Object.keys(days).forEach(k => delete days[k]); Object.assign(days, clone(snapshot)); save(); render(); },
        render, selectDay, renderPrint, root, openTime, timeInstances, draftItems: () => clone(draftItems()),
        getDay: () => clone(current()),
        date: () => date,
        exportState: () => exportDays(days, flightTime),
        schedule,
        addToDay,
        persist: () => { try { localStorage.setItem(KEY, JSON.stringify({days, flightTime})); } catch (e) {} }
    };
    session.active = api;
    render();
    return api;
}
const active = () => (session.active && session.active.root.isConnected ? session.active : null);
window.DayBuilder = {convert,slotCandidates,estimateTravel,parseClock:parse,closedOn,blockedOn,nearestAllowed,operatingRules,canShiftUnlocked,cleanTimeTitle, overlaps, shiftConflicts,replanStay,setStay: name => {stayOverride=name||'';},parseDuration, buildSuggested, reflow, commuteMinutes, mount, render: mount, trayItems, clock, range,
    toggleLock, exportDays, importDays, importForPlan, sourceOf,
    selectDay: (date, focus) => active()?.selectDay(date, focus),
    openTime: (date, id) => active()?.openTime(date, id),
    timeInstances: identity => active()?.timeInstances(identity) || [],
    selectedDate: () => active()?.date() || session.date,
    exportState: () => {
        if (active()) return active().exportState();
        if (session.shared) return exportDays(session.shared.days, session.shared.flightTime);
        try { const saved = JSON.parse(localStorage.getItem(KEY)) || {}; return exportDays(saved.days, saved.flightTime); } catch (e) { return null; }
    },
    persist: () => {
        const data = active() ? null : session.shared;
        if (active()) return active().persist();
        if (data) try { localStorage.setItem(KEY, JSON.stringify({days: data.days, flightTime: data.flightTime || ''})); } catch (e) {}
    },
    print: on => active()?.renderPrint(on),
    schedule: () => active()?.schedule() || null,
    draftItems: () => active()?.draftItems() || [],
    shiftUnlocked: (on,id,start) => active()?.shiftUnlocked(on,id,start) || false,
    swapItem: (id, alternative) => active()?.swapItem(id, alternative),
    editableItems: () => active()?.editableItems() || [],
    applyEdits: ops => active()?.applyEdits(ops) || {results:[], before:null},
    restore: snapshot => active()?.restore(snapshot),
    addToDay: (date, spec) => active()?.addToDay(date, spec) || {ok: false, reason: 'Open a draft first'},
    resetSession: () => { stayOverride=''; session.date = '2026-11-26'; session.open.clear(); session.shared = null; session.sharedKey = null; }};
})();
