/* General destination guidance; central points are approximate, not itinerary stops. */
(function () {
    'use strict';
    var rows = {
        oahu: ['Pacific/Honolulu','USD','English (Hawaiian also official)','A/B',120,21.307,-157.858,'Tipping customary: ~15–20% at sit-down restaurants'],
        kyoto: ['Asia/Tokyo','JPY','Japanese','A/B',100,35.012,135.768,'Tipping generally not customary'],
        lisbon: ['Europe/Lisbon','EUR','Portuguese','C/F',230,38.722,-9.139,'Tips appreciated; generally optional'],
        cancun: ['America/Cancun','MXN','Spanish','A/B',127,21.162,-86.852,'Tips customary in tourist restaurants; check for included service'],
        reykjavik: ['Atlantic/Reykjavik','ISK','Icelandic','C/F',230,64.147,-21.94,'Tipping generally optional; service usually included'],
        bali: ['Asia/Makassar','IDR','Indonesian; Balinese','C/F',230,-8.65,115.216,'Tips appreciated; check for included service'],
        barcelona: ['Europe/Madrid','EUR','Catalan; Spanish','C/F',230,41.387,2.17,'Tips generally optional; small amounts appreciated'],
        banff: ['America/Edmonton','CAD','English','A/B',120,51.178,-115.571,'Tipping customary: ~15–20% at sit-down restaurants'],
        costarica: ['America/Costa_Rica','CRC','Spanish','A/B',120,9.933,-84.083,'Check the bill: restaurant service charge is often included'],
        capetown: ['Africa/Johannesburg','ZAR','English; Afrikaans; isiXhosa','C/D/M/N',230,-33.925,18.424,'Tips customary in restaurants; ~10–15% often appreciated'],
        newyork: ['America/New_York','USD','English','A/B',120,40.713,-74.006,'Tipping customary: ~15–20% at sit-down restaurants']
    };
    // Currencies in the ECB reference-rate set that Frankfurter serves (skip the call for others, e.g. CRC).
    var ECB=['AUD','BRL','CAD','CHF','CNY','CZK','DKK','EUR','GBP','HKD','HUF','IDR','ILS','INR','ISK','JPY','KRW','MXN','MYR','NOK','NZD','PHP','PLN','RON','SEK','SGD','THB','TRY','USD','ZAR'];
    var table = {};
    Object.keys(rows).forEach(function (id) {
        var r=rows[id]; table[id]={timezone:r[0],currency:r[1],languages:r[2],plugs:r[3],voltage:r[4],latitude:r[5],longitude:r[6],tipping:r[7],checked:'2026-11'};
    });
    function node(tag, text, parent) { var e=document.createElement(tag);e.textContent=text;parent.append(e);return e; }
    function day(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
    function previousYear(s) { var d=new Date(s+'T12:00:00Z'),m=d.getUTCMonth();d.setUTCFullYear(d.getUTCFullYear()-1);if(d.getUTCMonth()!==m)d.setUTCDate(0);return d.toISOString().slice(0,10); }
    async function request(url, validate, force) {
        var key='gonow:info:'+url, cached;
        try { cached=JSON.parse(sessionStorage.getItem(key)); } catch (_) {}
        if(!force && cached && Date.now()-cached.at<3600000 && validate(cached.data))return cached;
        var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},6000);
        try {
            var response=await fetch(url,{signal:controller.signal});
            if(!response.ok)throw new Error('Unavailable');
            var data=await response.json();if(!validate(data))throw new Error('Incomplete data');
            var result={at:Date.now(),data:data};try{sessionStorage.setItem(key,JSON.stringify(result));}catch(_){}return result;
        } finally {clearTimeout(timer);}
    }
    function source(parent,label,url,result,date) {
        var a=node('a',label,parent);a.href=url;a.target='_blank';a.rel='noopener';a.dataset.testid='info-source';
        var p=node('small','As of '+new Date(result.at).toLocaleString()+' · Data date: '+date,parent);p.dataset.testid='info-asof';
    }
    function mount(parent,id,start,end) {
        var info=table[id];if(!info){node('p','General guidance — check official sources. Local details unavailable for this destination.',parent);return function(){};}
        node('p','General guidance — check official sources',parent);
        node('p','Timezone: '+info.timezone,parent);
        var clock=node('p','',parent);
        function time(){clock.textContent='Local time now: '+new Intl.DateTimeFormat(undefined,{timeZone:info.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date());}time();
        node('p','Currency: '+info.currency+' · Languages: '+info.languages,parent);
        node('p','Plugs: Types '+info.plugs+' · '+info.voltage+' V',parent);
        node('p',info.tipping,parent);node('small','Guidance checked: '+info.checked,parent);
        var weather=node('div','Open this tile to load weather.',parent),fx=node('div',info.currency==='USD'?'Uses US dollars (USD)':'Open this tile to load a reference exchange rate.',parent);
        var loaded=false;
        async function loadWeather(force) {
            weather.replaceChildren();node('p','Loading weather…',weather);
            try {
                if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)throw new Error('Dates unavailable');
                var today=new Date(),last=new Date();last.setDate(last.getDate()+15);
                var forecast=start>=day(today)&&end<=day(last),from=forecast?start:previousYear(start),to=forecast?end:previousYear(end);
                var url=new URL(forecast?'https://api.open-meteo.com/v1/forecast':'https://archive-api.open-meteo.com/v1/archive');
                Object.entries({latitude:info.latitude,longitude:info.longitude,start_date:from,end_date:to,daily:'temperature_2m_max,temperature_2m_min,'+(forecast?'precipitation_probability_max':'precipitation_sum'),temperature_unit:'fahrenheit',timezone:'auto'}).forEach(function(r){url.searchParams.set(r[0],r[1]);});
                var dates=[];for(var d=new Date(from+'T12:00:00Z');d.toISOString().slice(0,10)<=to;d.setUTCDate(d.getUTCDate()+1)){dates.push(d.toISOString().slice(0,10));if(dates.length>366)throw new Error('Date range too long');}
                var rain=forecast?'precipitation_probability_max':'precipitation_sum';
                var result=await request(url.href,function(data){var v=data&&data.daily;return v&&Array.isArray(v.time)&&v.time.length===dates.length&&dates.every(function(s,i){return v.time[i]===s&&['temperature_2m_max','temperature_2m_min',rain].every(function(k){return Array.isArray(v[k])&&Number.isFinite(v[k][i]);});});},force);
                var daily=result.data.daily;weather.replaceChildren();
                node('h3',forecast?'Weather forecast':'Last year on these dates (not a forecast)',weather);
                if(forecast)daily.time.forEach(function(s,i){node('p',s+': high '+daily.temperature_2m_max[i]+' °F / low '+daily.temperature_2m_min[i]+' °F · Rain chance '+daily[rain][i]+'%',weather);});
                else {var avg=function(k){return (daily[k].reduce(function(a,b){return a+b;},0)/daily.time.length).toFixed(1);};node('p','Average high '+avg('temperature_2m_max')+' °F / low '+avg('temperature_2m_min')+' °F',weather);}
                source(weather,'Open-Meteo','https://open-meteo.com/',result,daily.time[0]+' to '+daily.time[daily.time.length-1]);
            } catch (_) {
                weather.replaceChildren();node('p',"Couldn't load live weather — check open-meteo.com",weather);
                var retry=node('button','Retry',weather);retry.type='button';retry.dataset.testid='info-retry';retry.onclick=function(){loadWeather(true);};
            }
        }
        async function loadFX() {
            if(info.currency==='USD')return;
            if(ECB.indexOf(info.currency)<0){fx.replaceChildren();node('p','Live rate unavailable — '+info.currency+' is not covered by the ECB reference rates Frankfurter publishes.',fx);return;}
            try {
                var result=await request('https://api.frankfurter.dev/v1/latest?base=USD&symbols='+info.currency,function(d){return d&&d.base==='USD'&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&d.rates&&Number.isFinite(d.rates[info.currency])&&d.rates[info.currency]>0;});
                var rate=result.data.rates[info.currency];fx.replaceChildren();node('p','1 USD ≈ '+rate+' '+info.currency,fx);
                var label=node('label','Amount in USD ',fx),input=node('input','',label);input.type='number';input.min='0';input.step='any';input.value='1';input.dataset.testid='fx-amount';
                var output=node('output','',fx);output.dataset.testid='fx-result';output.setAttribute('aria-live','polite');
                input.oninput=function(){var amount=Number(input.value);output.textContent=input.value!==''&&Number.isFinite(amount)&&amount>=0?amount+' USD ≈ '+Number((amount*rate).toFixed(2))+' '+info.currency:'Enter a valid USD amount';};input.oninput();
                source(fx,'Frankfurter (ECB reference rates)','https://frankfurter.dev/',result,result.data.date);
            } catch (_) {fx.replaceChildren();node('p','Live rate unavailable',fx);}
        }
        return function(){time();if(loaded)return;loaded=true;loadWeather(false);loadFX();};
    }
    window.LocalInfo={table:table,mount:mount};
})();
