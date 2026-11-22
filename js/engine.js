(function() {
    'use strict';
    var clone=function(x) {
        return JSON.parse(JSON.stringify(x));
    };
    function matchDestination(text) {
        var normalized=window.GoNowPlaces?window.GoNowPlaces.normalize(text).name:(text||'');
        var t=normalized.toLowerCase().trim().replace(/ \((?:NYC|JFK|EWR|LGA|HNL)\)$/i,'');
        var aliases= {
            oahu:['oahu', 'honolulu', 'waikiki', 'hawaii'], kyoto:['kyoto', 'japan'], lisbon:['lisbon', 'portugal'], cancun:['cancun', 'cancún', 'mexico', 'riviera maya'], reykjavik:['reykjavik', 'reykjavík', 'iceland'], bali:['bali', 'indonesia'], barcelona:['barcelona', 'spain'], banff:['banff', 'canada'], costarica:['costa rica', 'arenal', 'la fortuna'], capetown:['cape town', 'south africa'], newyork:['new york', 'nyc', 'new york city']
        };
        var direct=window.CATALOG.find(function(d) {
            return d.name.toLowerCase()===t;
        });
        var id=direct?direct.id:Object.keys(aliases).find(function(k) {
            return aliases[k].some(function(a) {
                return t===a||t.indexOf(a+',')===0;
            });
        });
        return clone(window.CATALOG.find(function(d) {
            return d.id===id;
        })|| {
            id:'custom', name:text||'Your destination', country:'', image:'images/hero.jpg', areas:'A central neighborhood near transit', carAdvice:'optional', activities:window.CATALOG[1].activities, transport:['Walking', 'Licensed taxi', 'Public transit'], climate:Array.from( {
                length:12
            }, function() {
                return {
                    hiF:null, loF:null, note:'Climate not researched — check local seasonal conditions'
                };
            }), dailyCosts:window.CATALOG[1].dailyCosts, flights:window.CATALOG[1].flights
        });
    }
    function tripDays(a) {
        if(a.flexible)return Math.min(10, Math.max(2, Number(a.length)||5));
        return Math.min(10, Math.max(2, Math.round((new Date(a.end+'T12:00:00')-new Date(a.start+'T12:00:00'))/86400000)+1||5));
    }
    function origin(a) {
        var txt=(a.origin||'').toLowerCase();
        var keys=Object.keys(window.ORIGINS).sort(function(a, b) {
            return b.length-a.length;
        });
        return window.ORIGINS[txt]||window.ORIGINS[keys.find(function(k) {
            return txt.indexOf(k)>=0;
        })]||'other';
    }
    function month(a) {
        return a.flexible?Number(a.month)||11:Number((a.start||'2026-11-25').split('-')[1]);
    }
    function cost(a, d) {
        var n=partyCount(a), days=tripDays(a), f=d.flights[origin(a)], daily=d.dailyCosts.mid;
        var avg=(daily[0]+daily[1])/2, flights=a.includeFlights===false?0:Math.round((f[0]+f[1])/2*n);
        var ground=Math.round(avg*days*n);
        var b= {
            flights:flights, stay:Math.round(ground*.45), food:Math.round(ground*.25), activities:Math.round(ground*.18), localTransport:Math.round(ground*.12)
        };
        return {
            total:Object.values(b).reduce(function(x, y) {
                return x+y;
            }, 0), breakdown:b, originNote:origin(a)==='other'?'Flight estimate is very rough for this origin':''
        };
    }
    function dateRange(start, end) {
        var a=new Date(start+'T12:00:00'), b=new Date(end+'T12:00:00');
        var month=function(d) {
            return d.toLocaleDateString('en-US',  {
                month:'short'
            });
        };
        if(a.getFullYear()!==b.getFullYear())return month(a)+' '+a.getDate()+', '+a.getFullYear()+' – '+month(b)+' '+b.getDate()+', '+b.getFullYear();
        return month(a)+' '+a.getDate()+'–'+(a.getMonth()===b.getMonth()?'':month(b)+' ')+b.getDate()+', '+b.getFullYear();
    }
    function whyFits(a, d, m, w) {
        var styles=(a.styleSkipped?[]:window.GoNowStyles.normalize(a.styles||[])), strengths= {
            hotel:'Comfortable hotel stays and pool time', wandering:'Neighborhood walks and local discoveries', scenic:'Scenic viewpoints and photo stops', food:'Local food and neighborhood cafés', culture:'Museums, history and local stories', nature:'Parks, gardens and shorelines'
        };
        var style=styles[0], group= {
            couple:'a trip for two', solo:'your solo trip', family:'your family trip', friends:'your trip with friends'
        }
        [a.who];
        var first=style&&!a.styleSkipped?strengths[style]+' suit '+(group||'the way you want to travel')+'.':d.tagline.replace(/\.+$/,'')+'.';
        return[first, w.note+' in '+new Date(2027, m-1, 1).toLocaleString('en-US',  {
            month:'long'
        })+'.', a.budget?'About $'+cost(a, d).total.toLocaleString('en-US')+' for your '+tripDays(a)+' days'+(cost(a, d).total<=a.budget?' fits your budget.':' — over your $'+Number(a.budget).toLocaleString('en-US')+' budget.'):'Base yourself around '+d.areas+' for '+tripDays(a)+' days of exploring.'];
    }
    // Neutral interests when skipped; pace alone controls the number of activities.
    function selectedStyles(a) {
        var styles=window.GoNowStyles.normalize(a.styles);
        return styles.length?styles:['scenic','wandering'];
    }
    function recommend(a) {
        return window.CATALOG.map(function(d) {
            var c=cost(a, d), m=month(a), w=d.climate[m-1], styles=selectedStyles(a);
            var score=styles.reduce(function(n, s) {
                return n+(d.styles[s]||0)*10;
            }, 0)+(d.bestMonths.indexOf(m)>=0?12:0)+(d.goodFor.indexOf(knownWho(a))>=0?6:0)-(a.budget&&c.total>a.budget?Math.min(25, (c.total-a.budget)/200):0);
            return Object.assign(clone(d), c,  {
                score:score, weather:w, whyFits:whyFits(a, d, m, w)
            });
        }).sort(function(x, y) {
            // Places far past the stated budget sink, on top of the smaller penalty already in the score.
            function over(d){return a.budget&&d.total>a.budget?Math.min(50,(d.total-a.budget)/200):0;}
            return (y.score-over(y))-(x.score-over(x));
        });
    }
    function clockKey(item) {
        var m=String(item.time||'').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if(m){var h=Number(m[1])%12;if(/pm/i.test(m[3]))h+=12;return h*60+Number(m[2]);}
        var w=String(item.time||'').toLowerCase();
        if(/arriv|morning/.test(w))return 60;
        if(/afternoon/.test(w))return 840;
        if(/evening/.test(w))return 1140;
        if(/depart/.test(w))return 1320;
        return null;
    }
    // Timed stops stay in clock order. Untimed notes keep the slot they were given.
    function arrangeTimes(items) {
        var loose=[], timed=[];
        items.forEach(function(item, index){var k=clockKey(item);if(k==null)loose.push({item:item, index:index});else timed.push({item:item, index:index, k:k});});
        timed.sort(function(a, b){return a.k-b.k||a.index-b.index;});
        var out=timed.map(function(x){return x.item;});
        loose.forEach(function(x){out.splice(Math.min(x.index, out.length), 0, x.item);});
        return out;
    }
    function buildTemplatePlan(a, d) {
        a=Object.assign({},a,{styles:selectedStyles(a)});
        var n=tripDays(a), people=partyCount(a);
        var start=a.flexible?'2027-'+String(month(a)).padStart(2, '0')+'-01':a.start||'2026-11-25';
        var itemsBase=[ {
            id:'id', name:'Photo ID / passport as required', qty:people
        },  {
            id:'card', name:'Payment card and emergency funds', qty:people
        },  {
            id:'qr', name:'Booking confirmation screenshots', qty:1
        },  {
            id:'clothes', name:'Clothes and underwear', qty:n*people
        },  {
            id:'layer', name:'Light layers / rain jacket', qty:people
        },  {
            id:'shoes', name:'Comfortable shoes', qty:people
        },  {
            id:'water', name:'Reusable water bottle', qty:people
        },  {
            id:'sun', name:'Sun protection', qty:people
        },  {
            id:'phone', name:'Phone and charger', qty:people
        },  {
            id:'meds', name:'Medication and toiletries', qty:people
        },  {
            id:'swim', name:'Swimwear and towel', qty:people
        }
        ];
        var food=(a.foodLoves||[]).filter(function(x) {
            return x!=='No preference';
        }).join(', ');
        var meal=function(t, label) {
            return {
                time:t, kind:'meal', title:label+' near your hotel — local café (pick at booking)'+(food?' · '+food:''), desc:'Check the menu and confirm dietary needs before booking.', bring:[], prep:[], sources:[]
            };
        };
        var days=[];
        for(var i=0; i<n; i++) {
            var date=new Date(start+'T12:00:00');
            date.setDate(date.getDate()+i);
            var arr=[];
            if(i===0) {
                arr=[ {
                    time:'Arrival', 'kind':'travel', title:'Arrive and transfer to your stay', desc:'Match the transfer to your actual flight.'
                },  {
                    time:'Afternoon', kind:'stay', title:'Check in and settle in', desc:a.stayUnsure?(d.center||'city center'):a.stay||d.center||'city center'
                }, meal('Evening', 'Dinner')];
            } else if(i===n-1) {
                arr=[ {
                    time:'Departure', kind:'travel', title:'Check out and depart', desc:'Allow time for your transfer, baggage and airport formalities.'
                }
                ];
            } else {
                arr.push(meal('8:00 AM', 'Breakfast'));
                var count=a.pace==='Easy'?2:a.pace==='Full-on'?4:3;
                var styles=selectedStyles(a);
                for(var j=0; j<count; j++) {
                    var style=styles[(i+j)%styles.length], choices=(d.activities[style]||[]).filter(function(title){return !/breakfast|lunch|dinner/i.test(title);});choices=choices.length?choices:styles.map(function(key){return d.activities[key];}).find(function(list){return list&&list.length;})||d.activities.scenic;
                    arr.push( {
                        time:['10:00 AM', '1:00 PM', '3:30 PM', '5:00 PM'][j], kind:style==='hotel'?'rest':'activity', title:choices[(i+j)%choices.length], desc:'Template suggestion. Choose an operator or location at booking; confirm accessibility and suitability.', bookable:style==='nature', bring:['water', 'sun', 'shoes'].concat(style==='nature'?['swim']:[]), prep:[ {
                            type:'book', text:'Book popular tours 1–2 weeks ahead.', sources:[]
                        },  {
                            type:'age', text:'Water activities: check age/weight limits.', sources:[]
                        }
                        ], sources:[]
                    });
                    if(j===0)arr.push(meal('12:00 PM', 'Lunch'));
                }
                arr.push(meal('7:00 PM', 'Dinner'));
            }
            var seenTitles=new Set(), seenMeals={};arr=arr.filter(function(x){var key=x.title.toLowerCase();if(seenTitles.has(key))return false;seenTitles.add(key);var slot=/breakfast/i.test(x.title)?'breakfast':/lunch/i.test(x.title)?'lunch':/dinner|evening meal/i.test(x.title)?'dinner':'';if(slot){if(seenMeals[slot])return false;seenMeals[slot]=true;}return true;});
            arr=arrangeTimes(arr);
            arr.forEach(function(x, j) {
                x.id='d'+i+'i'+j;
                x.bring=x.bring||[];
                x.prep=x.prep||[];
                x.sources=x.sources||[];
                x.travelToNext='approx. 15–30 min by rideshare/transit — depends on where you stay';
            });
            days.push( {
                date:date.toISOString().slice(0, 10), theme:i===0?'Arrive and ease into your trip':i===n-1?'Fly home':'Explore at your own pace', car: {
                    level:d.carAdvice, note:d.transport.join(' / ')
                }, items:arr, prep:[], relax:'Replace optional excursions with hotel downtime and a short local walk.', rain:'Choose an indoor museum, café or hotel lounge; confirm opening hours.'
            });
        }
        var requests=(a.mustdos||'').split(/[,\n]/).map(function(t) {
            return t.trim();
        }).filter(Boolean);
        requests.forEach(function(t, i) {
            var day=days[Math.min(n-2, 1+i%Math.max(1, n-2))];
            day.items.splice(day.items.length-1, 0,  {
                id:'request'+i, time:'Confirm time', kind:'activity', title:'📌 '+t, requested:true, desc:'Requested item — confirm availability, timing and location before booking.', bring:['qr'], prep:[], sources:[], travelToNext:'approx. 15–30 min by rideshare/transit — depends on where you stay'
            });
            day.items=arrangeTimes(day.items);
        });
        var grouped=[['Documents & money', ['id', 'card', 'qr']], ['Clothing', ['clothes', 'layer', 'shoes']], ['Beach & water', ['swim', 'sun']], ['Activity gear', ['water']], ['Health & toiletries', ['meds']], ['Tech', ['phone']], ['Misc', []]].map(function(g) {
            return {
                group:g[0], items:itemsBase.filter(function(x) {
                    return g[1].indexOf(x.id)>=0;
                }).map(function(x) {
                    x.from=days.flatMap(function(day) {
                        return day.items.filter(function(it) {
                            return it.bring.indexOf(x.id)>=0;
                        }).map(function(it) {
                            return it.title;
                        });
                    });
                    return x;
                })
            };
        });
        if(window.DayBuilder)days.forEach(function(day){
            var rejected=[];
            day.items=day.items.filter(function(item){
                Object.assign(item,window.DayBuilder.operatingRules(item));
                var reason=window.DayBuilder.blockedOn(Object.assign({},item,{preferred:window.DayBuilder.parseClock(item.time||'')}),day.date,{departureDate:days[n-1].date,flightTime:a.returnTime||a.flightTime});
                if(reason)rejected.push(Object.assign({},item,{blockedReason:reason}));
                return !reason;
            });
            day.unscheduled=rejected;
        });
        if(window.GoNowFlights&&(a.flightsStep||a.arrivalTime||a.returnTime||a.flightTime)){
            var fw=window.GoNowFlights.windowFor(a),f=window.GoNowFlights;
            days[0].items=[{id:'arrival-flight',title:f.label(a,'arrival'),kind:'flight',flightDirection:'arrival',time:f.clock(fw.landing),duration:0,locked:true,prep:[],bring:[],sources:[]},
                {id:'arrival-stay',title:'Check in and settle in',kind:'stay',time:f.clock(fw.arrivalStart),desc:'About 30 min. Settle in.',prep:[],bring:[],sources:[]}];
            if(fw.arrivalStart>=1440)days[0].items=days[0].items.filter(function(i){return i.kind==='flight';});
            if(fw.arrivalStart+90<1440)days[0].items.push({id:'arrival-meal',title:'Evening meal near hotel',kind:'meal',time:f.clock(fw.arrivalStart+30),desc:'About 60 min. Choose nearby.',prep:[],bring:[],sources:[]});
            days[n-1].items=[{id:'pick-airport',title:'Leave for the airport',kind:'travel',time:f.clock(fw.leave),desc:'About '+fw.road+' min.',duration:fw.road,locked:true,prep:[],bring:[],sources:[]},
                {id:'return-flight',title:f.label(a,'return'),kind:'flight',flightDirection:'return',time:f.clock(fw.departure),duration:0,locked:true,prep:[],bring:[],sources:[]}];
        }
        var w=d.climate[month(a)-1];
        return {
            id:'template-'+d.id+'-'+start, title:d.name, image:d.image, start:start, end:days[n-1].date, meta:planMeta(start, days[n-1].date, n, a), stay:a.stayUnsure?(d.center||'city center'):a.stay||d.center||'city center', banner:'Sample/template plan — live AI generation coming soon', weather: {
                text:(w.hiF===null?'Climate not researched. Check typical local conditions before packing.':'Rough climate estimate: typically '+w.loF+'–'+w.hiF+'°F. '+w.note+'.')+' Typical conditions, not a forecast.', sources:[]
            }, flags:[], days:days, packing:grouped, tips:[ {
                sourceType:'general travel guidance (template)', text:'Confirm local opening hours, entry rules and transport before setting out.'
            },  {
                sourceType:'general travel guidance (template)', text:'Keep copies of reservations and leave flexibility for weather.'
            }
            ], estimate:cost(a, d), costs:[], activityTotal:'Rough estimate — approx., verify before booking.'
        };
    }
    function knownWho(a) {
        return a&&!a.whoSkipped&&a.who?a.who:'';
    }
    function knownAges(a) {
        return a&&!a.agesSkipped&&Array.isArray(a.ages)?a.ages.filter(function(x){return (typeof x==='number'||typeof x==='string')&&String(x).trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=110;}).map(Number):[];
    }
    function partyCount(a) {
        var ages=knownAges(a);
        if(ages.length)return ages.length;
        if(knownWho(a)==='solo')return 1;
        if(knownWho(a)==='couple')return 2;
        var n=Number(a&&a.adults||0)+Number(a&&a.kids||0);
        return n>0?n:2;
    }
    function planMeta(start, end, n, a) {
        var parts=[dateRange(start, end), n+' days'], who=knownWho(a), ages=knownAges(a);
        if(who)parts.push(who.replace(/^./,function(c){return c.toUpperCase();}));
        if(ages.length)parts.push('Ages '+ages.join(' & '));
        return parts.join(' · ');
    }
    function applyAgeRules(plan, a) {
        var ages=knownAges(a), youngest=ages.length?Math.min.apply(null, ages):Infinity, usa=plan.id.indexOf('oahu')>=0||matchDestination(a.destination).country==='USA';
        plan.ageRules=[];
        if(!ages.length)return plan;
        if(youngest<21) {
            plan.ageRules.push('Why no rental car: most US rental agencies require drivers to be 21+, and drivers under 25 usually pay a young-driver surcharge. Self-drive UTV/ATV tours usually require a 21+ licensed driver. Check local rules outside the USA.');
            plan.days.forEach(function(day) {
                day.car= {
                    level:'No rental car', note:'Not needed — rideshare/shuttle/transit; pre-book rural and early rides'
                };
                day.items.forEach(function(it) {
                    if(/self.drive|scooter|utv|atv/i.test(it.title)&&!/not UTV/i.test(it.title)) {
                        it.title='Guided-tour version — '+it.title.replace(/self.drive|scooter|utv|atv/ig, 'outdoor');
                    }
                });
            });
            if(usa)plan.ageRules.push('US legal drinking age is 21. Skip alcohol, happy hours and bars.');
        } else if(youngest<25)plan.ageRules.push('Young-driver surcharge likely (under 25). Check rental terms and activity driver minimums.');
        if(youngest<18)plan.ageRules.push('Traveling with kids: check activity minimum ages, heights and weights.');
        return plan;
    }
    function partySize(a) {
        a=a||{};
        var ages=(Array.isArray(a.ages)?a.ages:[]).filter(function(x){return String(x).trim()!==''&&Number.isFinite(Number(x));});
        if(ages.length)return ages.length;
        if(a.who==='solo')return 1;
        if(a.who==='couple')return 2;
        var n=Number(a.adults||0)+Number(a.kids||0);
        return n>0?n:2;
    }
    // Dollar signs win when the price is only a level ("$$", "$$$$"). A number like "$150 pp" is ranked by the amount.
    function priceRank(price) {
        var s=String(price||'').trim();
        if(/^\$+$/.test(s))return Math.min(4, s.length);
        var n=Number((s.replace(/,/g,'').match(/\d+(?:\.\d+)?/)||[])[0]);
        if(!Number.isFinite(n))return 0;
        if(n<=25)return 1;
        if(n<=60)return 2;
        if(n<=120)return 3;
        return 4;
    }
    function perPersonPerDay(a) {
        if(!a||!(Number(a.budget)>0)||a.budgetChoice==='flexible')return null;
        return Number(a.budget)/partySize(a)/tripDays(a);
    }
    // Rough ceiling for one meal or ticket. Unknown budgets are not filtered.
    function maxRank(a) {
        var ppd=perPersonPerDay(a);
        if(ppd==null)return 4;
        if(ppd<45)return 1;
        if(ppd<100)return 2;
        if(ppd<200)return 3;
        return 4;
    }
    function wishText(a){return ((a&&a.mustdos)||'')+' '+((a&&a.foodLoves)||[]).join(' ');}
    function wantsFineDining(a){return /\bfine dining\b|\btasting menu\b|\bomakase\b|\bla mer\b/i.test(wishText(a));}
    function explicitChoice(a, item) {
        var text=wishText(a).toLowerCase();
        if(/\bfine dining\b|\btasting menu\b|\bomakase\b/.test(text)&&priceRank(item&&item.price)>=4)return true;
        var name=String((item&&(item.name||item.title))||'').toLowerCase();
        return name.split(/[^a-z0-9]+/).filter(function(w){return w.length>3;}).some(function(w){return text.includes(w);});
    }
    function fitsPrice(item, a) {
        if(explicitChoice(a, item))return true;
        if(wantsFineDining(a)&&priceRank(item&&item.price)>=4&&(item.meals||item.kind==='meal'))return true;
        var rank=priceRank(item&&item.price);
        if(!rank)return true;
        return rank<=maxRank(a);
    }
    window.GoNowBudget={partySize:partySize, priceRank:priceRank, perPersonPerDay:perPersonPerDay, maxRank:maxRank, wantsFineDining:wantsFineDining, explicit:explicitChoice, fits:fitsPrice};
    window.Engine= {
        estimateCost:cost, dateRange:dateRange, matchDestination:matchDestination, recommend:recommend, buildTemplatePlan:buildTemplatePlan, applyAgeRules:applyAgeRules, tripDays:tripDays, originRegion:origin, planMeta:planMeta, knownWho:knownWho, knownAges:knownAges, partyCount:partyCount
    };
}
());
