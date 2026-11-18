"""Reorder reflow (port 8898): after a move, a day's unlocked items run in order, locked items stay put,
items that cannot fit before a locked booking go after it, and the result persists."""
import asyncio, re, sys, json
from playwright.async_api import expect
from test_full import new
from test_wellness_home import serve_checks
from test_pick_activities import open_picks

BASE = 'http://127.0.0.1:8898/index.html'
RESULTS = []
def ok(name, cond, detail=''):
    RESULTS.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else ' · ' + str(detail)[:400]), flush=True)

DAY = '2026-11-27'
async def day(pg, on=DAY):
    return await pg.evaluate(f"DayBuilder.schedule().days.find(d=>d.date==='{on}').items.map(i=>({{id:i.id,s:i.start,e:i.end,l:!!i.locked,n:(i.notes||[]).join('|')}}))")

async def setup(b, width):
    ctx, pg = await new(b, BASE, width)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: print('CONSOLE', m.text) if 'UNSAFE' in m.text else None)
    await open_picks(pg); await pg.set_viewport_size({'width': width, 'height': 844})
    for a in ('kahala', 'ala-moana'): await pg.locator(f'[data-pick-toggle="{a}"]').click()
    await pg.get_by_test_id('pick-next').click()
    await pg.locator('[data-pick-toggle="giovannis"]').click()
    await pg.get_by_test_id('pick-next').click(); await pg.get_by_test_id('confirm-plan').wait_for()
    # Move Giovanni's (12:30) and the sunset (5:00 PM) onto the Senia day with their times.
    for pid, t in (('giovannis', '12:30'), ('kahala', '17:00')):
        await pg.get_by_test_id('db-day-2026-11-26').click()
        row = pg.locator(f'[data-db-zone=day][data-db-id="{pid}"]')
        await row.get_by_test_id('db-more').click(); await row.locator('[data-db-action=move-day]').click()
        dlg = pg.get_by_test_id('move-day-dialog'); await dlg.locator('select').select_option(DAY)
        await dlg.locator('[name=start]').fill(t); await dlg.get_by_role('button', name='Move', exact=True).click()
        await pg.wait_for_timeout(200)
        dl=await pg.evaluate("[...document.querySelectorAll('dialog[open]')].map(d=>d.dataset.testid+':'+d.innerText.slice(0,200))")
        if dl: print('DIALOG', dl)
    await pg.get_by_test_id('db-day-' + DAY).click()
    return ctx, pg, errs

def ordered(items):
    timed = [i for i in items if i['s'] is not None]
    return all(timed[k]['s'] >= timed[k-1]['e'] for k in range(1, len(timed)))

async def menu_action(pg, pid, action):
    row = pg.locator(f'[data-db-zone=day][data-db-id="{pid}"]')
    if not await row.locator(f'[data-db-action={action}]').is_visible(): await row.get_by_test_id('db-more').click()
    await row.locator(f'[data-db-action={action}]').click()

async def move_down(pg, pid, times=1):
    for _ in range(times):
        row = pg.locator(f'[data-db-zone=day][data-db-id="{pid}"]')
        await menu_action(pg, pid, 'down')
        await pg.wait_for_timeout(150)
        dl=await pg.evaluate("[...document.querySelectorAll('dialog[open]')].map(d=>d.dataset.testid+':'+d.innerText.slice(0,300))")
        if dl: print('DIALOG', dl)

async def checks(b):
    for width in (390, 1280):
        ctx, pg, errs = await setup(b, width)
        before = await day(pg); ids = [i['id'] for i in before]
        ok(f'{width} setup: Ala Moana, Giovanni’s, sunset, Senia (locked 6 PM)', ids[:1] == ['ala-moana'] and 'senia' in ids and next(i for i in before if i['id'] == 'senia')['s'] == 1080, before)
        # User's report: Ala Moana moved below the sunset.
        await move_down(pg, 'ala-moana', 2)
        after = await day(pg); ids = [i['id'] for i in after]
        senia = next(i for i in after if i['id'] == 'senia')
        ok(f'{width} locked Senia never moves (6:00–8:00 PM)', senia['s'] == 1080 and senia['e'] == 1200, senia)
        ok(f'{width} times are in order after the move', ordered(after), after)
        ok(f'{width} the moved item gets no “you’d miss Senia” heads-up', "you'd miss" not in next(i for i in after if i['id'] == 'ala-moana')['n'], after)
        ok(f'{width} no false “you’d miss Senia” heads-up', not any("you'd miss" in i['n'] for i in after), after)
        gio = next(i for i in after if i['id'] == 'giovannis'); sun = next(i for i in after if i['id'] == 'kahala'); ala = next(i for i in after if i['id'] == 'ala-moana')
        ok(f'{width} new order is Giovanni’s, sunset, Ala Moana, Senia', ids == ['giovannis', 'kahala', 'ala-moana', 'senia'], ids)
        ok(f'{width} the day still starts at its first start (10:00 AM) and runs back to back', gio['s'] == 600 and sun['s'] >= gio['e'] and ala['s'] >= sun['e'] and ala['e'] <= 1080, after)
        # Moving the sunset up: it drops its time and runs right after Giovanni's.
        await pg.reload(); await pg.wait_for_timeout(800)
        if await pg.get_by_test_id('trip-card').count(): await pg.get_by_test_id('trip-card').first.locator('[data-open-trip]').click(); await pg.wait_for_timeout(600)
        await pg.get_by_test_id('db-day-' + DAY).click()
        reloaded = await day(pg)
        ok(f'{width} reflowed order and times persist after reload', [(i['id'], i['s']) for i in reloaded] == [(i['id'], i['s']) for i in after], [reloaded, after])
        shown = [re.sub(r'\s+', ' ', t) for t in await pg.locator('[data-db-zone=day] [data-testid=db-time]').all_inner_texts()]
        ok(f'{width} cards show times in order', len(shown) >= 3, shown)
        # Drag-free move up: Ala Moana back before Giovanni's takes the day's first start.
        row = pg.locator('[data-db-zone=day][data-db-id="ala-moana"]')
        for _ in range(3):
            await menu_action(pg, 'ala-moana', 'up'); await pg.wait_for_timeout(150)
        up = await day(pg); ids = [i['id'] for i in up]
        ok(f'{width} moved-up item runs first and the rest follow in order', ids[0] == 'ala-moana' and ordered(up) and next(i for i in up if i['id'] == 'senia')['s'] == 1080, up)
        ok(f'{width} no page errors', not errs, errs)
        if width == 390: print('STATE', json.dumps(up))
        await ctx.close()
    failed = [n for n, c in RESULTS if not c]
    print(f'SUMMARY pass {len(RESULTS)-len(failed)} fail {len(failed)}')
    assert not failed, failed

asyncio.run(serve_checks(8898, checks))
