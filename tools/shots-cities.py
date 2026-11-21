#!/usr/bin/env python3
"""Headless picks screenshots for pre-warmed non-Oahu cities. Live Overpass is blocked."""
import asyncio
import sys
from pathlib import Path
from urllib.parse import urlparse
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'tests'))
from playwright.async_api import expect
from test_full import answer
from test_wellness_home import serve_checks

OUT = Path('/workspace/gonow-origin-fix/cities-demo')
LIVE_HOSTS = (
    'places.googleapis.com', 'nominatim.openstreetmap.org',
    'overpass-api.de', 'overpass.kumi.systems', 'overpass.openstreetmap.fr',
    'overpass.osm.ch', 'upload.wikimedia.org'
)
CITIES = sys.argv[1:] or ['Shanghai', 'Hong Kong', 'Lisbon']


def is_live_place(url):
    host = urlparse(str(url)).hostname or ''
    if '/data/cities/' in (urlparse(str(url)).path or ''):
        return False
    return host in LIVE_HOSTS or any(host == d or host.endswith('.' + d) for d in ('wikipedia.org', 'wikidata.org'))


async def shot(browser, city, width):
    ctx = await browser.new_context(viewport={'width': width, 'height': 844 if width < 800 else 900})
    await ctx.add_init_script("try{sessionStorage.setItem('gonow:signin-nudge','1')}catch(e){}")
    await ctx.route(is_live_place, lambda route: route.abort())
    pg = await ctx.new_page()
    try:
        await pg.goto('http://127.0.0.1:8877/index.html?fast=1')
        await answer(pg, city)
        await pg.get_by_test_id('fork-no').click()
        await expect(pg.get_by_test_id('pick-card').first).to_be_visible(timeout=20000)
        timing = await pg.evaluate('window.__placeTiming || {}')
        slug = city.lower().replace(' ', '-')
        path = OUT / f'{slug}-picks-{width}.png'
        await pg.screenshot(path=str(path), full_page=True)
        print('SHOT', path, 'source', timing.get('source'), 'ms', timing.get('ms'), 'cards', await pg.get_by_test_id('pick-card').count())
        return {'city': city, 'width': width, 'path': str(path), **timing}
    finally:
        await ctx.close()


async def checks(browser):
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    for city in CITIES:
        results.append(await shot(browser, city, 390))
        results.append(await shot(browser, city, 1280))
    (OUT / 'shots.json').write_text(__import__('json').dumps(results, indent=2) + '\n')


if __name__ == '__main__':
    asyncio.run(serve_checks(8877, checks))
