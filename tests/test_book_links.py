"""Item H: contextual booking links and prep persistence; supervisor port 8878."""
import asyncio
from playwright.async_api import expect
from test_full import new, reopen_dashboard, show_day
from test_wellness_home import serve_checks


async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8878/index.html', width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await pg.get_by_test_id('confirm-plan').click()
            good = pg.get_by_test_id('good-to-know')
            toggle = pg.get_by_test_id('good-to-know-toggle')
            await expect(toggle).to_have_attribute('aria-expanded', 'false')
            assert not await good.evaluate('e=>e.open')
            await toggle.click()
            await expect(toggle).to_have_attribute('aria-expanded', 'true')
            await expect(pg.get_by_test_id('local-info')).to_contain_text('Currency: USD')
            await expect(pg.get_by_test_id('affiliate-disclosure')).to_be_visible()
            await expect(pg.get_by_test_id('local-info').locator(':scope > h2, :scope > h3, :scope > h4, summary')).to_have_count(0)
            await expect(toggle).to_have_attribute('aria-controls', 'good-to-know-content')
            await expect(pg.get_by_test_id('affiliate-disclosure')).to_have_count(1)
            await expect(pg.get_by_test_id('affiliate-disclosure')).to_have_text('We may earn a fee')
            assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
            await pg.get_by_test_id('trip-essentials').click()
            tasks = pg.locator('#trip-essentials [data-prep-id]')
            texts = await pg.locator('#trip-essentials .checkrow span').all_text_contents()
            assert 'Book flights' in texts
            assert any('Kualoa' in t for t in texts)
            assert any(t.startswith('Reserve ') for t in texts)
            assert len(texts) == len(set(texts))
            task = tasks.first
            task_id = await task.get_attribute('data-prep-id')
            await task.check()
            await pg.get_by_test_id('prep-continue').click()
            await expect(pg.get_by_test_id('travel-info')).to_have_count(0)
            await expect(pg.get_by_test_id('booking-searches')).to_have_count(0)
            assert 'Travel info' not in await pg.locator('main').inner_text()
            assert 'Booking searches' not in await pg.locator('main').inner_text()
            await expect(pg.get_by_test_id('find-hotel')).to_have_count(0)
            # Booking actions stay in the item details, reached with a single tap.
            await show_day(pg, 1)
            # The first Kualoa title is a locked shuttle; target the ticketed tour.
            kualoa = pg.locator('[data-testid="db-pair"][data-db-id="2026-11-26-5"]')
            await kualoa.get_by_test_id('db-expand').click()
            await expect(kualoa.get_by_test_id('db-detail').get_by_test_id('item-book')).to_be_visible()
            assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
            lamer = pg.locator('[data-testid="db-pair"]').filter(has=pg.locator('[data-testid="db-expand"]', has_text='La Mer')).first
            await expect(lamer.get_by_test_id('db-locked-tag')).to_be_visible()
            await expect(lamer.locator('[data-testid="item-book"], [data-testid="item-reserve"]')).to_have_count(0)
            await show_day(pg, 2)
            # Food courts do not take restaurant reservations; Senia is already locked.
            for title in ('Lunch at Ala Moana Center', 'Senia'):
                stop = pg.get_by_test_id('db-pair').filter(has=pg.get_by_test_id('db-expand').filter(has_text=title)).first
                await expect(stop.locator('[data-testid=item-book], [data-testid=item-reserve]')).to_have_count(0)
            await show_day(pg, 0)
            restaurant = pg.locator('[data-testid="db-pair"]').filter(has=pg.locator('[data-testid="db-expand"]', has_text='Dinner at the Kahala')).first
            await restaurant.get_by_test_id('db-expand').click()
            await expect(restaurant.get_by_test_id('item-reserve')).to_be_visible()
            for day_index in (0, 4):
                await show_day(pg, day_index)
                flight = pg.locator('[data-testid="db-pair"]').filter(has=pg.get_by_test_id('edit-flight')).first
                await flight.get_by_test_id('db-expand').click()
                await expect(flight.get_by_test_id('book-flights')).to_be_visible()
            links = await pg.locator('a[data-partner]').evaluate_all('es=>es.map(e=>({target:e.target,rel:e.rel,href:e.href}))')
            assert links and all(x['target'] == '_blank' and set(x['rel'].split()) == {'noopener', 'sponsored'} and x['href'].startswith('https://') for x in links)
            await pg.reload()
            await reopen_dashboard(pg)
            await pg.get_by_test_id('trip-prep-button').click()
            await pg.get_by_test_id('trip-essentials').click()
            await expect(pg.locator(f'[data-prep-id="{task_id}"]')).to_be_checked()
            # The same persisted trip can acquire a hotel later; no extra fixture assets.
            await pg.evaluate("__gonow.state.answers.stay='';__gonow.state.answers.stayUnsure=true;__gonow.go('plan')")
            await expect(pg.get_by_test_id('find-hotel')).to_be_visible()
            await pg.get_by_test_id('trip-prep-button').click()
            await pg.get_by_test_id('trip-essentials').click()
            await expect(pg.locator('[data-prep-id="book-hotel"]')).to_have_count(1)
            await pg.evaluate("__gonow.state.answers.stay='Hotel';__gonow.state.answers.stayUnsure=false;__gonow.go('plan')")
            await expect(pg.get_by_test_id('find-hotel')).to_have_count(0)
            await pg.evaluate("__gonow.go('flights')")
            await expect(pg.get_by_test_id('book-flights')).to_be_visible()
            assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
            print('PASS contextual bookings, Good to know and persistence', width)
        finally:
            await ctx.close()


if __name__ == '__main__':
    asyncio.run(serve_checks(8878, checks))
