# Item F: port old Add/booking/reset flows to direct actions and the custom-item sheet.
"""Draft coverage for the unmocked GitHub Pages site.

Run python3 tests/verify_live.py for existing and draft live checks together.
Running this file directly runs that same complete suite.
"""
from test_full import dashboard_action
from test_full import wait_plan, open_day_pace, open_guidance, open_add_menu
from test_full import card_action
import asyncio


async def expand_result(row):
    if await row.get_by_test_id('activity-day').count():
        return
    await row.get_by_test_id('activity-expand').click()

async def verify_draft(browser, url, ok):
    ctx = await browser.new_context(viewport={'width': 1280, 'height': 900})
    pg = await ctx.new_page()
    pg.set_default_timeout(15000)
    try:
        await pg.goto(url, wait_until='networkidle')
        await pg.get_by_test_id('demo-oahu').click()
        from test_full import continue_prep
        await continue_prep(pg)
        await pg.get_by_test_id('db-root').wait_for()
        await pg.get_by_test_id('logo').click()
        await dashboard_action(pg, 'edit-draft')
        await pg.get_by_test_id('draft-screen').wait_for()
        tray = pg.get_by_test_id('activity-tray')
        cards = tray.get_by_test_id('activity-result')
        day = pg.get_by_test_id('db-day-list')

        async def select(date):
            await pg.get_by_test_id('db-day-' + date).click()

        async def ids():
            return await pg.evaluate('DayBuilder.draftItems().map(i=>i.id)')

        async def roundtrip(instance, source, present):
            value = await pg.evaluate("""([id,source]) => {
                const imported = DayBuilder.importDays(DayBuilder.exportState());
                return Object.values(imported.days).flatMap(d=>d.items)
                    .filter(i=>i.id===id && i.sourceId===source).length;
            }""", [instance, source])
            ok('draft export/import instance ' + ('retained' if present else 'removed'), value == int(present))

        titles = await cards.locator('h3').all_text_contents()
        draft = await pg.evaluate('DayBuilder.draftItems().map(i=>i.title)')
        missing = [title for title in draft if title not in titles]
        ok('draft tray headings include every draft title', bool(draft) and not missing, str(missing))
        ok('draft tray cards have no day badges', await cards.locator('.db-day-num,.badge').count() == 0)
        await select('2026-11-26')
        await pg.get_by_test_id('activity-search').fill('pillbox')
        pillbox = cards.filter(has_text='Lanikai').first
        await expand_result(pillbox)
        ok('draft pillbox guarded across days', await pillbox.get_by_test_id('activity-add').is_disabled()
           and await pillbox.get_attribute('draggable') == 'false'
           and 'Already in your plan' in await pillbox.inner_text()
           and await pillbox.get_by_test_id('activity-add-again').is_enabled())
        await select('2026-11-25')
        target = pillbox.get_by_test_id('activity-day')
        ok('draft visible tray day follows selected day', await target.is_visible() and await target.input_value() == '2026-11-25')
        await select('2026-11-26')
        # Item F: the day chest is gone. Exercise the same source/instance lifecycle in Activities.
        if await pg.get_by_test_id('tray-toggle').get_attribute('aria-expanded') != 'true':
            await pg.get_by_test_id('tray-toggle').click()
        for chest_id, query in (('chest-1', 'parasail'), ('chest-0', 'dive')):
            source = await pg.evaluate('(id)=>DayBuilder.trayItems().find(i=>i.id===id).sourceId', chest_id)
            await tray.get_by_test_id('activity-search').fill(query)
            card = cards.first
            await expand_result(card)
            originals = await pg.evaluate('(s)=>DayBuilder.draftItems().filter(i=>(i.sourceId||i.id)===s)', source)
            ok('draft library has original scheduled copy ' + chest_id, len(originals) == 1)
            ok('draft library explicit repeat available ' + chest_id, await card.get_by_test_id('activity-add-again').is_enabled())
            before = await ids()
            await card.get_by_test_id('activity-add-time').fill('15:00')
            await card.get_by_test_id('activity-add-again').click()
            copies = await pg.evaluate('(ids)=>DayBuilder.draftItems().filter(i=>!ids.includes(i.id))', before)
            valid = len(copies) == 1 and copies[0]['id'].startswith('instance-') and copies[0]['sourceId'] == source
            ok('draft Add again unique id and real source ' + chest_id, valid, str(copies))
            assert valid
            instance = copies[0]['id']
            await roundtrip(instance, source, True)
            await pg.get_by_test_id('tray-close').click()
            await (await card_action(pg, day.locator('[data-db-id="' + instance + '"]'), 'db-remove')).click()
            await roundtrip(instance, source, False)
            ok('draft original retained after instance removal ' + chest_id,
               set(i['id'] for i in originals).issubset(set(await ids())))
            await pg.get_by_test_id('tray-toggle').click()
        await pg.get_by_test_id('tray-close').click()

        photos = day.locator('[data-db-id=photos]')
        await photos.get_by_test_id('db-expand').click()
        form = photos.get_by_test_id('activity-time-form')
        await form.locator('[name=start]').fill('16:00')
        await form.locator('button').click()
        ok('draft palms default end is estimated', 'estimate from default duration' in await photos.inner_text())
        await form.locator('[name=end]').fill('17:30')
        await form.locator('button').click()
        ok('draft palms manual end range', await photos.get_by_test_id('db-time').text_content() == '4:00 PM–5:30 PM')
        # Reset restores the original 60-minute default before exercising that duration.
        await open_add_menu(pg)
        await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
        if not await form.is_visible():
            await photos.get_by_test_id('db-expand').click()
        await form.locator('[name=start]').fill('20:00')
        await form.locator('button').click()
        notes = await photos.get_by_test_id('db-note').all_text_contents()
        ok('draft palms overlap La Mer and after-dark heads-ups', any('Overlaps' in n and 'La Mer' in n for n in notes) and any('After dark' in n for n in notes), str(notes))
        ok('draft palms uses default duration at 20:00', await photos.get_by_test_id('db-time').text_content() == '8:00 PM–9:00 PM' and 'estimate from default duration' in await photos.inner_text())
        ok('draft expanded palms has honest photo fallback',
           'No verified activity photo' in await photos.get_by_test_id('db-detail').inner_text()
           and await photos.get_by_test_id('db-detail').locator('img').count() == 0)

        async def locked(row_id, expected):
            row = day.locator('[data-db-id=' + row_id + ']')
            return (await row.get_by_test_id('db-time').text_content() == expected
                    and await row.get_by_test_id('db-lock').get_attribute('aria-pressed') == 'true'
                    and 'db-locked' in (await row.get_attribute('class')).split())

        ok('draft La Mer remains 7:30 PM–9:30 PM locked', await locked('lamer', '7:30 PM–9:30 PM'))
        connectors = day.get_by_test_id('db-travel')
        ok('draft travel connector remains separate from activity time form', await connectors.count() > 0 and await connectors.evaluate_all("es=>es.every(e=>!e.matches('form,[data-testid=activity-time-form]')&&!e.closest('[data-testid=activity-time-form]')&&!e.querySelector('form,input,[data-testid=activity-time-form]'))"))
        diamond = day.locator('[data-db-source="2026-11-26-1"]')
        await diamond.get_by_test_id('db-expand').click()
        ok('draft expanded Diamond Head verified photo and credit', await diamond.locator('img').count() > 0 and await diamond.locator('img').evaluate_all("es=>es.every(e=>(e.alt||'').trim())") and await diamond.locator('.image-label a[href]').count() > 0)
        await pg.get_by_test_id('activity-search').fill('')
        fallback = cards.filter(has_text='No verified activity photo').first
        ok('draft unverified activity has honest photo fallback', await fallback.count() == 1 and await fallback.locator('img').count() == 0)
        await select('2026-11-27')
        ok('draft Senia remains 6:00 PM–8:00 PM locked', await locked('senia', '6:00 PM–8:00 PM'))
        await select('2026-11-26')
        await open_add_menu(pg)
        await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
        ok('draft reset restores default La Mer time and lock', await locked('lamer', '7:30 PM–9:30 PM'))
        await pg.get_by_test_id('generate-plan').click()
        await pg.get_by_test_id('finished-banner').wait_for()
        baseline = await pg.evaluate('window.__gonow.buildICS()')
        ok('draft generated snapshot has default palms ICS time', '20261126T174000' in baseline and '20261126T220000' not in baseline)
        await pg.get_by_test_id('logo').click()
        await dashboard_action(pg, 'edit-draft')
        await select('2026-11-26')
        for _ in range(8):
            order = await day.locator('[data-db-id]').evaluate_all('es=>es.map(e=>e.dataset.dbId)')
            if order.index('photos') > order.index('lamer'):
                break
            await (await card_action(pg, photos, 'db-down')).click()
        draft_ics = await pg.evaluate('window.__gonow.buildICS()')
        ok('draft changed export follows reorder', '20261126T220000' in draft_ics and '20261126T174000' not in draft_ics)
        await pg.get_by_test_id('logo').click()
        await dashboard_action(pg, 'view-finished')
        await pg.get_by_test_id('finished-banner').wait_for()
        frozen = await pg.evaluate('window.__gonow.buildICS()')
        ok('draft edits leave finished snapshot unchanged', frozen == baseline and await photos.get_by_test_id('db-time').text_content() == '5:40 PM–6:40 PM')
        await pg.get_by_test_id('logo').click()
        await dashboard_action(pg, 'edit-draft')
        await pg.get_by_test_id('generate-plan').click()
        await pg.get_by_test_id('finished-banner').wait_for()
        regenerated = await pg.evaluate('window.__gonow.buildICS()')
        ok('draft regenerate updates finished snapshot', regenerated != baseline and '20261126T220000' in regenerated and '20261126T174000' not in regenerated and await photos.get_by_test_id('db-time').text_content() == '10:00 PM–11:00 PM')
    except Exception as exc:
        ok('draft live coverage completed', False, str(exc))
    finally:
        await ctx.close()


if __name__ == '__main__':
    import sys
    from verify_live import main
    sys.exit(asyncio.run(main()))
