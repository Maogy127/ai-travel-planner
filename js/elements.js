/* GoNow elements: a day can quietly collect Water, Fire, Wood, Wind and Earth.
   Derived from activity type, tags, effort and title — never a new morning question.
   An activity keeps at most two elements. Days that gather four or more get a
   gentle celebration only; there is no "missing" copy. */
(function(root){
  'use strict';
  const ORDER=['water','fire','wood','wind','earth'];
  const LIST=[
    {id:'water',name:'Water',nameZh:'水',hint:'Sea, pool, or a quiet lake',color:'#A897BC'},
    {id:'fire',name:'Fire',nameZh:'火',hint:'Warmth and movement',color:'#C23B22'},
    {id:'wood',name:'Wood',nameZh:'木',hint:'A trail, a walk, or time in nature',color:'#7FA046'},
    {id:'wind',name:'Wind',nameZh:'风',hint:'Stretch, breath, or a still moment',color:'#D9C8A6'},
    {id:'earth',name:'Earth',nameZh:'土',hint:'A nourishing meal or a night of rest',color:'#F2B820'}
  ];
  // Palette notes: fire = Energized tomato, wood = avocado, earth = yolk,
  // wind = Calm linen/oat glow, water = Calm Restore lavender (v2 has no blue;
  // this is the existing cool tone). Colors are fills/strokes only, never text.
  const COLORS=Object.fromEntries(LIST.map(e=>[e.id,e.color]));
  const BY=Object.fromEntries(LIST.map(e=>[e.id,e]));
  const SKIP=new Set(['travel','flight','prep']);
  const PATHS={
    water:'M3 9.5c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0',
    fire:'M12 3c.5 3.2-1.2 5.2-2.7 7.3C7.6 12.6 6.5 14.2 6.5 16.5 6.5 19.3 8.8 21 12 21s5.5-1.7 5.5-4.5c0-2.6-1.7-4.5-3.2-6.6C13.1 8.2 12.3 6.6 12 3zM11 14.8c.8-1.7 1.9-2.6 2.3-3.8',
    wood:'M12 21v-6M8 21h8M12 3l5.4 8h-3.1l2.6 5.2H7.1L9.7 11H6.6z',
    wind:'M4 8.5h11.5a2.6 2.6 0 1 0-2.6-2.6M4 12h14a2.6 2.6 0 1 1-2.6 2.6M4 15.5h8',
    earth:'M3 17.5h18M5.2 17.5C7 12.2 9.8 9.5 12 9.5s5 2.7 6.8 8'
  };

  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[ʻʼ’']/g,'').toLowerCase();
  function words(item){
    const pick=findPick(item)||{};
    return fold([item.title,item.name,item.category,pick.category,pick.name,item.kind,item.effort,pick.effort,(item.tags||[]).join(' '),(pick.tags||[]).join(' '),item.style,item.cuisine].join(' '));
  }
  function allPicks(){
    const cat=(root.GONOW_PICKS||root.window&&root.window.GONOW_PICKS)||{};
    const out=[];
    Object.keys(cat).forEach(city=>{
      const block=cat[city]||{};
      ['activities','restaurants'].forEach(key=>(block[key]||[]).forEach(p=>out.push(p)));
    });
    return out;
  }
  function findPick(item){
    if(!item)return null;
    const id=fold(item.sourceId||item.pickId||item.id||'');
    const title=fold(item.title||item.name||'');
    const list=allPicks();
    let hit=list.find(p=>fold(p.id)===id);
    if(hit)return hit;
    const nameHit=(title,name)=>{
      const n=fold(name);if(!title||!n)return false;
      if(title.includes(n)||(n.includes(title)&&title.length>=8))return true;
      const parts=n.split(/\s+/).filter(w=>w.length>2&&!['the','and','at'].includes(w));
      return parts.length>=2&&parts.every(w=>title.includes(w));
    };
    return list.find(p=>nameHit(title,p.name))||null;
  }

  function skipped(item){
    if(!item)return true;
    const kind=item.kind||'';
    if(SKIP.has(kind))return true;
    if(item.flight||item.flightDirection)return true;
    return false;
  }

  function of(item){
    if(!item||skipped(item))return [];
    if(Array.isArray(item.elements)&&item.elements.length){
      return ORDER.filter(id=>item.elements.includes(id)).slice(0,2);
    }
    const pick=findPick(item)||{};
    const kind=item.kind||'';
    const category=fold(item.category||pick.category||'');
    const effort=fold(item.effort||pick.effort||'');
    const tags=fold((item.tags||pick.tags||[]).join(' '));
    const text=words(item);
    const style=fold(item.style||'');
    const score={water:0,fire:0,wood:0,wind:0,earth:0};
    const add=(id,n)=>{if(score[id]!=null)score[id]+=n;};
    const has=re=>re.test(text);

    if(kind==='meal'||category==='restaurant'||style==='food'||has(/\b(breakfast|lunch|dinner|brunch|supper|restaurant|cafe|bistro|eatery|meal|cuisine)\b/))add('earth',4);
    if(kind==='stay'||has(/\b(check[ -]?in|sleep|slept|bedtime|good night|nap)\b/))add('earth',3);
    if(has(/\b(plantation|farm|orchard|whole foods?|farmers? market)\b/)){add('earth',4);add('wood',3);}

    if(category==='water'||has(/\b(swim|swimming|snorkel|snorkeling|scuba|dive|diving|surf|surfing|beach|ocean|sea|bay|lagoon|reef|lake|waterfall|river|pool|kayak|paddle|paddleboard|\bsup\b|canoe|parasail|cove|shoreline|tide pool)\b/))add('water',4);
    if(has(/\b(hydrat|drinking water|sweat)\b/)||tags.includes('water'))add('water',3);
    if(has(/\b(boat|sail|cruise)\b/)&&!has(/\b(bus|shuttle)\b/))add('water',2);

    if(effort==='active'||has(/\b(run|running|sprint|interval|tempo|workout|gym|climb|climbing|crater|stairs|vigorous|intense)\b/))add('fire',3);
    if(effort==='moderate'&&(category==='outdoors'||has(/\b(hike|hiking|trail|dive|scuba|surf|bike|cycl)\b/)))add('fire',3);
    if(has(/\b(surf lesson|strength|weights|hiit)\b/))add('fire',3);

    if(category==='outdoors'||style==='nature'||style==='wandering'||style==='scenic'||has(/\b(hike|hiking|trail|walk|walking|stroll|wander|wandering|on foot|nature|outdoors|forest|garden|park|ranch|mountain|ridge|falls|strength|pilates|ground|rooted)\b/))add('wood',3);
    if(tags.includes('outdoors'))add('wood',2);

    if(has(/\b(yoga|stretch|stretching|pilates|meditation|meditat|breathwork|breath|pranayama|spa|massage|sauna|restor|wellness)\b/))add('wind',4);
    if(kind==='rest'||has(/\b(sunset|sunrise|downtime|lounge|free time|stillness)\b/)||category==='chill')add('wind',3);
    if(category==='culture'||style==='culture'||has(/\b(museum|palace|gallery|temple|shrine|cultural)\b/))add('wind',3);
    if(has(/\b(photos?|photo walk)\b/)&&has(/\b(sunset|sunrise|beach|shore|garden)\b/))add('wind',2);
    if(has(/\bparasail\b/))add('wind',3);
    if(has(/\bsunset\b/)&&has(/\b(kahala|waikiki|lanikai|waimea|hanauma|kailua|magic island|beach|bay|shore|ocean)\b/)&&!has(/\b(hike|hiking|trail|pillbox|ridge)\b/))add('water',3);

    // Shopping stays untagged so it never pretends to be movement or rest.
    if(category==='shopping'||has(/\b(shopping|mall|market place|marketplace)\b/)){
      if(!has(/\b(food|farmers?|breakfast|lunch|dinner)\b/)){
        score.fire=0;score.wood=0;score.wind=Math.min(score.wind,0);score.water=0;
      }
    }

    const ranked=ORDER.map(id=>({id,n:score[id]})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n||ORDER.indexOf(a.id)-ORDER.indexOf(b.id));
    if(!ranked.length)return [];
    const picked=[ranked[0].id];
    if(ranked[1]&&ranked[1].n>=2)picked.push(ranked[1].id);
    return ORDER.filter(id=>picked.includes(id));
  }

  function day(items){
    const found=new Set();
    (Array.isArray(items)?items:[]).forEach(it=>of(it).forEach(id=>found.add(id)));
    const ids=ORDER.filter(id=>found.has(id));
    return {ids,count:ids.length,celebrated:ids.length>=4};
  }

  function icon(id,size,cls){
    const n=size||16;
    const icons=root.GoNowIcons;
    if(icons&&icons.paths&&icons.paths[id])return icons.icon(id,n,cls||('el-icon el-'+id));
    return '<svg class="v2-icon el-icon el-'+esc(id)+(cls?' '+cls:'')+'" viewBox="0 0 24 24" width="'+n+'" height="'+n+'" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(PATHS[id]||'')+'"/></svg>';
  }

  function label(id){
    const e=BY[id];return e?e.name+' · '+e.nameZh:'';
  }

  function iconsHTML(item,opts){
    const ids=of(item);if(!ids.length)return '';
    const size=(opts&&opts.size)||14;
    const names=ids.map(label).join(', ');
    return '<span class="el-icons" data-testid="item-elements" data-elements="'+esc(ids.join(' '))+'" aria-label="'+esc(names)+'">'+ids.map(id=>'<button type="button" class="el-swap" data-testid="element-swap" data-element="'+id+'" aria-label="See other '+esc(BY[id].name)+' places">'+icon(id,size)+'</button>').join('')+'</span>';
  }

  function detailHTML(item){
    const ids=of(item);if(!ids.length)return '';
    return '<p class="el-detail" data-testid="item-elements-detail">'+esc(ids.map(label).join(' · '))+'</p>';
  }

  function celebrateLine(count){
    if(count>=5)return 'All five elements, in one day.';
    if(count>=4)return 'Four elements, quietly gathered.';
    return '';
  }

  function tripLine(count){
    if(count>=5)return 'A day that gathered every element.';
    if(count>=4)return 'A day that gathered its elements.';
    return '';
  }

  const MEANINGS={
    water:'Swim, sea, spa',
    fire:'Movement intensity',
    wood:'Hikes, walks, pilates',
    wind:'Yoga, meditation, sunsets',
    earth:'Good food and sleep'
  };
  function introInner(){
    return '<p class="el-intro-line">Travel that balances you: <span class="el-intro-marks">水 · 火 · 木 · 风 · 土</span></p>'
      +'<ul class="el-intro-list">'+ORDER.map(id=>{
        const e=BY[id];
        return '<li class="el-intro-item"><span class="el-dot is-on el-'+id+'" aria-hidden="true">'+icon(id,20)+'</span><span><strong>'+esc(e.name)+' · '+esc(e.nameZh)+'</strong><small>'+esc(MEANINGS[id])+'</small></span></li>';
      }).join('')+'</ul>'
      +'<div class="el-intro-sample" data-testid="elements-sample"><ul class="el-dots" aria-hidden="true">'+ORDER.map(id=>'<li class="el-dot is-on el-'+id+'">'+icon(id,18)+'</li>').join('')+'</ul><p>All five elements, in one day.</p></div>'
      +'<details class="el-intro-how"><summary>How it works</summary><p>Each stop quietly picks up to two elements. When a day gathers all five, the dots light up. Nothing is required.</p></details>';
  }
  function introHTML(){
    return '<section class="el-intro" data-testid="elements-intro" aria-label="Five elements">'+introInner()+'</section>';
  }
  function rowHTML(items){
    const gathered=day(items);
    const names=gathered.ids.map(e=>BY[e].name);
    const aria=gathered.count?('Today gathered '+names.join(', ').replace(/, ([^,]*)$/,' and $1')+'.'):'Elements of the day';
    const line=celebrateLine(gathered.count);
    return '<div class="el-row'+(gathered.celebrated?' is-celebrated':'')+'" data-testid="day-elements" data-count="'+gathered.count+'" aria-label="'+esc(aria)+'">'+
      '<ul class="el-dots" aria-hidden="true">'+ORDER.map(id=>{
        const on=gathered.ids.includes(id);
        return '<li class="el-dot el-'+id+(on?' is-on':'')+'" title="'+(on?esc(label(id)):'')+'">'+icon(id,18)+'</li>';
      }).join('')+'</ul>'+
      (line?'<p class="el-celebrate" data-testid="elements-celebrate">'+esc(line)+'</p>':'')+
    '</div>';
  }

  const api={LIST,ORDER,COLORS,PATHS,of,day,skipped,icon,label,iconsHTML,detailHTML,rowHTML,celebrateLine,tripLine,findPick,introHTML,introInner,MEANINGS};
  root.GoNowElements=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
