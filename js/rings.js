/* Plan estimates only. Count explicit wellness or conservative title/description keywords.
   Travel, prep, meals and stays never count. Generic tours, vehicle sightseeing,
   shopping, photos and free time count zero. Walk/stroll .5; hike/swim/surf/bike/
   class/yoga/pilates/easy run 1; tempo/interval run, strength and steep hike 1.5.
   Walk blocks cap at 60 credited minutes; other movement caps at 90; explicit recovery at 60;
   pool/beach downtime at 30. Sleep ignores implausible ends and caps the last activity at 26:00. */
(function(root){
  'use strict';
  const LEVEL_GOALS={gentle:{sleep:7.5,move:30,rec:20},active:{sleep:8,move:60,rec:30},athlete:{sleep:8.5,move:90,rec:40},unsure:{sleep:8,move:45,rec:25}};
  const clamp=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
  function minutes(value){
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    const m=String(value||'').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    return m?(+m[1]% (m[3]?12:24)+(m[3]&&m[3].toUpperCase()==='PM'?12:0))*60+(+m[2]):null;
  }
  function selectLevel(trip, override){return override && override!=='trip' ? override : trip;}
  function scoreDay(dayItems,level,nextItems,preferences){
    const goals=Object.assign({},LEVEL_GOALS[level]||LEVEL_GOALS.unsure);
    let move=0,rec=0,last=0,known=false;
    const breakdown=[];
    (dayItems||[]).forEach(i=>{
      const start=minutes(i.start==null?i.time:i.start), end=minutes(i.end);
      const duration=Math.max(0,end!==null&&start!==null?end-start:Number.isFinite(i.duration)?i.duration:60);
      if(start!==null && start<=1620){
        // Bad durations must not erase sleep: ends beyond 27:00 fall back to
        // the known start, and the last activity is capped at 26:00.
        const candidate=end===null?start+duration:end;
        last=Math.max(last,Math.min(1560,candidate>1620?start:candidate));known=true;
      }
      if(['travel','prep','meal','stay'].includes(i.kind))return;
      const text=[i.title,i.desc].join(' ').toLowerCase();
      const w=i.wellness;
      if(!w&&/\b(?:boat|truck|van|shuttle|uber|parasail|parasailing|dive|diving|snorkel|snorkeling)\b/.test(text)&&!/\bswim(?:ming)?\b/.test(text))return;
      if(!w&&/photos/i.test(i.title||'')&&!/walk|stroll|wander|on foot/i.test(i.title||''))return;
      // Incidental walking in a photo/tour description is not a planned movement block.
      if(!w && /photos|shopping|safari|truck|tour|free time/i.test(i.title||'') && !/walk|stroll|wander|on foot|hik|swim|surf|cycl|bike|yoga|pilates|run|jog/i.test(text) && !/pool.*downtime|beach.*downtime/.test(text))return;
      const type=w?w.type:/pool.*downtime|beach.*downtime/.test(text)?'downtime':/\b(?:spa|massage|stretch(?:ing)?|meditation|breathwork|nap|sauna)\b/.test(text)?'recovery':/steep.*hik|tempo.*run|interval.*run|\b(?:strength|gym|weights)\b/.test(text)?'vigorous':/\b(?:walk(?:ing)?|stroll(?:ing)?|wander(?:ing)?|on foot)\b/.test(text)?'walk':/\b(?:hike|hiking|swim(?:ming)?|surf(?:ing)?|cycle|cycling|bike|biking|class|yoga|pilates|run(?:ning)?|jog(?:ging)?)\b/.test(text)?'movement':null;
      if(!type)return;
      const recovery=['downtime','recovery','spa','massage','stretch','meditation','breathwork','nap','sauna'].includes(type);
      const weight=recovery?1:w&&Number.isFinite(w.weight)?w.weight:type==='walk'?.5:type==='vigorous'?1.5:1;
      const cap=recovery?(type==='downtime'?30:60):type==='walk'?60:90;
      const credited=Math.min(cap,duration*weight);
      if(!credited)return;
      if(recovery)rec+=credited;else move+=credited;
      breakdown.push({name:i.title,group:recovery?'Recovery':'Movement',minutes:duration,weight,credited,cap,type,capped:duration*weight>cap});
    });
    const next=(nextItems||[]).map(i=>minutes(i.start==null?i.time:i.start)).filter(n=>n!==null);
    const wake=next.length?Math.min(...next)-30:480;
    let sleep=known?Math.max(0,Math.min(10,(1440+wake-(last+60))/60)):8;
    if(preferences && (preferences.bedtime || preferences.wake)){
      const bed=minutes(preferences.bedtime), rise=minutes(preferences.wake);
      const start=Math.max(known?last+45:1320,bed===null?0:bed);
      const end=Math.min(wake,rise===null?1440:rise);
      sleep=Math.max(0,(1440+end-start)/60);
    }
    let sleepDetail=null;
    if(preferences && Array.isArray(preferences.previousItems)){
      const previous=preferences.previousItems.filter(i=>minutes(i.end)!==null && minutes(i.end)<=1620).sort((a,b)=>minutes(b.end)-minutes(a.end));
      const first=(dayItems||[]).filter(i=>minutes(i.start)!==null).sort((a,b)=>minutes(a.start)-minutes(b.start))[0];
      const lastItem=previous[0], returned=lastItem?Math.min(1560,minutes(lastItem.end)):null;
      const departure=first?minutes(first.start):510;
      const bed=minutes(preferences.bedtime), rise=minutes(preferences.wake);
      const start=Math.max(returned===null?(bed===null?1320:bed):returned+45,bed===null?0:bed);
      const end=Math.min(departure-30,rise===null?1440:rise);
      sleep=Math.max(0,Math.min(10,(1440+end-start)/60));
      sleepDetail={returned:returned===null?start:returned,departure,start,end,first,lastItem,stay:preferences.stay||'your stay',bedtime:preferences.usualBedtime,adjusted:preferences.jetlagAdjusted};
    }
    return {sleepDetail,level:LEVEL_GOALS[level]?level:'unsure',sleep:clamp(sleep/goals.sleep),move:clamp(move/goals.move),rec:clamp(rec/goals.rec),values:{sleep,move,rec},goals,breakdown};
  }
  function shortNight(sleep,goal){return sleep<.85*goal || (goal-sleep)*60>60+1e-7;}
  function clock(n){n=(n%1440+1440)%1440;return (Math.floor(n/60)%12||12)+':'+String(n%60).padStart(2,'0')+(n>=720?' PM':' AM');}
  function proposal(items,direction){
    const sorted=(items||[]).filter(i=>Number.isFinite(i.start)&&Number.isFinite(i.end)).sort((a,b)=>a.start-b.start);
    const item=direction==='earlier'?sorted.at(-1):sorted[0];
    if(!item||item.locked)return null;
    const start=item.start+(direction==='earlier'?-30:30),end=item.end+(direction==='earlier'?-30:30);
    if(start<0||end>1440||sorted.some(i=>i.id!==item.id&&start<i.end&&end>i.start))return null;
    return {id:item.id,start,end,title:item.title};
  }
  function freeGap(items){for(let start=600;start+30<=1200;start+=5)if(!(items||[]).some(i=>Number.isFinite(i.start)&&start<i.end&&start+30>i.start))return start;return null;}
  function sleepTime(h){const m=Math.round(h*60);return Math.floor(m/60)+' h '+String(m%60).padStart(2,'0')+' m';}
  function sleepGoal(h){return Number.isInteger(h)?h+' h':sleepTime(h);}
  let sequence=0;
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function summary(v){var m=Math.round(v.sleep*60);return 'Sleep '+Math.floor(m/60)+'h'+String(m%60).padStart(2,'0')+' · Move '+Math.round(v.move)+' min'+(Math.round(v.rec)>0?' · Recover '+Math.round(v.rec)+' min':'');}
  function render(result,options){
    options=options||{};
    const id='ring-breakdown-'+(++sequence);
    const detail=result.sleepDetail;
    const fly=!!options.flyHome, compact=options.compact, keys=fly?['sleep']:['sleep','move','rec'];
    const duration=Math.floor(Math.round(result.values.sleep*60)/60)+'h'+String(Math.round(result.values.sleep*60)%60).padStart(2,'0');
    const sleepText=detail?'Sleep estimate: '+clock(detail.start)+'–'+clock(detail.end)+', with time to wind down and get ready.':'Sleep estimate allows time to wind down and get ready.';
    const panel='<button type="button" data-testid="ring-breakdown-toggle" aria-expanded="false" aria-controls="'+id+'">How we count</button><div hidden id="'+id+'" data-testid="ring-breakdown">'+(fly?'':['Movement','Recovery'].map(group=>{const list=result.breakdown.filter(b=>b.group===group);return list.length?'<h4>'+group+'</h4><ul>'+list.map(b=>'<li>'+esc(b.name)+' · '+b.credited+' min</li>').join('')+'</ul>':'';}).join(''))+'<p>'+esc(sleepText)+'</p></div>';
    const advice=options.suppressAdvice?'':shortNight(result.values.sleep,result.goals.sleep)?'<p class="ring-encouragement">'+(fly?'Short night · Rest on your flight':'Short night · '+duration+' sleep')+'</p>':!fly&&result.values.rec===0?'<button type="button" class="ring-encouragement" data-testid="ring-rest-break">No rest today · Add a pool break?</button>':!fly&&result.move<1?'<p class="ring-encouragement">Easy day — a short walk is plenty.</p>':'';
    const labels={sleep:'Sleep',move:'Movement',rec:'Recovery'};
    let markup='<figure class="wellness-rings'+(compact?' compact-rings':'')+'" data-testid="wellness-rings"><svg viewBox="0 0 100 100" role="img" aria-label="'+(fly?esc('Sleep '+duration+' · '+(options.flightLabel||'Flight time not set')):esc(keys.map(k=>labels[k]+' '+(k==='sleep'?sleepTime(result.values[k]):Math.round(result.values[k])+' min')+' planned, goal '+(k==='sleep'?sleepGoal(result.goals[k]):result.goals[k]+' min')+(k==='sleep'&&detail&&detail.bedtime?', usual bedtime '+clock(minutes(detail.bedtime)):'')).join(', ')))+'"><g transform="rotate(-90 50 50)" fill="none" stroke-width="7" stroke-linecap="round">'+keys.map((k,i)=>'<circle cx="50" cy="50" r="'+(44-i*11)+'" stroke="var(--soft)"/><circle class="ring-'+k+'" cx="50" cy="50" r="'+(44-i*11)+'" pathLength="100" stroke="var(--'+k+')" stroke-dasharray="'+(result[k]*100).toFixed(1)+' 100"/>').join('')+'</g></svg>'+(compact?'<span class="compact-values">'+(fly?'Sleep '+duration+' · '+esc(options.flightLabel||'Flight time not set'):summary(result.values))+'</span>':'<div class="ring-values">'+keys.map(k=>'<div class="ring-value ring-value-'+k+'"><strong>'+(k==='sleep'?sleepTime(result.values[k]):Math.round(result.values[k])+' min')+'</strong><span>'+labels[k]+'</span>'+(fly?'':'<small>goal '+(k==='sleep'?sleepGoal(result.goals[k]):result.goals[k]+' min')+'</small>')+'</div>').join('')+'</div>')+(options.caption===false?'':'<figcaption>Plan estimates, not medical advice</figcaption>')+advice+panel+'</figure>';
    return markup;
  }
  if(root.document)root.document.addEventListener('click',e=>{const b=e.target.closest('[data-testid="ring-breakdown-toggle"]');if(!b)return;const open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));root.document.getElementById(b.getAttribute('aria-controls')).hidden=!open;});
  root.GoNowRings={summary,LEVEL_GOALS,selectLevel,scoreDay,render,shortNight,proposal,freeGap,clock};
  if(typeof module!=='undefined')module.exports=root.GoNowRings;
})(typeof window==='undefined'?globalThis:window);
