"""Supervisor-only Edit picks checks; no external services."""
import asyncio
from playwright.async_api import expect
from test_full import new, open_more
from test_pick_activities import open_picks
from test_any_city import routes, enter
from test_wellness_home import serve_checks

async def snapshot(pg):
    return await pg.evaluate('JSON.stringify({plan:__gonow.state.plan,builder:DayBuilder.exportState(),picks:__gonow.state.answers.picks,prep:localStorage.getItem("gonow.prep.v1")})')

async def checks(browser):
    for width in (1280, 390):
        for confirmed in (False, True):
            ctx, pg = await new(browser, 'http://127.0.0.1:8872/index.html', width, 844)
            try:
                await open_picks(pg)
                for id in ('kahala', 'bishop-museum', 'pearl-harbor'):
                    await pg.locator(f'[data-pick-toggle="{id}"]').click()
                await pg.get_by_test_id('pick-next').click()
                await pg.get_by_test_id('pick-next').click()
                # Use the real day-view lock controls for two selected activities.
                for id in ('kahala', 'bishop-museum'):
                    date = await pg.evaluate('(id)=>__gonow.state.plan.days.find(d=>d.items.some(i=>i.id===id)).date', id)
                    await pg.get_by_test_id('db-day-'+date).click()
                    await pg.locator(f'[data-db-id="{id}"][data-db-zone=day]').get_by_test_id('db-lock').click()
                if confirmed:
                    await pg.get_by_test_id('confirm-plan').click()
                    await pg.get_by_test_id('prep-continue').click()
                before = await snapshot(pg)
                await open_more(pg); await pg.get_by_test_id('edit-picks').click()
                for id in ('kahala', 'bishop-museum'):
                    card=pg.locator(f'[data-pick-id="{id}"]')
                    await expect(card).to_contain_text('Locked')
                    toggle=card.locator('[data-pick-toggle]')
                    await expect(toggle).to_have_attribute('aria-disabled', 'true')
                    await toggle.evaluate('e=>e.click()')
                    await expect(toggle).to_have_attribute('aria-pressed', 'true')
                for id in ('laniakea', 'waimea', 'pearl-harbor'):
                    await pg.locator(f'[data-pick-toggle="{id}"]').click()
                await pg.get_by_test_id('pick-next').click()
                await expect(pg.get_by_test_id('pick-next')).to_have_text('Update plan')
                await pg.get_by_test_id('pick-next').click()
                await expect(pg.get_by_test_id('trip-prep-button' if confirmed else 'confirm-plan')).to_be_visible()
                result=await pg.evaluate('__gonow.state.plan')
                ids={i['id'] for d in result['days'] for i in d['items']}
                assert {'laniakea','waimea'} <= ids and 'pearl-harbor' not in ids
                import json
                old=json.loads(before)
                for id in ('kahala','bishop-museum'):
                    prior=[(date,i['p']) for date,d in old['builder']['d'].items() for i in d['i'] if isinstance(i,dict) and i.get('s',i['id'])==id]
                    now=[(d['date'],i['start']) for d in result['days'] for i in d['items'] if i['id']==id]
                    assert prior==now
                toast=pg.get_by_test_id('plan-toast')
                await expect(toast).to_have_text('Plan updated · Undo')
                assert await toast.evaluate('e=>e.scrollWidth<=e.clientWidth && e.getBoundingClientRect().height<80')
                await pg.get_by_test_id('plan-undo').click()
                assert await snapshot(pg)==before
            finally:
                await ctx.close()
        ctx, pg = await new(browser, 'http://127.0.0.1:8872/index.html', width, 844)
        try:
            await routes(pg, 'seattle')
            await enter(pg, 'Seattle')
            await pg.locator('[data-pick-toggle=osm-node-100]').click()
            await pg.get_by_test_id('pick-next').click()
            await pg.get_by_test_id('pick-next').click()
            await open_more(pg); await pg.get_by_test_id('edit-picks').click()
            await expect(pg.locator('[data-pick-toggle=osm-node-100]')).to_have_attribute('aria-pressed','true')
            await pg.get_by_test_id('pick-next').click()
            await pg.get_by_test_id('pick-next').click()
            await expect(pg.get_by_test_id('plan-toast')).to_have_text('Plan updated · Undo')
        finally:
            await ctx.close()
if __name__=='__main__':
    asyncio.run(serve_checks(8872,checks))
