"""Supervisor Chromium ring trim checks; unique port 8875."""
import asyncio
from playwright.async_api import expect
from test_full import new, show_day, continue_prep
from test_wellness_home import serve_checks

async def audit(rings):
    assert await rings.locator('.ring-encouragement').count() <= 1
    text = await rings.inner_text()
    for removed in ('From getting back', 'Goals come from', 'Not counted:', 'No recovery block'):
        assert removed not in await rings.text_content()
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    assert len(lines) == len(set(lines)), lines
    toggle = rings.get_by_test_id('ring-breakdown-toggle')
    await expect(toggle).to_have_text('How we count')
    await toggle.click()
    await expect(rings.get_by_test_id('ring-breakdown')).to_be_visible()
    await expect(rings.get_by_test_id('ring-breakdown')).to_contain_text('Sleep estimate')
    assert await rings.locator('h4').evaluate_all('(heads)=>heads.every(h=>h.nextElementSibling?.children.length>0)')

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8875/index.html', width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await continue_prep(pg)
            await show_day(pg, 1)
            rings = pg.locator('.day-head > .wellness-rings')
            await audit(rings)
            await expect(rings.get_by_test_id('ring-breakdown').locator('li').first).to_contain_text('90 min')
            # Arrival day has no counted rest and opens the existing add form.
            await show_day(pg, 0)
            rings = pg.locator('.day-head > .wellness-rings')
            await audit(rings)
            await rings.get_by_test_id('ring-rest-break').click()
            await expect(pg.get_by_test_id('db-booking-form')).to_be_visible()
            await expect(pg.get_by_test_id('db-booking-name')).to_have_value('Pool or stretch break')
            await expect(pg.get_by_test_id('db-booking-name')).to_be_focused()
            await show_day(pg, 4)
            rings = pg.locator('.day-head > .wellness-rings')
            await audit(rings)
            await expect(rings.locator('.ring-move,.ring-rec,.ring-value-move,.ring-value-rec')).to_have_count(0)
            # Item E follow-up: the departure uses the night before its airport ride.
            await expect(rings.locator('.ring-encouragement')).to_have_text('Short night · 5h55 before your flight')
            await expect(rings.get_by_test_id('ring-rest-break')).to_have_count(0)
            assert 'goal' not in await rings.inner_text()
            await expect(rings.locator('.compact-values')).to_contain_text('departs')
            await expect(pg.get_by_test_id('day-pace-link')).to_have_count(0)
            assert await pg.evaluate('document.documentElement.scrollWidth <= innerWidth')
            print('PASS ring trim', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8875, checks))
