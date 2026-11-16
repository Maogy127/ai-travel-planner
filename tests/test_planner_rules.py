"""Supervisor Chromium checks; port 8851. Do not run in the editing agent."""
import asyncio
from playwright.async_api import expect
from test_full import new
from test_wellness_home import serve_checks

BASE = 'http://127.0.0.1:8851/index.html'

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        errors = []
        pg.on('pageerror', lambda error: errors.append(str(error)))
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await expect(pg.get_by_test_id('confirm-plan')).to_be_visible()
            result = await pg.evaluate("DayBuilder.addToDay('2026-11-26',{title:'Bishop Museum',time:'12:00'})")
            assert not result['ok']
            await expect(pg.get_by_test_id('blocked-reason')).to_have_text('Bishop Museum closed Thu')
            await expect(pg.get_by_test_id('blocked-suggest')).to_have_text('Add to Fri')
            assert await pg.get_by_test_id('blocked-message').evaluate("e=>!!e.closest('[data-testid=db-day-list]')")
            await pg.get_by_test_id('blocked-suggest').click()
            await expect(pg.get_by_test_id('blocked-message')).to_have_count(0)
            assert await pg.evaluate("DayBuilder.schedule().days.find(d=>d.date==='2026-11-27').items.some(i=>i.title==='Bishop Museum')")
            assert not await pg.evaluate("DayBuilder.schedule().days.find(d=>d.date==='2026-11-26').items.some(i=>i.title==='Bishop Museum')")
            assert not await pg.evaluate("DayBuilder.addToDay('2026-11-28',{title:'Scuba dive',tags:['dive'],time:'09:00'}).ok")
            await expect(pg.get_by_test_id('blocked-reason')).to_have_text('Dive too close to flight')
            await pg.get_by_test_id('blocked-suggest').click()
            assert await pg.evaluate("DayBuilder.schedule().days.find(d=>d.date==='2026-11-27').items.some(i=>i.title==='Scuba dive')")
            result = await pg.evaluate("DayBuilder.addToDay('2026-11-26',{title:'Black Friday shopping — Ala Moana Center',place:'Ala Moana Center',time:'12:00'})")
            assert result['reason'] == 'Closed Thu, Nov 26'
            await expect(pg.get_by_test_id('blocked-reason')).to_have_text('Ala Moana closed Thu')
            assert await pg.get_by_test_id('blocked-message').evaluate("e=>{const r=e.querySelector('[data-testid=blocked-reason]'),a=e.querySelector('.db-blocked-actions');return getComputedStyle(r).textOverflow!=='ellipsis'&&r.scrollWidth<=r.clientWidth&&a.getBoundingClientRect().top>=r.getBoundingClientRect().bottom;}")
            await pg.get_by_test_id('blocked-dismiss').click()
            print('PASS blocked add, accessible reason, suggestion and open-day add', width)
            await pg.get_by_test_id('confirm-plan').click()
            prep = pg.get_by_test_id('trip-prep')
            await expect(prep).to_be_visible()
            await pg.get_by_test_id('trip-essentials').click()
            actions = prep.locator('#trip-essentials [data-action-kind]')
            count = await actions.count()
            assert count > 0
            for action in await actions.all():
                assert await action.get_attribute('data-action-kind') in ('book', 'id', 'insurance', 'visa')
                text = (await action.inner_text()).strip()
                assert len(text.split()) <= 8 and len(text) <= 48
            assert await prep.locator('.prep-day-notes, #trip-essentials .sources').count() == 0
            await expect(pg.get_by_test_id('trip-prep-button')).to_have_count(0)
            await expect(pg.get_by_test_id('trip-essentials')).to_have_text(f'Before you go · {count} to do')
            assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
            print('PASS Before you go only short actions, matching count, no overflow', width)
            # Local plans with all bookings complete have no remaining action kind.
            await pg.evaluate("""()=>{const s=__gonow.state;s.answers.mode='local';s.plan.days.forEach(d=>d.items.forEach(i=>i.booked=true));__gonow.go('prep');}""")
            await expect(pg.get_by_test_id('trip-essentials')).to_have_count(0)
            await pg.get_by_test_id('prep-continue').click()
            await expect(pg.get_by_test_id('trip-prep-button')).to_have_text('Trip prep · All set')
            assert not errors, errors
            print('PASS empty actions hide Before you go', width)
        except Exception:
            print('FAIL planner rules', width)
            raise
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8851, checks))
