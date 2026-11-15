"""Supervisor Chromium checks for the quiet day view; port 8847."""
import asyncio
from playwright.async_api import expect
from test_full import new, continue_prep, show_day, open_day_pace, open_add_menu, open_group, open_info
from test_wellness_home import serve_checks

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8847/index.html', width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await continue_prep(pg)
            await show_day(pg, 1)
            day = pg.get_by_test_id('plan-day')
            await expect(day.locator('.day-title')).to_contain_text('Nov 26')
            print('PASS test_dayview_simple.py check line 15')
            await expect(day.locator('.day-title h2')).to_contain_text('Day 2')
            print('PASS test_dayview_simple.py check line 17')
            rings = day.locator('.day-head > [data-testid=wellness-rings]')
            await expect(rings).to_have_count(1)
            print('PASS test_dayview_simple.py check line 20')
            await expect(rings).to_contain_text('Sleep')
            print('PASS test_dayview_simple.py check line 22')
            await expect(rings).to_contain_text('Move 90 min · Recover 30 min')
            print('PASS test_dayview_simple.py check line 24')
            await expect(rings.get_by_test_id('ring-breakdown')).to_be_hidden()
            print('PASS test_dayview_simple.py check line 26')
            await rings.get_by_test_id('ring-breakdown-toggle').focus()
            await pg.keyboard.press('Enter')
            await expect(rings.get_by_test_id('ring-breakdown')).to_be_visible()
            print('PASS test_dayview_simple.py check line 30')
            for selector in ('[data-testid=day-pace]', '[data-testid=traveler-row]', '[data-testid=db-booking-form]', '[data-testid=db-tray]', '.day-badges'):
                for item in await day.locator(selector).all():
                    await expect(item).to_be_hidden()
                    print('PASS test_dayview_simple.py check line 34')
            assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
            print('PASS test_dayview_simple.py check line 36')
            await expect(day.locator('.db-thumb').first).to_be_visible()
            print('PASS test_dayview_simple.py check line 38')
            await expect(day.get_by_test_id('db-travel').first).to_be_visible()
            print('PASS test_dayview_simple.py check line 40')
            for card in await day.locator('[data-testid=db-day-list] [data-testid=db-pair]').all():
                await expect(card.get_by_test_id('db-time')).to_be_visible()
                print('PASS test_dayview_simple.py check line 43')
                await expect(card.get_by_test_id('db-activity')).to_be_visible()
                print('PASS test_dayview_simple.py check line 45')
            for testid, prefix in (('db-more', 'More actions for '), ('db-lock', ('Lock ', 'Unlock '))):
                for button in await day.get_by_test_id(testid).all():
                    assert (await button.get_attribute('aria-label')).startswith(prefix)
                    print('PASS test_dayview_simple.py check line 49')
                    assert 'More' not in await button.inner_text()
                    print('PASS test_dayview_simple.py check line 51')
                    box = await button.bounding_box()
                    assert box['width'] >= 44 and box['height'] >= 44
                    print('PASS test_dayview_simple.py check line 54')
            await expect(day.get_by_test_id('sleep-nudge')).to_have_count(0)
            print('PASS test_dayview_simple.py check line 56')
            await open_day_pace(pg)
            await expect(day.get_by_test_id('day-pace')).to_be_visible()
            print('PASS test_dayview_simple.py check line 59')
            await open_info(pg)
            await expect(day.locator('.day-badges, .day-guidance, [data-testid=jetlag-note]')).to_have_count(0)
            info = day.get_by_test_id('day-info')
            await expect(info.locator('summary')).to_have_text('Getting around')
            await expect(info.locator('p')).to_be_visible()
            day_head_text = await day.locator('.day-head').inner_text()
            assert not any(text in day_head_text
                           for text in ('Sleep timing', 'Suggestions', 'Staying at', 'Typical conditions'))
            await expect(day.locator('.day-title > h2')).to_have_count(1)
            await expect(day.locator('.day-title > p')).to_have_count(1)
            assert await day.locator('.day-head').evaluate('(e)=>e.children[0].matches(".day-title") && e.children[1].matches(".wellness-rings") && e.children[2].matches(".pace-control") && e.children[3].matches("[data-testid=day-info]") && e.children.length===4')
            print('PASS test_dayview_simple.py check line 62')
            await open_group(pg)
            await expect(day.get_by_test_id('traveler-row').first).to_be_visible()
            print('PASS test_dayview_simple.py check line 65')
            await open_add_menu(pg)
            await day.get_by_test_id('db-booking-toggle').click()
            await expect(day.get_by_test_id('db-booking-form')).to_be_visible()
            print('PASS test_dayview_simple.py check line 69')
            await day.get_by_test_id('db-tray-toggle').click()
            await expect(day.get_by_test_id('db-tray')).to_be_visible()
            print('PASS test_dayview_simple.py check line 72')
            await expect(day.get_by_test_id('before-you-go')).to_have_count(0)
            print('PASS test_dayview_simple.py check line 75')
            assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
            print('PASS test_dayview_simple.py check line 77')
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8847, checks))
