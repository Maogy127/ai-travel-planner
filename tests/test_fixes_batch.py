"""Regression tests for the Nov 17 fix batch (port 8896). Firebase is the local ESM mock; place hosts use fixtures."""
import asyncio, re
from pathlib import Path
from playwright.async_api import expect
from test_full import new, continue_prep, open_share_menu, answer
from test_wellness_home import serve_checks
from test_pick_activities import open_picks
from test_any_city import routes, enter
from test_accounts import FIXTURES

BASE = 'http://127.0.0.1:8896/index.html'
RESULTS = []
def ok(name, cond, detail=''):
    RESULTS.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else ' · ' + str(detail)[:300]), flush=True)

async def mock_sdk(context, guard=False):
    async def route_sdk(route):
        fn = route.request.url.rsplit('/', 1)[-1]; body = (FIXTURES / fn).read_text()
        if guard and fn == 'firebase-firestore.js':
            # Like firestore.rules joining(): an existing member's join write is denied.
            body = body.replace("export async function updateDoc(ref,data){validate(data);", "export async function updateDoc(ref,data){validate(data);if(data.joinInvite){const cur=state.records.get(ref.path)||{};const uid=Object.keys(data).find(k=>k.startsWith('members.'))?.slice(8);if((cur.memberIds||[]).includes(uid)){const e=Error('Missing or insufficient permissions.');e.code='permission-denied';throw e;}}")
        await route.fulfill(body=body, content_type='text/javascript')
    await context.route('https://www.gstatic.com/firebasejs/10.12.2/*.js', route_sdk)

async def checkout_oahu(pg, food=()):
    await open_picks(pg); await pg.locator('[data-pick-toggle="kahala"]').click()
    await pg.get_by_test_id('pick-next').click()
    for f in food: await pg.locator(f'[data-pick-toggle="{f}"]').click()
    await pg.get_by_test_id('pick-next').click(); await pg.get_by_test_id('confirm-plan').wait_for()

async def reopen(pg):
    await pg.reload(); await pg.wait_for_timeout(800)
    if await pg.get_by_test_id('trip-card').count(): await pg.get_by_test_id('trip-card').first.locator('[data-open-trip]').click()
    await pg.wait_for_timeout(800)

async def owner_invite(b, sync):
    ctx, pg = await new(b, BASE, 390); await mock_sdk(ctx)
    await checkout_oahu(pg); await continue_prep(pg)
    await pg.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>window.__invite=t}})")
    await pg.get_by_test_id('sign-in').click(); await pg.get_by_test_id('sign-in-google').click()
    await pg.get_by_test_id('sync-yes' if sync else 'sync-no').click(); await pg.wait_for_timeout(500)
    await open_share_menu(pg); await pg.get_by_test_id('invite-friends').click(); await expect(pg.locator('#toast')).to_have_text('Invite link copied')
    return ctx, pg

async def cold_invite(b):
    owner, opg = await owner_invite(b, True); link = await opg.evaluate('window.__invite'); records = await opg.evaluate('__fbMock.dump()')
    ctx, pg = await new(b, BASE, 390); await mock_sdk(ctx)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    # Seed the in-page mock before any app script runs, then cold-load the invite URL.
    await ctx.add_init_script("window.__seed=" + __import__('json').dumps(records))
    await pg.goto(BASE + '#join=' + link.split('#join=')[1]); await pg.wait_for_timeout(600)
    sheet = pg.get_by_test_id('sign-in-sheet')
    ok('cold-load invite opens the sign-in sheet with the name-only join', await sheet.is_visible() and await pg.get_by_test_id('join-name').count() == 1, await pg.evaluate('location.hash'))
    await pg.wait_for_function('!!window.__fbMock'); await pg.evaluate('()=>{for(const [p,d] of Object.entries(window.__seed))window.__fbMock.seed(p,d)}')
    await pg.get_by_test_id('join-name').fill('Alex'); await pg.get_by_test_id('join-anon').click()
    await expect(pg.get_by_test_id('account-button')).to_have_text('A'); await pg.wait_for_function('window.goNowAccount.group!==null')
    ok('cold-load join adds the member', await pg.evaluate("Object.values(__fbMock.dump()).some(d=>d.memberIds&&d.memberIds.length===2)"))
    ok('invite id cleared from the address after joining', 'join=' not in await pg.evaluate('location.href'))
    ok('no page errors on cold invite', not errs, errs)
    await ctx.close(); await owner.close()

async def returning_member(b):
    owner, opg = await owner_invite(b, True); link = await opg.evaluate('window.__invite'); records = await opg.evaluate('__fbMock.dump()')
    ctx, pg = await new(b, BASE, 390); await mock_sdk(ctx, guard=True)
    await pg.get_by_test_id('sign-in').click(); await pg.wait_for_function('!!window.__fbMock')
    await pg.evaluate('(r)=>{for(const [p,d] of Object.entries(r))window.__fbMock.seed(p,d)}', records)
    await pg.get_by_role('button', name='Close', exact=True).click()
    await pg.evaluate('(l)=>location.hash=new URL(l).hash', link); await pg.get_by_test_id('join-name').fill('Alex'); await pg.get_by_test_id('join-anon').click()
    await expect(pg.get_by_test_id('account-button')).to_have_text('A'); await pg.wait_for_function('window.goNowAccount.group!==null')
    await pg.evaluate('(l)=>location.hash=new URL(l).hash', link); await pg.wait_for_timeout(1200)
    sheet = pg.get_by_test_id('sign-in-sheet'); text = await sheet.inner_text() if await sheet.is_visible() else ''
    ok('returning member re-opening the invite gets no error', 'isn’t available' not in text and 'Couldn’t join' not in text, text)
    ok('returning member sees "already in this trip"', 'already in this trip' in await pg.locator('#toast').inner_text())
    # Owner opening their own link: also no error.
    await opg.evaluate('(l)=>location.hash=new URL(l).hash', link); await opg.wait_for_timeout(1200)
    osheet = opg.get_by_test_id('sign-in-sheet')
    ok('owner opening own invite gets no error', not (await osheet.is_visible() and 'isn’t available' in await osheet.inner_text()), await osheet.inner_text() if await osheet.is_visible() else '')
    await opg.screenshot(path='/tmp/owner-own-invite.png')
    if await osheet.is_visible(): await opg.get_by_role('button', name='Close', exact=True).click()
    if await opg.get_by_test_id('trip-card').count(): await opg.get_by_test_id('trip-card').first.locator('[data-open-trip]').click(); await opg.wait_for_timeout(600)
    # A malformed suggestion (no change) does not break the owner's panel (M10).
    path = next(p for p in records if p.startswith('trips/'))
    errs = []; opg.on('pageerror', lambda e: errs.append(str(e)))
    await opg.evaluate("p=>__fbMock.remote(p,{suggestions:{alex_x:{by:'alex'}}})", path); await opg.wait_for_timeout(600)
    ok('malformed suggestion renders without errors', not errs and await opg.get_by_test_id('suggestion').count() == 1, errs)
    # Stop sharing (owner): invite and shared copy are deleted.
    await open_share_menu(opg); await opg.get_by_test_id('stop-sharing').click(); await opg.wait_for_timeout(600)
    dump = await opg.evaluate('__fbMock.dump()')
    ok('Stop sharing deletes the invite and the shared trip', not any(p.startswith('invites/') or p.startswith('trips/') for p in dump), list(dump))
    await ctx.close(); await owner.close()

async def owner_not_now(b):
    ctx, pg = await owner_invite(b, False)
    date = await pg.evaluate('__gonow.state.plan.days[2].date'); await pg.get_by_test_id('db-day-' + date).click()
    await pg.get_by_test_id('day-add-own').click(); await pg.get_by_test_id('add-own-name').fill('Owner edit after invite'); await pg.get_by_test_id('add-own-start').fill('21:00'); await pg.get_by_test_id('add-own-submit').click()
    await pg.wait_for_timeout(800)
    path = await pg.evaluate("Object.keys(__fbMock.dump()).find(p=>p.startsWith('trips/'))")
    await pg.evaluate("p=>__fbMock.remote(p,{votes:{kahala:['alex']},lastChange:{by:'alex',itemId:'kahala'}})", path); await pg.wait_for_timeout(1000)
    local = await pg.evaluate("localStorage.getItem('gonow:trips')")
    ok('owner (sync Not now) keeps the edit in saved trips after a group snapshot', 'Owner edit after invite' in local)
    ok('owner edit pushed to the shared copy without account sync', 'Owner edit after invite' in str(await pg.evaluate('p=>__fbMock.dump()[p]', path)))
    records = await pg.evaluate('__fbMock.dump()')
    await pg.reload(); await pg.wait_for_timeout(800)
    await pg.get_by_test_id('sign-in').click(); await pg.wait_for_function('!!window.__fbMock')
    stale = {k: v for k, v in records.items()}
    for k, v in stale.items():
        if k.startswith('trips/'): v['trip'] = {**v['trip'], 'builder': {'days': {}}}  # an older shared copy
    await pg.evaluate('(r)=>{for(const [p,d] of Object.entries(r))window.__fbMock.seed(p,d)}', stale)
    await pg.get_by_test_id('sign-in-google').click(); await pg.wait_for_timeout(1500)
    if await pg.get_by_test_id('trip-card').count(): await pg.get_by_test_id('trip-card').first.locator('[data-open-trip]').click(); await pg.wait_for_timeout(800)
    await pg.get_by_test_id('db-day-' + date).click()
    ok('owner edit survives reload + stale group snapshot', await pg.get_by_text('Owner edit after invite').count() > 0)
    await ctx.close()

async def undo_scope(b):
    ctx, pg = await new(b, BASE, 390); await checkout_oahu(pg)
    await pg.evaluate("localStorage.setItem('gonow:sync:test','yes')")
    before = await pg.evaluate("JSON.stringify(__gonow.state.plan.days.map(d=>d.items.map(i=>i.id||i.title)))")
    await pg.get_by_test_id('edit-picks').click(); await pg.get_by_test_id('pick-activities').wait_for()
    await pg.evaluate("localStorage.setItem('gonow:invite:test:trip','inv');localStorage.setItem('gonow:sync:test','no');localStorage.setItem('gonow:places:geo:x',JSON.stringify({value:1,until:9e15}))")
    await pg.locator('[data-pick-toggle="waimea"]').click(); await pg.get_by_test_id('pick-next').click(); await pg.get_by_test_id('pick-next').click()
    await expect(pg.get_by_test_id('plan-toast')).to_have_text('Plan updated · Undo'); await pg.get_by_test_id('plan-undo').click(); await pg.wait_for_timeout(500)
    keys = await pg.evaluate("[localStorage.getItem('gonow:invite:test:trip'),localStorage.getItem('gonow:sync:test'),localStorage.getItem('gonow:places:geo:x')]")
    ok('Undo keeps invite, sync and place-cache keys', keys[0] == 'inv' and keys[1] == 'no' and keys[2], keys)
    ok('Undo restores the plan', before == await pg.evaluate("JSON.stringify(__gonow.state.plan.days.map(d=>d.items.map(i=>i.id||i.title)))"))
    await reopen(pg)
    ok('Undo survives reload', before == await pg.evaluate("JSON.stringify(__gonow.state.plan.days.map(d=>d.items.map(i=>i.id||i.title)))"))
    await ctx.close()

async def any_city_reload(b):
    ctx, pg = await new(b, BASE, 390); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await routes(pg, 'seattle'); await enter(pg, 'Seattle')
    await pg.locator('[data-pick-toggle=osm-node-100]').click(); await pg.get_by_test_id('pick-next').click(); await pg.get_by_test_id('pick-next').click()
    await pg.get_by_test_id('confirm-plan').wait_for()
    # Draft reopened after reload: plan view with Draft, Confirm and Edit picks (not the legacy draft editor).
    await reopen(pg)
    ok('reopened draft shows the plan with Edit picks', await pg.get_by_test_id('edit-picks').count() == 1 and await pg.get_by_test_id('confirm-plan').count() == 1 and await pg.get_by_role('button', name='Generate my plan').count() == 0)
    await pg.get_by_test_id('confirm-plan').click(); await pg.wait_for_timeout(500)
    await reopen(pg)
    info = await pg.evaluate("DayBuilder.schedule().days.flatMap(d=>d.items.map(i=>[d.date,i.id,i.title]))")
    t = next(x for x in info if 'Art Museum' in x[2]); await pg.get_by_test_id('db-day-' + t[0]).click()
    row = pg.locator(f'[data-db-zone=day][data-db-id="{t[1]}"]')
    if await row.get_by_test_id('db-more').count(): await row.get_by_test_id('db-more').click()
    await row.get_by_test_id('db-swap').click(); sheet = pg.get_by_test_id('swap-sheet'); await sheet.wait_for()
    ok('any-city Swap after reload offers options', await sheet.get_by_test_id('swap-option').count() >= 1)
    await sheet.locator('[data-close]').click()
    errs.clear(); await pg.get_by_test_id('edit-picks').click(); await pg.wait_for_timeout(1000)
    ok('any-city Edit picks after reload opens picks without errors', await pg.evaluate('__gonow.state.screen') == 'pick-activities' and not errs, errs)
    ok('Edit picks keeps the current pick ticked', await pg.locator('[data-pick-toggle=osm-node-100][aria-pressed=true]').count() == 1)
    # A new session without the stored catalog loads it on demand (Swap shows Loading, then options).
    await pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('gonow:catalog:')).forEach(k=>localStorage.removeItem(k))")
    await pg.get_by_test_id('pick-back').click(); await reopen(pg)
    await pg.get_by_test_id('db-day-' + t[0]).click()
    if await row.get_by_test_id('db-more').count(): await row.get_by_test_id('db-more').click()
    await row.get_by_test_id('db-swap').click(); await pg.wait_for_timeout(2500)
    ok('Swap loads places on demand when nothing is cached', await pg.get_by_test_id('swap-option').count() >= 1)
    await ctx.close()

async def time_edit(b):
    for width in (390, 1280):
        ctx, pg = await new(b, BASE, width); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await checkout_oahu(pg, food=('leonards',))
        info = await pg.evaluate("DayBuilder.schedule().days.flatMap(d=>d.items.map(i=>[d.date,i.id,i.start,i.end,!!i.locked]))")
        leo = next(x for x in info if x[1] == 'leonards'); ok(f'{width} Leonard’s starts 7:00–8:00', leo[2] == 420 and leo[3] == 480, leo)
        await pg.get_by_test_id('db-day-' + leo[0]).click()
        row = pg.locator('[data-db-zone=day][data-db-id="leonards"]'); await row.get_by_test_id('db-time').click()
        form = row.get_by_test_id('activity-time-form')
        ok(f'{width} duration field shows the real length', await form.locator('[name=duration]').input_value() == '60')
        await form.locator('[name=start]').fill('06:00')
        ok(f'{width} Start keeps duration and moves End', await form.locator('[name=end]').input_value() == '07:00')
        await form.locator('[name=end]').fill('08:00')
        ok(f'{width} End updates Duration', await form.locator('[name=duration]').input_value() == '120')
        await form.locator('[name=duration]').fill('90')
        ok(f'{width} Duration updates End', await form.locator('[name=end]').input_value() == '07:30')
        await form.locator('[name=end]').fill('08:00')
        await form.get_by_role('button', name='Save activity time').click()
        if await pg.get_by_test_id('move-conflict').count(): await pg.get_by_test_id('conflict-keep').click()
        await expect(row.get_by_test_id('db-time')).to_contain_text('6:00 AM')
        ok(f'{width} saved card shows 6:00–8:00 AM', re.sub(r'\s', '', await row.get_by_test_id('db-time').text_content()) == '6:00AM–8:00AM', await row.get_by_test_id('db-time').inner_text())
        ok(f'{width} outside opening hours stays put with a heads-up', 'May be closed' in await row.inner_text())
        await reopen(pg); await pg.get_by_test_id('db-day-' + leo[0]).click()
        ok(f'{width} edited time persists after reload', re.sub(r'\s', '', await pg.locator('[data-db-zone=day][data-db-id="leonards"]').get_by_test_id('db-time').text_content()) == '6:00AM–8:00AM')
        # Fully outside opening hours (Leonard's opens 7:00): the hand-set time still survives a reload.
        row = pg.locator('[data-db-zone=day][data-db-id="leonards"]'); await row.get_by_test_id('db-time').click()
        form = row.get_by_test_id('activity-time-form'); await form.locator('[name=start]').fill('05:00'); await form.locator('[name=end]').fill('06:00')
        await form.get_by_role('button', name='Save activity time').click()
        if await pg.get_by_test_id('move-conflict').count(): await pg.get_by_test_id('conflict-keep').click()
        await reopen(pg); await pg.get_by_test_id('db-day-' + leo[0]).click()
        ok(f'{width} closed-hours time persists after reload', re.sub(r'\s', '', await pg.locator('[data-db-zone=day][data-db-id="leonards"]').get_by_test_id('db-time').text_content()) == '5:00AM–6:00AM')
        # Locked booking: edit opens directly, time applies, lock stays.
        lamer = next(x for x in info if x[1] == 'lamer'); await pg.get_by_test_id('db-day-' + lamer[0]).click()
        lrow = pg.locator('[data-db-zone=day][data-db-id="lamer"]'); await lrow.get_by_test_id('db-time').click()
        ok(f'{width} booked item opens the time editor without unlocking', await pg.get_by_test_id('unlock-confirm').count() == 0 and await lrow.get_by_test_id('activity-time-form').count() == 1)
        lform = lrow.get_by_test_id('activity-time-form'); await lform.locator('[name=start]').fill('20:00')
        await lform.get_by_role('button', name='Save activity time').click()
        if await pg.get_by_test_id('move-conflict').count(): await pg.get_by_test_id('conflict-keep').click()
        await expect(lrow.get_by_test_id('db-time')).to_contain_text('8:00 PM')
        ok(f'{width} booked item keeps its lock', await pg.evaluate("DayBuilder.schedule().days.flatMap(d=>d.items).find(i=>i.id==='lamer').locked"))
        ok(f'{width} no page errors in time edits', not errs, errs)
        await ctx.close()

async def plan_header_and_prep(b):
    ctx, pg = await new(b, BASE, 390)
    await checkout_oahu(pg)
    ok('Draft shows the time difference', await pg.get_by_test_id('time-diff').inner_text() == 'Honolulu is 2 hrs behind LA', await pg.get_by_test_id('time-diff').inner_text())
    await continue_prep(pg)
    ok('Confirmed plan shows the time difference', 'Honolulu is 2 hrs behind LA' in await pg.get_by_test_id('time-diff').inner_text())
    if not await pg.get_by_test_id('trip-prep').count(): await pg.get_by_test_id('trip-prep-button').click()
    await pg.get_by_test_id('trip-prep').wait_for()
    prep = await pg.get_by_test_id('trip-prep').inner_text()
    ok('Good to know is gone from Trip prep', await pg.get_by_test_id('good-to-know').count() == 0 and 'Good to know' not in prep and 'We may earn a fee' not in prep)
    ok('no plug adapter for a US trip from LA', 'adapter' not in prep.lower())
    ok('sample La Mer/Senia bookings outside these dates are not flagged', await pg.get_by_test_id('booking-issue').count() == 0)
    text = await pg.evaluate('__gonow.planText()')
    ok('copied flights have no zero-length ranges', not re.search(r'(\d{1,2}:\d{2} [AP]M)–\1', text), text[:300])
    ok('copied flights name the flight home', 'Flight home · ' in text and 'Flight · ' in text and 'undefined' not in text, text[:600])
    await ctx.close()
    # Lisbon (Type C/F) gets an adapter line in What to bring.
    ctx, pg = await new(b, BASE, 390)
    await answer(pg, 'Lisbon'); await pg.get_by_test_id('fork-no').click()
    await pg.get_by_test_id('pick-fallback').or_(pg.get_by_test_id('pick-skip-loading')).first.click()
    await pg.get_by_test_id('confirm-plan').wait_for(timeout=45000)
    ok('Lisbon shows its time difference', 'Lisbon is 8 hrs ahead of LA' == await pg.get_by_test_id('time-diff').inner_text(), await pg.get_by_test_id('time-diff').inner_text())
    await pg.get_by_test_id('confirm-plan').click(); await pg.get_by_test_id('trip-prep').wait_for()
    ok('Lisbon What to bring lists a Type C/F plug adapter', await pg.get_by_test_id('packing-list').get_by_text('Plug adapter (Type C/F)').count() == 1)
    # Unknown home city: no guessed LA difference and no guessed adapter.
    await pg.evaluate("__gonow.state.answers.origin='Lagos';__gonow.go('plan')"); await pg.get_by_test_id('time-diff').wait_for()
    ok('unknown origin shows a neutral time line', await pg.get_by_test_id('time-diff').inner_text() == 'Times shown are local', await pg.get_by_test_id('time-diff').inner_text())
    await pg.evaluate("__gonow.go('prep')"); await pg.get_by_test_id('trip-prep').wait_for()
    ok('unknown origin omits the plug adapter', await pg.get_by_text('Plug adapter (Type C/F)', exact=True).count() == 0)
    # A profile home city (London, Type G) wins over the trip origin.
    await pg.evaluate("localStorage.setItem('gonow:home-city','London');__gonow.go('plan')"); await pg.get_by_test_id('time-diff').wait_for()
    ok('home city London drives the time line', await pg.get_by_test_id('time-diff').inner_text() == 'Lisbon is Same time as London' or await pg.get_by_test_id('time-diff').inner_text() == 'Same time as London', await pg.get_by_test_id('time-diff').inner_text())
    await ctx.close()

async def photo_key_scrub(b):
    ctx, pg = await new(b, BASE, 390)
    await pg.evaluate("""localStorage.setItem('gonow:trips',JSON.stringify([{id:'t1',destination:'Seattle',plan:{id:'seattle-picks-1',days:[{date:'2026-11-25',items:[{id:'g-1',photo:'https://places.googleapis.com/v1/places/abc/photos/p1/media?maxWidthPx=480&key=OLDKEY'}]}]}}]));localStorage.setItem('gonow:places:google:x',JSON.stringify({value:{photo:'https://places.googleapis.com/v1/places/abc/photos/p1/media?maxWidthPx=480&key=OLDKEY'},until:9e15}))""")
    await pg.reload(); await pg.wait_for_timeout(600)
    dump = await pg.evaluate("JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])))")
    ok('saved Google photo URLs lose the key on startup', 'OLDKEY' not in dump and 'gplace:places/abc/photos/p1' in dump, dump[:300])
    await ctx.close()

async def checks(b):
    import os
    only = os.environ.get('ONLY')
    for fn in (photo_key_scrub, cold_invite, returning_member, owner_not_now, undo_scope, any_city_reload, time_edit, plan_header_and_prep):
        if only and fn.__name__ not in only.split(','): continue
        try: await fn(b)
        except Exception as e: ok(fn.__name__ + ' ran', False, repr(e)[:400])
    failed = [n for n, c in RESULTS if not c]
    print(f'SUMMARY pass {len(RESULTS)-len(failed)} fail {len(failed)}')
    assert not failed, failed

asyncio.run(serve_checks(8896, checks))
