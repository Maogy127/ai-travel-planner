"""Supervisor-only track/empty-section regressions; port 8852."""
import asyncio
from playwright.async_api import expect
from test_full import new, wait_plan, show_day
from test_wellness_home import serve_checks

BASE = 'http://127.0.0.1:8852/index.html'
SCAN = r'''root => {
  const empty = [...root.querySelectorAll('h2,h3,h4,summary')].filter(head => {
    let body = '', controls = false;
    for(let node = head.nextSibling; node && !/^(H[2-4]|SUMMARY)$/.test(node.nodeName); node = node.nextSibling){
      body += node.textContent || '';
      controls ||= node.nodeType === 1 && (node.matches('input,button,select,textarea,svg,img,canvas') || !!node.querySelector('input,button,select,textarea,svg,img,canvas'));
    }
    return !body.trim() && !controls;
  }).map(e=>e.textContent.trim());
  const pace = [...root.querySelectorAll('summary,p,button,h2,h3,h4,small,legend')].filter(e=>/^Pace/.test(e.textContent.trim()) || e.textContent.trim() === 'Pace not set yet').map(e=>e.textContent.trim());
  return {empty,pace};
}'''

async def audit_days(pg, track, n):
    count = await pg.evaluate('__gonow.state.plan.days.length')
    for i in range(count):
        await show_day(pg, i)
        await pg.locator('details').evaluate_all('els=>els.forEach(e=>e.open=true)')
        if await pg.get_by_test_id('day-feel').count():
            await expect(pg.get_by_test_id('checkin-traveler')).to_have_count(n if track=='each' else 0)
        if track!='each':
            await expect(pg.get_by_test_id('traveler-alternative')).to_have_count(0)
        result = await pg.get_by_test_id('plan-day').evaluate(SCAN)
        assert not result['empty'], (i, result)
        assert len(result['pace']) <= 1, (i, result)

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE+'?today=2026-11-28&', width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await wait_plan(pg)
            for destination in ('sample', 'Lisbon'):
                if destination == 'Lisbon':
                    await pg.evaluate('''async()=>{
                      Object.assign(__gonow.state.answers,{destination:'Lisbon',templateOahu:true});
                      __gonow.state.plan=await AI.generatePlan(__gonow.state.answers,{fast:true});
                      __gonow.go('plan');
                    }''')
                for who, track, n in [('solo','together',1),('couple','together',2),('couple','each',2),('friends','each',3)]:
                    await pg.evaluate('''([who,track,n])=>{
                      Object.assign(__gonow.state.answers,{who,track,adults:n,kids:0,ages:Array(n).fill(30),travelers:[]});
                      __gonow.go('who');
                    }''', [who,track,n])
                    await expect(pg.get_by_test_id('track-choice')).to_have_count(int(n>1))
                    if n>1:
                        await expect(pg.locator('input[name=track][value="'+track+'"]')).to_be_checked()
                    await pg.evaluate("__gonow.go('plan')")
                    for testid in ('traveler-name','traveler-pace','traveler-row','traveler-rings'):
                        await expect(pg.get_by_test_id(testid)).to_have_count(n if track=='each' else 0)
                    await expect(pg.get_by_test_id('group-section')).to_have_count(int(track=='each'))
                    await expect(pg.get_by_test_id('track-toggle')).to_have_count(int(n>1))
                    if n>1:
                        await pg.get_by_test_id('track-toggle').click()
                        await expect(pg.get_by_test_id('group-section')).to_have_count(int(track!='each'))
                        saved = await pg.evaluate("JSON.parse(localStorage.getItem('gonow:answers')).track")
                        assert saved == ('together' if track=='each' else 'each')
                        await pg.get_by_test_id('track-toggle').click()
                    await audit_days(pg, track, n)
                    # Full plan and Trip prep also have no heading-only disclosures.
                    result = await pg.locator('#view').evaluate(SCAN)
                    assert not result['empty'], result
                    await pg.get_by_test_id('trip-prep-button').click()
                    await pg.locator('details').evaluate_all('els=>els.forEach(e=>e.open=true)')
                    result = await pg.get_by_test_id('trip-prep').evaluate(SCAN)
                    assert not result['empty'], result
                    await pg.get_by_test_id('prep-continue').click()
                    print('PASS track/sections',width,destination,who,track,n)
        except Exception as exc:
            print('FAIL track/sections',width,str(exc))
            raise
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8852, checks))
