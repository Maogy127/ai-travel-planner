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
