"""Transport icons and complete flight-time picker values; Chromium port 8850."""
import asyncio
from playwright.async_api import expect
from test_full import new, continue_prep, reopen_dashboard, choose_flight_time
from test_wellness_home import serve_checks

BASE='http://127.0.0.1:8850/index.html'

async def no_placeholders(pg):
    day=pg.get_by_test_id('db-day-list')
    assert '--' not in await day.inner_text()
    assert all('--' not in v for v in await day.locator('input').evaluate_all('els=>els.map(e=>e.value)'))
    assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')

async def checks(browser):
    for width in (1280,390):
        ctx,pg=await new(browser,BASE,width,900)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await continue_prep(pg)
            for date in ('2026-11-25','2026-11-26','2026-11-27','2026-11-28','2026-11-29'):
                await pg.get_by_test_id('db-day-'+date).click()
                day=pg.get_by_test_id('db-day-list')
                for card in await day.locator('.db-transport').all():
                    await expect(card.locator('img')).to_have_count(0)
                    await expect(card.locator('svg[data-transport-icon]')).to_have_count(1)
                    await expect(card.locator('svg[data-transport-icon]')).to_have_attribute('aria-hidden','true')
                if date=='2026-11-26':
                    await expect(day.locator('[data-db-id="2026-11-26-1"] img.db-thumb')).to_have_count(1)
                    assert await day.locator('img.db-thumb').count() >= 2
                await no_placeholders(pg)
            saved={}
            for date in ('2026-11-25','2026-11-29'):
                await pg.get_by_test_id('db-day-'+date).click()
                # One Edit flight action now opens the shared two-row sheet.
                button=pg.get_by_test_id('add-flight-time')
                await expect(button).to_have_text('Edit flight')
                value='18:00' if date.endswith('25') else '09:00'
                await choose_flight_time(pg,value)
                await expect(pg.get_by_test_id('edit-flight')).to_have_count(1)
                saved[date]=await pg.get_by_test_id('db-flight-time').input_value()
                assert saved[date]==value
                # Final audit: Arrival/Return supplies direction; title keeps the complete time.
                await expect(day).to_contain_text('6:00 PM' if date.endswith('25') else '9:00 AM')
                await no_placeholders(pg)
            await pg.reload()
            await reopen_dashboard(pg)
            await continue_prep(pg)
            for date,label in saved.items():
                await pg.get_by_test_id('db-day-'+date).click()
                await expect(pg.get_by_test_id('add-flight-time')).to_have_text('Edit flight')
                await expect(pg.get_by_test_id('db-flight-time')).to_have_value(label)
                direction='arrival' if date.endswith('25') else 'return'
                assert await pg.evaluate('(key)=>__gonow.state.answers[key]',direction+'Time')==label
                await expect(pg.get_by_test_id('db-day-list')).to_contain_text('6:00 PM' if direction=='arrival' else '9:00 AM')
                await no_placeholders(pg)
            print('PASS transport cards',width)
        finally:
            await ctx.close()

if __name__=='__main__':
    asyncio.run(serve_checks(8850,checks))
