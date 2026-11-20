"""Supervisor-only Chromium checks; actual desktop and mobile viewports."""
import asyncio
from playwright.async_api import expect
from test_full import new, answer
from test_wellness_home import serve_checks

async def open_picks(pg):
    await answer(pg, 'Oahu')
    await expect(pg.get_by_role('heading',name='No, pick places now')).to_be_visible()
    await expect(pg.get_by_test_id('fork-no')).to_have_text('Pick places →')
    await pg.get_by_test_id('fork-no').click()
    await expect(pg.get_by_test_id('pick-activities')).to_be_visible()

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8860/index.html', width, 844)
        try:
            await open_picks(pg)
            await pg.get_by_test_id('pick-back').click()
            await expect(pg.get_by_role('heading', name='Want it more personal?', exact=True)).to_be_visible()
            await pg.get_by_test_id('fork-no').click()
            await expect(pg.get_by_test_id('pick-activities')).to_be_visible()
            await expect(pg.locator('#pick-count')).to_have_text('Picked 0')
            await expect(pg.locator('[data-pick-id=kahala] small').first).to_have_text('45 min · Easy · Free')
            await expect(pg.locator('[data-pick-id=hanauma] small').first).to_have_text('2 h · Moderate · $25 pp')
            assert await pg.locator('.pick-chips button').evaluate_all("es=>es.every(e=>e.scrollWidth<=e.clientWidth)")
            await pg.locator('[data-pick-info=hanauma]').click()
            await expect(pg.get_by_test_id('pick-details')).to_contain_text('How long · 2 h')
            close=pg.get_by_role('button',name='Close',exact=True)
            assert await close.evaluate('e=>e.getBoundingClientRect().width>=44&&e.getBoundingClientRect().height>=44')
            await expect(pg.locator('.pick-photo-credit')).to_contain_text('Photo:')
            await close.click()
            await pg.get_by_role('button', name='Water', exact=True).click()
            assert await pg.locator('[data-pick-id=hanauma]').count() == 1
            assert await pg.locator('[data-pick-id=bishop-museum]').count() == 0
            await pg.get_by_role('button', name='All', exact=True).click()
            await pg.get_by_test_id('pick-search').fill('turtle')
            await expect(pg.get_by_test_id('pick-card')).to_have_count(1)
            toggle=pg.locator('[data-pick-toggle=laniakea]')
            await toggle.click(); await expect(toggle).to_have_attribute('aria-pressed','true')
            await expect(pg.locator('#pick-count')).to_have_text('Picked 1 · about 1 day')
            await toggle.click(); await expect(toggle).to_have_attribute('aria-pressed','false')
            await pg.locator('[data-pick-info=laniakea]').click()
            await expect(pg.get_by_role('heading',name='Example reviews')).to_be_visible()
            await pg.get_by_role('button',name='Close',exact=True).click()
            await pg.get_by_test_id('pick-search').fill('')
            last=pg.get_by_test_id('pick-card').last
            await last.scroll_into_view_if_needed()
            assert await last.evaluate("e=>e.getBoundingClientRect().bottom<=document.querySelector('.pick-footer').getBoundingClientRect().top")
            await pg.get_by_test_id('pick-search').fill('no-such-place')
            empty = pg.locator('#pick-results p')
            await expect(empty).to_have_text('No matches · try another word')
            assert await empty.evaluate('e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).lineHeight)+1')
            await pg.get_by_test_id('pick-next').click()
            await pg.get_by_test_id('pick-next').click()
            await pg.get_by_test_id('change-answers').click()
            await expect(pg.get_by_test_id('date-start')).to_be_visible()
            # Revisit the fork through Draft answer editing, then take extra questions.
            for _ in range(6):  # Includes optional flights after dates.
                await pg.get_by_test_id('q-continue').click()
            await expect(pg.get_by_test_id('fork-yes')).to_be_visible()
            await pg.get_by_test_id('fork-yes').click()
            for _ in range(3):
                await pg.get_by_test_id('q-skip').click()
            await expect(pg.get_by_test_id('pick-activities')).to_be_visible()
            await pg.get_by_test_id('pick-back').click()
            await expect(pg.get_by_role('heading', name='Anything we must include?', exact=True)).to_be_visible()
            print('PASS activities filters, search, toggle, details and footer',width)
        finally:
            await ctx.close()
if __name__=='__main__':
    asyncio.run(serve_checks(8860,checks))
