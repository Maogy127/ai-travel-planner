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
    if (!day) return {date, items: []};
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
    return {date, items};
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
    let previous = null;
    function warn(item, note, source, priority = 2) {
        if (item.notePriority !== undefined && item.notePriority <= priority) return;
        item.notes = [note];
        item.notePriority = priority;
        item.noteSource = source;
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
        item.start = item.locked && item.preferred !== null ? item.preferred : Math.max(earliest, item.preferred ?? (previous ? 0 : 540));
        if (item.flex && !item.locked) {
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
    return {items: output, conflicts: output.filter(item => item.notes?.length).map(item => ({
        id: item.id, note: item.notes[0], source: item.noteSource
    }))};
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
function button(action, title) {
    const label = esc(labels[action] + ' ' + title);
    return `<button type="button" data-testid="db-${action}" data-db-action="${action}" aria-label="${label}" title="${label}">${icons[action]}</button>`;
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
            if (item.custom) return {c: 1, id: item.id, t: String(item.title).slice(0, 100), p: item.preferred, d: item.duration, pl: item.place, l: item.locked ? 1 : 0};
            const original = pool.find(candidate => candidate.id === item.id);
            if (original && !!original.locked === !!item.locked && original.preferred === item.preferred && original.duration === item.duration) return item.id;
            const entry = {id: item.id, l: item.locked ? 1 : 0, p: item.preferred, d: item.duration};
            if (item.userLocked) Object.assign(entry, {u: 1, bp: item.basePreferred, bd: item.baseDuration});
            return entry;
        });
        const trayIds = day.tray.map(item => item.id);
        if (JSON.stringify(items) !== JSON.stringify(base.map(item => item.id)) || JSON.stringify(trayIds) !== JSON.stringify(tray.map(item => item.id))) {
            out[date] = {i: items, t: trayIds};
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
        const pool = buildSuggested(date).items.concat(tray);
        const find = id => { const found = pool.find(item => item.id === id); return found ? clone(found) : null; };
        const items = day.i.map(entry => {
            if (typeof entry === 'string') return find(entry);
            if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') return null;
            if (entry.c) {
                const start = minutes(entry.p), length = minutes(entry.d);
                if (typeof entry.t !== 'string' || !entry.t.trim() || start == null || !length) return null;
                return {id: entry.id.slice(0, 40), title: entry.t.slice(0, 100), preferred: start, duration: length,
                    place: typeof entry.pl === 'string' ? entry.pl.slice(0, 40) : 'Other', locked: !!entry.l, custom: true};
            }
            const item = find(entry.id);
            if (!item) return null;
            item.locked = !!entry.l;
            if (minutes(entry.p) !== undefined) item.preferred = entry.p;
            if (minutes(entry.d)) item.duration = entry.d;
            if (entry.u && item.locked) Object.assign(item, {userLocked: true, basePreferred: minutes(entry.bp) ?? null, baseDuration: minutes(entry.bd) ?? item.duration});
            return item;
        }).filter(Boolean);
        days[date] = {date, items, tray: day.t.map(id => tray.find(item => item.id === id)).filter(Boolean)};
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
    root.innerHTML = '<div class="db-content"></div><div class="db-print-all"></div><div class="db-sr" role="status" aria-live="polite" data-testid="db-live"></div>';
    const content = root.querySelector('.db-content');
    const printAll = root.querySelector('.db-print-all');
    const live = root.querySelector('[data-testid=db-live]');
    let previousConflicts = new Map();
    let addedConflicts = [];
    let formStatus = '';
    let date = session.date;
    let expanded = false;
    let bookingOpen = false;
    let picked = null;
    let drag = null;
    let lastResult = {items: []};
    let suppressClick = false;

    function current() {
        if (!days[date]) days[date] = {...buildSuggested(date), tray: trayItems()};
        return days[date];
    }
    function announce(message) {
        live.textContent = message + (addedConflicts.length ? ' Heads-up: ' + addedConflicts[0] + (addedConflicts.length > 1 ? ' +' + (addedConflicts.length - 1) + ' more' : '') : '');
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
        return zone === 'tray' ? current().tray : current().items;
    }
    function positionMessage(id, zone) {
        const list = zone === 'tray' ? current().tray : visibleItems(current(), date);
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
        const src = tray ? null : sourceOf(i, on);
        const detail = !tray && ctx.detail ? ctx.detail(src, on, i) : '';
        const open = !!detail && (print || session.open.has(on + '|' + i.id));
        const title = (!tray && ctx.titleFor && ctx.titleFor(src, on, i)) || i.title;
        const movable = !i.locked && i.kind !== 'prep' && !print;
        const canLock = !tray && !print && lockable(i);
        const classes = ['db-pair', i.notes && 'db-conflict', i.locked && 'db-locked', i.userLocked && 'db-user-locked',
            i.kind === 'prep' && 'db-prep', i.flex && 'db-free', detail && 'db-expandable', open && 'is-open',
            picked?.id === i.id && picked.zone === (tray ? 'tray' : 'day') && 'db-picked'].filter(Boolean).join(' ');
        const moves = movable ? button('handle', title) + (tray ? button('add', title) : button('up', title) + button('down', title) + button('remove', title)) : '';
        const lockChip = i.locked ? '<span class="db-lock"><svg width="12" height="14" viewBox="0 0 14 16" aria-hidden="true"><path d="M3 7V4a4 4 0 018 0v3M1 7h12v8H1Z" fill="none" stroke="currentColor"/></svg> Locked</span>' : '';
        const controls = moves || canLock ? `<div class="db-controls">${canLock ? lockChip : ''}${moves}${canLock ? lockButton(i, title, uid) : ''}</div>` : '';
        const durationText = `${i.estimate ? '~' : ''}${i.duration} min`;
        const noteId = 'db-note-' + uid;
        const described = i.notes?.length ? ` aria-describedby="${esc(noteId)}"` : '';
        const placeText = `${esc(i.place)}${tray || i.estimate ? ' · ' + durationText : ''}`;
        const heading = detail
            ? `<button type="button" class="db-expand" data-db-action="expand" data-testid="db-expand" id="db-title-${uid}" aria-expanded="${open}" aria-controls="db-detail-${uid}"><strong>${esc(title)}</strong><small>${placeText}</small><span class="db-expand-mark" aria-hidden="true">＋</span></button>`
            : `<strong id="db-title-${uid}">${esc(title)}</strong><small>${placeText}</small>`;
        const lockedLabel = i.userLocked ? 'Locked time — unlock to move' : 'Locked booking — times are fixed';
        return `<div class="${classes}" data-testid="db-pair" data-db-id="${esc(i.id)}" data-db-zone="${tray ? 'tray' : 'day'}"${src ? ` data-db-source="${esc(src)}"` : ''}${described}${i.locked && !print ? ' tabindex="0" aria-label="' + esc(title + '. ' + lockedLabel) + '"' : ''}>
            ${tray ? '' : `<div class="db-time" data-testid="db-time" aria-label="${esc(i.flight ? flightTime || i.textTime : i.textTime || clock(i.start) + ' to ' + clock(i.end))}">${i.flight ? esc(flightTime || i.textTime) : i.textTime ? esc(i.textTime) : `<span>${clock(i.start)}</span><span>–${clock(i.end)}</span>`}</div>`}
            <div class="db-activity" data-testid="db-activity">
                ${heading}
                ${i.flight && !print ? `<label>Flight time<input type="time" aria-label="Flight time" data-testid="db-flight-time" value="${flightTime ? String(Math.floor(parse(flightTime) / 60)).padStart(2, '0') + ':' + String(parse(flightTime) % 60).padStart(2, '0') : ''}"></label>` : ''}
                ${i.detail ? `<small>${esc(i.detail)}</small>` : ''}
                ${canLock ? '' : lockChip}
                ${i.kind === 'prep' ? '<span class="db-tag">auto</span>' : ''}
                ${controls}${i.custom && !print ? button('delete', title) : ''}
                ${(i.notes || []).map(note => `<p class="db-note" id="${esc(noteId)}" data-testid="db-note"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="M8 1L15 14H1Z" fill="none" stroke="currentColor"/><path d="M8 5v4m0 2v1" stroke="currentColor"/></svg>Heads-up: ${esc(note)}${note.includes('diving') ? ` <a href="${esc(window.OAHU_SOURCES.dan)}" target="_blank" rel="noopener">DAN guidance</a>` : ''}</p>`).join('')}
            </div>
            ${detail ? `<div class="db-detail" id="db-detail-${uid}" data-testid="db-detail" role="region" aria-labelledby="db-title-${uid}"${open ? '' : ' hidden'}>${detail}</div>` : ''}</div>`;
    }
    function alreadyOnDay(item) {
        const sourceId = item.sourceId || trayItems().find(candidate => candidate.id === item.id)?.sourceId;
        return current().items.some(existing => existing.id === sourceId || existing.title === item.title);
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
        addedConflicts = result.conflicts.filter(c => previousConflicts.get(c.id) !== c.note).map(c => result.items.find(i => i.id === c.id).title + ' — ' + c.note);
        previousConflicts = new Map(result.conflicts.map(c => [c.id, c.note]));
        const availableTray = d.tray.filter(item => !alreadyOnDay(item));
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
            <div class="db-tools">
            <button type="button" class="db-chest-toggle" data-testid="db-tray-toggle" data-db-action="toggle" aria-expanded="${expanded}" aria-controls="db-chest">Treasure chest <span class="db-count">${availableTray.length}</span></button>
            <button type="button" data-testid="db-booking-toggle" data-db-action="booking" aria-expanded="${bookingOpen}" aria-controls="db-booking">+ Add booking</button>
            </div>
            <div id="db-chest" class="db-tray" data-testid="db-tray" ${expanded ? '' : 'hidden'}><small>~ = estimate</small>${availableTray.map(i => pair(i, true)).join('')}</div>
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
        if (action === 'add' && alreadyOnDay(item)) return;
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
        destination.splice(at, 0, item);
        session.open.delete(date + '|' + id);
        save();
        render({id, zone});
        announce(positionMessage(id, zone));
    }
    function lock(id) {
        const item = current().items.find(i => i.id === id);
        if (!item || !lockable(item)) return;
        const shown = lastResult.items.find(i => i.id === id);
        const locked = toggleLock(item, shown);
        save();
        const result = render({id, zone: 'day', action: 'lock'});
        const now = result.items.find(i => i.id === id);
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
            if (row && !e.target.closest('a,button,input,select,textarea,label,summary,details,.db-detail')) setExpanded(row);
            return;
        }
        const action = b.dataset.dbAction;
        const row = b.closest('[data-db-id]');
        if (action === 'day') {
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
            days[date] = {...buildSuggested(date), tray: trayItems()};
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
    root.addEventListener('change', e => {
        if (e.target.matches('[data-testid=db-flight-time]')) {
            const [h, m] = e.target.value.split(':').map(Number);
            flightTime = e.target.value ? clock(h * 60 + m) : '';
            save(); render(); root.querySelector('[data-testid=db-flight-time]').focus(); announce('Flight time updated');
        }
    });
    root.addEventListener('submit', e => {
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
        if (!handle) return;
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
        if (!handle || e.button !== 0 || picked) return;
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
        render, selectDay, renderPrint, root,
        getDay: () => clone(current()),
        date: () => date,
        exportState: () => exportDays(days, flightTime),
        schedule,
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
    resetSession: () => { session.date = '2026-11-26'; session.open.clear(); session.shared = null; session.sharedKey = null; }};
})();
