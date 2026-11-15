"""Home local mode regression; supervisor runs Chromium on 8839."""
import asyncio
import re
import sys
from playwright.async_api import expect
from test_full import new
from test_wellness_home import serve_checks

BASE = 'http://127.0.0.1:8839/index.html'

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        try:
            trip = pg.locator('[data-testid=mode-option][data-value=trip]')
            local = pg.locator('[data-testid=mode-option][data-value=local]')
            await expect(trip).to_have_attribute('aria-checked', 'true')
            await trip.focus()
            await pg.keyboard.press('ArrowRight')
            await expect(local).to_be_focused()
            await expect(local).to_have_attribute('aria-checked', 'true')
            await pg.keyboard.press('ArrowLeft')
            await expect(trip).to_be_focused()
            await local.click()
            await pg.get_by_test_id('local-city').fill('Honolulu')
            await pg.locator('input[name=local-length][value=weekend]').check()
            await pg.reload()
            await expect(local).to_have_attribute('aria-checked', 'true')
            await expect(pg.get_by_test_id('local-city')).to_have_value('Honolulu')
            await expect(pg.locator('input[name=local-length][value=weekend]')).to_be_checked()
            for testid in ('pace-picker', 'activity-chip', 'local-city', 'local-length', 'local-voice-lang'):
                await expect(pg.get_by_test_id(testid).first).to_be_visible()
            assert await pg.get_by_test_id('local-voice-lang').locator('option').evaluate_all('(els)=>els.map(e=>e.value)') == ['en-US', 'zh-CN']
            for testid in ('start-from', 'start-to', 'home-destination', 'budget-covers', 'dates-next'):
                assert await pg.get_by_test_id(testid).count() == 0
            await pg.get_by_test_id('local-start').click()
            for _ in range(3):
                await pg.get_by_test_id('q-skip').click()
            await expect(pg.get_by_test_id('local-plan')).to_be_visible()
            assert await pg.get_by_test_id('local-source').count() > 0
            assert 'source:' not in (await pg.get_by_test_id('local-plan').inner_text()).lower()
            times = await pg.get_by_test_id('local-plan').locator('time').all_text_contents()
            assert times and all(re.fullmatch(r'(?:[1-9]|1[0-2]):[0-5]\d (?:AM|PM)', t) for t in times)
            assert await pg.get_by_test_id('local-plan').locator('h2').count() == 2
            assert not re.search(r'flight|hotel|Book this|\$', await pg.get_by_test_id('local-plan').inner_text(), re.I)
            print('PASS local keyboard, persistence, fields and Oahu source/no travel items', width)
            await pg.get_by_test_id('local-change').click()
            await expect(local).to_have_attribute('aria-checked', 'true')
            await pg.get_by_test_id('local-city').fill('Austin')
            await pg.locator('input[name=local-length][value=half]').check()
            await pg.get_by_test_id('local-start').click()
            for _ in range(3):
                await pg.get_by_test_id('q-skip').click()
            await expect(pg.get_by_test_id('local-coming-soon')).to_have_text("Local plans for Austin are coming soon. Here's a starter day")
            allowed = {'morning walk or run', 'healthy breakfast', 'park or trail time', 'midday rest and recovery', 'light dinner', 'wind-down'}
            assert set(await pg.get_by_test_id('local-block').locator('h3').all_text_contents()) <= allowed
            assert await pg.get_by_test_id('local-source').count() == 0
            assert not re.search(r'flight|hotel|Book this|\$', await pg.get_by_test_id('local-plan').inner_text(), re.I)
            await pg.get_by_test_id('local-change').click()
            await trip.click()
            await pg.get_by_test_id('home-destination').fill('Oahu')
            await pg.get_by_test_id('start-new-trip').click()
            await expect(pg.get_by_test_id('start-from')).to_be_visible()
            await expect(pg.get_by_test_id('edit-destination')).to_be_visible()
            assert await pg.get_by_test_id('start-to').count() == 0
            await pg.get_by_test_id('start-from').fill('Seattle')
            await pg.get_by_test_id('start-next').click()
            assert await pg.evaluate('__gonow.state.screen') == 'dates'
            print('PASS generic starter and original trip flow', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    try:
        asyncio.run(serve_checks(8839, checks))
    except Exception as error:
        print('FAIL local mode:', error)
        sys.exit(1)
