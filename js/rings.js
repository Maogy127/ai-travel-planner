/* Plan estimates only. Count explicit wellness or conservative title/description keywords.
   Travel, prep, meals and stays never count. Generic tours, vehicle sightseeing,
   shopping, photos and free time count zero. Walk/stroll .5; hike/swim/surf/bike/
   class/yoga/pilates/easy run 1; tempo/interval run, strength and steep hike 1.5.
   Movement is capped at 90 credited minutes per block; explicit recovery at 60;
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
      // Incidental walking in a photo/tour description is not a planned movement block.
      if(!w && /photos|shopping|safari|truck|tour|free time/i.test(i.title||'') && !/walk|stroll|hik|swim|surf|cycl|bike|yoga|pilates|run|jog/i.test(i.title||'') && !/pool.*downtime|beach.*downtime/.test(text))return;
      const type=w?w.type:/pool.*downtime|beach.*downtime/.test(text)?'downtime':/\b(?:spa|massage|stretch(?:ing)?|meditation|breathwork|nap|sauna)\b/.test(text)?'recovery':/steep.*hik|tempo.*run|interval.*run|\b(?:strength|gym|weights)\b/.test(text)?'vigorous':/\b(?:walk(?:ing)?|stroll(?:ing)?)\b/.test(text)?'walk':/\b(?:hike|hiking|swim(?:ming)?|surf(?:ing)?|cycle|cycling|bike|biking|class|yoga|pilates|run(?:ning)?|jog(?:ging)?)\b/.test(text)?'movement':null;
      if(!type)return;
      const recovery=['downtime','recovery','spa','massage','stretch','meditation','breathwork','nap','sauna'].includes(type);
      const weight=recovery?1:w&&Number.isFinite(w.weight)?w.weight:type==='walk'?.5:type==='vigorous'?1.5:1;
      const cap=recovery?(type==='downtime'?30:60):90;
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
    return {sleep:clamp(sleep/goals.sleep),move:clamp(move/goals.move),rec:clamp(rec/goals.rec),values:{sleep,move,rec},goals,breakdown};
  }
  function sleepTime(h){const m=Math.round(h*60);return Math.floor(m/60)+' h '+m%60+' m';}
  function sleepGoal(h){return Number.isInteger(h)?h+' h':sleepTime(h);}
  let sequence=0;
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function render(result,options){
    options=options||{};
    const id='ring-breakdown-'+(++sequence);
    const panel='<button type="button" data-testid="ring-breakdown-toggle" aria-label="'+(options.name?'Activity breakdown for '+esc(options.name):'Activity breakdown')+'" aria-expanded="false" aria-controls="'+id+'">'+(options.name?'Details':'Activity breakdown')+'</button><div hidden id="'+id+'" data-testid="ring-breakdown">'+['Movement','Recovery'].map(group=>'<h4>'+group+'</h4><ul>'+result.breakdown.filter(b=>b.group===group).map(b=>'<li>'+esc(b.name)+': '+(b.type==='downtime'?b.minutes+' min downtime → counts '+b.credited+' min':b.minutes+' min × '+b.weight+' = '+b.credited+' min')+(b.capped?' (capped at '+b.cap+')':'')+'</li>').join('')+'</ul>').join('')+'<p>Not counted: travel, meals, prep, tours and general free time.</p></div>';
    const labels=['Sleep','Movement','Recovery'], keys=['sleep','move','rec'];
    const text=keys.map((k,i)=>labels[i]+' '+(k==='sleep'?sleepTime(result.values[k]):Math.round(result.values[k])+' min')+' planned, goal '+(k==='sleep'?sleepGoal(result.goals[k]):result.goals[k]+' min'));
    const compact=options.compact;
    return '<figure class="wellness-rings'+(compact?' compact-rings':'')+'" data-testid="wellness-rings"><svg viewBox="0 0 100 100" role="img" aria-label="'+text.join(', ')+'"><g transform="rotate(-90 50 50)" fill="none" stroke-width="7" stroke-linecap="round">'+keys.map((k,i)=>'<circle cx="50" cy="50" r="'+(44-i*11)+'" stroke="var(--soft)"/><circle class="ring-'+k+'" cx="50" cy="50" r="'+(44-i*11)+'" pathLength="100" stroke="var(--'+k+')" stroke-dasharray="'+(result[k]*100).toFixed(1)+' 100"/>').join('')+'</g></svg>'+(compact?'<span class="compact-values" aria-label="'+text.join(', ')+'">'+sleepTime(result.values.sleep).replace(/ h /,'h').replace(/ m$/,'')+' · '+Math.round(result.values.move)+' · '+Math.round(result.values.rec)+' min</span>':'<div class="ring-values">'+keys.map((k,i)=>'<div class="ring-value ring-value-'+k+'"><strong>'+(k==='sleep'?sleepTime(result.values[k]):Math.round(result.values[k])+' min')+'</strong><span>'+labels[i]+'</span><small>goal '+(k==='sleep'?sleepGoal(result.goals[k]):result.goals[k]+' min')+'</small></div>').join('')+'</div>')+(options.caption===false?'':'<figcaption>Plan estimates, not medical advice</figcaption>')+(!compact&&(result.move<1||result.rec<1)?'<p class="ring-encouragement">Rest is part of the plan</p>':'')+panel+'</figure>';
  }
  if(root.document)root.document.addEventListener('click',e=>{const b=e.target.closest('[data-testid="ring-breakdown-toggle"]');if(!b)return;const open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));root.document.getElementById(b.getAttribute('aria-controls')).hidden=!open;});
  root.GoNowRings={LEVEL_GOALS,selectLevel,scoreDay,render};
  if(typeof module!=='undefined')module.exports=root.GoNowRings;
})(typeof window==='undefined'?globalThis:window);
