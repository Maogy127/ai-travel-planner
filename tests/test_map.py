"""Real Leaflet map and offline regressions; all external requests are intercepted."""
import asyncio
import subprocess
import sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect
from test_full import new, SITE

BASE = 'http://127.0.0.1:8821/index.html'


async def open_map(pg):
    await pg.get_by_test_id('demo-oahu').click()
    await expect(pg.get_by_test_id('db-root')).to_be_visible()
    await pg.get_by_test_id('view-map').click()
    await expect(pg.get_by_test_id('map-stop-list')).not_to_be_empty()


async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        requests = []
        pg.on('request', lambda r: requests.append(r.url))
        try:
            await open_map(pg)
            await expect(pg.get_by_test_id('trip-map')).to_be_visible()
            assert await pg.evaluate('!!window.L && L.version === "1.9.4"')
            # Independently derive consecutive pin count from the current builder schedule.
            for index in (0, 1, 3, 4):
                await pg.get_by_test_id('map-day-select').nth(index).click()
                await expect(pg.get_by_test_id('map-day-select').nth(index)).to_have_attribute('aria-pressed', 'true')
                assert await pg.locator('[data-testid=map-day-select]').evaluate_all('buttons => getComputedStyle(buttons.find(b => b.getAttribute("aria-pressed") === "true")).backgroundColor !== getComputedStyle(buttons.find(b => b.getAttribute("aria-pressed") === "false")).backgroundColor')
                # Leaflet fades removed popups out; no previous-day popup may linger.
                await pg.wait_for_timeout(500)
                await expect(pg.locator('.leaflet-popup')).to_have_count(0)
                expected = await pg.evaluate('''index => {
                    const day = DayBuilder.schedule().days[index], geo = GONOW_GEO;
                    const key = i => geo.demoItems[i.sourceId || i.id] || geo.builderPlaces[i.place];
                    const items = day.items.filter(i => i.kind !== 'prep' && (i.kind !== 'travel' || key(i) === 'hnl'));
                    let last, count = 0;
                    for (const i of items) {const k = key(i); if (geo.places[k] && k !== last) count++; last = geo.places[k] ? k : null;}
                    return count;
                }''', index)
                await expect(pg.locator('.map-pin')).to_have_count(expected)
                await expect(pg.locator('.map-route-line')).to_have_count(1 if expected > 1 else 0)
                stops = pg.get_by_test_id('map-stop-list')
                if index == 0:
                    await expect(pg.get_by_test_id('map-day-select').nth(index)).to_contain_text('2026-11-25')
                    await expect(pg.locator('.map-pin')).to_have_count(2)
                    await expect(pg.locator('.map-route-line')).to_have_count(1)
                    await expect(stops.locator('li')).to_have_count(2)
                    await expect(stops.locator('li').nth(0)).to_contain_text('Land at HNL')
                    await expect(stops.locator('li').nth(1)).to_contain_text('Check in at The Kahala')
                    await expect(stops.locator('li').nth(1)).to_contain_text('Dinner at the Kahala')
                if index == 4:
                    await expect(pg.get_by_test_id('map-day-select').nth(index)).to_contain_text('2026-11-29')
                    await expect(pg.locator('.map-pin')).to_have_count(1)
                    await expect(pg.locator('.map-route-line')).to_have_count(0)
                    await expect(stops.locator('li')).to_have_count(1)
                    await expect(stops).to_contain_text('Flight')
                    assert await pg.evaluate('''() => {
                        const geo = GONOW_GEO;
                        const flight = DayBuilder.schedule().days[4].items.find(i => i.flight);
                        const key = flight && (geo.demoItems[flight.sourceId || flight.id] || geo.builderPlaces[flight.place]);
                        const place = geo.places[key];
                        return key === 'hnl' && place.lat === 21.32114 && place.lng === -157.91844;
                    }''')
                if index == 1:
                    await expect(stops).to_contain_text('Diamond Head')
                    await expect(pg.get_by_test_id('map-stop-list')).to_contain_text('Kualoa')
                if index == 3:
                    await expect(pg.get_by_test_id('map-stop-list')).to_contain_text('Makapuʻu')
                first = pg.locator('.map-pin').first
                await first.click()
                await expect(pg.locator('.leaflet-popup')).to_have_count(1)
                popup = pg.locator('.leaflet-popup-content').last
                await expect(popup).to_be_visible()
                text = await popup.inner_text()
                assert await pg.get_by_test_id('map-stop-list').evaluate('(el, text) => text.split("\\n").filter(Boolean).every(t => el.textContent.includes(t))', text)
                if index == 4:
                    assert 'Flight' in text
                else:
                    assert any(t in text for t in ('AM', 'PM'))
                if width == 390:
                    assert await pg.get_by_test_id('trip-map').evaluate('''(el) => {
                        const rect = el.getBoundingClientRect();
                        return rect.left >= 0 && rect.right <= window.innerWidth + 0.5
                            && getComputedStyle(el).overflow === 'hidden';
                    }''')
                assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
            attribution = pg.locator('.leaflet-control-attribution')
            await expect(attribution).to_contain_text('OpenStreetMap contributors')
            await expect(attribution).to_contain_text('Leaflet')
            assert any(urlparse(u).hostname == 'tile.openstreetmap.org' for u in requests)
            assert all(urlparse(u).hostname in ('127.0.0.1', 'tile.openstreetmap.org', 'fonts.googleapis.com') for u in requests), requests
            print('PASS map pins, route, popups, days, attribution and width', width)
        finally:
            await ctx.close()
    for mode in ('leaflet', 'tiles'):
        ctx, pg = await new(browser, BASE)
        try:
            pattern = '**/vendor/leaflet-1.9.4/leaflet.js*' if mode == 'leaflet' else 'https://tile.openstreetmap.org/**'
            # Page routes take priority over the shared context tile fixture.
            await pg.route(pattern, lambda route: route.abort())
            await pg.reload()
            await open_map(pg)
            if mode == 'leaflet':
                await expect(pg.get_by_test_id('map-fallback')).to_be_visible()
            else:
                await expect(pg.get_by_test_id('map-tile-error')).to_be_visible()
                assert await pg.locator('.map-pin').count() > 0
            await expect(pg.get_by_test_id('map-stop-list')).not_to_be_empty()
            print('PASS map fallback', mode)
        finally:
            await ctx.close()


async def main():
    server = subprocess.Popen([sys.executable, '-m', 'http.server', '8821', '--bind', '127.0.0.1'], cwd=SITE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                _, writer = await asyncio.open_connection('127.0.0.1', 8821)
                writer.close()
                await writer.wait_closed()
                break
            except OSError:
                await asyncio.sleep(.1)
        else:
            raise RuntimeError('Server failed to start')
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            try:
                await checks(browser)
            finally:
                await browser.close()
    finally:
        server.terminate()
        server.wait()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as error:
        print('FAIL map:', error)
        raise
