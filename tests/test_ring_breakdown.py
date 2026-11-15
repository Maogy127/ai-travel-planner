"""Supervisor-run ring breakdown checks; Chromium required."""
import asyncio
from playwright.async_api import expect
from test_full import new, show_day
from test_wellness_home import serve_checks
BASE = 'http://127.0.0.1:8835/index.html'

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await pg.get_by_test_id('day-pace').wait_for(timeout=45000)
            await show_day(pg, 1)
            rings = pg.locator('.day-head > .wellness-rings')
            await expect(rings.locator('.ring-value-move strong')).to_have_text('90 min')
            await expect(rings.locator('.ring-value-rec strong')).to_have_text('30 min')
            toggle = rings.get_by_test_id('ring-breakdown-toggle')
            panel = rings.get_by_test_id('ring-breakdown')
            for keyboard in (False, True):
                if keyboard:
                    await toggle.focus()
                    await pg.keyboard.press('Enter')
                else:
                    await toggle.click()
                await expect(toggle).to_have_attribute('aria-expanded', 'true')
                await expect(panel).to_be_visible()
                await expect(panel.locator('li').filter(has_text='Diamond Head')).to_contain_text('90 min × 1 = 90 min')
                await expect(panel.locator('li').filter(has_text='pool / beach downtime')).to_contain_text('capped at 30')
                await toggle.click()
                await expect(toggle).to_have_attribute('aria-expanded', 'false')
                await expect(panel).to_be_hidden()
            print('PASS Day 2 rings and breakdown', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8835, checks))
