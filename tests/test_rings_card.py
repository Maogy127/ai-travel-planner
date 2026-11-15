"""Supervisor Chromium ring-card checks, port 8846; budget-fix."""
import asyncio
from playwright.async_api import expect
from test_full import new, show_day
from test_wellness_home import serve_checks

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8846/index.html', width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            from test_full import continue_prep
            await continue_prep(pg)
            await show_day(pg, 1)
            await pg.get_by_test_id('ring-breakdown-toggle').first.click()
            breakdown = pg.get_by_test_id('ring-breakdown').first
            await expect(breakdown).to_contain_text('8:50 PM')
            print('PASS test_rings_card.py check line 17')
            await expect(breakdown).to_contain_text('5:35 AM')
            print('PASS test_rings_card.py check line 19')
            await expect(breakdown).to_contain_text('pace')
            print('PASS test_rings_card.py check line 21')
            # Clean Day 2 is 7h30: below neither strict nudge boundary.
            await expect(pg.get_by_test_id('sleep-nudge')).to_have_count(0)
            print('PASS test_rings_card.py check line 24')
            # Reproduce a saved late Nov 25 evening: sleep becomes 5h45.
            await pg.evaluate("""() => {
                const key='gonow:daybuilder:oahu-demo-2026-11';
                const saved=JSON.parse(localStorage.getItem(key)||'{}');
                saved.days ||= {};
                const day=window.DayBuilder.buildSuggested('2026-11-25');
                Object.assign(day.items.at(-1),{preferred:1295,duration:60,manualTime:true});
                saved.days[day.date]=day;
                localStorage.setItem(key,JSON.stringify(saved));
            }""")
            await pg.reload()
            await show_day(pg, 1)
            nudge = pg.get_by_test_id('sleep-nudge')
            await expect(nudge).to_contain_text('5h45')
            print('PASS test_rings_card.py check line 39')
            await expect(nudge.locator('span')).to_have_text('Short night · 5h45 sleep')
            assert await nudge.evaluate('(e)=>e.previousElementSibling.matches(".wellness-rings") && e.nextElementSibling.matches(".pace-control")')
            print('PASS test_rings_card.py check line 41')
            before = await pg.evaluate('JSON.stringify(window.DayBuilder.schedule())')
            await pg.get_by_test_id('sleep-nudge-accept').click()
            await expect(pg.get_by_test_id('sleep-proposal')).to_be_visible()
            print('PASS test_rings_card.py check line 45')
            await expect(pg.get_by_test_id('sleep-proposal')).to_contain_text('reserved times')
            print('PASS test_rings_card.py check line 47')
            assert before == await pg.evaluate('JSON.stringify(window.DayBuilder.schedule())')
            print('PASS test_rings_card.py check line 49')
            await expect(pg.get_by_test_id('sleep-proposal-apply')).to_have_count(0)
            print('PASS test_rings_card.py check line 51')
            await pg.get_by_test_id('sleep-proposal-cancel').click()
            await pg.get_by_test_id('sleep-nudge-keep').click()
            await pg.reload()
            await show_day(pg, 1)
            await expect(pg.get_by_test_id('sleep-nudge')).to_have_count(0)
            print('PASS test_rings_card.py check line 57')
            await pg.get_by_test_id('ring-breakdown-toggle').first.click()
            await expect(pg.get_by_test_id('ring-breakdown').first).to_contain_text('10:35 PM')
            print('PASS test_rings_card.py check line 60')
            await expect(pg.get_by_test_id('ring-breakdown').first).to_contain_text('5:35 AM')
            print('PASS test_rings_card.py check line 62')
            assert await pg.evaluate('document.documentElement.scrollWidth <= innerWidth')
            print('PASS test_rings_card.py check line 64')
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8846, checks))
