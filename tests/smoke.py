import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 ROOT=Path(__file__).resolve().parent.parent
 SITE=ROOT/'site' if (ROOT/'site'/'index.html').exists() else ROOT
 (ROOT/'screenshots').mkdir(exist_ok=True)
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  page=await browser.new_page(viewport={'width':390,'height':844})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'ERR_FILE_NOT_FOUND' not in m.text else None)
  await page.goto(SITE.joinpath('index.html').resolve().as_uri()+'?fast=1')
  await page.screenshot(path=str(ROOT/'screenshots'/'start-mobile.png'),full_page=True)
  await page.get_by_test_id('demo-oahu').click()
  await page.get_by_test_id('age-rules').wait_for(state='attached')
  print('Days:',await page.get_by_test_id('plan-day').count())
  print('Overflow:',await page.evaluate('document.documentElement.scrollWidth > innerWidth'))
  first=page.locator('details').filter(has=page.locator('summary',has_text='What to bring')).first
  await first.evaluate("""e=>{const d=e.closest('.db-detail');if(d&&d.hidden){const b=document.querySelector('[aria-controls=\"'+d.id+'\"]');if(b)b.click();}}""")
  await first.locator('summary').click()
  tick=first.get_by_test_id('bring-item').first
  pid=await tick.get_attribute('data-pack-id')
  await tick.check()
  await page.get_by_test_id('tab-packing').click()
  assert await page.locator('input[data-pack-id="'+pid+'"]').is_checked()
  await page.reload()
  await page.get_by_test_id('age-rules').wait_for(state='attached')
  await page.get_by_test_id('tab-packing').click()
  assert await page.locator('input[data-pack-id="'+pid+'"]').is_checked()
  await page.get_by_test_id('tab-plan').click()
  await page.locator('[data-testid=item-remove]').first.evaluate("""e=>{const d=e.closest('.db-detail');if(d&&d.hidden){const b=document.querySelector('[aria-controls=\"'+d.id+'\"]');if(b)b.click();}}""")
  await page.get_by_test_id('item-remove').first.click()
  await page.get_by_test_id('undo').click()
  await page.get_by_test_id('db-day-2026-11-26').click()
  await page.locator('#day-1 [data-testid=relax-toggle]').check()
  assert await page.locator('h3',has_text='Diamond Head —').count()==0
  await page.reload()
  await page.get_by_test_id('age-rules').wait_for(state='attached')
  assert await page.locator('#day-1 [data-testid=relax-toggle]').is_checked()
  await page.locator('[data-testid=item-edit]').first.evaluate("""e=>{const d=e.closest('.db-detail');if(d&&d.hidden){const b=document.querySelector('[aria-controls=\"'+d.id+'\"]');if(b)b.click();}}""")
  await page.get_by_test_id('item-edit').first.click()
  await page.get_by_test_id('edit-note').fill('Testing saved note')
  await page.get_by_test_id('edit-save').click()
  await page.reload()
  await page.get_by_test_id('age-rules').wait_for(state='attached')
  assert await page.get_by_text('Your note: Testing saved note').count()==1
  await page.get_by_test_id('start-over').click()
  await page.get_by_test_id('start-from').fill('Seattle')
  await page.get_by_test_id('start-unsure').click()
  await page.get_by_test_id('start-next').click()
  for step in range(5): await page.get_by_test_id('q-skip').click()
  print('Recommendations:',await page.get_by_test_id('rec-card').count())
  await page.get_by_test_id('rec-more').click()
  await page.get_by_test_id('rec-choose').first.click()
  await page.get_by_test_id('fork-no').click()
  await page.get_by_test_id('tab-plan').wait_for()
  print('Template days:',await page.get_by_test_id('plan-day').count())
  print('Template overflow:',await page.evaluate('document.documentElement.scrollWidth > innerWidth'))
  await page.screenshot(path=str(ROOT/'screenshots'/'template-mobile.png'),full_page=True)
  print('Console errors:',json.dumps(errors))
  assert not errors, errors
  await browser.close()
asyncio.run(main())
