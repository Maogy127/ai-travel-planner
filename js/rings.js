/* Display-only plan estimates. Numeric times are minutes after midnight. Untimed
   template stops use a one-hour duration; missing nights assume 22:00–08:00.
   Sleep = last end + 60 min wind-down to next day's first start - 30 min prep,
   capped at a 10-hour window. Walking is weighted .5, activity 1, vigorous 1.5.
   Recovery counts explicit rest/spa/free-time blocks. No device/medical data. */
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
    (dayItems||[]).forEach(i=>{
      const start=minutes(i.start==null?i.time:i.start), end=minutes(i.end);
      const duration=Math.max(0,end!==null&&start!==null?end-start:Number.isFinite(i.duration)?i.duration:60);
      const text=[i.title,i.kind,i.category,i.mode].join(' ').toLowerCase();
      if(start!==null){last=Math.max(last,end===null?start+duration:end);known=true;}
      if(/rest|recovery|spa|free time|meditat|stretch|pool/.test(text))rec+=duration;
      else if(/walk|hike|hiking|run|running|cycling|swim|pilates|yoga|strength|activity/.test(text))move+=duration*(/walk/.test(text)?.5:/run|running|strength|cycling/.test(text)?1.5:1);
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
    return {sleep:clamp(sleep/goals.sleep),move:clamp(move/goals.move),rec:clamp(rec/goals.rec),values:{sleep,move,rec},goals};
  }
  function sleepTime(h){const m=Math.round(h*60);return Math.floor(m/60)+' h '+m%60+' m';}
  function sleepGoal(h){return Number.isInteger(h)?h+' h':sleepTime(h);}
  function render(result,options){
    options=options||{};
    const labels=['Sleep','Movement','Recovery'], keys=['sleep','move','rec'];
    const text=keys.map((k,i)=>labels[i]+' '+(k==='sleep'?sleepTime(result.values[k]):Math.round(result.values[k])+' min')+' planned, goal '+(k==='sleep'?sleepGoal(result.goals[k]):result.goals[k]+' min'));
    return '<figure class="wellness-rings" data-testid="wellness-rings"><svg viewBox="0 0 100 100" role="img" aria-label="'+text.join(', ')+'"><g transform="rotate(-90 50 50)" fill="none" stroke-width="7" stroke-linecap="round">'+keys.map((k,i)=>'<circle cx="50" cy="50" r="'+(44-i*11)+'" stroke="var(--soft)"/><circle class="ring-'+k+'" cx="50" cy="50" r="'+(44-i*11)+'" pathLength="100" stroke="var(--'+k+')" stroke-dasharray="'+(result[k]*100).toFixed(1)+' 100"/>').join('')+'</g></svg><div class="ring-values">'+keys.map((k,i)=>'<div class="ring-value ring-value-'+k+'"><strong>'+(k==='sleep'?sleepTime(result.values[k]):Math.round(result.values[k])+' min')+'</strong><span>'+labels[i]+'</span><small>goal '+(k==='sleep'?sleepGoal(result.goals[k]):result.goals[k]+' min')+'</small></div>').join('')+'</div>'+(options.caption===false?'':'<figcaption>Plan estimates, not medical advice</figcaption>')+'</figure>';
  }
  root.GoNowRings={LEVEL_GOALS,selectLevel,scoreDay,render};
  if(typeof module!=='undefined')module.exports=root.GoNowRings;
})(typeof window==='undefined'?globalThis:window);
