"""Supervisor Chromium end-to-end topic uniqueness, port 8841."""
from test_full import open_home_flow
import asyncio
import re
from playwright.async_api import expect
from test_full import new
from test_wellness_home import serve_checks
BASE = 'http://127.0.0.1:8841/index.html'
async def checks(browser):
    for width in (1280, 390):
        for mode in ('trip', 'local'):
            ctx, pg = await new(browser, BASE, width)
            try:
                await pg.locator(f'[data-testid=mode-option][data-value={mode}]').click()
                topics = []
                async def collect():
                    topics.extend(await pg.locator('[data-topic]').evaluate_all('(els)=>els.filter(e=>e.checkVisibility()).map(e=>e.dataset.topic)'))
                await collect()
                await pg.locator('[data-testid=pace-option][data-value=active]').check()
                await pg.locator('[data-testid=activity-chip][data-value=hiking]').click()
                if mode == 'local':
                    await pg.get_by_test_id('local-city').fill('Austin')
                    await pg.get_by_test_id('local-start').click()
                    pages = ['style', 'food', 'pace']
                else:
                    await pg.get_by_test_id('home-destination').fill('Oahu')
                    await pg.get_by_test_id('start-new-trip').click()
                    await collect()
                    assert await pg.get_by_test_id('pace-option').count() == 0
                    assert await pg.get_by_test_id('start-to').count() == 0
                    await pg.get_by_test_id('start-from').fill('Seattle')
                    await pg.get_by_test_id('start-next').click()
                    pages = ['dates', 'budget', 'who', 'ages', 'style', 'food', 'pace', 'musts']
                for index, page in enumerate(pages):
                    assert await pg.evaluate('__gonow.state.screen') == page
                    await collect()
                    await expect(pg.locator('.question > p').first).to_have_text(f'Step {index+1} of {len(pages)}')
                    await expect(pg.get_by_role('progressbar')).to_have_attribute('aria-valuemax', str(len(pages)))
                    await expect(pg.get_by_role('progressbar')).to_have_attribute('aria-label', f'Step {index+1} of {len(pages)}')
                    assert await pg.locator('.page-number, .passport, .pinned').count() == 0
                    assert await pg.get_by_test_id('pace-option').count() == 0
                    if page == 'pace':
                        await expect(pg.get_by_test_id('pace-summary')).to_contain_text('Active · Hiking')
                        edit = pg.get_by_test_id('pace-summary-edit')
                        await expect(edit).to_have_attribute('aria-expanded', 'false')
                        await edit.click()
                        await expect(edit).to_have_attribute('aria-expanded', 'true')
                        assert await pg.get_by_test_id('pace-option').count() == 4
                        await pg.locator('[data-testid=pace-option][data-value=gentle]').check()
                        await edit.click()
                        await expect(pg.get_by_test_id('pace-summary')).to_contain_text('Gentle')
                    await pg.get_by_test_id('q-skip').click()
                    if page == 'style' and mode == 'trip':
                        await pg.get_by_test_id('fork-yes').click()
                if mode == 'local':
                    await expect(pg.get_by_test_id('local-plan')).to_be_visible()
                else:
                    from test_full import wait_plan
                    await wait_plan(pg)
                    await expect(pg.locator('.plan-header')).to_be_visible()
                expected = ['mode','pace','activities','city','length','styles','food','sleep'] if mode == 'local' else ['mode','pace','activities','destination','origin','dates','budget','who','ages','styles','food','sleep','musts']
                assert sorted(topics) == sorted(expected), topics
                assert len(topics) == len(set(topics)), topics
                await pg.evaluate("__gonow.go('home')")
                await open_home_flow(pg)
                await expect(pg.locator('[data-testid=pace-option][data-value=gentle]')).to_be_checked()
                print('PASS unique topics, counts and pace edit', mode, width)
            finally:
                await ctx.close()
if __name__ == '__main__':
    asyncio.run(serve_checks(8841, checks))
