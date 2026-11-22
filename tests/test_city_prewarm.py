"""Pre-warmed city snapshots load picks with live Overpass/Nominatim blocked."""
import asyncio
from urllib.parse import urlparse
from playwright.async_api import expect
from test_full import answer
from test_wellness_home import serve_checks

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


async def checks(browser):
    overpass = []
    ctx = await browser.new_context(viewport={'width': 390, 'height': 844})
    await ctx.add_init_script("try{sessionStorage.setItem('gonow:signin-nudge','1')}catch(e){}")
    await ctx.route(is_live_place, lambda route: overpass.append(route.request.url) or route.abort())
    pg = await ctx.new_page()
    try:
        await pg.goto('http://127.0.0.1:8876/index.html?fast=1')
        await answer(pg, 'Shanghai')
        await pg.get_by_test_id('fork-no').click()
        await expect(pg.get_by_test_id('pick-card').first).to_be_visible(timeout=15000)
        await expect(pg.get_by_test_id('place-failure')).to_have_count(0)
        count = await pg.get_by_test_id('pick-card').count()
        assert count >= 8, count
        timing = await pg.evaluate('window.__placeTiming || null')
        assert timing and timing.get('source') == 'snapshot', timing
        assert timing['ms'] < 3000, timing
        assert not any('overpass' in u or 'nominatim' in u or 'googleapis' in u for u in overpass)
        names = await pg.locator('[data-testid=pick-card] strong').all_inner_texts()
        assert any('Museum' in n or 'Garden' in n or 'Park' in n or 'Square' in n for n in names), names[:8]
        await expect(pg.locator('.place-attribution')).to_contain_text('OpenStreetMap contributors')
        print('PASS Shanghai snapshot picks with live Overpass blocked', 'cards', count, 'ms', timing['ms'])
    finally:
        await ctx.close()


if __name__ == '__main__':
    asyncio.run(serve_checks(8876, checks))
