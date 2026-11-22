"""Origin/destination alias and copy regressions; supervisor runs Chromium."""
import asyncio
from playwright.async_api import expect
from test_full import new
from test_wellness_home import serve_checks

BASE = 'http://127.0.0.1:8870/index.html'
ERROR = 'Enter a city or airport code.'

async def copy_check(pg, width):
    assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
    for heading in await pg.locator('.intro h1').all():
        # Display headings may wrap between words, but must fit horizontally.
        assert await heading.evaluate('e => e.scrollWidth <= e.clientWidth'), (width, '.intro h1')
        if await heading.inner_text() == 'Plan your trip':
            assert await heading.evaluate('e => e.getBoundingClientRect().height <= parseFloat(getComputedStyle(e).lineHeight) + 2'), (width, '.intro h1')
    for selector in ('.field-label', '.form-stack small', '#origin-error', '#dest-error'):
        for el in await pg.locator(selector).all():
            if not await el.inner_text():
                continue
            # Helpers and validation stay on one line at both requested widths.
            assert await el.evaluate('e => e.getBoundingClientRect().height <= parseFloat(getComputedStyle(e).lineHeight) + 2'), (width, selector)

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        try:
            for value, expected in [('la','Los Angeles (LAX)'), ('LA','Los Angeles (LAX)'), ('nyc','New York (NYC)'), ('sf','San Francisco (SFO)'), ('lax','Los Angeles (LAX)'), ('Los Angeles','Los Angeles'), ('zz','zz'), ('PDX','PDX'), ('1',None), ('x',None)]:
                await pg.evaluate("() => { __gonow.state.fromHome=false; __gonow.state.answers.destination='Oahu'; __gonow.go('start'); }")
                await expect(pg.locator('h1')).to_have_count(1)
                await expect(pg.locator('h1')).to_have_text('Plan your trip')
                await expect(pg.locator('label[for="to"]')).to_have_text('Where do you want to go?')
                await expect(pg.locator('label[for="from"].field-label')).to_have_text('Flying from')
                await expect(pg.locator('label[for="from"].field-label')).to_be_visible()
                await expect(pg.get_by_label('Flying from', exact=True)).to_be_visible()
                await copy_check(pg, width)
                await pg.get_by_test_id('start-from').fill(value)
                await pg.get_by_test_id('start-next').click()
                if expected:
                    assert await pg.evaluate('__gonow.state.screen') == 'dates'
                    assert await pg.evaluate('__gonow.state.answers.origin') == expected
                    await pg.get_by_test_id('q-back').click()
                    await expect(pg.get_by_test_id('start-from')).to_have_value(expected)
                else:
                    assert await pg.evaluate('__gonow.state.screen') == 'start'
                    await expect(pg.locator('#origin-error')).to_have_text(ERROR)
                await copy_check(pg, width)
            for value in ('la','nyc','sf','lax','1','x'):
                await pg.evaluate("() => { __gonow.state.fromHome=false; __gonow.state.answers.origin='Seattle'; __gonow.go('start'); }")
                await pg.get_by_test_id('start-to').fill(value)
                await pg.get_by_test_id('start-next').click()
                if value in ('1','x'):
                    assert await pg.evaluate('__gonow.state.screen') == 'start'
                    await expect(pg.locator('#dest-error')).to_have_text(ERROR)
                    await copy_check(pg, width)
                else:
                    assert await pg.evaluate('__gonow.state.screen') == 'dates'
                    expected = await pg.evaluate('(v) => GoNowPlaces.normalize(v).name', value)
                    assert await pg.evaluate('__gonow.state.answers.destination') == expected
            await pg.evaluate("__gonow.go('home')")
            # Earlier steps save a draft, so returning visitors see their trips.
            if await pg.get_by_test_id('dashboard').is_visible():
                await pg.get_by_test_id('new-trip').click()
            await expect(pg.get_by_test_id('home-destination')).to_be_visible()
            for junk in ('1', 'x'):
                await pg.get_by_test_id('home-destination').fill(junk)
                await pg.get_by_test_id('start-new-trip').click()
                await expect(pg.locator('#home-dest-error')).to_have_text(ERROR)
                assert await pg.evaluate('__gonow.state.screen') == 'home'
            await pg.get_by_test_id('home-destination').fill('hnl')
            await pg.get_by_test_id('start-new-trip').click()
            await expect(pg.locator('.origin-destination')).to_contain_text('Trip to Honolulu (HNL)')
            await expect(pg.locator('h1')).to_have_count(1)
            await expect(pg.locator('h1')).to_have_text('Where are you flying from?')
            await expect(pg.locator('label[for="from"].sr-only')).to_have_text('Where are you flying from?')
            await expect(pg.locator('label[for="from"].field-label')).to_have_count(0)
            await expect(pg.locator('label[for="to"]')).to_have_count(0)
            await expect(pg.get_by_text('Flying from', exact=True)).to_have_count(0)
            await expect(pg.get_by_test_id('edit-destination')).to_be_visible()
            await copy_check(pg, width)
            assert await pg.evaluate('Engine.matchDestination(__gonow.state.answers.destination).id') == 'oahu'
            await pg.get_by_test_id('start-from').fill('la')
            await pg.get_by_test_id('start-next').click()
            assert await pg.evaluate('__gonow.state.screen') == 'dates'
            await pg.evaluate("() => { __gonow.state.answers.unsure=true; __gonow.go('start'); }")  # legacy flag is ignored
            await pg.get_by_test_id('start-from').fill('la')
            await pg.get_by_test_id('start-next').click()
            assert await pg.evaluate('__gonow.state.screen') == 'dates'
            print('PASS origin/destination aliases, Back, junk, Oahu home flow and copy', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8870, checks))
