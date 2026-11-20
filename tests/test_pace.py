"""Supervisor-run browser regressions. No synthetic state changes."""
from test_full import reopen_dashboard, open_more
from test_full import wait_plan, open_day_pace, open_guidance, open_add_menu
import asyncio
from playwright.async_api import expect
from test_full import new, show_day
from test_wellness_home import serve_checks
BASE = 'http://127.0.0.1:8833/index.html'

async def reopen(pg):
    await pg.reload()
    await reopen_dashboard(pg)
    await wait_plan(pg)
    # Saved trips open in the editable draft.
    await wait_plan(pg)

async def expand_group(pg):
    if await pg.get_by_test_id('track-toggle').get_attribute('aria-pressed') != 'true':
        await open_more(pg); await pg.get_by_test_id('track-toggle').click()
    toggle = pg.get_by_test_id('group-toggle')
    if await toggle.get_attribute('aria-expanded') != 'true':
        await toggle.click()

async def goals(pg):
    return await pg.locator('.day-head > .wellness-rings svg').get_attribute('aria-label')

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            from test_full import continue_prep
            await continue_prep(pg)
            await wait_plan(pg)
            before = []
            for i in range(3):
                await show_day(pg, i)
                await expect(pg.locator('[data-testid=day-pace-option][data-value=trip]')).to_be_checked()
                before.append(await goals(pg))
            await show_day(pg, 1)
            await open_day_pace(pg)
            await pg.locator('[data-testid=day-pace-option][data-value=athlete]').click()
            text = await goals(pg)
            assert '8 h 30 m' in text and '90 min' in text and '40 min' in text
            for i in (0, 2):
                await show_day(pg, i)
                assert await goals(pg) == before[i]
            await reopen(pg)
            await show_day(pg, 1)
            await expect(pg.locator('[data-testid=day-pace-option][data-value=athlete]')).to_be_checked()
            await open_day_pace(pg)
            await pg.locator('[data-testid=day-pace-option][data-value=trip]').click()
            assert await goals(pg) == before[1]
            await expand_group(pg)
            rows = pg.get_by_test_id('traveler-row')
            await expect(rows).to_have_count(2)
            name = rows.nth(1).get_by_test_id('traveler-name')
            await name.fill('Sam')
            await name.press('Tab')
            await pg.get_by_test_id('traveler-pace').nth(1).select_option('gentle')
            rings = pg.get_by_test_id('traveler-rings').nth(1)
            text = await rings.inner_text()
            assert await rings.get_attribute('aria-label') == 'Sam'
            label = await rings.locator('svg').get_attribute('aria-label')
            assert 'goal 7 h 30 m' in label and 'goal 30 min' in label and 'goal 20 min' in label
            details = rings.get_by_test_id('ring-breakdown-toggle')
            # Item E renames the ring disclosure while preserving its behavior.
            await expect(details).to_have_text('How we count')
            await expect(rings.get_by_test_id('ring-breakdown')).to_be_hidden()
            await details.focus()
            await pg.keyboard.press('Enter')
            await expect(details).to_have_attribute('aria-expanded', 'true')
            await expect(rings.get_by_test_id('ring-breakdown')).to_be_visible()
            await details.click()
            await expect(details).to_have_attribute('aria-expanded', 'false')
            assert not any(w in text.lower() for w in ('winner', 'best', 'rank'))
            await reopen(pg)
            await expand_group(pg)
            await expect(pg.get_by_test_id('traveler-name').nth(1)).to_have_value('Sam')
            await expect(pg.get_by_test_id('traveler-pace').nth(1)).to_have_value('gentle')
            await pg.evaluate("window.__gonow.go('pace')")
            await expect(pg.get_by_test_id('pace-option')).to_have_count(0)
            await pg.get_by_test_id('pace-summary-edit').click()
            await expect(pg.get_by_test_id('pace-option')).to_have_count(4)
            await pg.locator('[data-testid=pace-option][data-value=gentle]').check()
            assert await pg.evaluate('window.__gonow.state.answers.level') == 'gentle'
            assert await pg.evaluate('window.__gonow.state.answers.pace') == 'Easy'
            await expect(pg.get_by_test_id('sleep-bedtime')).to_be_visible()
            print('PASS day, group and single onboarding pace', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8833, checks))
