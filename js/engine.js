(function() {
    'use strict';
    var clone=function(x) {
        return JSON.parse(JSON.stringify(x));
    };
    function matchDestination(text) {
        var t=(text||'').toLowerCase().trim();
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
        var n=(a.ages||[25, 25]).length, days=tripDays(a), f=d.flights[origin(a)], daily=d.dailyCosts.mid;
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
        var styles=a.styles||[], strengths= {
            relaxing:'Unhurried days and downtime', hotel:'Comfortable hotel stays and pool time', wandering:'Neighborhood walks and local discoveries', scenic:'Scenic viewpoints and photo stops', adventure:'Outdoor activities and adventurous days'
        };
        var style=styles[0], group= {
            couple:'a trip for two', solo:'your solo trip', family:'your family trip', friends:'your trip with friends'
        }
        [a.who];
        var first=style&&!a.styleSkipped?strengths[style]+' suit '+(group||'the way you want to travel')+'.':d.tagline.replace(/\.+$/,'')+'.';
        return[first, w.note+' in '+new Date(2027, m-1, 1).toLocaleString('en-US',  {
            month:'long'
        })+'.', a.budget?'About $'+cost(a, d).total.toLocaleString('en-US')+' for your '+tripDays(a)+' days'+(cost(a, d).total<=a.budget?' fits your budget.':'; compare this with your budget.'):'Base yourself around '+d.areas+' for '+tripDays(a)+' days of exploring.'];
    }
    function recommend(a) {
        return window.CATALOG.map(function(d) {
            var c=cost(a, d), m=month(a), w=d.climate[m-1], styles=a.styles||['relaxing'];
            var score=styles.reduce(function(n, s) {
                return n+(d.styles[s]||0)*10;
            }, 0)+(d.bestMonths.indexOf(m)>=0?12:0)+(d.goodFor.indexOf(a.who)>=0?6:0)-(a.budget&&c.total>a.budget?Math.min(25, (c.total-a.budget)/200):0);
            return Object.assign(clone(d), c,  {
                score:score, weather:w, whyFits:whyFits(a, d, m, w)
            });
        }).sort(function(x, y) {
            return y.score-x.score;
        });
    }
    function buildTemplatePlan(a, d) {
        var n=tripDays(a), people=(a.ages||[25, 25]).length;
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
        var food=(a.food||[]).filter(function(x) {
            return x!=='No preference';
        }).join(', ');
        var meal=function(t, label) {
            return {
                time:t, kind:'meal', title:label+' near your hotel — local café (pick at booking)'+(food?' · '+food:''), desc:a.allergies?'Tell the venue about allergies / things to avoid: '+a.allergies:'Confirm opening hours and dietary needs at booking.', bring:[], prep:[], sources:[]
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
                    time:'Afternoon', kind:'stay', title:'Check in and settle in', desc:a.stay||d.areas
                }, meal('Evening', 'Dinner')];
            } else if(i===n-1) {
                arr=[ {
                    time:'Departure', kind:'travel', title:'Check out and depart', desc:'Allow time for your transfer, baggage and airport formalities.'
                }
                ];
            } else {
                arr.push(meal('8:00 AM', 'Breakfast'));
                var count=a.pace==='Easy'?2:a.pace==='Full-on'?4:3;
                var styles=a.styles&&a.styles.length?a.styles:['relaxing'];
                for(var j=0; j<count; j++) {
                    var style=styles[(i+j)%styles.length], choices=d.activities[style]||d.activities.relaxing;
                    arr.push( {
                        time:['10:00 AM', '1:00 PM', '3:30 PM', '5:00 PM'][j], kind:style==='relaxing'||style==='hotel'?'rest':'activity', title:choices[(i+j)%choices.length], desc:'Template suggestion. Choose an operator or location at booking; confirm accessibility and suitability.', bookable:style==='adventure', bring:['water', 'sun', 'shoes'].concat(style==='adventure'?['swim']:[]), prep:[ {
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
        var w=d.climate[month(a)-1];
        return {
            id:'template-'+d.id+'-'+start, title:d.name, image:d.image, start:start, end:days[n-1].date, meta:dateRange(start, days[n-1].date)+' · '+n+' days · '+(a.who||'Couple')+' ('+(a.ages||[25, 25]).join(' & ')+')', stay:a.stay||d.areas, banner:'Sample/template plan — live AI generation coming soon', weather: {
                text:(w.hiF===null?'Climate not researched. Check typical local conditions before packing.':'Rough climate estimate: typically '+w.loF+'–'+w.hiF+'°F. '+w.note+'.')+' Typical conditions, not a forecast.', sources:[]
            }, flags:[], days:days, packing:grouped, tips:[ {
                sourceType:'general travel guidance (template)', text:'Confirm local opening hours, entry rules and transport before setting out.'
            },  {
                sourceType:'general travel guidance (template)', text:'Keep copies of reservations and leave flexibility for weather.'
            }
            ], estimate:cost(a, d), costs:[], activityTotal:'Rough estimate — approx., verify before booking.'
        };
    }
    function applyAgeRules(plan, a) {
        var ages=(a.ages||[25, 25]).map(Number), youngest=Math.min.apply(null, ages), usa=plan.id.indexOf('oahu')>=0||matchDestination(a.destination).country==='USA';
        plan.ageRules=[];
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
    window.Engine= {
        estimateCost:cost, dateRange:dateRange, matchDestination:matchDestination, recommend:recommend, buildTemplatePlan:buildTemplatePlan, applyAgeRules:applyAgeRules, tripDays:tripDays, originRegion:origin
    };
}
());
