"""Supervisor-only Chromium checks, port 8854. Do not run in agent validation."""
import asyncio
from playwright.async_api import expect
from test_full import new
from test_wellness_home import serve_checks

async def above_bar(pg, locator):
    boxes = await locator.evaluate_all('els=>els.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom}})')
    top = await pg.locator('.qfooter').evaluate('e=>e.getBoundingClientRect().top')
    assert boxes and all(b['top'] >= 0 and b['bottom'] <= min(top, pg.viewport_size['height']) for b in boxes), (boxes, top)

async def checks(browser):
    for width, height in ((390, 844), (1280, 900)):
        ctx, pg = await new(browser, 'http://127.0.0.1:8854/index.html', width, height)
        try:
            await pg.evaluate("__gonow.go('who')")
            await pg.get_by_test_id('opt-couple').click()
            await expect(pg.get_by_test_id('track-choice')).to_be_visible()
            await pg.wait_for_timeout(800)  # smooth auto-scroll must finish
            await above_bar(pg, pg.locator('[data-testid=opt-together], [data-testid=opt-each]'))
            for step in ('dates', 'budget', 'who', 'ages', 'style', 'food', 'pace', 'musts'):
                await pg.evaluate('step=>__gonow.go(step)', step)
                last = pg.locator('.question .option:visible, .question input:not([type=hidden]):visible, .question textarea:visible').last
                await pg.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)')
                await above_bar(pg, last)
                print('PASS sticky footer', width, step)
        except Exception as exc:
            print('FAIL sticky footer', width, str(exc))
            raise
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8854, checks))
