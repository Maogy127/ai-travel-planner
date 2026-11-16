"""Supervisor-only Chromium checks, real desktop/mobile viewports, port 8855."""
import asyncio
from playwright.async_api import expect
from test_full import new
from test_wellness_home import serve_checks

BASE = 'http://127.0.0.1:8855/index.html'
AUDITED = ['[data-testid=tray-close]', '[data-testid=search-honesty]',
           '.library-card h3', '.library-card summary', '.library-actions button',
           '[data-testid=activity-age-notice]', '[data-testid=activity-no-results]',
           '[data-testid=blocked-reason]', '[data-testid=blocked-suggest]',
           '[data-testid=blocked-dismiss]',
           '[data-testid=activity-add-note]:not(:has([data-testid=blocked-message]))',
           '[data-time-choices] > p', '[data-testid=activity-time-choice]']

async def one_line(tray):
    for selector in AUDITED:
        for element in await tray.locator(selector).all():
            if await element.is_visible():
                assert await element.evaluate('''e=>{
                    const range=document.createRange();range.selectNodeContents(e);
                    const rects=[...range.getClientRects()].filter(r=>r.width&&r.height);
                    return new Set(rects.map(r=>Math.round(r.top))).size<=1
                        && e.scrollWidth<=e.clientWidth;
                }'''), (selector, await element.inner_text())
    # Label text only: the select/input deliberately sits on its own line.
    for label in await tray.locator('.library-search label').all():
        assert await label.evaluate('''e=>{const r=document.createRange();
            r.selectNode(e.firstChild);return r.getClientRects().length===1;}''')

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width, 844)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await expect(pg.get_by_test_id('confirm-plan')).to_be_visible()
            await pg.evaluate("__gonow.go('draft')")
            if width == 390:
                await pg.get_by_role('button', name='Activities', exact=True).click()
            tray = pg.get_by_test_id('activity-tray')
            await expect(tray).to_be_visible()
            await pg.evaluate('document.fonts.ready')
            honesty = tray.get_by_test_id('search-honesty')
            await expect(honesty).to_have_text('Sample places for now')
            assert await honesty.evaluate('e=>e.getBoundingClientRect().height<=1.6*parseFloat(getComputedStyle(e).lineHeight)')
            search = tray.get_by_test_id('activity-search')
            await search.fill('zzzz-not-a-place')
            await expect(tray.get_by_test_id('activity-no-results')).to_have_text('No sample places found')
            await one_line(tray)
            await search.fill('Ala Moana')
            row = tray.get_by_test_id('activity-result').filter(has_text='Black Friday shopping').first
            await row.get_by_test_id('activity-day').select_option('2026-11-26')
            buttons = row.locator('.library-actions button')
            assert await buttons.all_text_contents() == ['Add', 'Edit time', 'Add again']
            boxes = [await button.bounding_box() for button in await buttons.all()]
            assert max(b['height'] for b in boxes)-min(b['height'] for b in boxes)<=1
            assert max(b['y'] for b in boxes)-min(b['y'] for b in boxes)<=1
            await row.get_by_test_id('activity-add').click()
            await expect(row.get_by_test_id('blocked-reason')).to_have_text('Ala Moana closed Thu')
            await expect(row.get_by_test_id('blocked-suggest')).to_have_text('Add to Fri')
            reason, suggest, dismiss = [await row.get_by_test_id(testid).bounding_box()
                for testid in ('blocked-reason', 'blocked-suggest', 'blocked-dismiss')]
            centers = [b['y']+b['height']/2 for b in (reason, suggest, dismiss)]
            assert max(centers)-min(centers)<=4, centers
            assert 0<=dismiss['x']-(suggest['x']+suggest['width'])<24
            assert suggest['height']==dismiss['height']==boxes[0]['height']
            notice = await row.get_by_test_id('blocked-message').bounding_box()
            assert notice['height']<=suggest['height']+1
            await one_line(tray)
            await row.get_by_test_id('blocked-dismiss').click()
            await expect(row.get_by_test_id('blocked-message')).to_have_count(0)
            await search.fill('cocktail')
            await expect(tray.get_by_test_id('activity-age-notice')).to_have_text('Requires age 21+')
            await one_line(tray)
            await search.fill('pillbox')
            row = tray.get_by_test_id('activity-result').first
            await row.get_by_test_id('activity-add-again').click()
            await expect(row.get_by_test_id('activity-add-note')).to_have_text('Added · booking still needed')
            note = row.get_by_test_id('activity-add-note')
            assert await note.evaluate('e=>e.getBoundingClientRect().height<=1.6*parseFloat(getComputedStyle(e).lineHeight)')
            assert not await pg.evaluate('document.documentElement.scrollWidth>innerWidth')
            print('PASS activity sheet copy, equal actions and inline block', width)
        except Exception:
            print('FAIL activity sheet', width)
            raise
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8855, checks))
