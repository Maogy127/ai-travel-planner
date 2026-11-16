"""Supervisor-only browser checks; run on port 8867, no sandbox Chromium."""
import asyncio
import re
from playwright.async_api import expect
from test_full import new, show_day, continue_prep
from test_pick_activities import open_picks
from test_wellness_home import serve_checks

async def info_rows(pg):
    for row in await pg.get_by_test_id('day-info').all():
        assert not await row.evaluate('e=>e.open')
        summary = row.locator('summary')
        assert re.search(r'Getting around · \S+', await summary.inner_text())
        await expect(summary.locator('.day-info-chevron')).to_have_text('▸')
        assert await summary.evaluate('''e=>{
            const style=getComputedStyle(e),chevron=e.querySelector('.day-info-chevron');
            const label=[...e.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
            if (!label || !label.textContent.startsWith('Getting around')) return false;
            const range=document.createRange();
            range.setStart(label,label.textContent.indexOf('Getting around'));
            range.setEnd(label,label.textContent.length);
            return Number(style.fontWeight)<600 && e.getBoundingClientRect().height>=44 &&
                chevron.getBoundingClientRect().right+5<=range.getBoundingClientRect().left;
        }''')
        assert await row.locator('p').count() > 0
        await summary.click()
        assert await row.evaluate('e=>e.open')
        await summary.click()

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8867/index.html', width, 844)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await continue_prep(pg)
            for index in range(5):
                await show_day(pg, index)
                car = await pg.evaluate('(i)=>__gonow.state.plan.days[i].car||{}', index)
                if not any(str(car.get(k, '')).strip() for k in ('level', 'note')):
                    await expect(pg.get_by_test_id('day-info')).to_have_count(0)
                await info_rows(pg)
            await expect(pg.get_by_test_id('sleep-nudge')).to_have_count(0)
            # A late saved evening makes a non-flight morning short, without changing locks.
            await pg.evaluate("""()=>{
                const key='gonow:daybuilder:oahu-demo-2026-11';
                const saved=JSON.parse(localStorage.getItem(key)||'{}');saved.days ||= {};
                const day=DayBuilder.buildSuggested('2026-11-25');
                Object.assign(day.items.at(-1),{preferred:1295,duration:60,manualTime:true});
                saved.days[day.date]=day;localStorage.setItem(key,JSON.stringify(saved));
            }""")
            await pg.reload()
            await show_day(pg, 1)
            nudge=pg.get_by_test_id('sleep-nudge')
            await expect(nudge).to_be_visible()
            assert await nudge.evaluate('''e=>{
                const span=e.querySelector('span'),buttons=[...e.querySelectorAll(':scope > button')];
                const r=span.getBoundingClientRect();
                return e.scrollWidth<=e.clientWidth && buttons.every(b=>{
                    const s=b.getBoundingClientRect();return s.top<=r.top && s.bottom>=r.bottom;
                });
            }''')
        finally:
            await ctx.close()
        ctx, pg = await new(browser, 'http://127.0.0.1:8867/index.html', width, 844)
        try:
            await open_picks(pg)
            await pg.evaluate("()=>{__gonow.state.answers.picks.activities=[];}")
            await pg.get_by_test_id('pick-next').click()
            await pg.evaluate("()=>{__gonow.state.answers.picks.restaurants=['leonards','helenas'];}")
            await pg.get_by_test_id('pick-next').click()
            await pg.get_by_test_id('db-day-2026-11-29').click()
            await expect(pg.get_by_test_id('sleep-nudge')).to_have_count(0)
            await pg.get_by_test_id('db-day-2026-11-26').click()
            items=await pg.evaluate("DayBuilder.schedule().days.find(d=>d.date==='2026-11-26').items")
            target=next(i for i in items if i['id']=='helenas')
            label=target['travel']['label']
            assert re.fullmatch(r'(Uber|Drive|Walk) ~\d+ min', label), label
            assert int(re.search(r'~(\d+)', label)[1]) >= 15
            await expect(pg.get_by_test_id('db-travel').filter(has_text=label).first).to_be_visible()
            await info_rows(pg)
            print('PASS polish 2 info, airport sleep guard, compact nudge and road travel', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8867, checks))
