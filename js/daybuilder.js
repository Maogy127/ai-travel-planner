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
const routes = {
    'Kahala|Waikiki': 20, 'Kahala|Kewalo Basin': 30, 'Diamond Head|Waikiki': 20,
    'Kualoa Ranch|Waikiki': 60, 'Kahala|Kailua': 45, 'Kailua|Makapuu': 35
};
function commuteMinutes(from, to) {
    if (from === to) return 0;
    return routes[from + '|' + to] ?? routes[to + '|' + from] ?? 30;
}
function leg(from, to) {
    const minutes = commuteMinutes(from, to);
    let label = '~15–30 min, check route';
    if (!minutes) label = 'short walk';
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
        id: item.id, title: clean(item.title), place: place(item.title), preferred: parse(item.time),
        duration: duration(item), kind: item.kind, tags: /intro dive/i.test(item.title) ? ['dive'] : [],
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
        items = items.slice(0, 7);
        const durations = [15, 90, 20, 70, 15, 150, 60];
        items.forEach((item, index) => { item.duration = durations[index]; item.estimate = false; });
        Object.assign(items[0], {place: HOTEL, to: 'Diamond Head'});
        items[1].locked = true;
        Object.assign(items[2], {place: 'Diamond Head', to: WAIKIKI});
        Object.assign(items[3], {place: WAIKIKI, to: 'Kualoa Ranch', locked: true});
        Object.assign(items[6], {place: 'Kualoa Ranch', to: WAIKIKI, locked: true});
        items.push(
            {id: 'return-hotel', title: 'Uber to the Kahala', place: WAIKIKI, to: HOTEL, preferred: 840, duration: 20, kind: 'travel'},
            {id: 'free', title: 'Free time', place: HOTEL, preferred: 870, duration: 120, flex: true},
            {id: 'photos', title: 'Sunset photos at the Kahala palms', place: HOTEL, preferred: 1050, duration: 60, detail: 'Sunset ~5:48 PM'},
            {id: 'lamer', title: 'Dinner — La Mer at Halekulani', place: WAIKIKI, preferred: 1170, duration: 120, locked: true, dressy: true}
        );
    }
    // Flight departure is unknown: preserve the source's relative time as an anchor.
    if (date === '2026-11-29') items.forEach(item => {
        item.locked = true;
        item.textTime = 'Flight − 3 h 05';
        item.detail = '';
        item.preferred = null;
    });
    return {date, items};
}
function trayItems() {
    const all = window.OAHU_SAMPLE.days.flatMap(day => day.items);
    const patterns = [/Beginner intro dive/, /Waikiki parasail/, /Jurassic Adventure/, /Black Friday shopping/,
        /^Royal Hawaiian Center/, /palms — sunset/, /^Magic Island/, /^Waikiki Beach sunset/, /Spa \/ rest/,
        /Lanikai Pillbox/, /^Makapuʻu Lighthouse Trail/, /Diamond Head —/];
    return patterns.map((pattern, index) => {
        const item = convert(all.find(item => pattern.test(item.title)));
        Object.assign(item, {sourceId: item.id, id: 'chest-' + index, preferred: null, locked: false});
        if (index === 8) item.title = 'Spa at the Kahala';
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
        raw.splice(at, 0, {id: 'prep-dress', title: 'Get ready / change + makeup', place: HOTEL,
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
        const travel = previous ? leg(previous.to || previous.place, item.place) : {minutes: 0, label: ''};
        const earliest = previous ? previous.end + travel.minutes : 0;
        item.start = item.locked && item.preferred !== null ? item.preferred : Math.max(earliest, item.preferred ?? (previous ? 0 : 540));
        if (item.flex) {
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
                warn(previous, 'Ends ' + clock(previous.end) + " — you'd miss " + (item.dressy ? 'La Mer' : item.title), undefined, 0);
            }
            // An explicit ride already includes travel: no redundant short walk.
            if (previous.kind === 'travel' || previous.to) item.travel = null;
        }
        if ((item.tags || []).includes('dive') && day.date >= '2026-11-28') {
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
                warn(item, 'Ends ' + clock(item.end) + " — you'd miss " + (booking.dressy ? 'La Mer' : booking.title), undefined, 0);
            }
            if (!item.locked && item.start < booking.preferred + booking.duration && item.end > booking.preferred) {
                warn(item, 'Overlaps ' + booking.title, undefined, 1);
            }
        }
        const sunset = window.OAHU_SAMPLE.weather.text.match(/sunset approx\. (\d{1,2}:\d{2} PM)/i);
        if (/sunset.*photo|photo.*sunset/i.test(item.title) && sunset && item.start > parse(sunset[1])) {
            warn(item, 'Starts after sunset (~' + sunset[1] + ')', undefined, 4);
        }
        output.push(item);
        previous = item;
        if ((item.tags || []).includes('dive')) {
            const prep = {id: 'prep-' + item.id, title: 'Rinse off & change', place: item.place,
                start: item.end, end: item.end + 30, duration: 30, kind: 'prep', detail: '~30 min, est.'};
            output.push(prep);
            previous = prep;
        }
    }
    return {items: output, conflicts: output.filter(item => item.notes?.length).map(item => ({
        id: item.id, note: item.notes[0], source: item.noteSource
    }))};
}
const icons = {handle: '⠿', up: '↑', down: '↓', remove: '⇥', add: '+ Add', delete: '×'};
const labels = {handle: 'Move', up: 'Move up', down: 'Move down', remove: 'To chest', add: 'Add to day', delete: 'Delete booking'};
function button(action, title) {
    const label = esc(labels[action] + ' ' + title);
    return `<button type="button" data-testid="db-${action}" data-db-action="${action}" aria-label="${label}" title="${label}">${icons[action]}</button>`;
}

function mount(root, ctx = {}) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    const days = saved.days || {};
    let date = '2026-11-26';
    let expanded = false;
    let bookingOpen = false;
    let picked = null;
    let drag = null;

    function current() {
        if (!days[date]) days[date] = {...buildSuggested(date), tray: trayItems()};
        return days[date];
    }
    function announce(message) {
        const live = document.getElementById('live');
        if (live) live.textContent = message;
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify({days})); } catch (e) {}
    }
    function listFor(zone) {
        return zone === 'tray' ? current().tray : current().items;
    }
    function positionMessage(id, zone) {
        const list = listFor(zone);
        const index = list.findIndex(i => i.id === id);
        return `${list[index].title}, position ${index + 1} of ${list.length}.`;
    }
    function pair(i, tray) {
        const movable = !i.locked && i.kind !== 'prep';
        const classes = ['db-pair', i.notes && 'db-conflict', i.locked && 'db-locked',
            i.kind === 'prep' && 'db-prep', i.flex && 'db-free',
            picked?.id === i.id && picked.zone === (tray ? 'tray' : 'day') && 'db-picked'].filter(Boolean).join(' ');
        const controls = movable ? `<div class="db-controls">${button('handle', i.title)}${tray
            ? button('add', i.title)
            : button('up', i.title) + button('down', i.title) + button('remove', i.title)}</div>` : '';
        const durationText = `${i.duration} min${i.estimate ? ', est.' : ''}`;
        return `<div class="${classes}" data-testid="db-pair" data-db-id="${esc(i.id)}" data-db-zone="${tray ? 'tray' : 'day'}"${i.locked ? ' tabindex="0" aria-label="' + esc(i.title + '. Locked booking — times are fixed') + '"' : ''}>
            ${tray ? '' : `<div class="db-time" data-testid="db-time">${esc(i.textTime || range(i.start, i.end))}</div>`}
            <div class="db-activity" data-testid="db-activity">
                <strong>${esc(i.title)}</strong>
                <small>${esc(i.place)}${tray || i.estimate ? ' · ' + durationText : ''}</small>
                ${i.detail ? `<small>${esc(i.detail)}</small>` : ''}
                ${i.locked ? '<span class="db-lock"><svg width="12" height="14" viewBox="0 0 14 16" aria-hidden="true"><path d="M3 7V4a4 4 0 018 0v3M1 7h12v8H1Z" fill="none" stroke="currentColor"/></svg> Locked</span>' : ''}
                ${i.kind === 'prep' ? '<span class="db-tag">auto</span>' : ''}
                ${controls}${i.custom ? button('delete', i.title) : ''}
                ${(i.notes || []).map(note => `<p class="db-note" data-testid="db-note">${esc(note)}${note.includes('diving') ? ` <a href="${esc(window.OAHU_SOURCES.dan)}" target="_blank" rel="noopener">DAN guidance</a>` : ''}</p>`).join('')}
            </div></div>`;
    }
    function alreadyOnDay(item) {
        const sourceId = item.sourceId || trayItems().find(candidate => candidate.id === item.id)?.sourceId;
        return current().items.some(existing => existing.id === sourceId || existing.title === item.title);
    }
    function render(focus) {
        const d = current();
        const result = reflow(d, ctx);
        const availableTray = d.tray.filter(item => !alreadyOnDay(item));
        const summary = result.conflicts.length ? `${result.conflicts.length} heads-up` : 'All clear';
        const chips = window.OAHU_SAMPLE.days.map(day => {
            const weekday = new Date(day.date + 'T12:00:00Z').toLocaleDateString('en-US', {weekday: 'short', timeZone: 'UTC'});
            const label = weekday + ' ' + Number(day.date.slice(-2));
            return `<button type="button" data-db-action="day" data-date="${day.date}" data-testid="db-day-${day.date}" aria-pressed="${day.date === date}">${label}</button>`;
        }).join('');
        const timeline = result.items.map(i => {
            const travel = i.travel ? `<div class="db-travel${i.travel.late ? ' db-travel-late' : ''}" data-testid="db-travel">${i.travel.late ? esc(i.travel.label) + ' · leave by ' + clock(i.travel.depart) : clock(i.travel.depart) + ' · ' + esc(i.travel.label) + (i.travel.minutes ? ' · arrive ' + clock(i.travel.arrive) : '')}</div>` : '';
            return travel + pair(i, false);
        }).join('');
        root.innerHTML = `<div class="db-heading"><h2>Build your day</h2><span class="db-summary" data-testid="db-summary" aria-live="polite">${summary}</span><button type="button" data-testid="db-reset" data-db-action="reset">Reset to suggested</button></div>
            <div class="db-days" data-testid="db-day" role="group" aria-label="Oahu day">${chips}</div>
            <div class="db-day" data-testid="db-day-list">${timeline}</div>
            <button type="button" class="db-chest-toggle" data-testid="db-tray-toggle" data-db-action="toggle" aria-expanded="${expanded}" aria-controls="db-chest">Treasure chest <span class="db-count">${availableTray.length}</span></button>
            <div id="db-chest" class="db-tray" data-testid="db-tray" ${expanded ? '' : 'hidden'}>${availableTray.map(i => pair(i, true)).join('')}</div>
            <button type="button" data-testid="db-booking-toggle" data-db-action="booking" aria-expanded="${bookingOpen}" aria-controls="db-booking">+ Add booking</button>
            <form id="db-booking" class="db-form" data-testid="db-booking-form" ${bookingOpen ? '' : 'hidden'}>
                <label>Name<input name="name" data-testid="db-booking-name" required maxlength="100"></label>
                <label>Start<input name="start" data-testid="db-booking-start" type="time" required></label>
                <label>End<input name="end" data-testid="db-booking-end" type="time" required></label>
                <label>Place<select name="place" data-testid="db-booking-place">${[HOTEL, WAIKIKI, 'Kewalo Basin', 'Kualoa Ranch', 'Diamond Head', 'Ala Moana', 'Kailua', 'Makapuu', 'HNL', 'Other'].map(p => `<option>${p}</option>`).join('')}</select></label>
                <button data-testid="db-booking-add">Anchor it</button><p data-testid="db-form-note" role="status"></p>
            </form>`;
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            root.querySelectorAll('.db-conflict').forEach(element => {
                element.classList.add('db-shake');
                element.addEventListener('animationend', () => element.classList.remove('db-shake'), {once: true});
            });
        }
        if (focus) {
            const row = Array.from(root.querySelectorAll('[data-db-id]')).find(e => e.dataset.dbId === focus.id && e.dataset.dbZone === focus.zone);
            row?.querySelector(`[data-db-action="${focus.action || 'handle'}"]`)?.focus({preventScroll: true});
        }
        return result;
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
            at = Math.max(0, Math.min(list.length - 1, index + (action === 'up' ? -1 : 1)));
        } else if (action === 'position') {
            at = target > index ? target - 1 : target;
        }
        list.splice(index, 1);
        destination.splice(at, 0, item);
        save();
        render({id, zone});
        announce(positionMessage(id, zone));
    }

    root.addEventListener('click', e => {
        const b = e.target.closest('[data-db-action]');
        if (!b) return;
        const action = b.dataset.dbAction;
        const row = b.closest('[data-db-id]');
        if (action === 'day') {
            date = b.dataset.date;
            picked = null;
            render();
            root.querySelector(`[data-testid="db-day-${date}"]`).focus();
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
            days[date] = {...buildSuggested(date), tray: trayItems()};
            save();
            render();
            announce('Reset to suggested. Fair winds!');
        } else if (action === 'delete') {
            current().items = current().items.filter(i => i.id !== row.dataset.dbId);
            save();
            render();
            announce('Booking deleted');
        } else if (action !== 'handle') {
            change(row.dataset.dbId, row.dataset.dbZone, action);
        }
    });
    root.addEventListener('submit', e => {
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
        save();
        render();
        announce('Locked booking added');
    });
    root.addEventListener('keydown', e => {
        if (e.key === 'Escape' && drag) {
            e.preventDefault();
            cancelDrag();
            announce('Move cancelled');
            return;
        }
        const row = e.target.closest('[data-db-id]');
        if (row?.classList.contains('db-locked') && [' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            announce('Locked booking — times are fixed');
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
        drag.ghost?.remove();
        drag.indicator?.remove();
        const {handle, pointerId} = drag;
        drag = null;
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
        return {zone, at, bounds, lineY};
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
            drag.ghost = drag.handle.closest('[data-db-id]').cloneNode(true);
            drag.ghost.className = 'db-pair db-ghost';
            drag.ghost.removeAttribute('data-testid');
            drag.ghost.querySelectorAll('[data-testid]').forEach(el => el.removeAttribute('data-testid'));
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
    render();
    return {render, getDay: () => clone(current())};
}
window.DayBuilder = {buildSuggested, reflow, commuteMinutes, mount, render: mount, trayItems, clock, range};
})();
