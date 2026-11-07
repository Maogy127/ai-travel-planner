"""Phase 2 screenshots: merged day view, expanded box, user lock, lock toggle states (1280 + 390)."""
import asyncio, subprocess, sys, time
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent; OUT=ROOT/'screenshots'; PORT=8798
async def open_demo(b,w):
  ctx=await b.new_context(viewport={'width':w,'height':900 if w>600 else 844},device_scale_factor=1,has_touch=w<=600,is_mobile=w<=600)
  await ctx.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='text/css', body=''))
  await ctx.route('https://fonts.gstatic.com/**', lambda r: r.fulfill(status=200, body=''))
  pg=await ctx.new_page(); await pg.goto(f'http://127.0.0.1:{PORT}/index.html?fast=1')
  await pg.get_by_test_id('demo-oahu').click(); await pg.get_by_test_id('db-root').wait_for(); await pg.wait_for_timeout(3600)
  return ctx,pg
async def shot_card(pg,path):
  # Whole day card on a full-page capture so the sticky top bar doesn't cover it.
  await pg.evaluate('window.scrollTo(0,0)'); await pg.wait_for_timeout(200)
  box=await pg.locator('.db-root').evaluate("e=>{const r=e.getBoundingClientRect();return {x:r.left+scrollX-6,y:r.top+scrollY-6,width:r.width+12,height:r.height+(innerWidth>600?12:6)}}")
  await pg.screenshot(path=str(path),full_page=True,clip=box)
async def shot_view(pg,row,path,offset=120):
  await row.evaluate(f"e=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY-{offset})"); await pg.wait_for_timeout(500)
  await pg.screenshot(path=str(path))
async def main():
  srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'-d',str(ROOT/'site')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
  try:
    async with async_playwright() as p:
      b=await p.chromium.launch()
      for w,tag in ((1280,'desktop'),(390,'mobile')):
        ctx,pg=await open_demo(b,w); day=pg.get_by_test_id('db-day-list')
        await shot_card(pg,OUT/f'merged-1126-{tag}.png')
        row=day.locator('[data-db-id="2026-11-26-1"]'); await row.get_by_test_id('db-expand').click()
        await row.locator('details').filter(has_text='What to bring').locator('summary').click()
        await shot_view(pg,row,OUT/f'merged-expanded-{tag}.png',110 if w>600 else 80)
        await row.get_by_test_id('db-expand').click()
        await pg.get_by_test_id('db-day-2026-11-27').click()
        await shot_card(pg,OUT/f'merged-1127-{tag}.png')
        dive=day.locator('[data-db-id=dive-1127]'); await dive.get_by_test_id('db-lock').click()
        assert await dive.get_by_test_id('db-lock').get_attribute('aria-pressed')=='true'
        await pg.wait_for_timeout(300)
        await shot_view(pg,day.locator('[data-db-id="2026-11-27-0"]'),OUT/f'merged-userlock-{tag}.png',150 if w>600 else 120)
        if w>600:
          await pg.evaluate("""()=>{const pick=id=>document.querySelector('[data-db-id="'+id+'"] [data-testid=db-lock]');const strip=document.createElement('div');strip.id='lock-states';strip.style.cssText='position:fixed;left:0;top:0;z-index:9999;display:flex;gap:36px;padding:28px 32px;background:#fffcf4;font:14px "DM Sans",sans-serif;color:#25332f;align-items:flex-start;border:1px solid #c7b794';
            [['lunch-1127','Unlocked','Moves with the day'],['dive-1127','Locked by you','Keeps 8:00 AM–11:00 AM'],['senia','Booking','Starts locked; can be unlocked']].forEach(([id,h,t])=>{const w=document.createElement('figure');w.style.cssText='margin:0;display:grid;justify-items:center;gap:6px;max-width:190px;text-align:center';const c=pick(id).cloneNode(true);c.removeAttribute('data-testid');const x=document.createElement('div');x.className='db-root';x.style.cssText='padding:0;border:0;background:none;margin:0';x.appendChild(c);const f=document.createElement('figcaption');f.innerHTML='<strong>'+h+'</strong><br>'+t+'<br><small>label “'+c.getAttribute('aria-label')+'” · aria-pressed='+c.getAttribute('aria-pressed')+'</small>';w.append(x,f);strip.append(w);});document.body.append(strip);}""")
          await pg.locator('#lock-states').screenshot(path=str(OUT/'merged-lock-toggle-states.png'))
          await pg.evaluate("document.getElementById('lock-states').remove()")
        await ctx.close()
      await b.close()
  finally: srv.terminate()
  print('shots done')
asyncio.run(main())
