"""Interest options and legacy-answer migration; supervisor Chromium on 8838."""
import asyncio
import sys
from playwright.async_api import expect
from test_full import new
from test_wellness_home import serve_checks

BASE = 'http://127.0.0.1:8838/index.html'
OPTIONS = [
    ('hotel', 'Staying at the hotel', 'Pool, spa, great food on site'),
    ('wandering', 'Wandering around', 'Neighborhoods, markets, no fixed plan'),
    ('scenic', 'Scenic spots', 'Views, viewpoints, photo stops'),
    ('food', 'Food & cafés', 'Local favorites, healthy cafés'),
    ('culture', 'Culture & history', 'Museums, temples, local stories'),
    ('nature', 'Nature & beaches', 'Parks, gardens, shorelines'),
]

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        try:
            await pg.evaluate("__gonow.state.answers.styles=[]; __gonow.go('style')")
            labels = pg.locator('.option')
            assert await labels.count() == 6
            for i, (key, label, hint) in enumerate(OPTIONS):
                option = labels.nth(i)
                await expect(option).to_be_visible()
                await expect(option.locator('strong')).to_have_text(label)
                await expect(option.locator('small')).to_have_text(hint)
                assert (await option.bounding_box())['height'] >= 44
            texts = ' '.join(await labels.all_inner_texts())
            assert not any(word in texts for word in ('Relaxing', 'Adventure'))
            for key in ('hotel', 'scenic', 'food'):
                await pg.get_by_test_id('opt-' + key).click()
            # Existing max-two semantics replace the oldest choice on a third click.
            assert await pg.evaluate('__gonow.state.answers.styles') == ['scenic', 'food']
            await expect(pg.locator('#style-limit')).to_contain_text('You can pick two.')
            print('PASS styles ordered labels/hints and max-two swap', width)
            await pg.evaluate("localStorage.setItem('gonow:answers',JSON.stringify({styles:['relaxing','adventure']}))")
            await pg.reload()
            await pg.evaluate("__gonow.go('style')")
            assert await pg.evaluate('__gonow.state.answers.styles') == ['nature']
            assert await pg.locator('input[name=styles]:checked').evaluate_all('(els)=>els.map(e=>e.value)') == ['nature']
            print('PASS styles legacy localStorage migration', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    try:
        asyncio.run(serve_checks(8838, checks))
    except Exception as error:
        print('FAIL styles:', error)
        sys.exit(1)
