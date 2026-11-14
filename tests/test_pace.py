"""Supervisor-run browser regressions. No synthetic state changes."""
import asyncio
from playwright.async_api import expect
from test_full import new, show_day
from test_wellness_home import serve_checks
BASE = 'http://127.0.0.1:8833/index.html'

async def reopen(pg):
    await pg.reload()
    await pg.get_by_test_id('continue-saved').click()
    # Saved trips open in the editable draft.
    await pg.get_by_test_id('day-pace').wait_for()

async def goals(pg):
    return await pg.locator('.day-head > .wellness-rings .ring-values').inner_text()

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await pg.get_by_test_id('day-pace').wait_for(timeout=45000)
            before = []
            for i in range(3):
                await show_day(pg, i)
                await expect(pg.locator('[data-testid=day-pace-option][data-value=trip]')).to_be_checked()
                before.append(await goals(pg))
            await show_day(pg, 1)
            await pg.locator('[data-testid=day-pace-option][data-value=athlete]').click()
            text = await goals(pg)
            assert '8 h 30 m' in text and '90 min' in text and '40 min' in text
            for i in (0, 2):
                await show_day(pg, i)
                assert await goals(pg) == before[i]
            await reopen(pg)
            await show_day(pg, 1)
            await expect(pg.locator('[data-testid=day-pace-option][data-value=athlete]')).to_be_checked()
            await pg.locator('[data-testid=day-pace-option][data-value=trip]').click()
            assert await goals(pg) == before[1]
            rows = pg.get_by_test_id('traveler-row')
            await expect(rows).to_have_count(2)
            name = rows.nth(1).get_by_test_id('traveler-name')
            await name.fill('Sam')
            await name.press('Tab')
            await pg.get_by_test_id('traveler-pace').nth(1).select_option('gentle')
            rings = pg.get_by_test_id('traveler-rings').nth(1)
            text = await rings.inner_text()
            assert 'Sam' in text and '7 h 30 m' in text and '30 min' in text and '20 min' in text
            assert not any(w in text.lower() for w in ('winner', 'best', 'rank'))
            await reopen(pg)
            await expect(pg.get_by_test_id('traveler-name').nth(1)).to_have_value('Sam')
            await expect(pg.get_by_test_id('traveler-pace').nth(1)).to_have_value('gentle')
            print('PASS day and group pace', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8833, checks))
