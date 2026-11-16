"""Supervisor-only any-city browser checks; fixtures require no live services."""
import asyncio
import base64
import json
from pathlib import Path
from playwright.async_api import expect
from test_full import new, answer
from test_wellness_home import serve_checks

FIXTURES = Path(__file__).parent / 'fixtures'
HOSTS = ('nominatim.openstreetmap.org', 'overpass-api.de', 'wikipedia.org', 'wikidata.org')

async def routes(pg, city, failure=False):
    requests = []
    async def handle(route):
        url = route.request.url
        requests.append(url)
        if route.request.method == 'OPTIONS':
            await route.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type'})
            return
        if failure:
            await route.abort()
            return
        kind = 'nominatim' if 'nominatim' in url else 'overpass' if 'overpass' in url else 'wikipedia'
        await route.fulfill(headers={'Access-Control-Allow-Origin': '*'}, content_type='application/json', body=(FIXTURES / f'{city}_{kind}.json').read_text())
    for host in HOSTS:
        await pg.route('https://**' + host + '/**', handle)
    # The summary thumbnail is a mocked fixture; never download an external image.
    await pg.route('https://upload.wikimedia.org/**', lambda r: r.fulfill(content_type='image/png', body=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGN4eXvnfwAIqwN9YzQAMgAAAABJRU5ErkJggg==')))
    return requests

async def enter(pg, city):
    await answer(pg, city)
    await pg.get_by_test_id('fork-no').click()
    await expect(pg.get_by_test_id('pick-activities')).to_be_visible()

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8871/index.html', width, 844)
        try:
            requests = await routes(pg, 'seattle')
            await answer(pg, 'Seattle')
            assert not requests, 'No place-source requests before entering picks'
            await pg.get_by_test_id('fork-no').click()
            await expect(pg.get_by_test_id('pick-card')).to_have_count(3)
            await expect(pg.locator('[data-pick-id=osm-node-100] img')).to_be_visible()
            await expect(pg.get_by_test_id('place-placeholder')).not_to_have_count(0)
            await expect(pg.locator('.place-attribution')).to_contain_text('OpenStreetMap contributors')
            await pg.locator('[data-pick-info=osm-node-101]').click()
            await expect(pg.get_by_test_id('pick-details')).to_contain_text('Hours not listed')
            await expect(pg.get_by_role('link', name='Open in map')).to_have_attribute('href', 'https://www.openstreetmap.org/node/101')
            await pg.get_by_role('button', name='Close', exact=True).click()
            await pg.locator('[data-pick-info=osm-node-100]').click()
            await expect(pg.get_by_test_id('pick-details')).to_contain_text('Tu-Su 10:00-18:00')
            await expect(pg.get_by_test_id('pick-details')).to_contain_text('Photo: Wikipedia/Wikimedia Commons')
            await pg.get_by_role('button', name='Add', exact=True).click()
            await pg.locator('[data-pick-toggle=osm-node-101]').click()
            await pg.get_by_test_id('pick-next').click()
            await expect(pg.get_by_role('heading', name='Popular nearby', exact=True)).to_be_visible()
            await expect(pg.get_by_role('heading', name='GoNow Picks', exact=True)).to_have_count(0)
            await pg.locator('[data-pick-toggle=osm-node-103]').click()
            await pg.get_by_test_id('pick-next').click()
            await expect(pg.get_by_test_id('confirm-plan')).to_be_visible()
            plan = await pg.evaluate('window.__gonow.state.plan')
            assert plan['id'] == 'seattle-picks-2026-11-25'
            scheduled = [i['id'] for d in plan['days'] for i in d['items'] if i.get('pick')]
            assert all(i in scheduled for i in ('osm-node-100', 'osm-node-101', 'osm-node-103'))
            assert 'Uber to HNL' not in [i['title'] for d in plan['days'] for i in d['items']]
            await pg.get_by_test_id('confirm-plan').click()
            await expect(pg.get_by_test_id('trip-prep')).to_be_visible()
            await pg.screenshot(path=f'/tmp/any-city-seattle-{width}.png', full_page=True)
            print('PASS Seattle nearby picks, details, schedule and prep', width)
        finally:
            await ctx.close()
    for city in ('Tokyo', 'Oahu'):
        ctx, pg = await new(browser, 'http://127.0.0.1:8871/index.html')
        try:
            requests = await routes(pg, 'tokyo')
            await enter(pg, city)
            await expect(pg.get_by_test_id('pick-card').first).to_be_visible()
            if city == 'Oahu':
                assert not requests, 'Oahu stays entirely on the curated catalog'
            else:
                await expect(pg.locator('[data-pick-id=osm-node-100]')).to_contain_text('Tokyo National Museum')
                await pg.locator('[data-pick-toggle=osm-node-100]').click()
                await pg.get_by_test_id('pick-next').click()
                await pg.get_by_test_id('pick-next').click()
                await expect(pg.get_by_test_id('confirm-plan')).to_be_visible()
                assert await pg.evaluate('window.__gonow.state.plan.id') == 'tokyo-picks-2026-11-25'
        finally:
            await ctx.close()
    ctx, pg = await new(browser, 'http://127.0.0.1:8871/index.html')
    try:
        await routes(pg, 'seattle', failure=True)
        await enter(pg, 'Seattle')
        await expect(pg.get_by_test_id('place-loading')).to_be_visible()
        await expect(pg.locator('.pick-chips')).to_have_count(0)
        await expect(pg.get_by_test_id('place-failure')).to_have_text('Couldn’t load places')
        await expect(pg.locator('.pick-chips')).to_have_count(0)
        await pg.get_by_test_id('pick-fallback').click()
        await expect(pg.get_by_test_id('confirm-plan')).to_be_visible(timeout=20000)
        assert '-picks-' not in await pg.evaluate('window.__gonow.state.plan.id')
        print('PASS Tokyo, Oahu isolation and failure fallback')
    finally:
        await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8871, checks))
