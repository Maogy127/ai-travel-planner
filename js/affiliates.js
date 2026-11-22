// Partner searches work without enrollment or API keys.
window.GONOW_AFFILIATES = {
    enabled: false,
    disclosure: "Search links to partner sites. GoNow doesn't earn from these yet; prices and availability are on the partner site.",
    partners: {
        // TODO: Placeholder — no affiliate ID yet
        booking: {name:'Booking.com', affiliateId:'', searchUrl:'https://www.booking.com/searchresults.html?ss={destination}&checkin={start}&checkout={end}&group_adults={adults}', affiliateParam:'aid'},
        // TODO: Placeholder — no affiliate ID yet. Expedia Group Travel Creator Program;
        // configure the program-issued parameter only after enrollment.
        expedia: {name:'Expedia', affiliateId:'', searchUrl:'https://www.expedia.com/Hotel-Search?destination={destination}&startDate={start}&endDate={end}&adults={adults}', affiliateParam:''},
        // TODO: Placeholder — no affiliate ID yet
        skyscanner: {name:'Skyscanner', affiliateId:'', searchUrl:'https://www.skyscanner.com/transport/flights/{fromIata}/{toIata}/{yymmdd_start}/{yymmdd_end}/', affiliateParam:''},
        // TODO: Placeholder — no affiliate ID yet
        getyourguide: {name:'GetYourGuide', affiliateId:'', searchUrl:'https://www.getyourguide.com/s/?q={query}', affiliateParam:'partner_id'},
        // TODO: Placeholder — no affiliate ID yet. Set mcid only to a program-issued value.
        viator: {name:'Viator', affiliateId:'', searchUrl:'https://www.viator.com/searchResults/all?text={query}', affiliateParam:'pid', mcid:''}
    }
};
// The single URL builder for every partner link. Never infer an airport code.
window.gonowPartnerURL = function(key, values) {
    var config=window.GONOW_AFFILIATES, partner=config.partners[key];
    var template=partner.searchUrl;
    if(key==='skyscanner' && (!/^[A-Z]{3}$/.test(values.fromIata||'') || !/^[A-Z]{3}$/.test(values.toIata||'') || !values.yymmdd_start || !values.yymmdd_end))template='https://www.skyscanner.com/';
    var url=new URL(template.replace(/\{(\w+)\}/g,function(_,name){return encodeURIComponent(values[name] == null ? '' : values[name]);}));
    if(config.enabled && partner.affiliateId.trim() && partner.affiliateParam){
        url.searchParams.set(partner.affiliateParam,partner.affiliateId.trim());
        if(key==='viator' && partner.mcid.trim())url.searchParams.set('mcid',partner.mcid.trim());
    }
    return url.href;
};
// One booking target per stop. Official pages win; otherwise a partner search named for that stop.
window.gonowItemBooking = function(item, ctx) {
    item = item || {}; ctx = ctx || {};
    var title = String(item.title || item.name || '').replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, '').trim();
    var destination = ctx.destination || '';
    var kind = ctx.kind || '';
    var sources = (item.sources || []).map(function(s) { return typeof s === 'string' ? s : (s && s.url) || ''; }).filter(function(s) { return /^https:\/\//i.test(s); });
    function city() { return String(destination).split(',')[0].trim(); }
    function named(extra) {
        var name = title.replace(/\([^)]*\)/g, ' ').replace(/\s+[—–-]\s+/g, ' ').replace(/\s+/g, ' ').trim();
        var place = city();
        if (place && name.toLowerCase().indexOf(place.toLowerCase()) < 0) name = (name ? name + ' ' : '') + (extra || destination);
        return name || destination || 'things to do';
    }
    function partner(key, extra, label, testid) {
        var values = Object.assign({}, ctx.values || {}, extra || {});
        return {href: window.gonowPartnerURL(key, values), partner: key, label: label, testid: testid};
    }
    function direct(href, label, testid) { return {href: href, partner: '', label: label, testid: testid}; }
    if (kind === 'flight') return partner('skyscanner', {}, 'Book flights', 'book-flights');
    if (kind === 'stay') {
        var hotel = (ctx.stay && !/not sure|city center/i.test(ctx.stay) ? ctx.stay : title.replace(/^check in(?: at)?\s+/i, '')) || destination;
        var place = city();
        var ss = hotel && place && hotel.toLowerCase().indexOf(place.toLowerCase()) < 0 ? hotel + ', ' + destination : (hotel || destination);
        return partner('booking', {destination: ss}, 'Book', 'item-book');
    }
    if (/\buber\b/i.test(title)) return direct(sources.find(function(s) { return /uber\.com/i.test(s); }) || 'https://www.uber.com/', 'Book', 'item-book');
    if (/shuttle/i.test(title)) return direct(sources.find(function(s) { return /shuttle/i.test(s); }) || 'https://www.kahalaresort.com/shuttle-schedule/', 'Book', 'item-book');
    var official = sources.find(function(s) { return /kualoa\.com\/tours|diveoahu\.com|xtremeparasail\.com|hawaiianparasail\.com|opentable\.com|dlnr\.hawaii\.gov\/dsp\/parks\/oahu\/diamond-head/i.test(s); });
    if (/kualoa|jurassic adventure/i.test(title)) official = 'https://www.kualoa.com/tours-and-activities/jurassic-adventure-tour';
    else if (/intro dive|dive o/i.test(title)) official = 'https://www.diveoahu.com/tours-charters';
    else if (/parasail/i.test(title)) official = sources.find(function(s) { return /parasail/i.test(s); }) || 'https://www.xtremeparasail.com/parasailing';
    else if (/diamond head/i.test(title)) official = 'https://dlnr.hawaii.gov/dsp/parks/oahu/diamond-head-state-monument/';
    if (kind === 'reserve') {
        var reserve = sources.find(function(s) { return /opentable\.com/i.test(s); }) || official;
        if (reserve && /opentable\.com|restaurantsenia\.com/i.test(reserve)) return direct(reserve, 'Reserve', 'item-reserve');
        return direct('https://www.google.com/search?q=' + encodeURIComponent(named() + ' reservation'), 'Reserve', 'item-reserve');
    }
    if (official) return direct(official, 'Book', 'item-book');
    return partner('getyourguide', {query: named()}, 'Book', 'item-book');
};
