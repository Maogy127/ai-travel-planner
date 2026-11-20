"""Supervisor browser flight regressions: port 8874, desktop and phone."""
import asyncio
from playwright.async_api import expect
from test_full import new, open_form, open_home_flow, wait_plan
from test_wellness_home import serve_checks
from test_any_city import routes

BASE = 'http://127.0.0.1:8874/index.html'

async def enter(pg, destination, skip=False):
    await open_form(pg)
    await pg.get_by_test_id('start-from').fill('Los Angeles')
    await pg.get_by_test_id('start-to').fill(destination)
    await pg.get_by_test_id('start-next').click()
    await pg.get_by_test_id('date-start').fill('2027-02-10')
    await pg.get_by_test_id('date-end').fill('2027-02-14')
    await pg.get_by_test_id('q-continue').click()
    await expect(pg.locator('.question h1')).to_have_text('Add your flights?')
    await expect(pg.get_by_role('progressbar')).to_have_attribute('aria-label', 'Step 2 of 9')
    assert await pg.get_by_test_id('arrival-time').count() == 1
    if skip:
        await pg.get_by_test_id('q-skip').click()
    else:
        # Use a realistic flight number; verbatim casing is covered by the Node suite.
        await pg.get_by_test_id('arrival-flight').fill('HA 11')
        # Use the shared picker, including its quarter-hour controls.
        await pg.get_by_test_id('arrival-time').locator('..').get_by_role('button').click()
        picker = pg.locator('dialog.time-picker')
        await picker.get_by_role('button', name='Other time', exact=True).click()
        for _ in range(5):
            await picker.get_by_role('button', name='Increase hour', exact=True).click()
        for _ in range(2):
            await picker.get_by_role('button', name='Increase minute', exact=True).click()
        await picker.get_by_role('button', name='Set time', exact=True).click()
        await expect(pg.get_by_test_id('arrival-time')).to_have_value('17:30')
        await pg.get_by_test_id('return-time').fill('20:00')
        await pg.get_by_test_id('q-continue').click()
    for _ in range(4):  # Budget, group, ages, style.
        await pg.get_by_test_id('q-skip').click()
    await pg.get_by_test_id('fork-no').click()
    await wait_plan(pg)

async def select(pg, index):
    # JS .at() supports the Python-style -1 used for the return day below.
    date = await pg.evaluate('i=>__gonow.state.plan.days.at(i).date', index)
    await pg.get_by_test_id('db-day-'+date).click()
    return date

async def schedule(pg):
    return await pg.evaluate('DayBuilder.schedule().days')

async def edit(pg, arrival=None, departure=None):
    await pg.get_by_test_id('edit-flight').first.click()
    sheet = pg.locator('dialog.flight-sheet')
    await expect(sheet).to_be_visible()
    if arrival is not None:
        await sheet.get_by_test_id('arrival-time').fill(arrival)
    if departure is not None:
        await sheet.get_by_test_id('return-time').fill(departure)
    await sheet.get_by_role('button', name='Save flights', exact=True).click()
    await expect(sheet).to_have_count(0)

async def title_fits(pg):
    # Final audit: nowrap alone can hide the time. Measure the actual text range,
    # its line height AND unclipped width for standard/sample/estimated titles.
    titles = pg.locator('.db-flight-card .db-activity strong')
    assert await titles.count() > 0
    for title in await titles.all():
        geometry = await title.evaluate("""e=>{const r=document.createRange();r.selectNodeContents(e);
            const b=r.getBoundingClientRect(),s=getComputedStyle(e);
            return {text:e.textContent,height:b.height,line:parseFloat(s.lineHeight),
                width:b.width,available:e.clientWidth,scroll:e.scrollWidth};}""")
        assert geometry['height'] <= geometry['line'] + 1, geometry
        assert geometry['width'] <= geometry['available'] + 1, geometry
        assert geometry['scroll'] <= geometry['available'] + 1, geometry

async def checks(browser):
    for width in (1280, 390):
        for destination in ('Oahu', 'Seattle'):
            for skip in (True, False):
                ctx, pg = await new(browser, BASE, width, 844)
                try:
                    if destination == 'Seattle':
                        await routes(pg, 'seattle')
                    await enter(pg, destination, skip)
                    await select(pg, 0)
                    # Final audit: direction now lives in the Arrival/Return row label.
                    await title_fits(pg)
                    if skip:
                        await expect(pg.get_by_test_id('db-day-list')).to_contain_text('Est. ~')
                        await select(pg, -1)
                        await title_fits(pg)
                        await expect(pg.get_by_test_id('db-day-list')).to_contain_text('Est. ~')
                    else:
                        first = (await schedule(pg))[0]
                        assert all(i['start'] >= 1125 for i in first['items'] if i['kind'] not in ('flight', 'travel')), first
                        await expect(pg.get_by_test_id('db-day-list')).to_contain_text('HA 11 · 5:30 PM')
                        # A user lock stays at its exact time when a later landing conflicts.
                        row = pg.locator('[data-testid=db-day-list] [data-db-id=pick-checkin]')
                        await row.get_by_test_id('db-lock').click()
                        original = next(i for i in (await schedule(pg))[0]['items'] if i['id'] == 'pick-checkin')['start']
                        await edit(pg, arrival='21:00')
                        notice = row.get_by_test_id('db-note').filter(has_text='conflicts with your flight')
                        await expect(notice).to_have_count(1)
                        assert next(i for i in (await schedule(pg))[0]['items'] if i['id'] == 'pick-checkin')['start'] == original
                        assert await notice.evaluate('e=>e.getBoundingClientRect().height<48')
                        await notice.get_by_role('button', name='Edit', exact=True).click()
                        await pg.locator('dialog.flight-sheet').get_by_role('button', name='Cancel', exact=True).click()
                        await select(pg, -1)
                        before = await schedule(pg)
                        await edit(pg, departure='08:00')
                        after = await schedule(pg)
                        assert before[1:-1] == after[1:-1], 'Only travel days may change'
                        assert all(i['kind'] in ('flight', 'travel') for i in after[-1]['items']), after[-1]
                        assert await pg.evaluate('__gonow.state.answers.returnTime') == '08:00'
                        assert await pg.evaluate('__gonow.state.answers.arrivalFlight') == 'HA 11'
                    assert not await pg.evaluate('document.documentElement.scrollWidth>innerWidth')
                    await pg.screenshot(path=f'/tmp/flights-{destination}-{width}-{skip}.png', full_page=True)
                    print('PASS flights step, skip/edit/cutoffs/locks', destination, width, skip)
                finally:
                    await ctx.close()
        # The curated demo retains its sample defaults until edited.
        ctx, pg = await new(browser, BASE, width, 844)
        try:
            # The demo button lives on home, not in the start form.
            await open_home_flow(pg)
            await pg.get_by_test_id('demo-oahu').click()
            await wait_plan(pg)
            await select(pg, -1)
            await title_fits(pg)
            await select(pg, 0)
            await title_fits(pg)
            await select(pg, -1)
            before = await schedule(pg)
            assert not await pg.evaluate('Boolean(__gonow.state.answers.flightsStep)')
            await edit(pg, departure='08:00')
            after = await schedule(pg)
            assert before[1:-1] == after[1:-1]
            assert all(i['kind'] in ('travel', 'flight') for i in after[-1]['items']), after[-1]
            await expect(pg.get_by_test_id('db-day-list')).to_contain_text('8:00 AM')
            print('PASS curated demo flight edit', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8874, checks))
