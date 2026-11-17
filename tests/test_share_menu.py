"""Item G: header exports and keyboard access; supervisor port 8877."""
import asyncio
from playwright.async_api import expect
from test_full import new, continue_prep, open_share_menu, overflow, dashboard_action
from test_wellness_home import serve_checks

async def check_header(pg):
    toggle = pg.get_by_test_id('share-menu-toggle')
    await expect(toggle).to_be_visible()
    await expect(pg.locator('footer.export-actions')).to_have_count(0)
    assert not await pg.locator('footer').filter(has_text='Share & export').count()
    assert await toggle.evaluate('''e=>{const b=e.getBoundingClientRect(),h=e.closest('header').getBoundingClientRect(),t=e.closest('header').querySelector('h1').getBoundingClientRect();return h.right-b.right<40&&Math.abs((b.top+b.bottom-t.top-t.bottom)/2)<3}''')
    # The one-line header must reserve space for Share even on narrow screens.
    assert await toggle.evaluate('''e=>{
        const b=e.getBoundingClientRect(),t=e.closest('header').querySelector('h1'),r=t.getBoundingClientRect(),s=getComputedStyle(t);
        // Wide: one line with ellipsis. Narrow (<=600px): up to two clamped lines so short names like "Oahu, Hawaii" are not cut to "Oahu, ...".
        const clamp=innerWidth<=600?s.webkitLineClamp==='2':s.whiteSpace==='nowrap'&&s.textOverflow==='ellipsis';
        return r.width>0&&r.right<=b.left&&b.left>=0&&b.right<=innerWidth&&s.overflow==='hidden'&&clamp;
    }''')
    if pg.viewport_size['width'] == 390:
        title = pg.locator('.plan-heading-row h1')
        original = await title.text_content()
        try:
            await title.evaluate('(e)=>{e.textContent="A long trip title with plenty of room to explore Oahu"}')
            assert await title.evaluate('(e)=>e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight')
            assert await toggle.evaluate('(e)=>{const b=e.getBoundingClientRect(),t=e.closest("header").querySelector("h1").getBoundingClientRect();return t.right<=b.left&&b.right<=innerWidth}')
            await expect(toggle).to_be_visible()
        finally:
            await title.evaluate('(e,text)=>{e.textContent=text}', original)
    assert not await overflow(pg)

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, 'http://127.0.0.1:8877/index.html', width)
        try:
            await pg.get_by_test_id('demo-oahu').click()
            await continue_prep(pg)
            await check_header(pg)
            toggle = pg.get_by_test_id('share-menu-toggle')
            menu = pg.get_by_test_id('share-menu')
            await expect(menu).to_be_hidden()
            await open_share_menu(pg)
            await expect(menu).to_be_visible()
            # Item I adds Invite friends as the final keyboard menu action.
            await expect(menu.get_by_role('menuitem')).to_have_text(['Print / Save as PDF', 'Copy as text', 'Share link', 'Download calendar', 'Invite friends'])
            await expect(pg.get_by_test_id('print-plan')).to_be_focused()
            await pg.keyboard.press('ArrowUp')
            await expect(pg.get_by_test_id('invite-friends')).to_be_focused()
            await pg.keyboard.press('ArrowDown')
            await expect(pg.get_by_test_id('print-plan')).to_be_focused()
            await pg.keyboard.press('End')
            await expect(pg.get_by_test_id('invite-friends')).to_be_focused()
            await pg.keyboard.press('Home')
            await expect(pg.get_by_test_id('print-plan')).to_be_focused()
            await pg.keyboard.press('Escape')
            await expect(menu).to_be_hidden()
            await expect(toggle).to_be_focused()
            await expect(toggle).to_have_attribute('aria-expanded', 'false')
            await toggle.press('ArrowDown')
            await expect(menu).to_be_visible()
            # Mobile hides the subtitle; the trip heading remains visible outside the menu.
            await pg.locator('.plan-heading-row h1').click()
            await expect(menu).to_be_hidden()
            await expect(toggle).to_be_focused()
            await expect(toggle).to_have_attribute('aria-expanded', 'false')
            await pg.evaluate('''()=>{window.__printCalls=0;window.print=()=>window.__printCalls++;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedText=text}}})}''')
            await open_share_menu(pg)
            assert not await overflow(pg)
            await pg.get_by_test_id('print-plan').click()
            assert await pg.evaluate('window.__printCalls') == 1
            await expect(menu).to_be_hidden()
            await expect(toggle).to_be_focused()
            await open_share_menu(pg)
            await pg.get_by_test_id('copy').click()
            await expect(pg.locator('#toast')).to_have_text('Copied as text.')
            assert await pg.evaluate('window.__copiedText.length > 100')
            await expect(menu).to_be_hidden()
            await open_share_menu(pg)
            async with pg.expect_download() as pending:
                await pg.get_by_test_id('download-ics').click()
            download = await pending.value
            assert download.suggested_filename.endswith('.ics')
            await expect(menu).to_be_hidden()
            await open_share_menu(pg)
            await pg.get_by_test_id('share-link').click()
            await expect(menu).to_be_hidden()
            url = await pg.get_by_test_id('share-url').input_value()
            assert '#trip=' in url
            await pg.get_by_test_id('modal-0').click()
            await open_share_menu(pg)
            await pg.emulate_media(media='print')
            await expect(toggle).to_be_hidden()
            await expect(menu).to_be_hidden()
            await pg.emulate_media(media='screen')
            await pg.keyboard.press('Escape')
            await pg.get_by_test_id('logo').click()
            await dashboard_action(pg, 'view-finished')
            await expect(pg.get_by_test_id('finished-banner')).to_be_visible()
            await check_header(pg)
            await open_share_menu(pg)
            await expect(menu.get_by_role('menuitem')).to_have_count(5)
            # Shared copies render the same header actions, rather than a separate footer.
            await pg.goto(url)
            await continue_prep(pg)
            await expect(pg.get_by_test_id('shared-banner')).to_be_visible()
            await check_header(pg)
            await open_share_menu(pg)
            await expect(menu.get_by_role('menuitem')).to_have_count(5)
            print('PASS header Share menu', width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8877, checks))
