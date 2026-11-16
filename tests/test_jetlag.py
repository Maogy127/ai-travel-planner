"""Supervisor Chromium jet-lag and complete sleep controls, port 8842."""
from test_full import open_home_flow
from test_full import wait_plan, open_day_pace, open_guidance, open_add_menu
import asyncio
from playwright.async_api import expect
from test_full import new, show_day
from test_wellness_home import serve_checks

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8842/index.html', width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            from test_full import continue_prep
            await continue_prep(pg)
            await wait_plan(pg)
            before = await pg.evaluate('JSON.stringify(window.DayBuilder.schedule().days.flatMap(d=>d.items.filter(i=>i.locked).map(i=>[i.id,i.start,i.end,i.locked])))')
            await show_day(pg, 0)
            await open_guidance(pg)
            await expect(pg.get_by_test_id('jetlag-note')).to_have_count(0)
            assert await pg.locator('.day-guidance').count() == 0
            after = await pg.evaluate('JSON.stringify(window.DayBuilder.schedule().days.flatMap(d=>d.items.filter(i=>i.locked).map(i=>[i.id,i.start,i.end,i.locked])))')
            assert before == after
            print('PASS test_jetlag.py check line 26')
            await pg.evaluate("window.__gonow.go('pace')")
            await expect(pg.get_by_role('heading', name='Your usual sleep at home')).to_be_visible()
            print('PASS test_jetlag.py check line 29')
            for tid in ('sleep-bedtime', 'sleep-wake'):
                field = pg.get_by_test_id(tid)
                assert await field.evaluate('(e)=>/^([01]\\d|2[0-3]):[0-5]\\d$/.test(e.value) && e.checkValidity()')
                print('PASS test_jetlag.py check line 33')
                assert '--' not in await field.locator('..').inner_text()
                print('PASS test_jetlag.py check line 35')
            await pg.get_by_test_id('logo').click()
            await open_home_flow(pg)
            await pg.locator('[data-testid=mode-option][data-value=local]').click()
            await pg.get_by_test_id('local-city').fill('Honolulu')
            await pg.get_by_test_id('local-start').click()
            for _ in range(3):
                await pg.get_by_test_id('q-skip').click()
            await expect(pg.get_by_test_id('local-plan')).to_be_visible()
            print('PASS test_jetlag.py check line 44')
            for tid in ('jetlag-note', 'stay-unsure', 'trip-add-hotel'):
                await expect(pg.get_by_test_id(tid)).to_have_count(0)
                print('PASS test_jetlag.py check line 47')
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8842, checks))
