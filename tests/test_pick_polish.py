"""Supervisor Chromium checks for polish 1; no browser is run in the coding sandbox."""
import asyncio
import re
from playwright.async_api import expect
from test_full import new
from test_pick_activities import open_picks
from test_wellness_home import serve_checks

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8866/index.html', width, 844)
        try:
            await open_picks(pg)
            for screen, place in [('activities','lanikai'), ('food','leonards')]:
                if screen=='food': await pg.get_by_test_id('pick-next').click()
                card=pg.locator(f'[data-pick-id={place}]')
                toggle=card.locator('.pick-toggle')
                if await toggle.get_attribute('aria-pressed')=='true': await toggle.click()
                plain=await card.evaluate('e=>getComputedStyle(e).backgroundColor')
                await toggle.hover()
                assert plain==await toggle.evaluate('e=>getComputedStyle(e).backgroundColor')
                assert plain==await card.evaluate('e=>getComputedStyle(e).backgroundColor')
                await toggle.click(); await toggle.click()
                assert plain==await card.evaluate('e=>getComputedStyle(e).backgroundColor')
                await card.locator('.pick-info').click()
                sheet=pg.get_by_test_id('pick-details')
                button=sheet.locator('#pick-detail-toggle')
                await expect(button).to_have_text('Add')
                await button.scroll_into_view_if_needed()
                assert await pg.locator('.pick-footer').evaluate('e=>getComputedStyle(e).visibility==="hidden"')
                assert await button.evaluate('e=>{const b=e.getBoundingClientRect();return b.width>=document.querySelector("#sheet").clientWidth-65&&b.bottom<=innerHeight}')
                await button.click()
                await card.locator('.pick-info').click()
                await expect(sheet.locator('#pick-detail-toggle')).to_have_text('Remove')
                await expect(sheet.locator('#pick-detail-toggle')).to_have_class(re.compile('outline'))
                await sheet.locator('#pick-close').click()
            await pg.locator('[data-pick-info=senia]').click()
            await expect(pg.locator('#pick-detail-toggle')).to_have_count(0)
            await expect(pg.get_by_test_id('pick-details')).to_contain_text('Booked')  # v2: line lock icon replaces 🔒
            await pg.locator('#pick-close').click()
            await pg.evaluate("""()=>{const a=window.__gonow.state.answers;a.level='gentle';a.picks.activities=['diamond-head','hanauma'];a.picks.restaurants.push('leonards');}""")
            await pg.get_by_test_id('pick-next').click()
            plan=await pg.evaluate('window.__gonow.state.plan')
            assert plan['days'][-1]['items'] and all(not i.get('pick') for i in plan['days'][-1]['items'])
            await pg.get_by_test_id('db-day-2026-11-26').click()
            await expect(pg.locator('[data-testid=day-pace-link]:visible')).to_have_count(1)
            await expect(pg.locator('[data-testid=day-pace-link]:visible')).to_contain_text('Pace: Gentle')
            assert 'Not set' not in await pg.locator('body').inner_text()
            assert 'Recover 0 min' not in await pg.locator('body').inner_text()
            assert await pg.locator('.day-title p').count()>0
            for chip in await pg.get_by_test_id('db-travel').all():
                text=(await chip.inner_text()).strip()
                assert re.fullmatch(r'^(Drive|Uber|Walk) ~\d+ min( · leave by .+)?$',text),text
                assert await chip.evaluate('e=>e.scrollWidth<=e.clientWidth && e.getBoundingClientRect().height<40')
            print('PASS polish sheets, selection, departure, pace, headers and compact travel',width)
        finally:
            await ctx.close()

if __name__=='__main__': asyncio.run(serve_checks(8866,checks))
