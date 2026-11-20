"""Group sync UI (port 8899): one-line sync status, cloud notices never cover Undo, trip-only sharing,
account day plans reload the open plan. Firebase is the local ESM mock; no real accounts or network."""
import asyncio, json
from playwright.async_api import expect
from test_full import new, continue_prep, open_share_menu, open_more
from test_wellness_home import serve_checks
from test_fixes_batch import mock_sdk, checkout_oahu

BASE = 'http://127.0.0.1:8899/index.html'
RESULTS = []
def ok(name, cond, detail=''):
    RESULTS.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else ' · ' + str(detail)[:300]), flush=True)

async def owner(b):
    ctx, pg = await new(b, BASE, 390); await mock_sdk(ctx)
    await checkout_oahu(pg); await continue_prep(pg)
    await pg.evaluate("localStorage.setItem('gonow:answers',localStorage.getItem('gonow:answers'));Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>window.__invite=t}})")
    await pg.get_by_test_id('sign-in').click(); await pg.get_by_test_id('sign-in-google').click()
    await pg.get_by_test_id('sync-yes').click(); await pg.wait_for_timeout(600)
    return ctx, pg

async def status_line(b):
    ctx, pg = await owner(b)
    st = pg.get_by_test_id('sync-status')
    await expect(st).to_have_text('Saved')
    box = await st.bounding_box(); ok('status is one short line in the header', box and box['height'] <= 40, box)
    await pg.evaluate("__fbMock.state.offline=true;const t=JSON.parse(localStorage.getItem('gonow:trips'));t[0].title='Offline edit';t[0].updatedAt=Date.now();localStorage.setItem('gonow:trips',JSON.stringify(t));goNowAccount.write(t)")
    await expect(st).to_have_text('Offline, will sync', timeout=5000); ok('offline write shows "Offline, will sync"', True)
    ok('edit kept in the queue', await pg.evaluate("goNowAccount.pending()") >= 1)
    await pg.evaluate("__fbMock.state.offline=false;window.dispatchEvent(new Event('online'))")
    await expect(st).to_have_text('Saved', timeout=5000)
    ok('back online: queued edit lands', await pg.evaluate("Object.entries(__fbMock.dump()).some(([k,v])=>k.startsWith('users/owner/trips/')&&v.title==='Offline edit')"))
    await pg.evaluate("__fbMock.state.deny=true;const t=JSON.parse(localStorage.getItem('gonow:trips'));t[0].title='Denied';t[0].updatedAt=Date.now();goNowAccount.write(t)")
    await expect(st).to_have_text('Couldn’t sync · Retry', timeout=5000); ok('denied write shows "Couldn’t sync · Retry"', True)
    await pg.evaluate("__fbMock.state.deny=false"); await st.click()
    await expect(pg.get_by_test_id('sync-detail')).to_be_visible(); await expect(st).to_have_text('Saved', timeout=5000)
    ok('tap = details + retry, then Saved', True)
    await pg.get_by_role('button', name='Close', exact=True).click()
    await ctx.close()

async def undo_vs_notice(b):
    ctx, pg = await owner(b)
    await open_share_menu(pg); await pg.get_by_test_id('invite-friends').click()
    await expect(pg.get_by_test_id('cloud-notice')).to_have_text('Invite link copied')
    ok('cloud notice is not the toast', await pg.locator('#toast').inner_text() == '')
    path = await pg.evaluate("Object.keys(__fbMock.dump()).find(p=>p.startsWith('trips/'))")
    await open_more(pg); await pg.get_by_test_id('edit-picks').click(); await pg.get_by_test_id('pick-activities').wait_for()
    await pg.locator('[data-pick-toggle="waimea"]').click(); await pg.get_by_test_id('pick-next').click(); await pg.get_by_test_id('pick-next').click()
    await expect(pg.get_by_test_id('plan-toast')).to_have_text('Plan updated · Undo')
    await pg.evaluate('(p)=>__fbMock.simulateAlex(p)', path)
    await expect(pg.get_by_test_id('cloud-notice')).to_have_text('Alex added Kualoa')
    ok('Undo still there after a cloud notice', 'Undo' in await pg.get_by_test_id('plan-toast').inner_text())
    top = await pg.evaluate("(()=>{const u=document.querySelector('#toast button');const r=u.getBoundingClientRect();const n=document.getElementById('cloud-notice').getBoundingClientRect();return {hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===u,overlap:!(n.bottom<=r.top||n.top>=r.bottom||n.right<=r.left||n.left>=r.right)}})()")
    ok('Undo is on top and not covered', top['hit'] and not top['overlap'], top)
    await pg.get_by_test_id('plan-undo').click(); ok('Undo works', True)
    await ctx.close()

async def trip_only_and_day_plans(b):
    ctx, pg = await owner(b)
    await pg.evaluate("const t=JSON.parse(localStorage.getItem('gonow:trips'));t[0].answers=Object.assign({},t[0].answers,{diet:'vegan',fitness:'low',origin:'SFO'});t[0].checkins=[{feel:2,note:'tired'}];localStorage.setItem('gonow:trips',JSON.stringify(t))")
    await open_share_menu(pg); await pg.get_by_test_id('invite-friends').click(); await expect(pg.get_by_test_id('cloud-notice')).to_have_text('Invite link copied')
    shared = await pg.evaluate("JSON.stringify(Object.entries(__fbMock.dump()).find(([k])=>k.startsWith('trips/'))[1].trip)")
    ok('group doc has no personal answers or check-ins', 'answers' not in json.loads(shared) and 'vegan' not in shared and 'tired' not in shared and 'SFO' not in shared, shared[:200])
    # Day plans from the account (another device) reach the open plan.
    tid = await pg.evaluate("__gonow.state.tripId")
    await pg.wait_for_function("goNowAccount.pending()===0", timeout=10000); await pg.wait_for_timeout(500)
    plan_id = await pg.evaluate("__gonow.state.plan.id")
    changed = await pg.evaluate("""(()=>{const t=JSON.parse(localStorage.getItem('gonow:trips')).find(x=>x.id===__gonow.state.tripId);const raw=DayBuilder.importForPlan(DayBuilder.exportState(),__gonow.state.plan);__gonow.state.plan.days.forEach(d=>{if(!raw.days[d.date])raw.days[d.date]=DayBuilder.buildSuggested(d.date);});const day=Object.keys(raw.days)[1];const items=raw.days[day].items;items.reverse();raw.days[day].chronological=false;raw.days[day].unscheduled=[...(raw.days[day].unscheduled||[])];__fbMock.seed('users/owner/trips/'+t.id,Object.assign({},t,{builder:raw,updatedAt:Date.now()+600000}));return {day,ids:items.map(i=>i.id)};})()""")
    await pg.wait_for_timeout(800)
    stored = await pg.evaluate("(k)=>JSON.parse(localStorage.getItem(k))", 'gonow:daybuilder:' + plan_id)
    ok('account day plan written to this device', [i['id'] for i in stored['days'][changed['day']]['items']] == changed['ids'])
    await ctx.close()

async def checks(b):
    for fn in (status_line, undo_vs_notice, trip_only_and_day_plans):
        try: await fn(b)
        except Exception as e: ok(fn.__name__ + ' ran', False, repr(e)[:400])
    failed = [n for n, c in RESULTS if not c]
    print(f'SUMMARY pass {len(RESULTS)-len(failed)} fail {len(failed)}')
    assert not failed, failed

if __name__ == '__main__':
    asyncio.run(serve_checks(8899, checks))
