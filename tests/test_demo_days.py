"""Supervisor-only demo audit; port 8853. Editing agent must not run."""
import asyncio
from playwright.async_api import expect
from test_full import new, wait_plan, show_day
from test_wellness_home import serve_checks

BASE = 'http://127.0.0.1:8853/index.html'

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        errors = []
        pg.on('pageerror', lambda error: errors.append(str(error)))
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await wait_plan(pg)
            for track in ('together', 'each'):
                await pg.evaluate("track=>{__gonow.state.answers.track=track;__gonow.go('plan');}", track)
                await show_day(pg, 1)
                day = pg.get_by_test_id('plan-day')
                diamond = day.locator('[data-db-zone="day"][data-db-source="2026-11-26-1"]')
                await expect(diamond.get_by_test_id('db-time')).to_have_text('6:00 AM–7:30 AM')
                await expect(diamond).to_contain_text('Diamond Head — 6:00 AM entry slot')
                await expect(diamond.locator('img.db-thumb')).to_have_attribute('src', 'images/activity-waikiki-sunset.jpg')
                await diamond.get_by_test_id('db-expand').click()
                images = await diamond.locator('img').evaluate_all('els=>els.map(e=>e.getAttribute("src"))')
                assert images and all('waikiki-sunset' in src and 'kualoa' not in src for src in images), images
                await expect(day.locator('[data-testid="db-note"], .db-conflict')).to_have_count(0)
                assert not errors, errors
                assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
                print('PASS demo Day 2 6 AM, Diamond Head photos, zero warnings', width, track)
        except Exception:
            print('FAIL demo Day 2', width)
            raise
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8853, checks))
