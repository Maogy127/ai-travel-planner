(function() {
    'use strict';
  function travelIcon(t){ t=String(t||'').toLowerCase(); if(/uber|lyft|rideshare|taxi|ride/.test(t)) return ''+icon('transport')+''; if(/shuttle|bus|transit/.test(t)) return ''+icon('transport')+''; if(/walk/.test(t)) return ''+icon('who')+''; return ''+icon('transport')+''; }
    // Legacy pick IDs remain valid so saved builder keys never move.
    function isPickPlan(plan){return !!(plan&&(/^[a-z0-9-]+-picks-/.test(plan.id)||/^picks-/.test(plan.id)));}
    function isOahuPlan(plan){
        if(!plan)return false;
        if(plan.destinationId)return plan.destinationId==='oahu';
        if(plan.id==='oahu-demo-2026-11'||/^oahu-picks-/.test(plan.id))return true;
        // Before destination-aware IDs, only Oahu had a pick catalog.
        return !!(/^picks-/.test(plan.id)&&plan.days&&plan.days.some(function(d){return d.items.some(function(i){return !!i.pick;});}));
    }
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
        if(state&&state.shared&&!/gonow:(rank|view)$/.test(key))return;
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
        track:'together', mode:'trip', localCity:'', localLength:'half', bedtime:'22:30', wake:'06:30', diet:[], dietNotes:'', dayPaces:{}, travelers:[], level:'unsure', activities:[], origin:'', destination:'', unsure:false, start:'', end:'', flexible:false, length:5, month:11, budget:null, includeFlights:true, covers:['flights','hotel','food','activities','transport'], completed:[], who:'', ages:[], adults:2, kids:0, styles:[], food:[], allergies:'', pace:'Moderate', mustdos:'', stay:''
    };
    function normalizeAnswers(a){
        a=a&&typeof a==='object'&&!Array.isArray(a)?a:{};
        Object.keys(a).forEach(function(k){if(/^ages?(?:band|range|choice)/i.test(k))delete a[k];});
        a.ages=Array.isArray(a.ages)?a.ages.map(function(x){
            return (typeof x==='number'||typeof x==='string')&&String(x).trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=110?Number(x):'';
        }):[];
        if(a.track!=='each'&&a.track!=='together'){
            var people=a.travelers||[],first=(people[0]||{}).level||'unsure';
            var personal=people.some(function(t){return !!String(t.name||'').trim()&&!/^Traveler \d+$/.test(t.name)||!!t.level&&t.level!=='unsure'&&t.level!==first;});
            var records=read('gonow.checkin.v1',{});
            a.track=personal||Object.keys(records).some(function(date){return Object.keys(records[date]||{}).some(function(id){return /^traveler-[1-9]\d*$/.test(id)&&Object.keys(records[date][id]||{}).length>0;});})?'each':'together';
        }
        a.picks=a.picks||{activities:[],restaurants:[]};
        window.GoNowDiet.migrate(a);
        a.mode=a.mode==='local'?'local':'trip';
        a.styles=window.GoNowStyles.normalize(a.styles);
        if(!a.level)a.level=({'Easy':'gentle','Moderate':'active','Full-on':'athlete'})[a.pace]||'unsure';
        a.pace=({gentle:'Easy',active:'Moderate',athlete:'Full-on',unsure:'Moderate'})[a.level]||'Moderate';
        return a;
    }
    var state= {
        screen:'start', answers:Object.assign({}, defaults, normalizeAnswers(read(KEY+'answers',{}))), plan:null, tab:'plan', recOffset:0, excluded:[], edits: {}, packed: {}, packMeta: {}, hidePacked:false
    };
    if(!read(KEY+'answers',{}).covers&&state.answers.includeFlights===false)state.answers.covers=defaults.covers.filter(function(k){return k!=='flights';});
    var steps=['dates', 'budget', 'who', 'ages', 'style'], extra=['food', 'pace', 'musts'];
    function questionPages(){return state.answers.mode==='local'?['style','food','pace']:steps.concat(extra);}
    var reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
    document.documentElement.classList.toggle('reduce-motion', reduceMotion.matches);
    reduceMotion.addEventListener('change', function(e){document.documentElement.classList.toggle('reduce-motion',e.matches);});
    var flipNext=false, openTile='day-0';
    var activeGeneration=0, toastTimer, undoPending=false;
    function esc(s, keepEmoji) {
        var text=String(s==null?'':s);
        if(!keepEmoji)text=text.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu,'');
        return text.replace(/[&<>"']/g, function(c) {
            return {
                '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
            }
            [c];
        });
    }
    function save() {
        normalizeAnswers(state.answers);
        if(state.shared)return;
        write(KEY+'answers', state.answers);
        if(state.plan&&state.tripId&&['plan','draft','food','pace','musts'].includes(state.screen)){var trips=readTrips(), trip=trips.find(function(t){return t.id===state.tripId;});if(trip){trip.answers=cloneData(state.answers);writeTrips(trips);}}
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
        if(!credit) return '';
        var source=credit.source||'Pexels';
        return '<span class="image-label">'+icon('info')+' Photo: <a href="'+esc(credit.photoUrl)+'" target="_blank" rel="noopener">'+esc(credit.photographer)+'</a> / '+esc(source)+'</span>';
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
        view.innerHTML='<div class="shell">'+heading('Photo credits', 'Real photographs only. Destination photos are from Pexels. Activity photos are from Wikimedia Commons, each with the photographer and license. Stops without a verified picture are left without one.')+btn('← Back', 'credits-back', 'outline')+'<div class="credits-grid">'+window.PHOTO_CREDITS.map(function(c) {
            return'<article class="card credit-card">'+photo('images/'+c.id+'.jpg', c.alt)+'<h2>'+esc(c.alt)+'</h2><p>'+esc(c.photographer)+'</p><div class="row"><a href="'+esc(c.photoUrl)+'" target="_blank" rel="noopener">'+(c.source||'Source')+' ↗</a><a href="'+esc(c.licenseUrl)+'" target="_blank" rel="noopener">'+esc(c.license)+' ↗</a></div></article>';
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
        p.meta=Engine.dateRange(p.start||p.days[0].date,p.end||p.days[p.days.length-1].date)+' · '+p.days.length+' days · '+(state.answers.who||'Travelers').replace(/^./,function(c){return c.toUpperCase();})+' · Ages '+(state.answers.ages||[]).join(' & ');
        var image=dest.id==='custom'?'images/hero.jpg':'images/'+dest.id+'.jpg';
        var visual=state.answers.templateOahu&&dest.id==='oahu'?'':photo(image, p.title, 'banner-photo');
        if(visual){ var bid=image.split('/').pop().replace('.jpg',''); var bc=window.PHOTO_CREDITS.find(function(c){return c.id===bid;}); visual+='<div class="banner-credit">'+creditHTML(bc)+'</div>'; }
        return'<header class="plan-header">'+visual+'<div class="plan-title">'+(tripConfirmed(currentTrip())?'<div class="eyebrow">YOUR NEXT CHAPTER, ALL PLANNED</div>':'')+heading(esc(p.title), esc(p.meta))+'<p>'+icon('hotel')+' Staying: '+esc(p.stay)+'</p>'+hotelControls()+'<small class="local-times">Local times'+(dest.id==='oahu'?' · Hawaii Standard Time (HST)':'')+'</small><div class="row">'+btn('Change my answers', 'change-answers', '')+btn('Reset my edits', 'reset-edits', '')+trackToggle()+'</div></div></header>';
    }
    function hotelControls(){if(state.answers.mode==='local')return '';var d=Engine.matchDestination(state.answers.destination);return (state.answers.stayUnsure?'<p data-testid="stay-later-note">Planning around '+esc(window.GoNowJetlag.center(d))+" for now. Add your hotel later and we’ll re-plan around it.</p>":'')+'<button type="button" data-testid="trip-add-hotel">'+(state.answers.stayUnsure?'Add your hotel':'Edit your hotel')+'</button><form data-testid="trip-hotel-form" hidden><label>Hotel name<input data-testid="trip-hotel-name" value="'+esc(state.answers.stay)+'" required></label><button data-testid="trip-hotel-save">Save</button></form>';}
    function applyStay(){var name=state.answers.stayUnsure||!state.answers.stay?window.GoNowJetlag.center(Engine.matchDestination(state.answers.destination)):state.answers.stay;var old=state.plan.stay;state.plan.stay=name;window.DayBuilder.setStay(name);state.plan.days.forEach(function(d){if(!mergedPlan())d.items=window.DayBuilder.replanStay(d.items,old,name);d.items.forEach(function(it,i){['place','from','to','desc','title'].forEach(function(k){if(typeof it[k]==='string'&&old)it[k]=it[k].split(old).join(name);});if(it.kind==='stay')it.desc=name;if(i<d.items.length-1){var next=d.items[i+1];it.travelToNext='approx. '+window.DayBuilder.commuteMinutes(it.place||name,next.place||next.title)+' min from '+(it.kind==='stay'?name:it.place||it.title)+' — confirm route';}});});}
    function bindHotel(){on('track-toggle',function(){state.answers.track=eachPerson()?'together':'each';checkinSelected={};save();rememberTrip();render();});on('trip-add-hotel',function(){get('trip-hotel-form').hidden=false;get('trip-hotel-name').focus();});var form=get('trip-hotel-form');if(form)form.onsubmit=function(e){e.preventDefault();var name=get('trip-hotel-name').value.trim();if(!name)return;state.answers.stay=name;state.answers.stayUnsure=false;state.answers.hotelEdited=true;applyStay();save();rememberTrip();write(KEY+'lastTrip',{answers:state.answers});render();};}
    function planNotices(p) {
        var a=state.answers, html='';
        if(p.curatedMismatch)html+='<aside class="warning demo-notice" data-testid="curated-notice"><p>Curated Oahu demo · not tailored to you</p>'+btn('Use my answers instead', 'build-template', 'outline')+'</aside>';
        if(!a.personal&&!(a.picks&&a.picks.initialized))html+='<aside class="banner" data-testid="quick-notice">Quick plan — answer 3 more questions to personalize '+btn('Personalize my plan', 'personalize-plan', 'outline')+'</aside>';
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
    function toast(msg, undo) {
        clearTimeout(toastTimer);
        undoPending=!!undo;
        toastEl.innerHTML=esc(msg)+(undo?' <button data-testid="undo" style="color:white;text-decoration:underline">Undo</button>':'');
        toastEl.classList.toggle('plan-ready',msg==='Your plan is ready.');
        var ms=undo?8000:msg==='Your plan is ready.'?2500:3000;
        function hide() {
            toastEl.innerHTML='';
            toastEl.classList.remove('plan-ready');
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
        if(screen==='prep'&&!tripConfirmed(currentTrip()))screen=state.plan?'plan':'home';
        if(voiceCleanup){voiceCleanup();voiceCleanup=null;}
        clearFeelVoices();
        if(!undoPending) {
            clearTimeout(toastTimer);
            toastEl.innerHTML='';
        }
        if(!state.shared&&!fromHistory&&screen!=='loading') {
            try {
                if(history.state&&history.state.screen===screen)history.replaceState({screen:screen}, '', '#'+screen);
                else history.pushState({screen:screen}, '', '#'+screen);
            } catch(e) {}
        }
        if(state.screen==='loading'&&screen!=='plan')activeGeneration++;
        if(screen!=='pace')state.paceEditing=false;
        state.screen=screen;
        save();
        render();
        flipNext=false;
        window.scrollTo(0, 0);
        var title=document.getElementById('step-title');
        if(title)title.focus( {
            preventScroll:true
        });
    }
    window.addEventListener('popstate', function(e) {
        var target=e.state&&e.state.screen;
        if(!target)target='home';
        if((target==='plan'||target==='draft'||target==='prep')&&!state.plan)target='home';
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
        if(state.fromHome)a.destination=window.GoNowPlaces.normalize(a.destination).name;
        var combinedMode=!state.fromHome||window.GoNowPlaces.isJunk(a.destination);
        view.innerHTML='<div class="shell"><div class="start-grid"><section class="intro"><div class="eyebrow">MOVE YOUR WAY.</div>'+heading('Come home better than you left.', 'Beautifully planned days that make room for movement, calm and sleep.')+'<div class="form-stack"><div>'+(a.unsure?'<div class="row banner" style="margin:0">Surprise me ✓ '+btn('Change', 'start-change', '')+'</div>':'<label class="field-label" for="to">Where do you want to go?</label><label class="destination-label"><input id="to" data-testid="start-to" placeholder="City, region or country" value="'+esc(a.destination)+'"></label><div class="error" id="dest-error" role="alert"></div>'+btn("I'm not sure yet", 'start-unsure', 'outline full')+'<small>Tell us a few things and we’ll suggest three places.</small>')+'</div><div><label class="'+(combinedMode?'field-label':'sr-only')+'" data-topic="origin" for="from">'+(combinedMode?'Flying from':'Where are you flying from?')+'</label><input id="from" data-testid="start-from" placeholder="City or airport code" value="'+esc(a.origin)+'" autocomplete="off"><small>We use this to estimate flights.</small><div class="error" id="origin-error" role="alert"></div></div>'+btn('Next <span aria-hidden="true">↗</span>', 'start-next', 'primary full')+'</div><div class="demo"><div class="eyebrow">A LITTLE INSPIRATION</div><strong>Try the demo: Oahu, Nov 25–29</strong><p>Couple aged 18 & 19 · The Kahala Hotel & Resort</p>'+btn('Open the Oahu sample ↗', 'demo-oahu', 'outline full')+'</div><p class="footer-note">Free to use. Your answers stay on this device until you save.</p></section>'+photo('images/hero.jpg', 'A sunlit island coastline, an invitation to slow down', 'hero-photo', '<div class="photo-caption"><span class="eyebrow" style="color:white">YOUR NEXT CHAPTER</span><strong>Somewhere feels like you.</strong><span>We’ll help you find it.</span></div>')+'</div><div class="start-footer"><span>'+icon('style')+' Made for your kind of travel</span><span>Thoughtful plans, down to the little things</span><span>Always yours to change</span></div></div>';
        view.querySelector('.hero-photo').remove();
        view.querySelector('.start-grid').classList.add('origin-question');
        view.querySelector('.intro .eyebrow').remove();
        view.querySelector('.intro h1').textContent=combinedMode?'Plan your trip':'Where are you flying from?';
        var subtitle=view.querySelector('.intro h1 + p');if(subtitle)subtitle.remove();
        view.querySelector('.demo').remove();view.querySelector('.start-footer').remove();

        bindWellness();
        if(get('start-to'))setupVoice('start-to','start-');
        var destinationInput=get('start-to');if(destinationInput&&state.fromHome&&!window.GoNowPlaces.isJunk(a.destination)){var destBlock=destinationInput.closest('.form-stack>div');destBlock.innerHTML='<div class="origin-destination">Trip to '+esc(a.destination)+' · '+btn('Edit destination','edit-destination','text-button')+'</div><div id="dest-error" class="error" role="alert"></div>';on('edit-destination',function(){go('home');});}
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
            a.origin=window.GoNowPlaces.normalize(a.origin).name;
            a.destination=window.GoNowPlaces.normalize(a.destination).name;
            get('start-from').value=a.origin;
            if(get('start-to'))get('start-to').value=a.destination;
            ['origin','dest'].forEach(function(id){var error=document.getElementById(id+'-error');if(error)error.textContent='';});
            get('start-from').removeAttribute('aria-invalid');
            if(get('start-to'))get('start-to').removeAttribute('aria-invalid');
            save();
            if(window.GoNowPlaces.isJunk(a.origin)) {
                document.getElementById('origin-error').textContent="Enter a city or airport code.";
                get('start-from').setAttribute('aria-invalid', 'true');
                valid=false;
            }
            if(!a.unsure&&!a.destination.trim()) {
                document.getElementById('dest-error').textContent='Add a city, region or country, or choose “I’m not sure yet”.';
                if(get('start-to'))get('start-to').setAttribute('aria-invalid', 'true');
                valid=false;
            } else if(!a.unsure&&window.GoNowPlaces.isJunk(a.destination)) {
                document.getElementById('dest-error').textContent='Enter a city or airport code.';
                if(get('start-to'))get('start-to').setAttribute('aria-invalid', 'true');
                valid=false;
            }
            if(valid){flipNext=true;go('dates');}
        });
        on('demo-oahu', demo);
    }
    var openingDemo=false;
    function demo() {
        openingDemo=true;
        archiveTrip();
        erase('gonow:daybuilder:oahu-demo-2026-11');
        erase(KEY+'edits:oahu-demo-2026-11');
        erase(KEY+'packing:oahu-demo-2026-11');
        state.viewing='live';
        newTripFlow=false;
        state.tripId=null;
        state.answers=Object.assign( {}, defaults,  {
            level:state.answers.level, activities:state.answers.activities, origin:'Los Angeles (LAX)', destination:'Oahu', unsure:false, start:'2026-11-25', end:'2026-11-29', budget:6000, budgetChoice:'5000+', who:'couple', ages:[18, 19], styles:['hotel', 'scenic'], mustdos:'Diamond Head, Kualoa Ranch, intro dive, parasailing, birthday dinner 11/26 7:30 PM, Black Friday shopping', stay:'The Kahala Hotel & Resort', personal:true
        });
        save();
        generate();
    }
    var TRIPS='gonow:trips';
    function readTrips(){try{var list=JSON.parse(localStorage.getItem(TRIPS));return Array.isArray(list)?list.filter(function(t){return t&&typeof t==='object'&&typeof t.id==='string';}):[];}catch(e){return [];}}
    function writeTrips(list){try{localStorage.setItem(TRIPS, JSON.stringify(list));}catch(e){}}
    function cloneData(value){return JSON.parse(JSON.stringify(value||null));}
    function prepTripKey(){return state.shared?'shared:'+state.plan.id+':'+location.hash:(state.tripId||state.plan.id);}
    function currentTrip(){return readTrips().find(function(t){return t.id===state.tripId;})||null;}
    function storedDraftExport(){
        if(!state.plan||!window.DayBuilder)return null;
        try{
            var raw=JSON.parse(localStorage.getItem('gonow:daybuilder:'+state.plan.id))||{};
            return window.DayBuilder.exportDays(raw.days||{}, raw.flightTime||'');
        }catch(e){return null;}
    }
    function draftDirty(){
        var trip=currentTrip();
        if(!trip||!trip.snapshot)return false;
        var builderSame=JSON.stringify(storedDraftExport())===JSON.stringify(trip.snapshot.builder||null);
        var editsSame=JSON.stringify(state.edits||{})===JSON.stringify(trip.snapshot.edits||{});
        return !(builderSame&&editsSame);
    }
    function weatherBlock(){
        var start=state.answers.start||(state.plan&&state.plan.start)||'';
        var inWindow=false;
        if(/^\d{4}-\d{2}-\d{2}$/.test(start)){
            var now=new Date(); now.setHours(12,0,0,0);
            var when=new Date(start+'T12:00:00');
            var ahead=(when-now)/86400000;
            inWindow=ahead>=-1&&ahead<=15;
        }
        var seasonal=(state.plan&&state.plan.weather&&state.plan.weather.text)||'Seasonal conditions were not researched for these dates.';
        if(!inWindow){
            return {kind:'seasonal', label:'Seasonal typical conditions, not a forecast. These dates are outside the live forecast window, so no daily forecast numbers are shown.', text:seasonal};
        }
        return {kind:'forecast', label:'These dates are inside the live forecast window. A forecast is stored only after it loads. If it does not load, no daily numbers are invented.', text:''};
    }
    function tripConfirmed(trip){return !!(trip&&(trip.confirmed===true||trip.snapshot));}
    function confirmTrip(){
        rememberTrip();
        var list=readTrips(),trip=list.find(function(t){return t.id===state.tripId;});
        if(!trip)return;
        trip.confirmed=true;
        trip.snapshot={builder:window.DayBuilder?window.DayBuilder.exportState():null, edits:cloneData(state.edits), packed:cloneData(state.packed), at:new Date().toISOString(), weather:weatherBlock()};
        writeTrips(list);
        go('prep');
        announce('Plan confirmed. Trip prep is ready.');
    }
    function rememberTrip(){
        if(!state.plan||state.shared)return;
        var list=readTrips();
        var trip=list.find(function(t){return t.id===state.tripId;});
        if(!trip){
            state.tripId=state.tripId||'trip-'+Date.now().toString(36);
            trip={id:state.tripId, snapshot:null};
            list.unshift(trip);
        }
        trip.destination=state.answers.destination||state.plan.title;
        trip.start=state.answers.start||state.plan.start||'';
        trip.end=state.answers.end||state.plan.end||'';
        trip.title=state.plan.title;
        trip.plan=cloneData(state.plan);
        trip.timeZone=Engine.matchDestination(state.answers.destination).tz||'UTC';
        trip.prepLeft=prepRemaining();
        trip.planId=state.plan.id;
        trip.answers=cloneData(state.answers);
        writeTrips(list);write(KEY+'activeTrip',state.tripId);write(KEY+'activeTripView',state.viewing==='finished'?'finished':'plan');
    }
    function migrateLegacyTrip(){
        try {
        var answers=read(KEY+'answers', null);
        var last=read(KEY+'lastTrip', null);
        if(!answers||!answers.destination||state.shared)return;
        var list=readTrips();
        if(localStorage.getItem(TRIPS)!==null)return;
        list.push({id:'legacy-'+String(answers.destination).toLowerCase().replace(/\s+/g,'-'), legacy:true, destination:answers.destination, start:answers.start||'', end:answers.end||'', title:answers.destination, planId:(last&&last.id)||'', answers:answers, snapshot:last&&last.id?{builder:null,edits:read(KEY+'edits:'+last.id,{}),packed:read(KEY+'packing:'+last.id,{}),at:''}:null});
        writeTrips(list);
        state.tripId=list[0].id;
        } catch(e) {}
    }
    function archiveTrip(){
        if(!state.tripId||!state.plan||state.shared)return;
        var list=readTrips(),t=list.find(function(t){return t.id===state.tripId;});
        if(t){t.packed=cloneData(state.packed);if(state.viewing!=='finished'){t.draftEdits=cloneData(state.edits);t.builder=read('gonow:daybuilder:'+state.plan.id,{});}writeTrips(list);}
    }
    function openSaved(id, mode){
        archiveTrip();
        var trip=readTrips().find(function(t){return t.id===id;});
        if(!trip)return;
        if(trip.builder&&read(KEY+'activeTrip',null)!==id)write('gonow:daybuilder:'+trip.planId,trip.builder);
        if(trip.draftEdits&&read(KEY+'activeTrip',null)!==id)write(KEY+'edits:'+trip.planId,trip.draftEdits);
        if(trip.packed&&read(KEY+'activeTrip',null)!==id)write(KEY+'packing:'+trip.planId,trip.packed);
        state.tripId=id;write(KEY+'activeTrip',id);write(KEY+'activeTripView',mode==='finished'?'finished':'plan');
        state.answers=Object.assign({}, defaults, normalizeAnswers(trip.answers||{}));
        save();
        state.viewing=mode==='finished'?'finished':'live';
        if(mode==='finished'&&!trip.snapshot)return;
        state.afterPlan=mode==='draft'?'draft':mode==='prep'&&tripConfirmed(trip)?'prep':'plan';
        if(trip.plan)showPlan(cloneData(trip.plan),true);else generate(true);
    }
    function wellnessPicker(){
        var a=state.answers;
        return '<fieldset data-topic="pace" data-testid="pace-picker"><legend>What pace feels right for you?</legend><p class="muted">Change it any time.</p><div class="pace-options">'+[['gentle','Gentle','Easy walks, stretching, yoga and meditation.'],['active','Active','Jogs, hikes and classes a few times a week.'],['athlete','Athlete','Long runs, rides and strength sessions.'],['unsure',"Not sure? We&#39;ll adjust",'We will start in the middle.']].map(function(o){return '<label class="pace-option"><input type="radio" name="wellness-level" data-testid="pace-option" data-value="'+o[0]+'" value="'+o[0]+'" '+(a.level===o[0]?'checked':'')+'><span><strong>'+o[1]+'</strong><small>'+o[2]+'</small></span></label>';}).join('')+'</div></fieldset><fieldset data-topic="activities"><legend>What would you love to do?</legend><div class="activity-chips">'+['Walking','Pilates','Yoga','Meditation','Running','Hiking','Cycling','Strength','Swimming'].map(function(name){return '<button type="button" data-testid="activity-chip" data-value="'+name.toLowerCase()+'" aria-pressed="'+(a.activities||[]).includes(name.toLowerCase())+'">'+name+'</button>';}).join('')+'</div></fieldset>';
    }
    function bindWellness(){
        view.querySelectorAll('[data-testid=pace-option]').forEach(function(el){el.onchange=function(){state.answers.level=el.value;save();};});
        view.querySelectorAll('[data-testid=activity-chip]').forEach(function(el){el.onclick=function(){var values=state.answers.activities||[];state.answers.activities=values.includes(el.dataset.value)?values.filter(function(v){return v!==el.dataset.value;}):values.concat(el.dataset.value);el.setAttribute('aria-pressed',String(state.answers.activities.includes(el.dataset.value)));save();};});
    }
    function modeSwitch(){
        return '<div class="mode-switch" role="radiogroup" aria-label="Planning mode" data-topic="mode" data-testid="mode-switch">'+[['trip','Plan a trip'],['local','Out in my city']].map(function(o){var selected=state.answers.mode===o[0];return '<button type="button" role="radio" data-testid="mode-option" data-value="'+o[0]+'" aria-checked="'+selected+'" tabindex="'+(selected?'0':'-1')+'">'+o[1]+'</button>';}).join('')+'</div>';
    }
    function localFields(){
        return '<p class="muted">A healthy day or weekend out, close to home</p><label class="field-label" data-topic="city" for="local-city">Which city?</label><label class="destination-label"><input id="local-city" data-testid="local-city" placeholder="City" required value="'+esc(state.answers.localCity)+'"></label><div id="local-city-error" role="alert"></div><fieldset data-topic="length" data-testid="local-length"><legend>How long do you have?</legend><div class="local-length-options">'+[['half','Half day'],['full','Full day'],['weekend','Weekend']].map(function(o){return '<label><input type="radio" name="local-length" data-value="'+o[0]+'" value="'+o[0]+'" '+(state.answers.localLength===o[0]?'checked':'')+'>'+o[1]+'</label>';}).join('')+'</div></fieldset>'+btn('Start planning','local-start','primary');
    }
    function bindMode(){
        var options=Array.from(view.querySelectorAll('[data-testid=mode-option]'));
        options.forEach(function(b,i){b.onclick=function(){state.answers.mode=b.dataset.value;save();home();view.querySelector('[data-testid=mode-option][data-value="'+state.answers.mode+'"]').focus();};b.onkeydown=function(e){var next;if(['ArrowRight','ArrowDown'].includes(e.key))next=(i+1)%2;else if(['ArrowLeft','ArrowUp'].includes(e.key))next=(i+1)%2;else if(e.key==='Home')next=0;else if(e.key==='End')next=1;else return;e.preventDefault();options[next].click();};});
        if(state.answers.mode!=='local')return;
        on('local-city',function(e){state.answers.localCity=e.target.value;save();},'input');
        setupVoice('local-city','local-');
        view.querySelectorAll('input[name=local-length]').forEach(function(el){el.onchange=function(){state.answers.localLength=el.value;save();};});
        on('local-start',function(){if(!state.answers.localCity.trim()){get('local-city-error').textContent='Please enter your city.';get('local-city').focus();return;}go('style');});
    }
    function localPlan(){
        var plan=window.GoNowLocal.generate(state.answers,window.CATALOG);
        view.innerHTML='<section class="shell local-plan" data-testid="local-plan">'+heading('A little time for yourself.',esc(plan.city))+(plan.comingSoon?'<p data-testid="local-coming-soon">Local plans for '+esc(plan.city)+" are coming soon. Here's a starter day</p>":'<p>Ideas from our Oahu catalog. Check access and opening hours before you go.</p>')+plan.days.map(function(day){return '<section>'+(plan.days.length===1?'':'<h2>Day '+day.day+'</h2>')+day.blocks.map(function(b){return '<article class="card" data-testid="local-block"><time>'+esc(b.time)+'</time><h3>'+esc(b.title)+'</h3><p>'+esc(b.note)+'</p>'+(b.kind==='meal'?dietTag(b):'')+(b.source==='catalog'?'<small data-testid="local-source">From GoNow’s Oahu guide</small>':'')+'</article>';}).join('')+'</section>';}).join('')+btn('Change plan','local-change','outline')+'</section>';
        on('local-change',function(){go('home');});
    }
    var newTripFlow=false;
    function dashboard(trips){
        var override=new URLSearchParams(location.search).get('today');
        function prepCount(t){
            var plan=t.plan||(t.planId==='oahu-demo-2026-11'?window.OAHU_SAMPLE:null);
            if(!plan)return 0;
            var previous={plan:state.plan,answers:state.answers,tripId:state.tripId,packed:state.packed,edits:state.edits,viewing:state.viewing};
            try{state.plan=plan;state.answers=Object.assign({},defaults,t.answers||{});state.tripId=t.id;state.packed=t.packed||{};state.edits=t.snapshot&&t.snapshot.edits||t.draftEdits||{};state.viewing=t.snapshot?'finished':'draft';return prepRemaining();}finally{Object.assign(state,previous);}
        }
        function zone(t){return t.timeZone||Engine.matchDestination(t.destination||'').tz||'UTC';}
        function todayBlock(t,status){
            if(status.kind!=='progress')return '';
            var plan=t.plan||(t.planId==='oahu-demo-2026-11'?window.OAHU_SAMPLE:null),day=plan&&plan.days.find(function(d){return d.date===status.today;});
            if(!day)return '';
            var parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone(t),hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(function(p){return [p.type,p.value];}));
            var minutes=window.GoNowDashboard.parseToday(override)?0:Number(parts.hour)*60+Number(parts.minute);
            var builder=t.builder||t.snapshot&&t.snapshot.builder;
            var ringDays=plan.days.map(function(d){var stored=builder&&builder.days&&builder.days[d.date];if(!stored)return d;return {date:d.date,items:window.DayBuilder.reflow(stored,{flightTime:builder&&builder.flightTime}).items};});
            var dayIndex=plan.days.findIndex(function(d){return d.date===day.date;}),todayItems=ringDays[dayIndex].items,nextDay=ringDays[dayIndex+1];
            var next=todayItems.find(function(it){var n=it.start==null?parseClock(it.time):it.start;return n!==null&&n>=minutes;});
            var savedPlan=state.plan,savedAnswers=state.answers;state.plan=plan;state.answers=t.answers;
            var values=dayRingContext(day,todayItems,nextDay&&nextDay.items,ringDays).ringResult.values;var rings=window.GoNowRings.summary(values);state.plan=savedPlan;state.answers=savedAnswers;
            return '<section class="card today-block" data-testid="today-block"><h2>Today</h2><p>'+esc(dateLabel(day.date))+' · '+esc(day.theme||day.title||'Your day')+'</p><p>'+esc(rings)+'</p><p>'+esc(next?'Next · '+(next.start==null?next.time:window.DayBuilder.clock(next.start))+' · '+next.title:'No more scheduled activities today')+'</p><button data-open-trip="'+esc(t.id)+'" data-today="'+day.date+'">Open today</button></section>';
        }
        view.innerHTML='<div class="shell dashboard" data-testid="dashboard"><h1>Your trips</h1>'+btn('+ New trip','new-trip','primary')+trips.map(function(t){return todayBlock(t,window.GoNowDashboard.status(t,{today:override,timeZone:zone(t)}));}).join('')+'<div class="dashboard-grid">'+trips.map(function(t){var status=window.GoNowDashboard.status(t,{today:override,timeZone:zone(t)}),left=prepCount(t);return '<article class="card" data-testid="trip-card" data-trip="'+esc(t.id)+'"><span class="badge" data-testid="trip-status">'+esc(status.label)+'</span><h2><button class="trip-title" data-open-trip="'+esc(t.id)+'">'+esc(t.destination||t.title||'Trip')+'</button></h2><p>'+(t.start?esc(dateLabel(t.start))+(t.end?' – '+esc(dateLabel(t.end)):''):'Dates not set')+'</p>'+(tripConfirmed(t)?btn('Trip prep · '+(left===0?'All set':left+' left'),'card-trip-prep','outline','data-trip="'+esc(t.id)+'"'):'')+'<div class="trip-menu"><button type="button" data-trip-more aria-expanded="false" aria-label="More options for '+esc(t.destination||'trip')+'">⋯</button><div hidden>'+btn('Open','view-finished','outline','data-trip="'+esc(t.id)+'"')+btn('Edit draft','edit-draft','outline','data-trip="'+esc(t.id)+'"')+btn('Delete','delete-trip','outline','data-trip="'+esc(t.id)+'"')+'</div></div></article>';}).join('')+'</div></div>';
        view.querySelectorAll('[data-trip-more]').forEach(function(b){b.onclick=function(){var open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));b.nextElementSibling.hidden=!open;};});
        on('new-trip',function(){archiveTrip();newTripFlow=true;state.tripId=null;state.plan=null;state.answers=Object.assign({},defaults,{level:state.answers.level,activities:(state.answers.activities||[]).slice()});home();});
        function open(id){var t=trips.find(function(t){return t.id===id;});newTripFlow=false;openSaved(id,t.snapshot?'plan':'draft');}
        view.querySelectorAll('[data-open-trip]').forEach(function(b){b.onclick=function(){open(b.dataset.openTrip);if(b.dataset.today&&window.DayBuilder)window.DayBuilder.selectDay(b.dataset.today,false);};});
        view.querySelectorAll('[data-testid=view-finished]').forEach(function(b){b.onclick=function(){var t=trips.find(function(t){return t.id===b.dataset.trip;});newTripFlow=false;openSaved(t.id,t.snapshot?'finished':'draft');};});
        view.querySelectorAll('[data-testid=card-trip-prep]').forEach(function(b){b.onclick=function(){newTripFlow=false;openSaved(b.dataset.trip,'prep');};});
        view.querySelectorAll('[data-testid=edit-draft]').forEach(function(b){b.onclick=function(){newTripFlow=false;openSaved(b.dataset.trip,'draft');};});
        view.querySelectorAll('[data-testid=delete-trip]').forEach(function(b){b.onclick=function(){var t=trips.find(function(t){return t.id===b.dataset.trip;}),dialog=document.createElement('dialog');dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-labelledby','delete-trip-title');dialog.innerHTML='<h2 id="delete-trip-title">Delete your '+esc(t.destination||t.title||'')+' trip?</h2><p>This removes it from this device.</p><button data-cancel>Cancel</button><button data-delete>Delete</button>';document.body.append(dialog);function close(){dialog.close();dialog.remove();if(b.isConnected)b.focus();}dialog.querySelector('[data-cancel]').onclick=close;dialog.oncancel=function(e){e.preventDefault();close();};dialog.querySelector('[data-delete]').onclick=function(){var remaining=readTrips().filter(function(x){return x.id!==t.id;});writeTrips(remaining);var records=read('gonow.prep.v1',{});delete records[t.id];write('gonow.prep.v1',records);if(!remaining.some(function(x){return x.planId===t.planId;})&&t.planId){['daybuilder:','edits:','packing:','packing-meta:'].forEach(function(key){erase(KEY+key+t.planId);});}if(state.tripId===t.id){state.tripId=null;state.plan=null;state.answers=Object.assign({},defaults);erase(KEY+'activeTrip');}erase(KEY+'answers');erase(KEY+'lastTrip');close();home();var target=view.querySelector('h1');if(target){target.tabIndex=-1;target.focus();}};dialog.showModal();dialog.querySelector('[data-cancel]').focus();};});
    }
    function home(){
        archiveTrip();
        migrateLegacyTrip();
        var trips=readTrips();
        if(trips.length&&!newTripFlow){dashboard(trips);return;}
        view.innerHTML='<div class="shell home-screen" data-testid="home-screen"><div class="wellness-hero"><section class="intro"><p class="eyebrow">WELLNESS IS PART OF THE JOURNEY</p>'+heading('Come home better than you left.','Beautifully planned days that make room for movement, calm and sleep.')+modeSwitch()+wellnessPicker()+(state.answers.mode==='local'?localFields():'<label class="field-label" data-topic="destination" for="home-destination">Where would you like to go?</label><label class="destination-label"><input id="home-destination" data-testid="home-destination" placeholder="City, region or country" value="'+esc(state.answers.destination)+'"></label><p id="home-dest-error" class="error" role="alert"></p>'+btn("I'm not sure yet",'home-unsure','outline')+'<div class="row">'+btn('Start planning','start-new-trip','primary')+'</div>')+'<p data-testid="storage-note" class="footer-note">Saved on this device only. There is no account and nothing is uploaded.</p></section>'+''+'</div>'+(trips.length?btn('← Your trips','back-dashboard','outline'):'<p class="muted">First visit — no saved trips yet.</p>')+'<div class="demo"><strong>A little inspiration: Oahu</strong><p>Nov 25–29 · couple, ages 18 and 19.</p>'+btn('Open the Oahu sample ↗','demo-oahu','outline')+'</div></div>';
        on('back-dashboard',function(){newTripFlow=false;home();});
        bindWellness();
        bindMode();
        on('home-destination',function(e){state.answers.destination=e.target.value;state.answers.unsure=false;save();},'input');
        if(get('home-destination'))setupVoice('home-destination','home-');
        function startFromHome(){state.tripId=null;state.viewing='live';state.fromHome=true;go('start');}
        on('home-unsure',function(){state.answers.unsure=true;startFromHome();});
        on('start-new-trip',function(){if(!state.answers.destination.trim()){document.getElementById('home-dest-error').textContent='Add a destination or choose “I’m not sure yet”.';get('home-destination').focus();return;}if(window.GoNowPlaces.isJunk(state.answers.destination)){document.getElementById('home-dest-error').textContent='Enter a city or airport code.';get('home-destination').setAttribute('aria-invalid','true');return;}state.answers.destination=window.GoNowPlaces.normalize(state.answers.destination).name;get('home-destination').value=state.answers.destination;save();startFromHome();});
        on('demo-oahu', demo);
    }
    function libraryEntries(){
        var entries=[];
        var ages=(Array.isArray(state.answers.ages)?state.answers.ages:[]).filter(function(x){return (typeof x==='number'||typeof x==='string')&&String(x).trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=110;}).map(Number);
        function rule(text, extra){return Object.assign({text:text, source:'', url:'', unconfirmed:false, optional:false, minAge:0}, extra||{});}
        if(window.DayBuilder&&state.plan&&state.plan.id==='oahu-demo-2026-11'){
            window.DayBuilder.trayItems().forEach(function(item){
                var rules=[];
                if(item.id==='chest-bar'||(item.tags||[]).indexOf('alcohol')>=0){
                    rules.push(rule('Alcohol service is 21+ in the United States. This stop is the drinks, so the age rule applies to the whole add.', {minAge:21, source:'23 U.S.C. § 158, national minimum drinking age', url:'https://www.law.cornell.edu/uscode/text/23/158'}));
                }
                if(item.id==='chest-0'){
                    rules.push(rule('The intro dive says no certification is required. Medical fitness is unconfirmed here.', {unconfirmed:true, source:'Dive Oʻahu', url:'https://www.diveoahu.com/tours-charters'}));
                }
                if(item.id==='chest-1'){
                    rules.push(rule('Operator age and weight limits are unconfirmed in our sources. Check with the operator.', {unconfirmed:true, source:'X-Treme Parasail', url:'https://www.xtremeparasail.com/parasailing'}));
                }
                if(/Diamond Head/.test(item.title)){
                    rules.push(rule('A reservation is required. No age minimum is stated for this party.', {source:'Diamond Head State Monument', url:'https://dlnr.hawaii.gov/dsp/parks/oahu/diamond-head-state-monument/'}));
                }
                if(/Pillbox|Lanikai/.test(item.title)){
                    rules.push(rule('The ridge is steep and can be slippery. No minimum age is stated in our source.', {unconfirmed:true, source:'Lanikai beach notes', url:'https://loveoahu.org/beaches/lanikai-beach/'}));
                }
                entries.push({id:item.id, chestId:item.id, kind:item.kind, desc:item.desc, tags:item.tags, title:item.title, place:item.place, duration:item.duration, estimate:true, sourceId:item.sourceId, rules:rules});
            });
            entries.push({id:'opt-dinner', kind:'meal', title:'Hotel dinner with optional drinks', place:'Kahala', duration:90, estimate:true, rules:[rule('Alcohol is 21+. The dinner itself is still available without it.', {optional:true, minAge:21, source:'23 U.S.C. § 158, national minimum drinking age', url:'https://www.law.cornell.edu/uscode/text/23/158'})]});
        }
        var dest=Engine.matchDestination(state.answers.destination||'');
        if(dest&&dest.activities){
            Object.keys(dest.activities).forEach(function(style){
                (dest.activities[style]||[]).forEach(function(title){
                    if(entries.some(function(e){return e.title===title;}))return;
                    entries.push({kind:style==='food'?'meal':'activity', id:'cat-'+dest.id+'-'+title.toLowerCase().replace(/[^a-z0-9]+/g,'-'), title:title, place:dest.name, duration:90, estimate:true, rules:[rule('Requirements for this catalog idea are unconfirmed. It is not a checked operator.', {unconfirmed:true, source:'GoNow destination catalog'})]});
                });
            });
        }
        if(state.plan&&isPickPlan(state.plan)&&pickCatalog())pickCatalog().activities.forEach(function(i){
            entries.push({id:i.id,sourceId:i.id,title:i.name,kind:'activity',place:i.area,duration:i.duration,desc:i.intro,tags:i.tags,closed:i.closed,hours:i.hours,rules:i.minAge?[rule('Minimum age '+i.minAge,{minAge:i.minAge})]:[]});
            ITEM_PHOTOS[i.id]=i.photo;
        });
        if(window.DayBuilder)window.DayBuilder.draftItems().forEach(function(item){
            var source=item.sourceId||item.id;
            if(entries.some(function(e){return e.sourceId===source&&e.title===item.title;}))return;
            entries.push({id:'draft-'+source, sourceId:source, kind:item.kind, desc:item.desc, tags:item.tags, title:item.title, place:item.place, duration:item.duration, estimate:item.estimate, rules:[]});
        });
        entries.forEach(function(entry){
            if(window.DayBuilder&&window.DayBuilder.operatingRules)Object.assign(entry,window.DayBuilder.operatingRules(entry));
            var blocked=null;
            (entry.rules||[]).forEach(function(r){
                if(r.optional||r.unconfirmed)return;
                if(r.minAge&&!ages.length){r.unconfirmed=true; r.text+=' Party ages are not entered, so this is not confirmed.'; return;}
                if(r.minAge&&ages.some(function(age){return age<r.minAge;}))blocked='Your party includes age '+ages.filter(function(age){return age<r.minAge;}).join(' and ')+'. '+r.text;
            });
            entry.blocked=blocked;
        });
        return entries;
    }
    function restrictionHTML(entry){
        return (entry.rules||[]).map(function(r){
            var tag=r.unconfirmed?'Unconfirmed':(r.optional?'Optional — does not block this outing':(entry.blocked?'Not a match':'Requirement'));
            return '<p class="library-rule" data-testid="activity-restriction"><strong>'+esc(tag)+'.</strong> '+esc(r.text)+(r.url?' <a href="'+esc(r.url)+'" target="_blank" rel="noopener">'+esc(r.source||'Source')+'</a>':(r.source?' <span>'+esc(r.source)+'</span>':''))+'</p>';
        }).join('');
    }
    function bindLibrary(aside){
        if(aside.dataset.bound)return;
        aside.dataset.bound='1';
        aside.addEventListener('input', function(e){if(e.target&&e.target.dataset.testid==='activity-search')renderLibraryResults(aside, e.target.value);});
        aside.addEventListener('click', function(e){
            var edit=e.target.closest('[data-testid=activity-edit-time], [data-testid=activity-time-choice]');
            if(edit){
                var timeCard=edit.closest('[data-testid=activity-result]');
                if(edit.dataset.testid==='activity-time-choice'){
                    window.DayBuilder.openTime(edit.dataset.date, edit.dataset.instance); return;
                }
                var timeEntry=libraryEntries().find(function(item){return item.id===timeCard.dataset.id;});
                var instances=window.DayBuilder.timeInstances(timeEntry.sourceId||timeEntry.id);
                if(instances.length===1)window.DayBuilder.openTime(instances[0].date,instances[0].id);
                else timeCard.querySelector('[data-time-choices]').innerHTML='<p>Choose a time:</p>'+instances.map(function(i){return '<button type="button" data-testid="activity-time-choice" data-date="'+esc(i.date)+'" data-instance="'+esc(i.id)+'">'+esc(dateLabel(i.date))+' · '+esc(i.time)+'</button>';}).join('');
                return;
            }
            var add=e.target.closest('[data-testid=activity-add], [data-testid=activity-add-again]');
            if(!add||add.disabled)return;
            var card=add.closest('[data-testid=activity-result]');
            var entry=libraryEntries().find(function(item){return item.id===card.dataset.id;});
            if(!entry||entry.blocked)return;
            var day=card.querySelector('[data-testid=activity-day]').value;
            var result=window.DayBuilder.addToDay(day, {origin:card,chestId:entry.chestId, sourceId:entry.sourceId||entry.id, title:entry.title, place:entry.place, duration:entry.duration, time:card.querySelector('[data-testid=activity-add-time]').value, closed:entry.closed, hours:entry.hours, rules:entry.rules, tags:entry.tags});
            // Successful adds repaint results; write feedback into the current row.
            var noteCard=Array.from(aside.querySelectorAll('[data-testid=activity-result]')).find(function(row){return row.dataset.id===entry.id;})||card;
            var note=noteCard.querySelector('[data-testid=activity-add-note]');
            if(note){note.textContent=result&&result.ok?'Added · booking still needed':(result&&result.reason)||'Could not add';var blocked=document.querySelector('[data-testid=blocked-message]');if(result&&!result.ok&&blocked)note.replaceChildren(blocked);}
        });
        aside.addEventListener('dragstart', function(e){
            var card=e.target.closest('[data-testid=activity-result]');
            if(!card||card.draggable===false){e.preventDefault();return;}
            e.dataTransfer.setData('text/gonow-activity', card.dataset.id);
        });

    }
    function renderLibraryResults(aside, query){
        var q=String(query||'').trim().toLowerCase();
        var all=window.GoNowDiet.rank(libraryEntries(),state.answers);
        var list=all.filter(function(entry){return q&&(entry.title+' '+entry.place).toLowerCase().indexOf(q)>=0;});
        var days=state.plan?state.plan.days:[];
        var dayOpts=days.map(function(d){return '<option value="'+esc(d.date)+'">'+esc(dateLabel(d.date))+'</option>';}).join('');
        var host=aside.querySelector('[data-testid=activity-results]');
        if(!q){host.innerHTML='';return;}
        if(!list.length){
            host.innerHTML='<p data-testid="activity-no-results">No sample places found</p>';
            return;
        }
        host.innerHTML=list.map(function(entry){
            var photoSrc=entry.sourceId&&ITEM_PHOTOS[entry.sourceId];
            var img=photoSrc?photo(photoSrc, entry.title, 'library-photo'):'<p class="activity-fallback">'+icon('info')+' '+esc(entry.title)+' in '+esc(entry.place)+'. No verified activity photo.</p>';
            var trayTitles={
                'Royal Hawaiian Center & International Market Place':'Waikiki shopping',
                'Kahala Beach “Jennie” palms — sunset photos':'Kahala sunset photos',
                'Waikiki Beach sunset with Diamond Head':'Waikiki sunset',
                'Lanikai Pillbox (Kaʻiwa Ridge) sunrise':'Lanikai Pillbox sunrise',
                'Hotel dinner with optional drinks':'Hotel dinner',
                'Land at HNL (Daniel K. Inouye Intl).':'Arrive at HNL',
                'Check in at The Kahala Hotel & Resort':'Kahala check-in',
                'Uber to Twin Fin, 2570 Kalākaua (Kualoa shuttle stop)':'Uber to Twin Fin',
                'Kualoa Ranch shuttle from Twin Fin':'Shuttle to Kualoa',
                'Free time at the Kahala (pool / beach downtime)':'Kahala free time',
                'Uber to Kewalo Basin (Dive Oʻahu)':'Uber to Kewalo Basin',
                'Uber from Ala Moana to The Kahala':'Uber to Kahala',
                'Uber Reserve to Kailua Beach Park':'Uber to Kailua Beach',
                'Uber to the Makapuʻu Lighthouse Trail lot':'Uber to Makapuʻu',
                'Free Kahala shuttle from International Market Place':'Kahala shuttle'
            };
            var shortTitle=trayTitles[entry.title]||entry.title.split(/ [—–] /)[0];
            var ageRule=(entry.rules||[]).find(function(r){return r.minAge&&!r.optional&&!r.unconfirmed;});
            var exists=window.DayBuilder.draftItems().some(function(i){return (i.sourceId||i.id)===(entry.sourceId||entry.id);});
            return '<article class="library-card" data-testid="activity-result" data-id="'+esc(entry.id)+'" draggable="'+(!entry.blocked)+'"><h3>'+esc(shortTitle)+'</h3>'+(entry.blocked?'<p data-testid="activity-age-notice">Requires age '+esc(ageRule?ageRule.minAge:21)+'+</p>':'')+'<details><summary>Details</summary>'+dietTag(entry)+(shortTitle!==entry.title?'<p>'+esc(entry.title)+'</p>':'')+img+restrictionHTML(entry)+'</details><label>Day <select data-testid="activity-day">'+dayOpts+'</select></label><label>Time (optional)<input type="time" data-testid="activity-add-time"></label><div class="library-actions"><button type="button" data-testid="activity-add"'+(entry.blocked?' disabled':'')+'>Add</button>'+(exists?'<button type="button" data-testid="activity-edit-time">Edit time</button><button type="button" data-testid="activity-add-again"'+(entry.blocked?' disabled':'')+'>Add again</button>':'')+'</div>'+(exists?'<div data-time-choices></div>':'')+'<p data-testid="activity-add-note"></p></article>';

        }).join('');
        host.querySelectorAll('[data-testid=activity-day]').forEach(function(select){select.value=window.DayBuilder.selectedDate();});
    }
    function ensureLibrary(aside){
        if(!aside.querySelector('[data-testid=activity-search]')){
            aside.insertAdjacentHTML('afterbegin','<div class="library-search"><p data-testid="search-honesty">Sample places for now</p><label>Search activities<input data-testid="activity-search" type="search" placeholder="Try dive, sunset, walk"></label><div data-testid="activity-results"></div></div>');
            bindLibrary(aside);
        }
        // The builder replaces the day's tray on every render. Keep its Schedule
        // controls ahead of search results so they remain reachable in the sheet.
        var tray=aside.querySelector('[data-testid=db-tray]');
        var results=aside.querySelector('[data-testid=activity-results]');
        if(tray)results.before(tray);
        renderLibraryResults(aside, aside.querySelector('[data-testid=activity-search]').value);

    }
    function closeActivityTray(){
        var tray=document.querySelector('.draft-screen .db-dock-tray.is-open');
        if(!tray)return;
        tray.classList.remove('is-open');
        var toggle=get('tray-toggle');
        toggle.setAttribute('aria-expanded','false');
        toggle.focus();
    }
    document.addEventListener('keydown', function(e){
        if(e.key!=='Escape' || document.querySelector('dialog[open]'))return;
        var timeEditorOpen=Array.from(document.querySelectorAll('[data-testid=activity-time-form]')).some(function(form){
            return form.getClientRects().length>0 && getComputedStyle(form).visibility!=='hidden';
        });
        if(timeEditorOpen)return;
        if(document.querySelector('.draft-screen .db-dock-tray.is-open')){
            e.preventDefault();
            e.stopImmediatePropagation();
            closeActivityTray();
        }
    }, true);
    function draftScreen(){
        if(!state.plan){go('home');return;}
        state.viewing='live';
        state.edits=read(KEY+'edits:'+state.plan.id, state.edits||{});
        var dirty=draftDirty();
        view.innerHTML='<div class="shell draft-screen" data-testid="draft-screen">'+heading('Draft', esc(state.plan.title))+'<p>'+esc(state.answers.destination||'')+' · '+esc(dateLabel(state.answers.start||state.plan.start))+' – '+esc(dateLabel(state.answers.end||state.plan.end))+'</p><p data-testid="storage-note">Saved on this device only. Edits stay in the draft until you generate.</p>'+(dirty?'<p class="banner" data-testid="changes-pending">Changes not yet generated</p>':'')+'<div class="row">'+btn('Generate my plan','generate-plan','primary')+btn('Activities','tray-toggle','outline','aria-expanded="false" aria-controls="activity-tray"')+btn('Home','draft-home','')+'</div><section class="db-root db-dock" data-testid="db-root" aria-label="Draft days"></section></div>';
        var db=view.querySelector('.db-root');
        var ctx=builderContext();
        ctx.plan=state.plan;
        ctx.dock=true;
        ctx.shared=false;
        ctx.initial=null;
        var previous=ctx.afterRender;
        ctx.afterRender=function(scope){
            if(previous)previous(scope);
            var aside=db.querySelector('.db-dock-tray');
            if(aside){
                ensureLibrary(aside);
                if(!aside.querySelector('[data-testid=tray-close]')){
                    var close=document.createElement('button');
                    close.type='button';
                    close.dataset.testid='tray-close';
                    close.textContent='Close activities';
                    close.addEventListener('click', closeActivityTray);
                    aside.prepend(close);
                }
            }
            if(draftDirty()){
                if(!view.querySelector('[data-testid=changes-pending]'))view.querySelector('.draft-screen').insertAdjacentHTML('afterbegin','<p class="banner" data-testid="changes-pending">Changes not yet generated</p>');
            }
        };
        window.DayBuilder.mount(db, ctx);

        db.addEventListener('dragover', function(e){if(e.target.closest('[data-testid=db-day-list]'))e.preventDefault();});
        db.addEventListener('drop', function(e){
            if(!e.target.closest('[data-testid=db-day-list]'))return;
            e.preventDefault();
            var entry=libraryEntries().find(function(i){return i.id===e.dataTransfer.getData('text/gonow-activity');});
            if(entry&&!entry.blocked)window.DayBuilder.addToDay(window.DayBuilder.selectedDate(),{origin:e.target.closest('[data-testid=db-day-list]'),chestId:entry.chestId,sourceId:entry.sourceId||entry.id,title:entry.title,place:entry.place,duration:entry.duration, closed:entry.closed, hours:entry.hours, rules:entry.rules, tags:entry.tags, schedule:true});
        });
        on('generate-plan', function(){
            var list=readTrips();
            var trip=list.find(function(t){return t.id===state.tripId;})||{id:state.tripId, snapshot:null};
            if(!list.some(function(t){return t.id===trip.id;}))list.unshift(trip);
            trip.confirmed=true;
            trip.snapshot={builder:window.DayBuilder?window.DayBuilder.exportState():null, edits:cloneData(state.edits), packed:cloneData(state.packed), at:new Date().toISOString(), weather:weatherBlock()};
            trip.destination=state.answers.destination||trip.destination;
            trip.start=state.answers.start||trip.start;
            trip.end=state.answers.end||trip.end;
            trip.planId=state.plan.id;
            trip.answers=cloneData(state.answers);
            writeTrips(list);
            state.viewing='finished';
            go('plan');
        });
        on('tray-toggle', function(){
            var aside=document.querySelector('.db-dock-tray');
            var open=!aside.classList.contains('is-open');
            aside.classList.toggle('is-open', open);
            get('tray-toggle').setAttribute('aria-expanded', String(open));
        });
        on('draft-home', function(){go('home');});
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
                return (typeof x==='number'||typeof x==='string')&&String(x).trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=110;
            });
        }
        if(s==='style')return a.styles.length>0;
        return true;
    }
    function updateContinue() {
        var el=get('q-continue');
        if(el)el.disabled=!validQuestion();
    }
    var voiceCleanup;
    function setupVoice(fieldId, prefix){
        prefix=prefix||'';
        function voiceGet(id){return get(prefix+id);}
        if(voiceCleanup)voiceCleanup();
        var field=get(fieldId||'mustdos'), Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
        field.closest('label').insertAdjacentHTML('afterend','<div class="voice-controls"><button type="button" data-testid="'+prefix+'voice-btn" aria-pressed="false" aria-label="Start voice input">Voice input</button><label>Language <select data-testid="'+prefix+'voice-lang"><option value="en-US">English</option><option value="zh-CN">中文</option></select></label><span data-testid="'+prefix+'voice-status" role="status" aria-live="polite"></span></div>');
        var button=voiceGet('voice-btn'), lang=voiceGet('voice-lang'), status=voiceGet('voice-status'), recognition, listening=false;
        var choice;try{choice=localStorage.getItem(KEY+'voice-lang');}catch(e){}
        lang.value=['en-US','zh-CN'].includes(choice)?choice:(navigator.language||'').toLowerCase().startsWith('zh')?'zh-CN':'en-US';
        lang.onchange=function(){try{localStorage.setItem(KEY+'voice-lang',lang.value);}catch(e){}};
        function reset(){listening=false;button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Start voice input');button.classList.remove('is-listening');button.textContent='Voice input';}
        voiceCleanup=function(){if(recognition){recognition.onresult=recognition.onerror=recognition.onend=null;recognition.abort();}reset();};
        if(!Recognition){button.disabled=true;status.outerHTML='<span data-testid="'+prefix+'voice-unsupported">Voice input needs Chrome, Edge or Safari.</span>';return;}
        button.onclick=function(){
            if(listening){recognition.stop();reset();status.textContent='Voice input stopped.';return;}
            recognition=new Recognition();recognition.lang=lang.value;recognition.interimResults=true;recognition.continuous=false;
            recognition.onresult=function(event){if(!field.isConnected)return;var interim=[];
                for(var i=event.resultIndex;i<event.results.length;i++){var result=event.results[i],text=result[0].transcript.trim();if(result.isFinal&&text){field.value+=(field.value.trim()?(recognition.lang==='zh-CN'?'，':', '):'')+text;field.dispatchEvent(new Event('input',{bubbles:true}));}else interim.push(text);}
                status.textContent=interim.join(' ')||'Voice input added.';
            };
            recognition.onerror=function(event){status.textContent=({'not-allowed':'Microphone permission was blocked.','no-speech':'No speech heard. Try again.',network:'Voice input network error. Try again.'})[event.error]||'Voice input could not start. Try again.';reset();};
            recognition.onend=function(){reset();if(status.textContent==='Listening…')status.textContent='Voice input ended.';};
            listening=true;button.setAttribute('aria-pressed','true');button.setAttribute('aria-label','Stop voice input');button.classList.add('is-listening');button.textContent='Listening… tap to stop';status.textContent='Listening…';
            try{recognition.start();}catch(e){reset();status.textContent='Voice input could not start. Try again.';}
        };
    }
    function question() {
        var a=state.answers, s=state.screen, index=steps.indexOf(s), isExtra=extra.indexOf(s)>=0, idx=questionPages().indexOf(s), total=questionPages().length;
        var copy= {
            dates:['When are you going?', 'Pick your travel dates. Weather and prices depend on them.'], budget:["What’s your budget?", 'Total for everyone traveling.'], who:["Who’s coming?", 'This shapes pace, rooms and activities.'], ages:[state.answers.who==='solo'?'How old are you?':'How old is everyone?', 'We check activity age limits.'], style:['What kind of trip do you want?', 'Pick up to two. A third pick swaps out your first.'], food:['Food that fits your day', "Pick any. We’ll plan meals near where you’re staying."], pace:[state.answers.mode==='local'?'Your day':'Your days', 'Make room for movement, rest and sleep.'], musts:['Anything we must include?', "Bookings, birthdays, places, or things to skip. We’ll fit them in."]
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
            content='<div class="options">'+[['solo', '<span aria-hidden="true">'+icon('who')+'</span> Solo', 'Just me'], ['couple', '<span aria-hidden="true">'+icon('who')+'</span> Couple', 'Two of us'], ['family', '<span aria-hidden="true">'+icon('who')+'</span> Family', 'With kids'], ['friends', '<span aria-hidden="true">'+icon('who')+'</span> Friends', 'A group of friends']].map(function(r) {
                return option(r[0], r[1], r[2], 'who');
            }).join('')+'</div>';
            if(a.who==='family'||a.who==='friends')content+='<div class="two"><label>Adults<input type="number" data-testid="adults" min="1" max="12" value="'+a.adults+'"></label><label>Kids<input type="number" data-testid="kids" min="0" max="12" value="'+a.kids+'"></label></div>';
            content+=trackChoice();
        } else if(s==='ages') {
            var count=a.who==='solo'?1:a.who==='couple'?2:Number(a.adults)+Number(a.kids);
            a.ages=Array.from({length:count},function(_,i){return a.ages[i]===undefined?'':a.ages[i];});
            content='<div class="two">'+Array.from( {
                length:count
            }, function(_, i) {
                return'<label>'+(a.who==='solo'?'Your age':'Traveler '+(i+1)+' age')+'<input type="number" min="0" max="110" data-testid="age-'+i+'" data-age="'+i+'" value="'+esc(a.ages[i]===undefined?'':a.ages[i])+'"></label>';
            }).join('')+'</div>';
        } else if(s==='style') {
            content='<div class="options style-options">'+window.GONOW_STYLES.map(function(r) {
                return option(r[0], '<span aria-hidden="true">'+icon(r[0])+'</span> '+esc(r[1]), esc(r[2]), 'styles', true);
            }).join('')+'</div><p id="style-limit" class="hint" aria-live="polite"></p>';
        } else if(s==='food') {
            content=foodQuestion();
        } else if(s==='pace') {
            content=paceSummary();
        } else {
            content='<label>Bookings, birthdays and places<textarea data-testid="mustdos" placeholder="e.g., birthday dinner on 11/26 at 7:30 PM">'+esc(a.mustdos)+'</textarea></label><div class="row">'+['Special occasion', 'Shopping', 'Photo spots', 'Water activity', 'A specific tour'].map(function(v, i) {
                return btn(v, 'must-chip-'+i, 'outline', 'data-chip="'+v+'"');
            }).join('')+'</div><label>Where are you staying?<input data-testid="stay" value="'+esc(a.stay)+'" '+(a.stayUnsure?'disabled aria-disabled="true"':'aria-disabled="false"')+'></label><button type="button" class="outline stay-pill" data-testid="stay-unsure" aria-pressed="'+!!a.stayUnsure+'">Not sure yet</button>';
        }
        if(s==='pace')content+=sleepQuestion();
        if(a.mode==='local'){if(s==='style')copy[0]='What kind of day do you want?';if(s==='food')copy[1]="Pick any. We’ll suggest places that fit.";}
        view.innerHTML='<section class="question" data-topic="'+({style:'styles',pace:'sleep'}[s]||s)+'"><p>Step '+(idx+1)+' of '+total+'</p><div class="progress" role="progressbar" aria-label="Step '+(idx+1)+' of '+total+'" aria-valuenow="'+(idx+1)+'" aria-valuemin="0" aria-valuemax="'+total+'"><span style="width:'+((idx+1)/total*100)+'%"></span></div>'+heading(copy[0], copy[1])+(s==='food'||s==='pace'?'':'<fieldset><legend'+(s==='ages'?' class="sr-only"':'')+'>'+({
            dates:'Travel dates', budget:'Total trip budget', who:'Travel group', ages:'Traveler ages', style:state.answers.mode==='local'?'Day styles':'Trip styles', food:'Food preferences', pace:'Your days', musts:'Your requests'
        }
        [s])+'</legend>')+content+(s==='food'||s==='pace'?'':'</fieldset>')+'<div class="qfooter">'+btn('← Back', 'q-back', '')+btn('Skip', 'q-skip', '')+btn(s==='musts'||(a.mode==='local'&&s==='pace')?'Build my plan':s==='style'&&a.unsure?'See my options':'Continue →', 'q-continue', 'primary', validQuestion()?'':'disabled')+'</div></section>';

        on('pace-summary-edit',function(){state.paceEditing=!state.paceEditing;question();});
        requestAnimationFrame(function(){
            var question=view.querySelector('.question'),footer=view.querySelector('.qfooter');
            if(question&&footer)question.style.setProperty('--qfooter-height',footer.getBoundingClientRect().height+'px');
        });
        journal(s);
        if(s==='musts')setupVoice();
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
                    if(key==='budgetChoice'||key==='who'||key==='track') {
                        save();
                        question();
                        var again=view.querySelector('input[name="'+key+'"][value="'+el.value+'"]');
                        if(again)again.focus({preventScroll:true});
                        if(key==='who'&&el.value!=='solo')requestAnimationFrame(function(){var track=view.querySelector('[data-testid=track-choice]');if(track)track.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('reduce-motion')?'auto':'smooth'});});
                        if(key!=='track')announce(key==='who'?'Travel group: '+el.value+'.':'Budget selected.');
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
        bindWellness();
        bindWellnessDetails();on('stay-unsure',function(){a.stayUnsure=!a.stayUnsure;if(a.stayUnsure)a.stay='';save();question();if(!a.stayUnsure)get('stay').focus();});
        ['month', 'length', 'adults', 'kids', 'mustdos', 'stay'].forEach(function(k) {
            on(k, function(e) {
                if(k==='month')a.monthSet=true;
                a[k]=['month', 'length', 'adults', 'kids'].indexOf(k)>=0?Math.max(k==='kids'?0:k==='length'?2:1, Math.min(k==='length'?10:12, Math.floor(Number(e.target.value)))):e.target.value;
                save();
                if(k==='adults'||k==='kids')a.ages=[];
                updateContinue();
            }, 'input');
            if(k==='adults'||k==='kids')on(k,function(){question();},'change');
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
        view.querySelectorAll('[data-chip]').forEach(function(el) {
            el.onclick=function() {
                a.mustdos+=(a.mustdos?', ':'')+el.dataset.chip;
                get('mustdos').value=a.mustdos;
                save();
            };
        });
        on('q-back', function() {
            var pages=questionPages(),at=pages.indexOf(s);go(at===0?(a.mode==='local'?'home':'start'):pages[at-1]);
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
                var n=a.who==='solo'?1:a.who==='couple'?2:Number(a.adults)+Number(a.kids);
                a.ages=Array(n).fill(25);
                if(a.kids)for(var k=a.adults; k<n; k++)a.ages[k]=10;
            }
            if(s==='style') {
                a.styles=[];
                a.styleSkipped=true;
            }
            nextQuestion(true);
        });
        on('q-continue', function(){nextQuestion(false);});
    }
    function nextQuestion(skipped) {
        if(!skipped&&validQuestion()&&(state.screen!=='food'||state.answers.foodLoves.length||state.answers.dietNeeds.length||state.answers.allergens.length)&&(state.screen!=='musts'||state.answers.mustdos.trim()||state.answers.stay.trim()))earn('Question: '+state.screen);
        state.answers.completed=Array.from(new Set((state.answers.completed||[]).concat(state.screen)));
        flipNext=true;
        save();
        var s=state.screen, i=steps.indexOf(s), j=extra.indexOf(s);
        if(state.answers.mode==='local'){var localPages=questionPages(),next=localPages[localPages.indexOf(s)+1];go(next||'local-plan');return;}
        if(i>=0) {
            if(i<steps.length-1)go(steps[i+1]);
            else go(state.answers.unsure?'recommendations':'fork');
        } else if(j<extra.length-1)go(extra[j+1]);
        else generate();
    }
    function icon(key){
        var paths={lock:'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4',unlock:'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0',dates:'M5 7h14v13H5z M8 4v6 M16 4v6 M5 12h14',budget:'M4 8c0-4 16-4 16 0s-16 4-16 0 M4 8v8c0 4 16 4 16 0V8 M4 12c0 4 16 4 16 0',who:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M2 20v-3c0-5 12-5 12 0v3 M16 5a3 3 0 0 1 0 6 M18 14c4 0 4 3 4 6',ages:'M6 3h12 M6 21h12 M8 3v5l8 8v5 M16 3v5l-8 8v5',style:'M12 2v20 M2 12h20 M16 8l-3 5-5 3 3-5z',flights:'M2 13l8-3V3l3-1 1 8 7 3v2l-7-1v5l3 2H7l3-2v-5l-8 1z',wandering:'M4 20c12 0-5-12 7-12 M11 8l-3-3 M11 8l-3 3 M18 3v6 M15 6h6',scenic:'M3 19l6-10 4 6 3-4 5 8z M16 5a2 2 0 1 0 4 0 2 2 0 0 0-4 0',culture:'M3 8l9-5 9 5z M5 10v8 M10 10v8 M14 10v8 M19 10v8 M3 21h18',nature:'M4 21h16 M12 21V4 M12 4C3 3 2 11 12 13 M12 8c9-4 11 4 0 8',hotel:'M3 20V8 M21 20V8 M3 15h18 M6 9h5v5H6z M13 9h5v5h-5z',food:'M5 3v7c0 3 6 3 6 0V3 M8 3v19 M19 3c-5 3-5 10 0 10V3v19',activities:'M3 6h18v4c-4 0-4 4 0 4v4H3v-4c4 0 4-4 0-4z',transport:'M3 18V11l3-6h12l3 6v7z M3 11h18 M6 18v3 M18 18v3 M6 14h2 M16 14h2',bring:'M6 8h12l2 13H4z M9 8V4h6v4 M8 13h8v5H8z',info:'M12 10v8 M12 6v1 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20'};
        return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" class="line-icon" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[key]||paths.style)+'"/></svg>';
    }
    function journal(s){
        var hints={dates:'Leave room for a little discovery.',budget:'Leave some room for the unexpected.',who:'Good company makes the journey.',ages:'A few details now mean fewer surprises later.',style:'Follow your curiosity.',food:'Leave space for a new favorite.',pace:'There’s no finish line here.',musts:'The little details can make the best memories.'};
        var page=view.querySelector('.question');
        page.insertAdjacentHTML('afterbegin','<div class="guide" data-testid="guide" aria-live="polite"><span>'+hints[s]+'</span></div>');
        if(s==='budget'){
            var covers=state.answers.covers||defaults.covers;
            var field=document.createElement('fieldset');field.className='covers';field.innerHTML='<legend>What does this budget cover?</legend><div class="covers-grid">'+Object.entries({flights:'Flights',hotel:'Hotel',food:'Food',activities:'Activities',transport:'Getting around (Uber/transit)'}).map(function(r){return '<label class="checkrow"><input type="checkbox" data-testid="cover-'+r[0]+'" value="'+r[0]+'" '+(covers.includes(r[0])?'checked':'')+'>'+icon(r[0])+'<span>'+r[1]+'</span></label>';}).join('')+'</div>';
            page.querySelector('.qfooter').before(field);
            field.onchange=function(){state.answers.covers=Array.from(field.querySelectorAll('input:checked')).map(function(e){return e.value;});state.answers.includeFlights=state.answers.covers.includes('flights');save();};
        }
    }
    function budgetHTML(){
        var p=state.plan,b=Engine.estimateCost(Object.assign({},state.answers,{includeFlights:true}),Engine.matchDestination(state.answers.destination)).breakdown, curated=p.id==='oahu-demo-2026-11';
        var amounts=curated?{flights:'Not researched yet',hotel:'Not researched yet',food:'Not researched yet',activities:'$830–950',transport:'$286–367 before tips'}:{flights:money(b.flights),hotel:money(b.stay),food:money(b.food),activities:money(b.activities),transport:money(b.localTransport)};
        return '<section class="card budget" data-testid="budget-buckets"><h2>Budget</h2><p>Rough estimates, not quotes. '+(curated?'For two.':'Based on the existing destination cost estimates.')+'</p>'+Object.entries({flights:'Flights',hotel:'Hotel',food:'Food',activities:'Activities',transport:'Getting around (Uber/transit)'}).map(function(r){return '<div class="bucket '+((state.answers.covers||defaults.covers).includes(r[0])?'included':'excluded')+'" data-testid="bucket-'+r[0]+'"><span class="bucket-icon">'+icon(r[0])+'</span><strong>'+r[1]+'</strong><span class="bucket-amount '+(/\d/.test(amounts[r[0]])?'':'bucket-unknown')+'">'+(/\d/.test(amounts[r[0]])?'approx. ':'')+esc(amounts[r[0]])+'</span><small data-testid="bucket-status">'+((state.answers.covers||defaults.covers).includes(r[0])?'Included in your budget':'Not included')+'</small></div>';}).join('')+(curated?'<p class="bucket-note">Flights, hotel and food weren’t researched for this demo — check prices when booking.</p>':'')+'</section>';
    }
    function prepRecord(){var all=read('gonow.prep.v1',{});var record=all[prepTripKey()]||{seen:false,checked:{}};record.checked=record.checked||{};Object.keys(state.packed||{}).forEach(function(id){if(record.checked['pack-'+id]===undefined)record.checked['pack-'+id]=!!state.packed[id];});prepTasks().forEach(function(t){if(t.legacyIds&&record.checked[t.id]===undefined)record.checked[t.id]=t.legacyIds.every(function(id){return !!record.checked[id];});});return record;}
    function savePrep(record){var list=readTrips(),t=list.find(function(t){return t.id===state.tripId;});if(t){t.prepLeft=prepTasks().filter(function(task){return task.group!=='pack'&&!record.checked[task.id];}).length;writeTrips(list);}var all=read('gonow.prep.v1',{});all[prepTripKey()]=record;write('gonow.prep.v1',all);}
    function normalizePrep(text){return String(text||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
    function prepTasks(){
        var tasks=[],seen=new Set(),a=state.answers||{},edits=state.edits||{};
        var trip=typeof currentTrip==='function'?currentTrip():null,rawDays=trip&&trip.builder&&trip.builder.days;
        if(state.viewing==='finished'&&trip&&trip.snapshot)rawDays=trip.snapshot.builder&&window.DayBuilder?window.DayBuilder.importForPlan(trip.snapshot.builder,state.plan).days:null;
        var originals=state.plan.days.flatMap(function(d){return d.items;});
        function add(id,text,kind,date){if(seen.has(id))return;seen.add(id);tasks.push({id:id,text:text,kind:kind,group:'before',date:date||''});}
        state.plan.days.forEach(function(d){
            var items=typeof dayModel==='function'?dayModel(d,state.plan.days.indexOf(d)).items:d.items;
            if(rawDays&&rawDays[d.date])items=rawDays[d.date].items.map(function(it){return Object.assign({},originals.find(function(o){return o.id===(it.sourceId||it.id);})||{},it);}).filter(function(it){return !(edits.removed||[]).includes(it.sourceId||it.id);});
            items.forEach(function(it){
                if(!it.bookable||it.booked||(edits.booked||[]).includes(it.id))return;
                var title=String(it.bookingLabel||it.title).replace(/\p{Extended_Pictographic}/gu,'').split(/ [—–] /)[0].trim();
                if(/Jurassic Adventure/i.test(it.title))title='Kualoa Jurassic Adventure';
                if(/intro dive/i.test(title))title='intro dive';
                if(/parasail/i.test(title))title='Waikiki parasail';
                var text=('Book '+title).split(/\s+/).slice(0,8).join(' ').trim();while(text.length>48)text=text.split(' ').slice(0,-1).join(' ');
                add('book-'+(it.sourceId||it.id),text,'book',d.date);
            });
        });
        var rides=tasks.filter(function(t){return /Book Uber Reserve/i.test(t.text);});
        if(rides.length){tasks=tasks.filter(function(t){return !rides.includes(t);});tasks.unshift({id:'book-uber-reserve',text:'Book '+rides.length+' Uber Reserve ride'+(rides.length===1?'':'s'),kind:'book',group:'before',legacyIds:rides.map(function(t){return t.id;}),rides:rides.map(function(t){return t.text.replace(/^Book /,'');})});}
        if(a.mode!=='local'){
            var destination=typeof Engine!=='undefined'?Engine.matchDestination(a.destination||state.plan.title):{country:'USA'};
            var origin=typeof Engine!=='undefined'&&Engine.originRegion?Engine.originRegion(a):'us';
            var originText=String(a.origin||'').toLowerCase();
            var originCountries={Japan:/tokyo|osaka|nrt|hnd|kix/, 'South Korea':/seoul|icn/,Taiwan:/taipei|tpe/,China:/beijing|pek|shanghai|pvg/,'Hong Kong':/hong kong|hkg/,Singapore:/singapore|sin/,UK:/london|lhr/,France:/paris|cdg/,Germany:/berlin|ber|frankfurt|fra/,Netherlands:/amsterdam|ams/,Spain:/madrid|mad/,Italy:/rome|fco/,Ireland:/dublin|dub/};
            var homeCountry=a.originCountry||(origin==='canada'?'Canada':/^us/.test(origin)?'USA':Object.keys(originCountries).find(function(country){return originCountries[country].test(originText);})||'');
            var international=a.international===true || !!(destination.country&&homeCountry&&destination.country!==homeCountry);
            if(international&&!packingGroups().some(function(g){return g.items.some(function(it){return /passport/i.test(it.id+' '+it.name);});}))add('action-id','Bring passport','id');
            add('action-insurance','Get travel insurance','insurance');
            if(international)add('action-visa','Check visa rules','visa');
        }
        return tasks.concat(packingGroups().flatMap(function(g){return g.items.map(function(it){return {id:'pack-'+it.id,text:it.name,group:'pack'};});}));
    }
    function prepRemaining(){var r=prepRecord();return prepTasks().filter(function(t){return t.group!=='pack'&&!r.checked[t.id];}).length;}
    function prepScreen(){
        state.screen='prep';if(toastEl.classList.contains('plan-ready')){clearTimeout(toastTimer);toastEl.innerHTML='';toastEl.classList.remove('plan-ready');}var r=prepRecord();r.seen=true;savePrep(r);
        var packing=packingHTML().replace(/<h2/g,'<h3').replace(/<\/h2>/g,'</h3>').replace(/data-testid="pack-item" data-pack-id="([^"]+)"/g,'data-testid="prep-item" data-prep-id="pack-$1" data-pack-id="$1"').replace(/<div class="checkrow"><input type="checkbox" data-testid="prep-item"/g,'<div class="checkrow" data-testid="pack-item"><input type="checkbox" data-testid="prep-item"');
        function tasks(){return prepTasks().filter(function(t){return t.group==='before';}).map(function(t){return '<label class="checkrow" data-action-kind="'+esc(t.kind)+'"><input type="checkbox" data-testid="prep-item" data-prep-id="'+esc(t.id)+'" '+(r.checked[t.id]?'checked':'')+'><span>'+esc(t.text)+'</span></label>'+(t.rides?'<details class="prep-rides"><summary>Ride details</summary>'+t.rides.map(function(ride){return '<p>'+esc(ride)+'</p>';}).join('')+'</details>':'')+(t.sources?sources(t.sources):'');}).join('');}
        view.innerHTML='<div class="shell" data-testid="trip-prep">'+'<h1 tabindex="-1">Trip prep</h1><section data-testid="prep-section"><h2>'+icon('budget')+' Budget</h2><p>Estimates</p><details><summary>Budget breakdown</summary>'+budgetHTML().replace('<h2>Budget</h2>','<h3>Estimates</h3>')+(state.plan.costs||[]).map(function(c){return '<p>'+esc(c.item)+' · '+esc(c.price)+sources(c.sources)+'</p>';}).join('')+'</details></section>' +(prepTasks().some(function(t){return t.group==='before';})?'<details data-testid="prep-section" id="trip-essentials"><summary data-testid="trip-essentials">Before you go · '+prepRemaining()+' to do</summary>'+tasks()+'</details>':'')+'<section data-testid="prep-section"><h2>'+icon('bring')+' What to bring</h2><div data-testid="packing-list">'+packing+'</div>'+'</section>'+btn('Continue to my plan','prep-continue','primary')+'</div>';

        view.querySelectorAll('[data-prep-id]').forEach(function(el){el.onchange=function(){var r=prepRecord();r.checked[el.dataset.prepId]=el.checked;if(el.dataset.prepId.startsWith('pack-')){state.packed[el.dataset.prepId.slice(5)]=el.checked;write(KEY+'packing:'+state.plan.id,state.packed);}savePrep(r);if(get('trip-prep-button'))get('trip-prep-button').textContent='Trip prep · '+(prepRemaining()?prepRemaining()+' left':'All set');var essentials=get('trip-essentials');if(essentials)essentials.textContent='Before you go · '+prepRemaining()+' to do';if(el.dataset.packId)tick(el.dataset.packId,el.checked);};});
        bindPacking();
        on('trip-prep-button',function(){view.querySelector('h1').focus();});
        on('prep-continue',function(){state.tab='plan';go('plan');rememberTrip();var h=view.querySelector('h1');if(h){h.tabIndex=-1;h.focus();}});
        view.querySelector('h1').focus();
    }
    function bindPlanPrep(){
        if(state.shared)return;
        var confirmed=tripConfirmed(currentTrip());
        view.querySelector('.plan-title').insertAdjacentHTML('afterbegin',confirmed?btn('Trip prep · '+(prepRemaining()?prepRemaining()+' left':'All set'),'trip-prep-button','prep-header'):'<div class="draft-confirm-row"><span class="badge">Draft</span>'+btn('Confirm plan','confirm-plan','primary')+'</div>');
        on('confirm-plan',confirmTrip);
        on('trip-prep-button',function(){go('prep');});
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
            }).join('')+'</ul><strong>About '+money(d.total)+' total</strong><p>for '+a.ages.length+', flights from '+esc(a.origin)+(a.includeFlights?' included':' excluded')+'</p>'+(a.budget&&d.total>a.budget?'<span class="badge">Over budget by about '+money(d.total-a.budget)+'</span>':'')+'<details><summary data-testid="disclosure">See breakdown</summary>'+breakdown(d.breakdown)+'</details><small>Rough estimate — approx., verify before booking</small>'+(d.originNote?'<p><small>'+d.originNote+'</small></p>':'')+'<div class="banner">'+icon('style')+' Typically '+d.weather.loF+'–'+d.weather.hiF+'°F ('+Math.round((d.weather.loF-32)*5/9)+'–'+Math.round((d.weather.hiF-32)*5/9)+'°C) in '+new Date(2026, (a.flexible?a.month:Number(a.start.split('-')[1]))-1, 1).toLocaleString('en',  {
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
        view.innerHTML='<section class="question"><div class="eyebrow">A PLAN THAT FEELS LIKE YOU</div>'+heading('Want it more personal?', 'How detailed should we go? You can always refine later.')+'<div class="card"><span class="badge">ABOUT 1 MINUTE</span><h2>Yes, answer 3 more</h2><p>Food, sleep and must-dos.</p>'+btn('Ask me →', 'fork-yes', 'primary full')+'</div><div class="card" style="margin-top:16px"><h2>No, pick places now</h2><p>Choose activities and food next.</p>'+btn('Pick places →', 'fork-no', 'outline full')+'</div><div class="qfooter">'+btn('← Back', 'fork-back', '')+'</div></section>';
        on('fork-back', function() {
            go(state.answers.unsure?'recommendations':'style');
        });
        on('fork-yes', function() {
            state.answers.personal=true;
            go('food');
        });
        on('fork-no', function() {
            state.answers.personal=false;
            state.answers.foodLoves=[];
            normalizeAnswers(state.answers);
            state.answers.mustdos='';
            state.answers.stay='';
            generate();
        });
    }
    function pickBackPage(){return ['fork'].concat(extra).includes(state.answers.pickBack)?state.answers.pickBack:(state.answers.personal?'musts':'fork');}
    function pickCatalog(){return window.GONOW_PICKS&&window.GONOW_PICKS[Engine.matchDestination(state.answers.destination).id];}
    var pickFilter='All',pickQuery='';
    function checkoutPicks(){
        state.answers.level=PickScheduler.pace(state.answers);
        var p=Engine.buildTemplatePlan(state.answers,Engine.matchDestination(state.answers.destination));
        var savedTrip=readTrips().find(function(t){return t.id===state.tripId;});
        var result=window.PickScheduler.schedule(Object.assign({},state.answers,{start:p.start,end:p.end,builderFlightTime:savedTrip&&savedTrip.builder&&savedTrip.builder.flightTime}),pickCatalog());
        state.viewing='live';
        var trips=readTrips(),trip=trips.find(function(t){return t.id===state.tripId;});
        if(trip&&!state.shared){trip.confirmed=false;trip.snapshot=null;writeTrips(trips);}
        result.days.forEach(function(d){var template=p.days.find(function(t){return t.date===d.date;});if(template&&template.car)d.car=template.car;});
        p.destinationId=Engine.matchDestination(state.answers.destination).id;p.id=p.destinationId+'-picks-'+p.start;p.days=result.days;p.unfit=result.unfit;p.bookingIssues=result.bookingIssues;p.curatedMismatch=false;p.banner='';
        p.start=result.days[0].date;p.end=result.days[result.days.length-1].date;p.flightTime=result.flightTime;
        p.meta=Engine.dateRange(p.start,p.end)+' · '+(state.answers.who||'Travelers')+' · Ages '+state.answers.ages.join(' & ');
        result.days.forEach(function(d){d.items.forEach(function(i){if(i.photo)ITEM_PHOTOS[i.id]=i.photo;});});
        showPlan(Engine.applyAgeRules(p,state.answers),false);
    }
    function pickScreen(){
        var food=state.screen==='pick-food',catalog=pickCatalog(),key=food?'restaurants':'activities';
        if(!catalog){generate();return;}
        var a=normalizeAnswers(state.answers);
        if(!a.picks.initialized){a.picks.activities=catalog.activities.filter(function(i){return PickCatalog.eligible(i,a)&&PickCatalog.must(i,a);}).map(function(i){return i.id;});a.picks.initialized=true;}
        catalog.restaurants.filter(function(i){return i.reservation;}).forEach(function(i){if(!a.picks.restaurants.includes(i.id))a.picks.restaurants.push(i.id);});save();
        var chips=food?['All','Breakfast','Lunch','Dinner','Snacks']:['All','Outdoors','Water','Culture','Shopping','Chill'];
        view.innerHTML='<section class="shell pick-screen" data-testid="'+state.screen+'"><h1>Pick '+(food?'restaurants':'activities')+'</h1><div class="pick-chips">'+chips.map(function(c){return '<button data-pick-filter="'+c+'" aria-pressed="'+(pickFilter===c)+'">'+c+'</button>';}).join('')+'</div><label class="pick-search">Search<input type="search" data-testid="pick-search" value="'+esc(pickQuery)+'"></label><p class="muted">Sample places for now</p><div id="pick-results"></div><div class="pick-footer"><button data-testid="pick-back">Back</button><span id="pick-count" aria-live="polite"></span>'+btn(food?'Check out':'Next: restaurants','pick-next','primary')+'</div></section>';
        function results(){
            var items=PickCatalog.filter(catalog[key],pickQuery,pickFilter,a),mixed=!!pickQuery||pickFilter!=='All';
            function cards(list){return '<div class="pick-grid">'+list.map(function(i){var selected=a.picks[key].includes(i.id),locked=!!i.reservation;return '<article class="pick-card '+(selected?'picked':'')+'" data-testid="pick-card" data-pick-id="'+i.id+'"><button class="pick-toggle" data-pick-toggle="'+i.id+'" aria-pressed="'+selected+'" aria-label="'+esc(i.name)+'" '+(locked?'aria-disabled="true"':'')+'><img src="'+i.photo+'" alt="'+esc(i.name)+'"><span><strong>'+esc(i.name)+'</strong><small>'+esc(locked&&food&&mixed&&i.section==='picks'?'🌿 GoNow Pick':food?i.cuisine+' · '+i.area+' · '+i.price:PickCatalog.duration(i.duration)+' · '+i.effort+' · '+i.price,true)+'</small>'+(locked?'<small>🔒 Booked '+new Date(i.reservation.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'})+' '+DayBuilder.clock(Number(i.reservation.time.slice(0,2))*60+Number(i.reservation.time.slice(3)))+'</small>':!food&&PickCatalog.must(i,a)?'<small>Must-do</small>':food&&mixed&&i.section==='picks'?'<small>🌿 GoNow Pick</small>':'')+'</span><b aria-hidden="true">'+(selected?'✓':'')+'</b></button><button class="pick-info" data-pick-info="'+i.id+'" aria-label="Details: '+esc(i.name)+'">ⓘ</button></article>';}).join('')+'</div>';}
            document.getElementById('pick-results').innerHTML=!items.length?'<p>No matches · try another word</p>':food&&!mixed?['popular','picks'].map(function(s){return '<h2>'+(s==='popular'?'Popular':'GoNow Picks')+'</h2>'+cards(items.filter(function(i){return i.section===s;}));}).join(''):cards(items);
            var count=a.picks[key].length,total=catalog.activities.filter(function(i){return a.picks.activities.includes(i.id);}).reduce(function(s,i){return s+i.duration;},0);
            document.getElementById('pick-count').textContent=food?'Picked '+count:PickCatalog.count(count,total,PickScheduler.capacity(a));
            view.querySelectorAll('[data-pick-toggle]').forEach(function(b){b.onclick=function(){var i=catalog[key].find(function(i){return i.id===b.dataset.pickToggle;});if(i.reservation)return;a.picks[key]=a.picks[key].includes(i.id)?a.picks[key].filter(function(id){return id!==i.id;}):a.picks[key].concat(i.id);save();results();};});
            view.querySelectorAll('[data-pick-info]').forEach(function(b){b.onclick=function(){var i=catalog[key].find(function(i){return i.id===b.dataset.pickInfo;}),sheet=document.getElementById('sheet'),credit=window.PHOTO_CREDITS.find(function(c){return i.photo==='images/'+c.id+'.jpg';});sheet.innerHTML='<button id="pick-close" aria-label="Close">×</button><img class="pick-detail-photo" src="'+i.photo+'" alt="'+esc(i.name)+'">'+(i.exampleDish?'<small>Example dish</small>':'')+(credit?'<small class="pick-photo-credit">Photo: <a href="'+credit.photoUrl+'" target="_blank" rel="noopener">'+esc(credit.photographer)+' · '+esc(credit.license)+'</a></small>':'')+'<h2>'+esc(i.name)+'</h2><p>'+esc(i.intro)+'</p><p>Hours · '+DayBuilder.clock(i.hours.open)+'–'+DayBuilder.clock(i.hours.close)+'</p>'+(i.closedDays&&i.closedDays.length?'<p>Closed · '+i.closedDays.map(function(d){return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d];}).join(', ')+'</p>':'')+(i.closedDates.length?'<p>Closed · '+esc(i.closedDates.join(', '))+'</p>':'')+'<p>How long · '+PickCatalog.duration(i.duration)+'</p><p>Price · '+esc(i.price)+'</p>'+(i.reservation?'<p>🔒 Booked '+esc(i.reservation.date+' '+i.reservation.time)+'</p>':'')+(food?'<h3>Sample menu</h3>'+i.sampleMenu.map(function(m){return '<p>'+esc(m.name)+' · '+esc(m.price)+'</p>';}).join(''):'')+'<h3>Example reviews</h3>'+i.sampleReviews.map(function(r){return '<p>'+r.stars+' ★ · '+esc(r.text)+'</p>';}).join('')+(!i.reservation?'<footer class="pick-detail-footer"><button class="'+(a.picks[key].includes(i.id)?'outline':'primary')+' full" id="pick-detail-toggle">'+(a.picks[key].includes(i.id)?'Remove':'Add')+'</button></footer>':'');sheet.setAttribute('data-testid','pick-details');sheet.showModal();document.getElementById('pick-close').onclick=function(){sheet.close();};if(document.getElementById('pick-detail-toggle'))document.getElementById('pick-detail-toggle').onclick=function(){view.querySelector('[data-pick-toggle="'+i.id+'"]').click();sheet.close();};};});
        }
        results();view.querySelectorAll('[data-pick-filter]').forEach(function(b){b.onclick=function(){pickFilter=b.dataset.pickFilter;pickScreen();};});view.querySelector('input').oninput=function(e){pickQuery=e.target.value;results();};
        on('pick-back',function(){pickFilter='All';pickQuery='';go(food?'pick-activities':pickBackPage());});on('pick-next',function(){pickFilter='All';pickQuery='';if(food)checkoutPicks();else go('pick-food');});
    }

    function generate(resume) {
        normalizeAnswers(state.answers);
        if(resume&&!openingDemo&&state.answers.picks&&state.answers.picks.initialized&&pickCatalog()){checkoutPicks();return;}
        if(!resume&&!openingDemo&&state.answers.mode!=='local'&&pickCatalog()){state.answers.pickBack=['fork'].concat(extra).includes(state.screen)?state.screen:pickBackPage();pickFilter='All';pickQuery='';go('pick-activities');return;}
        normalizeAnswers(state.answers);
        var generation=++activeGeneration;
        go('loading');
        var lines=['Checking the weather for your dates…', 'Finding places to stay…', 'Lining up meals near your hotel…', 'Ordering sights by the best time to go…', 'Adding what to bring…'], i=0;
        var timer=setInterval(function() {
            var el=document.getElementById('loading-line');
            if(el)el.textContent=lines[++i%lines.length];
        }, 2500);
        AI.generatePlan(state.answers, {fast:!!resume,demo:openingDemo}).then(function(plan) {
            clearInterval(timer);openingDemo=false;
            if(generation!==activeGeneration)return;
            try {
                showPlan(plan, resume);
            } catch(err) {
                console.error(err);
                failed();
            }
        }, function(err) {
            clearInterval(timer);openingDemo=false;
            if(generation!==activeGeneration)return;
            console.error(err);
            failed();
        });
    }
    function failed() {
        view.innerHTML='<section class="question">'+heading('Let’s try your plan again.', 'Your answers are saved.')+'<div class="row">'+btn('Try again', 'retry', 'primary')+btn('Edit answers', 'retry-edit', 'outline')+'</div></section>';
        on('retry', function(){ generate(); });
        on('retry-edit', function(){ go('dates'); });
    }
    function showPlan(plan, resume) {
            state.plan=plan;
            state.packed=state.shared?{}:read(KEY+'packing:'+plan.id,  {});
            state.packMeta=state.shared?{}:read(KEY+'packing-meta:'+plan.id,  {});
            if(state.viewing==='finished'){
                var frozen=currentTrip();
                state.edits=frozen&&frozen.snapshot?cloneData(frozen.snapshot.edits):{};
            } else {
                state.edits=state.shared?state.sharedEdits:read(KEY+'edits:'+plan.id, {});
            }
            if(state.viewing!=='finished'&&(state.edits.quantities||state.edits.customPacking)) {
                state.packMeta.quantities=Object.assign({}, state.edits.quantities||{}, state.packMeta.quantities||{});
                state.packMeta.customPacking=(state.packMeta.customPacking||[]).concat(state.edits.customPacking||[]);
                delete state.edits.quantities;
                delete state.edits.customPacking;
                write(KEY+'edits:'+plan.id, state.edits);
                write(KEY+'packing-meta:'+plan.id, state.packMeta);
            }
            state.tab='plan';
            write(KEY+'lastTrip',  {
                answers:state.answers,
                id:plan.id
            });
            if(!resume){earn('Finished a plan');if(extra.every(function(k){return (state.answers.completed||[]).includes(k);}))earn('Personalized food, pace and musts');}
            if(!state.tripId&&!state.shared)state.tripId='trip-'+Date.now().toString(36);
            var next=state.afterPlan||'plan';
            state.afterPlan=null;
            go(next);
            rememberTrip();
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
        groups.forEach(function(g){g.items=g.items.filter(function(it){return it.id!=='insurance'&&!/travel insurance details/i.test(it.name);});});
        return groups.filter(function(g){return g.items.length;});
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
        if(state.viewing==='finished')return;
        write(KEY+'edits:'+state.plan.id, state.edits);
    }
    function tick(id, value) {
        state.packed[id]=value;var r=prepRecord();r.checked['pack-'+id]=value;savePrep(r);var prepButton=get('trip-prep-button');if(prepButton)prepButton.textContent='Trip prep · '+(prepRemaining()?prepRemaining()+' left':'All set');
        write(KEY+'packing:'+state.plan.id, state.packed);
        document.querySelectorAll('[data-pack-id]').forEach(function(el) {
            if(el.dataset.packId===id)el.checked=value;
        });
        var all=packingGroups().flatMap(function(g) {
            return g.items;
        }), n=all.filter(function(it) {
            return state.packed[it.id];
        }).length;
        if(n>=all.length/2)earn('Packed at least half');
        var progress=document.getElementById('packing-progress');
        if(progress) {
            progress.setAttribute('aria-valuenow', n);
            progress.querySelector('span').style.width=(n/all.length*100)+'%';
        }
        var status=document.getElementById('packing-status');
        if(status)status.textContent='Packed '+n+' of '+all.length+(n===all.length?' — All packed. Have a great trip.':'');
        if(state.hidePacked&&state.screen==='prep')prepScreen();
    }
    function checkHTML(it, test) {
        return'<label class="checkrow"><input type="checkbox" data-testid="'+test+'" data-pack-id="'+esc(it.id)+'" '+(state.packed[it.id]?'checked':'')+'><span>'+esc(it.name)+' <small>×'+it.qty+'</small></span></label>';
    }
    function partnerLink(key, title, activity) {
        var a=state.answers, p=state.plan;
        var destination=isOahuPlan(p)?'Oahu, Hawaii':Engine.matchDestination(a.destination).name;
        // Only explicit airport choices are accepted; ambiguous city/region names fall back.
        var airports={'los angeles (lax)':'LAX','los angeles':'LAX','lax':'LAX','hnl':'HNL','honolulu':'HNL','oahu':'HNL','oahu, hawaii':'HNL'};
        var values={destination:destination,start:p.start||'',end:p.end||'',adults:a.who==='solo'?1:a.who==='couple'?2:(a.adults||2),
            // Search on the activity name only: drop "— details" and "(notes)" so partner searches stay useful.
            query:(title?String(title).split(/\s+[—–-]\s+/)[0].replace(/\s*\([^)]*\)/g,'').trim()+' ':'')+destination,
            fromIata:airports[(a.origin||'').trim().toLowerCase()],toIata:airports[destination.toLowerCase()],
            yymmdd_start:(p.start||'').slice(2).replace(/-/g,''),yymmdd_end:(p.end||'').slice(2).replace(/-/g,'')};
        return '<a class="partner-link" data-partner="'+key+'"'+(activity?' data-testid="book-this"':'')+' href="'+esc(window.gonowPartnerURL(key,values))+'" target="_blank" rel="noopener noreferrer sponsored">Search on '+esc(window.GONOW_AFFILIATES.partners[key].name)+' ↗</a>';
    }
    function bookLinksHTML() {
        return '<h2>Book this</h2><p data-testid="affiliate-disclosure">'+esc(window.GONOW_AFFILIATES.disclosure)+'</p><p>Hotels</p><div class="row">'+partnerLink('booking')+partnerLink('expedia')+'</div><p>Flights</p><div class="row">'+partnerLink('skyscanner')+'</div><p>Activities</p><div class="row">'+partnerLink('getyourguide','',true)+partnerLink('viator','',true)+'</div><small>Choose airports on Skyscanner if your route is unknown. Confirm dates and travelers on every partner site.</small>';
    }
    function itemHTML(it, dayIndex) {
        var edit=state.edits.items&&state.edits.items[it.id]|| {}, time=edit.time||it.time;
        return'<li data-item-id="'+esc(it.id)+'" id="item-'+esc(it.id)+'"><time>'+esc(time)+'</time>'+itemArticle(it)+'</li>';
    }
    // Real photos that show the stop itself (credited in credits.js).
    // Verified photographs of the stop itself. Generic island art is not reused here.
    var ITEM_PHOTOS={
        '2026-11-25-0':'images/activity-hnl.jpg',
        '2026-11-25-1':'images/activity-kahala-hotel.jpg',
        '2026-11-26-1':'images/activity-diamond-head-summit.jpg',
        '2026-11-26-5':'images/activity-kualoa.jpg',
        '2026-11-26-8':'images/activity-kahala-lagoon.jpg',
        '2026-11-26-11':'images/activity-halekulani.jpg',
        '2026-11-27-1':'images/activity-kewalo.jpg',
        '2026-11-28-1':'images/activity-lanikai.jpg',
        '2026-11-28-4':'images/activity-makapuu.jpg',
        '2026-11-28-9':'images/activity-waikiki-sunset.jpg',
        '2026-11-29-0':'images/activity-hnl.jpg'
    };
    function personalNotes(it){
        if(mergedPlan()||it.locked||!state.plan||!eachPerson())return '';
        var day=state.plan.days.find(function(d){return d.items.some(function(i){return i.id===it.id;});});
        if(!day)return '';
        return travelers().map(function(t,i){var c=window.GoNowCheckin.get('gonow.checkin.v1',day.date,personId(i)),alt=(c.alternatives||{})[it.id];return alt?'<small class="traveler-alternative" data-testid="traveler-alternative">'+esc(t.name)+': '+esc(alt.title.toLowerCase())+' instead</small>':'';}).join('');
    }
    function itemArticle(it, opts) {
        it=window.GoNowDiet.safeMeal(it,state.answers);
        opts=opts||{};
        if(it.pick&&it.photo)ITEM_PHOTOS[it.id]=it.photo;
        opts.photo=opts.photo&&['activity','meal','sight','rest'].includes(it.kind);
        var edit=state.edits.items&&state.edits.items[it.id]|| {}, title=edit.title||it.title, note=edit.note||'';
        if(edit.swapped)it=Object.assign( {}, it,  {
            sources:[], bring:[], prep:[], tips:[], price:'', bestTime:'', bookable:false
        });
        return'<article class="item '+esc(it.kind)+'">'+(['travel','flight'].includes(it.kind)?icon('transport'):'')+(opts.photo&&ITEM_PHOTOS[it.id]&&!edit.swapped&&!it.dietReplacement?photo(ITEM_PHOTOS[it.id], title, 'db-photo'):(opts.photo?'<p class="activity-fallback">'+icon('info')+' No verified activity photo.</p>':''))+'<div class="row" style="gap:5px">'+(it.requested?'<span class="badge">'+icon('info')+' You requested this</span>':'')+(it.bookable?'<span class="badge">Bookable</span>':'')+(it.kind==='meal'?'<span class="badge">Meal pick · '+(/hotel|Kahala|Plumeria|Veranda|Alan Wong|birthday dinner/i.test(title+' '+(it.desc||''))&&!/La Mer|Waikiki|Ala Moana|Kailua|Aunty Pat/i.test(title)?'Near hotel':'Local area')+'</span>':'')+'</div><h3>'+esc(title)+'</h3>'+(it.price?'<p><strong>approx. '+esc(it.price)+'</strong><small> · verify before booking</small></p>':'')+(it.bestTime?'<p><strong>Best at:</strong> '+esc(it.bestTime)+'</p>':'')+'<p>'+esc(edit.desc||it.desc)+'</p>'+dietTag(it)+personalNotes(it)+(note?'<p class="banner">Your note: '+esc(note, true)+'</p>':'')+sources(it.sources)+(it.bookable&&!/\bspa\b/i.test(title||'')?'<p class="partner-search"><small>Find/Book this · Secondary search options</small><br>'+partnerLink('getyourguide',title,true)+' · '+partnerLink('viator',title,true)+'</p>':'')+(it.tips?it.tips.map(function(t) {
            return'<a class="badge tip-chip" data-testid="activity-tip" href="'+esc(t.url)+'" target="_blank" rel="noopener noreferrer">'+esc(t.sourceType)+' · '+esc(t.text)+' ↗</a>';
        }).join(''):'')+(opts.noActions?'':'<div class="row"><details class="item-more"><summary aria-label="More actions for '+esc(title)+'">⋯</summary>'+(it.bookable?btn('Book this', 'item-book', 'outline', 'data-book="'+esc(it.id)+'"'):'')+btn('Edit', 'item-edit', '', 'data-edit="'+esc(it.id)+'"')+btn('Swap', 'item-swap', '', 'data-swap="'+esc(it.id)+'"')+btn('Remove', 'item-remove', '', 'data-remove="'+esc(it.id)+'"')+'</details>'+(opts.noLock?'':btn((edit.locked||it.locked)?icon('lock'):icon('unlock'),'item-lock','icon-button','aria-label="'+((edit.locked||it.locked)?'Unlock ':'Lock ')+esc(title)+'" data-lock="'+esc(it.id)+'"'))+'</div><div id="edit-'+esc(it.id)+'"></div>')+(opts.travel&&it.travelToNext?'<p class="travel-chip db-next" data-testid="travel-chip">'+travelIcon(it.travelToNext)+' <strong>Getting to the next stop:</strong> '+esc(it.travelToNext)+'</p>':'')+'</article>';
    }
    function noteCount(count){return count+' '+(count===1?'note':'notes');}
    function dayBookings(items) {
        var bookable=items.filter(function(it){return it.bookable&&!((state.edits.items||{})[it.id]||{}).swapped;});
        if(!bookable.length)return '';
        return '<p class="book-summary">'+icon('dates')+' '+bookable.length+' thing'+(bookable.length>1?'s':'')+' to book ahead today: '+bookable.map(function(it){
            return '<a href="#item-'+esc(it.id)+'">'+esc(it.title.split(' — ')[0])+'</a>';
        }).join(' · ')+'</p>';
    }
    function dayModel(d, i) {
        var edits=state.edits, relaxed=edits.relax&&edits.relax[i], rain=edits.rain&&edits.rain[i];
        var items=d.items.concat((edits.added|| {})[i]||[]).map(function(it){return it.locked?it:Object.assign({},it,(edits.items||{})[it.id]||{});}).filter(function(it) {
            if((edits.removed||[]).indexOf(it.id)>=0)return false;
            if(relaxed) {
                if(state.plan.id==='oahu-demo-2026-11') {
                    if(i===1&&/Diamond Head|Uber to Diamond/.test(it.title))return false;
                    if(i===2&&/Ala Moana|Magic Island|Makai Market/.test(it.title))return false;
                    if(i===3&&/Pillbox/.test(it.title))return false;
                } else if(it.kind==='activity'&&!it.requested)return false;
            }
            return true;
        });
        if(relaxed&&i===2&&state.plan.id==='oahu-demo-2026-11') {
            var afterDive=items.findIndex(function(it){return /intro dive/i.test(it.title);})+1;
            items.splice(afterDive||items.length,0, {
                id:'relax-kahala', time:'~11:15 AM', kind:'rest', title:'Uber back to the Kahala, then hotel beach / pool before getting ready for Senia', desc:'A gentler afternoon after the dive. Check the Uber app for the fare from Kewalo Basin.', bring:[], prep:[], sources:[]
            });
        }
        if(relaxed&&i===3&&state.plan.id==='oahu-demo-2026-11') {
            items=items.map(function(it) {
                if(!/Uber Reserve to Kailua/.test(it.title))return it;
                return Object.assign({}, it, { time:'~7:30 AM', title:'Uber to Kailua (later start, no sunrise hike)', desc:'Same ride as the sunrise plan, just later: approx. $38–55 one way, about 40 min; verify the fare in the app.', prep:[] });
            });
        }
        return {items:items.map(function(it){return window.GoNowDiet.safeMeal(it,state.answers);}), relaxed:relaxed, rain:rain};
    }
    function sleepQuestion(){return '<section class="optional-section"><span class="section-label">Optional</span><h2>Your usual sleep at home</h2><p>We’ll ease you into local time. We assume 10:30 PM–6:30 AM at home unless you change these times. Clear both fields to use itinerary estimates.</p><label>Bedtime<input type="time" data-testid="sleep-bedtime" value="'+esc(state.answers.bedtime===undefined?'22:30':state.answers.bedtime)+'"></label><label>Wake time<input type="time" data-testid="sleep-wake" value="'+esc(state.answers.wake)+'"></label></section>';}
    function groupPaceLabel(group){if(group.every(function(t){return t.level==='unsure';}))return 'Pace not set yet';if(group.every(function(t){return t.level===group[0].level;}))return (group.length===2?'Both':'Everyone')+': '+paceLabels[group[0].level]+' pace';return group.map(function(t,i){return esc(t.name||(i?'Partner':'You'))+': '+paceLabels[t.level];}).join(' · ');}
    function paceSummary(){return '<div data-testid="pace-summary">Pace &amp; activities: '+esc(({gentle:'Gentle',active:'Active',athlete:'Athlete',unsure:'Not sure'})[state.answers.level])+' · '+esc((state.answers.activities||[]).map(function(v){return v[0].toUpperCase()+v.slice(1);}).join(', '))+'</div>'+btn('Edit','pace-summary-edit','outline','aria-expanded="'+!!state.paceEditing+'" aria-controls="pace-inline"')+'<div id="pace-inline" '+(state.paceEditing?'':'hidden')+'>'+(state.paceEditing?wellnessPicker().replace(/ data-topic="(?:pace|activities)"/g,''):'')+'</div>';}
    function foodQuestion(){
        var a=state.answers;
        function chips(key,values){return '<div class="activity-chips">'+values.map(function(v){return '<button type="button" data-testid="food-chip" data-key="'+key+'" data-value="'+esc(v)+'" aria-pressed="'+a[key].includes(v)+'">'+esc(v)+'</button>';}).join('')+'</div>';}
        return '<fieldset class="food-group"><legend>Any dietary needs?</legend>'+chips('dietNeeds',window.GoNowDiet.needs)+'<p>Allergies</p>'+chips('allergens',['Nuts','Shellfish','Other'])+'<label '+(a.allergens.includes('Other')?'':'hidden')+' id="allergy-other-label" data-testid="allergy-other-label">Other allergy<input data-testid="allergy-other" value="'+esc(a.allergyOther)+'"></label><label>Dietary notes<input data-testid="diet-notes" value="'+esc(a.dietNotes)+'"></label></fieldset><fieldset class="food-group"><legend>What do you love to eat?</legend>'+chips('foodLoves',window.GoNowDiet.loves)+'</fieldset>';
    }
    function bindWellnessDetails(){
        ['bedtime','wake'].forEach(function(k){on('sleep-'+k,function(e){state.answers[k]=e.target.value;save();},'input');});
        on('diet-notes',function(e){state.answers.dietNotes=e.target.value;save();},'input');
        on('allergy-other',function(e){state.answers.allergyOther=e.target.value;save();},'input');
        view.querySelectorAll('[data-testid=food-chip]').forEach(function(el){el.onclick=function(){var k=el.dataset.key,v=el.dataset.value,arr=state.answers[k];state.answers[k]=arr.includes(v)?arr.filter(function(x){return x!==v;}):arr.concat(v);el.setAttribute('aria-pressed',state.answers[k].includes(v));if(k==='allergens')get('allergy-other-label').hidden=!state.answers.allergens.includes('Other');save();};});
    }
    function dietTag(item){if(item.kind!=='meal')return '';var m=window.GoNowDiet.match(item,state.answers);return '<small class="badge" data-testid="diet-tag">'+esc(m.reason)+'</small>';}
    var checkinSelected={},feelVoiceCleanups=[];
    function clearFeelVoices(){(feelVoiceCleanups||[]).forEach(function(stop){stop();});feelVoiceCleanups=[];}
    function personId(i){return 'traveler-'+i;}
    function personalItems(items,c){return items.map(function(it){return Object.assign({},it,it.locked?{}:(c.alternatives||{})[it.id]||{});});}
    function checkinClock(minutes){return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}
    function moodFace(i){return '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="10"/><circle cx="8" cy="9" r=".8" fill="currentColor"/><circle cx="16" cy="9" r=".8" fill="currentColor"/><path d="'+['M7 17 Q12 11 17 17','M7 15 H17','M7 14 Q12 20 17 14'][i]+'"/></svg>';}
    function suggestionCopy(s,items,c,group,name){
        if(s.type==='add')return 'Feeling great — add an optional 30-min sunrise run before your first plan?';
        var original=items.find(function(it){return it.id===s.id;})||{},alt=s.alternative.title.toLowerCase(),reason=c.energy==='low'?'Low energy today':c.soreness==='some'||c.soreness==='a lot'?'Feeling sore':'Poor sleep today';
        if(group.length>1)return esc(name+(c.soreness==='some'||c.soreness==='a lot'?' is sore':' could use a gentler day')+' — offer a gentle '+alt+' instead of '+original.title+' for '+name+'; others keep their plan.');
        return esc(reason+' — swap '+original.title+(original.start!=null?' ('+window.DayBuilder.clock(original.start)+')':'')+' for a gentle '+alt+' at the same time?');
    }
    var todayOverride=window.GoNowCheckin.validDate(new URLSearchParams(location.search).get('today'));
    function dayFeelHTML(day,items){
        if(!['plan','draft'].includes(state.screen)||day.date!==window.GoNowCheckin.today(Engine.matchDestination(state.answers.destination).tz||'Pacific/Honolulu',todayOverride))return '';
        var C=window.GoNowCheckin,group=trackedTravelers(),index=eachPerson()?(checkinSelected[day.date]||0):0,id=personId(index),name=group[index].name||(index?'Partner':'You'),c=C.get('gonow.checkin.v1',day.date,id);
        var choices={energy:['low','ok','high'],mood:['low','okay','good'],soreness:['none','some','a lot'],sleep:['poor','ok','great']};
        var html='<section class="day-feel" data-testid="day-feel" data-date="'+day.date+'" data-person="'+id+'">';
        if(group.length>1)html+='<div class="feel-selector" aria-label="Traveler">'+group.map(function(t,i){var done=C.get('gonow.checkin.v1',day.date,personId(i));return '<button type="button" data-testid="checkin-traveler" data-index="'+i+'" aria-pressed="'+(i===index)+'">'+esc(t.name||(i?'Partner':'You'))+(done.done?' · checked in':done.skipped?' · skipped':'')+'</button>';}).join('')+'</div>';
        html+=c.done||c.skipped?'<p data-testid="checkin-complete">'+(group.length>1?esc(name)+' · ':'')+(c.skipped?'Morning check-in skipped':'Morning check-in saved')+' · <button type="button" data-testid="checkin-edit">Edit</button></p>':'<details data-testid="morning-checkin"><summary>Morning feel · optional</summary><div class="feel-fields">'+Object.keys(choices).map(function(k){return '<fieldset><legend>'+k[0].toUpperCase()+k.slice(1)+'</legend>'+choices[k].map(function(v,i){var label=k==='mood'?['Low mood','Okay mood','Good mood'][i]:v;return '<button type="button" data-testid="checkin-'+k+'" data-field="'+k+'" data-value="'+v+'" aria-label="'+label+'" aria-pressed="'+(c[k]===v)+'">'+(k==='mood'?moodFace(i):v)+'</button>';}).join('')+'</fieldset>';}).join('')+'</div><div class="feel-input"><label>Anything to add?<textarea data-testid="checkin-text">'+esc(c.text)+'</textarea></label>'+feelVoiceHTML('checkin')+'</div><button type="button" data-testid="checkin-save">Save check-in</button><button type="button" data-testid="checkin-skip">Skip today</button></details>';
        var suggestions=C.suggest(items,c).suggestions.filter(function(s){return !(c.dismissed||[]).includes(s.id)&&!(c.alternatives||{})[s.id];});
        if(c.done&&C.gentle(c)){var eased=C.score(items,window.GoNowRings.selectLevel(group[index].level,(state.answers.dayPaces||{})[day.date]||'trip'),[],state.answers,c);html+='<p class="muted">'+(group.length>1?esc(name)+"'s movement":'Movement')+' goal eased to '+Math.round(eased.goals.move)+' min today.</p>';}
        if(c.done)html+='<div data-testid="checkin-suggestions">'+suggestions.map(function(s){return '<article data-testid="checkin-suggestion"><p>'+suggestionCopy(s,items,c,group,name)+'</p><button type="button" data-testid="checkin-apply" data-id="'+esc(s.id)+'">'+(s.type==='add'?'Add':group.length>1?'Swap for '+esc(name):'Swap')+'</button><button type="button" data-testid="checkin-dismiss" data-id="'+esc(s.id)+'">'+(s.type==='add'?'No thanks':'Keep plan')+'</button></article>';}).join('')+'</div>';
        if((c.extras||[]).length)html+='<p>'+esc(name)+': Sunrise run · 30 min added</p>';
        html+='</section>';
        return html;
    }
    function feelVoiceHTML(prefix){return '<div class="voice-controls"><button type="button" data-testid="'+prefix+'-mic" aria-pressed="false">Hold to speak</button><label>Language<select data-testid="'+prefix+'-lang"><option value="en-US">English</option><option value="zh-CN">中文</option></select></label><span role="status" aria-live="polite" data-testid="'+prefix+'-status"></span><span class="voice-interim muted" data-testid="'+prefix+'-interim"></span></div>';}
    function bindFeel(scope,items){
        clearFeelVoices();
        scope.querySelectorAll('[data-testid=day-feel]').forEach(function(box){
            var C=window.GoNowCheckin,date=box.dataset.date,id=box.dataset.person,c=C.get('gonow.checkin.v1',date,id);
            function store(){C.put('gonow.checkin.v1',date,id,c);}
            function refresh(){render();}
            box.querySelectorAll('[data-testid=checkin-traveler]').forEach(function(b){b.onclick=function(){checkinSelected[date]=Number(b.dataset.index);refresh();};});
            var edit=box.querySelector('[data-testid=checkin-edit]');if(edit)edit.onclick=function(){c.done=false;c.skipped=false;store();refresh();var details=view.querySelector('[data-testid=morning-checkin]');if(details)details.open=true;};
            function pressed(){box.querySelectorAll('[data-field]').forEach(function(b){b.setAttribute('aria-pressed',String(c[b.dataset.field]===b.dataset.value));});}
            box.querySelectorAll('[data-field]').forEach(function(b){b.onclick=function(){c[b.dataset.field]=b.dataset.value;pressed();store();};});
            var text=box.querySelector('[data-testid=checkin-text]');if(text)text.oninput=function(){c.text=text.value;Object.assign(c,C.parse(text.value));pressed();store();};
            ['save','skip'].forEach(function(action){var b=box.querySelector('[data-testid=checkin-'+action+']');if(b)b.onclick=function(){c.skipped=action==='skip';c.done=action==='save';store();refresh();};});

            box.querySelectorAll('[data-testid=checkin-apply],[data-testid=checkin-dismiss]').forEach(function(b){b.onclick=function(){var schedule=window.DayBuilder.schedule(),day=schedule&&schedule.days.find(function(d){return d.date===date;}),dayItems=day?day.items:(state.plan.days.find(function(d){return d.date===date;})||{}).items||[],s=C.suggest(dayItems,c).suggestions.find(function(s){return s.id===b.dataset.id;});if(!s)return;
                if(b.dataset.testid==='checkin-apply'){
                    if(eachPerson()){if(s.type==='swap'){c.alternatives=c.alternatives||{};c.alternatives[s.id]=s.alternative;}else{c.extras=(c.extras||[]).concat(s.alternative);}}
                    else if(s.type==='swap'){if(mergedPlan())window.DayBuilder.swapItem(s.id,s.alternative);else {var it=state.plan.days.find(function(d){return d.date===date;}).items.find(function(i){return i.id===s.id;});if(it&&!it.locked){state.edits.items=state.edits.items||{};state.edits.items[it.id]=Object.assign({},state.edits.items[it.id],s.alternative);persistEdits();}}}
                    else if(mergedPlan())window.DayBuilder.addToDay(date,Object.assign({},s.alternative,{time:checkinClock(s.alternative.preferred)}));else {var di=state.plan.days.findIndex(function(d){return d.date===date;});state.edits.added=state.edits.added||{};state.edits.added[di]=(state.edits.added[di]||[]).concat(Object.assign({},s.alternative,{id:'checkin-extra-'+date,kind:'activity',time:checkinClock(s.alternative.preferred),bring:[],sources:[]}));persistEdits();}
                }
                c.dismissed=(c.dismissed||[]).concat(s.id);store();refresh();
            };});
            ['checkin'].forEach(function(prefix){bindFeelVoice(box,prefix);});
        });
    }
    function bindFeelVoice(box,prefix){
        var b=box.querySelector('[data-testid='+prefix+'-mic]');if(!b)return;
        var status=box.querySelector('[data-testid='+prefix+'-status]'),field=box.querySelector('[data-testid='+prefix+'-text]'),lang=box.querySelector('[data-testid='+prefix+'-lang]'),R=window.SpeechRecognition||window.webkitSpeechRecognition,r,listening=false,pointer=false,pressedAt=0,wasListening=false;
        function reset(){listening=false;b.setAttribute('aria-pressed','false');b.classList.remove('is-listening');b.textContent='Hold to speak';}
        function stop(){if(listening){r.stop();reset();status.textContent='Voice input stopped.';}}
        function start(){if(listening)return;if(!R){status.textContent='Voice input needs Chrome, Edge or Safari.';return;}r=new R();r.lang=lang.value;r.interimResults=true;r.continuous=false;
            r.onresult=function(e){if(!field.isConnected)return;var interim=box.querySelector('[data-testid='+prefix+'-interim]');interim.textContent='';for(var j=e.resultIndex;j<e.results.length;j++)if(!e.results[j].isFinal)interim.textContent+=e.results[j][0].transcript;for(var i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal){field.value+=(field.value?' ':'')+e.results[i][0].transcript;field.dispatchEvent(new Event('input',{bubbles:true}));}status.textContent=listening?'Listening…':'Voice input added.';};
            r.onerror=function(e){status.textContent=({'not-allowed':'Microphone permission was blocked.','no-speech':'No speech heard. Try again.',network:'Voice input network error. Try again.'})[e.error]||'Voice input could not start. Try again.';reset();};r.onend=function(){reset();if(status.textContent==='Listening…')status.textContent='Voice input ended.';};
            listening=true;b.setAttribute('aria-pressed','true');b.classList.add('is-listening');b.textContent='Listening…';status.textContent='Listening…';try{r.start();}catch(e){reset();status.textContent='Voice input could not start. Try again.';}
        }
        feelVoiceCleanups.push(function(){if(r){r.onresult=r.onerror=r.onend=null;r.abort();}reset();});
        b.onpointerdown=function(e){if(e.button!==0)return;pointer=true;pressedAt=Date.now();wasListening=listening;start();};b.onpointerup=function(){stop();};b.onpointerleave=function(){stop();pointer=false;};b.onpointercancel=function(){stop();pointer=false;};b.onclick=function(e){if(pointer){pointer=false;if(Date.now()-pressedAt>250||wasListening)return;}if(listening)stop();else start();};
    }


    var paceLabels={gentle:'Gentle',active:'Active',athlete:'Athlete',unsure:'Not sure',trip:'Same as trip'};
    function partySize(a){a=a||state.answers;return a.who==='solo'?1:a.who==='couple'?2:Number(a.adults||0)+Number(a.kids||0);}
    function eachPerson(){return partySize()>1&&state.answers.track==='each';}
    function trackedTravelers(){return eachPerson()?travelers():[{name:'',level:state.answers.level}];}
    function trackChoice(){return partySize()>1?'<fieldset class="track-choice"><legend>How should we track?</legend><div class="options" data-testid="track-choice">'+option('together','Track together','One shared plan','track')+option('each','Track each person','Per-person check-ins','track')+'</div></fieldset>':'';}
    function trackToggle(){return partySize()>1?'<button type="button" data-testid="track-toggle" aria-label="Switch tracking" aria-pressed="'+eachPerson()+'">'+(eachPerson()?'Tracking: Each person':'Tracking: Together')+'</button>':'';}
    function hasSectionContent(body){return /<(?:input|button|select|textarea|svg|img|canvas)\b/i.test(body)||!!String(body).replace(/<[^>]*>/g,'').replace(/&(?:nbsp|#160);/g,' ').trim();}
    function section(title,body,tag,attrs){return hasSectionContent(body)?'<'+(tag||'section')+(attrs?' '+attrs:'')+'>'+(tag==='details'?'<summary>'+title+'</summary>':'<h3>'+title+'</h3>')+body+'</'+(tag||'section')+'>':'';}
    function pruneEmptySections(scope){
        Array.from(scope.querySelectorAll('h2,h3,h4,summary')).reverse().forEach(function(head){
            var body='',next=head.nextSibling;
            while(next&&!/^(H[2-4]|SUMMARY)$/.test(next.nodeName)){body+=next.outerHTML||next.textContent||'';next=next.nextSibling;}
            if(!hasSectionContent(body)){if(head.tagName==='SUMMARY'&&head.parentElement.tagName==='DETAILS')head.parentElement.remove();else head.remove();}
        });
    }

    function travelers(){var a=state.answers,n=a.who==='solo'?1:a.who==='couple'?2:Number(a.adults)+Number(a.kids);a.travelers=(a.travelers||[]).slice(0,n);while(a.travelers.length<n)a.travelers.push({name:'',level:a.level});a.travelers.forEach(function(t){if(/^Traveler \d+$/.test(t.name||''))t.name='';});return a.travelers;}
    function paceClock(n){return (Math.floor(n/60)%12||12)+':'+String(n%60).padStart(2,'0')+(n>=720?' PM':' AM');}
    function dayRingContext(day,items,next,scheduleDays){
        var raw=state.answers,ji=state.plan.days.findIndex(function(d){return d.date===day.date;}),j=window.GoNowJetlag.adjustment({date:day.date,day:ji+1,origin:raw.origin,destinationZone:Engine.matchDestination(raw.destination).tz||'America/Los_Angeles',bedtime:raw.bedtime,wake:raw.wake,local:raw.mode==='local'});var a=Object.assign({},raw,(raw.bedtime||raw.wake)?{bedtime:j.bedtime,wake:j.wake}:{}),override=(a.dayPaces||{})[day.date]||'trip',level=window.GoNowRings.selectLevel(a.level,override);
        var schedule=!scheduleDays&&window.DayBuilder&&window.DayBuilder.schedule(),previous=scheduleDays?scheduleDays[ji-1]:schedule?schedule.days[ji-1]:state.plan.days[ji-1];
        a.previousItems=previous?previous.items:[];a.stay=state.plan.stay||'your stay';a.usualBedtime=raw.bedtime;a.jetlagAdjusted=!j.aligned;
        var ringResult=window.GoNowCheckin.score(personalItems(items,window.GoNowCheckin.get("gonow.checkin.v1",day.date,personId(0))),level,next,a,window.GoNowCheckin.get("gonow.checkin.v1",day.date,personId(0)));return {a:a,j:j,previous:previous,override:override,level:level,ringResult:ringResult};
    }
    function paceDayHTML(day,items,next){
        var context=dayRingContext(day,items,next),override=context.override,level=context.level,ringResult=context.ringResult;
        var html=window.GoNowRings.render(ringResult,{override:override==='trip'?'':paceLabels[override],compact:true,caption:false})+sleepNudgeHTML(day,items,context)+'<details class="pace-control" '+(state.paceOpen===day.date?'open':'')+'><summary data-testid="day-pace-link" aria-expanded="'+(state.paceOpen===day.date)+'">Pace: '+(level==='unsure'?'Not set · choose':paceLabels[level]+' · change')+'</summary><fieldset data-testid="day-pace" data-date="'+day.date+'"><legend>Day pace</legend>'+['gentle','active','athlete','trip'].map(function(v){return '<label><input type="radio" name="pace-'+day.date+'" data-testid="day-pace-option" data-value="'+v+'" value="'+v+'" '+(v===override?'checked':'')+'>'+paceLabels[v]+'</label>';}).join('')+'</fieldset></details>';
        return html;
    }
    function sleepNudgeHTML(day,items,context){
        var ringResult=context.ringResult,previous=context.previous,html='';
        var R=window.GoNowRings,detail=ringResult.sleepDetail,first=detail&&detail.first,locked=items.find(function(it){return it.locked&&it.start<480;}),direction=first&&first.start<480?'later':'earlier',targetDate=direction==='later'?day.date:previous&&previous.date,proposal=R.proposal(direction==='later'?items:previous&&previous.items,direction);
        var earliest=items.filter(function(it){return Number.isFinite(it.start);}).sort(function(a,b){return a.start-b.start;})[0];
        if(earliest&&(earliest.kind==='flight'||earliest.flight||earliest.id==='pick-airport'||/\b(?:airport|HNL)\b/i.test(earliest.title||'')&&(earliest.locked||earliest.kind==='travel')||earliest.locked&&(earliest.airport||earliest.inboundRide?.airport||(earliest.tags||[]).some(function(t){return /flight|airport/i.test(t);}))))return '';
        var dismissed=false;try{dismissed=localStorage.getItem('gonow.sleep-nudge.'+day.date)==='keep';}catch(e){}
        if(R.shortNight(ringResult.values.sleep,ringResult.goals.sleep)&&!dismissed){
            html+='<aside class="sleep-nudge" data-testid="sleep-nudge" data-date="'+day.date+'"><span>Short night · '+Math.floor(ringResult.values.sleep)+'h'+String(Math.round(ringResult.values.sleep*60)%60).padStart(2,'0')+' sleep</span> ';
            if(locked&&direction==='later')proposal=null;
            html+='<button data-testid="sleep-nudge-accept">'+(direction==='later'?'Later start':'Earlier night')+'</button><button data-testid="sleep-nudge-keep">Keep</button><div data-testid="sleep-proposal" hidden>'+(proposal?'<p>Move '+esc(proposal.title)+' to '+R.clock(proposal.start)+' (30 minutes '+direction+').</p><button data-testid="sleep-proposal-apply" data-date="'+targetDate+'" data-id="'+esc(proposal.id)+'" data-start="'+proposal.start+'">Apply</button>':'<p>The reserved times stay in place. An earlier wind-down tonight can help.</p>')+'<button data-testid="sleep-proposal-cancel">Cancel</button></div></aside>';
        }
        return html;
    }
    function dayPeopleHTML(day,items,next){
        var context=dayRingContext(day,items,next),a=context.a,override=context.override,html=dayFeelHTML(day,items);
        var group=travelers();if(eachPerson())html+='<section data-testid="group-section"><button type="button" data-testid="group-toggle" aria-expanded="'+!!state.groupOpen+'" aria-controls="group-'+day.date+'">Each person</button><div id="group-'+day.date+'" '+(state.groupOpen?'':'hidden')+' class="travelers">'+group.map(function(t,i){return '<div data-testid="traveler-row"><label><span class="sr-only">Name</span><input data-testid="traveler-name" placeholder="'+(i===0?'Your name':i===1?"Partner&#39;s name":"Traveler "+(i+1)+"’s name")+'" data-index="'+i+'" value="'+esc(t.name)+'"></label><label><span class="sr-only">Pace</span><select data-testid="traveler-pace" data-index="'+i+'">'+['gentle','active','athlete','unsure'].map(function(v){return '<option value="'+v+'" '+(v===t.level?'selected':'')+'>'+paceLabels[v]+'</option>';}).join('')+'</select></label><div data-testid="traveler-rings" aria-label="'+esc(t.name||(i?'Partner':'You'))+'">'+window.GoNowRings.render(window.GoNowCheckin.score(personalItems(items,window.GoNowCheckin.get("gonow.checkin.v1",day.date,personId(i))).concat(window.GoNowCheckin.get("gonow.checkin.v1",day.date,personId(i)).extras||[]),window.GoNowRings.selectLevel(t.level,override),next,a,window.GoNowCheckin.get("gonow.checkin.v1",day.date,personId(i))),{caption:false,name:t.name||(i?'Partner':'You'),compact:true})+'</div></div>';}).join('')+'</div></section>';
        return html;
    }
    function bindPace(scope){
        scope.querySelectorAll('[data-testid=day-pace-link]').forEach(function(b){b.parentElement.ontoggle=function(){b.setAttribute('aria-expanded',String(b.parentElement.open));state.paceOpen=b.parentElement.open?b.nextElementSibling.dataset.date:null;};});
        scope.querySelectorAll('[data-testid=sleep-nudge]').forEach(function(box){
            box.querySelector('[data-testid=sleep-nudge-keep]').onclick=function(){try{localStorage.setItem('gonow.sleep-nudge.'+box.dataset.date,'keep');}catch(e){}box.remove();};
            box.querySelector('[data-testid=sleep-nudge-accept]').onclick=function(){box.querySelector('[data-testid=sleep-proposal]').hidden=false;};
            box.querySelector('[data-testid=sleep-proposal-cancel]').onclick=function(){box.querySelector('[data-testid=sleep-proposal]').hidden=true;};
            var apply=box.querySelector('[data-testid=sleep-proposal-apply]');if(apply)apply.onclick=function(){window.DayBuilder.shiftUnlocked(apply.dataset.date,apply.dataset.id,Number(apply.dataset.start));};
        });
        bindFeel(scope);scope.querySelectorAll('[data-testid=group-toggle]').forEach(function(b){b.onclick=function(){state.groupOpen=!state.groupOpen;render();var toggle=view.querySelector('[data-testid=group-toggle]');if(toggle)toggle.focus();};});
        scope.querySelectorAll('[data-testid=day-pace-option]').forEach(function(el){el.onchange=function(){state.answers.dayPaces=Object.assign({},state.answers.dayPaces);state.answers.dayPaces[el.closest('[data-date]').dataset.date]=el.value;save();render();};});
        scope.querySelectorAll('[data-testid=traveler-name],[data-testid=traveler-pace]').forEach(function(el){el.onchange=function(){var t=travelers()[Number(el.dataset.index)];t[el.tagName==='SELECT'?'level':'name']=el.value;save();render();};});
    }
    function dayHeadHTML(d, i, m) {
        var car=d.car||{},carText=[car.level,car.note].filter(function(v){return typeof v==='string'&&v.trim();}).map(function(v){return v.trim();}).join(' · ');
        var transfers=state.plan.id.startsWith('template-')&&d.items.length>1?'<div class="template-transfers">'+d.items.slice(0,-1).map(function(item,index){return '<p class="travel-chip" data-testid="travel-chip">'+esc(item.title)+' → '+esc(d.items[index+1].title)+': '+esc(item.travelToNext||'Local transfer — confirm route')+'</p>';}).join('')+'</div>':'';
        var hint=/uber|rideshare|taxi/i.test(carText)?'Uber':/not needed|no car/i.test(carText)?'No car':String(car.level||car.note||'Transfers').trim().split(/\s+/).slice(0,2).join(' ');
        var info=carText||transfers?'<details data-testid="day-info"><summary><span class="day-info-chevron" aria-hidden="true">▸</span>Getting around · '+esc(hint)+'</summary>'+(carText?'<p>'+esc(carText)+'</p>':'')+transfers+'</details>':'';
        var label=new Date(d.date+'T12:00:00').toLocaleDateString('en-US',  {
            weekday:'short', month:'short', day:'numeric'
        });
        var schedule=window.DayBuilder?window.DayBuilder.schedule():null;
        var days=schedule?schedule.days:state.plan.days;
        var current=days.find(function(day){return day.date===d.date;});
        var next=days[days.findIndex(function(day){return day.date===d.date;})+1];
        var ringItems=schedule&&current?current.items:m.items;
        return '<div class="day-head"><div class="day-title"><h2>Day '+(i+1)+' · '+label+'</h2>'+(d.theme?'<p>'+esc(d.theme)+'</p>':'')+'</div>'+paceDayHTML(d,ringItems,next&&next.items)+info+'</div>'+dayPeopleHTML(d,ringItems,next&&next.items)+(m.relaxed?'<div class="banner">Relaxed version: '+esc(d.relax)+'</div>':'')+(m.rain?'<div class="banner">'+icon('info')+' Rain backup: '+esc(d.rain)+'</div>':'');
    }
    function dayFooterHTML(d, i, m) {
        return '<details class="day-options"><summary '+(mergedPlan()?'':'data-testid="day-add"')+'>'+(mergedPlan()?'Day options':'+ Add')+'</summary><div class="day-footer row">'+(d.relax?'<label><input type="checkbox" data-testid="relax-toggle" data-relax="'+i+'" '+(m.relaxed?'checked':'')+'>Make this day more relaxing</label>':'')+(d.rain?'<label><input type="checkbox" data-testid="rain-toggle" data-rain="'+i+'" '+(m.rain?'checked':'')+'>Rain backup</label>':'')+btn('+ Add your own item', 'day-custom-add', '', 'data-add-day="'+i+'"')+'</div></details>';
    }
    function dayHTML(d, i) {
        var m=dayModel(d, i), items=m.items;
        return'<section class="card day" id="day-'+i+'" data-testid="plan-day">'+dayHeadHTML(d, i, m)+'<ol class="timeline">'+items.map(function(it, j) {
            return itemHTML(it, i)+(j<items.length-1?'<li class="travel-chip" data-testid="travel-chip" style="display:block">'+travelIcon(it.travelToNext)+' '+esc(it.travelToNext||'approx. 5–10 min walk / local transfer — confirm route')+'</li>':'');
        }).join('')+'</ol>'+dayFooterHTML(d, i, m)+'</section>';
    }
    // The Oahu demo shows each day once, inside the day builder.
    function mergedPlan() {
        return !!(state.plan&&state.answers.mode!=='local'&&state.tab==='plan'&&window.DayBuilder);
    }
    function builderContext() {
        var p=state.plan;
        function day(date){var i=p.days.findIndex(function(d){return d.date===date;});return {d:p.days[i],i:i};}
        function model(date){var x=day(date);return x.d?dayModel(x.d,x.i):{items:[]};}
        function find(id,date){return model(date).items.find(function(it){return it.id===id;});}
        return {
            saveDraft:function(raw){if(state.shared||state.viewing==='finished')return;var list=readTrips(),t=list.find(function(t){return t.id===state.tripId;});if(t){t.builder=cloneData(raw);t.answers=cloneData(state.answers);writeTrips(list);}},
            undo:function(message,restore){toast(message,restore);},
            ages:state.answers.ages, shared:!!state.shared||state.viewing==='finished', initial:(state.viewing==='finished'&&currentTrip()&&currentTrip().snapshot)?(currentTrip().snapshot.builder||null):(state.sharedBuilder||null),
            dayHead:function(date){var x=day(date);return x.d?dayHeadHTML(x.d,x.i,dayModel(x.d,x.i)):'';},
            dayFooter:function(date){var x=day(date);return x.d?dayFooterHTML(x.d,x.i,dayModel(x.d,x.i)):'';},
            // Stops the builder does not schedule: your own added items and the relaxed-day swap.
            dayExtras:function(date){
                var x=day(date);if(!x.d)return '';
                var known=x.d.items.map(function(it){return it.id;});
                var extra=dayModel(x.d,x.i).items.filter(function(it){return known.indexOf(it.id)<0;});
                return extra.length?'<div class="db-extras"><h3 class="section-label">Your added stops</h3><ol class="timeline">'+extra.map(function(it){return itemHTML(it,x.i);}).join('')+'</ol></div>':'';
            },
            hidden:function(date){
                var x=day(date);if(!x.d)return new Set();
                var shown=dayModel(x.d,x.i).items.map(function(it){return it.id;});
                return new Set(x.d.items.map(function(it){return it.id;}).filter(function(id){return shown.indexOf(id)<0;}));
            },
            // Relax and a hand-edited clock time change the builder's start, not only the label.
            // Locked reservations and user locks keep the time the traveler pinned.
            adjust:function(src, date, item){
                if(!item||item.locked)return null;
                var edit=(state.edits.items||{})[src]||{};
                var raw=day(date).d&&day(date).d.items.find(function(o){return o.id===src;});
                if(edit.time&&raw&&edit.time!==raw.time){
                    var edited=parseClock(edit.time);
                    if(edited!=null)return {preferred:edited};
                }
                var idx=day(date).i;
                if(date==='2026-11-28'&&state.edits.relax&&state.edits.relax[idx]&&src==='2026-11-28-0'){
                    return {preferred:7*60+30, duration:40};
                }
                return null;
            },
            photoFor:function(src){return ITEM_PHOTOS[src]||(state.plan.days.flatMap(function(d){return d.items;}).find(function(i){return i.id===src;})||{}).photo;},
            titleFor:function(src,date,item){
                var it=find(src,date);if(!it)return '';
                var edit=(state.edits.items||{})[src]||{}, original=day(date).d.items.find(function(o){return o.id===src;});
                if(item&&(item.checkinSwap||item.originalTitle||item.routeReview))return item.title;
                if(item&&item.flight)return item.title;
                if(item&&item.locked&&original)return original.title.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu,'').trim();
                if(it.kind==='meal'&&window.GoNowDiet.match(it,state.answers).status==='conflict'&&item&&!item.locked)return 'A place that fits your needs';
                if(edit.title)return edit.title;
                return original&&it.title!==original.title?it.title.replace(/\p{Extended_Pictographic}/gu,'').trim():'';
            },
            detail:function(src,date,item){
                if(item&&item.checkinSwap)return '<p>'+esc(item.title)+' · A gentler option at the same time.</p>';
                var chest=item&&(/^(chest-|instance-)/.test(item.id)||item.sourceId!==item.id);
                var it=find(src,date)||p.days.flatMap(function(d){return d.items;}).find(function(o){return o.id===src;});if(!it)return '<p>'+icon('info')+' '+esc(item.title)+' in '+esc(item.place)+'. No verified activity photo.</p>';
                if(item&&item.locked){var booked=p.days.flatMap(function(d){return d.items;}).find(function(o){return o.id===src;});if(booked)it=Object.assign({},booked,{locked:true});}
                if(item&&item.originalTitle)it=Object.assign({},it,{title:item.title,time:item.start!=null?window.DayBuilder.range(item.start,item.end):it.time});
                var html='<div class="db-item" data-item-id="'+esc(it.id)+'"'+(chest?'':' id="item-'+esc(it.id)+'"')+'>'+itemArticle(it,{photo:!['travel','flight'].includes(item.kind),travel:!chest,noActions:chest,noLock:true})+'</div>';
                (item&&item.extraSources||[]).forEach(function(id){var ride=find(id,date);if(ride)html+='<div class="db-item db-item-ride" data-item-id="'+esc(ride.id)+'" id="item-'+esc(ride.id)+'"><p class="section-label">Getting there and back</p>'+itemArticle(ride,{travel:true})+'</div>';});
                return html;
            },
            afterRender:function(scope){pruneEmptySections(scope);bindItems(scope);bindPace(scope);scope.querySelectorAll('[data-db-source]').forEach(function(row){var src=row.dataset.dbSource,it=p.days.flatMap(function(d){return d.items;}).find(function(i){return i.id===src;});var host=row.querySelector('.db-activity');if(host){if(it){var safe=window.GoNowDiet.safeMeal(Object.assign({},it,{locked:it.locked||row.classList.contains('db-locked')}),state.answers);host.insertAdjacentHTML('beforeend',dietTag(safe));if(safe.title!==it.title){var title=host.querySelector('.db-expand strong,strong[id^=db-title]');if(title)title.textContent=safe.title;}}(eachPerson()?travelers():[]).forEach(function(t,i){var c=window.GoNowCheckin.get('gonow.checkin.v1',window.DayBuilder.selectedDate(),personId(i)),alt=(c.alternatives||{})[row.dataset.dbId];if(alt&&!row.classList.contains('db-locked'))host.insertAdjacentHTML('beforeend','<small class="traveler-alternative" data-testid="traveler-alternative">'+esc(t.name)+': '+esc(alt.title.toLowerCase())+' instead</small>');});}});}
        };
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
        if(state.answers.mode!=='local'&&(state.answers.stayUnsure||state.answers.hotelEdited))applyStay();
        state.tab='plan';
        view.innerHTML='<div class="shell">'+(state.viewing==='finished'?'<div data-testid="finished-banner"><p>Saved finished plan</p>'+(currentTrip()&&currentTrip().snapshot&&currentTrip().snapshot.weather?'<p data-testid="snapshot-weather">'+esc(currentTrip().snapshot.weather.label)+' '+esc(currentTrip().snapshot.weather.text)+'</p>':'')+'</div>':'')+planBanner(p)+planNotices(p)+'<div id="tab-content">'+(mergedPlan()?'':'<nav class="daynav" aria-label="Jump to day">'+p.days.map(function(d,i){return '<a href="#day-'+i+'" data-testid="day-nav-'+i+'">Day '+(i+1)+' · '+esc(dateLabel(d.date,{weekday:'short'})+' '+dateLabel(d.date,{day:'numeric'}))+'</a>';}).join('')+'</nav><div class="itinerary-days">'+p.days.map(dayHTML).join('')+'</div>')+'</div><details data-testid="travel-info"><summary>Travel info</summary><div data-testid="local-info" id="local-info"><p>Open for local details.</p></div></details><details data-testid="booking-searches"><summary>Booking searches</summary><div data-testid="book-links">'+bookLinksHTML().replace('<h2>Book this</h2>','')+'</div></details><footer class="row export-actions"><span data-testid="print">'+btn('Print / Save as PDF','print-plan','outline')+'</span>'+btn('Copy as text','copy','outline')+'<span data-testid="share">'+btn('Share link','share-link','outline')+'</span>'+btn('Download calendar','download-ics','outline')+'</footer><p class="footer-note">Made for your kind of travel. Saved on this device.</p></div>';
        if(p.bookingIssues&&p.bookingIssues.length){
            view.querySelector('.shell').insertAdjacentHTML('afterbegin',p.bookingIssues.map(function(i){return '<p class="booking-issue" data-testid="booking-issue">'+esc(i.id==='lamer'?'La Mer':i.name.replace(/ Chinatown$/, ''))+' '+esc(PickScheduler.reason(i,state.answers).replace(/^Booked/,'booked'))+' <button class="outline" data-booking-fix="'+i.id+'">Fix</button></p>';}).join(''));
            view.querySelectorAll('[data-booking-fix]').forEach(function(b){b.onclick=function(){go('dates');};});
        }

        if(p.unfit&&p.unfit.length){
            view.querySelector('.shell').insertAdjacentHTML('afterbegin','<details class="banner unfit-notice" data-testid="unfit-notice"><summary>Too many picks · '+p.unfit.length+" didn't fit</summary>"+p.unfit.map(function(i){var reason=PickScheduler.reason(i,state.answers),canSwap=!i.reservation&&PickScheduler.swap(JSON.parse(JSON.stringify(state.answers)),i.id,pickCatalog());return '<div class="unfit-row"><span>'+esc(i.name)+'<small class="muted">'+esc(reason)+'</small></span><div class="unfit-actions"><button class="outline" data-unfit-remove="'+i.id+'">Remove</button>'+(canSwap?'<button class="outline" data-unfit-swap="'+i.id+'">Swap</button>':'')+'</div></div>';}).join('')+'</details>');
            view.querySelectorAll('[data-unfit-remove],[data-unfit-swap]').forEach(function(b){b.onclick=function(){if(b.dataset.unfitRemove)PickScheduler.remove(state.answers,b.dataset.unfitRemove);else if(!PickScheduler.swap(state.answers,b.dataset.unfitSwap,pickCatalog())){toast('No fitting swap');return;}save();checkoutPicks();};});
        }
        bindPlanPrep();
        bindHotel();
        bindPace(view);
        if(mergedPlan()){
            var db=document.createElement('section');db.className='db-root';db.dataset.testid='db-root';db.setAttribute('aria-label','Your days');
            document.getElementById('tab-content').append(db);
            var built=builderContext();
            built.plan=p;window.DayBuilder.mount(db,built);
        }
        var travelInfo=get('travel-info'),infoMounted=false;
        if(travelInfo)travelInfo.ontoggle=function(){if(travelInfo.open&&!infoMounted){infoMounted=true;LocalInfo.mount(get('local-info'),isOahuPlan(p)?'oahu':Engine.matchDestination(state.answers.destination).id,p.start,p.end)();}};
        // Apply the persisted view only after the builder exists. List is the default.
        expeditionUI();
        on('build-template', function() {
            state.answers.templateOahu=true;
            save();
            generate();
        });
        on('personalize-plan', function() {
            state.answers.personal=true;
            go('food');
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
        on('print-plan', function() { earn('Printed a plan'); window.print(); });
        on('share-link', shareTrip);
        on('download-ics', downloadICS);
        on('copy', copyPlan);
        bindItems(view);
        bindPacking();
        if(moveFocus!==false) {
            var h=document.getElementById('step-title');
            if(h)h.focus( {
                preventScroll:true
            });
        }
    }
    function bindItems(scope) {
        scope.querySelectorAll('[data-lock]').forEach(function(b){b.onclick=function(){var id=b.dataset.lock;state.edits.items=state.edits.items||{};var edit=state.edits.items[id]=state.edits.items[id]||{};edit.locked=!edit.locked;persistEdits();planRender(false);};});
        scope.querySelectorAll('[data-pack-id]').forEach(function(el) {
            el.onchange=function() {
                tick(el.dataset.packId, el.checked);
            };
        });
        scope.querySelectorAll('[data-relax],[data-rain]').forEach(function(el) {
            el.onchange=function() {
                var type=el.hasAttribute('data-relax')?'relax':'rain', idx=el.dataset[type], y=window.scrollY;
                state.edits[type]=state.edits[type]|| {};
                state.edits[type][idx]=el.checked;
                persistEdits();
                planRender(false);
                window.scrollTo(0, y);
            };
        });
        scope.querySelectorAll('[data-remove]').forEach(function(el) {
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
        scope.querySelectorAll('[data-edit]').forEach(function(el) {
            el.onclick=function() {
                editItem(el.dataset.edit);
            };
        });
        scope.querySelectorAll('[data-swap]').forEach(function(el) {
            el.onclick=function() {
                var id=el.dataset.swap, it=state.plan.days.flatMap(function(d) {
                    return d.items;
                }).concat(Object.values(state.edits.added|| {}).flat()).find(function(x) {
                    return x.id===id;
                });
                if(!it)return;
                var edit=(state.edits.items|| {})[id]|| {};
                var dest=Engine.matchDestination(state.answers.destination);
                var choices=it.kind==='meal'?['Local café near your stay', 'Casual market meal near your stay']:it.kind==='travel'?['Pre-book a licensed transfer','Use local transit after checking the route']:['rest','stay'].indexOf(it.kind)>=0?['Downtime at your hotel','A gentle walk near your stay']:(dest.activities.scenic);
                var next=choices[(choices.indexOf(edit.title)+1)%choices.length];
                showModal('Swap this stop?', esc(next)+' — template suggestion; confirm timing, availability and suitability.', [ {
                    text:'Use this suggestion', action:function() {
                        state.edits.items=state.edits.items|| {};
                        state.edits.items[id]=Object.assign( {}, edit,  {
                            swapped:true, title:next+(it.kind==='meal'&&state.answers.foodLoves.length?' · '+state.answers.foodLoves.join(', '):''), desc:'Your swapped template suggestion. Confirm local details before setting out.'
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
        scope.querySelectorAll('[data-book]').forEach(function(el) {
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
        scope.querySelectorAll('[data-add-day]').forEach(function(el) {
            el.onclick=function() {
                addItem(Number(el.dataset.addDay));
            };
        });
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
        return '<p id="packing-status" aria-live="polite">Packed '+n+' of '+all.length+(n===all.length?' — All packed. Have a great trip.':'')+'</p><div class="progress" id="packing-progress" role="progressbar" aria-label="Packing progress" aria-valuemin="0" aria-valuemax="'+all.length+'" aria-valuenow="'+n+'"><span style="width:'+(n/all.length*100)+'%"></span></div><div class="row"><label class="checkrow"><input type="checkbox" data-testid="hide-packed" '+(state.hidePacked?'checked':'')+'>Hide packed</label>'+btn('Reset ticks', 'reset-packing', 'outline')+'</div>'+groups.map(function(g, i) {
            return'<details class="packing-category" '+(i===0?'open':'')+'><summary>'+esc(g.group)+'</summary>'+g.items.filter(function(it) {
                return!state.hidePacked||!state.packed[it.id];
            }).map(function(it) {
                return'<div class="checkrow"><input type="checkbox" data-testid="pack-item" data-pack-id="'+esc(it.id)+'" aria-label="Pack '+esc(it.name)+'" '+(state.packed[it.id]?'checked':'')+'><span>'+esc(it.name)+'</span><label class="pack-quantity-control"><span class="muted" aria-hidden="true">×</span><input type="number" min="1" max="99" value="'+it.qty+'" data-quantity="'+esc(it.id)+'" data-testid="pack-quantity" aria-label="Quantity for '+esc(it.name)+'"></label></div>';
            }).join('')+btn('+ Add your own item', 'packing-add', '', 'data-pack-group="'+i+'"')+'</details>';
        }).join('')+'<p class="footer-note">Saved on this device. Counts are suggestions. Change any number.</p>';
    }
    function bindPacking() {
        on('hide-packed', function(e) {
            state.hidePacked=e.target.checked;
            if(state.screen==='prep')prepScreen();else planRender(false);
        }, 'change');
        on('reset-packing', function() {
            showModal('Clear all ticks?', 'Your items stay.', [ {
                text:'Clear ticks', action:function() {
                    state.packed= {};var r=prepRecord();Object.keys(r.checked).forEach(function(id){if(id.startsWith('pack-'))delete r.checked[id];});savePrep(r);
                    write(KEY+'packing:'+state.plan.id,  {});
                    if(state.screen==='prep')prepScreen();else planRender(false);
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
                    if(state.screen==='prep')prepScreen();else planRender(false);
                });
            };
        });
    }
    function parseClock(text) {
        var m=String(text||'').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        return m?(Number(m[1])%12)*60+Number(m[2])+( /pm/i.test(m[3])?720:0):null;
    }
    // Oahu days follow the builder's current order and reflowed start/end, including after a reorder or Relax.
    function builderExport() {
        var p=state.plan;
        if(!p||state.answers.mode==='local'||!window.DayBuilder||!window.DayBuilder.schedule)return null;
        var sched=window.DayBuilder.schedule();
        if(!sched||!sched.days)return null;
        var ctx=builderContext();
        return sched.days.map(function(day) {
            var info=p.days.find(function(d){return d.date===day.date;});
            var index=p.days.indexOf(info);
            var known={};
            var rows=day.items.map(function(item) {
                var src=window.DayBuilder.sourceOf(item, day.date);
                known[src]=true; known[item.id]=true;
                var card=dayModel(info, index).items.find(function(it){return it.id===src;});
                var edit=(state.edits.items||{})[src]||{};
                var title=(ctx.titleFor&&ctx.titleFor(src, day.date, item))||item.title;
                var desc=edit.desc||(card&&card.desc)||item.detail||'';
                if(edit.note)desc+=(desc?'\n':'')+'Note: '+edit.note;
                var start=item.start, end=item.end, time='';
                if(item.flight&&sched.flightTime){
                    start=parseClock(sched.flightTime); end=start==null?null:start+60; time=sched.flightTime;
                } else if(item.start!=null&&item.end!=null) {
                    time=window.DayBuilder.range(item.start, item.end);
                } else time=item.textTime||'';
                return {id:item.id, title:title, desc:desc, time:time, start:start, end:end, kind:item.kind||(card&&card.kind), location:(card&&(card.location||card.address))||''};
            });
            return {date:day.date, theme:info.theme, items:info.items, rows:rows};
        });
    }
    function staticPlanBody(p) {
        return p.days.map(function(d) {
            return dateLabel(d.date)+' — '+d.theme+'\n'+d.items.filter(function(it) {
                return(state.edits.removed||[]).indexOf(it.id)<0;
            }).map(function(it) {
                var e=(state.edits.items|| {})[it.id]|| {};
                return(e.time||it.time)+' '+(e.title||it.title)+'\n'+(e.desc||it.desc)+(e.note?'\nNote: '+e.note:'');
            }).join('\n');
        }).join('\n\n');
    }
    function planText() {
        var p=state.plan;
        if(!p)return '';
        var built=builderExport();
        var body=built?built.map(function(day) {
            return dateLabel(day.date)+' — '+day.theme+'\n'+day.rows.map(function(row) {
                return (row.time?row.time+' ':'')+row.title+(row.desc?'\n'+row.desc:'');
            }).join('\n');
        }).join('\n\n'):staticPlanBody(p);
        return p.title+'\n'+p.meta+'\n'+p.stay+'\n'+p.banner+'\n'+body;
    }
    function copyPlan() {
        var text=planText();
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
    function earn(action) {}
    function visibleItems(day,i){
        // Use the same renderer as the list so relax mode and edited times stay in sync.
        var holder=document.createElement('div');holder.innerHTML=dayHTML(day,i);
        return Array.from(holder.querySelectorAll('[data-item-id]')).map(function(el){
            return {id:el.dataset.itemId,title:el.querySelector('h3').textContent,time:el.querySelector('time').textContent,
                desc:Array.from(el.querySelectorAll('.item > p')).map(function(p){return p.textContent;}).join('\n')};
        });
    }
    function icsEscape(value){return String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
    function foldICS(line){var lines=[],part='',bytes=0;Array.from(line).forEach(function(c){var n=new TextEncoder().encode(c).length;if(bytes+n>75){lines.push(part);part=' ';bytes=1;}part+=c;bytes+=n;});lines.push(part);return lines.join('\r\n');}
    function buildICS(){
        if(!state.plan)return '';
        var p=state.plan, oahu=isOahuPlan(p);
        var lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//GoNow//Trip planner//EN','CALSCALE:GREGORIAN'];
        if(oahu)lines.push('BEGIN:VTIMEZONE','TZID:Pacific/Honolulu','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:-1000','TZOFFSETTO:-1000','TZNAME:HST','END:STANDARD','END:VTIMEZONE');
        function event(day,id,title,desc,start,end,allDay){
            lines.push('BEGIN:VEVENT','UID:'+icsEscape(p.id+'-'+id)+'@gonow','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'),
                'DTSTART'+(allDay?';VALUE=DATE':oahu?';TZID=Pacific/Honolulu':'')+':'+start,
                'DTEND'+(allDay?';VALUE=DATE':oahu?';TZID=Pacific/Honolulu':'')+':'+end,
                'SUMMARY:'+icsEscape(title),'DESCRIPTION:'+icsEscape(desc));
            var original=day.items.concat(Object.values(state.edits.added||{}).flat()).find(function(it){return it.id===id;});
            if(original&&(original.location||original.address||original.kind==='stay'))lines.push('LOCATION:'+icsEscape(original.location||original.address||p.stay));
            lines.push('END:VEVENT');
        }
        function stampOn(date, minutes){var d=new Date(date+'T00:00:00Z');d.setUTCMinutes(minutes);return d.toISOString().slice(0,19).replace(/[-:]/g,'');}
        var built=builderExport();
        if(built){
            built.forEach(function(day,i){
                var timed=day.rows.filter(function(row){return row.start!=null;});
                if(!timed.length){
                    if(day.rows.length){var next=new Date(day.date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);event(day,'day-'+i,day.theme,day.rows.map(function(row){return row.title+'\n'+row.desc;}).join('\n'),day.date.replace(/-/g,''),next.toISOString().slice(0,10).replace(/-/g,''),true);}
                    return;
                }
                timed.forEach(function(row){
                    var end=row.end!=null&&row.end>row.start?row.end:row.start+60;
                    event(day,row.id,row.title,row.desc,stampOn(day.date,row.start),stampOn(day.date,end),false);
                });
            });
        } else p.days.forEach(function(day,i){
            var items=visibleItems(day,i),timed=0;
            items.forEach(function(it){var m=it.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);if(!m)return;
                var h=Number(m[1])%12+(/pm/i.test(m[3])?12:0),minutes=h*60+Number(m[2]);
                function stamp(offset){var d=new Date(day.date+'T00:00:00Z');d.setUTCMinutes(minutes+offset);return d.toISOString().slice(0,19).replace(/[-:]/g,'');}
                // End at the next timed stop, or one hour later if no end is supplied.
                var next=items.slice(items.indexOf(it)+1).map(function(x){return x.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);}).find(Boolean);
                var end=next?(Number(next[1])%12+(/pm/i.test(next[3])?12:0))*60+Number(next[2])-minutes:60;
                event(day,it.id,it.title,it.desc,stamp(0),stamp(end>0?end:60),false);timed++;
            });
            if(!timed&&items.length){var next=new Date(day.date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);event(day,'day-'+i,day.theme,items.map(function(it){return it.title+'\n'+it.desc;}).join('\n'),day.date.replace(/-/g,''),next.toISOString().slice(0,10).replace(/-/g,''),true);}
        });
        lines.push('END:VCALENDAR');return lines.map(foldICS).join('\r\n')+'\r\n';
    }
    var printSnapshot;
    function beginPlanPrint(){
        if(!state.plan||printSnapshot)return;
        printSnapshot={tab:state.tab,details:[]};
        if(state.tab!=='plan'){state.tab='plan';planRender(false);}
        if(mergedPlan())window.DayBuilder.print(true);
        view.querySelectorAll('details').forEach(function(d){printSnapshot.details.push([d,d.open]);d.open=true;});
    }
    window.addEventListener('beforeprint',beginPlanPrint);
    function endPlanPrint(){if(window.DayBuilder&&window.DayBuilder.print)window.DayBuilder.print(false);if(!printSnapshot)return;printSnapshot.details.forEach(function(pair){pair[0].open=pair[1];});if(state.tab!==printSnapshot.tab){state.tab=printSnapshot.tab;planRender(false);}printSnapshot=null;}
    window.addEventListener('afterprint',endPlanPrint);
    var printMedia=window.matchMedia('print');
    printMedia.addEventListener('change',function(e){if(e.matches)beginPlanPrint();else endPlanPrint();});
    function downloadICS(){
        var url=URL.createObjectURL(new Blob([buildICS()],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');
        a.href=url;a.download='gonow-'+Engine.matchDestination(state.answers.destination).id+'-'+state.plan.days[0].date+'.ics';document.body.append(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);earn('Downloaded a calendar');
    }
    function encodeTrip(data){var bytes=new TextEncoder().encode(JSON.stringify(data)),binary='';bytes.forEach(function(b){binary+=String.fromCharCode(b);});return 'j.'+btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
    function shareTrip(){
        var data={answers:state.answers,edits:state.edits,id:state.plan.id};
        if(window.DayBuilder){var builder=window.DayBuilder.exportState();if(builder)data.db=builder;}
        var url=location.href.split('#')[0]+'#trip='+encodeTrip(data);
        showModal('Share & export', 'Anyone with this link can open a copy. Packing ticks stay private.<label>Trip link<input readonly data-testid="share-url" value="'+esc(url)+'"></label>',[{text:'Close'}]);
        var field=get('share-url');field.onclick=function(){field.select();};field.select();
        if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).catch(function(){});
        earn('Created a share link');
    }
    function restoreShared(){
        try{
            var raw=location.hash.slice(6);if(raw.length>30000||raw.slice(0,2)!=='j.')throw new Error('format');
            var b=atob(raw.slice(2).replace(/-/g,'+').replace(/_/g,'/'));
            var data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(b,function(c){return c.charCodeAt(0);})));
            if(!data||!data.answers||typeof data.answers.destination!=='string'||!data.answers.destination||!data.edits||typeof data.edits!=='object'||Array.isArray(data.edits))throw new Error('data');
            var edits=data.edits;
            ['removed','todos'].forEach(function(k){if(edits[k]&&(!Array.isArray(edits[k])||!edits[k].every(function(x){return typeof x==='string';})))throw new Error('edits');});
            ['items','added','relax','rain'].forEach(function(k){if(edits[k]&&(typeof edits[k]!=='object'||Array.isArray(edits[k])))throw new Error('edits');});
            Object.values(edits.items||{}).forEach(function(it){if(!it||typeof it!=='object')throw new Error('item');});
            Object.values(edits.added||{}).forEach(function(items){if(!Array.isArray(items)||!items.every(function(it){return it&&typeof it.id==='string'&&typeof it.title==='string'&&typeof it.time==='string';}))throw new Error('added');});
            var a=Object.assign({},defaults,normalizeAnswers(data.answers));
            if(!Array.isArray(a.ages)||!Array.isArray(a.styles)||!Array.isArray(a.foodLoves)||!(a.length>=2&&a.length<=30)||(!a.flexible&&(!/^\d{4}-\d{2}-\d{2}$/.test(a.start)||!/^\d{4}-\d{2}-\d{2}$/.test(a.end)||!(new Date(a.end)>=new Date(a.start))||(new Date(a.end)-new Date(a.start)>29*864e5))))throw new Error('answers');
            if(data.db!==undefined&&(!data.db||typeof data.db!=='object'||Array.isArray(data.db)))throw new Error('builder');
            state.shared=true;state.sharedEdits=data.edits;state.sharedBuilder=data.db||null;state.answers=a;openingDemo=data.id==='oahu-demo-2026-11';generate(true);
        }catch(e){state.shared=true;state.answers=Object.assign({},defaults);go('start');view.insertAdjacentHTML('afterbegin','<p class="banner" role="status">This trip link couldn’t be opened. Start a new adventure below.</p>');}
    }
    var leafletMap, stopLayers;
    function expeditionUI(){
        if(leafletMap&&!leafletMap.getContainer().isConnected){leafletMap.remove();leafletMap=stopLayers=null;}
        var shell=view.querySelector('.shell');
        if(state.shared){shell.insertAdjacentHTML('afterbegin','<aside class="banner" data-testid="shared-banner">Shared trip — view only copy; changes stay on this device '+btn('Make it mine','adopt-shared','outline')+'</aside>');on('adopt-shared',function(){if(window.DayBuilder&&window.DayBuilder.persist)window.DayBuilder.persist();state.shared=false;state.sharedBuilder=null;var prep=prepRecord();prep.seen=true;savePrep(prep);save();persistEdits();write(KEY+'lastTrip',{answers:state.answers});history.replaceState({screen:'plan'},'','#plan');planRender(false);});}
        shell.insertAdjacentHTML('beforeend','<p class="stamped-footer '+(state.shared?'shared-stamp':'')+'" data-testid="stamped-footer">Planned with GoNow · maogy127.github.io/ai-travel-planner</p>');
        var toolbar=get('print-plan').closest('footer');toolbar.setAttribute('aria-label','Share & export');toolbar.insertAdjacentHTML('afterbegin','<strong>Share & export</strong>');
        if(state.tab!=='plan')return;
        var pref;try{pref=localStorage.getItem(KEY+'view');}catch(e){}
        var map= !state.shared&&pref==='map';
        var content=document.getElementById('tab-content');
        content.insertAdjacentHTML('afterbegin','<div class="view-switch row" role="group" aria-label="Itinerary view">'+btn('List','view-list','outline','aria-pressed="'+!map+'"')+btn('Map','view-map','outline','aria-pressed="'+map+'"')+'</div><section id="treasure-map" class="treasure-map" data-testid="treasure-map" '+(!map?'hidden':'')+'><h2>Your day on the map</h2><div class="row" aria-label="Map day">'+state.plan.days.map(function(d,i){return btn('Day '+(i+1)+' · '+d.date,'map-day-select','outline','data-map-select="'+i+'" aria-pressed="'+(i===0)+'"');}).join('')+'</div><p data-testid="map-fallback" hidden></p><div data-testid="trip-map" aria-label="Selected day itinerary map"></div><p data-testid="map-tile-error" role="status" hidden>Map tiles couldn&#39;t load (offline?). Pins and the stop list still work.</p><ol data-testid="map-stop-list"></ol><h3>Jump to a day in List</h3><ol>'+state.plan.days.map(function(d,i){return '<li>'+btn('Day '+(i+1)+' · '+d.date+' · '+esc(d.theme),'map-day','outline','data-map-day="'+i+'"')+'</li>';}).join('')+'</ol></section>');
        var mapDay=0, mapBox=get('trip-map');
        function drawMap(){
            if(!map || !mapBox.isConnected)return;
            if(leafletMap&&leafletMap.getContainer()!==mapBox){leafletMap.remove();leafletMap=stopLayers=null;}
            var day=state.plan.days[mapDay], geo=window.GONOW_GEO||{places:{},demoItems:{},builderPlaces:{}};
            var demo=state.plan.id==='oahu-demo-2026-11';
            var schedule=window.DayBuilder&&window.DayBuilder.schedule();
            var built=schedule&&schedule.days.find(function(d){return d.date===day.date;});
            var items=built?built.items:dayModel(day,mapDay).items;
            var resolve=function(it){return demo&&(geo.demoItems[it.sourceId||it.id]||geo.builderPlaces[it.place]);};
            // Airport travel is a real start/end stop; omit other travel and prep.
            var stops=items.filter(function(it){return it.kind!=='prep'&&(it.kind!=='travel'||resolve(it)==='hnl');});
            var groups=[], lastKey;
            stops.forEach(function(it){
                var key=resolve(it), place=geo.places[key];
                var row={title:it.title,time:built?(it.start!=null&&it.end!=null?window.DayBuilder.range(it.start,it.end):it.flight?(it.textTime==='Add flight time'?'5:30 PM':it.textTime):it.textTime||''):it.time||''};
                if(place&&key===lastKey)groups[groups.length-1].rows.push(row);
                else groups.push({key:key,place:place,rows:[row]});
                lastKey=place?key:null;
            });
            var number=0;
            get('map-stop-list').innerHTML=groups.map(function(g){g.number=g.place?++number:null;return '<li>'+ (g.number?'Stop '+g.number+' · ':'')+g.rows.map(function(r){return esc(r.time)+' '+esc(r.title);}).join('<br>')+(g.place?(g.place.approx?' <small>Approximate location</small>':''):' <small>not on map</small>')+'</li>';}).join('');
            var fallback=get('map-fallback'), box=get('trip-map');
            fallback.hidden=!!window.L&&number>0;
            fallback.textContent=!window.L?"Map couldn't load — here are today's stops in order.":'No coordinates available for these stops. Here they are in order.';
            box.hidden=!window.L||!number;
            if(!window.L||!number){if(leafletMap)leafletMap.closePopup();if(stopLayers)stopLayers.clearLayers();return;}
            if(!leafletMap){
                leafletMap=L.map(box);stopLayers=L.featureGroup().addTo(leafletMap);
                var failures=0;
                L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',function(){if(++failures>=3)get('map-tile-error').hidden=false;}).addTo(leafletMap);
            }
            leafletMap.closePopup();
            stopLayers.clearLayers();var points=[];
            groups.forEach(function(g){if(!g.place)return;var pt=[g.place.lat,g.place.lng];points.push(pt);
                L.marker(pt,{title:'Stop '+g.number+': '+g.rows.map(function(r){return r.title;}).join(', '),icon:L.divIcon({className:'map-pin',html:String(g.number),iconSize:[44,44],iconAnchor:[22,22]})}).bindPopup(g.rows.map(function(r){return '<strong>'+esc(r.title)+'</strong><br>'+esc(r.time);}).join('<hr>')).addTo(stopLayers);
            });
            if(points.length>1)L.polyline(points,{color:'#C2603E',className:'map-route-line'}).addTo(stopLayers);
            leafletMap.invalidateSize();leafletMap.fitBounds(L.latLngBounds(points),{padding:[30,30],maxZoom:15});
        }
        view.querySelectorAll('[data-map-select]').forEach(function(b){b.onclick=function(){mapDay=+b.dataset.mapSelect;view.querySelectorAll('[data-map-select]').forEach(function(el){el.setAttribute('aria-pressed',String(el===b));});drawMap();};});
        function setMap(value,persist){map=value;if(value)requestAnimationFrame(drawMap);get('treasure-map').hidden=!value;var days=content.querySelector('.itinerary-days');if(days)days.hidden=value;if(content.querySelector('.daynav'))content.querySelector('.daynav').hidden=value;var builder=content.querySelector('.db-root');if(builder)builder.hidden=value;get('view-list').setAttribute('aria-pressed',String(!value));get('view-map').setAttribute('aria-pressed',String(value));if(persist){try{localStorage.setItem(KEY+'view',value?'map':'list');}catch(e){}if(value)earn('Viewed the map');}}
        setMap(map,false);on('view-map',function(){setMap(true,true);});on('view-list',function(){setMap(false,true);});
        view.querySelectorAll('[data-map-day]').forEach(function(b){b.onclick=function(){setMap(false,true);if(mergedPlan()&&window.DayBuilder.selectedDate){var date=state.plan.days[b.dataset.mapDay].date;window.DayBuilder.selectDay(date,false);var chip=document.querySelector('[data-testid="db-day-'+date+'"]'),card=document.querySelector('.db-daycard');(card||chip).scrollIntoView({block:'start',behavior:'auto'});chip.focus({preventScroll:true});return;}var t=document.querySelector('#day-'+b.dataset.mapDay);if(!t)return;t.tabIndex=-1;t.scrollIntoView({block:'start',behavior:'auto'});t.focus({preventScroll:true});};});
    }
    function render() {
        if(state.screen==='prep')prepScreen();
        else if(state.screen==='credits')creditsScreen();
        else if(state.screen==='home')home();
        else if(state.screen==='local-plan')localPlan();
        else if(state.screen==='pick-activities'||state.screen==='pick-food')pickScreen();
        else if(state.screen==='draft')draftScreen();
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
        if(['plan','draft','prep','local-plan'].includes(state.screen))pruneEmptySections(view);
    }
    document.getElementById('photo-credits').onclick=function() {
        if(state.screen==='credits')return;
        state.creditsFrom=state.screen==='loading'?'fork':state.screen;
        go('credits');
    };
    document.getElementById('restart').onclick=function() {
        activeGeneration++;
        var wasShared=state.shared; state.shared=false;
        if(!wasShared){
        erase(KEY+'answers');
        erase(KEY+'lastTrip');
        }
        state.answers=Object.assign( {}, defaults,  {
            ages:[], styles:[], food:[]
        });
        state.plan=null;
        state.excluded=[];
        state.recOffset=0;
        go('home');
    };
    document.querySelector('.logo').onclick=function(e) {
        e.preventDefault();
        state.viewing='live';
        newTripFlow=false;
        go('home');
    };
    window.__gonow= {
        state:state, go:go, isOahuPlan:isOahuPlan, isPickPlan:isPickPlan, buildICS:buildICS, planText:planText
    };
    window.addEventListener('hashchange',function(){if(location.hash.indexOf('#trip=')===0)restoreShared();});
    if(location.hash.indexOf('#trip=')===0)restoreShared();
    else {
        migrateLegacyTrip();
        newTripFlow=false;go('home');
    }
}
());

/* Print: open every disclosure so printed plans include all details; restore afterwards. */
(function(){var opened=[];window.addEventListener('beforeprint',function(){opened=[].slice.call(document.querySelectorAll('details:not([open])'));opened.forEach(function(d){d.open=true;});});window.addEventListener('afterprint',function(){opened.forEach(function(d){d.open=false;});opened=[];});}());
