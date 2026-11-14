(function() {
    'use strict';
  function travelIcon(t){ t=String(t||'').toLowerCase(); if(/uber|lyft|rideshare|taxi|ride/.test(t)) return ''+icon('transport')+''; if(/shuttle|bus|transit/.test(t)) return ''+icon('transport')+''; if(/walk/.test(t)) return ''+icon('who')+''; return ''+icon('transport')+''; }
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
        bedtime:'', wake:'', diet:[], dietNotes:'', dayPaces:{}, travelers:[], level:'unsure', activities:[], origin:'', destination:'', unsure:false, start:'', end:'', flexible:false, length:5, month:11, budget:null, includeFlights:true, covers:['flights','hotel','food','activities','transport'], completed:[], who:'', ages:[], adults:2, kids:0, styles:[], food:[], allergies:'', pace:'Moderate', mustdos:'', stay:''
    };
    function normalizePace(a){
        if(!a.level)a.level=({'Easy':'gentle','Moderate':'active','Full-on':'athlete'})[a.pace]||'unsure';
        a.pace=({gentle:'Easy',active:'Moderate',athlete:'Full-on',unsure:'Moderate'})[a.level]||'Moderate';
        return a;
    }
    var state= {
        screen:'start', answers:Object.assign({}, defaults, normalizePace(read(KEY+'answers',{}))), plan:null, tab:'plan', recOffset:0, excluded:[], edits: {}, packed: {}, packMeta: {}, hidePacked:false
    };
    if(!read(KEY+'answers',{}).covers&&state.answers.includeFlights===false)state.answers.covers=defaults.covers.filter(function(k){return k!=='flights';});
    var steps=['dates', 'budget', 'who', 'ages', 'style'], extra=['food', 'pace', 'musts'];
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
        normalizePace(state.answers);
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
        var image=dest.id==='custom'?'images/hero.jpg':'images/'+dest.id+'.jpg';
        var visual=state.answers.templateOahu&&dest.id==='oahu'?'':photo(image, p.title, 'banner-photo');
        if(visual){ var bid=image.split('/').pop().replace('.jpg',''); var bc=window.PHOTO_CREDITS.find(function(c){return c.id===bid;}); visual+='<div class="banner-credit">'+creditHTML(bc)+'</div>'; }
        return'<header class="plan-header">'+visual+'<div class="plan-title"><div class="eyebrow">YOUR NEXT CHAPTER, ALL PLANNED</div>'+heading(esc(p.title), esc(p.meta))+'<p>'+icon('hotel')+' Staying: '+esc(p.stay)+'</p><small>Local times'+(dest.id==='oahu'?' · Hawaii Standard Time (HST)':'')+'</small><div class="row">'+btn('Change my answers', 'change-answers', '')+btn('Reset my edits', 'reset-edits', '')+'</div></div></header>';
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
                safety:''+icon('info')+'', eco:''+icon('style')+'', health:''+icon('info')+'', age:''+icon('ages')+''
            }
            [p.type]||'•')+' '+esc(p.text)+sources(p.sources)+'</div>';
        }).join('')+(books.length?'<aside class="warning before-you-go"><strong>'+icon('dates')+' Before you go</strong><ul>'+books.map(function(p) {
            return'<li>'+esc(p.text)+sources(p.sources)+'</li>';
        }).join('')+'</ul></aside>':'');
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
        if((target==='plan'||target==='draft')&&!state.plan)target='home';
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
        view.innerHTML='<div class="shell"><div class="start-grid"><section class="intro"><div class="eyebrow">MOVE YOUR WAY.</div>'+heading('Come home better than you left.', 'Beautifully planned days that make room for movement, calm and sleep.')+'<div class="form-stack"><div>'+(a.unsure?'<div class="row banner" style="margin:0">Surprise me ✓ '+btn('Change', 'start-change', '')+'</div>':'<label class="field-label" for="to">Where do you want to go?</label><label class="destination-label"><input id="to" data-testid="start-to" placeholder="City, region or country" value="'+esc(a.destination)+'"></label><div class="error" id="dest-error" role="alert"></div>'+btn("I'm not sure yet", 'start-unsure', 'outline full')+'<small>Tell us a few things and we’ll suggest three places.</small>')+'</div><div><label class="field-label" for="from">Where are you flying from?</label><input id="from" data-testid="start-from" placeholder="City or airport (e.g., Seattle, SEA)" value="'+esc(a.origin)+'" autocomplete="off"><small>We use this to estimate flights.</small><div class="error" id="origin-error" role="alert"></div></div>'+btn('Next <span aria-hidden="true">↗</span>', 'start-next', 'primary full')+'</div><div class="demo"><div class="eyebrow">A LITTLE INSPIRATION</div><strong>Try the demo: Oahu, Nov 25–29</strong><p>Couple aged 18 & 19 · The Kahala Hotel & Resort</p>'+btn('Open the Oahu sample ↗', 'demo-oahu', 'outline full')+'</div><p class="footer-note">Free to use. Your answers stay on this device until you save.</p></section>'+photo('images/hero.jpg', 'A sunlit island coastline, an invitation to slow down', 'hero-photo', '<div class="photo-caption"><span class="eyebrow" style="color:white">YOUR NEXT CHAPTER</span><strong>Somewhere feels like you.</strong><span>We’ll help you find it.</span></div>')+'</div><div class="start-footer"><span>'+icon('style')+' Made for your kind of travel</span><span>Thoughtful plans, down to the little things</span><span>Always yours to change</span></div></div>';
        view.querySelector('.hero-photo').remove();
        view.querySelector('.form-stack').insertAdjacentHTML('beforebegin',wellnessPicker());
        bindWellness();
        if(get('start-to'))setupVoice('start-to','start-');
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
        state.tripId=null;
        state.answers=Object.assign( {}, defaults,  {
            level:state.answers.level, activities:state.answers.activities, origin:'Los Angeles (LAX)', destination:'Oahu', unsure:false, start:'2026-11-25', end:'2026-11-29', budget:6000, budgetChoice:'5000+', who:'couple', ages:[18, 19], styles:['relaxing', 'scenic'], mustdos:'Diamond Head, Kualoa Ranch, intro dive, parasailing, birthday dinner 11/26 7:30 PM, Black Friday shopping', stay:'The Kahala Hotel & Resort', personal:true
        });
        save();
        generate();
    }
    var TRIPS='gonow:trips';
    function readTrips(){try{var list=JSON.parse(localStorage.getItem(TRIPS));return Array.isArray(list)?list:[];}catch(e){return [];}}
    function writeTrips(list){try{localStorage.setItem(TRIPS, JSON.stringify(list));}catch(e){}}
    function cloneData(value){return JSON.parse(JSON.stringify(value||null));}
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
    function rememberTrip(){
        if(!state.plan||state.shared)return;
        var list=readTrips();
        var trip=list.find(function(t){return t.id===state.tripId;});
        if(!trip){
            state.tripId='trip-'+Date.now().toString(36);
            trip={id:state.tripId, snapshot:null};
            list.unshift(trip);
        }
        trip.destination=state.answers.destination||state.plan.title;
        trip.start=state.answers.start||state.plan.start||'';
        trip.end=state.answers.end||state.plan.end||'';
        trip.title=state.plan.title;
        trip.planId=state.plan.id;
        trip.answers=cloneData(state.answers);
        if(!trip.snapshot&&window.DayBuilder){
            trip.snapshot={builder:window.DayBuilder.exportState(), edits:cloneData(state.edits), packed:cloneData(state.packed), at:new Date().toISOString(), weather:weatherBlock()};
        }
        writeTrips(list);
    }
    function migrateLegacyTrip(){
        var answers=read(KEY+'answers', null);
        var last=read(KEY+'lastTrip', null);
        if(!answers||!answers.destination||state.shared)return;
        var list=readTrips();
        if(list.length)return;
        list.push({id:'legacy-'+String(answers.destination).toLowerCase().replace(/\s+/g,'-'), legacy:true, destination:answers.destination, start:answers.start||'', end:answers.end||'', title:answers.destination, planId:(last&&last.id)||'', answers:answers, snapshot:null});
        writeTrips(list);
        state.tripId=list[0].id;
    }
    function openSaved(id, mode){
        var trip=readTrips().find(function(t){return t.id===id;});
        if(!trip)return;
        state.tripId=id;
        state.answers=Object.assign({}, defaults, normalizePace(trip.answers||{}));
        save();
        state.viewing=mode==='finished'?'finished':'live';
        if(mode==='finished'&&!trip.snapshot)return;
        if(state.plan&&state.plan.id===trip.planId&&mode!=='finished'){
            state.edits=read(KEY+'edits:'+state.plan.id, {});
            go(mode==='draft'?'draft':'plan');
            return;
        }
        state.afterPlan=mode==='draft'?'draft':'plan';
        generate(true);
    }
    function wellnessPicker(){
        var a=state.answers;
        return '<fieldset data-testid="pace-picker"><legend>What pace feels right for you?</legend><p class="muted">Change it any time.</p><div class="pace-options">'+[['gentle','Gentle','Easy walks, stretching, yoga and meditation.'],['active','Active','Jogs, hikes and classes a few times a week.'],['athlete','Athlete','Long runs, rides and strength sessions.'],['unsure',"Not sure? We&#39;ll adjust",'We will start in the middle.']].map(function(o){return '<label class="pace-option"><input type="radio" name="wellness-level" data-testid="pace-option" data-value="'+o[0]+'" value="'+o[0]+'" '+(a.level===o[0]?'checked':'')+'><span><strong>'+o[1]+'</strong><small>'+o[2]+'</small></span></label>';}).join('')+'</div></fieldset><fieldset><legend>What would you love to do?</legend><div class="activity-chips">'+['Walking','Pilates','Yoga','Meditation','Running','Hiking','Cycling','Strength','Swimming'].map(function(name){return '<button type="button" data-testid="activity-chip" data-value="'+name.toLowerCase()+'" aria-pressed="'+(a.activities||[]).includes(name.toLowerCase())+'">'+name+'</button>';}).join('')+'</div></fieldset>';
    }
    function bindWellness(){
        view.querySelectorAll('[data-testid=pace-option]').forEach(function(el){el.onchange=function(){state.answers.level=el.value;save();};});
        view.querySelectorAll('[data-testid=activity-chip]').forEach(function(el){el.onclick=function(){var values=state.answers.activities||[];state.answers.activities=values.includes(el.dataset.value)?values.filter(function(v){return v!==el.dataset.value;}):values.concat(el.dataset.value);el.setAttribute('aria-pressed',String(state.answers.activities.includes(el.dataset.value)));save();};});
    }
    function home(){
        migrateLegacyTrip();
        var trips=readTrips();
        var cards=trips.map(function(t){
            var when=(t.start&&t.end)?dateLabel(t.start)+' – '+dateLabel(t.end):'Dates not set';
            return '<article class="card saved-trip" data-testid="saved-trip"><h2>'+esc(t.destination||t.title||'Trip')+'</h2><p>'+esc(when)+'</p><p class="footer-note">Saved on this device. Not uploaded.</p><div class="row">'+btn('Edit draft','edit-draft','outline','data-trip="'+esc(t.id)+'"')+btn('View finished plan','view-finished','outline','data-trip="'+esc(t.id)+'"'+(t.snapshot?'':' disabled'))+'</div></article>';
        }).join('');
        view.innerHTML='<div class="shell home-screen" data-testid="home-screen"><div class="wellness-hero"><section class="intro"><p class="eyebrow">WELLNESS IS PART OF THE JOURNEY</p>'+heading('Come home better than you left.','Beautifully planned days that make room for movement, calm and sleep.')+wellnessPicker()+'<label class="field-label" for="home-destination">Where would you like to go?</label><label class="destination-label"><input id="home-destination" data-testid="home-destination" placeholder="City, region or country" value="'+esc(state.answers.destination)+'"></label><div class="row">'+(trips.length?btn('Continue saved trip','continue-saved','outline'):'')+btn('Start planning','start-new-trip','primary')+'</div>'+'<p data-testid="storage-note" class="footer-note">Saved on this device only. There is no account and nothing is uploaded.</p></section>'+''+'</div>'+(trips.length?'<section class="saved-trips"><h2>Your trips</h2>'+cards+'</section>':'<p class="muted">First visit — no saved trips yet.</p>')+'<div class="demo"><strong>A little inspiration: Oahu</strong><p>Nov 25–29 · couple, ages 18 and 19.</p>'+btn('Open the Oahu sample ↗','demo-oahu','outline')+'</div></div>';
        bindWellness();
        on('home-destination',function(e){state.answers.destination=e.target.value;state.answers.unsure=false;save();},'input');
        setupVoice('home-destination','home-');
        on('start-new-trip', function(){state.tripId=null;state.viewing='live'; go('start');});
        on('continue-saved', function(){if(trips[0])openSaved(trips[0].id,'plan');});
        on('demo-oahu', demo);
        view.querySelectorAll('[data-testid=edit-draft]').forEach(function(b){b.onclick=function(){openSaved(b.dataset.trip,'draft');};});
        view.querySelectorAll('[data-testid=view-finished]').forEach(function(b){if(b.disabled)return; b.onclick=function(){openSaved(b.dataset.trip,'finished');};});
    }
    function libraryEntries(){
        var entries=[];
        var ages=(state.answers.ages||[]).map(Number).filter(function(n){return n>0;});
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
            entries.push({id:'opt-dinner', title:'Hotel dinner with optional drinks', place:'Kahala', duration:90, estimate:true, rules:[rule('Alcohol is 21+. The dinner itself is still available without it.', {optional:true, minAge:21, source:'23 U.S.C. § 158, national minimum drinking age', url:'https://www.law.cornell.edu/uscode/text/23/158'})]});
        }
        var dest=Engine.matchDestination(state.answers.destination||'');
        if(dest&&dest.activities){
            Object.keys(dest.activities).forEach(function(style){
                (dest.activities[style]||[]).forEach(function(title){
                    if(entries.some(function(e){return e.title===title;}))return;
                    entries.push({id:'cat-'+dest.id+'-'+title.toLowerCase().replace(/[^a-z0-9]+/g,'-'), title:title, place:dest.name, duration:90, estimate:true, rules:[rule('Requirements for this catalog idea are unconfirmed. It is not a checked operator.', {unconfirmed:true, source:'GoNow destination catalog'})]});
                });
            });
        }
        if(window.DayBuilder)window.DayBuilder.draftItems().forEach(function(item){
            var source=item.sourceId||item.id;
            if(entries.some(function(e){return e.sourceId===source&&e.title===item.title;}))return;
            entries.push({id:'draft-'+source, sourceId:source, kind:item.kind, desc:item.desc, tags:item.tags, title:item.title, place:item.place, duration:item.duration, estimate:item.estimate, rules:[]});
        });
        entries.forEach(function(entry){
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
        }).join('')+(entry.blocked?'<p data-testid="activity-block">'+esc(entry.blocked)+'</p>':'');
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
                else timeCard.querySelector('[data-time-choices]').innerHTML='<p>Choose a scheduled instance:</p>'+instances.map(function(i){return '<button type="button" data-testid="activity-time-choice" data-date="'+esc(i.date)+'" data-instance="'+esc(i.id)+'">'+esc(dateLabel(i.date))+' · '+esc(i.time)+'</button>';}).join('');
                return;
            }
            var add=e.target.closest('[data-testid=activity-add], [data-testid=activity-add-again]');
            if(!add||add.disabled)return;
            var card=add.closest('[data-testid=activity-result]');
            var entry=libraryEntries().find(function(item){return item.id===card.dataset.id;});
            if(!entry||entry.blocked)return;
            var day=card.querySelector('[data-testid=activity-day]').value;
            var result=window.DayBuilder.addToDay(day, {chestId:entry.chestId, sourceId:entry.sourceId||entry.id, title:entry.title, place:entry.place, duration:entry.duration, time:card.querySelector('[data-testid=activity-add-time]').value, rules:entry.rules, tags:entry.tags});
            var note=card.querySelector('[data-testid=activity-add-note]');
            if(note)note.textContent=result&&result.ok?'Added to the draft. This does not book it or confirm availability.':(result&&result.reason)||'Could not add';
        });
        aside.addEventListener('dragstart', function(e){
            var card=e.target.closest('[data-testid=activity-result]');
            if(!card||card.draggable===false){e.preventDefault();return;}
            e.dataTransfer.setData('text/gonow-activity', card.dataset.id);
        });

    }
    function renderLibraryResults(aside, query){
        var q=String(query||'').trim().toLowerCase();
        var all=window.GoNowDiet.rank(libraryEntries(),state.answers.diet);
        var list=all.filter(function(entry){return q&&(entry.title+' '+entry.place).toLowerCase().indexOf(q)>=0;});
        var days=state.plan?state.plan.days:[];
        var dayOpts=days.map(function(d){return '<option value="'+esc(d.date)+'">'+esc(dateLabel(d.date))+'</option>';}).join('');
        var host=aside.querySelector('[data-testid=activity-results]');
        if(!q){host.innerHTML='';return;}
        if(!list.length){
            host.innerHTML='<p data-testid="activity-no-results">No matches in the on-device library. This is not a live worldwide search.</p>';
            return;
        }
        host.innerHTML=list.map(function(entry){
            var photoSrc=entry.sourceId&&ITEM_PHOTOS[entry.sourceId];
            var img=photoSrc?photo(photoSrc, entry.title, 'library-photo'):'<p class="activity-fallback">'+icon('info')+' '+esc(entry.title)+' in '+esc(entry.place)+'. No verified activity photo.</p>';
            var exists=window.DayBuilder.draftItems().some(function(i){return (i.sourceId||i.id)===(entry.sourceId||entry.id);});
            return '<article class="library-card" data-testid="activity-result" data-id="'+esc(entry.id)+'" draggable="'+(!entry.blocked)+'"><h3>'+esc(entry.title)+'</h3>'+(entry.blocked?'<p>'+esc(entry.blocked)+'</p>':'')+dietTag(entry)+'<details><summary>Details</summary>'+img+restrictionHTML(entry)+'</details><label>Day <select data-testid="activity-day">'+dayOpts+'</select></label><label>Optional clock time (AM/PM)<input type="time" data-testid="activity-add-time"></label><button type="button" data-testid="activity-add"'+(entry.blocked?' disabled':'')+'>Add to trip</button>'+(exists?'<button type="button" data-testid="activity-edit-time">Edit scheduled time</button><div data-time-choices></div><button type="button" data-testid="activity-add-again"'+(entry.blocked?' disabled':'')+'>Add again</button>':'')+'<p data-testid="activity-add-note"></p></article>';

        }).join('');
        host.querySelectorAll('[data-testid=activity-day]').forEach(function(select){select.value=window.DayBuilder.selectedDate();});
    }
    function ensureLibrary(aside){
        if(!aside.querySelector('[data-testid=activity-search]')){
            aside.insertAdjacentHTML('afterbegin','<div class="library-search"><p data-testid="search-honesty">Search this device’s activity library for your destination. It is not a live worldwide place search. That would need a places provider and an API key, which this page does not use.</p><label>Search activities<input data-testid="activity-search" type="search" placeholder="Try dive, sunset, walk"></label><div data-testid="activity-results"></div></div>');
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
        db.insertAdjacentHTML('afterend',momentsSummary());
        db.addEventListener('dragover', function(e){if(e.target.closest('[data-testid=db-day-list]'))e.preventDefault();});
        db.addEventListener('drop', function(e){
            if(!e.target.closest('[data-testid=db-day-list]'))return;
            e.preventDefault();
            var entry=libraryEntries().find(function(i){return i.id===e.dataTransfer.getData('text/gonow-activity');});
            if(entry&&!entry.blocked)window.DayBuilder.addToDay(window.DayBuilder.selectedDate(),{chestId:entry.chestId,sourceId:entry.sourceId||entry.id,title:entry.title,place:entry.place,duration:entry.duration, rules:entry.rules, tags:entry.tags, schedule:true});
        });
        on('generate-plan', function(){
            var list=readTrips();
            var trip=list.find(function(t){return t.id===state.tripId;})||{id:state.tripId, snapshot:null};
            if(!list.some(function(t){return t.id===trip.id;}))list.unshift(trip);
            trip.snapshot={builder:window.DayBuilder.exportState(), edits:cloneData(state.edits), packed:cloneData(state.packed), at:new Date().toISOString(), weather:weatherBlock()};
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
        var a=state.answers, s=state.screen, index=steps.indexOf(s), isExtra=extra.indexOf(s)>=0, idx=isExtra?extra.indexOf(s):index, total=isExtra?3:5;
        var copy= {
            dates:['When are you going?', 'Pick your travel dates. Weather and prices depend on them.'], budget:["What’s your budget?", 'Total for everyone. Choose what your budget covers below.'], who:["Who’s coming?", 'This shapes pace, rooms and activities.'], ages:['How old are the travelers?', 'Ages change the plan: rental cars, tours and some activities have age limits.'], style:['What kind of trip do you want?', 'Pick up to two. A third pick swaps out your first.'], food:['What do you like to eat?', "Pick any. We’ll plan meals near where you’re staying."], pace:['A pace that feels like you.', 'Make room for movement, rest and sleep.'], musts:['Anything we must include?', "Bookings, birthdays, places, or things to skip. We’ll fit them in."]
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
        } else if(s==='ages') {
            var count=a.who==='solo'?1:a.who==='couple'?2:Number(a.adults)+Number(a.kids);
            content='<div class="row">'+btn('Everyone is 25+', 'ages-25', 'outline')+btn('Someone is 21–24', 'ages-21', 'outline')+btn('Someone is under 21', 'ages-under', 'outline')+'</div><div class="two">'+Array.from( {
                length:count
            }, function(_, i) {
                return'<label>Traveler '+(i+1)+' age<input type="number" min="0" max="110" data-testid="age-'+i+'" data-age="'+i+'" value="'+esc(a.ages[i]===undefined?'':a.ages[i])+'"></label>';
            }).join('')+'</div>';
        } else if(s==='style') {
            content='<div class="options">'+[['relaxing', ''+icon('style')+' Relaxing', 'Slow mornings, no rush'], ['hotel', ''+icon('hotel')+' Staying at the hotel', 'Pool, spa, great food on site'], ['wandering', ''+icon('style')+' Wandering around', 'Neighborhoods, markets, no fixed plan'], ['scenic', ''+icon('style')+' Scenic spots', 'Views, viewpoints, photo stops'], ['adventure', ''+icon('style')+' Adventure', 'Water, trails, adrenaline']].map(function(r) {
                return option(r[0], r[1], r[2], 'styles', true);
            }).join('')+'</div><p id="style-limit" class="hint" aria-live="polite"></p>';
        } else if(s==='food') {
            content='<div class="options">'+['Local classics', 'Seafood', 'Street food / casual', 'Fine dining', 'Vegetarian', 'Vegan', 'Halal', 'Gluten-free', 'Coffee & bakeries', 'No preference'].map(function(v) {
                return option(v, icon('food')+' '+v, '', 'food', true);
            }).join('')+'</div><label>Allergies or things to avoid (optional)<input data-testid="allergies" value="'+esc(a.allergies)+'"></label>';
        } else if(s==='pace') {
            content=wellnessPicker();
        } else {
            content='<label>Bookings, birthdays and places<textarea data-testid="mustdos" placeholder="e.g., birthday dinner on 11/26 at 7:30 PM">'+esc(a.mustdos)+'</textarea></label><div class="row">'+['Special occasion', 'A booked hotel', 'Shopping', 'Photo spots', 'Water activity', 'A specific tour'].map(function(v, i) {
                return btn(v, 'must-chip-'+i, 'outline', 'data-chip="'+v+'"');
            }).join('')+'</div><label>Where are you staying? (hotel name)<input data-testid="stay" value="'+esc(a.stay)+'"></label>';
        }
        if(s==='food')content+=dietQuestion();
        if(s==='pace')content+=sleepQuestion();
        view.innerHTML='<section class="question"><span class="section-label">YOUR NEXT SOMEWHERE</span><p>Step '+(idx+1)+' of '+total+'</p><div class="progress" role="progressbar" aria-label="Question progress" aria-valuenow="'+(idx+1)+'" aria-valuemin="0" aria-valuemax="'+total+'"><span style="width:'+((idx+1)/total*100)+'%"></span></div>'+heading(copy[0], copy[1])+'<fieldset><legend>'+( {
            dates:'Travel dates', budget:'Total trip budget', who:'Travel group', ages:'Traveler ages', style:'Trip styles', food:'Food preferences', pace:'Daily pace', musts:'Your requests'
        }
        [s])+'</legend>'+content+'</fieldset><div class="qfooter">'+btn('← Back', 'q-back', '')+btn('Skip', 'q-skip', '')+btn(s==='musts'?'Build my plan':s==='style'&&a.unsure?'See my options':'Continue →', 'q-continue', 'primary', validQuestion()?'':'disabled')+'</div></section>';
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
        bindWellness();
        bindWellnessDetails();
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
            nextQuestion(true);
        });
        on('q-continue', function(){nextQuestion(false);});
    }
    function nextQuestion(skipped) {
        if(!skipped&&validQuestion()&&(state.screen!=='food'||state.answers.food.length||state.answers.allergies.trim())&&(state.screen!=='musts'||state.answers.mustdos.trim()||state.answers.stay.trim()))earn('Question: '+state.screen);
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
    function icon(key){
        var paths={dates:'M5 7h14v13H5z M8 4v6 M16 4v6 M5 12h14',budget:'M4 8c0-4 16-4 16 0s-16 4-16 0 M4 8v8c0 4 16 4 16 0V8 M4 12c0 4 16 4 16 0',who:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M2 20v-3c0-5 12-5 12 0v3 M16 5a3 3 0 0 1 0 6 M18 14c4 0 4 3 4 6',ages:'M6 3h12 M6 21h12 M8 3v5l8 8v5 M16 3v5l-8 8v5',style:'M12 2v20 M2 12h20 M16 8l-3 5-5 3 3-5z',flights:'M2 13l8-3V3l3-1 1 8 7 3v2l-7-1v5l3 2H7l3-2v-5l-8 1z',hotel:'M3 20V8 M21 20V8 M3 15h18 M6 9h5v5H6z M13 9h5v5h-5z',food:'M5 3v7c0 3 6 3 6 0V3 M8 3v19 M19 3c-5 3-5 10 0 10V3v19',activities:'M3 6h18v4c-4 0-4 4 0 4v4H3v-4c4 0 4-4 0-4z',transport:'M3 18V11l3-6h12l3 6v7z M3 11h18 M6 18v3 M18 18v3 M6 14h2 M16 14h2',bring:'M6 8h12l2 13H4z M9 8V4h6v4 M8 13h8v5H8z',info:'M12 10v8 M12 6v1 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20'};
        return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" class="line-icon" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[key]||paths.style)+'"/></svg>';
    }
    function passport(){
        var done=state.answers.completed||[], list=extra.includes(state.screen)?extra:steps;
        var index=list.indexOf(state.screen);
        return '<div class="passport" data-testid="stamp-bar" aria-label="Planning progress"><span>'+(index>=0?'Step '+(index+1)+' of '+list.length:'Your plan, at your pace')+'</span>'+list.map(function(k){return '<span class="passport-stamp '+(done.includes(k)?'earned':'unearned')+'" '+(done.includes(k)?'data-testid="stamp"':'')+' aria-label="'+k+(done.includes(k)?' completed':' upcoming')+'">●</span>';}).join('')+'</div>';
    }
    function journal(s){
        var hints={dates:'Leave room for a little discovery.',budget:'Choose what your budget needs to cover.',who:'Make room for everyone traveling with you.',ages:'Ages help us find activities that suit everyone.',style:'Choose up to two ways to spend your time.',food:'Make time for food you enjoy.',pace:'Set a pace that leaves time to enjoy the view.',musts:'Tell us what would make this trip feel like yours.'};
        var page=view.querySelector('.question');
        page.insertAdjacentHTML('afterbegin',passport()+'<div class="guide" data-testid="guide" aria-live="polite"><span>'+hints[s]+'</span></div>');
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
        var amounts=curated?{flights:'Not researched yet',hotel:'Not researched yet',food:'Not researched yet',activities:'$830–950',transport:'$286–367 before tips'}:{flights:money(b.flights),hotel:money(b.stay),food:money(b.food),activities:money(b.activities),transport:money(b.localTransport)};
        return '<section class="card budget" data-testid="budget-buckets"><h2>Budget</h2><p>Rough estimates, not quotes. '+(curated?'For two.':'Based on the existing destination cost estimates.')+'</p>'+Object.entries({flights:'Flights',hotel:'Hotel',food:'Food',activities:'Activities',transport:'Getting around (Uber/transit)'}).map(function(r){return '<div class="bucket '+((state.answers.covers||defaults.covers).includes(r[0])?'included':'excluded')+'" data-testid="bucket-'+r[0]+'"><span class="bucket-icon">'+icon(r[0])+'</span><strong>'+r[1]+'</strong><span class="bucket-amount '+(/\d/.test(amounts[r[0]])?'':'bucket-unknown')+'">'+(/\d/.test(amounts[r[0]])?'approx. ':'')+esc(amounts[r[0]])+'</span><small data-testid="bucket-status">'+((state.answers.covers||defaults.covers).includes(r[0])?'Included in your budget':'Not included')+'</small></div>';}).join('')+(curated?'<p class="bucket-note">Flights, hotel and food weren’t researched for this demo — check prices when booking.</p>':'')+'</section>';
    }
    function planTiles(){
        if(state.tab!=='plan')return;
        var shell=view.querySelector('.shell');
        var revealSeen=read(KEY+'revealSeen:'+state.plan.id,false);write(KEY+'revealSeen:'+state.plan.id,true);
        shell.insertAdjacentHTML('afterbegin',passport()+'<div data-testid="treasure-reveal" class="treasure '+(revealSeen?'is-settled':'')+'" style="--reveal-time:'+(location.search.includes('fast=1')?'350ms':'1400ms')+'"><div><strong>Room for a good day</strong><span>'+esc(state.plan.title)+'</span></div></div>');
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
        var local=document.createElement('section');local.className='card utility-tile';local.id='local-info';local.dataset.testid='local-info';local.dataset.title='Weather, money & local info';local.dataset.summary='Local time, plugs, weather and currency';content.append(local);
        var destination=p.id==='oahu-demo-2026-11'?'oahu':Engine.matchDestination(state.answers.destination).id;
        var loadLocal=LocalInfo.mount(local,destination,p.start,p.end);
        var booking=document.createElement('section');booking.className='card utility-tile';booking.id='book-links';booking.dataset.testid='book-links';booking.dataset.title='Book this';booking.dataset.summary='Hotel and flight searches on partner sites';booking.innerHTML=bookLinksHTML();content.append(booking);
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
            toggle.onclick=function(){var on=toggle.getAttribute('aria-expanded')!=='true';view.querySelectorAll('[data-testid="tile-toggle"]').forEach(function(t){t.setAttribute('aria-expanded','false');t.nextElementSibling.hidden=true;t.closest('.tile').classList.remove('is-open');});set(on);openTile=on?id:null;if(on&&id==='local-info')loadLocal();};
            if(openTile===id&&id==='local-info')loadLocal();
        });
        view.querySelectorAll('.daynav a').forEach(function(a,i){a.addEventListener('click',function(){var t=view.querySelectorAll('.day .tile-toggle')[i];if(t&&t.getAttribute('aria-expanded')!=='true')t.click();});});
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
            normalizePace(state.answers);
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
            var next=state.afterPlan||'plan';
            state.afterPlan=null;
            go(next);
            rememberTrip();
            if(!resume&&next==='plan')toast('Your plan is ready.');
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
        if(state.viewing==='finished')return;
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
        if(n>=all.length/2)earn('Packed at least half');
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
    function partnerLink(key, title, activity) {
        var a=state.answers, p=state.plan;
        var destination=p.id==='oahu-demo-2026-11'?'Oahu, Hawaii':Engine.matchDestination(a.destination).name;
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
        return '<h2>Book this</h2><p data-testid="affiliate-disclosure">'+esc(window.GONOW_AFFILIATES.disclosure)+'</p><p>Hotels</p><div class="row">'+partnerLink('booking')+partnerLink('expedia')+'</div><p>Flights</p><div class="row">'+partnerLink('skyscanner')+'</div><small>Choose airports on Skyscanner if your route is unknown. Confirm dates and travelers on every partner site.</small>';
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
        '2026-11-26-1':'images/activity-diamond-head.jpg',
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
        if(it.locked||!state.plan||travelers().length<2)return '';
        var day=state.plan.days.find(function(d){return d.items.some(function(i){return i.id===it.id;});});
        if(!day)return '';
        return travelers().map(function(t,i){var c=window.GoNowCheckin.get('gonow.checkin.v1',day.date,personId(i)),alt=(c.alternatives||{})[it.id];return alt?'<small class="traveler-alternative" data-testid="traveler-alternative">'+esc(t.name)+': '+esc(alt.title.toLowerCase())+' instead</small>':'';}).join('');
    }
    function itemArticle(it, opts) {
        opts=opts||{};
        var edit=state.edits.items&&state.edits.items[it.id]|| {}, title=edit.title||it.title, note=edit.note||'';
        if(edit.swapped)it=Object.assign( {}, it,  {
            sources:[], bring:[], prep:[], tips:[], price:'', bestTime:'', bookable:false
        });
        return'<article class="item '+esc(it.kind)+'">'+(opts.photo&&ITEM_PHOTOS[it.id]&&!edit.swapped?photo(ITEM_PHOTOS[it.id], title, 'db-photo'):(opts.photo?'<p class="activity-fallback">'+icon('info')+' No verified activity photo.</p>':''))+'<div class="row" style="gap:5px">'+(it.requested?'<span class="badge">'+icon('info')+' You requested this</span>':'')+(it.bookable?'<span class="badge">Bookable</span>':'')+(it.kind==='meal'?'<span class="badge">Meal pick · '+(/hotel|Kahala|Plumeria|Veranda|Alan Wong|birthday dinner/i.test(title+' '+(it.desc||''))&&!/La Mer|Waikiki|Ala Moana|Kailua|Aunty Pat/i.test(title)?'Near hotel':'Local area')+'</span>':'')+'</div><h3>'+esc(title)+'</h3>'+(it.price?'<p><strong>approx. '+esc(it.price)+'</strong><small> · verify before booking</small></p>':'')+(it.bestTime?'<p><strong>Best at:</strong> '+esc(it.bestTime)+'</p>':'')+'<p>'+esc(edit.desc||it.desc)+'</p>'+dietTag(it)+personalNotes(it)+(note?'<p class="banner">Your note: '+esc(note, true)+'</p>':'')+sources(it.sources)+(it.bookable&&!/\bspa\b/i.test(title||'')?'<p class="partner-search"><small>Find/Book this · Secondary search options</small><br>'+partnerLink('getyourguide',title,true)+' · '+partnerLink('viator',title,true)+'</p>':'')+(it.bring&&it.bring.length?'<details><summary data-testid="disclosure">What to bring ('+it.bring.length+')</summary><small>Ticking here also ticks it on your packing list.</small>'+it.bring.map(function(id) {
            var p=packingItem(id);
            return p?checkHTML(p, 'bring-item'):'';
        }).join('')+'</details>':'')+(it.prep&&it.prep.length?'<p class="section-label" style="margin-top:15px">Prep reminders</p>'+prep(it.prep):'')+(it.tips?it.tips.map(function(t) {
            return'<a class="badge tip-chip" data-testid="activity-tip" href="'+esc(t.url)+'" target="_blank" rel="noopener noreferrer">'+esc(t.sourceType)+' · '+esc(t.text)+' ↗</a>';
        }).join(''):'')+(opts.noActions?'':'<div class="row">'+(it.bookable?btn('Book this', 'item-book', 'outline', 'data-book="'+esc(it.id)+'"'):'')+btn('Edit', 'item-edit', '', 'data-edit="'+esc(it.id)+'"')+btn('Swap', 'item-swap', '', 'data-swap="'+esc(it.id)+'"')+btn('Remove', 'item-remove', '', 'data-remove="'+esc(it.id)+'"')+'</div><div id="edit-'+esc(it.id)+'"></div>')+(opts.travel&&it.travelToNext?'<p class="travel-chip db-next" data-testid="travel-chip">'+travelIcon(it.travelToNext)+' <strong>Getting to the next stop:</strong> '+esc(it.travelToNext)+'</p>':'')+'</article>';
    }
    function dayNotes(items, notes) {
        var bookings=items.filter(function(it){return it.bookable;});
        var count=bookings.length+(notes||[]).length;
        return '<details class="day-notes" data-testid="before-you-go"><summary>Before you go · '+count+' notes</summary><div>'+dayBookings(items)+prep(notes)+'</div></details>';
    }
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
                if(state.plan.id.indexOf('oahu')>=0&&!state.plan.id.startsWith('template-')) {
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
        return {items:items, relaxed:relaxed, rain:rain};
    }
    function sleepQuestion(){return '<section class="optional-section"><span class="section-label">Optional</span><h2>What time do you usually sleep?</h2><p>Optional — skip to keep the current sleep estimates.</p><label>Bedtime<input type="time" data-testid="sleep-bedtime" value="'+esc(state.answers.bedtime)+'"></label><label>Wake time<input type="time" data-testid="sleep-wake" value="'+esc(state.answers.wake)+'"></label></section>';}
    var diets=['Vegetarian','Vegan','High protein','Low carb','Gluten-free','Dairy-free','No restrictions'];
    function dietQuestion(){return '<section class="optional-section"><span class="section-label">Optional</span><h2>Any food preferences?</h2><p>Optional. Restaurant diet information may be unconfirmed.</p>'+diets.map(function(d){return '<button type="button" data-testid="diet-chip" data-value="'+d+'" aria-pressed="'+(state.answers.diet||[]).includes(d)+'">'+d+'</button>';}).join('')+'<label>Food preference notes<input data-testid="diet-notes" value="'+esc(state.answers.dietNotes)+'"></label></section>';}
    function bindWellnessDetails(){
        ['bedtime','wake'].forEach(function(k){on('sleep-'+k,function(e){state.answers[k]=e.target.value;save();},'input');});
        on('diet-notes',function(e){state.answers.dietNotes=e.target.value;save();},'input');
        view.querySelectorAll('[data-testid=diet-chip]').forEach(function(el){el.onclick=function(){var d=el.dataset.value, arr=state.answers.diet||[];state.answers.diet=arr.includes(d)?arr.filter(function(v){return v!==d;}):d==='No restrictions'?[d]:arr.filter(function(v){return v!=='No restrictions';}).concat(d);save();view.querySelectorAll('[data-testid=diet-chip]').forEach(function(b){b.setAttribute('aria-pressed',state.answers.diet.includes(b.dataset.value));});};});
    }
    function dietTag(item){if(item.kind!=='meal'||!(state.answers.diet||[]).some(function(d){return d!=='No restrictions';}))return '';var match=window.GoNowDiet.match(item,state.answers.diet);if(match.status!=='supported')return '';return '<small data-testid="diet-tag">'+esc(match.reason)+'</small>';}
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
    function dayFeelHTML(day,items){
        var C=window.GoNowCheckin,group=travelers(),index=checkinSelected[day.date]||0,id=personId(index),name=group[index].name,c=C.get('gonow.checkin.v1',day.date,id),moment=C.get('gonow.moments.v1',day.date,id);
        var choices={energy:['low','ok','high'],mood:['low','okay','good'],soreness:['none','some','a lot'],sleep:['poor','ok','great']};
        var html='<section class="day-feel" data-testid="day-feel" data-date="'+day.date+'" data-person="'+id+'">';
        if(group.length>1)html+='<div class="feel-selector" aria-label="Traveler">'+group.map(function(t,i){var done=C.get('gonow.checkin.v1',day.date,personId(i));return '<button type="button" data-testid="checkin-traveler" data-index="'+i+'" aria-pressed="'+(i===index)+'">'+esc(t.name)+(done.done?' · checked in':done.skipped?' · skipped':'')+'</button>';}).join('')+'</div>';
        html+=c.done||c.skipped?'<p data-testid="checkin-complete">'+(group.length>1?esc(name)+' · ':'')+(c.skipped?'Morning check-in skipped':'Morning check-in saved')+' · <button type="button" data-testid="checkin-edit">Edit</button></p>':'<details data-testid="morning-checkin"><summary>Morning feel · optional</summary><div class="feel-fields">'+Object.keys(choices).map(function(k){return '<fieldset><legend>'+k[0].toUpperCase()+k.slice(1)+'</legend>'+choices[k].map(function(v,i){var label=k==='mood'?['Low mood','Okay mood','Good mood'][i]:v;return '<button type="button" data-testid="checkin-'+k+'" data-field="'+k+'" data-value="'+v+'" aria-label="'+label+'" aria-pressed="'+(c[k]===v)+'">'+(k==='mood'?moodFace(i):v)+'</button>';}).join('')+'</fieldset>';}).join('')+'</div><div class="feel-input"><label>Anything to add?<textarea data-testid="checkin-text">'+esc(c.text)+'</textarea></label>'+feelVoiceHTML('checkin')+'</div><button type="button" data-testid="checkin-save">Save check-in</button><button type="button" data-testid="checkin-skip">Skip today</button></details>';
        var suggestions=C.suggest(items,c).suggestions.filter(function(s){return !(c.dismissed||[]).includes(s.id)&&!(c.alternatives||{})[s.id];});
        if(c.done&&C.gentle(c)){var eased=C.score(items,window.GoNowRings.selectLevel(group[index].level,(state.answers.dayPaces||{})[day.date]||'trip'),[],state.answers,c);html+='<p class="muted">'+(group.length>1?esc(name)+"'s movement":'Movement')+' goal eased to '+Math.round(eased.goals.move)+' min today.</p>';}
        if(c.done)html+='<div data-testid="checkin-suggestions">'+suggestions.map(function(s){return '<article data-testid="checkin-suggestion"><p>'+suggestionCopy(s,items,c,group,name)+'</p><button type="button" data-testid="checkin-apply" data-id="'+esc(s.id)+'">'+(s.type==='add'?'Add':group.length>1?'Swap for '+esc(name):'Swap')+'</button><button type="button" data-testid="checkin-dismiss" data-id="'+esc(s.id)+'">'+(s.type==='add'?'No thanks':'Keep plan')+'</button></article>';}).join('')+'</div>';
        if((c.extras||[]).length)html+='<p>'+esc(name)+': Sunrise run · 30 min added</p>';
        html+='<details data-testid="sweet-moment" '+(!moment.text?'':'')+'><summary>'+(moment.text?'<span class="moment-dot" aria-hidden="true"></span>Best moment: '+esc(moment.text)+' · Edit':'Best moment today?')+'</summary><label>A sweet moment<textarea data-testid="moment-text">'+esc(moment.text)+'</textarea></label>'+feelVoiceHTML('moment')+'<button type="button" data-testid="moment-save">Save</button></details></section>';
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
            box.querySelector('[data-testid=moment-save]').onclick=function(){C.put('gonow.moments.v1',date,id,{text:box.querySelector('[data-testid=moment-text]').value.trim()});refresh();};
            box.querySelectorAll('[data-testid=checkin-apply],[data-testid=checkin-dismiss]').forEach(function(b){b.onclick=function(){var schedule=window.DayBuilder.schedule(),day=schedule&&schedule.days.find(function(d){return d.date===date;}),dayItems=day?day.items:(state.plan.days.find(function(d){return d.date===date;})||{}).items||[],s=C.suggest(dayItems,c).suggestions.find(function(s){return s.id===b.dataset.id;});if(!s)return;
                if(b.dataset.testid==='checkin-apply'){
                    if(travelers().length>1){if(s.type==='swap'){c.alternatives=c.alternatives||{};c.alternatives[s.id]=s.alternative;}else{c.extras=(c.extras||[]).concat(s.alternative);}}
                    else if(s.type==='swap'){if(mergedPlan())window.DayBuilder.swapItem(s.id,s.alternative);else {var it=state.plan.days.find(function(d){return d.date===date;}).items.find(function(i){return i.id===s.id;});if(it&&!it.locked){state.edits.items=state.edits.items||{};state.edits.items[it.id]=Object.assign({},state.edits.items[it.id],s.alternative);persistEdits();}}}
                    else if(mergedPlan())window.DayBuilder.addToDay(date,Object.assign({},s.alternative,{time:checkinClock(s.alternative.preferred)}));else {var di=state.plan.days.findIndex(function(d){return d.date===date;});state.edits.added=state.edits.added||{};state.edits.added[di]=(state.edits.added[di]||[]).concat(Object.assign({},s.alternative,{id:'checkin-extra-'+date,kind:'activity',time:checkinClock(s.alternative.preferred),bring:[],sources:[]}));persistEdits();}
                }
                c.dismissed=(c.dismissed||[]).concat(s.id);store();refresh();
            };});
            ['checkin','moment'].forEach(function(prefix){bindFeelVoice(box,prefix);});
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
    function momentsSummary(){var C=window.GoNowCheckin,lines=[];state.plan.days.forEach(function(d){travelers().forEach(function(t,i){var m=C.get('gonow.moments.v1',d.date,personId(i));if(m.text)lines.push('<p>'+esc(d.date)+' · '+esc(t.name)+': '+esc(m.text)+'</p>');});});return '<section class="moments-summary" data-testid="moments-summary"><h2>Your sweet moments</h2>'+(lines.join('')||'<p>A little space for memories, whenever you like.</p>')+'</section>';}

    var paceLabels={gentle:'Gentle',active:'Active',athlete:'Athlete',unsure:'Not sure',trip:'Same as trip'};
    function travelers(){var a=state.answers,n=a.who==='solo'?1:a.who==='couple'?2:Number(a.adults)+Number(a.kids);a.travelers=(a.travelers||[]).slice(0,n);while(a.travelers.length<n)a.travelers.push({name:'Traveler '+(a.travelers.length+1),level:a.level});return a.travelers;}
    function paceDayHTML(day,items,next){
        var a=state.answers,override=(a.dayPaces||{})[day.date]||'trip',level=window.GoNowRings.selectLevel(a.level,override);
        var html='<fieldset data-testid="day-pace" data-date="'+day.date+'"><legend>Day pace</legend>'+['gentle','active','athlete','trip'].map(function(v){return '<label><input type="radio" name="pace-'+day.date+'" data-testid="day-pace-option" data-value="'+v+'" value="'+v+'" '+(v===override?'checked':'')+'>'+paceLabels[v]+'</label>';}).join('')+'</fieldset>';
        html+=window.GoNowRings.render(window.GoNowCheckin.score(personalItems(items,window.GoNowCheckin.get("gonow.checkin.v1",day.date,personId(0))),level,next,a,window.GoNowCheckin.get("gonow.checkin.v1",day.date,personId(0))));
        html+='<p data-testid="day-pace-hint">'+({gentle:'Try walking, yoga or meditation.',athlete:'Try running, hiking or strength.',active:'Mix movement with recovery.',unsure:'Explore at a comfortable pace.'}[level]||'Explore at a comfortable pace.')+'</p>';
        if(a.bedtime){var parts=a.bedtime.split(':'),t=(Number(parts[0])*60+Number(parts[1])-45+1440)%1440;html+='<p data-testid="wind-down">Wind-down · '+window.DayBuilder.clock(t)+'</p>';}
        var group=travelers();if(group.length>1)html+='<div class="travelers">'+group.map(function(t,i){return '<div data-testid="traveler-row"><label><span class="sr-only">Name</span><input data-testid="traveler-name" data-index="'+i+'" value="'+esc(t.name)+'"></label><label><span class="sr-only">Pace</span><select data-testid="traveler-pace" data-index="'+i+'">'+['gentle','active','athlete','unsure'].map(function(v){return '<option value="'+v+'" '+(v===t.level?'selected':'')+'>'+paceLabels[v]+'</option>';}).join('')+'</select></label><div data-testid="traveler-rings" aria-label="'+esc(t.name)+'">'+window.GoNowRings.render(window.GoNowCheckin.score(personalItems(items,window.GoNowCheckin.get("gonow.checkin.v1",day.date,personId(i))).concat(window.GoNowCheckin.get("gonow.checkin.v1",day.date,personId(i)).extras||[]),window.GoNowRings.selectLevel(t.level,override),next,a,window.GoNowCheckin.get("gonow.checkin.v1",day.date,personId(i))),{caption:false,name:t.name,compact:true})+'</div></div>';}).join('')+'</div>';
        return html+dayFeelHTML(day,items);
    }
    function bindPace(scope){
        bindFeel(scope);
        scope.querySelectorAll('[data-testid=day-pace-option]').forEach(function(el){el.onchange=function(){state.answers.dayPaces=Object.assign({},state.answers.dayPaces);state.answers.dayPaces[el.closest('[data-date]').dataset.date]=el.value;save();render();};});
        scope.querySelectorAll('[data-testid=traveler-name],[data-testid=traveler-pace]').forEach(function(el){el.onchange=function(){var t=travelers()[Number(el.dataset.index)];t[el.tagName==='SELECT'?'level':'name']=el.value;save();render();};});
    }
    function dayHeadHTML(d, i, m) {
        var label=new Date(d.date+'T12:00:00').toLocaleDateString('en-US',  {
            weekday:'short', month:'short', day:'numeric'
        });
        var schedule=window.DayBuilder&&state.plan.id==='oahu-demo-2026-11'?window.DayBuilder.schedule():null;
        var days=schedule?schedule.days:state.plan.days;
        var current=days.find(function(day){return day.date===d.date;});
        var next=days[days.findIndex(function(day){return day.date===d.date;})+1];
        var ringItems=schedule&&current?current.items:m.items;
        return '<div class="day-head"><div class="day-title"><span class="section-label">'+label+'</span><h2>Day '+(i+1)+' · '+label+'</h2><p>'+esc(d.theme)+'</p></div>'+paceDayHTML(d,ringItems,next&&next.items)+'<div class="day-badges"><span class="badge">'+icon('hotel')+' '+esc(state.plan.stay)+'</span>'+(/no rental car|not needed/i.test(d.car.level+' '+d.car.note)?'<span class="badge">'+icon('who')+' No rental car — rideshare, shuttle and walking</span>':'<span class="badge">'+icon('transport')+' Car: '+esc(d.car.level)+' — '+esc(d.car.note)+'</span>')+'<span class="badge">'+icon('style')+' Typical conditions</span></div></div>'+dayNotes(m.items,d.prep)+(m.relaxed?'<div class="banner">Relaxed version: '+esc(d.relax)+'</div>':'')+(m.rain?'<div class="banner">'+icon('info')+' Rain backup: '+esc(d.rain)+'</div>':'');
    }
    function dayFooterHTML(d, i, m) {
        return '<div class="day-footer row">'+(d.relax?'<label><input type="checkbox" data-testid="relax-toggle" data-relax="'+i+'" '+(m.relaxed?'checked':'')+'>Make this day more relaxing</label>':'')+(d.rain?'<label><input type="checkbox" data-testid="rain-toggle" data-rain="'+i+'" '+(m.rain?'checked':'')+'>Rain backup</label>':'')+btn('+ Add your own item', 'day-add', '', 'data-add-day="'+i+'"')+'</div>';
    }
    function dayHTML(d, i) {
        var m=dayModel(d, i), items=m.items;
        return'<section class="card day" id="day-'+i+'" data-testid="plan-day">'+dayHeadHTML(d, i, m)+'<ol class="timeline">'+items.map(function(it, j) {
            return itemHTML(it, i)+(j<items.length-1?'<li class="travel-chip" data-testid="travel-chip" style="display:block">'+travelIcon(it.travelToNext)+' '+esc(it.travelToNext||'approx. 5–10 min walk / local transfer — confirm route')+'</li>':'');
        }).join('')+'</ol>'+dayFooterHTML(d, i, m)+'</section>';
    }
    // The Oahu demo shows each day once, inside the day builder.
    function mergedPlan() {
        return !!(state.plan&&state.plan.id==='oahu-demo-2026-11'&&state.tab==='plan'&&window.DayBuilder);
    }
    function builderContext() {
        var p=state.plan;
        function day(date){var i=p.days.findIndex(function(d){return d.date===date;});return {d:p.days[i],i:i};}
        function model(date){var x=day(date);return x.d?dayModel(x.d,x.i):{items:[]};}
        function find(id,date){return model(date).items.find(function(it){return it.id===id;});}
        return {
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
            photoFor:function(src){return ITEM_PHOTOS[src];},
            titleFor:function(src,date,item){
                var it=find(src,date);if(!it)return '';
                var edit=(state.edits.items||{})[src]||{}, original=day(date).d.items.find(function(o){return o.id===src;});
                if(item&&item.checkinSwap)return item.title;
                if(item&&item.flight)return '';
                if(edit.title)return edit.title;
                return original&&it.title!==original.title?it.title.replace(/\p{Extended_Pictographic}/gu,'').trim():'';
            },
            detail:function(src,date,item){
                if(item&&item.checkinSwap)return '<p>'+esc(item.title)+' · A gentler option at the same time.</p>';
                var chest=item&&(/^(chest-|instance-)/.test(item.id)||item.sourceId!==item.id);
                var it=find(src,date)||p.days.flatMap(function(d){return d.items;}).find(function(o){return o.id===src;});if(!it)return '<p>'+icon('info')+' '+esc(item.title)+' in '+esc(item.place)+'. No verified activity photo.</p>';
                var html='<div class="db-item" data-item-id="'+esc(it.id)+'"'+(chest?'':' id="item-'+esc(it.id)+'"')+'>'+itemArticle(it,{photo:true,travel:!chest,noActions:chest})+'</div>';
                (item&&item.extraSources||[]).forEach(function(id){var ride=find(id,date);if(ride)html+='<div class="db-item db-item-ride" data-item-id="'+esc(ride.id)+'" id="item-'+esc(ride.id)+'"><p class="section-label">Getting there and back</p>'+itemArticle(ride,{travel:true})+'</div>';});
                return html;
            },
            afterRender:function(scope){bindItems(scope);bindPace(scope);scope.querySelectorAll('[data-db-source]').forEach(function(row){var src=row.dataset.dbSource,it=p.days.flatMap(function(d){return d.items;}).find(function(i){return i.id===src;});var host=row.querySelector('.db-activity');if(host){if(it)host.insertAdjacentHTML('beforeend',dietTag(it));travelers().forEach(function(t,i){var c=window.GoNowCheckin.get('gonow.checkin.v1',window.DayBuilder.selectedDate(),personId(i)),alt=(c.alternatives||{})[row.dataset.dbId];if(alt&&!row.classList.contains('db-locked'))host.insertAdjacentHTML('beforeend','<small class="traveler-alternative" data-testid="traveler-alternative">'+esc(t.name)+': '+esc(alt.title.toLowerCase())+' instead</small>');});}});}
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
        view.innerHTML='<div class="shell">'+planBanner(p)+planNotices(p)+'<div class="banner">'+esc(p.banner)+'</div><details><summary data-testid="disclosure">'+icon('style')+' '+(p.id.indexOf('oahu')>=0?'Typical weather · 84°F / 70°F':'Typical weather')+' · Typical conditions, not a forecast</summary><p>'+esc(p.weather.text)+'</p>'+sources(p.weather.sources)+'</details><details><summary data-testid="disclosure">'+(p.estimate?'Rough estimate: about '+money(p.estimate.total)+' total':(p.costSummary||'Estimated: approx. $1,120–1,320 for two · activities + local transport · excludes flights, hotel, meals & spa'))+'</summary>'+(p.estimate?breakdown(p.estimate.breakdown):(p.costs||[]).map(function(c) {
            return'<p><strong>'+esc(c.item)+'</strong> — approx. '+esc(c.price)+' · verify before booking'+sources(c.sources)+'</p>';
        }).join(''))+'<p>'+esc(p.activityTotal)+'</p></details>'+(p.ageRules&&p.ageRules.length?'<aside class="warning" data-testid="age-rules"><strong>Age rules applied</strong>'+p.ageRules.map(function(t) {
            return'<p>'+esc(t)+'</p>';
        }).join('')+(p.id==='oahu-demo-2026-11'?'<p>The guided Jurassic Adventure replaces self-drive UTV. The hotel’s approx. $60/day parking cost is avoided.</p>'+sources([OAHU_SOURCES.kualoaUtv, OAHU_SOURCES.kahalaMap]):'')+'</aside>':'')+prep(p.flags)+(state.edits.todos&&state.edits.todos.length?'<details><summary data-testid="booking-todos">Booking to-do ('+state.edits.todos.length+')</summary>'+state.edits.todos.map(function(id) {
            var item=p.days.flatMap(function(d) {
                return d.items;
            }).find(function(it) {
                return it.id===id;
            });
            return'<p>'+icon('dates')+' '+esc(item?item.title:'Your activity')+' — confirm and book direct.</p>';
        }).join('')+'</details>':'')+'<div class="tabs" role="tablist" aria-label="Trip view">'+['plan', 'packing', 'tips'].map(function(t) {
            return btn(t[0].toUpperCase()+t.slice(1), 'tab-'+t, '', 'role="tab" id="tabbtn-'+t+'" aria-controls="tab-content" tabindex="'+(state.tab===t?0:-1)+'" aria-selected="'+(state.tab===t)+'"');
        }).join('')+'</div><div id="tab-content" role="tabpanel" aria-labelledby="tabbtn-'+state.tab+'">'+(state.tab==='plan'?(mergedPlan()?'':'<nav class="daynav" aria-label="Jump to day">'+p.days.map(function(d, i) {
            return'<a href="#day-'+i+'" data-testid="day-nav-'+i+'">Day '+(i+1)+' · '+dateLabel(d.date,  {
                weekday:'short'
            })+' '+dateLabel(d.date,  {
                day:'numeric'
            })+'</a>';
        }).join('')+'</nav>'+p.days.map(dayHTML).join('')):state.tab==='packing'?packingHTML():subheading('A little local knowledge', 'Useful notes, with a way back to the source.')+tipsHTML(p.tips)+'<p class="footer-note">Tips shown here link to their sources. Live social/review data comes later; real-data tips will show platform, link and retrieval date.</p>')+'</div><footer class="row" style="padding:25px 0">'+btn('Open packing list', 'open-packing', 'primary')+'<span data-testid="print">'+btn('Print / Save as PDF', 'print-plan', 'outline')+'</span>'+btn('Copy as text', 'copy', 'outline')+'<span data-testid="share">'+btn('Share link', 'share-link', 'outline')+'</span>'+btn('Download calendar', 'download-ics', 'outline')+'</footer><p class="footer-note">Made for your kind of travel. Saved on this device.</p></div>';
        if(state.tab==='plan')document.getElementById('tab-content').insertAdjacentHTML('beforeend',momentsSummary());
        planTiles();
        bindPace(view);
        expeditionUI();
        if(mergedPlan()){
            var db=document.createElement('section');db.className='db-root';db.dataset.testid='db-root';db.setAttribute('aria-label','Your days');
            document.querySelector('#tab-content .tile-grid').insertAdjacentElement('beforebegin',db);
            db.hidden=get('treasure-map')?!get('treasure-map').hidden:false;
            var built=builderContext();
            if(state.viewing==='finished'){
                var tripNow=currentTrip();
                var weather=tripNow&&tripNow.snapshot&&tripNow.snapshot.weather;
                if(weather)view.querySelector('.shell').insertAdjacentHTML('afterbegin','<aside class="banner" data-testid="finished-banner">Finished plan. This copy stays as generated. '+esc(weather.label)+'</aside><p data-testid="snapshot-weather">'+esc(weather.text)+'</p>');
            }
            window.DayBuilder.mount(db,built);
        }
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
    function parseClock(text) {
        var m=String(text||'').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        return m?(Number(m[1])%12)*60+Number(m[2])+( /pm/i.test(m[3])?720:0):null;
    }
    // Oahu days follow the builder's current order and reflowed start/end, including after a reorder or Relax.
    function builderExport() {
        var p=state.plan;
        if(!p||p.id!=='oahu-demo-2026-11'||!window.DayBuilder||!window.DayBuilder.schedule)return null;
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
            dayModel(info, index).items.forEach(function(it) {
                if(known[it.id])return;
                var edit=(state.edits.items||{})[it.id]||{};
                var time=edit.time||it.time, start=parseClock(time);
                rows.push({id:it.id, title:edit.title||it.title, desc:(edit.desc||it.desc||'')+(edit.note?'\nNote: '+edit.note:''), time:time, start:start, end:start==null?null:start+60, kind:it.kind, location:it.location||it.address||''});
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
        var p=state.plan, oahu=p.id.indexOf('oahu')>=0;
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
    window.addEventListener('beforeprint',function(){
        if(!state.plan)return;
        printSnapshot={tab:state.tab,details:[]};
        if(state.tab!=='plan'){state.tab='plan';planRender(false);}
        if(mergedPlan())window.DayBuilder.print(true);
        view.querySelectorAll('details').forEach(function(d){printSnapshot.details.push([d,d.open]);d.open=true;});
    });
    window.addEventListener('afterprint',function(){if(window.DayBuilder&&window.DayBuilder.print)window.DayBuilder.print(false);if(!printSnapshot)return;printSnapshot.details.forEach(function(pair){pair[0].open=pair[1];});if(state.tab!==printSnapshot.tab){state.tab=printSnapshot.tab;planRender(false);}printSnapshot=null;});
    function downloadICS(){
        var url=URL.createObjectURL(new Blob([buildICS()],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');
        a.href=url;a.download='gonow-'+Engine.matchDestination(state.answers.destination).id+'-'+state.plan.days[0].date+'.ics';document.body.append(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);earn('Downloaded a calendar');
    }
    function encodeTrip(data){var bytes=new TextEncoder().encode(JSON.stringify(data)),binary='';bytes.forEach(function(b){binary+=String.fromCharCode(b);});return 'j.'+btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
    function shareTrip(){
        var data={answers:state.answers,edits:state.edits,id:state.plan.id};
        if(state.plan.id==='oahu-demo-2026-11'&&window.DayBuilder){var builder=window.DayBuilder.exportState();if(builder)data.db=builder;}
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
            var a=Object.assign({},defaults,normalizePace(data.answers));
            if(!Array.isArray(a.ages)||!Array.isArray(a.styles)||!Array.isArray(a.food)||!(a.length>=2&&a.length<=30)||(!a.flexible&&(!/^\d{4}-\d{2}-\d{2}$/.test(a.start)||!/^\d{4}-\d{2}-\d{2}$/.test(a.end)||!(new Date(a.end)>=new Date(a.start))||(new Date(a.end)-new Date(a.start)>29*864e5))))throw new Error('answers');
            if(data.db!==undefined&&(!data.db||typeof data.db!=='object'||Array.isArray(data.db)))throw new Error('builder');
            state.shared=true;state.sharedEdits=data.edits;state.sharedBuilder=data.db||null;state.answers=a;generate(true);
        }catch(e){state.shared=true;state.answers=Object.assign({},defaults);go('start');view.insertAdjacentHTML('afterbegin','<p class="banner" role="status">This trip link couldn’t be opened. Start a new adventure below.</p>');}
    }
    var leafletMap, stopLayers;
    function expeditionUI(){
        if(leafletMap&&!leafletMap.getContainer().isConnected){leafletMap.remove();leafletMap=stopLayers=null;}
        var shell=view.querySelector('.shell');
        if(state.shared){shell.insertAdjacentHTML('afterbegin','<aside class="banner" data-testid="shared-banner">Shared trip — view only copy; changes stay on this device '+btn('Make it mine','adopt-shared','outline')+'</aside>');on('adopt-shared',function(){if(window.DayBuilder&&window.DayBuilder.persist)window.DayBuilder.persist();state.shared=false;state.sharedBuilder=null;save();persistEdits();write(KEY+'lastTrip',{answers:state.answers});history.replaceState({screen:'plan'},'','#plan');planRender(false);});}
        shell.insertAdjacentHTML('beforeend','<p class="stamped-footer '+(state.shared?'shared-stamp':'')+'" data-testid="stamped-footer">Planned with GoNow · maogy127.github.io/ai-travel-planner</p>');
        var toolbar=get('print-plan').closest('footer');toolbar.setAttribute('aria-label','Share & export');toolbar.insertAdjacentHTML('afterbegin','<strong>Share & export</strong>');
        if(state.tab!=='plan')return;
        var pref;try{pref=localStorage.getItem(KEY+'view');}catch(e){}
        var map= pref==='map';
        var content=document.getElementById('tab-content');
        content.insertAdjacentHTML('afterbegin','<div class="view-switch row" role="group" aria-label="Itinerary view">'+btn('List','view-list','outline','aria-pressed="'+!map+'"')+btn('Map','view-map','outline','aria-pressed="'+map+'"')+'</div><section class="treasure-map" data-testid="treasure-map" '+(!map?'hidden':'')+'><h2>Your day on the map</h2><div class="row" aria-label="Map day">'+state.plan.days.map(function(d,i){return btn('Day '+(i+1)+' · '+d.date,'map-day-select','outline','data-map-select="'+i+'" aria-pressed="'+(i===0)+'"');}).join('')+'</div><p data-testid="map-fallback" hidden></p><div data-testid="trip-map" aria-label="Selected day itinerary map"></div><p data-testid="map-tile-error" role="status" hidden>Map tiles couldn&#39;t load (offline?). Pins and the stop list still work.</p><ol data-testid="map-stop-list"></ol><h3>Jump to a day in List</h3><ol>'+state.plan.days.map(function(d,i){return '<li>'+btn('Day '+(i+1)+' · '+d.date+' · '+esc(d.theme),'map-day','outline','data-map-day="'+i+'"')+'</li>';}).join('')+'</ol></section>');
        var mapDay=0, mapBox=get('trip-map');
        function drawMap(){
            if(!map || !mapBox.isConnected)return;
            if(leafletMap&&leafletMap.getContainer()!==mapBox){leafletMap.remove();leafletMap=stopLayers=null;}
            var day=state.plan.days[mapDay], geo=window.GONOW_GEO||{places:{},demoItems:{},builderPlaces:{}};
            var demo=state.plan.id==='oahu-demo-2026-11';
            var schedule=demo&&window.DayBuilder&&window.DayBuilder.schedule();
            var built=schedule&&schedule.days.find(function(d){return d.date===day.date;});
            var items=built?built.items:dayModel(day,mapDay).items;
            var resolve=function(it){return demo&&(geo.demoItems[it.sourceId||it.id]||geo.builderPlaces[it.place]);};
            // Airport travel is a real start/end stop; omit other travel and prep.
            var stops=items.filter(function(it){return it.kind!=='prep'&&(it.kind!=='travel'||resolve(it)==='hnl');});
            var groups=[], lastKey;
            stops.forEach(function(it){
                var key=resolve(it), place=geo.places[key];
                var row={title:it.title,time:built?(it.start!=null&&it.end!=null?window.DayBuilder.range(it.start,it.end):it.textTime||''):it.time||''};
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
        function setMap(value,persist){map=value;if(value)requestAnimationFrame(drawMap);get('treasure-map').hidden=!value;content.querySelector('.tile-grid').hidden=value;if(content.querySelector('.daynav'))content.querySelector('.daynav').hidden=value;var builder=content.querySelector('.db-root');if(builder)builder.hidden=value;get('view-list').setAttribute('aria-pressed',String(!value));get('view-map').setAttribute('aria-pressed',String(value));if(persist){try{localStorage.setItem(KEY+'view',value?'map':'list');}catch(e){}if(value)earn('Viewed the map');}}
        setMap(map,false);on('view-map',function(){setMap(true,true);});on('view-list',function(){setMap(false,true);});
        view.querySelectorAll('[data-map-day]').forEach(function(b){b.onclick=function(){setMap(false,true);if(mergedPlan()&&window.DayBuilder.selectedDate){var date=state.plan.days[b.dataset.mapDay].date;window.DayBuilder.selectDay(date,false);var chip=document.querySelector('[data-testid="db-day-'+date+'"]'),card=document.querySelector('.db-daycard');(card||chip).scrollIntoView({block:'start',behavior:'auto'});chip.focus({preventScroll:true});return;}var t=document.querySelector('#day-'+b.dataset.mapDay+' .tile-toggle');if(t.getAttribute('aria-expanded')!=='true')t.click();t.scrollIntoView({block:'start',behavior:'auto'});t.focus({preventScroll:true});};});
    }
    function render() {
        if(state.screen==='credits')creditsScreen();
        else if(state.screen==='home')home();
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
        go('home');
    };
    window.__gonow= {
        state:state, go:go, buildICS:buildICS, planText:planText
    };
    window.addEventListener('hashchange',function(){if(location.hash.indexOf('#trip=')===0)restoreShared();});
    var last=read(KEY+'lastTrip', null);
    if(location.hash.indexOf('#trip=')===0)restoreShared();
    else { migrateLegacyTrip(); go('home'); }
}
());

/* Print: open every disclosure so printed plans include all details; restore afterwards. */
(function(){var opened=[];window.addEventListener('beforeprint',function(){opened=[].slice.call(document.querySelectorAll('details:not([open])'));opened.forEach(function(d){d.open=true;});});window.addEventListener('afterprint',function(){opened.forEach(function(d){d.open=false;});opened=[];});}());
