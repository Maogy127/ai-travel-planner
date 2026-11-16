"""Supervisor Chromium suite: picker integration, desktop/mobile, port 8843."""
from test_full import wait_plan, open_day_pace, open_guidance, open_add_menu
import asyncio
from playwright.async_api import expect
from test_full import new
from test_wellness_home import serve_checks

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8843/index.html', width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            from test_full import continue_prep
            await continue_prep(pg)
            await wait_plan(pg)
            await pg.evaluate("window.__gonow.go('pace')")
            field = pg.get_by_test_id('sleep-bedtime')
            await field.locator('..').locator('.time-display').click()
            picker = pg.locator('dialog.time-picker')
            await expect(picker).to_be_visible()
            print('PASS timepicker check 20', width)
            box = await picker.bounding_box()
            viewport = pg.viewport_size
            if width < 768:
                assert abs(box['y'] + box['height'] - viewport['height']) < 2
                print('PASS timepicker check 24', width)
            else:
                assert box['width'] <= 360 and box['y'] > 0
                print('PASS timepicker check 26', width)
            await picker.get_by_role('button', name='9:00 PM', exact=True).click()
            await expect(field).to_have_value('21:00')
            print('PASS timepicker check 28', width)
            await expect(field.locator('..')).to_contain_text('9:00 PM')
            print('PASS timepicker check 29', width)
            await field.locator('..').locator('.time-display').click()
            await picker.get_by_text('Other time', exact=True).click()
            await picker.get_by_label('Increase minute', exact=True).click()
            await picker.get_by_label('Increase AM/PM', exact=True).click()
            await picker.get_by_text('Set time', exact=True).click()
            await expect(field).to_have_value('09:15')
            print('PASS timepicker check 35', width)
            await field.locator('..').locator('.time-display').click()
            await pg.keyboard.press('Escape')
            await expect(field.locator('..').locator('.time-display')).to_be_focused()
            print('PASS timepicker check 38', width)
            await field.locator('..').locator('.time-display').click()
            await pg.mouse.click(2, 2)
            await expect(picker).to_have_count(0)
            print('PASS timepicker check 41', width)
            await field.fill('22:30')
            assert await field.evaluate('(e)=>e.checkValidity() && e.value === "22:30"')
            print('PASS timepicker check 43', width)
            assert '--' not in await field.locator('..').inner_text()
            print('PASS timepicker check 44', width)
            await field.blur()
            await expect(field.locator('..').locator('.time-display')).to_have_text('10:30 PM')
            print('PASS timepicker check 46', width)
            assert await field.evaluate("e=>getComputedStyle(e).color==='rgba(0, 0, 0, 0)'")
            print('PASS timepicker check 47', width)
            await field.fill('10:30 PM')
            await expect(field).to_have_value('22:30')
            print('PASS timepicker check 49', width)
            await pg.evaluate("window.__gonow.go('plan')")
            row = pg.get_by_test_id('db-day-list').locator('[data-db-id]').filter(has=pg.get_by_test_id('db-time')).first
            await row.get_by_test_id('db-time').click()
            form = row.get_by_test_id('activity-time-form')
            await form.locator('[name=start]').locator('..').locator('.time-display').click()
            picker = pg.locator('dialog.time-picker')
            selected = await picker.locator('[data-time]').first.get_attribute('data-time')
            await picker.locator('[data-time]').first.click()
            await expect(form.locator('[name=start]')).to_have_value(selected)
            print('PASS timepicker check 58', width)
            await form.get_by_role('button', name='Save departure time').click()
            if await pg.get_by_test_id('move-conflict').count(): await pg.get_by_test_id('conflict-keep').click()
            await expect(form).to_have_count(0)
            print('PASS timepicker check 61', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8843, checks))
