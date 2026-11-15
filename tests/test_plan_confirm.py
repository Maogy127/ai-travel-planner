"""Plan first, then confirm; supervisor Chromium checks, port 8850."""
import asyncio
from playwright.async_api import expect
from test_full import new
from test_wellness_home import serve_checks

BASE = 'http://127.0.0.1:8850/index.html'

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        errors = []
        pg.on('pageerror', lambda error: errors.append(str(error)))
        try:
            await expect(pg.get_by_test_id('home-screen')).to_be_visible()
            await expect(pg.get_by_test_id('trip-prep')).to_have_count(0)
            await pg.get_by_test_id('demo-oahu').click()
            await expect(pg.get_by_test_id('confirm-plan')).to_be_visible()
            assert 'YOUR NEXT CHAPTER, ALL PLANNED' not in await pg.locator('.plan-title').inner_text()
            assert 'Confirm to start prep.' not in await pg.locator('.plan-title').inner_text()
            assert await pg.locator('.draft-confirm-row').evaluate('e=>{const [badge,button]=e.children;const a=badge.getBoundingClientRect(),b=button.getBoundingClientRect();return Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2)<2}')
            assert await pg.evaluate("window.__gonow.state.screen") == 'plan'
            await expect(pg.get_by_test_id('trip-prep')).to_have_count(0)
            await expect(pg.get_by_test_id('trip-prep-button')).to_have_count(0)
            trip = await pg.evaluate("JSON.parse(localStorage.getItem('gonow:trips'))[0]")
            assert not trip.get('snapshot')
            await pg.locator('.logo').click()
            await expect(pg.get_by_test_id('trip-status')).to_have_text('Draft')
            await expect(pg.get_by_test_id('card-trip-prep')).to_have_count(0)
            # Resume the existing draft editor and retain its Generate path.
            await pg.get_by_test_id('trip-card').locator('[data-trip-more]').click()
            await pg.get_by_test_id('edit-draft').click()
            await pg.get_by_test_id('generate-plan').click()
            await expect(pg.get_by_test_id('trip-prep-button')).to_be_visible()
            await pg.locator('.logo').click()
            await pg.get_by_test_id('new-trip').click()
            # Real questions -> plan (use the same deterministic answers as other suites).
            await pg.get_by_test_id('demo-oahu').click()
            await pg.evaluate("window.__gonow.go('fork')")
            await pg.get_by_test_id('fork-no').click()
            await expect(pg.get_by_test_id('confirm-plan')).to_be_visible()
            assert await pg.evaluate("window.__gonow.state.screen") == 'plan'
            await expect(pg.get_by_test_id('trip-prep')).to_have_count(0)
            await expect(pg.get_by_test_id('trip-prep-button')).to_have_count(0)
            await pg.evaluate("history.pushState({screen:'prep'},'', '#prep');dispatchEvent(new PopStateEvent('popstate',{state:{screen:'prep'}}))")
            await expect(pg.get_by_test_id('confirm-plan')).to_be_visible()
            await pg.get_by_test_id('confirm-plan').click()
            await expect(pg.get_by_test_id('trip-prep')).to_be_visible()
            await expect(pg.get_by_test_id('trip-prep').locator('h1')).to_be_focused()
            saved = await pg.evaluate("JSON.parse(localStorage.getItem('gonow:trips')).find(t=>t.id===window.__gonow.state.tripId)")
            assert saved['confirmed'] and all(k in saved['snapshot'] for k in ('builder','edits','packed','at','weather'))
            assert await pg.evaluate("JSON.parse(localStorage.getItem('gonow.prep.v1'))[window.__gonow.state.tripId].seen")
            await pg.get_by_test_id('prep-continue').click()
            await expect(pg.get_by_test_id('confirm-plan')).to_have_count(0)
            await expect(pg.get_by_test_id('trip-prep-button')).to_have_text('Trip prep · 7 left')
            await pg.locator('.logo').click()
            card = pg.get_by_test_id('trip-card').filter(has=pg.locator('[data-trip="'+saved['id']+'"][data-testid=card-trip-prep]'))
            assert await card.get_by_test_id('trip-status').inner_text() != 'Draft'
            await card.get_by_test_id('card-trip-prep').click()
            await expect(pg.get_by_test_id('trip-prep')).to_be_visible()
            print('PASS plan first, confirmation snapshot, focus, draft generation and dashboard prep', width)
            cases = [
                ({}, 'home-screen'),
                ({'gonow:trips':'{bad json','gonow:screen':'prep'}, 'home-screen'),
                ({'wayfare:answers':'{"destination":"Oahu"}', 'wayfare:lastTrip':'{"id":"oahu-demo-2026-11"}', 'wayfare:screen':'plan'}, 'dashboard'),
                ({'gonow:lastTrip':'{"id":"oahu-demo-2026-11"}', 'gonow:trips':'[null,{}, {"id":"legacy","snapshot":{}},{"id":"draft"}]'}, 'dashboard'),
            ]
            for storage, landing in cases:
                await pg.evaluate('(items)=>{localStorage.clear();for(const [k,v] of Object.entries(items))localStorage.setItem(k,v)}', storage)
                await pg.goto('about:blank')
                await pg.goto(BASE+'?fast=1#prep')
                await expect(pg.get_by_test_id(landing)).to_be_visible()
                await expect(pg.get_by_test_id('trip-prep')).to_have_count(0)
                await expect(pg.get_by_test_id('confirm-plan')).to_have_count(0)
                if 'legacy' in storage.get('gonow:trips',''):
                    assert await pg.get_by_test_id('trip-status').all_text_contents() == ['Ready','Draft']
            assert not errors, errors
            print('PASS fresh and legacy load safety, malformed storage, missing fields, #prep, no page errors', width)
        except Exception:
            print('FAIL plan confirmation', width)
            raise
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8850, checks))
