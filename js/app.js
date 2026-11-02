(function() {
    'use strict';
  function travelIcon(t){ t=String(t||'').toLowerCase(); if(/uber|lyft|rideshare|taxi|ride/.test(t)) return '🚕'; if(/shuttle|bus|transit/.test(t)) return '🚌'; if(/walk/.test(t)) return '🚶'; return '➜'; }
    var KEY='gonow:', OLD_KEY='way'+'fare:';
    (function migrateKeys(){ try { var moves=[]; for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k&&k.indexOf(OLD_KEY)===0) moves.push(k); } moves.forEach(function(k){ var nk=KEY+k.slice(OLD_KEY.length); if(localStorage.getItem(nk)===null) localStorage.setItem(nk, localStorage.getItem(k)); localStorage.removeItem(k); }); } catch(e) {} })();
    var view=document.getElementById('view'), dialog=document.getElementById('sheet'), toastEl=document.getElementById('toast');
    function read(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key))||fallback;
        } catch(e) {
            return fallback;
        }
    }
    function write(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch(e) {
            toast('Could not save on this device. Your plan is still open.');
        }
    }
    function erase(key) {
        try {
            localStorage.removeItem(key);
        } catch(e) {}
    }
    var defaults= {
        origin:'', destination:'', unsure:false, start:'', end:'', flexible:false, length:5, month:11, budget:null, includeFlights:true, covers:['flights','hotel','food','activities','transport'], completed:[], who:'', ages:[], adults:2, kids:0, styles:[], food:[], allergies:'', pace:'Moderate', mustdos:'', stay:''
    };
    var state= {
        screen:'start', answers:Object.assign( {}, defaults, read(KEY+'answers',  {})), plan:null, tab:'plan', recOffset:0, excluded:[], edits: {}, packed: {}, packMeta: {}, hidePacked:false
    };
    if(!read(KEY+'answers',{}).covers&&state.answers.includeFlights===false)state.answers.covers=defaults.covers.filter(function(k){return k!=='flights';});
    var steps=['dates', 'budget', 'who', 'ages', 'style'], extra=['food', 'pace', 'musts'];
    var reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
    document.documentElement.classList.toggle('reduce-motion', reduceMotion.matches);
    reduceMotion.addEventListener('change', function(e){document.documentElement.classList.toggle('reduce-motion',e.matches);});
    var flipNext=false, openTile='day-0';
    var activeGeneration=0, toastTimer, undoPending=false;
    function esc(s) {
        return String(s==null?'':s).replace(/[&<>"']/g, function(c) {
            return {
                '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
            }
            [c];
        });
    }
    function save() {
        write(KEY+'answers', state.answers);
    }
    function flexibleMonth() {
        return new Date(Date.now()+75*864e5).getMonth()+1;
    }
    function monthName(m) {
        return new Date(2026, m-1, 1).toLocaleString('en', { month:'long' });
    }
    function announce(msg) {
        var live=document.getElementById('live');
        if(!live)return;
        live.textContent='';
        setTimeout(function(){ live.textContent=msg; }, 30);
    }
    function money(n) {
        return'$'+Math.round(n).toLocaleString('en-US');
    }
    function btn(label, id, cls, attrs) {
        return'<button data-testid="'+id+'" '+(attrs||'')+' class="'+(cls||'')+'">'+label+'</button>';
    }
    function creditHTML(credit) {
        return credit?'<span class="image-label">Photo: <a href="'+esc(credit.photoUrl)+'" target="_blank" rel="noopener">'+esc(credit.photographer)+'</a> / Pexels</span>':'';
    }
    function photo(src, alt, cls, caption) {
        var eager=/hero-photo|banner-photo/.test(cls||'');
        var id=(src||'').split('/').pop().replace('.jpg', '');
        var credit=window.PHOTO_CREDITS.find(function(c) {
            return c.id===id;
        });
        return'<div class="photo '+(cls||'')+'"><img src="'+esc(src)+'" '+(eager?'loading="eager" fetchpriority="high"':'loading="lazy"')+' alt="'+esc(credit?credit.alt:alt)+'">'+creditHTML(credit)+(caption||'')+'</div>';
    }
    function creditsScreen() {
        view.innerHTML='<div class="shell">'+heading('Photo credits', 'All photos are real photos from Pexels, used under the Pexels License.')+btn('← Back', 'credits-back', 'outline')+'<div class="credits-grid">'+window.PHOTO_CREDITS.map(function(c) {
            return'<article class="card credit-card">'+photo('images/'+c.id+'.jpg', c.alt)+'<h2>'+esc(c.alt)+'</h2><p>'+esc(c.photographer)+'</p><div class="row"><a href="'+esc(c.photoUrl)+'" target="_blank" rel="noopener">Pexels ↗</a><a href="'+esc(c.licenseUrl)+'" target="_blank" rel="noopener">Pexels License ↗</a></div></article>';
        }).join('')+'</div></div>';
        on('credits-back', function() {
            go(state.creditsFrom||'start');
        });
    }
    function dateLabel(value, options) {
        return new Date(value+'T12:00:00').toLocaleDateString('en-US', options|| {
            month:'short', day:'numeric', year:'numeric'
        });
    }
    function planBanner(p) {
        var dest=Engine.matchDestination(state.answers.destination);
        var image=dest.id==='custom'?'images/hero.jpg':'images/'+dest.id+'.jpg';
        var visual=state.answers.templateOahu&&dest.id==='oahu'?'':photo(image, p.title, 'banner-photo');
        if(visual){ var bid=image.split('/').pop().replace('.jpg',''); var bc=window.PHOTO_CREDITS.find(function(c){return c.id===bid;}); visual+='<div class="banner-credit">'+creditHTML(bc)+'</div>'; }
        return'<header class="plan-header">'+visual+'<div class="plan-title"><div class="eyebrow">YOUR NEXT CHAPTER, ALL PLANNED</div>'+heading(esc(p.title), esc(p.meta))+'<p>🏨 Staying: '+esc(p.stay)+'</p><small>Local times'+(dest.id==='oahu'?' · Hawaii Standard Time (HST)':'')+'</small><div class="row">'+btn('Change my answers', 'change-answers', '')+btn('Reset my edits', 'reset-edits', '')+'</div></div></header>';
    }
    function planNotices(p) {
        var a=state.answers, html='';
        if(p.curatedMismatch)html+='<aside class="warning demo-notice" data-testid="curated-notice"><p>This is our curated Oahu demo for Nov 25–29, 2026 (couple, ages 18 &amp; 19, staying at The Kahala). It doesn’t adapt to your answers yet — live AI generation will.</p>'+btn('Build a template plan for my answers instead', 'build-template', 'outline')+'</aside>';
        if(!a.personal)html+='<aside class="banner" data-testid="quick-notice">Quick plan — answer 3 more questions to personalize '+btn('Personalize my plan', 'personalize-plan', 'outline')+'</aside>';
        return html;
    }
    function heading(title, helper) {
        return'<h1 tabindex="-1" id="step-title">'+title+'</h1>'+(helper?'<p class="muted">'+helper+'</p>':'');
    }
    function subheading(title, helper) {
        return'<h2 class="tab-heading">'+title+'</h2>'+(helper?'<p class="muted">'+helper+'</p>':'');
    }
    function sources(urls) {
        if(!urls||!urls.length)return'';
        return'<span class="sources">Sources: '+urls.map(function(u, i) {
            var host;
            try {
                host=new URL(u).hostname.replace('www.', '');
            } catch(e) {
                host='Source';
            }
            return'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer" data-testid="source-'+i+'">'+esc(host)+' ↗</a>';
        }).join(' · ')+'</span>';
    }
    function prep(list) {
        var books=(list||[]).filter(function(p) {
            return p.type==='book';
        });
        var other=(list||[]).filter(function(p) {
            return p.type!=='book';
        });
        return other.map(function(p) {
            return'<div class="warning '+(p.type==='safety'?'safety':'')+'">'+( {
                safety:'⚠', eco:'🌿', health:'❤', age:'🔞'
            }
            [p.type]||'•')+' '+esc(p.text)+sources(p.sources)+'</div>';
        }).join('')+(books.length?'<aside class="warning before-you-go"><strong>📅 Before you go</strong><ul>'+books.map(function(p) {
            return'<li>'+esc(p.text)+sources(p.sources)+'</li>';
        }).join('')+'</ul></aside>':'');
    }
    function toast(msg, undo) {
        clearTimeout(toastTimer);
        undoPending=!!undo;
        toastEl.innerHTML=esc(msg)+(undo?' <button data-testid="undo" style="color:white;text-decoration:underline">Undo</button>':'');
        var ms=undo?8000:3000;
        function hide() {
            toastEl.innerHTML='';
            undoPending=false;
        }
        function arm() {
            clearTimeout(toastTimer);
            toastTimer=setTimeout(hide, ms);
        }
        if(undo) {
            toastEl.querySelector('button').onclick=function() {
                hide();
                undo();
            };
            toastEl.onmouseenter=toastEl.onfocusin=function(){ clearTimeout(toastTimer); };
            toastEl.onmouseleave=toastEl.onfocusout=arm;
        } else toastEl.onmouseenter=toastEl.onfocusin=toastEl.onmouseleave=toastEl.onfocusout=null;
        arm();
    }
    function showModal(title, body, buttons) {
        var previous=document.activeElement;
        dialog.innerHTML='<h2 id="dialog-title">'+title+'</h2><p>'+body+'</p><div class="row">'+buttons.map(function(b, i) {
            return btn(b.text, 'modal-'+i, i===0?'primary':'outline');
        }).join('')+'</div>';
        dialog.onclose=function(){ if(previous&&previous.isConnected&&document.activeElement===document.body)previous.focus(); };
        dialog.showModal();
        buttons.forEach(function(b, i) {
            dialog.querySelector('[data-testid="modal-'+i+'"]').onclick=function() {
                dialog.close();
                if(b.action)b.action();
                if(previous&&previous.isConnected)previous.focus();
            };
        });
    }
    function go(screen, fromHistory) {
        if(!undoPending) {
            clearTimeout(toastTimer);
            toastEl.innerHTML='';
        }
        if(!fromHistory&&screen!=='loading') {
            try {
                if(history.state&&history.state.screen===screen)history.replaceState({screen:screen}, '', '#'+screen);
                else history.pushState({screen:screen}, '', '#'+screen);
            } catch(e) {}
        }
        if(state.screen==='loading'&&screen!=='plan')activeGeneration++;
        state.screen=screen;
        save();
        render();
        if(flipNext){var page=view.querySelector('.question'); if(page){page.dataset.flip='true';page.classList.add('page-flip');}flipNext=false;}
        window.scrollTo(0, 0);
        var title=document.getElementById('step-title');
        if(title)title.focus( {
            preventScroll:true
        });
    }
    window.addEventListener('popstate', function(e) {
        var target=e.state&&e.state.screen;
        if(!target)target='start';
        if(target==='plan'&&!state.plan)target='start';
        if(state.screen==='loading')activeGeneration++;
        go(target, true);
    });
    function get(id) {
        return document.querySelector('[data-testid="'+id+'"]');
    }
    function on(id, fn, event) {
        var el=get(id);
        if(el)el.addEventListener(event||'click', fn);
    }
    function start() {
        var a=state.answers;
        view.innerHTML='<div class="shell"><div class="start-grid"><section class="intro"><div class="eyebrow">THE WORLD IS YOUR TREASURE.</div>'+heading('Your next adventure<br>starts here.', 'A little less planning. A lot more going.')+'<div class="form-stack"><div><label class="field-label" for="from">Where are you flying from?</label><input id="from" data-testid="start-from" placeholder="City or airport (e.g., Seattle, SEA)" value="'+esc(a.origin)+'" autocomplete="off"><small>We use this to estimate flights.</small><div class="error" id="origin-error" role="alert"></div></div><div>'+(a.unsure?'<div class="row banner" style="margin:0">Surprise me ✓ '+btn('Change', 'start-change', '')+'</div>':'<label class="field-label" for="to">Where do you want to go?</label><input id="to" data-testid="start-to" placeholder="City, region or country" value="'+esc(a.destination)+'"><div class="error" id="dest-error" role="alert"></div>'+btn("I'm not sure yet", 'start-unsure', 'outline full')+'<small>Tell us a few things and we’ll suggest three places.</small>')+'</div>'+btn('Next <span aria-hidden="true">↗</span>', 'start-next', 'primary full')+'</div><div class="demo"><div class="eyebrow">A LITTLE INSPIRATION</div><strong>Try the demo: Oahu, Nov 25–29</strong><p>Couple aged 18 & 19 · The Kahala Hotel & Resort</p>'+btn('Open the Oahu sample ↗', 'demo-oahu', 'outline full')+'</div><p class="footer-note">Free to use. Your answers stay on this device until you save.</p></section>'+photo('images/hero.jpg', 'A sunlit island coastline, an invitation to slow down', 'hero-photo', '<div class="photo-caption"><span class="eyebrow" style="color:white">YOUR NEXT CHAPTER</span><strong>Somewhere feels like you.</strong><span>We’ll help you find it.</span><svg class="ship-mark" viewBox="0 0 140 70" width="100" height="50" aria-hidden="true"><path d="M10 48H126L108 62H30Z M68 6V45 M62 10L30 42H62Z M74 15L105 42H74Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 68Q20 58 35 68T65 68T95 68T125 68" fill="none" stroke="currentColor"/></svg></div>')+'</div><div class="start-footer"><span>✳ Made for your kind of travel</span><span>Thoughtful plans, down to the little things</span><span>Always yours to change</span></div></div>';
        view.querySelector('.form-stack').insertAdjacentHTML('beforebegin','<div class="start-map" aria-hidden="true">'+mapRoute()+compass+'</div>');
        on('start-from', function(e) {
            a.origin=e.target.value;
            save();
        }, 'input');
        on('start-to', function(e) {
            a.destination=e.target.value;
            save();
        }, 'input');
        on('start-unsure', function() {
            a.unsure=true;
            go('start');
        });
        on('start-change', function() {
            a.unsure=false;
            go('start');
        });
        on('start-next', function() {
            var valid=true;
            if(!a.origin.trim()) {
                document.getElementById('origin-error').textContent="Add where you're flying from so we can estimate flights.";
                get('start-from').setAttribute('aria-invalid', 'true');
                valid=false;
            }
            if(!a.unsure&&!a.destination.trim()) {
                document.getElementById('dest-error').textContent='Add a city, region or country, or choose “I’m not sure yet”.';
                get('start-to').setAttribute('aria-invalid', 'true');
                valid=false;
            } else if(!a.unsure&&Engine.matchDestination(a.destination).id==='custom'&&(a.destination.trim().length<3||!/[A-Za-z\u00C0-\u024F]/.test(a.destination))) {
                document.getElementById('dest-error').textContent='We couldn’t find that place. Try a nearby city or airport code.';
                get('start-to').setAttribute('aria-invalid', 'true');
                valid=false;
            }
            if(a.origin.trim()&&(a.origin.trim().length<3||!/[A-Za-z]/.test(a.origin))) {
                document.getElementById('origin-error').textContent='We couldn’t find that place. Try a nearby city or airport code.';
                get('start-from').setAttribute('aria-invalid', 'true');
                valid=false;
            }
            if(valid){flipNext=true;go('dates');}
        });
        on('demo-oahu', demo);
    }
    function demo() {
        state.answers=Object.assign( {}, defaults,  {
            origin:'Los Angeles (LAX)', destination:'Oahu', unsure:false, start:'2026-11-25', end:'2026-11-29', budget:6000, budgetChoice:'5000+', who:'couple', ages:[18, 19], styles:['relaxing', 'scenic'], mustdos:'Diamond Head, Kualoa Ranch, intro dive, parasailing, birthday dinner 11/26 7:30 PM, Black Friday shopping', stay:'The Kahala Hotel & Resort', personal:true
        });
        save();
        generate();
    }
    function option(value, label, sub, key, multi) {
        var a=state.answers, selected=multi?(a[key]||[]).indexOf(value)>=0:a[key]===value;
        return'<label class="option '+(selected?'stamped':'')+'" data-testid="opt-'+esc(value)+'"><input type="'+(multi?'checkbox':'radio')+'" name="'+key+'" value="'+esc(value)+'" '+(selected?'checked':'')+'><span><strong>'+label+'</strong>'+(sub?'<small>'+sub+'</small>':'')+'</span></label>';
    }
    function validQuestion() {
        var a=state.answers, s=state.screen;
        if(s==='dates') {
            if(a.flexible)return!!a.month&&a.length>=2;
            return!!a.start&&!!a.end&&a.end>a.start&&a.start>=new Date().toLocaleDateString('en-CA');
        }
        if(s==='budget')return a.budgetChoice==='flexible'||(a.budgetChoice&&Number(a.budget)>100);
        if(s==='who')return!!a.who;
        if(s==='ages') {
            var n=a.who==='solo'?1:a.who==='couple'?2:Number(a.adults)+Number(a.kids);
            return a.ages.length===n&&Array.from( {
                length:n
            }, function(_, i) {
                return a.ages[i];
            }).every(function(x) {
                return x!==undefined&&x!==null&&x!==''&&Number(x)>=0&&Number(x)<=110;
            });
        }
        if(s==='style')return a.styles.length>0;
        return true;
    }
    function updateContinue() {
        var el=get('q-continue');
        if(el)el.disabled=!validQuestion();
    }
    function question() {
        var a=state.answers, s=state.screen, index=steps.indexOf(s), isExtra=extra.indexOf(s)>=0, idx=isExtra?extra.indexOf(s):index, total=isExtra?3:5;
        var copy= {
            dates:['When are you going?', 'Pick your travel dates. Weather and prices depend on them.'], budget:["What’s your budget?", 'Total for everyone. Choose what your treasure fund covers below.'], who:["Who’s coming?", 'This shapes pace, rooms and activities.'], ages:['How old are the travelers?', 'Ages change the plan: rental cars, tours and some activities have age limits.'], style:['What kind of trip do you want?', 'Pick up to two. A third pick swaps out your first.'], food:['What do you like to eat?', "Pick any. We’ll plan meals near where you’re staying."], pace:['How active do you want to be?', 'Walking, hiking and water time all count.'], musts:['Anything we must include?', "Bookings, birthdays, places, or things to skip. We’ll fit them in."]
        }
        [s];
        var content='';
        if(s==='dates') {
            content='<label class="checkrow"><input type="checkbox" data-testid="flexible" '+(a.flexible?'checked':'')+'>My dates are flexible</label>';
            if(a.flexible) {
                content+='<label>Month<select data-testid="month">'+Array.from( {
                    length:12
                }, function(_, i) {
                    return'<option value="'+(i+1)+'" '+(Number(a.month)===i+1?'selected':'')+'>'+new Date(2026, i, 1).toLocaleString('en',  {
                        month:'long'
                    })+'</option>';
                }).join('')+'</select></label><label>Trip length: '+(a.length||5)+' days<input data-testid="length" type="number" min="2" max="10" value="'+(a.length||5)+'"></label>';
            } else content+='<div class="two"><label>Start date<input data-testid="date-start" type="date" value="'+esc(a.start)+'"></label><label>End date<input data-testid="date-end" type="date" value="'+esc(a.end)+'"></label></div><p id="date-summary">'+(a.start&&a.end&&a.end>a.start?Engine.tripDays(a)+' days · '+(Engine.tripDays(a)-1)+' nights':'Pick your dates to see trip length.')+'</p><p class="error" id="date-error" role="alert"></p>';
        } else if(s==='budget') {
            content='<div class="options">'+[['1500', 'Under $1,500', 1400], ['3000', '$1,500–$3,000', 3000], ['5000', '$3,000–$5,000', 5000], ['5000+', '$5,000+', 6000], ['custom', "I’ll type a number", 0]].map(function(r) {
                return option(r[0], r[1], '', 'budgetChoice', false);
            }).join('')+'</div>'+(a.budgetChoice==='custom'?'<label>Total budget (USD)<input type="number" data-testid="budget-custom" min="101" value="'+esc(a.budget||'')+'"></label><small>Enter a number above $100.</small>':'');
        } else if(s==='who') {
            content='<div class="options">'+[['solo', '<span aria-hidden="true">🧍</span> Solo', 'Just me'], ['couple', '<span aria-hidden="true">👫</span> Couple', 'Two of us'], ['family', '<span aria-hidden="true">👨‍👩‍👧</span> Family', 'With kids'], ['friends', '<span aria-hidden="true">👯</span> Friends', 'A group of friends']].map(function(r) {
                return option(r[0], r[1], r[2], 'who');
            }).join('')+'</div>';
            if(a.who==='family'||a.who==='friends')content+='<div class="two"><label>Adults<input type="number" data-testid="adults" min="1" max="12" value="'+a.adults+'"></label><label>Kids<input type="number" data-testid="kids" min="0" max="12" value="'+a.kids+'"></label></div>';
        } else if(s==='ages') {
            var count=a.who==='solo'?1:a.who==='couple'?2:Number(a.adults)+Number(a.kids);
            content='<div class="row">'+btn('Everyone is 25+', 'ages-25', 'outline')+btn('Someone is 21–24', 'ages-21', 'outline')+btn('Someone is under 21', 'ages-under', 'outline')+'</div><div class="two">'+Array.from( {
                length:count
            }, function(_, i) {
                return'<label>Traveler '+(i+1)+' age<input type="number" min="0" max="110" data-testid="age-'+i+'" data-age="'+i+'" value="'+esc(a.ages[i]===undefined?'':a.ages[i])+'"></label>';
            }).join('')+'</div>';
        } else if(s==='style') {
            content='<div class="options">'+[['relaxing', '☼ Relaxing', 'Slow mornings, no rush'], ['hotel', '⌂ Staying at the hotel', 'Pool, spa, great food on site'], ['wandering', '↝ Wandering around', 'Neighborhoods, markets, no fixed plan'], ['scenic', '◒ Scenic spots', 'Views, viewpoints, photo stops'], ['adventure', '△ Adventure', 'Water, trails, adrenaline']].map(function(r) {
                return option(r[0], r[1], r[2], 'styles', true);
            }).join('')+'</div><p id="style-limit" class="hint" aria-live="polite"></p>';
        } else if(s==='food') {
            content='<div class="options">'+['Local classics', 'Seafood', 'Street food / casual', 'Fine dining', 'Vegetarian', 'Vegan', 'Halal', 'Gluten-free', 'Coffee & bakeries', 'No preference'].map(function(v) {
                return option(v, v, '', 'food', true);
            }).join('')+'</div><label>Allergies or things to avoid (optional)<input data-testid="allergies" value="'+esc(a.allergies)+'"></label>';
        } else if(s==='pace') {
            content='<div class="options">'+[['Easy', 'Short walks, lots of downtime'], ['Moderate', 'A few hours on your feet a day'], ['Full-on', 'Early starts, long days']].map(function(r) {
                return option(r[0], r[0], r[1], 'pace');
            }).join('')+'</div>';
        } else {
            content='<label>Bookings, birthdays and places<textarea data-testid="mustdos" placeholder="e.g., birthday dinner on 11/26 at 7:30 PM">'+esc(a.mustdos)+'</textarea></label><div class="row">'+['Special occasion', 'A booked hotel', 'Shopping', 'Photo spots', 'Water activity', 'A specific tour'].map(function(v, i) {
                return btn(v, 'must-chip-'+i, 'outline', 'data-chip="'+v+'"');
            }).join('')+'</div><label>Where are you staying? (hotel name)<input data-testid="stay" value="'+esc(a.stay)+'"></label>';
        }
        view.innerHTML='<section class="question"><span class="section-label">YOUR NEXT SOMEWHERE</span><p>Step '+(idx+1)+' of '+total+'</p><div class="progress" role="progressbar" aria-label="Question progress" aria-valuenow="'+(idx+1)+'" aria-valuemin="0" aria-valuemax="'+total+'"><span style="width:'+((idx+1)/total*100)+'%"></span></div>'+heading(copy[0], copy[1])+'<fieldset><legend>'+( {
            dates:'Travel dates', budget:'Total trip budget', who:'Travel group', ages:'Traveler ages', style:'Trip styles', food:'Food preferences', pace:'Daily pace', musts:'Your requests'
        }
        [s])+'</legend>'+content+'</fieldset><div class="qfooter">'+btn('← Back', 'q-back', '')+btn('Skip', 'q-skip', '')+btn(s==='musts'?'Build my plan':s==='style'&&a.unsure?'See my options':'Continue →', 'q-continue', 'primary', validQuestion()?'':'disabled')+'</div></section>';
        journal(s);
        view.querySelectorAll('.option input').forEach(function(el) {
            el.onchange=function() {
                el.closest('.option').classList.toggle('stamped',el.checked);
                var key=el.name;
                if(key==='styles')a.styleSkipped=false;
                if(el.type==='checkbox') {
                    var values=a[key]||[];
                    if(el.checked&&key==='styles'&&values.length>=2) {
                        var dropped=values[0];
                        a.styles=values.slice(1).concat(el.value);
                        var drop=view.querySelector('input[name="styles"][value="'+dropped+'"]');
                        if(drop){drop.checked=false;drop.closest('.option').classList.remove('stamped');}
                        var label=function(v){ var o=view.querySelector('[data-testid="opt-'+v+'"] strong'); return o?o.textContent.replace(/^[^A-Za-z]+/,''):v; };
                        var msg='Swapped '+label(dropped)+' for '+label(el.value)+'. You can pick two.';
                        document.getElementById('style-limit').textContent=msg;
                        save();
                        updateContinue();
                        return;
                    }
                    a[key]=el.checked?values.concat(el.value):values.filter(function(v) {
                        return v!==el.value;
                    });
                } else {
                    a[key]=el.value;
                    if(key==='budgetChoice') {
                        a.budget= {
                            '1500':1400, '3000':3000, '5000':5000, '5000+':6000, custom:null
                        }
                        [el.value];
                    }
                    if(key==='who') {
                        a.ages=[];
                    }
                    if(key==='budgetChoice'||key==='who') {
                        save();
                        question();
                        var again=view.querySelector('input[name="'+key+'"][value="'+el.value+'"]');
                        if(again)again.focus();
                        announce(key==='who'?'Travel group: '+el.value+'.':'Budget selected.');
                        return;
                    }
                }
                save();
                updateContinue();
            };
        });
        on('flexible', function(e) {
            a.flexible=e.target.checked;
            if(a.flexible&&!a.monthSet)a.month=flexibleMonth();
            save();
            question();
            var f=get('flexible');
            if(f)f.focus();
            announce(a.flexible?'Flexible dates: pick a month and trip length.':'Pick your start and end dates.');
        }, 'change');
        ['month', 'length', 'adults', 'kids', 'allergies', 'mustdos', 'stay'].forEach(function(k) {
            on(k, function(e) {
                if(k==='month')a.monthSet=true;
                a[k]=['month', 'length', 'adults', 'kids'].indexOf(k)>=0?Math.max(k==='kids'?0:k==='length'?2:1, Math.min(k==='length'?10:12, Math.floor(Number(e.target.value)))):e.target.value;
                save();
                if(k==='adults'||k==='kids')a.ages=[];
                updateContinue();
            }, 'input');
        });
        ['start', 'end'].forEach(function(k) {
            on('date-'+k, function(e) {
                a[k]=e.target.value;
                save();
                var error=document.getElementById('date-error');
                error.textContent=a.start&&a.end&&a.end<=a.start?'End date must be after your start date.':a.start&&a.start<new Date().toLocaleDateString('en-CA')?'Pick dates in the future.':'';
                document.getElementById('date-summary').textContent=a.start&&a.end&&a.end>a.start?Engine.tripDays(a)+' days · '+(Engine.tripDays(a)-1)+' nights':'';
                updateContinue();
            }, 'input');
        });
        on('budget-custom', function(e) {
            a.budget=Number(e.target.value);
            save();
            updateContinue();
        }, 'input');

        view.querySelectorAll('[data-age]').forEach(function(el) {
            el.oninput=function() {
                var n=Number(el.dataset.age);
                a.ages[n]=el.value===''?'':Number(el.value);
                save();
                updateContinue();
            };
        });
        [['25', 25], ['21', 23], ['under', 19]].forEach(function(r) {
            on('ages-'+r[0], function() {
                var n=a.who==='solo'?1:a.who==='couple'?2:Number(a.adults)+Number(a.kids);
                a.ages=Array(n).fill(25);
                a.ages[0]=r[1];
                if(a.kids&&(a.who==='family'||a.who==='friends'))for(var k=a.adults; k<n; k++)a.ages[k]=10;
                save();
                question();
                var b=get('ages-'+r[0]);
                if(b)b.focus();
                announce('Ages filled in. Adjust any traveler below.');
            });
        });
        view.querySelectorAll('[data-chip]').forEach(function(el) {
            el.onclick=function() {
                a.mustdos+=(a.mustdos?', ':'')+el.dataset.chip;
                get('mustdos').value=a.mustdos;
                save();
            };
        });
        on('q-back', function() {
            go(isExtra?(idx===0?'fork':extra[idx-1]):idx===0?'start':steps[idx-1]);
        });
        on('q-skip', function() {
            if(s==='dates') {
                a.flexible=true;
                a.month=flexibleMonth();
                a.length=5;
            }
            if(s==='budget') {
                a.budget=null;
                a.budgetChoice='flexible';
            }
            if(s==='who') {
                a.who='couple';
                a.ages=[25, 25];
            }
            if(s==='ages') {
                var n=a.who==='solo'?1:a.who==='couple'?2:a.adults+a.kids;
                a.ages=Array(n).fill(25);
                if(a.kids)for(var k=a.adults; k<n; k++)a.ages[k]=10;
            }
            if(s==='style') {
                a.styles=[];
                a.styleSkipped=true;
            }
            nextQuestion();
        });
        on('q-continue', nextQuestion);
    }
    function nextQuestion() {
        state.answers.completed=Array.from(new Set((state.answers.completed||[]).concat(state.screen)));
        flipNext=true;
        save();
        var s=state.screen, i=steps.indexOf(s), j=extra.indexOf(s);
        if(i>=0) {
            if(i<steps.length-1)go(steps[i+1]);
            else go(state.answers.unsure?'recommendations':'fork');
        } else if(j<2)go(extra[j+1]);
        else generate();
    }
    var compass='<svg viewBox="0 0 64 64" width="32" height="32" aria-hidden="true"><circle cx="32" cy="32" r="25" fill="none" stroke="currentColor"/><circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" stroke-dasharray="1 4"/><path d="M32 4l6 22 22 6-22 6-6 22-6-22-22-6 22-6z" fill="#f8eed7" stroke="currentColor"/><path d="M32 4v28L26 26z M60 32H32l6-6z M32 60V32l6 6z M4 32h28l-6 6z" fill="currentColor"/><circle cx="32" cy="32" r="3" fill="#a53f2e"/></svg>';
    function icon(key){
        var paths={dates:'M5 7h14v13H5z M8 4v6 M16 4v6 M5 12h14',budget:'M4 8c0-4 16-4 16 0s-16 4-16 0 M4 8v8c0 4 16 4 16 0V8 M4 12c0 4 16 4 16 0',who:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M2 20v-3c0-5 12-5 12 0v3 M16 5a3 3 0 0 1 0 6 M18 14c4 0 4 3 4 6',ages:'M6 3h12 M6 21h12 M8 3v5l8 8v5 M16 3v5l-8 8v5',style:'M12 2v20 M2 12h20 M16 8l-3 5-5 3 3-5z',flights:'M2 13l8-3V3l3-1 1 8 7 3v2l-7-1v5l3 2H7l3-2v-5l-8 1z',hotel:'M3 20V8 M21 20V8 M3 15h18 M6 9h5v5H6z M13 9h5v5h-5z',food:'M5 3v7c0 3 6 3 6 0V3 M8 3v19 M19 3c-5 3-5 10 0 10V3v19',activities:'M3 6h18v4c-4 0-4 4 0 4v4H3v-4c4 0 4-4 0-4z',transport:'M3 18V11l3-6h12l3 6v7z M3 11h18 M6 18v3 M18 18v3 M6 14h2 M16 14h2',bring:'M6 8h12l2 13H4z M9 8V4h6v4 M8 13h8v5H8z',info:'M12 10v8 M12 6v1 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20'};
        return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[key]||paths.style)+'"/></svg>';
    }
    function mapRoute(){return '<svg class="map-route" viewBox="0 0 500 140" fill="none" aria-hidden="true"><path class="route" d="M25 110C100 10 160 150 240 70S370 20 445 65" stroke="currentColor" stroke-width="2" stroke-dasharray="4 7"/><path class="map-x" d="M434 52l24 26m0-26l-24 26" stroke="#a53f2e" stroke-width="5"/><path d="M60 85l18-35 18 35m-28-15h20 M300 115q20-16 40 0t40 0" stroke="#9a855b"/></svg>';}
    function passport(){var done=state.answers.completed||[];return '<div class="passport" data-testid="stamp-bar" aria-label="Stamp passport"><span>EXPLORER PASSPORT</span>'+steps.concat(done.filter(function(k){return !steps.includes(k);})).map(function(k,i){var earned=done.includes(k);return '<span class="passport-stamp '+(earned?'earned':'unearned')+' stamp-'+i%3+'" '+(earned?'data-testid="stamp"':'')+' aria-label="'+esc(k)+(earned?' completed':' not yet collected')+'">'+icon(k)+'<span>'+esc(k)+'</span></span>';}).join('')+'</div>';}
    function journal(s){
        var hints={dates:'Chart your dates; leave room for a little discovery.',budget:'Count your coins and choose what they need to cover.',who:'Every good expedition starts with its crew.',ages:'Ages help us choose adventures for the whole crew.',style:'Follow your compass. Choose up to two ways to explore.',food:'Find the flavors worth dropping anchor for.',pace:'Set a pace that leaves time to enjoy the view.',musts:'Pin your treasures so they make it onto the map.'};
        var page=view.querySelector('.question');
        page.insertAdjacentHTML('afterbegin',passport()+'<div class="guide" data-testid="guide" aria-live="polite">'+compass+'<span>'+hints[s]+'</span></div>');
        page.insertAdjacentHTML('beforeend','<footer class="page-number">Page '+((steps.includes(s)?steps:extra).indexOf(s)+1)+' of '+(steps.includes(s)?5:3)+'</footer><aside class="pinned" data-testid="pinned-answers" aria-label="Pinned answers">'+(state.answers.completed||[]).map(function(k){var a=state.answers;var v={dates:a.flexible?'Flexible dates':a.start+' → '+a.end,budget:({'1500':'Under $1,500','3000':'$1,500–$3,000','5000':'$3,000–$5,000','5000+':'$5,000+'})[a.budgetChoice]||(a.budget?money(a.budget):'Flexible budget'),who:a.who,ages:a.ages.join(' & '),style:a.styles.join(', '),food:a.food.join(', '),pace:a.pace,musts:a.mustdos}[k];return '<span>'+esc(k)+': '+esc(v||'Skipped')+'</span>';}).join('')+'</aside>');
        if(s==='budget'){
            var covers=state.answers.covers||defaults.covers;
            var field=document.createElement('fieldset');field.className='covers';field.innerHTML='<legend>What does this budget cover?</legend>'+Object.entries({flights:'Flights',hotel:'Hotel',food:'Food',activities:'Activities',transport:'Getting around (Uber/transit)'}).map(function(r){return '<label class="checkrow"><input type="checkbox" data-testid="cover-'+r[0]+'" value="'+r[0]+'" '+(covers.includes(r[0])?'checked':'')+'>'+icon(r[0])+'<span>'+r[1]+'</span></label>';}).join('');
            page.querySelector('.qfooter').before(field);
            field.onchange=function(){state.answers.covers=Array.from(field.querySelectorAll('input:checked')).map(function(e){return e.value;});state.answers.includeFlights=state.answers.covers.includes('flights');save();};
        }
    }
    function budgetHTML(){
        var p=state.plan,b=Engine.estimateCost(Object.assign({},state.answers,{includeFlights:true}),Engine.matchDestination(state.answers.destination)).breakdown, curated=p.id==='oahu-demo-2026-11';
        var amounts=curated?{flights:'No approx. figure yet — check when booking',hotel:'No approx. figure yet — check when booking',food:'No approx. figure yet — check when booking',activities:'$830–950',transport:'$286–367 before tips'}:{flights:money(b.flights),hotel:money(b.stay),food:money(b.food),activities:money(b.activities),transport:money(b.localTransport)};
        return '<section class="card budget" data-testid="budget-buckets"><h2>Budget</h2><p>Rough estimates, not quotes. '+(curated?'For two; flights, hotel and meals have not been researched.':'Based on the existing destination cost estimates.')+'</p>'+Object.entries({flights:'Flights',hotel:'Hotel',food:'Food',activities:'Activities',transport:'Getting around (Uber/transit)'}).map(function(r){return '<div class="bucket '+((state.answers.covers||defaults.covers).includes(r[0])?'included':'excluded')+'" data-testid="bucket-'+r[0]+'"><span class="bucket-icon">'+icon(r[0])+'</span><strong>'+r[1]+'</strong><span>'+(/\d/.test(amounts[r[0]])?'approx. ':'')+esc(amounts[r[0]])+'</span><small data-testid="bucket-status">'+((state.answers.covers||defaults.covers).includes(r[0])?'Included in your budget':'Not included')+'</small></div>';}).join('')+'</section>';
    }
    function planTiles(){
        if(state.tab!=='plan')return;
        var shell=view.querySelector('.shell');
        var revealSeen=state.revealPlan===state.plan;state.revealPlan=state.plan;
        shell.insertAdjacentHTML('afterbegin',passport()+'<div data-testid="treasure-reveal" class="treasure '+(revealSeen?'is-settled':'')+'" style="--reveal-time:'+(location.search.includes('fast=1')?'350ms':'1400ms')+'">'+mapRoute()+'<div><strong>Trip unlocked</strong><span>'+esc(state.plan.title)+'</span></div></div>');
        var reveal=shell.querySelector('.treasure');if(!revealSeen)setTimeout(function(){reveal.classList.add('is-settled');},reduceMotion.matches||document.documentElement.classList.contains('reduce-motion')?0:location.search.includes('fast=1')?350:1400);
        shell.insertAdjacentHTML('beforeend',budgetHTML());
        var budget=view.querySelector('.budget');
        var content=document.getElementById('tab-content');content.append(budget);
        var essentials=document.createElement('section');essentials.className='card utility-tile';essentials.id='trip-essentials';essentials.dataset.title='Trip essentials';essentials.dataset.summary='Weather, age rules, costs and important notices';
        Array.from(shell.children).filter(function(e){return e.matches('details, .warning');}).forEach(function(e){essentials.append(e);});content.append(essentials);
        var p=state.plan, items=p.days.flatMap(function(d){return d.items;});
        [
            ['food','Food','Meal stops, close to your route',items.filter(function(it){return it.kind==='meal';}).map(function(it){return '<p><strong>'+esc(it.time)+' · '+esc(it.title)+'</strong></p>';}).join('')],
            ['transport','Getting around','Rides, shuttles and walking',p.days.map(function(d,i){return '<p><strong>Day '+(i+1)+'</strong> · '+esc(d.car.level)+' — '+esc(d.car.note)+'</p>';}).join('')],
            ['bring','What to bring','Your essentials, grouped and ready to tick', '<p>Open the Packing tab for the complete checklist. Activity checklists inside each day stay in sync with it.</p>'+packingGroups().map(function(g){return '<p><strong>'+esc(g.group)+'</strong> · '+g.items.length+' items</p>';}).join('')],
            ['bookings','Booking reminders','Reserve the important parts before you go',prep((p.flags||[]).concat(p.days.flatMap(function(d){return (d.prep||[]).concat(d.items.flatMap(function(it){return it.prep||[];}));})).filter(function(t){return t.type==='book';}))]
        ].forEach(function(r){var sec=document.createElement('section');sec.className='card utility-tile';sec.id=r[0]+'-tile';sec.dataset.title=r[1];sec.dataset.summary=r[2];sec.innerHTML='<h2>'+r[1]+'</h2>'+r[3];content.append(sec);});
        var grid=document.createElement('div');grid.className='tile-grid';content.append(grid);
        var sections=Array.from(view.querySelectorAll('.day, .budget, .utility-tile'));
        sections.forEach(function(sec,i){
            var id=sec.id||'budget-tile';if(sec.classList.contains('day'))sec.dataset.testid='plan-day';else if(sec.classList.contains('budget'))sec.dataset.testid='budget-buckets';
            var wrap=document.createElement('div');wrap.dataset.testid='tile';wrap.className='tile';grid.append(wrap);wrap.append(sec);
            var body=document.createElement('div');body.id='tile-content-'+i;body.className='tile-content';while(sec.firstChild)body.append(sec.firstChild);sec.append(body);
            var title=sec.classList.contains('day')?'Day '+(i+1)+' · '+state.plan.days[i].theme:sec.dataset.title||'Budget';
            var summary=sec.dataset.summary||(sec.classList.contains('day')?dateLabel(state.plan.days[i].date)+' · '+state.plan.days[i].items.length+' stops':'Five spending buckets · approx. estimates');
            var toggle=document.createElement('button');toggle.dataset.testid='tile-toggle';toggle.className='tile-toggle';toggle.setAttribute('aria-controls',body.id);toggle.innerHTML='<span class="tile-badge" aria-hidden="true">'+(sec.classList.contains('day')?String(i+1):icon(sec.classList.contains('budget')?'budget':({'food-tile':'food','transport-tile':'style','bring-tile':'bring','trip-essentials':'info'})[id]||'dates'))+'</span><span class="tile-label">'+esc(title)+'<small>'+esc(summary)+'</small></span><span aria-hidden="true">＋</span>';sec.prepend(toggle);
            function set(on){toggle.setAttribute('aria-expanded',String(on));body.hidden=!on;wrap.classList.toggle('is-open',on);}
            set(openTile===id);
            toggle.onclick=function(){var on=toggle.getAttribute('aria-expanded')!=='true';view.querySelectorAll('[data-testid="tile-toggle"]').forEach(function(t){t.setAttribute('aria-expanded','false');t.nextElementSibling.hidden=true;t.closest('.tile').classList.remove('is-open');});set(on);openTile=on?id:null;};
        });
        view.querySelectorAll('.daynav a').forEach(function(a,i){a.addEventListener('click',function(){var t=view.querySelectorAll('.day .tile-toggle')[i];if(t.getAttribute('aria-expanded')!=='true')t.click();});});
    }
    function recommendations() {
        var a=state.answers, all=Engine.recommend(a).filter(function(d) {
            return state.excluded.indexOf(d.id)<0;
        }), cards=all.slice(state.recOffset, state.recOffset+3);
        if(cards.length<3) {
            state.recOffset=0;
            cards=all.slice(0, 3);
        }
        view.innerHTML='<div class="shell">'+heading('Three places that fit', 'Based on your dates, budget and style. Pick one to keep going.')+(a.flexible?'<p class="badge" data-testid="dates-flexible">Dates: flexible · '+monthName(a.month)+' · '+(a.length||5)+' days</p>':'')+'<div class="rec-grid">'+cards.map(function(d) {
            return'<article class="card rec" data-testid="rec-card">'+photo(d.image, d.name)+'<span class="badge">'+(d.score>=60?'Great fit':'Good fit')+'</span><h2>'+esc(d.name)+'</h2><p class="muted">'+esc(d.country)+' · '+esc(d.tagline)+'</p><ul>'+d.whyFits.map(function(t) {
                return'<li>'+esc(t)+'</li>';
            }).join('')+'</ul><strong>About '+money(d.total)+' total</strong><p>for '+a.ages.length+', flights from '+esc(a.origin)+(a.includeFlights?' included':' excluded')+'</p>'+(a.budget&&d.total>a.budget?'<span class="badge">Over budget by about '+money(d.total-a.budget)+'</span>':'')+'<details><summary data-testid="disclosure">See breakdown</summary>'+breakdown(d.breakdown)+'</details><small>Rough estimate — approx., verify before booking</small>'+(d.originNote?'<p><small>'+d.originNote+'</small></p>':'')+'<div class="banner">☀ Typically '+d.weather.loF+'–'+d.weather.hiF+'°F ('+Math.round((d.weather.loF-32)*5/9)+'–'+Math.round((d.weather.hiF-32)*5/9)+'°C) in '+new Date(2026, (a.flexible?a.month:Number(a.start.split('-')[1]))-1, 1).toLocaleString('en',  {
                month:'long'
            })+'<p>'+esc(d.weather.note)+'</p><small>Typical conditions, not a forecast</small></div>'+btn('Choose this place', 'rec-choose', 'primary full', 'data-dest="'+d.id+'"')+btn('Not this one', 'rec-dismiss', 'full', 'data-dismiss="'+d.id+'"')+'</article>';
        }).join('')+'</div><div class="row" style="margin-top:24px">'+btn('Show me different ideas', 'rec-more', 'outline')+btn('← Back', 'rec-back', '')+btn('Change my answers', 'rec-change', '')+'</div><p class="footer-note">Costs are estimates. We’ll confirm real prices when you book.</p></div>';
        view.querySelectorAll('[data-dest]').forEach(function(el) {
            el.onclick=function() {
                a.destination=window.CATALOG.find(function(d) {
                    return d.id===el.dataset.dest;
                }).name;
                go('fork');
            };
        });
        view.querySelectorAll('[data-dismiss]').forEach(function(el) {
            el.onclick=function() {
                state.excluded.push(el.dataset.dismiss);
                if(state.excluded.length>8)state.excluded=[];
                recommendations();
            };
        });
        on('rec-more', function() {
            state.recOffset=(state.recOffset+3)%9;
            recommendations();
        });
        on('rec-back', function() {
            go('style');
        });
        on('rec-change', function() {
            go('dates');
        });
    }
    function breakdown(b) {
        return Object.keys(b).map(function(k) {
            return'<div class="row" style="justify-content:space-between"><span>'+( {
                flights:'Flights', stay:'Stay', food:'Food', activities:'Activities', localTransport:'Local transport'
            }
            [k]||k)+'</span><strong>'+money(b[k])+'</strong></div>';
        }).join('');
    }
    function fork() {
        view.innerHTML='<section class="question">'+passport()+'<div class="eyebrow">A PLAN THAT FEELS LIKE YOU</div>'+heading('Want it more personal?', 'How detailed should we go? You can always refine later.')+'<div class="card"><span class="badge">ABOUT 1 MINUTE</span><h2>Yes, answer 3 more</h2><p>3 quick questions about food, pace and must-dos.</p>'+btn('Ask me →', 'fork-yes', 'primary full')+'</div><div class="card" style="margin-top:16px"><h2>No, quick plan now</h2><p>We’ll build it now from what you’ve told us.</p>'+btn('Plan it →', 'fork-no', 'outline full')+'</div><div class="qfooter">'+btn('← Back', 'fork-back', '')+'</div></section>';
        on('fork-back', function() {
            go(state.answers.unsure?'recommendations':'style');
        });
        on('fork-yes', function() {
            state.answers.personal=true;
            go('food');
        });
        on('fork-no', function() {
            state.answers.personal=false;
            state.answers.food=[];
            state.answers.pace='Moderate';
            state.answers.mustdos='';
            state.answers.stay='';
            generate();
        });
    }
    function generate(resume) {
        var generation=++activeGeneration;
        go('loading');
        var lines=['Checking the weather for your dates…', 'Finding places to stay…', 'Lining up meals near your hotel…', 'Ordering sights by the best time to go…', 'Adding what to bring…'], i=0;
        var timer=setInterval(function() {
            var el=document.getElementById('loading-line');
            if(el)el.textContent=lines[++i%lines.length];
        }, 2500);
        AI.generatePlan(state.answers, resume?{fast:true}:undefined).then(function(plan) {
            clearInterval(timer);
            if(generation!==activeGeneration)return;
            try {
                showPlan(plan, resume);
            } catch(err) {
                console.error(err);
                failed();
            }
        }, function(err) {
            clearInterval(timer);
            if(generation!==activeGeneration)return;
            console.error(err);
            failed();
        });
    }
    function failed() {
        view.innerHTML='<section class="question">'+heading('We couldn’t build your plan.', 'Your answers are saved.')+'<div class="row">'+btn('Try again', 'retry', 'primary')+btn('Edit answers', 'retry-edit', 'outline')+'</div></section>';
        on('retry', function(){ generate(); });
        on('retry-edit', function(){ go('dates'); });
    }
    function showPlan(plan, resume) {
            state.plan=plan;
            state.edits=read(KEY+'edits:'+plan.id,  {});
            state.packed=read(KEY+'packing:'+plan.id,  {});
            state.packMeta=read(KEY+'packing-meta:'+plan.id,  {});
            if(state.edits.quantities||state.edits.customPacking) {
                state.packMeta.quantities=Object.assign({}, state.edits.quantities||{}, state.packMeta.quantities||{});
                state.packMeta.customPacking=(state.packMeta.customPacking||[]).concat(state.edits.customPacking||[]);
                delete state.edits.quantities;
                delete state.edits.customPacking;
                write(KEY+'edits:'+plan.id, state.edits);
                write(KEY+'packing-meta:'+plan.id, state.packMeta);
            }
            state.tab='plan';
            write(KEY+'lastTrip',  {
                answers:state.answers
            });
            go('plan');
            if(!resume)toast('Your plan is ready.');
    }
    function packingGroups() {
        var p=state.plan, groups=JSON.parse(JSON.stringify(p.packing));
        (state.packMeta.customPacking||[]).forEach(function(item) {
            var group=groups.find(function(g) {
                return g.group===item.group;
            });
            (group||groups[groups.length-1]).items.push(item);
        });
        groups.forEach(function(g) {
            g.items.forEach(function(it) {
                if(state.packMeta.quantities&&state.packMeta.quantities[it.id]!=null)it.qty=state.packMeta.quantities[it.id];
            });
        });
        return groups;
    }
    function packingItem(id) {
        return packingGroups().flatMap(function(g) {
            return g.items;
        }).find(function(i) {
            return i.id===id;
        });
    }
    function persistPackMeta() {
        write(KEY+'packing-meta:'+state.plan.id, state.packMeta);
    }
    function persistEdits() {
        write(KEY+'edits:'+state.plan.id, state.edits);
    }
    function tick(id, value) {
        state.packed[id]=value;
        write(KEY+'packing:'+state.plan.id, state.packed);
        document.querySelectorAll('[data-pack-id]').forEach(function(el) {
            if(el.dataset.packId===id)el.checked=value;
        });
        var all=packingGroups().flatMap(function(g) {
            return g.items;
        }), n=all.filter(function(it) {
            return state.packed[it.id];
        }).length;
        var progress=document.getElementById('packing-progress');
        if(progress) {
            progress.setAttribute('aria-valuenow', n);
            progress.querySelector('span').style.width=(n/all.length*100)+'%';
        }
        var status=document.getElementById('packing-status');
        if(status)status.textContent='Packed, '+n+' of '+all.length+(n===all.length?' — All packed. Have a great trip.':'');
        if(state.hidePacked&&state.tab==='packing')planRender(false);
    }
    function checkHTML(it, test) {
        return'<label class="checkrow"><input type="checkbox" data-testid="'+test+'" data-pack-id="'+esc(it.id)+'" '+(state.packed[it.id]?'checked':'')+'><span>'+esc(it.name)+' <small>×'+it.qty+'</small></span></label>';
    }
    function tipsHTML(tips) {
        return tips.map(function(t) {
            return'<article class="card tip"><span class="badge">Source type: '+esc(t.sourceType)+'</span><p>'+esc(t.text)+'</p>'+(t.url?'<a data-testid="tip-source" href="'+esc(t.url)+'" target="_blank" rel="noopener noreferrer">Read source ↗</a>':'')+'</article>';
        }).join('');
    }
    function itemHTML(it, dayIndex) {
        var edit=state.edits.items&&state.edits.items[it.id]|| {}, title=edit.title||it.title, note=edit.note||'', time=edit.time||it.time;
        if(edit.swapped)it=Object.assign( {}, it,  {
            sources:[], bring:[], prep:[], tips:[], price:'', bestTime:'', bookable:false
        });
        return'<li data-item-id="'+esc(it.id)+'" id="item-'+esc(it.id)+'"><time>'+esc(time)+'</time><article class="item '+esc(it.kind)+'"><div class="row" style="gap:5px">'+(it.requested?'<span class="badge">📌 You requested this</span>':'')+(it.bookable?'<span class="badge">Bookable</span>':'')+(it.kind==='meal'?'<span class="badge">Meal pick · '+(/hotel|Kahala|Plumeria|Veranda|Alan Wong|birthday dinner/i.test(title+' '+(it.desc||''))&&!/Waikiki|Ala Moana|Kailua|Aunty Pat/i.test(title)?'Near hotel':'Local area')+'</span>':'')+'</div><h3>'+esc(title)+'</h3>'+(it.price?'<p><strong>approx. '+esc(it.price)+'</strong><small> · verify before booking</small></p>':'')+(it.bestTime?'<p><strong>Best at:</strong> '+esc(it.bestTime)+'</p>':'')+'<p>'+esc(edit.desc||it.desc)+'</p>'+(note?'<p class="banner">Your note: '+esc(note)+'</p>':'')+sources(it.sources)+(it.bring&&it.bring.length?'<details><summary data-testid="disclosure">What to bring ('+it.bring.length+')</summary><small>Ticking here also ticks it on your packing list.</small>'+it.bring.map(function(id) {
            var p=packingItem(id);
            return p?checkHTML(p, 'bring-item'):'';
        }).join('')+'</details>':'')+(it.prep&&it.prep.length?'<p class="section-label" style="margin-top:15px">Prep reminders</p>'+prep(it.prep):'')+(it.tips?it.tips.map(function(t) {
            return'<a class="badge tip-chip" data-testid="activity-tip" href="'+esc(t.url)+'" target="_blank" rel="noopener noreferrer">'+esc(t.sourceType)+' · '+esc(t.text)+' ↗</a>';
        }).join(''):'')+'<div class="row">'+(it.bookable?btn('Book this', 'item-book', 'outline', 'data-book="'+esc(it.id)+'"'):'')+btn('Edit', 'item-edit', '', 'data-edit="'+esc(it.id)+'"')+btn('Swap', 'item-swap', '', 'data-swap="'+esc(it.id)+'"')+btn('Remove', 'item-remove', '', 'data-remove="'+esc(it.id)+'"')+'</div><div id="edit-'+esc(it.id)+'"></div></article></li>';
    }
    function dayBookings(items) {
        var bookable=items.filter(function(it){return it.bookable&&!((state.edits.items||{})[it.id]||{}).swapped;});
        if(!bookable.length)return '';
        return '<p class="book-summary">📅 '+bookable.length+' thing'+(bookable.length>1?'s':'')+' to book ahead today: '+bookable.map(function(it){
            return '<a href="#item-'+esc(it.id)+'">'+esc(it.title.split(' — ')[0])+'</a>';
        }).join(' · ')+'</p>';
    }
    function dayHTML(d, i) {
        var edits=state.edits, relaxed=edits.relax&&edits.relax[i], rain=edits.rain&&edits.rain[i];
        var items=d.items.concat((edits.added|| {})[i]||[]).filter(function(it) {
            if((edits.removed||[]).indexOf(it.id)>=0)return false;
            if(relaxed) {
                if(state.plan.id.indexOf('oahu')>=0&&!state.plan.id.startsWith('template-')) {
                    if(i===1&&/Diamond Head|Uber to Diamond/.test(it.title))return false;
                    if(i===2&&/Ala Moana|Magic Island|Makai Market/.test(it.title))return false;
                    if(i===3&&/Pillbox/.test(it.title))return false;
                } else if(it.kind==='activity'&&!it.requested)return false;
            }
            return true;
        });
        if(relaxed&&i===2&&state.plan.id==='oahu-demo-2026-11') {
            items.push( {
                id:'relax-kahala', time:'~11:15 AM', kind:'rest', title:'Uber back to the Kahala, then hotel beach / pool and sunset at Kahala Beach', desc:'A gentler afternoon after the dive. Check the Uber app for the fare from Kewalo Basin.', bring:[], prep:[], sources:[]
            });
        }
        if(relaxed&&i===3&&state.plan.id==='oahu-demo-2026-11') {
            items=items.map(function(it) {
                if(!/Uber Reserve to Kailua/.test(it.title))return it;
                return Object.assign({}, it, { time:'~7:30 AM', title:'Uber to Kailua (later start, no sunrise hike)', desc:'Same ride as the sunrise plan, just later: approx. $38–55 one way, about 40 min; verify the fare in the app.', prep:[] });
            });
        }
        return'<section class="card day" id="day-'+i+'" data-testid="plan-day"><div class="day-head"><span class="section-label">'+new Date(d.date+'T12:00:00').toLocaleDateString('en-US',  {
            weekday:'short', month:'short', day:'numeric'
        })+'</span><h2>Day '+(i+1)+' · '+new Date(d.date+'T12:00:00').toLocaleDateString('en-US',  {
            weekday:'short', month:'short', day:'numeric'
        })+'</h2><p>'+esc(d.theme)+'</p><span class="badge">🏨 '+esc(state.plan.stay)+'</span>'+(/no rental car|not needed/i.test(d.car.level+' '+d.car.note)?'<span class="badge">🚶 No rental car — rideshare, shuttle and walking</span>':'<span class="badge">🚗 Car: '+esc(d.car.level)+' — '+esc(d.car.note)+'</span>')+'<span class="badge">☀ Typical conditions</span></div>'+dayBookings(items)+prep(d.prep)+(relaxed?'<div class="banner">Relaxed version: '+esc(d.relax)+'</div>':'')+(rain?'<div class="banner">☂ Rain backup: '+esc(d.rain)+'</div>':'')+'<ol class="timeline">'+items.map(function(it, j) {
            return itemHTML(it, i)+(j<items.length-1?'<li class="travel-chip" data-testid="travel-chip" style="display:block">'+travelIcon(it.travelToNext)+' '+esc(it.travelToNext||'approx. 5–10 min walk / local transfer — confirm route')+'</li>':'');
        }).join('')+'</ol><div class="day-footer row">'+(d.relax?'<label><input type="checkbox" data-testid="relax-toggle" data-relax="'+i+'" '+(relaxed?'checked':'')+'>Make this day more relaxing</label>':'')+(d.rain?'<label><input type="checkbox" data-testid="rain-toggle" data-rain="'+i+'" '+(rain?'checked':'')+'>Rain backup</label>':'')+btn('+ Add your own item', 'day-add', '', 'data-add-day="'+i+'"')+'</div></section>';
    }
    function planRender(moveFocus) {
        if(!undoPending) {
            clearTimeout(toastTimer);
            toastEl.innerHTML='';
        }
        var p=state.plan;
        if(!p) {
            go('start');
            return;
        }
        view.innerHTML='<div class="shell">'+planBanner(p)+planNotices(p)+'<div class="banner">'+esc(p.banner)+'</div><details><summary data-testid="disclosure">☀ '+(p.id.indexOf('oahu')>=0?'Typical weather · 84°F / 70°F':'Typical weather')+' · Typical conditions, not a forecast</summary><p>'+esc(p.weather.text)+'</p>'+sources(p.weather.sources)+'</details><details><summary data-testid="disclosure">'+(p.estimate?'Rough estimate: about '+money(p.estimate.total)+' total':(p.costSummary||'Estimated: approx. $1,120–1,320 for two · activities + local transport · excludes flights, hotel, meals & spa'))+'</summary>'+(p.estimate?breakdown(p.estimate.breakdown):(p.costs||[]).map(function(c) {
            return'<p><strong>'+esc(c.item)+'</strong> — approx. '+esc(c.price)+' · verify before booking'+sources(c.sources)+'</p>';
        }).join(''))+'<p>'+esc(p.activityTotal)+'</p></details>'+(p.ageRules&&p.ageRules.length?'<aside class="warning" data-testid="age-rules"><strong>Age rules applied</strong>'+p.ageRules.map(function(t) {
            return'<p>'+esc(t)+'</p>';
        }).join('')+(p.id==='oahu-demo-2026-11'?'<p>The guided Jurassic Adventure replaces self-drive UTV. The hotel’s approx. $60/day parking cost is avoided.</p>'+sources([OAHU_SOURCES.kualoaUtv, OAHU_SOURCES.kahalaMap]):'')+'</aside>':'')+prep(p.flags)+(state.edits.todos&&state.edits.todos.length?'<details><summary data-testid="booking-todos">Booking to-do ('+state.edits.todos.length+')</summary>'+state.edits.todos.map(function(id) {
            var item=p.days.flatMap(function(d) {
                return d.items;
            }).find(function(it) {
                return it.id===id;
            });
            return'<p>📅 '+esc(item?item.title:'Your activity')+' — confirm and book direct.</p>';
        }).join('')+'</details>':'')+'<div class="tabs" role="tablist" aria-label="Trip view">'+['plan', 'packing', 'tips'].map(function(t) {
            return btn(t[0].toUpperCase()+t.slice(1), 'tab-'+t, '', 'role="tab" id="tabbtn-'+t+'" aria-controls="tab-content" tabindex="'+(state.tab===t?0:-1)+'" aria-selected="'+(state.tab===t)+'"');
        }).join('')+'</div><div id="tab-content" role="tabpanel" aria-labelledby="tabbtn-'+state.tab+'">'+(state.tab==='plan'?'<nav class="daynav" aria-label="Jump to day">'+p.days.map(function(d, i) {
            return'<a href="#day-'+i+'" data-testid="day-nav-'+i+'">Day '+(i+1)+' · '+dateLabel(d.date,  {
                weekday:'short'
            })+' '+dateLabel(d.date,  {
                day:'numeric'
            })+'</a>';
        }).join('')+'</nav>'+p.days.map(dayHTML).join(''):state.tab==='packing'?packingHTML():subheading('A little local knowledge', 'Useful notes, with a way back to the source.')+tipsHTML(p.tips)+'<p class="footer-note">Tips shown here link to their sources. Live social/review data comes later; real-data tips will show platform, link and retrieval date.</p>')+'</div><footer class="row" style="padding:25px 0">'+btn('Open packing list', 'open-packing', 'primary')+btn('Print / Save as PDF', 'print', 'outline')+btn('Copy as text', 'copy', 'outline')+btn('Share', 'share', 'outline')+'</footer><p class="footer-note">Made for your kind of travel. Saved on this device.</p></div>';
        planTiles();
        on('build-template', function() {
            state.answers.templateOahu=true;
            save();
            generate();
        });
        on('personalize-plan', function() {
            state.answers.personal=true;
            go('food');
        });
        ['plan', 'packing', 'tips'].forEach(function(t, ti, arr) {
            on('tab-'+t, function() {
                state.tab=t;
                planRender(false);
                get('tab-'+t).focus();
            });
            on('tab-'+t, function(e) {
                var k=e.key, n=null;
                if(k==='ArrowRight')n=arr[(ti+1)%arr.length];
                else if(k==='ArrowLeft')n=arr[(ti+arr.length-1)%arr.length];
                else if(k==='Home')n=arr[0];
                else if(k==='End')n=arr[arr.length-1];
                if(!n)return;
                e.preventDefault();
                state.tab=n;
                planRender(false);
                get('tab-'+n).focus();
            }, 'keydown');
        });
        if(state.tab==='plan'&&'IntersectionObserver' in window) {
            var navLinks=view.querySelectorAll('.daynav a');
            var io=new IntersectionObserver(function(entries) {
                entries.forEach(function(en) {
                    if(!en.isIntersecting)return;
                    var idx=en.target.id.replace('day-', '');
                    navLinks.forEach(function(l, li){ if(String(li)===idx)l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current'); });
                });
            }, { rootMargin:'-45% 0px -50% 0px' });
            view.querySelectorAll('section.day').forEach(function(sec){ io.observe(sec); });
        }
        on('open-packing', function() {
            state.tab='packing';
            planRender(false);
            get('tab-packing').focus();
        });
        on('change-answers', function() {
            go('dates');
        });
        on('reset-edits', function() {
            showModal('Reset my edits?', 'Your itinerary changes will be cleared. Your packing list, ticks, quantities and added items stay.', [ {
                text:'Reset edits', action:function() {
                    state.edits= {};
                    persistEdits();
                    planRender();
                }
            },  {
                text:'Cancel'
            }
            ]);
        });
        on('print', function() {
            window.print();
        });
        on('share', function() {
            showModal('Sharing is off in this demo.', 'Your answers and packing list stay on this device.', [ {
                text:'Got it'
            }
            ]);
        });
        on('copy', copyPlan);
        view.querySelectorAll('[data-pack-id]').forEach(function(el) {
            el.onchange=function() {
                tick(el.dataset.packId, el.checked);
            };
        });
        view.querySelectorAll('[data-relax],[data-rain]').forEach(function(el) {
            el.onchange=function() {
                var type=el.hasAttribute('data-relax')?'relax':'rain', idx=el.dataset[type], y=window.scrollY;
                state.edits[type]=state.edits[type]|| {};
                state.edits[type][idx]=el.checked;
                persistEdits();
                planRender(false);
                window.scrollTo(0, y);
            };
        });
        view.querySelectorAll('[data-remove]').forEach(function(el) {
            el.onclick=function() {
                var id=el.dataset.remove, y=window.scrollY;
                state.edits.removed=state.edits.removed||[];
                state.edits.removed.push(id);
                persistEdits();
                planRender(false);
                window.scrollTo(0, y);
                toast('Item removed. Undo is available for 8 seconds.', function() {
                    state.edits.removed=state.edits.removed.filter(function(x) {
                        return x!==id;
                    });
                    persistEdits();
                    planRender(false);
                });
            };
        });
        view.querySelectorAll('[data-edit]').forEach(function(el) {
            el.onclick=function() {
                editItem(el.dataset.edit);
            };
        });
        view.querySelectorAll('[data-swap]').forEach(function(el) {
            el.onclick=function() {
                var id=el.dataset.swap, it=state.plan.days.flatMap(function(d) {
                    return d.items;
                }).concat(Object.values(state.edits.added|| {}).flat()).find(function(x) {
                    return x.id===id;
                });
                if(!it)return;
                var edit=(state.edits.items|| {})[id]|| {};
                var dest=Engine.matchDestination(state.answers.destination);
                var choices=it.kind==='meal'?['Local café near your stay', 'Casual market meal near your stay']:it.kind==='travel'?['Pre-book a licensed transfer','Use local transit after checking the route']:['rest','stay'].indexOf(it.kind)>=0?['Downtime at your hotel','A gentle walk near your stay']:(dest.activities.scenic||dest.activities.relaxing);
                var next=choices[(choices.indexOf(edit.title)+1)%choices.length];
                showModal('Swap this stop?', esc(next)+' — template suggestion; confirm timing, availability and suitability.', [ {
                    text:'Use this suggestion', action:function() {
                        state.edits.items=state.edits.items|| {};
                        state.edits.items[id]=Object.assign( {}, edit,  {
                            swapped:true, title:next+(it.kind==='meal'&&state.answers.food.length?' · '+state.answers.food.join(', '):''), desc:'Your swapped template suggestion. Confirm local details before setting out.'
                        });
                        persistEdits();
                        planRender(false);
                    }
                },  {
                    text:'Cancel'
                }
                ]);
            };
        });
        view.querySelectorAll('[data-book]').forEach(function(el) {
            el.onclick=function() {
                showModal('Book this', 'Booking links are not live in this demo. In the full version this opens the operator’s booking page.', [ {
                    text:'Got it'
                },  {
                    text:'Add to my to-do', action:function() {
                        state.edits.todos=state.edits.todos||[];
                        if(state.edits.todos.indexOf(el.dataset.book)<0)state.edits.todos.push(el.dataset.book);
                        persistEdits();
                        toast('Added to your booking to-do.');
                    }
                }
                ]);
            };
        });
        view.querySelectorAll('[data-add-day]').forEach(function(el) {
            el.onclick=function() {
                addItem(Number(el.dataset.addDay));
            };
        });
        bindPacking();
        if(moveFocus!==false) {
            var h=document.getElementById('step-title');
            if(h)h.focus( {
                preventScroll:true
            });
        }
    }
    function editItem(id) {
        var it=state.plan.days.flatMap(function(d) {
            return d.items;
        }).concat(Object.values(state.edits.added|| {}).flat()).find(function(x) {
            return x.id===id;
        });
        if(!it)return;
        var edit=(state.edits.items|| {})[id]|| {};
        var div=document.getElementById('edit-'+id);
        div.innerHTML='<form data-testid="item-edit-form"><label>Time<input name="time" data-testid="edit-time" value="'+esc(edit.time||it.time)+'"></label><label>Note<textarea name="note" data-testid="edit-note">'+esc(edit.note||'')+'</textarea></label>'+btn('Save changes', 'edit-save', 'primary', 'type="submit"')+btn('Cancel', 'edit-cancel', '', 'type="button"')+'</form>';
        div.querySelector('input').focus();
        div.querySelector('form').onsubmit=function(e) {
            e.preventDefault();
            state.edits.items=state.edits.items|| {};
            state.edits.items[id]=Object.assign( {}, state.edits.items[id],  {
                time:div.querySelector('[name=time]').value, note:div.querySelector('[name=note]').value
            });
            persistEdits();
            var y=window.scrollY;
            planRender(false);
            window.scrollTo(0, y);
            toast('Item updated.');
        };
        div.querySelector('[data-testid=edit-cancel]').onclick=function() {
            div.innerHTML='';
        };
    }
    function addItem(day) {
        showForm('Add your own item', '<label>Item name<input name="title" required data-testid="add-title"></label><label>Time<input data-testid="add-time" name="time" placeholder="e.g., 3:00 PM"></label><label>Note<textarea name="note" data-testid="add-note"></textarea></label>', function(f) {
            state.edits.added=state.edits.added|| {};
            state.edits.added[day]=state.edits.added[day]||[];
            state.edits.added[day].push( {
                id:'custom-'+Date.now(), time:f.time.value||'Your time', kind:'activity', title:f.title.value, desc:f.note.value, bring:[], prep:[], sources:[]
            });
            persistEdits();
            planRender(false);
        });
    }
    function showForm(title, body, submit) {
        var previous=document.activeElement;
        dialog.onclose=function(){ if(previous&&previous.isConnected)previous.focus(); };
        dialog.innerHTML='<h2 id="dialog-title">'+title+'</h2><form>'+body+'<div class="row" style="margin-top:15px">'+btn('Add item', 'form-add', 'primary', 'type="submit"')+btn('Cancel', 'form-cancel', '', 'type="button"')+'</div></form>';
        dialog.showModal();
        dialog.querySelector('form').onsubmit=function(e) {
            e.preventDefault();
            submit(e.target.elements);
            dialog.close();
        };
        dialog.querySelector('[data-testid=form-cancel]').onclick=function() {
            dialog.close();
        };
    }
    function packingHTML() {
        var groups=packingGroups(), all=groups.flatMap(function(g) {
            return g.items;
        }), n=all.filter(function(it) {
            return state.packed[it.id];
        }).length;
        return subheading('A little preparation.<br>A lot more peace of mind.', 'Your packing list · '+all.length+' items')+'<p id="packing-status" aria-live="polite">Packed, '+n+' of '+all.length+(n===all.length?' — All packed. Have a great trip.':'')+'</p><div class="progress" id="packing-progress" role="progressbar" aria-label="Packing progress" aria-valuemin="0" aria-valuemax="'+all.length+'" aria-valuenow="'+n+'"><span style="width:'+(n/all.length*100)+'%"></span></div><div class="row"><label class="checkrow"><input type="checkbox" data-testid="hide-packed" '+(state.hidePacked?'checked':'')+'>Hide packed</label>'+btn('Reset ticks', 'reset-packing', 'outline')+'</div>'+groups.map(function(g, i) {
            return'<section class="card" style="margin-top:18px"><h2>'+esc(g.group)+'</h2>'+g.items.filter(function(it) {
                return!state.hidePacked||!state.packed[it.id];
            }).map(function(it) {
                return'<div class="checkrow"><input type="checkbox" data-testid="pack-item" data-pack-id="'+esc(it.id)+'" aria-label="Pack '+esc(it.name)+'" '+(state.packed[it.id]?'checked':'')+'><span>'+esc(it.name)+((it.from||[]).length?'<small>From: '+esc((Array.isArray(it.from)?it.from:[it.from]).join(' · '))+'</small>':'')+'</span><label><span class="muted">×</span><input type="number" min="1" max="99" value="'+it.qty+'" data-quantity="'+esc(it.id)+'" data-testid="pack-quantity" aria-label="Quantity for '+esc(it.name)+'"></label></div>';
            }).join('')+btn('+ Add your own item', 'packing-add', '', 'data-pack-group="'+i+'"')+'</section>';
        }).join('')+'<p class="footer-note">Saved on this device. Counts are suggestions. Change any number.</p>';
    }
    function bindPacking() {
        on('hide-packed', function(e) {
            state.hidePacked=e.target.checked;
            planRender(false);
        }, 'change');
        on('reset-packing', function() {
            showModal('Clear all ticks?', 'Your items stay.', [ {
                text:'Clear ticks', action:function() {
                    state.packed= {};
                    write(KEY+'packing:'+state.plan.id,  {});
                    planRender(false);
                }
            },  {
                text:'Cancel'
            }
            ]);
        });
        view.querySelectorAll('[data-quantity]').forEach(function(el) {
            el.onchange=function() {
                state.packMeta.quantities=state.packMeta.quantities|| {};
                var q=Math.max(1, Math.min(99, Number(el.value)||1));
                state.packMeta.quantities[el.dataset.quantity]=q;
                persistPackMeta();
                announce('Quantity updated to '+q+'.');
            };
        });
        view.querySelectorAll('[data-pack-group]').forEach(function(el) {
            el.onclick=function() {
                var group=packingGroups()[Number(el.dataset.packGroup)].group;
                showForm('Add to '+esc(group), '<label>Item name<input name="title" required data-testid="packing-name"></label><label>Quantity<input data-testid="packing-add-quantity" name="qty" type="number" min="1" max="99" value="1"></label>', function(f) {
                    state.packMeta.customPacking=state.packMeta.customPacking||[];
                    state.packMeta.customPacking.push( {
                        id:'pack-'+Date.now(), name:f.title.value, qty:Math.max(1, Number(f.qty.value)||1), group:group, from:[]
                    });
                    persistPackMeta();
                    planRender(false);
                });
            };
        });
    }
    function copyPlan() {
        var p=state.plan, text=p.title+'\n'+p.meta+'\n'+p.stay+'\n'+p.banner+'\n'+p.days.map(function(d) {
            return dateLabel(d.date)+' — '+d.theme+'\n'+d.items.filter(function(it) {
                return(state.edits.removed||[]).indexOf(it.id)<0;
            }).map(function(it) {
                var e=(state.edits.items|| {})[it.id]|| {};
                return(e.time||it.time)+' '+(e.title||it.title)+'\n'+(e.desc||it.desc)+(e.note?'\nNote: '+e.note:'');
            }).join('\n');
        }).join('\n\n');
        function fallback() {
            var ta=document.createElement('textarea');
            ta.value=text;
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                toast('Copied as text.');
            } catch(e) {
                showModal('Copy your plan', 'Select the text to copy it.', [ {
                    text:'Got it'
                }
                ]);
            }
            ta.remove();
        }
        if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function() {
            toast('Copied as text.');
        }).catch(fallback);
        else fallback();
    }
    function render() {
        if(state.screen==='credits')creditsScreen();
        else if(state.screen==='start')start();
        else if(steps.indexOf(state.screen)>=0||extra.indexOf(state.screen)>=0)question();
        else if(state.screen==='fork')fork();
        else if(state.screen==='recommendations')recommendations();
        else if(state.screen==='loading') {
            view.innerHTML='<section class="loading">'+heading('Planning your trip', 'A few thoughtful details make all the difference.')+'<div class="spinner"></div><p id="loading-line" aria-live="polite">Checking the weather for your dates…</p><small>This usually takes under 30 seconds.</small><p>'+btn('Cancel', 'cancel-plan', 'outline')+'</p></section>';
            on('cancel-plan', function() {
                activeGeneration++;
                go('fork');
            });
        } else if(state.screen==='plan')planRender();
        else start();
    }
    document.getElementById('photo-credits').onclick=function() {
        if(state.screen==='credits')return;
        state.creditsFrom=state.screen==='loading'?'fork':state.screen;
        go('credits');
    };
    document.getElementById('restart').onclick=function() {
        activeGeneration++;
        erase(KEY+'answers');
        erase(KEY+'lastTrip');
        state.answers=Object.assign( {}, defaults,  {
            ages:[], styles:[], food:[]
        });
        state.plan=null;
        state.excluded=[];
        state.recOffset=0;
        go('start');
    };
    document.querySelector('.logo').onclick=function(e) {
        e.preventDefault();
        go('start');
    };
    window.__gonow= {
        state:state, go:go
    };
    var last=read(KEY+'lastTrip', null);
    if(last&&state.answers.destination) {
        generate(true);
    } else go('start');
}
());
