import asyncio
from playwright.async_api import expect
from test_full import new
from test_pick_activities import open_picks
from test_wellness_home import serve_checks
async def checks(browser):
    for width in (1280,390):
        ctx,pg=await new(browser,'http://127.0.0.1:8862/index.html',width,844)
        try:
            await open_picks(pg)
            await pg.locator('[data-pick-toggle=diamond-head]').click()
            await pg.get_by_test_id('pick-next').click()
            await pg.get_by_test_id('pick-next').click()
            await expect(pg.get_by_test_id('confirm-plan')).to_be_visible()
            plan=await pg.evaluate('window.__gonow.state.plan')
            items=[i for d in plan['days'] for i in d['items']]
            assert {'diamond-head','lamer','senia'} <= {i['id'] for i in items}
            assert next(i for i in items if i['id']=='lamer')['time']=='7:30 PM'
            assert next(i for i in items if i['id']=='senia')['locked']
            await expect(pg.get_by_test_id('curated-notice')).to_have_count(0)
            await expect(pg.get_by_test_id('quick-notice')).to_have_count(0)
            assert all(not d['theme'] for d in plan['days'])
            assert await pg.locator('.day-title p').count()==0
            diamond=next(i for i in items if i['id']=='diamond-head')
            assert diamond['movementMinutes']>0 and diamond['wellness']['type']=='movement'
            await pg.get_by_test_id('db-day-2026-11-26').click()
            lamer=pg.locator('[data-db-id=lamer][data-db-zone=day]')
            await expect(lamer.locator('[data-testid=db-lock]')).to_have_count(1)
            await expect(lamer.locator('.db-lock')).to_have_count(0)
            await pg.get_by_test_id('confirm-plan').click()
            await expect(pg.get_by_test_id('trip-prep')).to_be_visible()
            # A short trip with all picks exercises explicit unfit actions.
            await pg.evaluate("""()=>{const a=window.__gonow.state.answers;a.end='2026-11-26';a.picks={initialized:true,activities:GONOW_PICKS.oahu.activities.map(i=>i.id),restaurants:GONOW_PICKS.oahu.restaurants.map(i=>i.id)};window.__gonow.go('pick-food');}""")
            await pg.get_by_test_id('pick-next').click()
            notice=pg.get_by_test_id('unfit-notice');await expect(notice).to_be_visible()
            await notice.locator('summary').click()
            senia=notice.locator('.unfit-row').filter(has_text='Senia Chinatown')
            await expect(senia).to_contain_text('Booked Fri · outside your dates')
            await expect(senia.locator('[data-unfit-swap]')).to_have_count(0)
            lamer=notice.locator('.unfit-row').filter(has_text='La Mer')
            await expect(lamer).to_contain_text('Booked Thu · on your travel day')
            await expect(lamer.locator('[data-unfit-swap]')).to_have_count(0)
            await expect(lamer.locator('[data-unfit-remove]')).to_have_count(1)
            assert await notice.locator('.unfit-row small').evaluate_all("es=>es.every(e=>e.textContent.trim().length>0)")
            await notice.locator('[data-unfit-remove]').first.click()
            # All catalog alternatives are selected here; fitting swaps are tested below.
            # A constrained afternoon-only attraction has a fitting culture swap.
            await pg.evaluate("""()=>{const a=window.__gonow.state.answers;a.picks={initialized:true,activities:['pcc'],restaurants:[]};window.__gonow.go('pick-food');}""")
            await pg.get_by_test_id('pick-next').click()
            notice=pg.get_by_test_id('unfit-notice')
            await notice.locator('summary').click()
            await pg.locator('[data-unfit-swap=pcc]').click()
            ids=await pg.evaluate('window.__gonow.state.answers.picks.activities')
            assert 'pcc' not in ids and len(ids)==1
            plan=await pg.evaluate('window.__gonow.state.plan')
            assert any(i['id']==ids[0] for d in plan['days'] for i in d['items'])
            print('PASS checkout, locked times, confirmation, prep, remove and fitting swap',width)
        finally: await ctx.close()
if __name__=='__main__': asyncio.run(serve_checks(8862,checks))
