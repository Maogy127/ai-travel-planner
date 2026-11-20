from pathlib import Path
"""Wellness home and persistence regressions; run in a Chromium-capable environment."""
from test_full import open_home_flow
from test_full import wait_plan, open_day_pace, open_guidance, open_add_menu
import asyncio
import subprocess
import sys
from playwright.async_api import async_playwright, expect
from test_full import new, SITE
from test_voice import MOCK

BASE = 'http://127.0.0.1:8831/index.html'
BANNED = ('Treasure', 'treasure', 'Explorer passport', 'Deckhand', 'Navigator', 'Ahoy', 'Chart your')

async def calm(pg, label):
    text = await pg.locator('body').inner_text()
    assert not any(word in text for word in BANNED), text
    assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
    print('PASS calm copy and no overflow', label)

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        requests = []
        pg.on('request', lambda r: requests.append(r.url))
        try:
            await pg.add_init_script(MOCK)
            await pg.reload()
            await expect(pg.locator('h1')).to_have_text('Come home better than you left.')
            unsure = pg.locator('[data-testid=pace-option][data-value=unsure]')
            athlete = pg.locator('[data-testid=pace-option][data-value=athlete]')
            await expect(unsure).to_be_checked()
            await athlete.click()
            await expect(athlete).to_be_checked()
            assert await pg.evaluate("__gonow.state.answers.level") == 'athlete'
            chip = pg.locator('[data-testid=activity-chip][data-value=yoga]')
            await chip.click()
            await expect(chip).to_have_attribute('aria-pressed', 'true')
            assert await pg.evaluate("__gonow.state.answers.activities.includes('yoga')")
            await pg.reload()
            await expect(athlete).to_be_checked()
            await expect(chip).to_have_attribute('aria-pressed', 'true')
            assert await pg.evaluate("JSON.parse(localStorage.getItem('gonow:answers')).level") == 'athlete'
            await chip.click()
            await expect(chip).to_have_attribute('aria-pressed', 'false')
            await pg.reload()
            await expect(chip).to_have_attribute('aria-pressed', 'false')
            assert not await pg.evaluate("__gonow.state.answers.activities.includes('yoga')")
            field = pg.get_by_test_id('home-destination')
            await field.fill('San Diego')
            await pg.get_by_test_id('home-voice-lang').select_option('en-US')
            await pg.get_by_test_id('home-voice-btn').click()
            await pg.evaluate("voiceResult('morning walks', true)")
            await expect(field).to_have_value('San Diego, morning walks')
            assert await pg.evaluate('__gonow.state.answers.destination') == 'San Diego, morning walks'
            await expect(pg.locator('.sample-day')).to_have_count(0)
            await expect(pg.get_by_test_id('sample-rings')).to_have_count(0)
            await expect(pg.get_by_test_id('wellness-rings')).to_have_count(0)
            await expect(pg.get_by_test_id('rank-badge')).to_have_count(0)
            await expect(pg.get_by_text('A gentle day by the coast', exact=True)).to_have_count(0)
            await pg.evaluate('document.fonts.ready')
            assert await pg.evaluate('''() => ['Fraunces Variable','Inter Variable'].every(name => [...document.fonts].some(f => f.family.replace(/["']/g,'') === name && f.status === 'loaded'))''')
            assert any('/fonts/' in u and '.woff2' in u for u in requests), requests
            assert not any('fonts.googleapis.com' in u for u in requests)
            await calm(pg, f'home {width}')
            await pg.get_by_test_id('start-new-trip').click()
            await expect(pg.get_by_test_id('edit-destination')).to_be_visible()
            assert await pg.get_by_test_id('start-to').count() == 0
            assert await pg.evaluate('__gonow.state.answers.destination') == 'San Diego, morning walks'
            for screen in ('dates','budget','who','ages','style','food','pace','musts'):
                await pg.evaluate('(s)=>__gonow.go(s)', screen)
                await calm(pg, f'{screen} {width}')
            await pg.evaluate("__gonow.go('home')")
            await open_home_flow(pg)
            await pg.get_by_test_id('demo-oahu').click()
            from test_full import continue_prep
            await continue_prep(pg)
            await expect(pg.get_by_test_id('db-root')).to_be_visible()
            await calm(pg, f'plan {width}')
            await expect(pg.locator('.day-head > .wellness-rings figcaption')).to_have_count(0)
            await expect(pg.get_by_test_id('rank-badge')).to_have_count(0)
            await expect(pg.locator('.day-head > [data-testid=wellness-rings]')).to_be_visible()
            await pg.get_by_test_id('view-map').click()
            await expect(pg.get_by_test_id('trip-map')).to_be_visible()
            await calm(pg, f'map {width}')
            await pg.evaluate('window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;__gonow.go("home")')
            await open_home_flow(pg)
            await expect(pg.get_by_test_id('home-voice-unsupported')).to_have_text('Voice input needs Chrome, Edge or Safari.')
            await expect(pg.get_by_test_id('home-voice-btn')).to_be_disabled()
            print('PASS wellness picker, chips, voice, persistence, rings and local fonts', width)
        finally:
            await ctx.close()

async def serve_checks(port, checks_fn):
    server = subprocess.Popen([sys.executable, str(Path(__file__).parent / 'serve_site.py'), str(port), '127.0.0.1'], cwd=SITE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                _, writer = await asyncio.open_connection('127.0.0.1', port)
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
                await checks_fn(browser)
            finally:
                await browser.close()
    finally:
        server.terminate()
        server.wait()

if __name__ == '__main__':
    try:
        asyncio.run(serve_checks(8831, checks))
    except Exception as error:
        print('FAIL wellness home:', error)
        sys.exit(1)
