"""Dashboard regressions; supervisor runs Chromium on port 8849."""
import asyncio
from playwright.async_api import expect
from test_full import new, continue_prep, reopen_dashboard, dashboard_action
from test_wellness_home import serve_checks

BASE = 'http://127.0.0.1:8849/index.html'

async def audit(pg):
    assert not await pg.evaluate('document.documentElement.scrollWidth > innerWidth')
    splits = await pg.locator('[data-testid=dashboard]').evaluate(r'''root => {
      const failures=[], walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      let n; while(n=walker.nextNode()) {
        if(!n.parentElement.checkVisibility())continue;
        for(const m of n.textContent.matchAll(/\S+/g)) {
          const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);
          const boxes=[...r.getClientRects()].filter(r=>r.width&&r.height);
          if(boxes.some(b=>Math.abs(b.top-boxes[0].top)>1))failures.push(m[0]);
        }
      } return failures;
    }''')
    assert not splits, splits

async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width, 900)
        try:
            await expect(pg.get_by_test_id('home-screen')).to_be_visible()
            await expect(pg.get_by_test_id('dashboard')).to_have_count(0)
            await pg.get_by_test_id('demo-oahu').click()
            await pg.get_by_test_id('confirm-plan').click()
            await continue_prep(pg)
            await pg.reload()
            await expect(pg.get_by_test_id('dashboard')).to_be_visible()
            card=pg.get_by_test_id('trip-card')
            await expect(card).to_have_count(1)
            await expect(card).to_contain_text('Oahu')
            await expect(card).to_contain_text('2026')
            await expect(card).to_contain_text('Trip prep ·')
            expected = await pg.evaluate("() => {const t=JSON.parse(localStorage.getItem('gonow:trips'))[0];return GoNowDashboard.status(t,{timeZone:Engine.matchDestination(t.destination).tz}).label;}")
            await expect(card.get_by_test_id('trip-status')).to_have_text(expected)
            await expect(card).to_contain_text('Nov 25')
            await expect(card).to_contain_text('Nov 29')
            await audit(pg)
            await pg.get_by_test_id('new-trip').click()
            await expect(pg.get_by_test_id('home-screen')).to_be_visible()
            await pg.get_by_test_id('back-dashboard').click()
            await expect(card).to_have_count(1)
            await pg.get_by_test_id('new-trip').click()
            await pg.get_by_test_id('demo-oahu').click()
            await pg.get_by_test_id('confirm-plan').click()
            await continue_prep(pg)
            await pg.reload()
            await expect(card).to_have_count(2)
            await dashboard_action(pg, 'delete-trip')
            alert=pg.get_by_role('alertdialog')
            await expect(alert).to_contain_text('Delete your Oahu trip?')
            await expect(alert).to_contain_text('This removes it from this device.')
            await expect(alert.get_by_role('button', name='Cancel')).to_be_focused()
            await alert.get_by_role('button', name='Cancel').click()
            await expect(card).to_have_count(2)
            await dashboard_action(pg, 'delete-trip')
            await alert.get_by_role('button', name='Delete', exact=True).click()
            await expect(card).to_have_count(1)
            await pg.goto(BASE+'?fast=1&today=2026-11-26')
            await expect(card.get_by_test_id('trip-status')).to_have_text('In progress')
            today=pg.get_by_test_id('today-block')
            await expect(today).to_contain_text('Nov 26')
            await expect(today).to_contain_text('Next · 5:35 AM')
            await expect(today).to_contain_text('Move')
            await audit(pg)
            # Legacy single-trip keys migrate once, and deletion stays deleted.
            await pg.evaluate("""() => {localStorage.clear();localStorage.setItem('gonow:answers', JSON.stringify({destination:'Oahu',start:'2026-11-25',end:'2026-11-29'}));localStorage.setItem('gonow:lastTrip',JSON.stringify({id:'oahu-demo-2026-11'}));} """)
            await pg.reload()
            await expect(card).to_have_count(1)
            await pg.reload()
            await expect(card).to_have_count(1)
            await dashboard_action(pg, 'delete-trip')
            await alert.get_by_role('button',name='Delete',exact=True).click()
            await pg.reload()
            await expect(pg.get_by_test_id('home-screen')).to_be_visible()
            await expect(card).to_have_count(0)
            # Existing list is retained without making a duplicate legacy trip.
            await pg.evaluate("""() => localStorage.setItem('gonow:trips',JSON.stringify([{id:'old-a',destination:'Kyoto',answers:{destination:'Kyoto'},snapshot:null},{id:'old-b',destination:'Lisbon',answers:{destination:'Lisbon'},snapshot:{}}]))""")
            await pg.reload()
            await expect(card).to_have_count(2)
            await expect(card.first.get_by_test_id('trip-status')).to_have_text('Draft')
            await expect(card.last.get_by_test_id('trip-status')).to_have_text('Ready')
            await audit(pg)
            print('PASS dashboard',width)
        finally:
            await ctx.close()

if __name__ == '__main__':
    asyncio.run(serve_checks(8849, checks))
