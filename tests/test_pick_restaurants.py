import asyncio
from playwright.async_api import expect
from test_full import new
from test_pick_activities import open_picks
from test_wellness_home import serve_checks
async def checks(browser):
    for width in (1280,390):
        ctx,pg=await new(browser,'http://127.0.0.1:8861/index.html',width,844)
        try:
            await open_picks(pg);await pg.get_by_test_id('pick-next').click()
            await expect(pg.get_by_role('heading',name='Popular',exact=True)).to_be_visible()
            await expect(pg.get_by_role('heading',name='GoNow Picks',exact=True)).to_be_visible()
            for id in ('lamer','senia'):
                toggle=pg.locator('[data-pick-toggle='+id+']')
                await toggle.click(force=True)
                await expect(toggle).to_have_attribute('aria-pressed','true')
                await expect(toggle).to_have_attribute('aria-disabled','true')
            await pg.locator('[data-pick-info=senia]').click()
            await expect(pg.get_by_role('heading',name='Sample menu')).to_be_visible()
            await pg.get_by_role('button',name='Close',exact=True).click()
            await pg.get_by_test_id('pick-search').fill('poke')
            await expect(pg.locator('[data-pick-id=poke]')).to_be_visible()
            await expect(pg.locator('[data-pick-id=poke]')).to_contain_text('Ono Seafood')
            await pg.get_by_test_id('pick-search').fill('Senia')
            await expect(pg.get_by_text('GoNow Pick',exact=True).first).to_be_visible()  # v2: line leaf icon replaces 🌿
            card=pg.locator('[data-pick-id=senia]')
            await expect(card).to_contain_text('Booked Fri')  # v2: line lock icon replaces 🔒
            assert await card.locator('.pick-toggle > span > small').count()==2
            print('PASS restaurant sections, locked bookings, sample menu and mixed-view tag',width)
        finally: await ctx.close()
if __name__=='__main__': asyncio.run(serve_checks(8861,checks))
