/* GoNow v2 "Color is your weather" (Nov 20, 2026).
   - Theme: the whole UI re-tints to how you feel. Tokens interpolate in OKLCH between
     Tired (0) → Calm (.45) → Energized (1) over ~600 ms. Focus is a scoped mode (an opened stop), not a dial position.
   - Icons: 1.5px line icons (no emoji).
   - Motion: press-spring (CSS), vote burst, count-up ring numbers. All respect prefers-reduced-motion.
   Feel values are stored on this device only ('gonow.feel.v1': {date: 0..1, last: 0..1}). */
(function(root){
  'use strict';
  // ---------- colour math (sRGB hex <-> OKLCH) ----------
  const hex2rgb=h=>{h=String(h).trim().replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);};
  const lin=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4, unlin=c=>c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;
  function toOklch(hex){
    const [r,g,b]=hex2rgb(hex).map(lin);
    const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
    const L=.2104542553*l+.793617785*m-.0040720468*s,A=1.9779984951*l-2.428592205*m+.4505937099*s,B=.0259040371*l+.7827717662*m-.808675766*s;
    return [L,Math.hypot(A,B),(Math.atan2(B,A)*180/Math.PI+360)%360];
  }
  function toHex([L,C,H]){
    const a=C*Math.cos(H*Math.PI/180),b=C*Math.sin(H*Math.PI/180);
    const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
    const rgb=[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
    return '#'+rgb.map(c=>Math.round(Math.max(0,Math.min(1,unlin(Math.max(0,c))))*255).toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  function mix(a,b,t){ // OKLCH, shortest hue path; near-grey colours borrow the other hue
    const x=toOklch(a),y=toOklch(b);let h1=x[2],h2=y[2];
    if(x[1]<.02)h1=h2;if(y[1]<.02)h2=h1;let d=h2-h1;if(d>180)d-=360;if(d<-180)d+=360;
    return toHex([x[0]+(y[0]-x[0])*t,x[1]+(y[1]-x[1])*t,(h1+d*t+360)%360]);
  }
  const lum=h=>{const [r,g,b]=hex2rgb(h).map(lin);return .2126*r+.7152*g+.0722*b;};
  const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  // Move a colour's lightness (keeping hue/chroma) until it reaches the ratio against `on`.
  function ensure(fg,on,min){let c=toOklch(fg);const dark=lum(on)>.18;for(let i=0;i<60&&contrast(toHex(c),on)<min;i++)c=[c[0]+(dark?-.01:.01),c[1]*(dark?.995:.98),c[2]];return toHex(c);}

  // ---------- state anchors (DESIGN-SPEC.md, final Nov 19) ----------
  const KEYS=['bg','surface','ink','ink2','accent','onaccent','glow','r1','r2','r3','deep'];
  const TIRED=['#EBD8C3','#F5E9DA','#2E221C','#634D3D','#8C3D49','#FFFBF3','#E7B567','#C98A6B','#B3A67A','#C78C95','#8C3D49'],
        CALM=['#F3EADB','#FBF5EA','#2A2620','#566150','#56684A','#FFFBF3','#D9C8A6','#C9785F','#A7B48B','#A897BC','#566150'],
        ENERGIZED=['#F6F1E7','#FFFBF3','#1F2A20','#5E6559','#C23B22','#FFFBF3','#F2B820','#C23B22','#7FA046','#F2B820','#A8173F'];
  // Each state holds its exact palette around its dial label (Low / Steady / High) and blends in OKLCH between.
  const ANCHORS=[{at:0,name:'tired',v:TIRED},{at:.1,name:'tired',v:TIRED},{at:.4,name:'calm',v:CALM},{at:.55,name:'calm',v:CALM},{at:.8,name:'energized',v:ENERGIZED},{at:1,name:'energized',v:ENERGIZED}];
  const FOCUS={bg:'#16130F',surface:'#211D18',ink:'#F3EDE0',ink2:'#A89E8C',accent:'#F0B429',onaccent:'#16130F',glow:'#F0B429',r1:'#F0B429',r2:'#9BC53D',r3:'#F0B429',deep:'#9BC53D'};
  const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
  const stateName=t=>t<.24?'tired':t<=.66?'calm':'energized';
  const LABEL={tired:'Low',calm:'Steady',energized:'High'};
  function base(t){
    t=clamp(t);let i=0;while(i<ANCHORS.length-2&&t>ANCHORS[i+1].at)i++;
    const a=ANCHORS[i],b=ANCHORS[i+1],f=(t-a.at)/(b.at-a.at);
    const o={};KEYS.forEach((k,j)=>o[k]=f<=0||a.v===b.v?a.v[j]:f>=1?b.v[j]:mix(a.v[j],b.v[j],f));return o;
  }
  // Every token the site uses, as hex (tests read some of them as hex).
  function tokens(b){
    const soft=mix(b.surface,b.glow,.2), line=mix(b.bg,b.ink,.13);
    const ink2=ensure(ensure(ensure(b.ink2,b.bg,4.6),b.surface,4.6),soft,4.6);
    const accent=ensure(b.accent,b.onaccent,4.6);
    const accentText=ensure(ensure(accent,b.bg,4.6),b.surface,4.6);
    const boundary=ensure(ensure(mix(b.surface,ink2,.8),b.surface,3.1),soft,3.1);
    const t={bg:b.bg,surface:b.surface,ink:b.ink,'ink-2':ink2,accent,'accent-text':accentText,'on-accent':b.onaccent,
      soft,line,boundary,focus:accentText,'lock-bg':soft,glow:b.glow,deep:ensure(b.deep,b.surface,4.6),
      move:b.r1,rec:b.r2,sleep:b.r3,r1:b.r1,r2:b.r2,r3:b.r3,
      'move-text':ensure(b.r1,b.surface,4.6),'rec-text':ensure(b.r2,b.surface,4.6),'sleep-text':ensure(b.r3,b.surface,4.6),
      'accent-soft':mix(b.surface,accent,.12),'card-2':mix(b.surface,b.bg,.5)};
    return t;
  }
  const at=t=>tokens(base(t));
  const focusTokens=()=>tokens(FOCUS);

  // ---------- applying ----------
  const doc=root.document;
  const reduced=()=>!!((root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches)||(doc&&doc.documentElement.classList.contains('reduce-motion')));
  let current=null,anim=0;
  function paint(t){
    const s=doc.documentElement.style,tk=at(t);
    Object.keys(tk).forEach(k=>s.setProperty('--'+k,tk[k]));
    const name=stateName(t);
    if(doc.documentElement.dataset.state!==name)doc.documentElement.dataset.state=name;
    const meta=doc.querySelector('meta[name=theme-color]');if(meta)meta.content=tk.bg;
  }
  function set(t,opts){
    t=clamp(t);opts=opts||{};
    if(current===null||opts.instant||reduced()){cancelAnimationFrame(anim);current=t;paint(t);return;}
    const from=current,start=performance.now(),dur=600;cancelAnimationFrame(anim);
    const ease=x=>x<.5?2*x*x:1-(-2*x+2)**2/2;
    (function step(now){const p=Math.min(1,(now-start)/dur);current=from+(t-from)*ease(p);paint(current);if(p<1)anim=requestAnimationFrame(step);})(start);
  }
  // ---------- feel storage ----------
  const KEY='gonow.feel.v1';
  function read(){try{return JSON.parse(root.localStorage.getItem(KEY))||{};}catch(e){return {};}}
  function write(o){try{root.localStorage.setItem(KEY,JSON.stringify(o));}catch(e){}}
  function checkinDefault(date){
    try{const all=JSON.parse(root.localStorage.getItem('gonow.checkin.v1'))||{};const day=all[date]||{};const c=Object.values(day).find(x=>x&&x.energy);
      if(c)return {low:.12,ok:.45,high:.86}[c.energy];}catch(e){}
    return null;
  }
  const DEFAULT=.86;
  function valueFor(date){const o=read();if(date&&Number.isFinite(o[date]))return o[date];const c=date?checkinDefault(date):null;return c!=null?c:DEFAULT;}
  function store(date,v){const o=read();if(date)o[date]=v;o.last=v;write(o);}
  function lastValue(){const o=read();return Number.isFinite(o.last)?o.last:DEFAULT;}

  // ---------- dial ----------
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function dialHTML(date){
    const v=valueFor(date),n=Math.round(v*100),label=LABEL[stateName(v)];
    return '<div class="state-dial" data-testid="state-dial" data-date="'+esc(date)+'"><div class="state-dial-head"><label for="feel-'+esc(date)+'">How do you feel?</label><span class="state-dial-value" data-testid="state-dial-value" aria-hidden="true">'+label+'</span></div>'+
      '<input id="feel-'+esc(date)+'" type="range" min="0" max="100" step="1" value="'+n+'" data-testid="feel-dial" aria-valuetext="'+label+'">'+
      '<div class="state-dial-scale" aria-hidden="true"><span>Low</span><span>Steady</span><span>High</span></div></div>';
  }
  function bindDials(scope){
    (scope||doc).querySelectorAll('[data-testid=feel-dial]:not([data-bound])').forEach(input=>{
      input.dataset.bound='1';const box=input.closest('.state-dial'),date=box.dataset.date,out=box.querySelector('.state-dial-value');
      input.addEventListener('input',()=>{const v=input.value/100,label=LABEL[stateName(v)];out.textContent=label;input.setAttribute('aria-valuetext',label);set(v);store(date,v);});
    });
  }
  // The visible day decides the tint; other screens keep the last state.
  function sync(){
    const dial=[...doc.querySelectorAll('#view [data-testid=feel-dial]')].find(e=>e.offsetParent);
    const v=dial?dial.value/100:lastValue();
    if(current===null||Math.abs(v-current)>.004)set(v,{instant:current===null});
  }

  // ---------- icons (24px grid, 1.5px line) ----------
  const P={
    menu:'M4 7h16M4 12h16M4 17h16',close:'M6 6l12 12M18 6L6 18',more:'M5.5 12h.01M12 12h.01M18.5 12h.01',
    check:'M5 12.5l4.2 4.2L19 7',plus:'M12 5v14M5 12h14',chevron:'M9 6l6 6-6 6',back:'M15 6l-6 6 6 6',arrow:'M5 12h14M13 6l6 6-6 6',
    external:'M14 5h5v5M19 5l-8 8M18 14v5H5V6h5',lock:'M6.5 10.5h11v9h-11zM8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5',
    leaf:'M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7',pin:'M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21zM12 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
    heart:'M12 19.5s-7-4.3-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.1c0 5.1-7 9.4-7 9.4z',star:'M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z',
    chat:'M5 6h14v10H10l-4 3v-3H5z',camera:'M4 8h3.5L9 6h6l1.5 2H20v10H4zM12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
    compass:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',meal:'M7 4v6a2 2 0 0 0 4 0V4M9 10v10M16 4c-2 1.5-2 6 0 7v9',
    flower:'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM12 9.5C10 5 14 5 12 9.5M14.5 12c4.5-2 4.5 2 0 0M12 14.5c2 4.5-2 4.5 0 0M9.5 12C5 14 5 10 9.5 12',
    car:'M4 15l1.6-5h12.8L20 15M4 15h16v3H4zM6.5 18v2M17.5 18v2',rest:'M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7',
    park:'M12 3l5 8h-3l4 6H6l4-6H7zM12 17v4',wave:'M3 10c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0',museum:'M3 9l9-5 9 5zM5 11v7M9.5 11v7M14.5 11v7M19 11v7M3 20h18',
    view:'M3 19l6-9 4 5 3-3 5 7zM16 6.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0',spot:'M12 4l7 8-7 8-7-8z',cup:'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3',
    bowl:'M4 11h16a8 8 0 0 1-16 0zM9 4c-1 1.5 1 2.5 0 4M13 4c-1 1.5 1 2.5 0 4',thumb:'M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2 3l-1 3h6a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7',
    mark:'M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4',
    water:'M3 9.5c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0',
    fire:'M12 3c.5 3.2-1.2 5.2-2.7 7.3C7.6 12.6 6.5 14.2 6.5 16.5 6.5 19.3 8.8 21 12 21s5.5-1.7 5.5-4.5c0-2.6-1.7-4.5-3.2-6.6C13.1 8.2 12.3 6.6 12 3zM11 14.8c.8-1.7 1.9-2.6 2.3-3.8',
    wood:'M12 21v-6M8 21h8M12 3l5.4 8h-3.1l2.6 5.2H7.1L9.7 11H6.6z',
    wind:'M4 8.5h11.5a2.6 2.6 0 1 0-2.6-2.6M4 12h14a2.6 2.6 0 1 1-2.6 2.6M4 15.5h8',
    earth:'M3 17.5h18M5.2 17.5C7 12.2 9.8 9.5 12 9.5s5 2.7 6.8 8',
    mic:'M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4M9 21h6',
    sparkle:'M11 4l1.7 4.8L17.5 10.5l-4.8 1.7L11 17l-1.7-4.8L4.5 10.5l4.8-1.7zM18 15l.8 2.2 2.2.8-2.2.8L18 21l-.8-2.2-2.2-.8 2.2-.8z',
    sun:'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
    cloud:'M7.5 18h9.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7.5 18z',
    rain:'M7.5 14.5h9.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5 3.3 3.3 0 0 0 .7 6.5zM9 17.5L8 20M13 17.5L12 20M17 17.5L16 20',
    snow:'M7.5 14.5h9.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5 3.3 3.3 0 0 0 .7 6.5zM9 18h.01M12 20h.01M15 18h.01'
  };
  function icon(name,size,cls){
    return '<svg class="v2-icon'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" width="'+(size||20)+'" height="'+(size||20)+'" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(P[name]||P.spot)+'"/></svg>';
  }

  // ---------- motion ----------
  // Vote like-burst: icon scales to 1.3x, 8 dots fly out, the count rolls up by one.
  function burst(el){
    if(!el||reduced()||!el.animate)return;
    el.classList.add('v2-burst-host');
    const ring=doc.createElement('span');ring.className='v2-burst';ring.setAttribute('aria-hidden','true');
    for(let i=0;i<8;i++){const d=doc.createElement('i');const a=i*Math.PI/4;d.style.setProperty('--dx',(Math.cos(a)*22).toFixed(1)+'px');d.style.setProperty('--dy',(Math.sin(a)*22).toFixed(1)+'px');ring.append(d);}
    el.append(ring);
    el.animate([{transform:'scale(1)'},{transform:'scale(1.3)',offset:.35},{transform:'scale(1)'}],{duration:420,easing:'cubic-bezier(.3,1.5,.5,1)'});
    ring.querySelectorAll('i').forEach(d=>d.animate([{transform:'translate(0,0) scale(.6)',opacity:1,easing:'cubic-bezier(.2,.7,.3,1)'},{transform:'translate(var(--dx),var(--dy)) scale(1)',opacity:1,offset:.55},{transform:'translate(var(--dx),var(--dy)) scale(.3)',opacity:0}],{duration:560,easing:'linear'}));
    setTimeout(()=>ring.remove(),600);
  }
  function rollCount(el){
    if(!el||reduced()||!el.animate)return;
    el.animate([{transform:'translateY(60%)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:260,easing:'cubic-bezier(.2,.8,.3,1)'});
  }
  // Ring numbers count up when a rings card first appears; the ring strokes draw in with them.
  // The final text is written first, so readers and tests always see the real value; only the paint animates.
  function countUp(scope){
    if(reduced())return;
    (scope||doc).querySelectorAll('.wellness-rings:not([data-v2-counted])').forEach(fig=>{
      fig.dataset.v2Counted='1';
      fig.querySelectorAll('svg circle[class^=ring-]').forEach(c=>{const to=c.getAttribute('stroke-dasharray');if(c.animate&&to)c.animate([{strokeDasharray:'0 100'},{strokeDasharray:to}],{duration:800,easing:'cubic-bezier(.2,.8,.2,1)'});});
      fig.querySelectorAll('.ring-value strong').forEach(s=>{
        const m=s.textContent.match(/^(\d+)(.*)$/);if(!m)return;const to=+m[1],rest=m[2];if(!to)return;
        const shadow=doc.createElement('span');shadow.className='v2-count';shadow.setAttribute('aria-hidden','true');s.classList.add('v2-counting');s.append(shadow);
        const start=performance.now();(function tick(now){const p=Math.min(1,(now-start)/700),e=1-(1-p)**3;shadow.textContent=Math.round(to*e)+rest;if(p<1&&shadow.isConnected)requestAnimationFrame(tick);else{shadow.remove();s.classList.remove('v2-counting');}})(start);
      });
    });
  }
  function enhance(){bindDials(doc);sync();countUp(doc);}
  if(doc&&doc.addEventListener){
    let queued=false;
    const run=()=>{queued=false;enhance();};
    const queue=()=>{if(!queued){queued=true;(root.queueMicrotask||setTimeout)(run);}};
    doc.addEventListener('DOMContentLoaded',()=>{enhance();new MutationObserver(queue).observe(doc.body,{childList:true,subtree:true});});
    // Paint the stored state before the first render so pages never flash the wrong palette.
    set(lastValue(),{instant:true});
  }
  root.GoNowTheme={at,focusTokens,base,tokens,mix,contrast,toOklch,toHex,stateName,set:set,value:()=>current,valueFor,dialHTML,bindDials,LABEL,ANCHORS,FOCUS};
  root.__gonowTheme=root.GoNowTheme;
  root.GoNowIcons={icon,paths:P};
  root.GoNowMotion={burst,rollCount,countUp,reduced};
  if(typeof module!=='undefined')module.exports={at,focusTokens,tokens,base,mix,contrast,toOklch,toHex,stateName,icon,ANCHORS,FOCUS};
})(typeof window==='undefined'?globalThis:window);
