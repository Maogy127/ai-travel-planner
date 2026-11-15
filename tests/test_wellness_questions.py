"""Supervisor-run optional sleep and diet questions, desktop and mobile."""
from test_full import reopen_dashboard
from test_full import wait_plan, open_day_pace, open_guidance, open_add_menu
import asyncio
from playwright.async_api import expect
from test_full import new, show_day
from test_wellness_home import serve_checks
BASE = 'http://127.0.0.1:8834/index.html'

async def personalize(pg):
    await pg.evaluate("window.__gonow.go('food')")
    await expect(pg.locator('.food-group').first).to_be_visible()

async def build(pg):
    await pg.get_by_test_id('q-continue').click()  # musts
    await pg.get_by_test_id('q-continue').click()  # build
    await wait_plan(pg)

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            from test_full import continue_prep
            await continue_prep(pg)
            await wait_plan(pg)
            await show_day(pg, 1)
            await open_guidance(pg)
            assert await pg.locator('#day-1').get_by_test_id('wind-down').count() == 0
            baseline = await pg.locator('#day-1 .day-head > .wellness-rings svg').get_attribute('aria-label')
            await personalize(pg)
            await expect(pg.get_by_test_id('diet-notes')).to_have_value('')
            for chip in await pg.get_by_test_id('food-chip').all():
                await expect(chip).to_have_attribute('aria-pressed', 'false')
            await pg.get_by_test_id('q-skip').click()
            await expect(pg.get_by_role('heading', name='Your usual sleep at home')).to_be_visible()
            await expect(pg.get_by_test_id('sleep-bedtime')).to_have_value('22:30')
            await expect(pg.get_by_test_id('sleep-wake')).to_have_value('06:30')
            await pg.get_by_test_id('sleep-bedtime').fill('')
            await pg.get_by_test_id('sleep-wake').fill('')
            await pg.get_by_test_id('q-skip').click()
            await pg.get_by_test_id('q-continue').click()
            await wait_plan(pg)
            await show_day(pg, 1)
            await open_guidance(pg)
            assert await pg.locator('#day-1').get_by_test_id('wind-down').count() == 0
            assert await pg.locator('#day-1 .day-head > .wellness-rings svg').get_attribute('aria-label') != baseline
            await personalize(pg)
            vegan = pg.locator('[data-testid=food-chip][data-value="Vegan"]')
            await vegan.click()
            await expect(vegan).to_have_attribute('aria-pressed', 'true')
            await vegan.click()
            await expect(vegan).to_have_attribute('aria-pressed', 'false')
            await vegan.click()
            await pg.get_by_test_id('diet-notes').fill('Please check ingredients')
            await pg.get_by_test_id('q-continue').click()
            await pg.get_by_test_id('sleep-bedtime').fill('22:30')
            await pg.get_by_test_id('sleep-wake').fill('06:30')
            await build(pg)
            await show_day(pg, 1)
            await open_guidance(pg)
            await expect(pg.locator('#day-1').get_by_test_id('wind-down')).to_have_count(0)
            planned = await pg.locator('#day-1 .day-head > .wellness-rings svg').get_attribute('aria-label')
            assert planned == baseline
            tags = pg.locator('.db-activity > [data-testid=diet-tag]')
            assert await tags.count() > 0
            assert all('Check the menu' in t for t in await tags.all_text_contents())  # unknown demo evidence stays neutral
            await pg.reload()
            await reopen_dashboard(pg)
            await wait_plan(pg)
            await wait_plan(pg)
            await show_day(pg, 1)
            await open_guidance(pg)
            await expect(pg.locator('#day-1').get_by_test_id('wind-down')).to_have_count(0)
            assert await pg.locator('#day-1 .day-head > .wellness-rings svg').get_attribute('aria-label') == planned
            await personalize(pg)
            await expect(pg.get_by_test_id('diet-notes')).to_have_value('Please check ingredients')
            await expect(pg.locator('[data-testid=food-chip][data-value="Vegan"]')).to_have_attribute('aria-pressed', 'true')
            await pg.get_by_test_id('q-continue').click()
            await expect(pg.get_by_test_id('sleep-bedtime')).to_have_value('22:30')
            await expect(pg.get_by_test_id('sleep-wake')).to_have_value('06:30')
            print('PASS optional wellness questions and persistence', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8834, checks))
