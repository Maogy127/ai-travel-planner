"""Travel departure UI regression. Uses its own HTTP server on port 8817."""
import asyncio
import re
import subprocess
import sys
from test_full import new, SITE
from playwright.async_api import async_playwright, expect


async def checks(browser):
    ctx, pg = await new(browser, 'http://127.0.0.1:8817/index.html', 1280, 900)
    try:
        assets = await pg.locator('script[src],link[rel=stylesheet]').evaluate_all(
            "els => els.map(e => e.getAttribute('src') || e.getAttribute('href')).filter(p => /^(js|css)\\//.test(p))")
        assert len(assets) == 10
        for path in assets:
            assert path.endswith('?v=340e0c5-travel'), path
            assert (await ctx.request.get('http://127.0.0.1:8817/' + path)).status == 200
        print('PASS versioned assets load with HTTP 200')
        await pg.get_by_test_id('demo-oahu').click()
        # Demo generation is asynchronous; wait before navigating away from it.
        await expect(pg.get_by_test_id('db-root')).to_be_visible()
        await pg.evaluate("window.__gonow.go('draft')")
        await expect(pg.get_by_test_id('draft-screen')).to_be_visible()
        target_date = await pg.evaluate('''() => {
            const dates = new Set(window.__gonow.state.plan.days.map(d => d.date));
            return DayBuilder.schedule().days.find(d => dates.has(d.date)
                && ['uber-kahala', 'uber-home', 'senia', 'prep-senia']
                    .every(id => d.items.some(i => i.id === id)))?.date;
        }''')
        assert target_date, 'No plan day contains the required rides and booking'
        await pg.get_by_test_id('db-day-' + target_date).click()
        day = pg.get_by_test_id('db-day-list')
        ride = day.locator('[data-db-id=uber-kahala]')
        home = day.locator('[data-db-id=uber-home]')
        untouched = await home.get_by_test_id('db-time').text_content()
        assert ' est.' not in untouched
        await expect(home.get_by_test_id('db-time')).not_to_have_attribute(
            'aria-label', re.compile('estimated arrival'))
        await expect(ride.get_by_test_id('db-time')).not_to_contain_text(' est.')
        dinner = day.locator('[data-db-id=senia]')
        dinner_time = await dinner.get_by_test_id('db-time').text_content()
        prep = day.locator('[data-db-id=prep-senia]')
        await expect(prep.locator('[data-db-action=edit-time]')).to_have_count(0)
        await expect(ride.locator('button[data-testid=db-time]')).to_have_count(1)
        await ride.get_by_test_id('db-time').click()
        form = ride.get_by_test_id('activity-time-form')
        await expect(form).to_be_visible()
        await expect(form.locator('[data-time-estimate]')).to_contain_text('est.')
        await form.locator('[name=start]').fill('16:00')
        await expect(form.locator('[name=end]')).to_have_value('16:30')
        await form.get_by_role('button', name='Save departure time').click()
        await expect(ride.get_by_test_id('db-time')).to_have_text('4:00 PM–4:30 PM est.')
        await expect(ride.get_by_test_id('db-time')).to_have_attribute(
            'aria-label', 'Edit time: 4:00 PM to 4:30 PM estimated arrival')
        await expect(prep.get_by_test_id('db-time')).to_have_text('4:30 PM–5:30 PM')
        print('PASS clickable travel editor, live estimated arrival, unlocked reflow, prep unchanged')
        await ride.get_by_test_id('db-time').click()
        await form.locator('[name=end]').fill('16:45')
        await form.get_by_role('button', name='Save departure time').click()
        await expect(ride.get_by_test_id('db-time')).to_have_text('4:00 PM–4:45 PM')
        # A saved explicit arrival remains explicit when reopening and changing departure.
        await ride.get_by_test_id('db-time').click()
        await form.locator('[name=start]').fill('16:15')
        await expect(form.locator('[name=end]')).to_have_value('16:45')
        await form.get_by_role('button', name='Save departure time').click()
        await expect(ride.get_by_test_id('db-time')).to_have_text('4:15 PM–4:45 PM')
        print('PASS explicit arrival persists without estimate label')
        await pg.reload()
        await expect(pg.get_by_test_id('home-screen')).to_be_visible()
        await pg.get_by_test_id('edit-draft').first.click()
        await expect(pg.get_by_test_id('draft-screen')).to_be_visible()
        await expect(pg.get_by_test_id('db-root')).to_be_visible()
        await pg.get_by_test_id('db-day-' + target_date).click()
        await expect(ride.get_by_test_id('db-time')).to_have_text('4:15 PM–4:45 PM')
        await expect(home.get_by_test_id('db-time')).to_have_text(untouched)
        print('PASS reload persistence and untouched automatic ride')
        await ride.get_by_test_id('db-time').click()
        await form.locator('[name=start]').fill('18:00')
        await form.locator('[name=end]').fill('18:30')
        await form.get_by_role('button', name='Save departure time').click()
        await expect(ride).to_have_class(re.compile(r'\bdb-conflict\b'))
        await expect(ride.get_by_test_id('db-note').first).to_be_visible()
        await expect(dinner.get_by_test_id('db-time')).to_have_text(dinner_time)
        print('PASS visible locked-booking conflict; booking stays fixed')
        # Locked travel uses the same explicit unlock gate as locked activities.
        await ride.get_by_test_id('db-lock').click()
        await ride.get_by_test_id('db-time').click()
        await expect(pg.get_by_test_id('unlock-confirm')).to_be_visible()
        await pg.get_by_test_id('unlock-decline').click()
        await expect(form).to_have_count(0)
        print('PASS locked travel requires unlocking')
    finally:
        await ctx.close()


async def main():
    server = subprocess.Popen([sys.executable, '-m', 'http.server', '8817', '--bind', '127.0.0.1'], cwd=SITE,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for attempt in range(50):
            if server.poll() is not None:
                raise RuntimeError('HTTP server failed to start on port 8817')
            try:
                reader, writer = await asyncio.open_connection('127.0.0.1', 8817)
                writer.close()
                await writer.wait_closed()
                break
            except OSError:
                await asyncio.sleep(0.1)
        else:
            raise RuntimeError('HTTP server did not become ready')
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            try:
                await checks(browser)
            finally:
                await browser.close()
    finally:
        server.terminate()
        server.wait()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as error:
        print('FAIL travel time:', error)
        raise
