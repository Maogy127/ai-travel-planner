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
            assert all(d['theme'] and d['theme']!='Your picks' for d in plan['days'])
            assert await pg.locator('.day-title p').count()>0
            diamond=next(i for i in items if i['id']=='diamond-head')
            assert diamond['movementMinutes']>0 and diamond['wellness']['type']=='movement'
            await pg.get_by_test_id('db-day-2026-11-26').click()
            lamer=pg.locator('[data-db-id=lamer][data-db-zone=day]')
            # One static lock indicator preserves the count without a dead toggle.
            await expect(lamer.locator('[data-testid=db-lock]')).to_have_count(1)
            assert await lamer.get_by_test_id('db-lock').evaluate("e=>e.tagName==='SPAN'&&!e.hasAttribute('aria-pressed')&&!e.hasAttribute('data-db-action')&&!e.hasAttribute('tabindex')")
            await expect(lamer.locator('.db-lock')).to_have_count(0)
            await pg.get_by_test_id('confirm-plan').click()
            await expect(pg.get_by_test_id('trip-prep')).to_be_visible()
            # Overflow on the normal dates contains only removable, unlocked picks.
            await pg.evaluate("""()=>{const a=window.__gonow.state.answers;a.end='2026-11-29';a.picks={initialized:true,activities:GONOW_PICKS.oahu.activities.map(i=>i.id),restaurants:GONOW_PICKS.oahu.restaurants.map(i=>i.id)};window.__gonow.go('pick-food');}""")
            await pg.get_by_test_id('pick-next').click()
            notice=pg.get_by_test_id('unfit-notice');await expect(notice).to_be_visible()
            await notice.locator('summary').click()
            assert 'La Mer' not in await notice.inner_text()
            assert 'Senia' not in await notice.inner_text()
            assert await notice.locator('.unfit-row small').evaluate_all("es=>es.every(e=>e.textContent.trim().length>0)")
            await notice.locator('[data-unfit-remove]').first.click()
            # Bookings outside dates have a separate Fix action, never Remove.
            await pg.evaluate("""()=>{const a=window.__gonow.state.answers;a.end='2026-11-26';a.picks={initialized:true,activities:[],restaurants:['lamer','senia']};window.__gonow.go('pick-food');}""")
            await pg.get_by_test_id('pick-next').click()
            issue=pg.get_by_test_id('booking-issue').filter(has_text='Senia')
            await expect(issue).to_contain_text('Senia booked Fri · outside your dates')
            await expect(issue.get_by_role('button',name='Fix',exact=True)).to_have_count(1)
            if width==390:
                assert await issue.evaluate('e=>{const r=document.createRange();r.selectNodeContents(e.firstChild);return r.getClientRects().length===1 && e.scrollWidth<=e.clientWidth && Math.abs(r.getBoundingClientRect().top-e.querySelector("button").getBoundingClientRect().top)<16}')
            await issue.get_by_role('button',name='Fix',exact=True).click()
            await expect(pg.get_by_test_id('date-end')).to_be_visible()
            # A known later flight permits a short culture stop, but not PCC.
            await pg.evaluate("""()=>{const a=window.__gonow.state.answers;a.flightTime='4:00 PM';a.picks={initialized:true,activities:['pcc'],restaurants:[]};window.__gonow.go('pick-food');}""")
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
