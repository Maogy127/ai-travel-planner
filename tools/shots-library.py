#!/usr/bin/env python3
"""Headless day-view Search activities screenshots at 390 and 1280."""
import sys
from pathlib import Path
from urllib.parse import urlparse
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'tests'))
from playwright.async_api import expect
from test_full import answer, through_picks
from test_wellness_home import serve_checks

OUT = Path('/workspace/gonow-origin-fix/cities-demo')
LIVE_HOSTS = (
    'places.googleapis.com', 'nominatim.openstreetmap.org',
    'overpass-api.de', 'overpass.kumi.systems', 'overpass.openstreetmap.fr',
    'overpass.osm.ch', 'upload.wikimedia.org'
)


def is_live_place(url):
    host = urlparse(str(url)).hostname or ''
    if '/data/cities/' in (urlparse(str(url)).path or ''):
        return False
    return host in LIVE_HOSTS or any(host == d or host.endswith('.' + d) for d in ('wikipedia.org', 'wikidata.org'))


async def open_page(browser, width):
    height = 844 if width < 800 else 900
    ctx = await browser.new_context(viewport={'width': width, 'height': height})
    await ctx.add_init_script("try{sessionStorage.setItem('gonow:signin-nudge','1')}catch(e){}")
    await ctx.route(is_live_place, lambda route: route.abort())
    pg = await ctx.new_page()
    await pg.goto('http://127.0.0.1:8878/index.html?fast=1')
    return ctx, pg, height


async def open_tray(pg, width):
    await expect(pg.get_by_test_id('draft-screen')).to_be_visible()
    tray = pg.get_by_test_id('activity-tray')
    if width < 800:
        toggle = pg.get_by_test_id('tray-toggle')
        if await toggle.get_attribute('aria-expanded') != 'true':
            await toggle.click()
    await expect(tray).to_be_visible()
    await pg.evaluate('document.fonts.ready')
    return tray


async def search_results(pg, query, text=None):
    search = pg.get_by_test_id('activity-search')
    await search.fill(query)
    if text:
        await expect(pg.get_by_test_id('activity-result').filter(has_text=text).first).to_be_visible(timeout=15000)
    else:
        await expect(pg.get_by_test_id('activity-result').first).to_be_visible(timeout=15000)


async def shot_sunset(browser, width):
    ctx, pg, height = await open_page(browser, width)
    try:
        await pg.get_by_test_id('demo-oahu').click()
        await expect(pg.get_by_test_id('confirm-plan')).to_be_visible()
        await pg.evaluate("__gonow.go('draft')")
        await open_tray(pg, width)
        await search_results(pg, 'sunset', 'sunset')
        path = OUT / f'search-sunset-oahu-{width}.png'
        await pg.screenshot(path=str(path), full_page=True)
        print('SHOT', path, 'results', await pg.get_by_test_id('activity-result').count())
    finally:
        await ctx.close()


async def shot_city(browser, width):
    ctx, pg, height = await open_page(browser, width)
    try:
        await answer(pg, 'Shanghai')
        await pg.set_viewport_size({'width': width, 'height': height})
        await pg.get_by_test_id('fork-no').click()
        await through_picks(pg)
        await pg.locator('[data-testid=confirm-plan]:visible, [data-testid=db-root]:visible').first.wait_for(timeout=45000)
        await pg.evaluate("__gonow.go('draft')")
        await open_tray(pg, width)
        await search_results(pg, 'bund', 'The Bund')
        path = OUT / f'search-in-another-city-{width}.png'
        await pg.screenshot(path=str(path), full_page=True)
        print('SHOT', path, 'results', await pg.get_by_test_id('activity-result').count())
    finally:
        await ctx.close()


async def shot_expanded(browser, width):
    ctx, pg, height = await open_page(browser, width)
    try:
        await pg.get_by_test_id('demo-oahu').click()
        await expect(pg.get_by_test_id('confirm-plan')).to_be_visible()
        await pg.evaluate("__gonow.go('draft')")
        await open_tray(pg, width)
        await search_results(pg, 'sunset', 'sunset')
        row = pg.get_by_test_id('activity-result').first
        await row.get_by_test_id('activity-expand').click()
        await expect(row.get_by_test_id('activity-day')).to_be_visible()
        await expect(row.get_by_test_id('activity-add')).to_be_visible()
        path = OUT / f'expanded-add-{width}.png'
        await pg.screenshot(path=str(path), full_page=True)
        print('SHOT', path)
    finally:
        await ctx.close()


async def checks(browser):
    OUT.mkdir(parents=True, exist_ok=True)
    for width in (390, 1280):
        await shot_sunset(browser, width)
        await shot_city(browser, width)
        await shot_expanded(browser, width)


if __name__ == '__main__':
    import asyncio
    asyncio.run(serve_checks(8878, checks))
