"""Supervisor-run optional check-in regressions, desktop/mobile, port 8836."""
from test_full import reopen_dashboard
from test_full import wait_plan, open_day_pace, open_guidance, open_add_menu
import asyncio
import re
from playwright.async_api import expect
from test_full import new, show_day
from test_wellness_home import serve_checks
from test_voice import MOCK
BASE = 'http://127.0.0.1:8836/index.html'

async def reopen(pg, day=3):
    await pg.reload()
    await reopen_dashboard(pg)
    await wait_plan(pg)
    await wait_plan(pg)
    await show_day(pg, day)

async def record(pg, key, date, person=0):
    return await pg.evaluate('([key,date,id])=>GoNowCheckin.get(key,date,id)', [key,date,'traveler-'+str(person)])

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE+'?today=2026-11-28&', width)
        try:
            await pg.add_init_script(MOCK)
            await pg.reload()
            await pg.get_by_test_id('demo-oahu').click()
            from test_full import continue_prep
            await continue_prep(pg)
            await wait_plan(pg)
            await pg.get_by_test_id('track-toggle').click()
            await expect(pg.get_by_test_id('morning-checkin')).to_have_count(0)
            await pg.evaluate("__gonow.go('food')")
            await expect(pg.get_by_test_id('morning-checkin')).to_have_count(0)
            await pg.evaluate("__gonow.go('draft')")
            await expect(pg.get_by_test_id('morning-checkin')).to_have_count(0)
            await pg.evaluate("__gonow.go('plan')")
            date = await show_day(pg, 3)
            assert await pg.locator('#day-3 .day-title').evaluate('(e)=>e.nextElementSibling.matches(".wellness-rings") && e.nextElementSibling.nextElementSibling.matches("[data-testid=day-feel]")')
            assert 'Best moment' not in await pg.locator('body').inner_text()
            await expect(pg.get_by_test_id('moments-summary')).to_have_count(0)
            shared = await pg.evaluate('DayBuilder.schedule().days[3].items')
            await open_day_pace(pg)
            await pg.locator('[data-testid=day-pace-option][data-value=athlete]').check()
            await pg.get_by_test_id('morning-checkin').locator('summary').click()
            mic = pg.get_by_test_id('checkin-mic')
            await mic.dispatch_event('pointerdown', {'button':0})
            await expect(mic).to_have_attribute('aria-pressed', 'true')
            await expect(pg.get_by_test_id('checkin-status')).to_have_text('Listening…')
            await pg.evaluate("voiceResult('legs sore, slept badly', true)")
            await expect(pg.get_by_test_id('checkin-status')).to_have_text('Listening…')
            await mic.dispatch_event('pointerup')
            await expect(pg.locator('[data-testid=checkin-soreness][data-value=some]')).to_have_attribute('aria-pressed','true')
            await expect(pg.locator('[data-testid=checkin-sleep][data-value=poor]')).to_have_attribute('aria-pressed','true')
            await pg.get_by_test_id('checkin-save').click()
            await expect(pg.get_by_test_id('checkin-complete')).to_be_visible()
            rings = pg.get_by_test_id('traveler-rings')
            await expect(rings.nth(0).locator('svg')).to_have_attribute('aria-label', re.compile('goal 54 min'))
            await expect(rings.nth(1).locator('svg')).to_have_attribute('aria-label', re.compile('goal 90 min'))
            # Saving a check-in offers choices; it never edits the shared plan.
            assert await pg.evaluate('DayBuilder.schedule().days[3].items') == shared
            suggestions=pg.get_by_test_id('checkin-suggestion')
            assert await suggestions.count() > 0
            apply=pg.get_by_test_id('checkin-apply').first
            item_id=await apply.get_attribute('data-id')
            before_other=await rings.nth(1).inner_text()
            before_person=await rings.nth(0).locator('svg').get_attribute('aria-label')
            await apply.click()
            await expect(pg.get_by_test_id('traveler-alternative').first).to_be_visible()
            assert await pg.evaluate('DayBuilder.schedule().days[3].items') == shared
            assert await rings.nth(1).inner_text() == before_other
            assert await rings.nth(0).locator('svg').get_attribute('aria-label') != before_person
            c=await record(pg,'gonow.checkin.v1',date)
            assert item_id in c['alternatives']
            assert all(not i.get('locked') for i in shared if i['id'] in c['alternatives'])
            await pg.get_by_test_id('checkin-traveler').nth(1).click()
            await pg.get_by_test_id('morning-checkin').locator('summary').click()
            await pg.get_by_test_id('checkin-lang').select_option('zh-CN')
            await pg.get_by_test_id('checkin-mic').focus()
            await pg.keyboard.press('Space')
            await expect(pg.get_by_test_id('checkin-mic')).to_have_attribute('aria-pressed','true')
            await pg.evaluate("voiceResult('腿很酸，没睡好',true)")
            await pg.keyboard.press('Enter')
            await expect(pg.locator('[data-testid=checkin-soreness][data-value="a lot"]')).to_have_attribute('aria-pressed','true')
            await pg.get_by_test_id('checkin-save').click()
            dismiss=pg.get_by_test_id('checkin-dismiss').first
            dismissed_id=await dismiss.get_attribute('data-id')
            await dismiss.click()
            await reopen(pg)
            assert (await record(pg,'gonow.checkin.v1',date))['soreness']=='some'
            assert (await record(pg,'gonow.checkin.v1',date,1))['soreness']=='a lot'
            assert dismissed_id in (await record(pg,'gonow.checkin.v1',date,1))['dismissed']
            await pg.get_by_test_id('checkin-traveler').nth(1).click()
            assert not await pg.locator('[data-testid=checkin-dismiss][data-id="'+dismissed_id+'"]').count()
            await pg.goto(BASE+'?today=2026-11-27')
            await reopen_dashboard(pg)
            await wait_plan(pg)
            next_date=await show_day(pg,2)
            await pg.get_by_test_id('morning-checkin').locator('summary').click()
            await pg.get_by_test_id('checkin-skip').click()
            await reopen(pg,2)
            await expect(pg.get_by_test_id('checkin-complete')).to_contain_text('skipped')
            assert (await record(pg,'gonow.checkin.v1',next_date))['skipped']
            assert not await pg.get_by_test_id('morning-checkin').count()
            await pg.locator('.day-head > .wellness-rings [data-testid=ring-breakdown-toggle]').click()
            await expect(pg.locator('.ring-encouragement').first).to_have_text('No recovery block today. Rest is part of the plan — add a pool or stretch break?')
            text=await pg.locator('.day-head').inner_text()
            assert not re.search(r'\b(missed|failed|behind|fell short|only|not enough)\b',text,re.I)
            # Check all currently visible new controls, then the expanded optional fields.
            await pg.goto(BASE+'?today=2026-11-25')
            await reopen_dashboard(pg)
            await wait_plan(pg)
            await show_day(pg,0)
            await pg.get_by_test_id('morning-checkin').locator('summary').click()
            for button in await pg.locator('.day-feel button,.day-feel select,.day-feel summary').all():
                if await button.is_visible():
                    box=await button.bounding_box()
                    assert box['width']>=44 and box['height']>=44, (await button.inner_text(),box)
            assert not await pg.evaluate('document.documentElement.scrollWidth>innerWidth')
            print('PASS check-in, voice, per-traveler goals/swaps, persistence, skip, copy and targets',width)
        finally:
            await ctx.close()
        await solo_checks(browser,width)

async def solo_checks(browser,width):
    ctx,pg=await new(browser,BASE+'?today=2026-11-28&',width)
    try:
        await pg.get_by_test_id('demo-oahu').click()
        from test_full import continue_prep
        await continue_prep(pg)
        await wait_plan(pg)
        await pg.evaluate("__gonow.state.answers.who='solo'; __gonow.go('plan')")
        date=await show_day(pg,3)
        original=await pg.evaluate('DayBuilder.schedule().days[3].items')
        await pg.get_by_test_id('morning-checkin').locator('summary').click()
        await pg.locator('[data-testid=checkin-energy][data-value=low]').click()
        await pg.get_by_test_id('checkin-save').click()
        await expect(pg.get_by_test_id('checkin-complete')).to_have_text('Morning check-in saved · Edit')
        await pg.get_by_test_id('checkin-edit').click()
        await expect(pg.get_by_test_id('morning-checkin')).to_have_attribute('open', '')
        await pg.get_by_test_id('checkin-save').click()
        assert await pg.evaluate('DayBuilder.schedule().days[3].items')==original
        apply=pg.get_by_test_id('checkin-apply').first
        item_id=await apply.get_attribute('data-id')
        await apply.click()
        updated=await pg.evaluate('DayBuilder.schedule().days[3].items')
        item=next(i for i in updated if i['id']==item_id)
        before=next(i for i in original if i['id']==item_id)
        assert item['title']=='Beach walk'
        assert (item['start'],item['end'])==(before['start'],before['end'])
        assert [i for i in updated if i.get('locked')]==[i for i in original if i.get('locked')]
        await reopen(pg)
        assert await pg.evaluate("DayBuilder.schedule().days[3].items.find(i=>i.id==="+repr(item_id)+").title")=='Beach walk'
        await pg.goto(BASE+'?today=2026-11-25')
        await reopen_dashboard(pg)
        await wait_plan(pg)
        await show_day(pg,0)
        await pg.get_by_test_id('morning-checkin').locator('summary').click()
        await pg.locator('[data-testid=checkin-energy][data-value=high]').click()
        await pg.get_by_test_id('checkin-save').click()
        await expect(pg.get_by_test_id('checkin-apply')).to_have_text('Add')
        await pg.get_by_test_id('checkin-apply').click()
        assert await pg.evaluate("DayBuilder.schedule().days[0].items.some(i=>i.title==='Sunrise run')")
        print('PASS solo explicit swap/add, slot preservation, locks and reload',width)
    finally:
        await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8836,checks))
