"""Item F: direct day actions, custom sheet and protected reset; supervisor port 8876."""
import asyncio
from playwright.async_api import expect
from test_full import new, show_day, continue_prep, card_action, reopen
from test_wellness_home import serve_checks

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8876/index.html', width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await continue_prep(pg)
            await show_day(pg, 1)
            day = pg.get_by_test_id('plan-day')
            for testid in ('day-add', 'day-custom-add', 'db-tray-toggle', 'db-booking-toggle', 'db-booking-form'):
                await expect(pg.get_by_test_id(testid)).to_have_count(0)
            await expect(day.locator('.day-add-panel,#db-chest')).to_have_count(0)
            assert 'Anchor it' not in await day.inner_text()
            actions = day.locator('.day-primary-actions')
            assert await actions.locator('button').evaluate_all('(bs)=>bs.length===2&&Math.abs(bs[0].getBoundingClientRect().top-bs[1].getBoundingClientRect().top)<2')
            await pg.get_by_test_id('day-add-own').click()
            sheet = pg.get_by_test_id('add-own-sheet')
            await expect(sheet).to_be_visible()
            await expect(pg.get_by_test_id('add-own-name')).to_be_focused()
            await pg.get_by_test_id('add-own-submit').click()
            await expect(sheet.get_by_role('alert')).to_have_text('Add a name and start time')
            assert await sheet.get_by_role('alert').evaluate('e=>e.getBoundingClientRect().height<30')
            await pg.get_by_test_id('add-own-name').fill('My evening walk')
            await pg.get_by_test_id('add-own-start').fill('22:00')
            await pg.get_by_test_id('add-own-place').fill('Along the beach')
            await expect(sheet.locator('select,[role=combobox]')).to_have_count(0)
            await pg.get_by_test_id('add-own-submit').click()
            await expect(sheet).to_have_count(0)
            # Item F: pairs group neighbors; target one item and reject duplicate rendering.
            walk = day.locator('[data-db-id]').filter(has=pg.get_by_test_id('db-activity').locator('strong').filter(has_text='My evening walk'))
            await expect(walk).to_have_count(1)
            await expect(walk.get_by_test_id('db-time')).to_contain_text('10:00 PM')
            await expect(walk.get_by_test_id('db-locked-tag')).to_have_count(0)
            await pg.get_by_test_id('day-add-own').click()
            await pg.get_by_test_id('add-own-name').fill('Booked night visit')
            await pg.get_by_test_id('add-own-start').fill('23:00')
            await pg.get_by_test_id('add-own-end').fill('23:30')
            await pg.get_by_test_id('add-own-booked').check()
            await pg.get_by_test_id('add-own-submit').click()
            # Item F: pairs group neighbors; target one item and reject duplicate rendering.
            booked = day.locator('[data-db-id]').filter(has=pg.get_by_test_id('db-activity').locator('strong').filter(has_text='Booked night visit'))
            await expect(booked).to_have_count(1)
            await expect(booked.get_by_test_id('db-time')).to_contain_text('11:00 PM')
            await expect(booked.get_by_test_id('db-locked-tag')).to_have_text('Locked')
            assert await booked.get_by_test_id('db-locked-tag').evaluate('e=>e.tagName==="SPAN"&&!e.hasAttribute("tabindex")')
            # A user lock and a booking survive reset; a removed suggestion returns.
            photos = day.locator('[data-db-id=photos]')
            await photos.locator('button[data-testid=db-lock]').click()
            # Compare time content without whitespace: inner_text adds a layout line break.
            before = ''.join((await photos.get_by_test_id('db-time').text_content()).split())
            # Use plain breakfast: generated return transport re-derives after removal.
            # Removal keeps the item in Needs a time; only the day row disappears.
            removable = day.locator('[data-db-zone=day][data-db-id="2026-11-26-4"]')
            title = await removable.get_by_test_id('db-activity').locator('strong').first.inner_text()
            remove_action = await card_action(pg, removable, 'db-remove')
            # The removed ideas chest is no longer the destination in action copy.
            await expect(remove_action).to_have_text('Remove from day')
            await expect(remove_action).to_have_attribute('aria-label', 'Remove from day ' + title)
            await remove_action.click()
            await expect(removable).to_have_count(0)
            pending = day.get_by_test_id('needs-time').locator('[data-db-zone=tray][data-db-id="2026-11-26-4"]')
            await expect(pending).to_be_visible()
            await pg.get_by_test_id('day-reset').click()
            await expect(day.locator('.day-reset-prompt > span')).to_have_text('Reset this day? Locked and booked items stay.')
            await pg.get_by_test_id('day-reset-cancel').click()
            await expect(removable).to_have_count(0)
            await pg.get_by_test_id('day-reset').click()
            await pg.get_by_test_id('day-reset-confirm').click()
            # Reset restores the day row and removes its untimed tray copy.
            await expect(removable).to_have_count(1)
            await expect(pending).to_have_count(0)
            await expect(removable.get_by_test_id('db-activity').locator('strong').first).to_have_text(title)
            assert ''.join((await photos.get_by_test_id('db-time').text_content()).split()) == before
            await expect(booked.get_by_test_id('db-locked-tag')).to_have_text('Locked')
            await expect(walk).to_have_count(0)
            await pg.reload()
            await reopen(pg)
            await show_day(pg, 1)
            await expect(booked.get_by_test_id('db-locked-tag')).to_have_text('Locked')
            await pg.get_by_test_id('day-add-own').click()
            await pg.keyboard.press('Escape')
            await expect(sheet).to_have_count(0)
            await expect(pg.get_by_test_id('day-add-own')).to_be_focused()
            await pg.get_by_test_id('day-add-own').click()
            await sheet.get_by_role('button', name='Cancel', exact=True).click()
            await expect(sheet).to_have_count(0)
            assert await pg.evaluate('document.documentElement.scrollWidth <= innerWidth')
            print('PASS add simplify', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8876, checks))
