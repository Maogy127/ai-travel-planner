"""Supervisor Chromium checks for per-trip preparation; port 8848."""
from test_full import reopen_dashboard
import asyncio
from playwright.async_api import expect
from test_full import new, reopen
from test_wellness_home import serve_checks

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8848/index.html', width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            prep = pg.get_by_test_id('trip-prep')
            await expect(prep).to_be_visible()
            assert 'Your plan is ready.' not in await pg.locator('#toast').inner_text()
            print('PASS trip prep check 14', width)
            await expect(prep.locator('h1')).to_be_focused()
            print('PASS trip prep check 15', width)
            sections = prep.get_by_test_id('prep-section')
            await expect(sections).to_have_count(3)
            print('PASS trip prep check 17', width)
            assert [t.strip() for t in await sections.locator(':scope > h2, :scope > summary').all_text_contents()] == ['Budget', 'Before you go · '+str(await prep.locator('#trip-essentials > .checkrow').count())+(' note' if await prep.locator('#trip-essentials > .checkrow').count() == 1 else ' notes'), 'What to bring']
            print('PASS trip prep check 18', width)
            for title in await sections.locator(':scope > h2, :scope > summary').all():
                assert await title.evaluate('''e=>{const icon=e.querySelector('svg').getBoundingClientRect();const r=document.createRange();r.selectNodeContents(e.lastChild);const text=r.getBoundingClientRect();return Math.abs(text.left-icon.right)<24 && getComputedStyle(e).textAlign==='left';}''')
                print('PASS trip prep check 20', width)
            assert await prep.locator('.packing-category:not([open])').count() > 0
            print('PASS trip prep check 21', width)
            await prep.locator('details').evaluate_all('(els)=>els.forEach(e=>e.open=true)')
            items = prep.get_by_test_id('prep-item')
            count = await items.count()
            assert count > 0
            print('PASS trip prep check 25', width)
            await items.first.check()
            await expect(pg.get_by_test_id('trip-prep-button')).to_have_text(f'Trip prep · {count-1} left')
            print('PASS trip prep check 27', width)
            await pg.get_by_test_id('prep-continue').click()
            await expect(pg.locator('main h1').first).to_be_focused()
            print('PASS trip prep check 29', width)
            await expect(pg.get_by_test_id('trip-prep-button')).to_have_text(f'Trip prep · {count-1} left')
            print('PASS trip prep check 30', width)
            await expect(pg.locator('.utility-tile, .budget, [data-testid=tile]')).to_have_count(0)
            print('PASS trip prep check 31', width)
            # Day disclosures were intentionally consolidated into Trip prep.
            await expect(pg.get_by_test_id('before-you-go')).to_have_count(0)
            assert 'Your plan is ready.' not in await pg.locator('#toast').inner_text()
            await pg.get_by_test_id('trip-prep-button').click()
            normalize = lambda t: ' '.join(''.join(c.lower() if c.isalnum() else ' ' for c in t).split())
            notices = await prep.locator('#trip-essentials .checkrow span').all_text_contents()
            assert len(list(map(normalize, notices))) == len(set(map(normalize, notices)))
            print('PASS trip prep check 37', width)
            merged_notes = await pg.evaluate('__gonow.state.plan.days.flatMap(d=>(d.prep||[]).concat(d.items.flatMap(i=>i.prep||[]))).map(n=>n.text)')
            assert set(map(normalize, merged_notes)).issubset(set(map(normalize, notices)))
            print('PASS trip prep check 39', width)
            await expect(prep.get_by_test_id('prep-item').first).to_be_checked()
            print('PASS trip prep check 40', width)
            await prep.locator('details').evaluate_all('(els)=>els.forEach(e=>e.open=true)')
            for item in await prep.get_by_test_id('prep-item').all():
                await item.check()
            await expect(pg.get_by_test_id('trip-prep-button')).to_have_text('Trip prep · All set')
            print('PASS trip prep check 44', width)
            await pg.get_by_test_id('prep-continue').click()
            await expect(pg.get_by_test_id('trip-prep-button')).to_have_text('Trip prep · All set')
            print('PASS trip prep check 46', width)
            await pg.reload()
            await reopen_dashboard(pg)
            await expect(pg.get_by_test_id('trip-prep-button')).to_be_visible()
            print('PASS trip prep check 49', width)
            await expect(pg.get_by_test_id('trip-prep')).to_have_count(0)
            print('PASS trip prep check 50', width)
            await expect(pg.get_by_test_id('trip-prep-button')).to_have_text('Trip prep · All set')
            print('PASS trip prep check 51', width)
            await pg.get_by_test_id('trip-prep-button').click()
            for item in await pg.get_by_test_id('prep-item').all():
                await expect(item).to_be_checked()
                print('PASS trip prep check 54', width)
            assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
            print('PASS trip prep check 55', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8848, checks))
