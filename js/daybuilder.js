/* Oahu Day Builder: user intent is saved; times, travel and prep are derived. */
(function () {
'use strict';
const KEY = 'gonow:daybuilder:oahu-demo-2026-11';
const HOTEL = 'Kahala';
const WAIKIKI = 'Waikiki';
const clone = value => JSON.parse(JSON.stringify(value));
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
    if (/Kualoa|Aunty Pat|Jurassic/i.test(title)) return 'Kualoa Ranch';
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
function leg(from, to) {
    const minutes = from === to ? 5 : commuteMinutes(from, to);
    let label = '~15–30 min, check route';
    if (from === to) label = 'short walk, est.';
    else if (minutes === 10) label = 'Walk ~10 min';
    else if (isWalk(from, to)) label = 'Walk ~' + minutes + ' min';
    else if (minutes === 60 && [from, to].includes('Kualoa Ranch')) label = 'Shuttle ~60 min';
    else if (routes[from + '|' + to] || routes[to + '|' + from]) label = 'Uber ~' + minutes + ' min';
    return {minutes, label};
}
function duration(item) {
    const hours = item.desc.match(/(?:About|allow about)?\s*(\d+(?:\.\d+)?) h\b/i);
    if (hours) return +hours[1] * 60;
    const minutes = item.desc.match(/about (\d+) min/i);
    return minutes ? +minutes[1] : 60;
}
function convert(item) {
    return {
        id: item.id, sourceId: item.id, title: clean(item.title), place: place(item.title), preferred: parse(item.time),
        duration: duration(item), walkNext: /approx\. 5 min walk/.test(item.travelToNext || ''), kind: item.kind, tags: /intro dive/i.test(item.title) ? ['dive'] : /sunset/i.test(item.title) ? ['sunset'] : [],
        estimate: !/(?:About|allow about|2\.5)\s*\d*\.?\d* h\b/i.test(item.desc),
        detail: parse(item.time) === null ? item.time + ' · confirm flight time' : ''
    };
}
function buildSuggested(date) {
    const day = window.OAHU_SAMPLE.days.find(day => day.date === date);
    if (!day) return {date, items: [], unscheduled: []};
    let items = day.items.map(convert);
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
        items[1].locked = true;
        Object.assign(items[2], {place: 'Diamond Head', to: WAIKIKI});
        Object.assign(items[3], {place: WAIKIKI, to: 'Kualoa Ranch', locked: true});
        Object.assign(items[6], {place: 'Kualoa Ranch', to: WAIKIKI, locked: true});
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

    // The flight remains an unknown-time anchor until the traveler supplies a time.
    if (date === '2026-11-29') items.forEach(item => {
        item.locked = true;
        item.title = 'Flight (add your time)';
        item.flight = true;
        item.textTime = 'Add flight time';
        item.detail = '';
        item.preferred = null;
    });
    return {date, items, unscheduled: []};
}
// Ideas no longer on a day card stay available in the treasure chest.
const chestOnly = [{id: 'magic-island', time: '5:15 PM', kind: 'sight', title: 'Magic Island sunset',
    desc: 'Ala Moana Beach Park. Be in place by about 5:30 PM; sunset about 5:48 PM.'}];
function trayItems() {
    const all = window.OAHU_SAMPLE.days.flatMap(day => day.items);
    const patterns = [/Beginner intro dive/, /Waikiki parasail/, /Jurassic Adventure/, /Black Friday shopping/,
        /^Royal Hawaiian Center/, /palms — sunset/, /^Magic Island/, /^Waikiki Beach sunset/, /Free time at the Kahala/,
        /Lanikai Pillbox/, /^Makapuʻu Lighthouse Trail/, /Diamond Head —/];
    return patterns.map((pattern, index) => {
        const item = convert(all.find(item => pattern.test(item.title)) || chestOnly.find(item => pattern.test(item.title)));
        Object.assign(item, {sourceId: item.id, id: 'chest-' + index, preferred: null, locked: false});
        if (index === 5) Object.assign(item, {place: 'Kahala palms', duration: 60, estimate: false});
        if (index === 8) item.title = 'Hotel downtime';
        return item;
    }).concat([{id: 'chest-bar', title: 'Sunset bar / cocktails', place: WAIKIKI, duration: 60,
        estimate: true, tags: ['alcohol'], detail: '21+'}]);
}
function reflow(day, ctx = {}) {
    const output = [];

    const ages = (ctx.ages?.length ? ctx.ages : [18, 19]).map(Number);
    const raw = clone(day.items);
    raw.forEach(item => { delete item.notes; delete item.noteSources; delete item.notePriority; delete item.noteSource; });
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
    if (dinner) {
        let at = raw.findIndex(item => item.id === 'photos');
        if (at < 0 || at > raw.indexOf(dinner)) at = raw.indexOf(dinner);
        raw.splice(at, 0, dinner.prepBlock || {id: 'prep-dress', title: 'Get ready / change + makeup', place: HOTEL,
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
        let travel = previous ? leg(previous.to || previous.place, item.place) : {minutes: 0, label: ''};
        if (previous?.place === 'Kahala palms' && item.place === WAIKIKI) {
            item.walkBack = {depart: previous.end, arrive: previous.end + 10};
            travel = leg(HOTEL, WAIKIKI);
            if (item.inboundRide) travel = {minutes: item.inboundRide.duration, label: 'Uber ~' + item.inboundRide.duration + ' min'};
        } else if (item.inboundRide?.label && previous && (previous.to || previous.place) === item.inboundRide.place) {
            travel = {minutes: item.inboundRide.duration, label: item.inboundRide.label};
        }
        // Explicit rides already include arrival travel; free time and prep share a hotel room.
        if ((previous?.kind === 'travel' && previous.to === item.place) || (previous?.flex && item.kind === 'prep')) travel = {minutes: 0, label: ''};
        if (previous?.walkNext && previous.place === item.place) travel = {minutes: 5, label: 'Walk ~5 min'};
        // A ride booked from where you already are needs no connector.
        if (item.pickup && previous && (previous.to || previous.place) === item.place) travel = {minutes: 0, label: ''};
        const earliest = previous ? previous.end + travel.minutes + (item.walkBack ? 10 : 0) : 0;
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
        item.end = item.start + item.duration;
        if (previous) {
            const buffer = item.dressy ? 15 : 0;
            const depart = item.locked && !item.textTime ? item.start - buffer - travel.minutes : previous.end;
            item.travel = {...travel, depart, arrive: depart + travel.minutes, late: item.locked && earliest + buffer > item.start};
            if (item.locked && !item.textTime && earliest + buffer > item.start) {
                warn(previous, 'Ends ' + clock(previous.end) + " — you'd miss " + venue(item), undefined, 0);
            }
            // An explicit ride already includes travel: no redundant short walk.
            if (!travel.minutes || (previous.kind === 'travel' && previous.to === item.place)) item.travel = null;
        }
        const flightTime = ctx.flightTime;
        const untilFlight = flightTime ? (Date.parse('2026-11-29T00:00:00Z') - Date.parse(day.date + 'T00:00:00Z')) / 60000 + parse(flightTime) - item.end : null;
        if ((item.tags || []).includes('dive') && (flightTime ? untilFlight >= 0 && untilFlight < 1440 : day.date >= '2026-11-28')) {
            warn(item, 'Keep 24 hrs between diving and flying', window.OAHU_SOURCES.dan, 2);
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
                warn(item, 'Overlaps ' + booking.title, undefined, 1);
            }
        }
        const sunset = window.OAHU_SAMPLE.weather.text.match(/sunset approx\. (\d{1,2}:\d{2} PM)/i);
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
    return {items: output, conflicts: output.flatMap(item => (item.notes || []).map((note, index) => ({
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
const labels = {handle: 'Move', up: 'Move up', down: 'Move down', remove: 'To chest', add: 'Add to day', delete: 'Delete booking'};
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
const lockable = item => !item.textTime && item.kind !== 'prep';
const uidFor = (date, id) => (date + '-' + id).replace(/[^\w-]/g, '_');
// Locking pins the shown start and end; unlocking restores the item's own preference.
function toggleLock(item, shown) {
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
            if (item.custom) return {c: 1, id: item.id, t: String(item.title).slice(0, 100), p: item.preferred, d: item.duration, pl: item.place, s: item.sourceId, m: item.manualTime, e: item.estimate, l: item.locked ? 1 : 0};
            const original = pool.find(candidate => candidate.id === item.id);
            if (original && !item.manualTime && !!original.locked === !!item.locked && original.preferred === item.preferred && original.duration === item.duration) return item.id;
            const entry = {id: item.id, s: item.sourceId, m: item.manualTime, e: item.estimate, l: item.locked ? 1 : 0, p: item.preferred, d: item.duration};
            if (item.userLocked) Object.assign(entry, {u: 1, bp: item.basePreferred, bd: item.baseDuration});
            return entry;
        });
        const trayIds = [];
        const u = (day.unscheduled || []).map(({id,sourceId,title,place,duration,estimate,locked}) => ({id,sourceId,title,place,duration,estimate,locked}));
        if (JSON.stringify(items) !== JSON.stringify(base.map(item => item.id)) || u.length) {
            out[date] = {i: items, t: trayIds, u};
        }
    });
    return Object.keys(out).length || flightTime ? {f: flightTime || '', d: out} : null;
}
function importDays(data) {
    const days = {};
    const minutes = value => (value === null || (Number.isFinite(value) && value >= 0 && value <= 1440)) ? value : undefined;
    if (!data || typeof data !== 'object') return {days, flightTime: ''};
    const dates = new Set(window.OAHU_SAMPLE.days.map(day => day.date));
    Object.entries(data.d && typeof data.d === 'object' ? data.d : {}).forEach(([date, day]) => {
        if (!dates.has(date) || !day || !Array.isArray(day.i) || !Array.isArray(day.t)) return;
        const tray = trayItems();
        const pool = window.OAHU_SAMPLE.days.flatMap(d => buildSuggested(d.date).items).concat(tray);
        const find = id => { const found = pool.find(item => item.id === id); return found ? clone(found) : null; };
        const items = day.i.map(entry => {
            if (typeof entry === 'string') return find(entry);
            if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') return null;
            if (entry.c) {
                const start = minutes(entry.p), length = minutes(entry.d);
                if (typeof entry.t !== 'string' || !entry.t.trim() || (start === undefined) || !length) return null;
                return {id: entry.id.slice(0, 40), title: entry.t.slice(0, 100), preferred: start, duration: length,
                    place: typeof entry.pl === 'string' ? entry.pl.slice(0, 40) : 'Other', locked: !!entry.l, custom: true, sourceId: entry.s || entry.id, manualTime: !!entry.m, estimate: entry.e !== false};
            }
            const item = find(entry.id) || pool.find(i => i.sourceId === entry.s) && clone(pool.find(i => i.sourceId === entry.s));
            if (!item) return null;
            item.id = entry.id; item.manualTime = !!entry.m; if (entry.e !== undefined) item.estimate = entry.e;
            item.locked = !!entry.l;
            if (minutes(entry.p) !== undefined) item.preferred = entry.p;
            if (minutes(entry.d)) item.duration = entry.d;
            if (entry.u && item.locked) Object.assign(item, {userLocked: true, basePreferred: minutes(entry.bp) ?? null, baseDuration: minutes(entry.bd) ?? item.duration});
            return item;
        }).filter(Boolean);
        days[date] = {date, items, unscheduled: (day.u || []).filter(e => e && typeof e.id === "string" && typeof e.title === "string" && e.duration > 0).map(e => ({...clone(pool.find(i => i.sourceId === e.sourceId) || {}), ...e, custom: !pool.some(i => i.sourceId === e.sourceId), preferred:null}))};
    });
    return {days, flightTime: typeof data.f === 'string' && parse(data.f) !== null ? data.f : ''};
}

function mount(root, ctx = {}) {
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
    if (ctx.shared) saved.days = days;
    let flightTime = saved.flightTime || '';
    if (ctx.dock) root.classList.add('db-dock');
    root.innerHTML = ctx.dock
        ? '<div class="db-workspace"><div class="db-content"></div><aside class="db-dock-tray" id="activity-tray" data-testid="activity-tray"></aside></div><div class="db-print-all"></div><div class="db-sr" role="status" aria-live="polite" data-testid="db-live"></div>'
        : '<div class="db-content"></div><div class="db-print-all"></div><div class="db-sr" role="status" aria-live="polite" data-testid="db-live"></div>';
    const content = root.querySelector('.db-content');
    const printAll = root.querySelector('.db-print-all');
    const live = root.querySelector('[data-testid=db-live]');
    let previousConflicts = new Map();
    let addedConflicts = [];
    let formStatus = '';
    let date = session.date;
    let expanded = false;
    let bookingOpen = false;
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
        return window.OAHU_SAMPLE.days.flatMap(d => visibleItems(days[d.date] || buildSuggested(d.date), d.date));
    }
    function addToDay(nextDate, spec) {
        if (!spec) return {ok: false, reason: 'Missing activity'};
        if (!window.OAHU_SAMPLE.days.some(d => d.date === nextDate)) return {ok:false, reason:'Choose a trip date'};
        if (spec.time && toTime(spec.time) === null) return {ok:false, reason:'Enter a clock time'};
        const pool = window.OAHU_SAMPLE.days.flatMap(d => buildSuggested(d.date).items).concat(trayItems());
        const base = spec.chestId ? pool.find(i => i.id === spec.chestId)
            : spec.sourceId ? pool.find(i => i.sourceId === spec.sourceId) : null;
        const identity = spec.sourceId || base?.sourceId || base?.id || ('own:' + String(spec.title || '').trim().toLowerCase());

        let item = base ? clone(base) : {title:String(spec.title || '').trim().slice(0,100), place:spec.place || 'Other', duration:Number(spec.duration) || 60, estimate:true, custom:true};
        if (!item.title) return {ok:false, reason:'Name the activity'};
        Object.assign(item, {sourceId:identity, preferred:null, locked:false, rules:spec.rules || item.rules || [], tags:spec.tags || item.tags || []});
        delete item.textTime; delete item.flight;
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
        return reflow({...stored, items: adjustedItems(visibleItems(stored, on), on)}, {...ctx, flightTime});
    }
    function schedule() {
        return {
            flightTime,
            days: window.OAHU_SAMPLE.days.map(day => {
                const stored = days[day.date] || buildSuggested(day.date);
                return {date: day.date, items: dayResult(stored, day.date).items};
            })
        };
    }
    function listFor(zone) {
        return zone === 'tray' ? current().unscheduled : current().items;
    }
    function positionMessage(id, zone) {
        const list = zone === 'tray' ? current().unscheduled : visibleItems(current(), date);
        const index = list.findIndex(i => i.id === id);
        return `${list[index].title}, position ${index + 1} of ${list.length}.`;
    }
    function lockButton(i, title, uid) {
        const label = i.locked ? 'Unlock time' : 'Lock time';
        return `<button type="button" class="db-lock-toggle" data-testid="db-lock" data-db-action="lock" aria-pressed="${!!i.locked}" aria-label="${label}" aria-describedby="db-title-${uid}" title="${esc(label + ' — ' + title)}">${icons[i.locked ? 'lock' : 'unlock']}</button>`;
    }
    function pair(i, tray, options = {}) {
        const on = options.date || date;
        const print = !!options.print;
        const uid = uidFor(on, i.id);
        const src = sourceOf(i, on);
        const hhmm = n => String(Math.floor(n / 60)).padStart(2,'0') + ':' + String(n % 60).padStart(2,'0');
        const canEditTime = !ctx.shared && !tray && !print && !i.textTime && !i.flight && i.kind !== 'prep' && i.kind !== 'travel';
        const editor = canEditTime && editingTime === on + '|' + i.id ? `<form class="db-time-editor" data-testid="activity-time-form" novalidate><p>${i.locked ? 'Unlock first to edit this activity’s time.' : 'Edit scheduled time'}</p><fieldset ${i.locked ? 'disabled' : ''}><legend>Activity time</legend><label>Start<input name="start" type="time" value="${hhmm(i.start)}" required></label><label>End <span data-time-estimate>${i.estimate ? '(estimate from default duration)' : ''}</span><input name="end" type="time" value="${hhmm(i.end)}"></label><label>Duration (minutes)<input name="duration" type="number" min="1" placeholder="${i.duration}"></label><button>Save activity time</button></fieldset><p role="alert" data-testid="activity-time-error"></p><button type="button" data-db-action="close-time">Close time editor</button></form>` : '';
        const blocker = tray ? (i.rules || []).find(r => !r.optional && !r.unconfirmed && r.minAge && (ctx.ages || [18,19]).some(age => Number(age) < r.minAge)) : null;
        const detail = (ctx.detail ? ctx.detail(src, on, i) : '') + (tray ? (i.rules || []).map(r => `<p>${esc(r.text || r)}</p>`).join('') : '');
        const open = !!detail && (print || session.open.has(on + '|' + i.id));
        const title = (!tray && ctx.titleFor && ctx.titleFor(src, on, i)) || i.title;
        const movable = !i.locked && i.kind !== 'prep' && !print;
        const canLock = !tray && !print && lockable(i);
        const classes = ['db-pair', i.notes && 'db-conflict', i.locked && 'db-locked', i.userLocked && 'db-user-locked',
            i.kind === 'prep' && 'db-prep', i.flex && 'db-free', detail && 'db-expandable', open && 'is-open',
            picked?.id === i.id && picked.zone === (tray ? 'tray' : 'day') && 'db-picked'].filter(Boolean).join(' ');
        const moves = tray ? button('handle', title) + '<button type="button" data-testid="schedule-item" data-db-action="schedule">Schedule</button>' : (movable ? button('handle', title) + button('up', title) + button('down', title) + button('remove', title) : '');
        const actions = !tray && !print && i.kind !== 'prep' ? '<div class="db-item-actions"><button type="button" data-db-action="again">Add it again</button><button type="button" data-db-action="move-day">Move to another day</button></div>' : '';
        const lockChip = i.locked ? '<span class="db-lock"><svg width="12" height="14" viewBox="0 0 14 16" aria-hidden="true"><path d="M3 7V4a4 4 0 018 0v3M1 7h12v8H1Z" fill="none" stroke="currentColor"/></svg> Locked</span>' : '';
        const controls = moves || canLock ? `<div class="db-controls">${canLock ? lockChip : ''}${moves}${canLock ? lockButton(i, title, uid) : ''}</div>` : '';
        const durationText = `${i.estimate ? '~' : ''}${i.duration} min`;
        const noteId = 'db-note-' + uid;
        const described = i.notes?.length ? ` aria-describedby="${esc(i.notes.map((_, index) => noteId + '-' + index).join(' '))}"` : '';
        const placeText = tray ? '' : `${esc(i.place)}${i.estimate ? ' · ' + durationText : ''}`;
        const heading = detail
            ? `<button type="button" class="db-expand" data-db-action="expand" data-testid="db-expand" id="db-title-${uid}" aria-expanded="${open}" aria-controls="db-detail-${uid}"><strong>${esc(title)}</strong><small>${placeText}</small><span class="db-expand-mark" aria-hidden="true">＋</span></button>`
            : `<strong id="db-title-${uid}">${esc(title)}</strong><small>${placeText}</small>`;
        const lockedLabel = i.userLocked ? 'Locked time — unlock to move' : 'Locked booking — times are fixed';
        return `<div class="${classes}" data-testid="db-pair" data-db-id="${esc(i.id)}" data-db-zone="${tray ? 'tray' : 'day'}"${src ? ` data-db-source="${esc(src)}"` : ''}${described}${i.locked && !print ? ' tabindex="0" aria-label="' + esc(title + '. ' + lockedLabel) + '"' : ''}>
            ${tray ? '' : `<${canEditTime ? 'button type="button" data-db-action="edit-time"' : 'div'} class="db-time" data-testid="db-time" aria-label="${canEditTime ? 'Edit time: ' : ''}${esc(i.flight ? flightTime || i.textTime : i.textTime || clock(i.start) + ' to ' + clock(i.end))}">${i.flight ? esc(flightTime || i.textTime) : i.textTime ? esc(i.textTime) : `<span>${clock(i.start)}</span><span>–${clock(i.end)}</span>`}</${canEditTime ? 'button' : 'div'}>`}
            <div class="db-activity" data-testid="db-activity">
                ${heading}${blocker ? `<small>Requires age ${esc(blocker.minAge)}+</small>` : ''}
                ${i.flight && !print ? `<label>Flight time<input type="time" aria-label="Flight time" data-testid="db-flight-time" value="${flightTime ? String(Math.floor(parse(flightTime) / 60)).padStart(2, '0') + ':' + String(parse(flightTime) % 60).padStart(2, '0') : ''}"></label>` : ''}
                ${!tray && i.detail ? `<small>${esc(i.detail)}</small>` : ''}
                ${canLock ? '' : lockChip}
                ${i.kind === 'prep' ? '<span class="db-tag">auto</span>' : ''}
                ${controls}${actions}${i.custom && !print ? button('delete', title) : ''}
                ${(i.notes || []).map((note, index) => `<p class="db-note" id="${esc(noteId + '-' + index)}" data-testid="db-note"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="M8 1L15 14H1Z" fill="none" stroke="currentColor"/><path d="M8 5v4m0 2v1" stroke="currentColor"/></svg>Heads-up: ${esc(note)}${note.includes('diving') ? ` <a href="${esc(window.OAHU_SOURCES.dan)}" target="_blank" rel="noopener">DAN guidance</a>` : ''}</p>`).join('')}
            </div>
            ${editor}
            ${detail ? `<div class="db-detail" id="db-detail-${uid}" data-testid="db-detail" role="region" aria-labelledby="db-title-${uid}"${open ? '' : ' hidden'}>${detail}</div>` : ''}</div>`;
    }
    function openTime(on, id) {
        if (ctx.shared) return;
        const item = (days[on] || buildSuggested(on)).items.find(i => i.id === id);
        if (item?.locked) { confirmUnlock(item, () => openTime(on, id)); return; }
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
    function confirmUnlock(item, apply) {
        const dialog = document.createElement('dialog');
        dialog.dataset.testid = 'unlock-confirm';
        dialog.addEventListener('cancel', () => dialog.remove());
        dialog.innerHTML = '<p>Unlock this item’s reserved time before changing it?</p><button data-testid="unlock-accept">Unlock this item</button><button data-testid="unlock-decline">Keep reserved time</button>';
        root.append(dialog); dialog.showModal();
        dialog.querySelector('[data-testid=unlock-decline]').onclick = () => dialog.remove();
        dialog.querySelector('[data-testid=unlock-accept]').onclick = () => { toggleLock(item, lastResult.items.find(i => i.id === item.id)); save(); dialog.remove(); apply(); };
    }
    function openTransfer(id, zone, mode) {
        const list = listFor(zone), item = list.find(i => i.id === id);
        if (!item) return;
        if (item.locked && mode !== 'again') { confirmUnlock(item, () => openTransfer(id, zone, mode)); return; }
        const dialog = document.createElement('dialog');
        dialog.addEventListener('cancel', () => dialog.remove());
        dialog.dataset.testid = mode === 'again' ? 'add-again-dialog' : mode === 'move-day' ? 'move-day-dialog' : 'schedule-dialog';
        const title = mode === 'again' ? 'Add it again' : mode === 'move-day' ? 'Move to another day' : 'Schedule';
        const explanation = mode === 'again' ? 'Creates a separate copy. The original stays where it is.' : mode === 'move-day' ? 'Moves this same item. It leaves the original day.' : '';
        dialog.setAttribute('aria-labelledby', 'db-transfer-title');
        dialog.innerHTML = `<h2 id="db-transfer-title">${title}</h2>${explanation ? `<p>${explanation}</p>` : ''}<form><label>Target date<select name="date">${window.OAHU_SAMPLE.days.map(d => `<option ${d.date === date ? 'selected' : ''}>${d.date}</option>`).join('')}</select></label><label>Start clock time (AM/PM)${mode === 'schedule' ? '' : ' — optional'}<input name="start" type="time" ${mode === 'schedule' ? 'required' : ''}></label>${mode === 'schedule' ? '<label>End clock time (AM/PM) — optional<input name="end" type="time"></label><p>Start only: end is an estimate from default duration.</p>' : ''}<button>${mode === 'again' ? 'Add a copy' : mode === 'move-day' ? 'Move' : 'Schedule'}</button><button type="button" data-cancel>Cancel</button><p role="alert"></p></form>`;
        root.append(dialog); dialog.showModal();
        dialog.querySelector('[data-cancel]').onclick = () => dialog.remove();
        dialog.querySelector('form').onsubmit = e => {
            e.preventDefault(); const form = e.target, target = form.elements.date.value, start = toTime(form.elements.start.value);
            const end = form.elements.end?.value ? toTime(form.elements.end.value) : null;
            if (end !== null && (start === null || end <= start)) { form.querySelector('[role=alert]').textContent = 'End must be after start'; return; }
            const copy = clone(item);
            if (mode === 'again') copy.id = 'instance-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
            else list.splice(list.findIndex(i => i.id === id), 1);
            copy.locked = false; delete copy.start; delete copy.end; delete copy.textTime; delete copy.travel; delete copy.notes; delete copy.userLocked; delete copy.basePreferred; delete copy.baseDuration;
            copy.preferred = start; delete copy.manualTime;
            days[target] ||= buildSuggested(target); days[target].unscheduled ||= [];
            if (start === null) days[target].unscheduled.push(copy);
            else { copy.manualTime = true; copy.estimate = end === null; if (end !== null) copy.duration = end-start; days[target].items.push(copy); }
            dialog.remove(); editingTime = null; save(); selectDay(target, false);
            if (start !== null) { root.querySelector('.db-dock-tray')?.classList.remove('is-open'); document.querySelector('[data-testid=tray-toggle]')?.setAttribute('aria-expanded','false'); }
        };
    }
    function closeTime() {
        const id = editingTime?.slice(editingTime.indexOf('|') + 1);
        editingTime = null;
        render();
        Array.from(root.querySelectorAll('[data-db-id]')).find(r => r.dataset.dbId === id)?.querySelector('[data-db-action=edit-time]')?.focus();
    }
    function timeInstances(identity) {
        return window.OAHU_SAMPLE.days.flatMap(d => dayResult(days[d.date] || buildSuggested(d.date), d.date).items
            .filter(i => (i.sourceId || i.id) === identity && !i.textTime && !i.flight && !['prep','travel'].includes(i.kind))
            .map(i => ({id:i.id, date:d.date, time:range(i.start,i.end)})));
    }
    root.addEventListener('keydown', e => {
        if (e.key === 'Escape' && editingTime) { e.preventDefault(); e.stopImmediatePropagation(); closeTime(); }
    });
    function alreadyOnDay(item) {
        return draftItems().some(existing => (existing.sourceId || existing.id) === (item.sourceId || item.id));
    }
    function timelineHTML(result, options) {
        return result.items.map(i => {
            const travel = i.travel ? `<div class="db-travel${i.travel.late ? ' db-travel-late' : ''}" data-testid="db-travel">${i.travel.late ? esc(i.travel.label) + ' · leave by ' + clock(i.travel.depart) : clock(i.travel.depart) + ' · ' + esc(i.travel.label) + (i.travel.minutes ? ' · arrive ' + clock(i.travel.arrive) : '')}</div>` : '';
            return (i.walkBack ? `<div class="db-travel" data-testid="db-travel">${clock(i.walkBack.depart)} · Walk ~10 min · arrive ${clock(i.walkBack.arrive)}</div>` : '') + travel + pair(i, false, options);
        }).join('');
    }
    function dayIndex(on) {
        return window.OAHU_SAMPLE.days.findIndex(day => day.date === on);
    }
    function render(focus) {
        const d = current();
        const result = dayResult(d, date);
        lastResult = result;
        addedConflicts = result.conflicts.filter(c => !previousConflicts.has(c.id + '|' + c.note)).map(c => result.items.find(i => i.id === c.id).title + ' — ' + c.note);
        previousConflicts = new Map(result.conflicts.map(c => [c.id + '|' + c.note, true]));
        const availableTray = ctx.shared ? [] : d.unscheduled;
        const summary = result.conflicts.length ? `${result.conflicts.length} heads-up` : 'All clear';
        const chips = window.OAHU_SAMPLE.days.map((day, index) => {
            const weekday = new Date(day.date + 'T12:00:00Z').toLocaleDateString('en-US', {weekday: 'short', timeZone: 'UTC'});
            const label = weekday + ' ' + Number(day.date.slice(-2));
            return `<button type="button" data-db-action="day" data-date="${day.date}" data-testid="db-day-${day.date}" aria-pressed="${day.date === date}"${ctx.dayHead ? ` aria-label="Day ${index + 1} · ${label}"` : ''}>${ctx.dayHead ? `<span class="db-day-num">Day ${index + 1}</span> ` : ''}${label}</button>`;
        }).join('');
        const index = dayIndex(date);
        const card = inner => ctx.dayHead
            ? `<section class="card day db-daycard" id="day-${index}" data-testid="plan-day" data-date="${date}">${ctx.dayHead(date)}${inner}${ctx.dayFooter ? ctx.dayFooter(date) : ''}</section>`
            : inner;
        content.innerHTML = `<div class="db-heading"><h2>${ctx.dayHead ? 'Your days' : 'Build your day'}</h2><span class="db-summary" data-testid="db-summary">${summary}</span><button type="button" data-testid="db-reset" data-db-action="reset">Reset to suggested</button></div>
            <div class="db-days" data-testid="db-day" role="group" aria-label="Oahu day">${chips}</div>
            ${card(`<div class="db-day" data-testid="db-day-list">${timelineHTML(result)}</div>
            ${ctx.dayExtras ? ctx.dayExtras(date) : ''}
            ${ctx.shared && d.unscheduled.length ? `<section data-testid="unscheduled-section"><h3>Unscheduled</h3><ul>${d.unscheduled.map(i => `<li>${esc(i.title)}</li>`).join('')}</ul></section>` : ''}
            <div class="db-tools">
            <button type="button" class="db-chest-toggle" data-testid="db-tray-toggle" data-db-action="toggle" aria-expanded="${expanded}" aria-controls="db-chest">Treasure chest <span class="db-count">${availableTray.length}</span></button>
            <button type="button" data-testid="db-booking-toggle" data-db-action="booking" aria-expanded="${bookingOpen}" aria-controls="db-booking">+ Add booking</button>
            </div>
            <div id="db-chest" class="db-tray" data-testid="db-tray" ${expanded ? '' : 'hidden'}>${availableTray.map(i => pair(i, true)).join('')}</div>
            <form id="db-booking" class="db-form" data-testid="db-booking-form" ${bookingOpen ? '' : 'hidden'}>
                <label>Name<input name="name" data-testid="db-booking-name" required maxlength="100"></label>
                <label>Start<input name="start" data-testid="db-booking-start" type="time" required></label>
                <label>End<input name="end" data-testid="db-booking-end" type="time" required></label>
                <label>Place<select name="place" data-testid="db-booking-place">${[HOTEL, WAIKIKI, 'Kewalo Basin', 'Kualoa Ranch', 'Diamond Head', 'Ala Moana', 'Kailua', 'Makapuu', 'HNL', 'Other'].map(p => `<option>${p}</option>`).join('')}</select></label>
                <button data-testid="db-booking-add">Anchor it</button><p data-testid="db-form-note" role="status">${esc(formStatus)}</p>
            </form>`)}`;
        if (!reducedMotion()) {
            root.querySelectorAll('.db-conflict').forEach(element => {
                element.classList.add('db-shake');
                element.addEventListener('animationend', () => element.classList.remove('db-shake'), {once: true});
            });
        }
        root.querySelectorAll('[aria-describedby]').forEach(row => row.matches('[data-db-id]') && row.querySelector('[data-db-action=handle]')?.setAttribute('aria-describedby', row.getAttribute('aria-describedby')));
        if (ctx.dock) {
            const aside = root.querySelector('.db-dock-tray');
            if (aside) {
                aside.querySelectorAll('.db-tray,.db-tools,.db-form').forEach(node => node.remove());
                const tools = content.querySelector('.db-tools');
                const tray = content.querySelector('.db-tray');
                const form = content.querySelector('.db-form');
                if (tools) aside.append(tools);
                if (tray) { tray.hidden = false; aside.append(tray); }
                if (tools) tools.hidden = true;
                if (form) aside.append(form);
            }
        }
        if (ctx.afterRender) ctx.afterRender(content, date);
        if (focus) {
            const row = Array.from(root.querySelectorAll('[data-db-id]')).find(e => e.dataset.dbId === focus.id && e.dataset.dbZone === focus.zone);
            (row?.querySelector(`[data-db-action="${focus.action || 'handle'}"]`) || row)?.focus({preventScroll: true});
        }
        return result;
    }
    // Print shows every day once, with every box open and no controls.
    function renderPrint(on) {
        if (!on) { printAll.innerHTML = ''; root.classList.remove('db-printing'); return; }
        printAll.innerHTML = window.OAHU_SAMPLE.days.map(day => {
            const stored = days[day.date] || buildSuggested(day.date);
            const result = dayResult(stored, day.date);
            return `<section class="card day db-print-day" data-date="${day.date}">${ctx.dayHead ? ctx.dayHead(day.date, {print: true}) : ''}<div class="db-day">${timelineHTML(result, {print: true, date: day.date})}</div>${ctx.dayExtras ? ctx.dayExtras(day.date, {print: true}) : ''}</section>`;
        }).join('');
        printAll.querySelectorAll('[data-testid]').forEach(element => element.removeAttribute('data-testid'));
        printAll.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
        printAll.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
        printAll.querySelectorAll('input[type=checkbox]').forEach(box => box.replaceWith(document.createTextNode(box.checked || box.hasAttribute('checked') ? '☑ ' : '☐ ')));
        printAll.querySelectorAll('details').forEach(element => { element.open = true; });
        root.classList.add('db-printing');
    }
    function setExpanded(row, force) {
        const toggle = row?.querySelector('[data-db-action=expand]');
        if (!toggle) return false;
        const panel = row.querySelector('.db-detail');
        const on = force ?? toggle.getAttribute('aria-expanded') !== 'true';
        const key = date + '|' + row.dataset.dbId;
        toggle.setAttribute('aria-expanded', String(on));
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
        if (!window.OAHU_SAMPLE.days.some(day => day.date === next)) return;
        date = next;
        session.date = next;
        formStatus = '';
        picked = null;
        render();
        if (focusChip) root.querySelector(`[data-testid="db-day-${date}"]`).focus({preventScroll: true});
    }

    // Position is an insertion boundary in the destination list, before removal.
    function change(id, zone, action, target) {
        const list = listFor(zone);
        const index = list.findIndex(i => i.id === id);
        const item = list[index];
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
        list.splice(index, 1);
        if (zone === 'tray') { item.preferred = null; delete item.manualTime; delete item.start; delete item.end; }
        if (zone !== 'tray' || !destination.some(existing => existing.id === item.id)) destination.splice(at, 0, item);
        session.open.delete(date + '|' + id);
        save();
        render({id, zone});
        announce(positionMessage(id, zone));
    }
    function lock(id) {
        const item = current().items.find(i => i.id === id);
        if (!item || !lockable(item)) return;
        const shown = lastResult.items.find(i => i.id === id);
        if (item.locked) { confirmUnlock(item, () => { save(); render({id, zone:'day', action:'lock'}); announce('Unlocked ' + item.title + ' — it moves with the day again.'); }); return; }
        const locked = toggleLock(item, shown);
        save();
        const result = render({id, zone: 'day', action: 'lock'});
        const now = result.items.find(i => i.id === id);
        if (!locked && editingTime === date + '|' + id) root.querySelector('[data-testid=activity-time-form] [name=start]')?.focus();
        announce(locked ? `Locked ${item.title} at ${now && now.start != null ? range(now.start, now.end) : 'its time'}.` : `Unlocked ${item.title} — it moves with the day again.`);
    }

    root.addEventListener('click', e => {
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
        if (['again','move-day','schedule'].includes(action)) { openTransfer(row.dataset.dbId, row.dataset.dbZone, action);
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
        } else if (action === 'toggle') {
            expanded = !expanded;
            render();
            root.querySelector('[data-testid="db-tray-toggle"]').focus();
        } else if (action === 'booking') {
            bookingOpen = !bookingOpen;
            render();
            root.querySelector('[data-testid="db-booking-toggle"]').focus();
        } else if (action === 'reset') {
            picked = null;
            formStatus = '';
            days[date] = buildSuggested(date);
            save();
            render();
            root.querySelector('[data-testid=db-reset]').focus();
            announce('Reset to suggested. Fair winds!');
        } else if (action === 'delete') {
            let nextRow = row.nextElementSibling;
            while (nextRow && !nextRow.dataset.dbId) nextRow = nextRow.nextElementSibling;
            const next = nextRow?.dataset.dbId;
            formStatus = '';
            current().items = current().items.filter(i => i.id !== row.dataset.dbId);
            save();
            render();
            (root.querySelector(`[data-db-id="${next}"] button`) || root.querySelector(`[data-db-id="${next}"][tabindex]`) || root.querySelector('[data-testid=db-booking-toggle]')).focus();
            announce('Booking deleted');
        } else if (action !== 'handle') {
            change(row.dataset.dbId, row.dataset.dbZone, action);
        }
    });
    root.addEventListener('input', e => {
        if (e.target.closest('.db-time-editor') && ['end','duration'].includes(e.target.name)) {
            e.target.form.dataset.lastManual = e.target.name;
            if (e.target.name === 'end') e.target.dataset.manual = 'true';
            e.target.form.querySelector('[data-time-estimate]').textContent = '';
            if (e.target.name === 'duration' && Number(e.target.value) > 0) {
                const form = e.target.form, parts = form.elements.start.value.split(':').map(Number);
                const end = parts[0] * 60 + parts[1] + Number(e.target.value);
                form.elements.end.value = end < 1440 ? String(Math.floor(end/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0') : '';
            }
        }
        if (e.target.closest('.db-time-editor') && e.target.name === 'start') {
            const form = e.target.form, item = current().items.find(i => i.id === form.closest('[data-db-id]').dataset.dbId);
            if (!form.elements.end.dataset.manual && !form.elements.duration.value && e.target.value) {
                const [h,m] = e.target.value.split(':').map(Number), end = h*60+m+item.duration;
                form.querySelector('[data-time-estimate]').textContent = '(estimate from default duration)';
                form.elements.end.value = String(Math.floor(end/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0');
            }
        }
    });
    root.addEventListener('change', e => {
        if (e.target.matches('[data-testid=db-flight-time]')) {
            const [h, m] = e.target.value.split(':').map(Number);
            flightTime = e.target.value ? clock(h * 60 + m) : '';
            save(); render(); root.querySelector('[data-testid=db-flight-time]').focus(); announce('Flight time updated');
        }
    });
    root.addEventListener('submit', e => {
        if (e.target.matches('.db-time-editor')) {
            e.preventDefault();
            const form = e.target, row = form.closest('[data-db-id]');
            const item = current().items.find(i => i.id === row.dataset.dbId);
            if (!item || item.locked) return;
            const time = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? Number(v.slice(0,2))*60 + Number(v.slice(3)) : NaN;
            const start = time(form.elements.start.value);
            const durationField = form.elements.duration;
            const endField = form.elements.end;
            const explicitDuration = durationField.value && form.dataset.lastManual !== 'end';
            const length = explicitDuration ? Number(durationField.value) : endField.dataset.manual ? time(endField.value)-start : item.duration;
            if (!Number.isFinite(start) || !Number.isFinite(length) || length <= 0 || start + length > 1440 || !form.checkValidity()) {
                form.querySelector('[role=alert]').textContent = 'Enter valid times and a positive duration. End must be after start.';
                form.setAttribute('aria-invalid','true');
                [form.elements.start, endField, durationField].forEach(field => field.setAttribute('aria-invalid','true')); return;
            }
            Object.assign(item,{preferred:start,duration:length,manualTime:true,estimate: !(durationField.value || endField.dataset.manual)});
            save(); closeTime(); announce('Activity time updated. Travel and prep are estimated separately.');
            return;
        }
        if (!e.target.matches('.db-form')) return;
        e.preventDefault();
        const values = new FormData(e.target);
        const toMinutes = s => {
            const [h, m] = s.split(':').map(Number);
            return h * 60 + m;
        };
        const start = toMinutes(values.get('start'));
        const end = toMinutes(values.get('end'));
        if (end <= start) {
            root.querySelector('[data-testid="db-form-note"]').textContent = 'End must be after start';
            return;
        }
        const item = {id: 'custom-' + Date.now(), title: values.get('name').trim(), preferred: start,
            duration: end - start, place: values.get('place'), locked: true, custom: true};
        if (!item.title) return;
        const d = current();
        const at = d.items.findIndex(i => (i.preferred ?? 1440) > start);
        d.items.splice(at < 0 ? d.items.length : at, 0, item);
        const overlap = d.items.find(i => i.id !== item.id && i.locked && i.preferred < end && i.preferred + i.duration > start);
        formStatus = overlap ? 'Overlaps ' + (overlap.venue || (overlap.dressy ? 'La Mer at Halekulani' : overlap.title)) : '';
        save();
        const result = render({id: item.id, zone: 'day'});
        if (!formStatus && result.conflicts.length) {
            formStatus = result.conflicts[0].note;
            root.querySelector('[data-testid=db-form-note]').textContent = formStatus;
        }
        announce('Locked booking added. ' + formStatus);
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
        const tray = hit?.closest('[data-testid="db-tray"], [data-testid="db-tray-toggle"]');
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
    root.addEventListener('pointercancel', cancelDrag);
    root.addEventListener('lostpointercapture', () => { if (drag) cancelDrag(); });
    const api = {
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
window.DayBuilder = {buildSuggested, reflow, commuteMinutes, mount, render: mount, trayItems, clock, range,
    toggleLock, exportDays, importDays, sourceOf,
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
    addToDay: (date, spec) => active()?.addToDay(date, spec) || {ok: false, reason: 'Open a draft first'},
    resetSession: () => { session.date = '2026-11-26'; session.open.clear(); session.shared = null; session.sharedKey = null; }};
})();
