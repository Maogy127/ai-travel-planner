"""Supervisor-run optional sleep and diet questions, desktop and mobile."""
import asyncio
from playwright.async_api import expect
from test_full import new
from test_wellness_home import serve_checks
BASE = 'http://127.0.0.1:8834/index.html'

async def personalize(pg):
    await pg.evaluate("window.__gonow.go('food')")
    await expect(pg.get_by_role('heading', name='Any food preferences?')).to_be_visible()

async def build(pg):
    await pg.get_by_test_id('q-continue').click()  # musts
    await pg.get_by_test_id('q-continue').click()  # build
    await pg.get_by_test_id('day-pace').wait_for(timeout=45000)

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await pg.get_by_test_id('day-pace').wait_for(timeout=45000)
            assert await pg.get_by_test_id('wind-down').count() == 0
            baseline = await pg.locator('.day-head > .wellness-rings .ring-values').inner_text()
            await personalize(pg)
            await expect(pg.get_by_test_id('diet-notes')).to_have_value('')
            for chip in await pg.get_by_test_id('diet-chip').all():
                await expect(chip).to_have_attribute('aria-pressed', 'false')
            await pg.get_by_test_id('q-skip').click()
            await expect(pg.get_by_role('heading', name='What time do you usually sleep?')).to_be_visible()
            await expect(pg.get_by_test_id('sleep-bedtime')).to_have_value('')
            await expect(pg.get_by_test_id('sleep-wake')).to_have_value('')
            await pg.get_by_test_id('q-skip').click()
            await pg.get_by_test_id('q-continue').click()
            await pg.get_by_test_id('day-pace').wait_for(timeout=45000)
            assert await pg.get_by_test_id('wind-down').count() == 0
            assert await pg.locator('.day-head > .wellness-rings .ring-values').inner_text() == baseline
            await personalize(pg)
            vegan = pg.locator('[data-testid=diet-chip][data-value="Vegan"]')
            none = pg.locator('[data-testid=diet-chip][data-value="No restrictions"]')
            await vegan.click()
            await none.click()
            await expect(vegan).to_have_attribute('aria-pressed', 'false')
            await expect(none).to_have_attribute('aria-pressed', 'true')
            await vegan.click()
            await expect(none).to_have_attribute('aria-pressed', 'false')
            await vegan.click()
            await expect(vegan).to_have_attribute('aria-pressed', 'false')
            await vegan.click()
            await pg.get_by_test_id('diet-notes').fill('Please check ingredients')
            await pg.get_by_test_id('q-continue').click()
            await pg.get_by_test_id('sleep-bedtime').fill('22:30')
            await pg.get_by_test_id('sleep-wake').fill('06:30')
            await build(pg)
            await expect(pg.get_by_test_id('wind-down')).to_contain_text('9:45 PM')
            planned = await pg.locator('.day-head > .wellness-rings .ring-values').inner_text()
            assert planned != baseline
            tags = pg.locator('.db-activity > [data-testid=diet-tag]')
            assert await tags.count() == 0  # demo data has no confirmed diet claims
            await pg.reload()
            await pg.get_by_test_id('continue-saved').click()
            await pg.get_by_test_id('day-pace').wait_for(timeout=45000)
            await expect(pg.get_by_test_id('wind-down')).to_contain_text('9:45 PM')
            assert await pg.locator('.day-head > .wellness-rings .ring-values').inner_text() == planned
            await personalize(pg)
            await expect(pg.get_by_test_id('diet-notes')).to_have_value('Please check ingredients')
            await expect(pg.locator('[data-testid=diet-chip][data-value="Vegan"]')).to_have_attribute('aria-pressed', 'true')
            await pg.get_by_test_id('q-continue').click()
            await expect(pg.get_by_test_id('sleep-bedtime')).to_have_value('22:30')
            await expect(pg.get_by_test_id('sleep-wake')).to_have_value('06:30')
            print('PASS optional wellness questions and persistence', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8834, checks))
