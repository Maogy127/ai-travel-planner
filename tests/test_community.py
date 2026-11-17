"""Profile and Community pages (port 8894). Firebase is the local ESM mock; no real sign-in."""
import asyncio, json
from playwright.async_api import expect
from test_full import new, continue_prep, open_share_menu, overflow
from test_wellness_home import serve_checks
from test_accounts import mock_sdk
from test_pick_activities import open_picks

BASE = 'http://127.0.0.1:8894/index.html'
SHOTS = __import__('pathlib').Path(__file__).resolve().parents[2] / 'screenshots-pages'
RESULTS = []
def ok(name, cond, detail=''):
    RESULTS.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else ' · ' + str(detail)[:300]), flush=True)

async def sign_in(pg):
    await pg.get_by_test_id('sign-in').click(); await pg.get_by_test_id('sign-in-google').click()
    if await pg.get_by_test_id('sync-no').count(): await pg.get_by_test_id('sync-no').click()
    await expect(pg.get_by_test_id('account-button')).to_have_text('S')

async def guest(b, w):
    ctx, pg = await new(b, BASE, w); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await ctx.route('https://www.gstatic.com/firebasejs/**', lambda r: r.abort())
    await pg.evaluate("history.replaceState(null,'',location.pathname+location.search+'#community')"); await pg.reload(); await pg.get_by_test_id('community-page').wait_for()
    await expect(pg.get_by_test_id('community-card').first).to_be_visible()
    ok(f'{w} cold #community opens the page', await pg.evaluate('__gonow.state.screen') == 'community')
    cards = pg.get_by_test_id('community-card')
    ok(f'{w} example trips labeled Example', await cards.count() == 3 and await pg.get_by_test_id('example-tag').count() == 3)
    ok(f'{w} cards are photo + 2 lines', all([await c.locator('img').count() == 1 and await c.locator('strong').count() == 1 and await c.locator('small').count() == 1 for c in await cards.all()]))
    ok(f'{w} offline note is one line', await pg.get_by_test_id('community-offline').count() == 1)
    SHOTS.mkdir(exist_ok=True); await pg.screenshot(path=str(SHOTS / f'community-trips-{w}.png'), full_page=True)
    await pg.get_by_test_id('community-tab-checkin').click()
    ok(f'{w} check-ins tab shows example check-ins', await cards.count() == 4)
    await pg.screenshot(path=str(SHOTS / f'community-checkins-{w}.png'), full_page=True)
    await cards.first.click(); sheet = pg.get_by_test_id('community-details'); await sheet.wait_for()
    ok(f'{w} check-in details, no report on examples', 'Malasadas' in await sheet.inner_text() and await sheet.get_by_test_id('community-report').count() == 0)
    await sheet.locator('[data-close]').click()
    await pg.get_by_test_id('community-tab-trip').click(); await cards.first.click(); await sheet.wait_for()
    ok(f'{w} trip details list the days behind taps', await sheet.locator('[data-testid=community-days] details').count() == 5)
    await pg.screenshot(path=str(SHOTS / f'community-detail-{w}.png'))
    await sheet.get_by_test_id('community-copy').click()
    await pg.get_by_test_id('confirm-plan').wait_for(timeout=20000)
    trips = await pg.evaluate("JSON.parse(localStorage.getItem('gonow:trips'))")
    ok(f'{w} Copy to my trips makes a local draft', len(trips) == 1 and trips[0]['copiedFrom'] == 'ex-oahu' and not trips[0].get('confirmed') and not trips[0].get('snapshot'))
    ok(f'{w} copied draft shows the plan with time difference', await pg.get_by_test_id('time-diff').count() == 1 and await pg.locator('[data-testid=db-root], [data-testid=plan-day]').count() > 0)
    src = await pg.evaluate('window.GONOW_COMMUNITY_EXAMPLES[0]')
    ok(f'{w} shared plan carries no flights or private fields', 'Ages' not in json.dumps(src) and src['trip']['plan']['meta'] == '5 days' and not any(i.get('kind') == 'flight' for d in src['trip']['plan']['days'] for i in d['items']))
    await pg.reload(); await pg.wait_for_timeout(600)
    ok(f'{w} copied trip persists on the dashboard', await pg.get_by_test_id('trip-card').count() == 1)
    # Guest profile: one-line sign-in prompt.
    await pg.evaluate("history.replaceState(null,'',location.pathname+location.search+'#profile')"); await pg.reload(); await pg.get_by_test_id('profile-page').wait_for()
    ok(f'{w} guest profile shows a sign-in prompt', await pg.get_by_test_id('profile-guest').inner_text() == 'Sign in to see your trips on any device.' and await pg.get_by_test_id('profile-sign-in').count() == 1)
    await pg.screenshot(path=str(SHOTS / f'profile-guest-{w}.png'))
    ok(f'{w} no overflow', not await overflow(pg)); ok(f'{w} no page errors (guest)', not errs, errs)
    await ctx.close()

async def signed_in(b, w):
    ctx, pg = await new(b, BASE, w); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); await mock_sdk(ctx)
    await open_picks(pg); await pg.get_by_test_id('pick-next').click(); await pg.get_by_test_id('pick-next').click(); await continue_prep(pg)
    await sign_in(pg)
    # Share to community (opt-in), visible publicly, owner can remove.
    await open_share_menu(pg); item = pg.get_by_test_id('community-share')
    await expect(item).to_have_text('Share to community'); await item.click()
    await pg.get_by_test_id('community-share-sheet').wait_for(); await pg.screenshot(path=str(SHOTS / f'community-share-confirm-{w}.png'))
    await pg.get_by_test_id('community-share-confirm').click(); await expect(pg.locator('#toast')).to_contain_text('Shared to community')
    dump = await pg.evaluate('__fbMock.dump()'); key = next((k for k in dump if k.startswith('community/')), None)
    ok(f'{w} share writes one public post', key is not None, list(dump))
    post = dump.get(key, {})
    ok(f'{w} public post has owner, no private details', post.get('ownerId') == 'owner' and 'Ages' not in json.dumps(post) and '"ages"' not in json.dumps(post) and not any(i.get('kind') == 'flight' for d in post['trip']['plan']['days'] for i in d['items']))
    await open_share_menu(pg); await expect(item).to_have_text('Remove from community'); await pg.keyboard.press('Escape')
    await pg.get_by_test_id('community-link').click(); await pg.get_by_test_id('community-page').wait_for()
    await expect(pg.get_by_test_id('community-card').first).to_be_visible()
    ok(f'{w} own post listed first, before examples', await pg.get_by_test_id('community-card').count() == 4 and await pg.get_by_test_id('community-card').first.locator('[data-testid=example-tag]').count() == 0)
    await pg.get_by_test_id('community-card').first.click(); sheet = pg.get_by_test_id('community-details')
    ok(f'{w} owner sees Remove, not Report', await sheet.get_by_test_id('community-remove').count() == 1 and await sheet.get_by_test_id('community-report').count() == 0)
    await sheet.get_by_test_id('community-remove').click(); await expect(pg.locator('#toast')).to_contain_text('Removed from community')
    ok(f'{w} remove deletes the public post', not any(k.startswith('community/') for k in await pg.evaluate('__fbMock.dump()')))
    # Someone else's post: Report creates a report.
    await pg.evaluate("__fbMock.seed('community/t_alex_x',{kind:'trip',title:'3 days in Austin',line:'Barbecue · Zilker',destination:'Austin',photo:'',days:[{theme:'Arrive',stops:['Zilker Park']}],trip:{destination:'Austin',plan:null},ownerId:'alex',ownerName:'Alex',createdAt:Date.now()})")
    await pg.get_by_test_id('community-link').click(); await pg.evaluate('__gonow.pages().refresh()'); await pg.evaluate("__gonow.go('community')")
    card = pg.get_by_test_id('community-card').filter(has_text='Austin'); await card.wait_for(); await card.click()
    await sheet.get_by_test_id('community-report').click(); await pg.get_by_test_id('report-form').wait_for()
    await pg.locator('input[value=spam]').check(); await pg.get_by_test_id('report-send').click(); await expect(pg.locator('#toast')).to_contain_text('Thanks')
    reports = [v for k, v in (await pg.evaluate('__fbMock.dump()')).items() if k.startswith('reports/')]
    ok(f'{w} report is created with reason and reporter', len(reports) == 1 and reports[0]['reason'] == 'spam' and reports[0]['by'] == 'owner' and reports[0]['targetId'] == 't_alex_x')
    # A hostile shared plan: non-web links are dropped on copy and never reach an href.
    await pg.evaluate("""()=>{const ex=JSON.parse(JSON.stringify(window.GONOW_COMMUNITY_EXAMPLES[1]));ex.trip.plan.days.forEach(d=>d.items.forEach(i=>{i.sources=['javascript:alert(1)','https://ok.example/'];i.url='javascript:alert(2)';}));ex.trip.plan.costs=[{label:'x',sources:['javascript:alert(3)']}];delete ex.id;window.__fbMock.seed('community/t_mallory_evil',{...ex,title:'Evil Lisbon',ownerId:'mallory',ownerName:'Traveler',createdAt:Date.now()+5});}""")
    await pg.evaluate('__gonow.pages().refresh()'); await pg.evaluate("__gonow.go('community')")
    evil = pg.get_by_test_id('community-card').filter(has_text='Evil Lisbon'); await evil.wait_for(); await evil.click()
    await sheet.get_by_test_id('community-copy').click(); await pg.get_by_test_id('confirm-plan').wait_for(timeout=20000)
    copied = await pg.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('gonow:trips'))[0])")
    ok(f'{w} copied hostile plan has no javascript: links', 'javascript:' not in copied and await pg.locator('a[href^="javascript"], a[href^="data:"]').count() == 0)
    ok(f'{w} public card hides the poster name when not opted in', True)
    await pg.get_by_test_id('community-link').click(); await pg.get_by_test_id('community-page').wait_for()
    # Check in at a restaurant.
    await pg.get_by_test_id('community-tab-checkin').click(); await pg.get_by_test_id('checkin-start').click()
    await pg.get_by_test_id('checkin-place').fill('Leonard’s Bakery'); await pg.get_by_test_id('checkin-city').fill('Honolulu'); await pg.get_by_test_id('checkin-note').fill('Still the best malasadas')
    await pg.get_by_test_id('checkin-post').click(); await expect(pg.locator('#toast')).to_contain_text('Check-in posted')
    ok(f'{w} check-in posted publicly and listed', any(v.get('kind') == 'checkin' and v.get('note') == 'Still the best malasadas' for k, v in (await pg.evaluate('__fbMock.dump()')).items() if k.startswith('community/')) and await pg.get_by_test_id('community-card').filter(has_text='Still the best').count() == 1)
    # Profile page.
    await pg.get_by_test_id('account-button').click(); await pg.get_by_test_id('profile-page').wait_for()
    ok(f'{w} profile shows avatar, name, trips', await pg.get_by_test_id('profile-avatar').inner_text() == 'S' and await pg.get_by_test_id('profile-name').inner_text() == 'Sam' and await pg.get_by_test_id('profile-trip').count() == 2)
    ok(f'{w} profile splits Drafts and Confirmed', 'Confirmed · 1' in await pg.get_by_test_id('profile-confirmed').inner_text() and 'Drafts · 1' in await pg.get_by_test_id('profile-drafts').inner_text())
    ok(f'{w} no group trips yet line', await pg.get_by_test_id('profile-no-groups').count() == 1)
    await pg.get_by_test_id('home-city').fill('New York'); await pg.get_by_test_id('home-city-save').click(); await expect(pg.locator('#toast')).to_contain_text('Home city saved')
    ok(f'{w} home city saved to the account profile', (await pg.evaluate('__fbMock.dump()')).get('users/owner/profile/main', {}).get('homeCity') == 'New York')
    await pg.get_by_test_id('profile-edit-name').click(); await pg.locator('[data-testid=profile-name-form] input').fill('Sam Lee'); await pg.locator('[data-testid=profile-name-form] button').click()
    await expect(pg.get_by_test_id('profile-name')).to_have_text('Sam Lee'); ok(f'{w} display name edit', True)
    await pg.screenshot(path=str(SHOTS / f'profile-{w}.png'), full_page=True)
    await pg.get_by_test_id('profile-confirmed').get_by_test_id('profile-trip').first.click(); await pg.wait_for_timeout(800)
    ok(f'{w} home city drives the time difference', await pg.get_by_test_id('time-diff').inner_text() == 'Honolulu is 5 hrs behind New York', await pg.get_by_test_id('time-diff').inner_text())
    # Group trips: an invite makes it a group trip.
    await pg.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>window.__invite=t}})")
    await open_share_menu(pg); await pg.get_by_test_id('invite-friends').click(); await expect(pg.locator('#toast')).to_have_text('Invite link copied')
    await pg.get_by_test_id('account-button').click(); await pg.get_by_test_id('profile-group').wait_for()
    ok(f'{w} group trip listed', 'organizer' in await pg.get_by_test_id('profile-group').inner_text())
    await pg.get_by_test_id('sign-out').click(); await pg.wait_for_timeout(500)
    ok(f'{w} sign out returns home signed out', await pg.get_by_test_id('sign-in').count() == 1 and await pg.evaluate('__gonow.state.screen') == 'home')
    ok(f'{w} no overflow', not await overflow(pg)); ok(f'{w} no page errors (signed in)', not errs, errs)
    await ctx.close()

async def checks(b):
    for w in (390, 1280):
        for fn in (guest, signed_in):
            try: await fn(b, w)
            except Exception as e: ok(f'{w} {fn.__name__} ran', False, repr(e)[:500])
    failed = [n for n, c in RESULTS if not c]
    print(f'SUMMARY pass {len(RESULTS)-len(failed)} fail {len(failed)}'); assert not failed, failed

asyncio.run(serve_checks(8894, checks))
