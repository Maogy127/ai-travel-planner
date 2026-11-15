/* Pure local planner. Oahu titles come only from the supplied catalog. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./diet'));else root.GoNowLocal=factory(root.GoNowDiet);}(typeof self!=='undefined'?self:this,function(diet){
    'use strict';
    function isOahu(city){return /\b(?:o['ʻ’]?ahu|honolulu|waikiki)\b/i.test(String(city));}
    function generate(answers,catalog){
        var a=answers||{}, city=String(a.localCity||'').trim(), known=isOahu(city), level=a.level||'unsure';
        var vigorous=level==='athlete', gentle=level==='gentle', half=a.localLength==='half';
        var count=half?(gentle?2:vigorous?4:3):(gentle?4:vigorous?7:6);
        var oahu=(catalog||[]).find(function(d){return d.id==='oahu';});
        var interests=(a.activities||[]).map(function(x){return /hiking|swimming|cycling|running|strength/.test(x)?'nature':/walking/.test(x)?'wandering':'scenic';});
        var keys=(gentle?['food','wandering','scenic']:['food'].concat((a.styles||[]).filter(function(k){return k!=='hotel';}),interests, ['nature','wandering','scenic','culture']));
        var pool=[],mealTitles=new Set();
        if(known){
            if(!oahu)throw new Error('Oahu catalog is required');
            keys.forEach(function(k){(k==='food'?diet.rank((oahu.activities[k]||[]).map(function(title){return {kind:'meal',title:title};}),a).map(function(m){mealTitles.add(m.title);return m.title;}):(oahu.activities[k]||[])).forEach(function(title){if(!/hotel|flight/i.test(title)&&!pool.includes(title))pool.push(title);});});
        }
        pool.sort(function(a,b){return (/breakfast/i.test(a)?-1:0)-(/breakfast/i.test(b)?-1:0);});
        var generic=['morning walk or run','healthy breakfast','park or trail time','midday rest and recovery','light dinner','wind-down'];
        var days=Array.from({length:a.localLength==='weekend'?2:1},function(_,day){
            return {day:day+1,blocks:Array.from({length:count},function(_,i){
                var hour=half?8+Math.floor(i*4/count):8+Math.floor(i*13/(count-1));
                var title=known?pool[i<2?i:2+(i-2+day*2)%Math.max(1,pool.length-2)]:generic[half?Math.min(i,2):Math.round(i*(generic.length-1)/(count-1))];
                if(known&&/food stalls|market.*food/i.test(title))hour=12;
                var meal=mealTitles.has(title)||/breakfast|dinner/.test(title),safe=diet.safeMeal({kind:meal?'meal':'activity',title:title},a);title=safe.title.replace(/near your stay/g,'nearby');
                return {kind:meal?'meal':'activity',time:String(hour).padStart(2,'0')+':00',title:title,note:meal?'Choose a place you enjoy; confirm opening hours and dietary needs.':known?(gentle?'Take it slowly, with time to pause.':'Move at your own pace; check access and conditions before heading out.'):(/breakfast|dinner/.test(title)?'Choose a café you like, close to home.':/park|walk|run/.test(title)?'Enjoy a park near you and adjust the distance to your energy.':'Leave room to rest, stretch and enjoy an unhurried day.'),source:known?'catalog':'generic',intensity:gentle?'gentle':vigorous?'vigorous':'moderate'};
            }).sort(function(a,b){return a.time.localeCompare(b.time);})};
        });
        return {mode:'local',city:city,comingSoon:!known,days:days};
    }
    return {generate:generate,isOahu:isOahu};
}));
