from pathlib import Path
# Item F: port old Add/booking/reset flows to direct actions and the custom-item sheet.
"""Deterministic Day Builder screenshots; run with python3 tests/shots_daybuilder.py."""
from test_full import wait_plan, open_day_pace, open_guidance, open_add_menu
from test_full import card_action
import asyncio
import socket
import subprocess
import sys
from test_full import db_open, ROOT, SITE
from playwright.async_api import async_playwright


async def main():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    server = subprocess.Popen(
        [sys.executable, str(Path(__file__).parent / 'serve_site.py'), str(port)], cwd=str(SITE),
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                _, writer = await asyncio.open_connection('127.0.0.1', port)
                writer.close()
                await writer.wait_closed()
                break
            except OSError:
                await asyncio.sleep(.1)
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            for width, label in [(1280, 'desktop'), (390, 'mobile')]:
                ctx, pg = await db_open(browser, f'http://127.0.0.1:{port}/index.html', width, 'no-preference')
                await pg.set_viewport_size({'width': width, 'height': 900 if width == 1280 else 844})
                root = pg.get_by_test_id('db-root')
                day = pg.get_by_test_id('db-day-list')

                async def shot(state, element=root, context=False, include_header=False):
                    # Reinjected before every capture; animations remain enabled.
                    await pg.add_style_tag(content='.topbar{position:static!important} #toast{display:none!important}')
                    await pg.evaluate("async () => {await document.fonts.ready; await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))}")
                    path = str(ROOT / f'screenshots/daybuilder-{label}-{state}.png')
                    if not context and not include_header:
                        await element.screenshot(path=path)
                        return
                    await element.scroll_into_view_if_needed()
                    bounds = await element.bounding_box()
                    dimensions = await pg.evaluate('({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,x:scrollX,y:scrollY})')
                    if include_header:
                        header = await pg.get_by_test_id('day-add-own').bounding_box()
                        header_top = header['y'] + dimensions['y']
                    else:
                        header_top = dimensions['h']
                    top = max(0, min(header_top, bounds['y'] + dimensions['y'] - (150 if context else 0)))
                    bottom = min(dimensions['h'], bounds['y'] + dimensions['y'] + bounds['height'] + 150)
                    await pg.screenshot(path=path, full_page=True, clip={
                        'x': max(0, bounds['x'] + dimensions['x'] - 6), 'y': top,
                        'width': min(dimensions['w'] - max(0, bounds['x'] + dimensions['x'] - 6), bounds['width'] + 12),
                        'height': bottom - top})

                await shot('default')
                card = pg.get_by_test_id('plan-day').nth(1)
                await card.evaluate("e=>{const b=e.querySelector('[data-testid=tile-toggle]');if(b&&b.getAttribute('aria-expanded')!=='true')b.click()}")
                await shot('daycard-1126', card)
                await (await card_action(pg, day.locator('[data-db-id=photos]'), 'db-down')).click()
                await shot('afterdark', day.locator('[data-db-id=photos]'), True)
                await open_add_menu(pg)
                await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
                await open_add_menu(pg)
                assert await pg.get_by_test_id('db-tray-toggle').count()==0  # Item F: ideas are picked through Swap.
                # Item F: capture Swap choices and retain reflow/conflict screenshots via existing fixture insertion.
                await (await card_action(pg, day.locator('[data-db-id=photos]'), 'db-swap')).click()
                await shot('ideas', pg.get_by_test_id('swap-sheet'), include_header=True)
                await pg.keyboard.press('Escape')
                from test_full import add_reflow_fixture
                await add_reflow_fixture(pg, 'chest-1')
                await shot('parasail', day.locator('[data-db-id=photos]'), True)
                await add_reflow_fixture(pg, 'chest-0')
                await shot('conflict', day.locator('.db-conflict').first, True)
                await open_add_menu(pg)
                await pg.get_by_test_id('day-add-own').click();await pg.get_by_test_id('add-own-booked').check()
                await pg.get_by_test_id('add-own-name').fill('Birthday reservation')
                await pg.get_by_test_id('add-own-start').fill('22:00')
                await pg.get_by_test_id('add-own-end').fill('23:00')
                await shot('addbooking', pg.get_by_test_id('add-own-sheet'), True)
                await pg.keyboard.press('Escape')  # Item F: close the add sheet before the drag capture.
                await (await card_action(pg, day.locator('[data-db-id=photos]'), 'db-handle')).focus()
                await pg.keyboard.press('Space')
                await shot('focus', day.locator('.db-picked'), True)
                await ctx.close()
            await browser.close()
    finally:
        server.terminate()
        server.wait()


if __name__ == '__main__':
    asyncio.run(main())
