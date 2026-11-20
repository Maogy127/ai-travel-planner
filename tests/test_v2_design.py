"""v2 'Color is your weather' UI checks (dial re-tint, per-day memory, Focus card, date strip, icons, motion guards). Port 8880."""
import asyncio, sys
from playwright.async_api import expect
from test_full import new, continue_prep, show_day, ok, errors, results
from test_wellness_home import serve_checks

BASE = 'http://127.0.0.1:8880/index.html'
VAR = "n=>getComputedStyle(document.documentElement).getPropertyValue('--'+n).trim()"

async def dial(pg, v):
    d = pg.locator('[data-testid=feel-dial]:visible').first
    await d.evaluate("(d,v)=>{d.value=v;d.dispatchEvent(new Event('input',{bubbles:true}))}", v)

async def checks(browser):
    for width in (390, 1280):
        for motion in ('no-preference', 'reduce'):
            ctx, pg = await new(browser, BASE, width, 844, reduced_motion=motion)
            try:
                label = f'{width} {motion}'
                ok(f'{label} default palette is Energized', await pg.evaluate(VAR, 'bg') == '#F6F1E7' and await pg.evaluate("document.documentElement.dataset.state") == 'energized')
                chrome = await pg.locator('header.topbar').inner_text(); ok(f'{label} no emoji in shell chrome', not any(ch in chrome for ch in '☰✳'))
                await pg.get_by_test_id('demo-oahu').click(); await continue_prep(pg)
                date = await show_day(pg, 1)
                d = pg.locator('[data-testid=feel-dial]:visible').first
                await expect(d).to_be_visible()
                box = await d.bounding_box(); ok(f'{label} dial is a 44px target', box['height'] >= 44, box)
                ok(f'{label} dial has a one-line label', await pg.locator('.state-dial-head label:visible').first.inner_text() == 'How do you feel?')
                await dial(pg, 10)
                await pg.wait_for_timeout(50 if motion == 'reduce' else 800)
                ok(f'{label} Low re-tints to Tired T2', await pg.evaluate(VAR, 'bg') == '#EBD8C3' and await pg.evaluate(VAR, 'accent') == '#8C3D49', await pg.evaluate(VAR, 'bg'))
                await expect(pg.locator('[data-testid=state-dial-value]:visible').first).to_have_text('Low')
                await expect(d).to_have_attribute('aria-valuetext', 'Low')
                await dial(pg, 50)
                await pg.wait_for_timeout(50 if motion == 'reduce' else 800)
                ok(f'{label} Steady re-tints to Calm C2', await pg.evaluate(VAR, 'bg') == '#F3EADB' and await pg.evaluate(VAR, 'sleep') == '#A897BC')
                if motion == 'no-preference':
                    await dial(pg, 100); await pg.wait_for_timeout(250)
                    mid = await pg.evaluate(VAR, 'bg')
                    ok(f'{label} re-tint animates (mid-blend after 250 ms)', mid not in ('#F3EADB', '#F6F1E7'), mid)
                    await pg.wait_for_timeout(600)
                    ok(f'{label} re-tint lands on Energized', await pg.evaluate(VAR, 'bg') == '#F6F1E7')
                else:
                    await dial(pg, 100); await pg.wait_for_timeout(30)
                    ok(f'{label} reduced motion re-tints instantly', await pg.evaluate(VAR, 'bg') == '#F6F1E7')
                await dial(pg, 12)
                stored = await pg.evaluate("d=>JSON.parse(localStorage.getItem('gonow.feel.v1'))[d]", date)
                ok(f'{label} feel stored per day on this device', abs(stored - .12) < .001, stored)
                # Another day keeps its own value (default High); coming back restores Low.
                other = await pg.evaluate('__gonow.state.plan.days[2].date')
                await pg.get_by_test_id('db-day-' + other).click(); await pg.wait_for_timeout(900)
                ok(f'{label} other day uses its own feel', await pg.evaluate("document.documentElement.dataset.state") == 'energized')
                await pg.get_by_test_id('db-day-' + date).click(); await pg.wait_for_timeout(900)
                ok(f'{label} returning restores that day', await pg.evaluate("document.documentElement.dataset.state") == 'tired')
                # Date strip: one tile per day, the selected tile pressed, numerals present.
                tiles = pg.locator('.db-days .db-date')
                ok(f'{label} date strip tiles', await tiles.count() == await pg.evaluate('__gonow.state.plan.days.length'))
                await expect(pg.get_by_test_id('db-day-' + date)).to_have_attribute('aria-pressed', 'true')
                # Focus: an opened stop becomes the espresso card.
                row = pg.locator('[data-db-zone=day][data-testid=db-pair].db-expandable').first
                await row.get_by_test_id('db-expand').click(); await pg.wait_for_timeout(50 if motion == 'reduce' else 750)
                bg = await row.evaluate("e=>getComputedStyle(e).backgroundColor")
                ok(f'{label} opened stop uses Focus surface', bg == 'rgb(33, 29, 24)', bg)
                # Line icons, one weight.
                widths = await pg.evaluate("[...document.querySelectorAll('svg.v2-icon')].map(s=>getComputedStyle(s).strokeWidth)")
                ok(f'{label} line icons are 1.5px', widths and set(widths) == {'1.5px'}, set(widths))
                # Press-spring only when motion is allowed.
                t = await pg.locator('[data-testid=day-add-own]').evaluate("e=>getComputedStyle(e).transitionDuration")
                ok(f'{label} press-spring respects reduced motion', ('0.9s' in t) == (motion == 'no-preference'), t)
                # Ring numbers: real value in the DOM from the first frame.
                ok(f'{label} ring values readable', 'Move' in await pg.locator('.day-head .compact-values:visible').first.text_content())
                # Persisted state paints before first render on reload.
                await pg.reload(); await pg.wait_for_timeout(300)
                ok(f'{label} reload keeps last state', await pg.evaluate("document.documentElement.dataset.state") == 'tired')
            finally:
                await ctx.close()
    ok('no page errors', not errors, errors)

if __name__ == '__main__':
    asyncio.run(serve_checks(8880, checks))
    sys.exit(1 if any(not r[1] for r in results) else 0)
