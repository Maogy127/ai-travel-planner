"""Supervisor Chromium stay flow, port 8844; actual UI toggles and save."""
from test_full import open_home_flow, open_more
from test_full import reopen_dashboard
from test_full import wait_plan, open_day_pace, open_guidance, open_add_menu
import asyncio
from playwright.async_api import expect
from test_full import new, through_picks
from test_wellness_home import serve_checks

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8844/index.html', width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            from test_full import continue_prep
            await continue_prep(pg)
            await wait_plan(pg)
            await pg.evaluate("window.__gonow.go('musts')")
            field = pg.get_by_test_id('stay')
            await pg.get_by_test_id('stay-unsure').click()
            await expect(field).to_be_disabled()
            print('PASS test_stay.py check line 21')
            await expect(field).to_have_value('')
            print('PASS test_stay.py check line 23')
            await pg.get_by_test_id('stay-unsure').click()
            await expect(field).to_be_enabled()
            print('PASS test_stay.py check line 26')
            await expect(field).to_be_focused()
            print('PASS test_stay.py check line 28')
            await pg.get_by_test_id('stay-unsure').click()
            # Personalized template avoids the curated sample's booked hotel.
            await pg.evaluate('window.__gonow.state.answers.templateOahu=true')
            await pg.get_by_test_id('q-continue').click()
            # Stay answers now lead through activities and restaurants to the draft.
            await through_picks(pg)
            await expect(pg.get_by_test_id('confirm-plan')).to_be_visible()
            await pg.get_by_test_id('trip-add-hotel').wait_for(state='attached', timeout=45000)
            await expect(pg.get_by_test_id('stay-later-note')).to_contain_text('Waikiki')
            print('PASS test_stay.py check line 35')
            header = await pg.locator('.plan-header').inner_text()
            assert 'Kahala' not in header and 'Resort' not in header
            print('PASS test_stay.py check line 38')
            before = await pg.locator('[data-testid=travel-chip]').all_text_contents()
            await open_more(pg); await pg.get_by_test_id('trip-add-hotel').click()
            await pg.get_by_test_id('trip-hotel-name').fill('My booked place')
            await pg.get_by_test_id('trip-hotel-save').click()
            await expect(pg.get_by_test_id('stay-later-note')).to_have_count(0)
            print('PASS test_stay.py check line 44')
            await expect(pg.locator('.plan-header')).to_contain_text('My booked place')
            print('PASS test_stay.py check line 46')
            after = await pg.locator('[data-testid=travel-chip]').all_text_contents()
            assert before != after
            print('PASS test_stay.py check line 49')
            await pg.reload()
            await reopen_dashboard(pg)
            await wait_plan(pg)
            assert await pg.evaluate('window.__gonow.state.answers.stay') == 'My booked place'
            print('PASS test_stay.py check line 54')
            assert not await pg.evaluate('window.__gonow.state.answers.stayUnsure')
            print('PASS test_stay.py check line 56')
            await pg.get_by_test_id('logo').click()
            await open_home_flow(pg)
            await pg.locator('[data-testid=mode-option][data-value=local]').click()
            await pg.get_by_test_id('local-city').fill('Honolulu')
            await pg.get_by_test_id('local-start').click()
            for _ in range(3):
                await pg.get_by_test_id('q-skip').click()
            await expect(pg.get_by_test_id('local-plan')).to_be_visible()
            print('PASS test_stay.py check line 65')
            for tid in ('jetlag-note', 'stay-unsure', 'trip-add-hotel'):
                await expect(pg.get_by_test_id(tid)).to_have_count(0)
                print('PASS test_stay.py check line 68')
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8844, checks))
