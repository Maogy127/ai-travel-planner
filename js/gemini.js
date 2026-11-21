/* GoNow free AI and weather (Nov 20, 2026).
   - AI: Firebase AI Logic, Gemini Developer API backend, no-cost Spark plan. The model only proposes; the existing
     rule-based planner checks every proposal (hours, closed days, bookings, pace capacity, flights, travel time).
   - At the free limit (per minute or per day) AI pauses itself until the limit resets and the app keeps the
     rule-based plan and the simple-edit parser. Nothing is ever billed.
   - Weather: Open-Meteo (free, no key). Forecast inside 16 days, otherwise last year's weather on the same dates. */
(function(root){
'use strict';
const DAY=86400000,PT='America/Los_Angeles';
const store=()=>{try{return root.localStorage||null;}catch(e){return null;}};
const readJSON=(k,d)=>{try{const v=JSON.parse(store().getItem(k));return v==null?d:v;}catch(e){return d;}};
const writeJSON=(k,v)=>{try{store().setItem(k,JSON.stringify(v));}catch(e){}};
const cfg=()=>Object.assign({enabled:false,model:'gemini-3.5-flash-lite',sdk:'https://www.gstatic.com/firebasejs/13.4.0/',appCheckSiteKey:'',appCheckProvider:'v3',deviceDailyLimit:25,timeoutMs:15000},root.GONOW_AI_CONFIG||{});
const hm=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const toMin=s=>{const m=String(s||'').trim().match(/^(\d{1,2}):(\d{2})$/);if(!m||+m[1]>23||+m[2]>59)return null;return +m[1]*60+ +m[2];};
const clock=n=>(Math.floor(n/60)%12||12)+':'+String(n%60).padStart(2,'0')+(n<720?' AM':' PM');
const noEmoji=s=>String(s||'').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,'').replace(/\s+/g,' ').trim();
const short=(s,n)=>{s=noEmoji(s);return s.length>n?s.slice(0,n-1).replace(/\s+\S*$/,'')+'…':s;};
const weekday=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'});

// ---------- free-tier pause ----------
function pacificDay(now){return new Intl.DateTimeFormat('en-CA',{timeZone:PT,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
// Daily Gemini quotas reset at midnight Pacific time.
function msToPacificMidnight(now){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:PT,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(x=>[x.type,x.value]));
 return Math.max(60000,(86400-(+p.hour*3600+ +p.minute*60+ +p.second))*1000-(now%1000));
}
function classify(err,now=Date.now()){
 const data=err&&err.customErrorData||{},status=data.status||err&&err.status||0;
 const text=[err&&err.code,err&&err.message,status,data.statusText,JSON.stringify(data.errorDetails||'')].join(' ');
 // Paid-tier projects with no prepay credit answer 429 too; that isn't a free limit, so treat AI as off (never prompt to pay).
 if(/prepay|credits? (are |is )?depleted/i.test(text))return {kind:'off',until:now+10*60000};
 if(/RESOURCE_EXHAUSTED|\b429\b|quota|rate.?limit/i.test(text)){
  if(/PerDay|per.day|daily|RPD/i.test(text))return {kind:'day',until:now+msToPacificMidnight(now)};
  const retry=text.match(/retryDelay\W+(\d+)s/);return {kind:'minute',until:now+Math.min(300,Math.max(20,retry?+retry[1]:60))*1000};
 }
 if(/SERVICE_DISABLED|has not been used|is disabled|not enabled|API_KEY_SERVICE_BLOCKED|PERMISSION_DENIED|app.?check|\b40[13]\b|api-not-enabled/i.test(text))return {kind:'off',until:now+10*60000};
 if(/timeout|timed out|Failed to fetch|NetworkError|network|offline|import/i.test(text))return {kind:'network',until:now+30000};
 if(/SAFETY|blocked|response-error/i.test(text))return {kind:'blocked',until:0};
 return {kind:'error',until:now+60000};
}
const PAUSE='gonow:ai:pause',USES='gonow:ai:uses';
function paused(now=Date.now()){const p=readJSON(PAUSE,null);return p&&p.until>now?p:null;}
function uses(now=Date.now()){const u=readJSON(USES,{});return u.day===pacificDay(now)?u.n||0:0;}
function status(now=Date.now()){
 const c=cfg(),p=paused(now);
 if(!c.enabled)return {state:'off',line:'AI is off · simple edits still work'};
 if(p&&p.kind==='off')return {state:'off',line:'AI isn’t switched on yet · simple edits still work'};
 if(p&&p.kind==='day')return {state:'resting',line:'Free AI is resting until tomorrow · simple edits still work',until:p.until};
 if(p&&p.kind==='minute')return {state:'busy',line:'Free AI is busy · try again in a minute',until:p.until};
 if(p)return {state:'retry',line:'AI is unavailable right now · simple edits still work',until:p.until};
 if(uses(now)>=c.deviceDailyLimit)return {state:'resting',line:'You’ve used today’s free AI · back tomorrow',until:now+msToPacificMidnight(now)};
 if(root.navigator&&root.navigator.onLine===false)return {state:'offline',line:'Offline · simple edits still work'};
 return {state:'ready',line:'Free AI · no cost to you'};
}
const available=now=>status(now).state==='ready';
// Automated browsers never spend the shared free quota unless a test supplies a mock.
const autoPlan=()=>available()&&(!!root.GONOW_AI_MOCK||!(root.navigator&&root.navigator.webdriver));

// ---------- SDK ----------
let sdkJob=null;
function sdk(){
 if(sdkJob)return sdkJob;
 sdkJob=(async()=>{
  const c=cfg(),imp=root.GONOW_AI_IMPORTER||(u=>import(u));
  const [app,ai,check]=await Promise.all([imp(c.sdk+'firebase-app.js'),imp(c.sdk+'firebase-ai.js'),c.appCheckSiteKey?imp(c.sdk+'firebase-app-check.js'):null]);
  const a=app.getApps().find(x=>x.name==='gonow-ai')||app.initializeApp(root.GONOW_FIREBASE_CONFIG,'gonow-ai');
  // App Check is enforced for AI Logic: a reCAPTCHA v3 or reCAPTCHA Enterprise site key (public) attests this site.
  if(check)check.initializeAppCheck(a,{provider:c.appCheckProvider==='enterprise'?new check.ReCaptchaEnterpriseProvider(c.appCheckSiteKey):new check.ReCaptchaV3Provider(c.appCheckSiteKey),isTokenAutoRefreshEnabled:true});
  return {ai,inst:ai.getAI(a,{backend:new ai.GoogleAIBackend()})};
 })();
 sdkJob.catch(()=>{sdkJob=null;});
 return sdkJob;
}
function toSchema(S,spec){
 if(spec.enum)return S.enumString({enum:spec.enum});
 if(spec.type==='array')return S.array({items:toSchema(S,spec.items)});
 if(spec.type==='object'){const properties={};Object.keys(spec.properties).forEach(k=>{properties[k]=toSchema(S,spec.properties[k]);});return S.object({properties,optionalProperties:spec.optional||[]});}
 return spec.type==='integer'?S.integer():S.string();
}
const PLAN_SCHEMA={type:'object',properties:{days:{type:'array',items:{type:'object',properties:{date:{type:'string'},stops:{type:'array',items:{type:'object',properties:{id:{type:'string'},time:{type:'string'}}}}}}},note:{type:'string'}}};
const EDIT_SCHEMA={type:'object',properties:{changes:{type:'array',items:{type:'object',properties:{action:{enum:['move','remove']},id:{type:'string'},date:{type:'string'},time:{type:'string'}},optional:['date','time']}},say:{type:'string'}}};
function timeout(p,ms){let t;return Promise.race([p,new Promise((_,no)=>{t=setTimeout(()=>no(Object.assign(Error('AI timeout'),{code:'timeout'})),ms);})]).finally(()=>clearTimeout(t));}
async function ask(kind,prompt,schema){
 const st=status();if(st.state!=='ready')throw Object.assign(Error(st.line),{code:'paused',status:st});
 const now=Date.now();writeJSON(USES,{day:pacificDay(now),n:uses(now)+1});
 try{
  if(root.GONOW_AI_MOCK)return await timeout(Promise.resolve().then(()=>root.GONOW_AI_MOCK(kind,prompt)),cfg().timeoutMs);
  const {ai,inst}=await timeout(sdk(),cfg().timeoutMs);
  const model=ai.getGenerativeModel(inst,{model:cfg().model,generationConfig:{responseMimeType:'application/json',responseSchema:toSchema(ai.Schema,schema),temperature:.2,maxOutputTokens:2048}});
  const r=await timeout(model.generateContent(prompt),cfg().timeoutMs);
  return JSON.parse(r.response.text());
 }catch(e){const c=classify(e);if(c.until)writeJSON(PAUSE,{kind:c.kind,until:c.until});e.kind=c.kind;throw e;}
}

// ---------- 1. AI plan from picks ----------
// input: {destination,start,end,pace,capacity,arrival,leave,feel:{date:'Low'|'Steady'|'High'},weather:{date:line},picks:[...]}
function planPrompt(input){
 return ['You arrange a traveler\'s picks into a day-by-day plan for GoNow, a wellness travel planner. Return JSON only.',
  'Rules:',
  '- Use only the pick ids given, each at most once. Leave out picks that don\'t fit.',
  '- Times are 24-hour "HH:MM" local time at the destination.',
  '- Meals: breakfast 07:00-10:00, lunch 11:30-13:30, snack 14:30-17:00, dinner 18:00-20:00. Activities start 07:00-18:00.',
  '- Respect open hours, closed weekdays and fixed bookings (keep their date and time).',
  '- First day: only stops after '+input.arrival+'. Last day: finish before '+input.leave+'.',
  '- Pace '+input.pace+': at most '+input.capacity+' minutes of stops per day.',
  '- Feel per day: Low = fewer, gentler stops and a later start. High = active stops in the morning.',
  '- Weather: outdoor and water picks go on drier days, in the morning when rain is likely.',
  '- Keep stops in the same area on the same day and leave travel time between them.',
  '- note: one short sentence (max 80 characters) on how you arranged the days. No emoji.',
  'Trip: '+JSON.stringify({destination:input.destination,dates:input.dates,feel:input.feel,weather:input.weather}),
  'Picks: '+JSON.stringify(input.picks)].join('\n');
}
function readPlan(raw,input){
 const ids=new Map((input.picks||[]).map(p=>[p.id,p])),dates=new Set(input.dates||[]),seen=new Set(),stops=[];
 (raw&&Array.isArray(raw.days)?raw.days:[]).forEach(d=>{if(!d||!dates.has(d.date)||!Array.isArray(d.stops))return;d.stops.forEach(s=>{const t=toMin(s&&s.time);if(!s||!ids.has(s.id)||seen.has(s.id)||t===null||t<360||t>1320)return;seen.add(s.id);stops.push({id:s.id,date:d.date,start:Math.round(t/5)*5});});});
 stops.sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
 if(!stops.length)throw Object.assign(Error('AI plan had no usable stops'),{kind:'blocked'});
 return {stops,note:short(raw.note||'',90)};
}
async function planFromPicks(input){return readPlan(await ask('plan',planPrompt(input),PLAN_SCHEMA),input);}

// ---------- 2. Edits (voice or typed) ----------
// items: [{id,title,date,start,kind,category,locked}] · dates: ['YYYY-MM-DD',...]
const STOP=new Set('the a an my our to on at in into for from of and please can you could i want would like let us lets it this that day trip stop'.split(' '));
const SYN={hike:/hike|hiking|trail|summit|ridge|crater|head|peak|mountain|lookout/,beach:/beach|bay|cove|shore/,swim:/swim|beach|pool|bay/,snorkel:/snorkel|reef|bay|marine/,dive:/dive|diving|scuba/,museum:/museum|palace|memorial|gallery|center/,shopping:/shop|mall|market|outlet|store/,spa:/spa|massage|wellness/,yoga:/yoga|stretch/,walk:/walk|stroll|garden|park/,coffee:/coffee|cafe|caf|espresso/,ranch:/ranch|farm/,sunset:/sunset/,tour:/tour|ranch|cruise/};
const MEAL={breakfast:[0,660],brunch:[540,780],lunch:[660,870],dinner:[1020,1440],snack:[840,1020]};
const words=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w&&!STOP.has(w));
function matchItem(phrase,items){
 const want=words(phrase);if(!want.length)return null;
 const scored=items.map(i=>{const title=String(i.title||'').toLowerCase(),hay=title+' '+String(i.category||'').toLowerCase(),tw=new Set(words(title));let s=0;
  want.forEach(w=>{if(tw.has(w)||(w.length>3&&title.includes(w)))s+=2;else if(SYN[w]&&SYN[w].test(hay))s+=1.5;else if(MEAL[w]&&i.kind==='meal'&&i.start!=null&&i.start>=MEAL[w][0]&&i.start<MEAL[w][1])s+=1.5;else if((w==='meal'||w==='food'||w==='restaurant')&&i.kind==='meal')s+=.5;});
  return {i,s};}).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
 if(!scored.length||(scored[1]&&scored[1].s===scored[0].s))return null;
 return scored[0].i;
}
const PARTS=[[/early morning|first thing|sunrise/,420],[/morning/,480],[/afternoon/,840],[/\bnoon\b|midday|lunch ?time/,720],[/sunset/,1020],[/evening/,1080],[/tonight|night/,1200]];
const WD=['sun','mon','tue','wed','thu','fri','sat'];
function target(spec,dates){
 let s=' '+spec.toLowerCase().replace(/\./g,'')+' ',date=null,start=null;
 let m=s.match(/\bday\s*(\d{1,2})\b/);if(m&&dates[+m[1]-1]){date=dates[+m[1]-1];s=s.replace(m[0],' ');}
 if(!date&&/\b(first day|arrival day)\b/.test(s))date=dates[0];
 if(!date&&/\b(last day|final day)\b/.test(s))date=dates[dates.length-1];
 if(!date){m=s.match(/\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday|sday)?\b/);if(m){const k=WD.indexOf(m[1].slice(0,3)),hit=dates.find(d=>new Date(d+'T12:00:00Z').getUTCDay()===k);if(hit){date=hit;s=s.replace(m[0],' ');}}}
 m=s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)||s.match(/\b(\d{1,2}):(\d{2})\b/);
 if(m){let h=+m[1]%12;if(m[3]==='pm')h+=12;if(!m[3]&&+m[1]>=13)h=+m[1];if(!m[3]&&+m[1]===12)h=12;if(!m[3]&&+m[1]<7)h+=12;start=h*60+(+m[2]||0);}
 else for(const [re,t] of PARTS)if(re.test(s)){start=t;break;}
 return date||start!=null?{date,start}:null;
}
function localEdit(text,items,dates){
 const t=String(text||'').trim().toLowerCase().replace(/[.!?。！？]+$/,'').replace(/^(?:hey |ok |okay )?(?:please |can you |could you |let'?s |i want to |i'd like to )*/,'');
 const movable=items.filter(i=>!i.locked);
 let m=t.match(/^(?:remove|delete|drop|skip|cancel|take out|take off)\s+(.+?)(?:\s+(?:from|off)\s+(?:the\s+)?(?:plan|day|schedule|list).*)?$/);
 if(m){const i=matchItem(m[1],movable);return i?[{type:'remove',id:i.id}]:null;}
 m=t.match(/^(?:move|push|shift|bump)\s+(.+?)\s+(?:by\s+)?(an?|half an|\d+)\s*(hours?|hrs?|h|minutes?|mins?)\s+(earlier|later)$/);
 if(m){const i=matchItem(m[1],movable);if(!i||i.start==null)return null;const hour=/^h/.test(m[3]),mins=m[2]==='half an'?30:/^an?$/.test(m[2])?(hour?60:1):+m[2]*(hour?60:1);return [{type:'move',id:i.id,date:i.date,start:Math.max(360,Math.min(1320,i.start+mins*(m[4]==='earlier'?-1:1)))}];}
 m=t.match(/^(?:move|shift|put|push|bump|switch|change|reschedule|do|have)\s+(.+?)\s+(?:to|into|on|for|at|in)\s+(.+)$/);
 if(m){let phrase=m[1],spec=m[2];
  // "Move the hike to the morning on Friday": the target holds the day too.
  const tg=target(spec,dates);const i=matchItem(phrase,movable);if(!i||!tg)return null;
  return [{type:'move',id:i.id,date:tg.date||i.date,start:tg.start!=null?tg.start:i.start}];}
 return null;
}
function editPrompt(text,items,dates){
 return ['A traveler using GoNow, a wellness travel planner, asked for a change to their plan. Turn it into changes. Return JSON only.',
  'Actions: move (set a new date and/or time "HH:MM", 24-hour) or remove (take the stop off its day; it waits in "Needs a time").',
  'Use only the ids listed. Never change stops marked locked. If the request is unclear, return no changes and use say to suggest how to phrase it.',
  'say: one short line (max 80 characters) confirming the change, in the traveler\'s language. No emoji.',
  'Days: '+JSON.stringify(dates.map((d,i)=>({date:d,label:'Day '+(i+1)+' '+weekday(d)}))),
  'Stops: '+JSON.stringify(items.map(i=>({id:i.id,title:i.title,date:i.date,time:i.start==null?'needs a time':hm(i.start),kind:i.kind,locked:!!i.locked}))),
  'Request: '+JSON.stringify(String(text).slice(0,300))].join('\n');
}
function readEdit(raw,items,dates){
 const byId=new Map(items.map(i=>[i.id,i])),ops=[];
 (raw&&Array.isArray(raw.changes)?raw.changes:[]).forEach(c=>{const i=c&&byId.get(c.id);if(!i||i.locked)return;
  if(c.action==='remove'){ops.push({type:'remove',id:i.id});return;}
  if(c.action!=='move')return;const date=dates.includes(c.date)?c.date:i.date,t=toMin(c.time),start=t===null?i.start:Math.round(t/5)*5;
  if(start==null||start<360||start>1320||(date===i.date&&start===i.start))return;ops.push({type:'move',id:i.id,date,start});});
 return {ops,say:short(raw&&raw.say||'',90)};
}
// Simple edits never need AI; anything else goes to AI when it is available.
async function edit(text,items,dates){
 const local=localEdit(text,items,dates);if(local)return {ops:local,by:'local'};
 if(!available())return {ops:[],by:'none',say:status().line};
 const r=readEdit(await ask('edit',editPrompt(text,items,dates),EDIT_SCHEMA),items,dates);return Object.assign(r,{by:'ai'});
}

// ---------- 3. Weather (Open-Meteo, free, no key) ----------
function iconFor(code){return code<=1?'sun':code<=3||code===45||code===48?'cloud':(code>=71&&code<=77)||code===85||code===86?'snow':'rain';}
const addDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
function lastYear(d){const x=new Date(d+'T12:00:00Z');x.setUTCFullYear(x.getUTCFullYear()-1);return x.toISOString().slice(0,10);}
function weatherRequests(lat,lng,dates,today){
 const until=addDays(today,15),fc=dates.filter(d=>d>=today&&d<=until),ly=dates.filter(d=>!fc.includes(d)),out=[];
 const q=(base,from,to,daily)=>base+'?'+new URLSearchParams({latitude:(+lat).toFixed(3),longitude:(+lng).toFixed(3),start_date:from,end_date:to,daily,temperature_unit:'fahrenheit',timezone:'auto'});
 if(fc.length)out.push({kind:'forecast',dates:fc,url:q('https://api.open-meteo.com/v1/forecast',fc[0],fc[fc.length-1],'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max')});
 if(ly.length){const shifted=ly.map(lastYear);out.push({kind:'lastYear',dates:ly,shifted,url:q('https://archive-api.open-meteo.com/v1/archive',shifted[0],shifted[shifted.length-1],'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum')});}
 return out;
}
function readWeather(req,data){
 const d=data&&data.daily,out={};if(!d||!Array.isArray(d.time))return out;
 req.dates.forEach((date,k)=>{const at=d.time.indexOf(req.kind==='lastYear'?req.shifted[k]:date);if(at<0)return;const hi=d.temperature_2m_max&&d.temperature_2m_max[at],lo=d.temperature_2m_min&&d.temperature_2m_min[at];if(!Number.isFinite(hi)||!Number.isFinite(lo))return;
  const code=Number.isFinite(d.weather_code&&d.weather_code[at])?d.weather_code[at]:2;
  out[date]=req.kind==='forecast'?{kind:'forecast',hi:Math.round(hi),lo:Math.round(lo),rain:Number.isFinite(d.precipitation_probability_max&&d.precipitation_probability_max[at])?d.precipitation_probability_max[at]:null,icon:iconFor(code)}
   :{kind:'lastYear',hi:Math.round(hi),lo:Math.round(lo),rainMm:Number.isFinite(d.precipitation_sum&&d.precipitation_sum[at])?d.precipitation_sum[at]:null,icon:iconFor(code)};});
 return out;
}
function weatherLine(w){
 if(!w)return '';
 if(w.kind==='forecast')return w.hi+'° / '+w.lo+'°'+(w.rain!=null?' · '+w.rain+'% rain':'');
 return 'Last year '+w.hi+'° / '+w.lo+'°'+(w.rainMm>=1?' · rainy':'');
}
const wet=w=>!!w&&(w.kind==='forecast'?w.rain>=60:w.rainMm>=5);
const wcache={},WKEY='gonow:weather:';
function fetchJSON(url,ms){const f=root.GONOW_WEATHER_FETCH||root.fetch;let t;return Promise.race([Promise.resolve(f(url)).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}),new Promise((_,no)=>{t=setTimeout(()=>no(Error('timeout')),ms);})]).finally(()=>clearTimeout(t));}
function weather(lat,lng,dates,now=Date.now()){
 if(!Number.isFinite(+lat)||!Number.isFinite(+lng)||!dates||!dates.length)return Promise.resolve({});
 const today=new Date(now).toISOString().slice(0,10),key=WKEY+(+lat).toFixed(2)+','+(+lng).toFixed(2)+':'+dates[0]+':'+dates.length;
 const saved=readJSON(key,null);if(saved&&saved.until>now)return Promise.resolve(saved.days);
 if(wcache[key])return wcache[key];
 wcache[key]=Promise.all(weatherRequests(lat,lng,dates,today).map(r=>fetchJSON(r.url,8000).then(d=>readWeather(r,d)).catch(()=>({})))).then(parts=>{
  const days=Object.assign({},...parts);delete wcache[key];
  if(Object.keys(days).length)writeJSON(key,{until:now+(Object.values(days).some(w=>w.kind==='forecast')?3*3600000:7*DAY),at:now,days});
  return days;});
 return wcache[key];
}

const api={cfg,status,available,autoPlan,classify,paused,uses,pacificDay,msToPacificMidnight,ask,planPrompt,readPlan,planFromPicks,
 localEdit,matchItem,target,editPrompt,readEdit,edit,PLAN_SCHEMA,EDIT_SCHEMA,toSchema,hm,toMin,clock,short,
 weather,weatherRequests,readWeather,weatherLine,iconFor,lastYear,wet,resetPause:()=>{try{store().removeItem(PAUSE);}catch(e){}}};
root.GoNowAI=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
