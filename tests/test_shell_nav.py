"""☰ menu, in-page Start over and the sign-in nudge (port 8899)."""
import asyncio, os
from playwright.async_api import expect
from test_full import new
from test_wellness_home import serve_checks
from test_accounts import FIXTURES

async def mock_sdk(context):
    async def route_sdk(route):
        await route.fulfill(body=(FIXTURES / route.request.url.rsplit('/', 1)[-1]).read_text(), content_type='text/javascript')
    await context.route('https://www.gstatic.com/firebasejs/10.12.2/*.js', route_sdk)

BASE = 'http://127.0.0.1:8899/index.html'
SHOTS = os.environ.get('SHOTS', '')
RESULTS = []
def ok(name, cond, detail=''):
    RESULTS.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else ' · ' + str(detail)[:300]), flush=True)

async def nav(b):
    for width in (390, 1280):
        ctx, pg = await new(b, BASE, width); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.wait_for_timeout(400)
        t = pg.get_by_test_id('nav-toggle')
        ok(f'{width} ☰ visible top-left', await t.is_visible() and (await t.bounding_box())['x'] < 60, await t.bounding_box())
        ok(f'{width} no header Start over on the first screen', await pg.get_by_test_id('start-over').count() == 0)
        ok(f'{width} no footer Community link (one nav)', await pg.get_by_test_id('community-link').count() == 0)
        ok(f'{width} Photo credits stays a small footer link', await pg.locator('footer [data-testid=photo-credits]').count() == 1 and await pg.get_by_test_id('nav-drawer').locator('text=Photo credits').count() == 0)
        logo = await pg.get_by_test_id('logo').bounding_box(); tb = await t.bounding_box()
        ok(f'{width} ☰ does not overlap the logo', tb['x'] + tb['width'] <= logo['x'], [tb, logo])
        await t.click()
        d = pg.get_by_test_id('nav-drawer')
        await expect(d).to_be_visible(); await pg.wait_for_timeout(300)
        ok(f'{width} aria-expanded true when open', await t.get_attribute('aria-expanded') == 'true')
        ok(f'{width} Home is highlighted on home', await pg.get_by_test_id('nav-home').get_attribute('aria-current') == 'page')
        ok(f'{width} focus moves into the drawer', await pg.evaluate("document.activeElement.closest('#nav-drawer')!==null"))
        for _ in range(5): await pg.keyboard.press('Tab')
        ok(f'{width} focus stays trapped in the drawer', await pg.evaluate("document.activeElement.closest('#nav-drawer')!==null"))
        if SHOTS and width == 390: await pg.screenshot(path=SHOTS + 'nav-drawer-open-390.png')
        if SHOTS and width == 1280: await pg.screenshot(path=SHOTS + 'nav-drawer-open-1280.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        ok(f'{width} Esc closes; aria-expanded false', not await d.is_visible() and await t.get_attribute('aria-expanded') == 'false')
        await t.click(); await pg.get_by_test_id('nav-community').click(); await pg.get_by_test_id('community-page').wait_for()
        ok(f'{width} Community opens from the menu', True)
        await t.click(); await pg.wait_for_timeout(250)
        ok(f'{width} Community is highlighted', await pg.get_by_test_id('nav-community').get_attribute('aria-current') == 'page')
        await pg.mouse.click(width - 10, 400); await pg.wait_for_timeout(250)
        ok(f'{width} tapping the backdrop closes', not await d.is_visible())
        await t.click(); await pg.get_by_test_id('nav-close').click(); await pg.wait_for_timeout(200)
        ok(f'{width} ✕ closes', not await d.is_visible())
        await t.click(); await pg.get_by_test_id('nav-profile').click(); await pg.wait_for_timeout(300)
        ok(f'{width} Profile shows a sign-in prompt for guests', 'sign in' in (await pg.locator('#view').inner_text()).lower())
        await t.click(); await pg.get_by_test_id('nav-home').click(); await pg.get_by_test_id('home-screen').wait_for()
        ok(f'{width} Home returns to the start', True)
        voice = pg.locator('[data-testid*=voice]:visible').first
        ok(f'{width} no page errors', not errs, errs)
        await ctx.close()

async def start_over(b):
    ctx, pg = await new(b, BASE, 390)
    await pg.evaluate("localStorage.setItem('gonow:trips',JSON.stringify([{id:'keep-1',destination:'Kyoto',start:'2026-12-01',end:'2026-12-03',answers:{destination:'Kyoto'}}]))")
    await pg.reload(); await pg.wait_for_timeout(400)
    ok('no Start over on home', await pg.get_by_test_id('start-over').count() == 0)
    await pg.get_by_test_id('back-dashboard').click() if await pg.get_by_test_id('back-dashboard').count() else None
    await pg.evaluate("__gonow.state.answers.destination='Lisbon';__gonow.go('start')"); await pg.wait_for_timeout(200)
    ok('no Start over on the first question page', await pg.get_by_test_id('start-over').count() == 0)
    await pg.evaluate("__gonow.go('budget')"); await pg.wait_for_timeout(200)
    so = pg.get_by_test_id('start-over')
    ok('Start over shows mid-flow', await so.is_visible() and await so.inner_text() == 'Start over')
    await so.click(); c = pg.get_by_test_id('start-over-confirm')
    ok('confirm asks “Clear this trip and start over?”', 'Clear this trip and start over?' in await c.inner_text())
    if SHOTS: await pg.screenshot(path=SHOTS + 'start-over-confirm-390.png')
    await pg.get_by_test_id('start-over-no').click()
    ok('Cancel keeps the page', await pg.evaluate('__gonow.state.screen') == 'budget')
    await so.click(); await pg.get_by_test_id('start-over-yes').click(); await pg.wait_for_timeout(300)
    ok('Start over returns home with answers cleared', await pg.evaluate('__gonow.state.screen') == 'home' and await pg.evaluate('__gonow.state.answers.destination') == '')
    ok('saved trips are never deleted', await pg.evaluate("JSON.parse(localStorage.getItem('gonow:trips')).some(t=>t.id==='keep-1')"))
    await ctx.close()

async def nudge(b):
    # Guest: Not now continues planning with answers.
    ctx, pg = await new(b, BASE, 390, nudge=True); await mock_sdk(ctx); await pg.wait_for_timeout(300)
    if await pg.get_by_test_id('back-dashboard').count() == 0 and await pg.get_by_test_id('home-destination').count() == 0: await pg.evaluate("__gonow.home()")
    await pg.get_by_test_id('home-destination').fill('Lisbon'); await pg.get_by_test_id('start-new-trip').click()
    n = pg.get_by_test_id('signin-nudge'); await expect(n).to_be_visible()
    ok('nudge text', 'Sign in to sync across devices and plan with friends.' in await n.inner_text())
    if SHOTS: await pg.screenshot(path=SHOTS + 'signin-nudge-390.png')
    await pg.get_by_test_id('nudge-not-now').click(); await pg.wait_for_timeout(300)
    ok('Not now continues planning with the destination kept', await pg.evaluate('__gonow.state.screen') == 'start' and await pg.evaluate('__gonow.state.answers.destination') == 'Lisbon', await pg.evaluate('__gonow.state.screen'))
    await pg.evaluate("__gonow.home()"); await pg.wait_for_timeout(200)
    if await pg.get_by_test_id('new-trip').count(): await pg.get_by_test_id('new-trip').click()
    await pg.get_by_test_id('home-destination').fill('Porto'); await pg.get_by_test_id('start-new-trip').click(); await pg.wait_for_timeout(300)
    ok('shown at most once per session', not await n.is_visible() and await pg.evaluate('__gonow.state.screen') == 'start')
    await ctx.close()
    # Guest: Sign in, then planning continues.
    ctx, pg = await new(b, BASE, 390, nudge=True); await mock_sdk(ctx); await pg.wait_for_timeout(300)
    await pg.get_by_test_id('home-destination').fill('Tokyo'); await pg.get_by_test_id('start-new-trip').click()
    await pg.get_by_test_id('nudge-sign-in').click(); await pg.get_by_test_id('sign-in-google').click(); await pg.wait_for_timeout(800)
    if await pg.get_by_test_id('sync-no').count() and await pg.get_by_test_id('sync-no').is_visible(): await pg.get_by_test_id('sync-no').click()
    try: await pg.wait_for_function("__gonow.state.screen==='start'", timeout=6000)
    except Exception: pass
    ok('Sign in continues planning with answers intact', await pg.evaluate('__gonow.state.screen') == 'start' and await pg.evaluate('__gonow.state.answers.destination') == 'Tokyo', [await pg.evaluate('__gonow.state.screen')])
    await ctx.close()
    # Signed in: never nudged.
    ctx, pg = await new(b, BASE, 390, nudge=True); await mock_sdk(ctx); await pg.wait_for_timeout(300)
    await pg.get_by_test_id('sign-in').click(); await pg.get_by_test_id('sign-in-google').click(); await pg.wait_for_timeout(800)
    if await pg.get_by_test_id('sync-no').count() and await pg.get_by_test_id('sync-no').is_visible(): await pg.get_by_test_id('sync-no').click()
    await pg.evaluate("__gonow.home()"); await pg.wait_for_timeout(200)
    if await pg.get_by_test_id('new-trip').count(): await pg.get_by_test_id('new-trip').click()
    await pg.get_by_test_id('home-destination').fill('Austin'); await pg.get_by_test_id('start-new-trip').click(); await pg.wait_for_timeout(300)
    ok('signed-in users are never nudged', not await pg.get_by_test_id('signin-nudge').is_visible() and await pg.evaluate('__gonow.state.screen') == 'start')
    await ctx.close()

async def origin(b):
    # A plan with no starting city (a copied community trip) never assumes LA; it asks in one line.
    for width in (390, 1280):
        ctx, pg = await new(b, BASE, width); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.evaluate("history.replaceState(null,'',location.pathname+'#community')"); await pg.reload(); await pg.get_by_test_id('community-page').wait_for()
        await pg.get_by_test_id('community-tab-trip').click(); await pg.get_by_test_id('community-card').first.click()
        await pg.get_by_test_id('community-copy').click(); await pg.get_by_test_id('copy-date-confirm').click()
        await pg.get_by_test_id('confirm-plan').wait_for(timeout=20000)
        body = await pg.locator('#view').inner_text()
        ok(f'{width} empty origin: no LA default anywhere', ' LA' not in body and 'Los Angeles' not in body)
        ok(f'{width} empty origin: one-line ask shown', await pg.get_by_test_id('origin-ask').is_visible())
        if SHOTS: await pg.get_by_test_id('origin-ask').screenshot(path=f'{SHOTS}/origin-ask-{width}.png')
        await pg.get_by_test_id('origin-ask-input').fill('Seattle'); await pg.get_by_test_id('origin-ask-input').press('Enter'); await pg.wait_for_timeout(400)
        ok(f'{width} saving the city hides the ask and labels the time difference', await pg.get_by_test_id('origin-ask').count() == 0 and 'Seattle' in await pg.get_by_test_id('time-diff').inner_text(), await pg.get_by_test_id('time-diff').inner_text())
        trips = await pg.evaluate("JSON.parse(localStorage.getItem('gonow:trips'))")
        ok(f'{width} origin saved on the trip', trips[0]['answers'].get('origin') == 'Seattle')
        await pg.reload(); await pg.wait_for_timeout(500)
        ok(f'{width} no page errors (origin)', not errs, errs)
        await ctx.close()

async def checks(b):
    only = os.environ.get('ONLY')
    for fn in (nav, start_over, nudge, origin):
        if only and fn.__name__ not in only.split(','): continue
        try: await fn(b)
        except Exception as e: ok(fn.__name__ + ' ran', False, repr(e)[:400])
    failed = [n for n, c in RESULTS if not c]
    print(f'SUMMARY pass {len(RESULTS)-len(failed)} fail {len(failed)}')
    assert not failed, failed

if __name__=="__main__": asyncio.run(serve_checks(8899, checks))
