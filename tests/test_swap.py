"""Supervisor-only slot-preserving Swap checks, without external services."""
import asyncio
from playwright.async_api import expect
from test_full import new, open_home_flow, through_picks, show_day
from test_wellness_home import serve_checks

async def times(pg):
    return await pg.evaluate("DayBuilder.schedule().days.find(d=>d.date==='2026-11-26').items.map(i=>({id:i.id,start:i.start,end:i.end}))")

async def checks(browser):
    for width in (1280, 390):
        for confirmed in (False, True):
            ctx, pg = await new(browser, 'http://127.0.0.1:8873/index.html', width, 844)
            try:
                await open_home_flow(pg)
                await pg.get_by_test_id('demo-oahu').click()
                await through_picks(pg)
                if confirmed:
                    await pg.get_by_test_id('confirm-plan').click()
                    await pg.get_by_test_id('prep-continue').click()
                # Confirmation and reload can return to the dashboard; reopen the live plan.
                await show_day(pg, 1)
                item = await pg.evaluate("DayBuilder.schedule().days.find(d=>d.date==='2026-11-26').items.find(i=>/Diamond Head/.test(i.title)&&i.kind!=='travel')")
                assert item['id'] == '2026-11-26-1'
                row = pg.locator(f'[data-db-zone=day][data-db-id="{item["id"]}"]')
                # The demo starts locked; Swap becomes available only after unlocking.
                await expect(row.get_by_test_id('db-lock')).to_have_attribute('aria-pressed', 'true')
                await expect(row.get_by_test_id('db-lock')).to_have_attribute('aria-label', 'Unlock time')
                await row.get_by_test_id('db-more').click()
                await expect(row.get_by_test_id('db-more-menu')).to_be_visible()
                await expect(row.get_by_test_id('db-swap')).to_have_count(0)
                await row.get_by_test_id('db-lock').click()
                await expect(row.get_by_test_id('db-lock')).to_have_attribute('aria-pressed', 'false')
                # A source-planned slot must persist its unlocked state after reload.
                await pg.reload()
                # Confirmation and reload can return to the dashboard; reopen the live plan.
                await show_day(pg, 1)
                await expect(row.get_by_test_id('db-lock')).to_have_attribute('aria-pressed', 'false')
                before = await times(pg)
                async def open_swap():
                    row=pg.locator(f'[data-db-zone=day][data-db-id="{item["id"]}"]')
                    more = row.get_by_test_id('db-more')
                    menu = row.get_by_test_id('db-more-menu')
                    # Undo can restore an open menu; close it before reopening Swap.
                    if await more.get_attribute('aria-expanded') == 'true':
                        await more.click()
                        await expect(menu).to_be_hidden()
                        await expect(more).to_have_attribute('aria-expanded', 'false')
                    await more.click()
                    await expect(more).to_have_attribute('aria-expanded', 'true')
                    await expect(menu).to_be_visible()
                    await row.get_by_test_id('db-swap').click()
                    await expect(pg.get_by_test_id('swap-sheet')).to_be_visible()
                await open_swap()
                options=pg.get_by_test_id('swap-option')
                assert 3 <= await options.count() <= 5
                assert await options.evaluate_all("es=>es.every(e=>getComputedStyle(e).whiteSpace==='nowrap' && e.scrollWidth<=e.clientWidth)")
                await options.first.click()
                after=await times(pg)
                others=[i for i in before if i['id']!=item['id']]
                assert [i for i in after if i['id'] in {x['id'] for x in others}]==others
                added=[i for i in after if i['id'] not in {x['id'] for x in before}]
                assert len(added)==1 and added[0]['start']==item['start']
                await expect(pg.get_by_test_id('plan-toast')).to_have_text('Swapped · Undo')
                await pg.get_by_test_id('plan-undo').click()
                assert await times(pg)==before
                await open_swap()
                await pg.get_by_test_id('swap-free').click()
                assert await times(pg)==others
                locked=pg.locator('[data-db-zone=day]').filter(has_text='Birthday dinner')
                # Confirmed La Mer has a static tag, never a dead unlock toggle.
                # db-lock remains one indicator, but has no toggle semantics.
                await expect(locked.get_by_test_id('db-lock')).to_have_count(1)
                assert await locked.get_by_test_id('db-lock').evaluate("e=>e.tagName==='SPAN'&&!e.hasAttribute('aria-pressed')&&!e.hasAttribute('data-db-action')")
                await expect(locked.get_by_test_id('db-locked-tag')).to_have_text('Locked')
                assert await locked.get_by_test_id('db-locked-tag').evaluate("e=>e.tagName==='SPAN'&&!e.hasAttribute('role')&&!e.hasAttribute('tabindex')")
                await locked.get_by_test_id('db-more').click()
                await expect(locked.get_by_test_id('db-swap')).to_have_count(0)
                if confirmed:
                    await expect(pg.get_by_test_id('trip-prep-button')).to_be_visible()
                    await expect(pg.get_by_test_id('confirm-plan')).to_have_count(0)
            finally:
                await ctx.close()

if __name__=='__main__':
    asyncio.run(serve_checks(8873, checks))
