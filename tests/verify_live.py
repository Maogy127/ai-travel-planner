# Unmocked live verification of the day builder on GitHub Pages + screenshots.
import asyncio, json, time
from playwright.async_api import async_playwright
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
SITE=ROOT/'site' if (ROOT/'site'/'index.html').exists() else ROOT
URL='https://maogy127.github.io/ai-travel-planner/?cb=%d'%int(time.time())
OUT=Path('/opt/cursor/artifacts/gonow-live')
OUT.mkdir(parents=True, exist_ok=True)
FILES=['index.html','js/daybuilder.js','js/oahu.js','js/app.js','css/styles.css']
SENIA=[['7:15 AM–7:45 AM','Uber to Kewalo Basin (Dive Oʻahu)',False],['8:00 AM–11:00 AM','Beginner intro dive — Dive Oʻahu, Kewalo Basin',False],['11:00 AM–11:30 AM','Rinse off & change',False],['11:50 AM–12:30 PM','Lunch at Ala Moana Center',False],['12:35 PM–3:30 PM','Black Friday shopping — Ala Moana Center',False],['3:30 PM–4:00 PM','Uber from Ala Moana to The Kahala',False],['4:00 PM–5:00 PM','Shower, change + makeup',False],['6:00 PM–8:00 PM','Dinner — Senia (Chinatown)',True],['8:00 PM–8:35 PM','Uber back to the Kahala',False]]
res=[];errs=[]
def ok(n,c,x=''): res.append((n,bool(c)));print('PASS' if c else 'FAIL',n,x)
async def one(b,w,name):
  ctx=await b.new_context(viewport={'width':w,'height':844},has_touch=True,is_mobile=w<=600)
  pg=await ctx.new_page()
  pg.on('pageerror',lambda e:errs.append(f'{name} pageerror {e}'))
  pg.on('console',lambda m:errs.append(f'{name} console {m.text}') if m.type=='error' else None)
  pg.on('requestfailed',lambda r:errs.append(f'{name} requestfailed {r.url} {r.failure}'))
  await pg.goto(URL,wait_until='networkidle')
  for f in FILES:
    live=await pg.evaluate("f=>fetch(f+'?cb='+Date.now(),{cache:'no-store'}).then(r=>r.arrayBuffer()).then(b=>Array.from(new Uint8Array(b)))",f)
    ok(f'{name} deployed {f} matches local byte for byte',bytes(live)==(SITE/f).read_bytes())
  await pg.get_by_test_id('demo-oahu').click()
  root=pg.get_by_test_id('db-root');await root.wait_for()
  ok(f'{name} Oahu sample + day builder render',await root.is_visible())
  await pg.get_by_test_id('db-day-2026-11-26').click()
  day=pg.get_by_test_id('db-day-list')
  tl=await day.get_by_test_id('db-pair').evaluate_all("es=>es.map(e=>[e.querySelector('[data-testid=db-time]').textContent,e.querySelector('strong').textContent,e.classList.contains('db-locked')])")
  m={t[1]:t for t in tl}
  ok(f'{name} photos 5:40-6:40',any(t[0]=='5:40 PM–6:40 PM' and 'palms' in t[1] for t in tl))
  ok(f'{name} La Mer 7:30 locked',any(t[0]=='7:30 PM–9:30 PM' and 'La Mer' in t[1] and t[2] for t in tl))
  txt=await day.inner_text()
  ok(f'{name} 6:55 Uber','6:55 PM · Uber ~20 min · arrive 7:15 PM' in txt)
  ok(f'{name} zero default conflicts',await day.locator('.db-conflict').count()==0)
  ok(f'{name} 11/26 has no Senia','Senia' not in await day.inner_text())
  await pg.wait_for_timeout(3500)
  await day.locator('[data-db-id=photos]').evaluate("e=>e.scrollIntoView({block:'center'})")
  await pg.wait_for_timeout(300)
  await pg.screenshot(path=str(OUT/f'live-1126-{name}.png'))
  row=day.locator('[data-db-id="2026-11-26-1"]')
  await row.get_by_test_id('db-expand').click()
  await row.locator('details').filter(has_text='What to bring').locator('summary').click()
  await row.evaluate("e=>e.scrollIntoView({block:'center'})")
  await pg.screenshot(path=str(OUT/f'live-expanded-{name}.png'))
  vis=lambda: day.get_by_test_id('db-pair').evaluate_all("es=>es.map(e=>e.dataset.dbId)")
  async def ids():
    return await pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('gonow:daybuilder:oahu-demo-2026-11')||'null');return s&&s.days['2026-11-26']?s.days['2026-11-26'].items.map(i=>i.id):null})()")
  before=await vis()
  # keyboard move: pick up free time, move down one, drop
  free=day.locator('.db-pair:not(.db-locked)').filter(has_text='Free time').get_by_test_id('db-handle')
  await free.focus();await pg.keyboard.press('Space');await pg.keyboard.press('ArrowDown');await pg.keyboard.press('Space')
  after=await ids()
  ok(f'{name} keyboard move',after and after.index('free')==after.index('return-hotel')+1 or (after and after.index('free')>before.index('free')),str(after))
  await pg.get_by_test_id('db-reset').click()
  await pg.wait_for_timeout(300)
  ok(f'{name} reset restores',await vis()==before)
  # pointer drag: photos handle onto first item
  h=day.locator('[data-db-id=photos]').get_by_test_id('db-handle');tgt=day.locator('[data-db-id=free]')
  await h.evaluate("e=>e.scrollIntoView({block:'center'})")
  o=await h.bounding_box();d=await tgt.bounding_box()
  if d['y']<120: await tgt.evaluate("e=>e.scrollIntoView({block:'center'})");o=await h.bounding_box();d=await tgt.bounding_box()
  await pg.mouse.move(o['x']+o['width']/2,o['y']+o['height']/2);await pg.mouse.down()
  await pg.mouse.move(d['x']+d['width']/2,d['y']+d['height']*.2,steps=18);await pg.mouse.up()
  dragged=await ids();shown=await vis()
  ok(f'{name} pointer drag move',dragged and dragged.index('photos')<dragged.index('free'),str((dragged,shown)))
  await pg.get_by_test_id('db-reset').click();await pg.wait_for_timeout(300)
  # conflict: move photos down past La Mer -> after dark / miss
  for _ in range(2): await day.locator('[data-db-id=photos]').get_by_test_id('db-down').click()
  c=await day.locator('.db-conflict').count()
  ok(f'{name} conflict shows',c>0 and 'After dark' in await day.inner_text(),str(c))
  await pg.get_by_test_id('db-reset').click()
  # 11/27: Senia locked 6:00–8:00 PM after prep and the 5:10 PM Uber.
  await pg.get_by_test_id('db-day-2026-11-27').click()
  tl=await day.get_by_test_id('db-pair').evaluate_all("es=>es.map(e=>[e.querySelector('[data-testid=db-time]').textContent,e.querySelector('strong').textContent,e.classList.contains('db-locked')])")
  ok(f'{name} 11/27 exact timeline',tl==SENIA,json.dumps(tl,ensure_ascii=False))
  txt=await day.inner_text()
  ok(f'{name} 11/27 5:10 Uber to Senia','5:10 PM · Uber ~30–40 min, est. $20–30 · arrive 5:45 PM' in txt)
  ok(f'{name} 11/27 zero conflicts',await day.locator('.db-conflict').count()==0)
  senia=day.locator('[data-db-id=senia]')
  ok(f'{name} 11/27 Senia locked with unlock control','Locked' in await senia.inner_text() and await senia.locator('[data-db-action=handle],[data-db-action=up],[data-db-action=down],[data-db-action=remove]').count()==0 and await senia.get_by_test_id('db-lock').get_attribute('aria-pressed')=='true' and await senia.get_by_test_id('db-lock').get_attribute('aria-label')=='Unlock time')
  await day.locator('[data-db-id=uber-kahala]').get_by_test_id('db-up').click()
  notes=await day.get_by_test_id('db-note').all_text_contents()
  ok(f'{name} 11/27 reorder warns, lock holds',any(n.endswith("you'd miss Senia") for n in notes) and await senia.get_by_test_id('db-time').text_content()=='6:00 PM–8:00 PM',str(notes))
  await pg.get_by_test_id('db-reset').click();await pg.wait_for_timeout(300)
  print('RENDERED 11/27',name);[print('  ',t[0],t[1],'[locked]' if t[2] else '') for t in await day.get_by_test_id('db-pair').evaluate_all("es=>es.map(e=>[e.querySelector('[data-testid=db-time]').textContent,e.querySelector('strong').textContent,e.classList.contains('db-locked')])")]
  for t in await day.get_by_test_id('db-travel').all_inner_texts(): print('   connector:',t)
  await pg.wait_for_timeout(1500)
  # Whole 11/27 builder (day chips + full timeline) so Senia and its lead-up are all visible.
  await pg.add_style_tag(content='.topbar{position:static!important} #toast{display:none!important}')
  await root.screenshot(path=str(OUT/f'live-1127-{name}.png'))
  # User lock on the dive, then reorder photos on 11/26 and confirm ICS/copy follow the builder.
  await day.locator('[data-db-id=dive-1127]').get_by_test_id('db-lock').click()
  await day.locator('[data-db-id=dive-1127]').evaluate("e=>e.scrollIntoView({block:'center'})")
  await pg.screenshot(path=str(OUT/f'live-userlock-{name}.png'))
  await pg.get_by_test_id('db-reset').click()
  await pg.get_by_test_id('db-day-2026-11-26').click()
  ok(f'{name} one day shown', await pg.get_by_test_id('plan-day').count()==1)
  for _ in range(8):
    ids=await day.locator('[data-db-id]').evaluate_all('es=>es.map(e=>e.dataset.dbId)')
    if 'photos' in ids and 'lamer' in ids and ids.index('photos')>ids.index('lamer'): break
    await day.locator('[data-db-id=photos]').get_by_test_id('db-down').click()
  photo=await day.locator('[data-db-id=photos]').get_by_test_id('db-time').inner_text()
  ics=await pg.evaluate("window.__gonow.buildICS().replace(/\\r\\n /g,'')")
  text=await pg.evaluate('window.__gonow.planText()')
  ok(f'{name} live reorder export sync', photo=='10:00 PM–11:00 PM' and '20261126T220000' in ics and '20261126T174000' not in ics and '10:00 PM–11:00 PM' in text and '5:40 PM–6:40 PM' not in text, photo)
  await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    await one(b,1280,'desktop');await one(b,390,'mobile')
    await b.close()
  ok('no console errors',not errs,json.dumps(errs[:10]))
  print('SUMMARY',sum(r[1] for r in res),'/',len(res))
asyncio.run(main())
