"""Whole-word option and inset legend audit; supervisor runs Chromium on 8837."""
from test_full import open_home_flow
from test_full import wait_plan, open_day_pace, open_guidance, open_add_menu
import asyncio
import sys
from test_full import new, show_day
from test_wellness_home import serve_checks

BASE = 'http://127.0.0.1:8837/index.html'
AUDIT = r'''() => {
 const failures=[];
 const visible=e=>e.checkVisibility({checkVisibilityCSS:true}) && e.getClientRects().length;
 const options=[...document.querySelectorAll('label:has(input[type=checkbox]),label:has(input[type=radio]),button[aria-pressed],[role=radio],[role=checkbox]')].filter(visible);
 for(const el of options){
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
   if(!visible(node.parentElement))continue;
   for(const match of node.textContent.matchAll(/\S+/g)){
    const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
    const rects=[...range.getClientRects()].filter(r=>r.width&&r.height);
    if(rects.some(r=>Math.abs(r.top-rects[0].top)>1))failures.push('split word '+match[0]);
   }
  }
 }
 if(document.documentElement.scrollWidth>innerWidth)failures.push('horizontal overflow');
 for(const legend of [...document.querySelectorAll('fieldset>legend')].filter(visible)){
  const field=legend.parentElement,style=getComputedStyle(field),lr=legend.getBoundingClientRect(),fr=field.getBoundingClientRect();
  const painted=style.backgroundImage!=='none'||!['transparent','rgba(0, 0, 0, 0)'].includes(style.backgroundColor)||['Top','Right','Bottom','Left'].some(s=>parseFloat(style['border'+s+'Width'])>0&&style['border'+s+'Style']!=='none');
  if(painted && (lr.top<fr.top+4||lr.bottom>fr.bottom||lr.left<fr.left||lr.right>fr.right+1))failures.push('legend outside panel: '+legend.textContent);
  if(field.matches('.covers')){
   const items=[...field.querySelectorAll('.checkrow')],rects=items.map(e=>e.getBoundingClientRect());
   if(lr.top<fr.top+8||lr.bottom>Math.min(...rects.map(r=>r.top)))failures.push('covers legend inset');
   if(items.some((e,i)=>rects[i].height<44||e.scrollWidth>e.clientWidth+1))failures.push('covers target or clipped text');
   const tops=rects.map(r=>Math.round(r.top));
   if(innerWidth===390 && (!tops.some((t,i)=>tops.indexOf(t)!==i)||Math.abs(rects[0].left-rects[1].left)<1))failures.push('covers missing two columns');
   if(innerWidth===1280 && new Set(tops).size===1)failures.push('covers forced single row');
  }
 }
 return failures;
}'''

async def checks(browser):
    failed = []
    async def screen(pg, name, width):
        await pg.evaluate('document.fonts.ready')
        problems = await pg.evaluate(AUDIT)
        print(('FAIL' if problems else 'PASS'), f'{name} {width}', '; '.join(problems))
        failed.extend(problems)
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        try:
            await screen(pg, 'home', width)
            await pg.locator('[data-testid=mode-option][data-value=local]').click()
            await screen(pg, 'local home', width)
            for city in ('Oahu', 'Austin'):
                await pg.get_by_test_id('local-city').fill(city)
                await pg.get_by_test_id('local-start').click()
                for _ in range(3):
                    await pg.get_by_test_id('q-skip').click()
                await screen(pg, 'local plan ' + city, width)
                await pg.get_by_test_id('local-change').click()
            await pg.locator('[data-testid=mode-option][data-value=trip]').click()
            # Include the optional flights question in the wrapping audit.
            for step in ('dates', 'flights', 'budget', 'who', 'ages', 'style', 'musts', 'food', 'pace'):
                await pg.evaluate('(step)=>window.__gonow.go(step)', step)
                if step == 'style':
                    assert await pg.locator('.option strong').count() == 6
                    assert await pg.locator('.option small').count() == 6
                await screen(pg, step, width)
                if step == 'food':
                    assert await pg.locator('.food-group').count() == 2
                if step == 'pace':
                    assert await pg.get_by_test_id('pace-option').count() == 0
                    await pg.get_by_test_id('pace-summary-edit').click()
                    await screen(pg, 'pace expanded', width)
            await pg.evaluate("window.__gonow.go('home')")
            await open_home_flow(pg)
            await pg.get_by_test_id('demo-oahu').click()
            from test_full import continue_prep
            await continue_prep(pg)
            await wait_plan(pg)
            for day in range(5):
                await show_day(pg, day)
                await screen(pg, f'plan day {day}', width)
                if day == 0:
                    if await pg.get_by_test_id('morning-checkin').count():
                        await pg.get_by_test_id('morning-checkin').locator('summary').click()
                    await screen(pg, 'morning check-in', width)
        finally:
            await ctx.close()
    assert not failed, f'{len(failed)} option layout failures'

if __name__ == '__main__':
    try:
        asyncio.run(serve_checks(8837, checks))
    except Exception as error:
        print('FAIL option wrap:', error)
        sys.exit(1)
