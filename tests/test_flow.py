"""Home, draft tray, on-device search, restrictions, and finished-plan isolation."""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_full as t

async def flow(b, base):
  ctx, pg = await t.new(b, base, 1280, 900)
  ok = t.ok
  ok('home first visit', await pg.get_by_test_id('home-screen').is_visible() and await pg.get_by_test_id('saved-trip').count()==0 and 'on this device' in (await pg.get_by_test_id('storage-note').inner_text()).lower())
  ok('home start and sample', await pg.get_by_test_id('start-new-trip').is_visible() and await pg.get_by_test_id('demo-oahu').is_visible())
  await pg.get_by_test_id('demo-oahu').click()
  await pg.get_by_test_id('db-root').wait_for()
  ok('sample keeps La Mer lock', await pg.get_by_test_id('db-day-list').locator('[data-db-id=lamer]').get_by_test_id('db-time').evaluate('e=>e.textContent')=='7:30 PM–9:30 PM')
  await pg.get_by_test_id('logo').click()
  card = pg.get_by_test_id('saved-trip').first
  ok('returning card', await card.is_visible() and 'Oahu' in await card.inner_text() and '2026' in await card.inner_text())
  ok('card actions', await card.get_by_test_id('edit-draft').is_visible() and await card.get_by_test_id('view-finished').is_enabled())
  await card.get_by_test_id('edit-draft').click()
  await pg.get_by_test_id('draft-screen').wait_for()
  tray = pg.get_by_test_id('activity-tray')
  ok('desktop tray visible', await tray.is_visible())
  sticky = await tray.evaluate('e=>getComputedStyle(e).position')
  ok('desktop tray sticky', sticky=='sticky', sticky)
  ok('search is on-device', 'not a live worldwide' in (await pg.get_by_test_id('search-honesty').inner_text()).lower())
  ok('add is not booking', 'does not book' in (await tray.inner_text()).lower())
  await pg.get_by_test_id('activity-search').fill('zzzz-not-a-place')
  ok('no results stays honest', await pg.get_by_test_id('activity-no-results').is_visible())
  await pg.get_by_test_id('activity-search').fill('pillbox')
  row = pg.get_by_test_id('activity-result').first
  ok('pillbox result', 'Lanikai' in await row.inner_text() and await row.locator('img').count()==1 and 'estimate' in (await row.inner_text()).lower())
  ok('pillbox restriction visible', await row.get_by_test_id('activity-restriction').count()>=1 and 'Unconfirmed' in await row.inner_text())
  await row.get_by_test_id('activity-day').select_option('2026-11-25')
  await row.get_by_test_id('activity-add').click()
  await pg.get_by_test_id('db-day-2026-11-25').click()
  ok('added pillbox reflowed', await pg.get_by_test_id('db-day-list').locator('[data-db-id=chest-9]').count()==1)
  await pg.get_by_test_id('activity-search').fill('cocktail')
  bar = pg.get_by_test_id('activity-result').filter(has_text='Sunset bar')
  ok('21+ blocks the bar for ages 18 and 19', await bar.get_by_test_id('activity-add').is_disabled() and '21' in await bar.inner_text())
  await pg.get_by_test_id('activity-search').fill('optional drinks')
  opt = pg.get_by_test_id('activity-result').first
  ok('optional alcohol does not block dinner', await opt.get_by_test_id('activity-add').is_enabled() and 'does not block' in (await opt.inner_text()).lower())
  await pg.get_by_test_id('activity-search').fill('parasail')
  sail = pg.get_by_test_id('activity-result').first
  ok('unconfirmed parasail limits stay addable', 'Unconfirmed' in await sail.inner_text() and await sail.get_by_test_id('activity-add').is_enabled())
  await pg.get_by_test_id('db-day-2026-11-26').click()
  before = await pg.evaluate("window.__gonow.buildICS()")
  for _ in range(8):
    ids = await pg.get_by_test_id('db-day-list').locator('[data-db-id]').evaluate_all('es=>es.map(e=>e.dataset.dbId)')
    if ids.index('photos')>ids.index('lamer'): break
    await pg.get_by_test_id('db-day-list').locator('[data-db-id=photos]').get_by_test_id('db-down').click()
  ok('draft shows pending changes', await pg.get_by_test_id('changes-pending').is_visible())
  draft_ics = await pg.evaluate("window.__gonow.buildICS()")
  ok('draft export follows reorder', '20261126T220000' in draft_ics and '20261126T174000' not in draft_ics)
  await pg.get_by_test_id('logo').click()
  await pg.get_by_test_id('view-finished').first.click()
  await pg.get_by_test_id('finished-banner').wait_for()
  finished_ics = await pg.evaluate("window.__gonow.buildICS()")
  photo = await pg.get_by_test_id('db-day-list').locator('[data-db-id=photos]').get_by_test_id('db-time').evaluate('e=>e.textContent')
  ok('finished snapshot keeps original photo time', photo=='5:40 PM–6:40 PM' and '20261126T220000' not in finished_ics and '20261126T174000' in finished_ics, photo)
  ok('snapshot weather is seasonal', 'not a forecast' in (await pg.get_by_test_id('snapshot-weather').inner_text()+await pg.get_by_test_id('finished-banner').inner_text()).lower())
  await pg.get_by_test_id('logo').click()
  await pg.get_by_test_id('edit-draft').first.click()
  await pg.get_by_test_id('draft-screen').wait_for()
  await pg.get_by_test_id('generate-plan').click()
  await pg.get_by_test_id('finished-banner').wait_for()
  again = await pg.evaluate("window.__gonow.buildICS()")
  photo2 = await pg.get_by_test_id('db-day-list').locator('[data-db-id=photos]').get_by_test_id('db-time').evaluate('e=>e.textContent')
  ok('regenerate updates the snapshot', photo2=='10:00 PM–11:00 PM' and '20261126T220000' in again and before!=again)
  await ctx.close()
  # Mobile tray
  ctx, pg = await t.new(b, base, 390, 844, has_touch=True)
  await pg.get_by_test_id('demo-oahu').click()
  await pg.get_by_test_id('db-root').wait_for()
  await pg.get_by_test_id('logo').click()
  await pg.get_by_test_id('edit-draft').first.click()
  await pg.get_by_test_id('draft-screen').wait_for()
  ok('mobile no overflow', not await t.overflow(pg))
  toggle = pg.get_by_test_id('tray-toggle')
  ok('mobile tray starts closed', await toggle.is_visible() and await toggle.get_attribute('aria-expanded')=='false')
  await toggle.click()
  ok('mobile tray slides open', await pg.get_by_test_id('activity-tray').is_visible() and await toggle.get_attribute('aria-expanded')=='true')
  await pg.get_by_test_id('db-day-2026-11-27').click()
  senia = await pg.get_by_test_id('db-day-list').locator('[data-db-id=senia]').get_by_test_id('db-time').evaluate('e=>e.textContent')
  ok('mobile Senia lock unchanged', senia=='6:00 PM–8:00 PM', senia)
  await ctx.close()

async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch()
    base = (t.SITE/'index.html').resolve().as_uri()
    await flow(b, base)
    await b.close()
  fails = [r for r in t.results if not r[1]]
  print('FLOW', sum(r[1] for r in t.results), '/', len(t.results))
  for r in fails:
    print('FAIL', r[0], str(r[2])[:500])
  if t.errors:
    print('ERRORS', len(t.errors))
    for e in t.errors[:15]:
      print(' ', e[:300])
  sys.exit(1 if fails or t.errors else 0)

if __name__ == '__main__':
  asyncio.run(main())
