"""Item I: all Firebase traffic is blocked or served from local ESM mocks; port 8879."""
import asyncio
from pathlib import Path
from playwright.async_api import expect
from test_full import new, continue_prep, open_share_menu, overflow
from test_wellness_home import serve_checks
from test_pick_activities import open_picks

BASE = 'http://127.0.0.1:8879/index.html'
FIXTURES = Path(__file__).parent / 'fixtures' / 'firebase-mock'

async def mock_sdk(context):
    async def route_sdk(route):
        filename = route.request.url.rsplit('/', 1)[-1]
        await route.fulfill(body=(FIXTURES / filename).read_text(), content_type='text/javascript')
    await context.route('https://www.gstatic.com/firebasejs/10.12.2/*.js', route_sdk)

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        try:
            await ctx.route('https://www.gstatic.com/firebasejs/**', lambda route: route.abort())
            # A failed remembered-session load must not open a guest modal.
            await pg.evaluate("localStorage.setItem('gonow:account-session','yes')")
            await pg.reload()
            await expect(pg.get_by_test_id('sign-in-sheet')).not_to_be_visible()
            await pg.get_by_test_id('sign-in').click()
            await expect(pg.get_by_test_id('sign-in-sheet')).to_contain_text('Sign-in isn’t available right now')
            await pg.get_by_role('button', name='Close', exact=True).click()
            await pg.get_by_test_id('demo-oahu').click()
            await continue_prep(pg)
            assert not await overflow(pg)
            print(f'PASS accounts blocked SDK guest planning {width}')
        finally:
            await ctx.close()
        ctx, pg = await new(browser, BASE, width)
        member_ctx = None
        try:
            await mock_sdk(ctx)
            await open_picks(pg)
            await pg.get_by_test_id('pick-next').click()
            await pg.get_by_test_id('pick-next').click()
            await continue_prep(pg)
            await expect(pg.locator('.plan-title .share-controls [data-testid=sign-in]')).to_have_count(1)
            await expect(pg.get_by_test_id('sign-in')).to_have_count(1)
            await pg.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__invite=text}})")
            await pg.get_by_test_id('sign-in').click()
            await expect(pg.get_by_test_id('sign-in-sheet')).to_be_visible()
            await pg.get_by_test_id('sign-in-google').click()
            await expect(pg.get_by_test_id('sync-yes')).to_be_visible()
            await pg.get_by_test_id('sync-yes').click()
            await expect(pg.get_by_test_id('account-button')).to_have_text('S')
            assert await pg.evaluate("Object.keys(window.__fbMock.dump()).some(p=>p.startsWith('users/owner/trips/'))")
            await open_share_menu(pg)
            await pg.get_by_test_id('invite-friends').click()
            await expect(pg.locator('#toast')).to_have_text('Invite link copied')
            link = await pg.evaluate('window.__invite')
            assert '#join=' in link
            records = await pg.evaluate('window.__fbMock.dump()')
            trip_path = next(p for p in records if p.startswith('trips/'))
            # The second browser context has a separate in-memory identity and store.
            # Seed documents and explicitly relay snapshots, as an emulator would.
            member_ctx, member = await new(browser, BASE, width)
            await mock_sdk(member_ctx)
            await member.get_by_test_id('sign-in').click()
            await member.wait_for_function('!!window.__fbMock')
            await member.evaluate('(records)=>{for(const [p,d] of Object.entries(records))window.__fbMock.seed(p,d)}', records)
            await member.get_by_role('button', name='Close', exact=True).click()
            await member.evaluate('(link)=>location.hash=new URL(link).hash', link)
            await member.get_by_test_id('join-name').fill('Alex')
            await member.get_by_test_id('join-anon').click()
            await expect(member.get_by_test_id('account-button')).to_have_text('A')
            await member.wait_for_function('window.goNowAccount.group !== null')
            assert await member.evaluate('window.goNowAccount.group.memberIds.includes(window.goNowAccount.user.uid)')
            assert await member.evaluate('window.goNowAccount.group.members[window.goNowAccount.user.uid].name === "Alex"')
            assert await member.evaluate('window.__fbMock.state.calls.filter(c=>c[0]==="update" && c[2].joinInvite).length === 1')
            await pg.evaluate('(p)=>window.__fbMock.simulateAlex(p)', trip_path)
            await expect(pg.locator('#toast')).to_have_text('Alex added Kualoa')
            # Vote through the visible card, then exercise a real locked dinner row.
            await pg.evaluate("()=>{window.__gonow.state.answers.picks=window.__gonow.state.answers.picks||{activities:[],restaurants:[]};window.__gonow.go('pick-activities')}")
            await pg.locator('[data-pick-toggle=kualoa]').click()
            await expect(pg.locator('[data-pick-id=kualoa] [data-testid=pick-votes]')).to_have_text('S')
            await pg.evaluate("window.__gonow.go('plan')")
            await pg.get_by_test_id('db-day-2026-11-26').click()
            dinner = pg.locator('[data-testid=db-day-list] [data-db-id=lamer]')
            # Booked before invite: no owner toggle is needed to protect La Mer.
            await pg.wait_for_function("window.goNowAccount.group.locks.lamer === true")
            # Compare content without layout whitespace; inner_text inserts line breaks at 390px.
            original_time = ''.join((await dinner.get_by_test_id('db-time').text_content()).split())
            group = await pg.evaluate('(p)=>window.__fbMock.dump()[p]', trip_path)
            # Preserve membership added in the second context when relaying owner state.
            await member.evaluate('([p,d])=>{d.memberIds=window.goNowAccount.group.memberIds;d.members=window.goNowAccount.group.members;window.__fbMock.remote(p,d)}', [trip_path, group])
            await member.get_by_test_id('db-day-2026-11-26').click()
            member_dinner = member.locator('[data-testid=db-day-list] [data-db-id=lamer]')
            await expect(member_dinner.locator('[data-db-action=lock]')).to_be_hidden()
            await member_dinner.get_by_test_id('db-time').click()
            suggestion_sheet = member.get_by_test_id('group-time-suggestion')
            await suggestion_sheet.locator('input').fill('19:00')
            await suggestion_sheet.get_by_role('button', name='Send suggestion').click()
            await expect(member.locator('#toast')).to_have_text('Sent to Sam for OK')
            assert ''.join((await member_dinner.get_by_test_id('db-time').text_content()).split()) == original_time
            await member.wait_for_function('Object.keys(window.goNowAccount.group.suggestions).length === 1')
            member_group = await member.evaluate('(p)=>window.__fbMock.dump()[p]', trip_path)
            await pg.evaluate('([p,d])=>window.__fbMock.remote(p,d)', [trip_path, member_group])
            await expect(pg.get_by_test_id('suggestion')).to_contain_text('Alex suggests 7:00 PM for')
            await pg.get_by_test_id('suggestion-approve').click()
            await expect(pg.get_by_test_id('suggestion')).to_have_count(0)
            assert await pg.evaluate("window.goNowAccount.group.planContent.lamer.time === '7:00 PM'")
            # exportState is compact share data; schedule exposes dated days and resolved item times.
            assert await pg.evaluate("""() => {
                const dinner = DayBuilder.schedule().days.find(d => d.date === '2026-11-26').items.find(i => i.id === 'lamer');
                return dinner.start === 1140 && dinner.preferred === 1140 && dinner.locked && dinner.booked;
            }""")
            await expect(dinner.get_by_test_id('db-time')).to_contain_text('7:00 PM')
            # Compare owner/member content after approval with the same whitespace handling.
            approved_time = ''.join((await dinner.get_by_test_id('db-time').text_content()).split())
            approved = await pg.evaluate('(p)=>window.__fbMock.dump()[p]', trip_path)
            await member.evaluate('([p,d])=>window.__fbMock.remote(p,d)', [trip_path, approved])
            await expect(member_dinner.get_by_test_id('db-time')).to_contain_text('7:00 PM')
            # Accepted edits must reach the member's runtime schedule without unbooking dinner.
            assert await member.evaluate("""() => {
                const dinner = DayBuilder.schedule().days.find(d => d.date === '2026-11-26').items.find(i => i.id === 'lamer');
                return dinner.start === 1140 && dinner.preferred === 1140 && dinner.locked && dinner.booked;
            }""")
            assert ''.join((await member_dinner.get_by_test_id('db-time').text_content()).split()) == approved_time
            assert not await overflow(pg)
            print(f'PASS accounts sign-in, invite, name join, UI vote and booked La Mer approval {width}')
        finally:
            if member_ctx:
                await member_ctx.close()
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8879, checks))
