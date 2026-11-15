"""Supervisor Chromium regressions: python3 tests/test_move_time.py, port 8845."""
from test_full import reopen_dashboard
from test_full import wait_plan
import asyncio
from playwright.async_api import expect
from test_full import new, card_action
from test_wellness_home import serve_checks
BASE='http://127.0.0.1:8845/index.html'
ID='2026-11-26-1'
KEY='gonow:daybuilder:oahu-demo-2026-11'

async def day(pg,date):
    await pg.get_by_test_id('db-day-'+date).click()

async def row(pg):
    return pg.get_by_test_id('db-day-list').locator('[data-db-id="'+ID+'"]')

async def schedule(pg):
    return await pg.evaluate('DayBuilder.schedule().days')

async def move(pg, untimed=False):
    await day(pg,'2026-11-26')
    await (await card_action(pg,await row(pg),'db-move-day')).click()
    await pg.get_by_test_id('unlock-accept').click()
    dialog=pg.get_by_test_id('move-day-dialog')
    await expect(dialog.locator('[name=start]')).to_have_value('06:00')
    await expect(dialog).to_contain_text('Time on new day')
    await expect(dialog.locator('.time-display')).to_be_visible()
    await dialog.locator('[name=date]').select_option('2026-11-27')
    if untimed: await dialog.locator('[name=start]').fill('')
    await dialog.get_by_role('button',name='Move',exact=True).click()

async def edit_three(pg):
    await (await row(pg)).get_by_test_id('db-time').click()
    form=pg.get_by_test_id('activity-time-form')
    await form.locator('[name=start]').fill('15:00')
    await form.get_by_role('button',name='Save activity time',exact=True).click()

async def checks(browser):
    for width in (1280,390):
        for view in ('plan','draft'):
            ctx,pg=await new(browser,BASE,width)
            try:
                await pg.get_by_test_id('demo-oahu').click()
                from test_full import continue_prep
                await continue_prep(pg)
                await pg.get_by_test_id('db-day-list').wait_for(timeout=45000)
                if view=='draft': await pg.evaluate("__gonow.go('draft')")
                before=await schedule(pg)
                move_before=await pg.evaluate("GoNowRings.scoreDay(DayBuilder.schedule().days[1].items,'athlete').values.move")
                await move(pg)
                # 06:00–07:30 now correctly overlaps the 07:15 Kewalo ride.
                await pg.get_by_test_id('conflict-keep').click()
                await expect(await row(pg)).to_be_visible()
                await edit_three(pg)
                prompt=pg.get_by_test_id('move-conflict')
                await expect(prompt).to_have_attribute('role','alertdialog')
                for title in ('Black Friday shopping','Uber from Ala Moana','Shower, change'):
                    await expect(prompt).to_contain_text(title)
                for action in ('replace','shift','keep'):
                    await expect(prompt.get_by_test_id('conflict-'+action).first).to_be_visible()
                # Native modal must retain keyboard focus; Escape cancels the edit.
                for _ in range(12):
                    await pg.keyboard.press('Tab')
                    assert await prompt.evaluate('(d)=>d.contains(document.activeElement)')
                await pg.keyboard.press('Escape')
                assert next(i for i in (await schedule(pg))[2]['items'] if i['id']==ID)['start']==360
                await edit_three(pg)
                await pg.get_by_test_id('conflict-keep').click()
                after=await schedule(pg)
                starts=[i['start'] for i in after[2]['items'] if i['start'] is not None]
                assert starts==sorted(starts)
                moved=next(i for i in after[2]['items'] if i['id']==ID)
                assert (moved['start'],moved['end'],moved['title'])==(900,990,'Diamond Head')
                assert moved['originalTitle']=='Diamond Head — 6:00 AM entry slot'
                await expect((await row(pg)).locator('[id^=db-title] strong, strong[id^=db-title]')).to_have_text('Diamond Head')
                await expect(await row(pg)).to_contain_text('Overlaps another stop')
                assert any('route changed' in i['title'] for i in after[1]['items'] if 'Uber Reserve' in i['title'])
                assert moved['travel'] and moved['travel']['minutes']>0
                idx=after[2]['items'].index(moved)
                assert after[2]['items'][idx+1]['travel'] is not None
                assert await pg.evaluate("GoNowRings.scoreDay(DayBuilder.schedule().days[1].items,'athlete').values.move") < move_before
                assert await pg.evaluate("GoNowRings.scoreDay(DayBuilder.schedule().days[2].items,'athlete').values.move") > await pg.evaluate("items=>GoNowRings.scoreDay(items,'athlete').values.move",before[2]['items'])
                # Lock an actual overlapping stop. Plain replace is disabled;
                # cascading shift must fail atomically when it reaches the lock.
                await pg.evaluate("""key=>{let s=JSON.parse(localStorage.getItem(key));s.days['2026-11-27'].items.find(i=>/shopping/i.test(i.title)).locked=true;localStorage.setItem(key,JSON.stringify(s));}""",KEY)
                await pg.reload()
                await reopen_dashboard(pg)
                await wait_plan(pg)
                await pg.evaluate("__gonow.go('"+view+"')")
                await day(pg,'2026-11-27')
                baseline=await schedule(pg)
                await edit_three(pg)
                prompt=pg.get_by_test_id('move-conflict')
                await expect(prompt.get_by_test_id('conflict-replace').filter(has_text='shopping')).to_be_disabled()
                await prompt.get_by_test_id('conflict-shift').click()
                await expect(prompt.get_by_role('status')).to_contain_text('locked')
                assert await schedule(pg)==baseline
                await pg.keyboard.press('Escape')
                # Replace moves an unlocked stop to the visible Needs a time section.
                await edit_three(pg)
                await pg.get_by_test_id('conflict-replace').filter(has_text='Shower').click()
                await expect(pg.get_by_test_id('needs-time')).to_contain_text('Shower')
                # An unlocked cascade succeeds and keeps chronological order.
                await pg.evaluate("""key=>{let s=JSON.parse(localStorage.getItem(key));s.days['2026-11-27'].items.forEach(i=>i.locked=false);localStorage.setItem(key,JSON.stringify(s));}""",KEY)
                await pg.reload()
                await reopen_dashboard(pg)
                await wait_plan(pg)
                await pg.evaluate("__gonow.go('"+view+"')")
                await day(pg,'2026-11-27')
                await edit_three(pg)
                await pg.get_by_test_id('conflict-shift').click()
                await expect(pg.get_by_test_id('move-conflict')).to_have_count(0)
                shifted=(await schedule(pg))[2]['items']
                shopping=next(i for i in shifted if 'shopping' in i['title'])
                assert shopping['start']==990
                assert [i['start'] for i in shifted]==sorted(i['start'] for i in shifted)
                # A separate untimed move exercises the hidden-plan-tray regression.
                await pg.evaluate('localStorage.removeItem('+repr(KEY)+')')
                await pg.reload()
                await reopen_dashboard(pg)
                await wait_plan(pg)
                await pg.evaluate("__gonow.go('"+view+"')")
                await move(pg,True)
                pending=pg.get_by_test_id('needs-time').locator('[data-db-id="'+ID+'"]')
                await expect(pending).to_be_visible()
                await expect(pending).to_contain_text('Needs a time')
                await pending.get_by_role('button',name='Pick a time',exact=True).click()
                await pg.get_by_test_id('schedule-dialog').locator('[name=start]').fill('15:00')
                await pg.get_by_test_id('schedule-dialog').get_by_role('button',name='Schedule',exact=True).click()
                await expect(pg.get_by_test_id('move-conflict')).to_contain_text('Black Friday shopping')
                await pg.get_by_test_id('conflict-keep').click()
                await expect(await row(pg)).to_be_visible()
                assert '6:00 AM' not in next(i for i in (await schedule(pg))[2]['items'] if i['id']==ID)['title']
                assert not await pg.evaluate('document.documentElement.scrollWidth>innerWidth')
                print('PASS move/time conflicts, ordering, locks, title, travel, rings, visible pending',width,view)
            finally:
                await ctx.close()
if __name__=='__main__':
    asyncio.run(serve_checks(8845,checks))
