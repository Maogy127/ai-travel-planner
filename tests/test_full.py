# Item F: port old Add/booking/reset flows to direct actions and the custom-item sheet.
import base64
import asyncio, sys, subprocess, time, json, re
from pathlib import Path
from datetime import date, timedelta
from urllib.parse import urlparse, parse_qs, unquote
from playwright.async_api import async_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
SITE=ROOT/'site' if (ROOT/'site'/'index.html').exists() else ROOT
(ROOT/'screenshots').mkdir(exist_ok=True)
results=[]; errors=[]
def ok(name, cond, extra=''):
  results.append((name, bool(cond), extra)); print(('PASS' if cond else 'FAIL'), name, extra)
# The early Sunday flight leaves only three full days for picks.
# All 13 picks fit; La Mer/Senia remain preselected reservations.
OAHU_EXPORT_PICKS = ['diamond-head', 'kualoa', 'hanauma',
  'bishop-museum', 'waimea', 'laniakea', 'surf', 'leonards',
  'helenas', 'matsumoto', 'udon']

async def through_picks(pg, picks=()):
  await pg.locator('[data-testid=pick-activities]:visible, [data-testid=pick-food]:visible, [data-testid=confirm-plan]:visible, [data-testid=db-root]:visible, [data-testid=trip-prep]:visible, [data-testid=treasure-map]:visible, [data-testid=plan-day]:visible').first.wait_for(timeout=45000)
  for screen in ('pick-activities', 'pick-food'):
    if await pg.get_by_test_id(screen).count():
      # Non-curated destinations now load places; offline suites use the legacy fallback.
      await pg.locator('[data-testid=pick-next]:visible, [data-testid=place-failure]:visible').first.wait_for(timeout=45000)
      if await pg.get_by_test_id('place-failure').is_visible():
        await pg.get_by_test_id('pick-fallback').click()
        return
      for pick in picks:
        toggle=pg.locator(f'[data-pick-toggle="{pick}"]')
        if await toggle.count() and await toggle.get_attribute('aria-pressed')!='true':
          await toggle.click()
      await pg.get_by_test_id('pick-next').click()

async def continue_prep(pg):
  await through_picks(pg)
  await pg.locator('[data-testid=trip-prep]:visible, [data-testid=db-root]:visible, [data-testid=plan-day]:visible, [data-testid=treasure-map]:visible').first.wait_for(timeout=45000)
  if await pg.get_by_test_id('confirm-plan').count():
    assert await pg.evaluate("window.__gonow.state.screen") == 'plan'
    assert not await pg.get_by_test_id('trip-prep').count()
    assert not await pg.get_by_test_id('trip-prep-button').count()
    await pg.get_by_test_id('confirm-plan').click()
  if await pg.get_by_test_id('trip-prep').count():
    await pg.get_by_test_id('prep-continue').click()
async def wait_plan(pg):
  await through_picks(pg)
  await pg.locator('[data-testid=trip-prep]:visible, [data-testid=db-root]:visible, [data-testid=plan-day]:visible, [data-testid=treasure-map]:visible').first.wait_for(timeout=45000)
  await continue_prep(pg)
async def open_share_menu(pg):
  # Item G: exports now live in the header Share menu, opened before each action.
  toggle = pg.get_by_test_id('share-menu-toggle')
  if await toggle.get_attribute('aria-expanded') != 'true': await toggle.click()

async def open_guidance(pg):
  await pg.locator('.pace-control').evaluate_all('items=>items.forEach(e=>e.open=true)')

async def open_trip_prep(pg):
  if not await pg.get_by_test_id('trip-prep').count():
    if await pg.get_by_test_id('confirm-plan').count():
      await pg.get_by_test_id('confirm-plan').click()
    else:
      await pg.get_by_test_id('trip-prep-button').click()
  await pg.get_by_test_id('trip-prep').locator('details').evaluate_all('els=>els.forEach(e=>e.open=true)')
async def open_day_pace(pg):
  link=pg.get_by_test_id('day-pace-link').first
  if await link.get_attribute('aria-expanded')!='true': await link.click()
async def open_add_menu(pg):
  # Item F: actions are directly available, with no Add disclosure.
  await pg.get_by_test_id('day-add-own').wait_for()
async def open_group(pg):
  if await pg.get_by_test_id('track-toggle').get_attribute('aria-pressed')!='true': await pg.get_by_test_id('track-toggle').click()
  button=pg.get_by_test_id('group-toggle').first
  if await button.get_attribute('aria-expanded')!='true': await button.click()
async def open_info(pg):
  panel=pg.get_by_test_id('day-info').first
  if not await panel.evaluate('e=>e.open'): await panel.locator('summary').click()

async def card_action(pg, card_locator, testid):
  more = card_locator.get_by_test_id('db-more')
  if await more.count() and await more.get_attribute('aria-expanded') != 'true':
    await more.click()
  if testid == 'db-add-again': return card_locator.locator('[data-db-action=again]')
  if testid == 'db-move-day': return card_locator.locator('[data-db-action=move-day]')
  return card_locator.get_by_test_id(testid)

async def overflow(pg): return await pg.evaluate('document.documentElement.scrollWidth > window.innerWidth')
async def open_for(loc):
  await loc.evaluate("e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;const tile=e.closest('[data-testid=tile]');if(tile){const b=tile.querySelector('[data-testid=tile-toggle]');if(b.getAttribute('aria-expanded')!=='true')b.click();}const d=e.closest('.db-detail');if(d&&d.hidden){const x=document.querySelector('[aria-controls=\"'+d.id+'\"]');if(x)x.click();}}")
# Merged plan: the builder shows one day at a time, so whole-plan reads step through every day.
ALL_DAYS_JS="""(sel)=>{const DB=window.DayBuilder,root=[...document.querySelectorAll('[data-testid=db-root]')].find(e=>e.getClientRects().length);const main=document.querySelector('main');
  if(!DB||!root||!DB.selectedDate)return sel?document.querySelectorAll(sel).length:main.textContent;
  const cur=DB.selectedDate(),dates=window.__gonow.state.plan.days.map(d=>d.date);let n=0,t=main.textContent;
  for(const d of dates){DB.selectDay(d,false);const r=[...document.querySelectorAll('[data-testid=db-root]')].find(e=>e.getClientRects().length);if(sel)n+=r.querySelectorAll(sel).length;else t+=' '+r.textContent;}
  DB.selectDay(cur,false);if(sel)n+=[...document.querySelectorAll(sel)].filter(e=>!e.closest('[data-testid=db-root]')).length;return sel?n:t;}"""
async def plan_text(pg): return await pg.evaluate(ALL_DAYS_JS, None)
async def plan_count(pg, sel): return await pg.evaluate(ALL_DAYS_JS, sel)
async def show_day(pg, index):
  await reopen_dashboard(pg)
  await continue_prep(pg)
  date=await pg.evaluate('i=>window.__gonow.state.plan.days[i].date', index)
  await pg.get_by_test_id('db-day-'+date).click(); return date
async def readable(pg, selector, pseudo=None):
  return await pg.locator(selector).first.evaluate(r"""(e,pseudo)=>{
    const style=getComputedStyle(e,pseudo),rgb=c=>(c.match(/[\d.]+/g)||[]).map(Number);
    let bg=e;while(bg.parentElement && (rgb(getComputedStyle(bg).backgroundColor)[3]??1)<1)bg=bg.parentElement;
    const back=rgb(getComputedStyle(bg).backgroundColor),front=rgb(style.color);
    const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
    const a=lum(front),b=lum(back);return {ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size:parseFloat(style.fontSize)};
  }""", pseudo)
async def question_review_checks(pg):
  ok('question has no emoji', await pg.locator('main').evaluate(r"e=>! /(?![\u2190-\u21ff])\p{Extended_Pictographic}/u.test(e.textContent)"))
  for selector,pseudo in (('.question > p',None),('.option.stamped','::after')):
    result=await readable(pg,selector,pseudo)
    ok('readable '+selector,result['ratio']>=4.5 and result['size']>=11,str(result))
  for width in (390,360):
    await pg.set_viewport_size({'width':width,'height':844})
    ok(f'single progress indicator {width}', await pg.get_by_role('progressbar').count()==1 and await pg.locator('.passport,.pinned,.page-number').count()==0)
  await pg.set_viewport_size({'width':390,'height':844})
  last=pg.locator('.option').last
  await last.scroll_into_view_if_needed()
  ok('last option above footer', await last.evaluate("e=>e.getBoundingClientRect().bottom<=document.querySelector('.qfooter').getBoundingClientRect().top"))
  await pg.locator('input[name=budgetChoice]:checked').focus()
  await pg.keyboard.press('ArrowUp');await pg.keyboard.press('ArrowDown')
  ok('keyboard option ring', await pg.locator('input[name=budgetChoice]:checked').evaluate("e=>e.matches(':focus-visible')&&getComputedStyle(e.closest('.option')).outlineStyle!=='none'"))
async def mock_local_api(route):
  query=parse_qs(urlparse(route.request.url).query)
  if 'frankfurter' in route.request.url:
    body={'base':'USD','date':'2026-11-02','rates':{query.get('symbols',['EUR'])[0]:0.9}}
  else:
    start=date.fromisoformat(query['start_date'][0]); end=date.fromisoformat(query['end_date'][0])
    days=[(start+timedelta(days=i)).isoformat() for i in range((end-start).days+1)]
    body={'daily':{'time':days,'temperature_2m_max':[80]*len(days),'temperature_2m_min':[65]*len(days),'precipitation_probability_max':[20]*len(days),'precipitation_sum':[2]*len(days)}}
  await route.fulfill(status=200,content_type='application/json',body=json.dumps(body))
async def local_api_fixture(ctx):
  # Every context uses these deterministic fixtures; never contact the live APIs.
  for host in ('api.open-meteo.com','archive-api.open-meteo.com','api.frankfurter.dev'):
    await ctx.route('https://'+host+'/**',mock_local_api)
def is_place_url(url):
  host = urlparse(str(url)).hostname or ''
  return host in ('nominatim.openstreetmap.org', 'overpass-api.de', 'upload.wikimedia.org') or any(host == domain or host.endswith('.' + domain) for domain in ('wikipedia.org', 'wikidata.org'))

async def new(b, base, w=390, h=844, reduced_motion='no-preference', has_touch=False):
  ctx=await b.new_context(viewport={'width':w,'height':h}, reduced_motion=reduced_motion, has_touch=has_touch, is_mobile=has_touch and w<=600)
  await ctx.route("https://tile.openstreetmap.org/**", lambda route: route.fulfill(content_type="image/png", body=base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGN4eXvnfwAIqwN9YzQAMgAAAABJRU5ErkJggg==")))
  # Offline by default; fixture suites override these with later page routes.
  await ctx.route(is_place_url, lambda route: route.abort())
  await local_api_fixture(ctx)
  pg=await ctx.new_page()
  pg.on('pageerror', lambda e: errors.append(f'{base[:5]} pageerror {e}'))
  # Expected place-host aborts exercise fallback; keep other console/request errors fatal.
  pg.on('console', lambda m: errors.append(f'{base[:5]} console {m.text}') if m.type=='error' and not is_place_url(m.location.get('url', '')) else None)
  pg.on('requestfailed', lambda r: errors.append(f'{base[:5]} requestfailed {r.url} {r.failure}') if not is_place_url(r.url) else None)
  # Fulfill external fonts locally so offline verification has no network dependency.
  await pg.route('https://fonts.googleapis.com/**', lambda route: route.fulfill(status=200, content_type='text/css', body=''))
  await pg.goto(base+'?fast=1'); return ctx, pg
async def open_home_flow(pg):
  if await pg.get_by_test_id('dashboard').count():
    await pg.get_by_test_id('new-trip').click()

async def reopen_dashboard(pg):
  # Open the current live plan, preserving edit/persistence scenarios.
  if await pg.get_by_test_id('dashboard').count():
    await pg.get_by_test_id('trip-card').first.locator('[data-open-trip]').click()

async def dashboard_action(pg, action):
  card = pg.get_by_test_id('trip-card').first
  await card.wait_for()
  menu = card.locator('.trip-menu')
  more=menu.locator('[data-trip-more]')
  if await more.get_attribute('aria-expanded')!='true':
    await more.click()
  await card.get_by_test_id(action).click()

async def choose_flight_time(pg, value):
  # Flight edits now share a two-row sheet; preserve clock-picker coverage.
  direction = await pg.evaluate("DayBuilder.selectedDate()===__gonow.state.plan.days[0].date?'arrival':'return'")
  await pg.get_by_test_id('edit-flight').first.click()
  sheet=pg.locator('dialog.flight-sheet')
  field=sheet.get_by_test_id(direction+'-time')
  current=await field.input_value() or '12:00'
  current_hour,current_minute=map(int,current.split(':'))
  await field.locator('..').get_by_role('button').click()
  dialog=pg.locator('dialog.time-picker')
  await dialog.get_by_role('button',name='Other time',exact=True).click()
  hour,minute=map(int,value.split(':'))
  # Step the total clock difference: minute wrap also advances the hour.
  delta=(hour*60+minute-current_hour*60-current_minute)%1440
  for _ in range(delta//60):
    await dialog.get_by_role('button',name='Increase hour',exact=True).click()
  for _ in range((delta%60)//15):
    await dialog.get_by_role('button',name='Increase minute',exact=True).click()
  await dialog.get_by_role('button',name='Set time',exact=True).click()
  await expect(field).to_have_value(value)
  await sheet.get_by_role('button',name='Save flights',exact=True).click()
  await expect(sheet).to_have_count(0)
  await expect(pg.get_by_test_id('db-flight-time')).to_have_count(1)
  await expect(pg.get_by_test_id('db-flight-time')).to_have_value(value)
  assert await pg.evaluate('(key)=>__gonow.state.answers[key]', direction+'Time') == value


async def reopen(pg):
  # A reload lands on the dashboard when trips exist.
  await reopen_dashboard(pg)
async def open_form(pg):
  if await pg.get_by_test_id('start-from').count()==0:
    # Direct legacy route preserves destination validation fixtures. Home is covered by test_question_flow.
    await pg.evaluate("__gonow.state.fromHome=false;__gonow.go('start')")
async def answer(pg, dest, unsure=False, ages=('18','19'), who='couple', styles=('hotel','scenic'), start='2026-11-25', end='2026-11-29'):
  await open_form(pg)
  await pg.get_by_test_id('start-from').fill('Los Angeles')
  if unsure: await pg.get_by_test_id('start-unsure').click()
  else: await pg.get_by_test_id('start-to').fill(dest)
  await pg.get_by_test_id('start-next').click()
  await pg.get_by_test_id('date-start').fill(start); await pg.get_by_test_id('date-end').fill(end)
  hint=await pg.get_by_test_id('guide').inner_text()
  await pg.get_by_test_id('q-continue').click()
  # Flights are optional; preserve the budget checks after skipping the new step.
  await pg.get_by_test_id('q-skip').click()
  ok('step progress + contextual guide', await pg.get_by_role('progressbar').get_attribute('aria-label')=='Step 3 of 9' and hint!=await pg.get_by_test_id('guide').inner_text())
  ok('completed date retained without duplicate summary', await pg.evaluate("window.__gonow.state.answers.completed.includes('dates')") and await pg.get_by_test_id('pinned-answers').count()==0)
  ok('all five budget covers default checked', all([await pg.get_by_test_id('cover-'+k).is_checked() for k in ('flights','hotel','food','activities','transport')]))
  await pg.get_by_test_id('cover-flights').uncheck(); await pg.get_by_test_id('cover-food').uncheck()
  ok('single flights control stays synced', await pg.get_by_test_id('include-flights').count()==0 and await pg.evaluate('window.__gonow.state.answers.includeFlights') is False)
  ok('progress maximum', await pg.get_by_role('progressbar').get_attribute('aria-valuemax')=='9')
  ok('budget covers stored', await pg.evaluate("JSON.stringify(window.__gonow.state.answers.covers)")== '["hotel","activities","transport"]')
  await pg.get_by_test_id('opt-5000+').click(); await question_review_checks(pg)
  ok('selected option stamped', 'stamped' in (await pg.get_by_test_id('opt-5000+').get_attribute('class'))); await pg.get_by_test_id('q-continue').click()
  ok('progress advances', await pg.get_by_role('progressbar').get_attribute('aria-valuenow')=='4')
  await pg.get_by_test_id('opt-'+who).click(); await pg.get_by_test_id('q-continue').click()
  for i,a in enumerate(ages): await pg.get_by_test_id(f'age-{i}').fill(a)
  await pg.get_by_test_id('q-continue').click()
  for s in styles: await pg.get_by_test_id('opt-'+s).click()
  await pg.get_by_test_id('q-continue').click()
async def extra(b, base, label):
  # Rename
  ctx,pg=await new(b, base)
  ok(f'{label} title GoNow', (await pg.title()).startswith('GoNow'), await pg.title())
  ok(f'{label} logo gonow', 'gonow' in (await pg.get_by_test_id('logo').inner_text()).lower())
  html=(await pg.content()).lower()
  ok(f'{label} no "wayfare" in rendered page', 'wayfare' not in html)
  ok(f'{label} og/meta description', await pg.locator('meta[property="og:title"]').count()==1 and await pg.locator('meta[name=description]').count()==1)
  # CSS selectors valid
  import re as _re
  css=(SITE/'css/styles.css').read_text()
  ok(f'{label} no invalid "x: :y" / "button: hover" selectors', not _re.search(r'^[a-z]+: :?[a-z]+\{', css, _re.M) and 'button:disabled{' in css and 'dialog::backdrop{' in css)
  # Two-letter custom places are valid; only junk gets the concise error.
  await open_form(pg)
  await pg.get_by_test_id('start-to').fill('1'); await pg.get_by_test_id('start-next').click()
  ok(f'{label} place validation message', "Enter a city or airport code." in await pg.locator('main').text_content())
  await pg.get_by_test_id('start-to').fill('Oahu'); await pg.get_by_test_id('start-from').fill('Los Angeles'); await pg.get_by_test_id('start-next').click()
  # skip dates -> flexible month (not January hard-coded)
  await pg.get_by_test_id('q-skip').click()
  m=await pg.evaluate('window.__gonow.state.answers.month'); exp=await pg.evaluate('new Date(Date.now()+75*864e5).getMonth()+1')
  ok(f'{label} skip dates sets month ~75 days out', m==exp, f'{m} vs {exp}')
  # Skip the optional flights question before checking budget validation.
  await pg.get_by_test_id('q-skip').click()
  # disabled continue style
  cont=pg.get_by_test_id('q-continue')
  if await cont.is_disabled():
    st=await cont.evaluate('e=>[getComputedStyle(e).opacity,getComputedStyle(e).pointerEvents]')
    ok(f'{label} disabled Continue dimmed + no pointer', st==['0.45','none'], str(st))
  else: ok(f'{label} disabled Continue dimmed + no pointer', False, 'continue not disabled on budget')
  await pg.get_by_test_id('opt-3000').click()
  ok(f'{label} focus kept on budget radio after re-render', await pg.evaluate("document.activeElement && document.activeElement.name==='budgetChoice'"))
  await pg.get_by_test_id('q-continue').click()
  await pg.get_by_test_id('opt-couple').click()
  ok(f'{label} focus kept on who radio after re-render', await pg.evaluate("document.activeElement && document.activeElement.value==='couple'"))
  await pg.get_by_test_id('q-continue').click()
  await pg.get_by_test_id('age-0').fill('18'); await pg.get_by_test_id('age-1').fill('19'); await pg.get_by_test_id('q-continue').click()
  for s_ in ('hotel','scenic','nature'): await pg.get_by_test_id('opt-'+s_).click()
  chk=await pg.evaluate("[...document.querySelectorAll('input[name=styles]:checked')].map(e=>e.value)")
  ok(f'{label} style swap drops oldest', chk and 'hotel' not in chk and len(chk)==2, str(chk))
  ok(f'{label} style swap announced', 'Swapped' in await pg.locator('#style-limit').inner_text())
  await pg.get_by_test_id('q-continue').click()
  ok(f'{label} fork has Back', await pg.get_by_test_id('fork-back').count()==1)
  await pg.go_back(); await pg.wait_for_timeout(200)
  ok(f'{label} browser Back from fork -> style question', await pg.locator('input[name=styles]').count()>0)
  await pg.go_forward(); await pg.wait_for_timeout(200)
  ok(f'{label} browser Forward -> fork', await pg.get_by_test_id('fork-no').count()==1)
  await pg.get_by_test_id('fork-no').click(); await continue_prep(pg)
  body=await plan_text(pg)
  ok(f'{label} cost summary incl. transport', '$1,120–1,320' in body)
  await show_day(pg,4)
  ok(f'{label} Day 5 has no relax/rain toggles', await pg.locator('#day-4 [data-testid=relax-toggle], #day-4 [data-testid=rain-toggle]').count()==0 and await pg.locator('#day-4').count()==1)
  await show_day(pg,1)
  ok(f'{label} Pillbox 5:10 AM ride', '5:10 AM' in body and 'Pillbox' in body)
  ok(f'{label} Kualoa 8:00 shuttle + breakfast', 'Twin Fin' in body and 'Aunty Pat' in body)
  ok(f'{label} dive at Kewalo then Senia dinner', 'Dive Oʻahu' in body and 'Dinner — Senia (Chinatown)' in body and 'Free Kahala shuttle from Ala Moana' not in body)
  ok(f'{label} one h1 on page', await pg.locator('h1').count()==1)
  # toast undo stays > 3 s
  await open_for(pg.get_by_test_id('item-remove').first); await pg.get_by_test_id('item-remove').first.click(); await pg.wait_for_timeout(4000)
  ok(f'{label} undo still available after 4 s', await pg.get_by_test_id('undo').count()==1)
  await pg.get_by_test_id('undo').click()
  ok(f'{label} prep owns packing', await pg.get_by_role('tab').count()==0)
  await open_trip_prep(pg)
  # custom item + quantity survive Reset my edits
  await pg.get_by_test_id('packing-add').first.click(); await pg.get_by_test_id('packing-name').fill('Reef socks test'); await pg.get_by_test_id('form-add').click()
  await continue_prep(pg); await pg.get_by_test_id('reset-edits').click(); await pg.get_by_test_id('modal-0').click()
  await open_trip_prep(pg)
  ok(f'{label} Reset my edits keeps custom packing item', await pg.get_by_text('Reef socks test').count()>=1)
  ok(f'{label} 390 no h-scroll (packing)', not await overflow(pg))
  await ctx.close()
  # Migration of old-name keys
  ctx,pg=await new(b, base)
  old='way'+'fare:'
  await pg.evaluate("""(old)=>{localStorage.clear();
    localStorage.setItem(old+'answers', JSON.stringify({destination:'Oahu', origin:'Los Angeles', start:'2026-11-25', end:'2026-11-29', who:'couple', adults:2, ages:[18,19], styles:['hotel','scenic']}));
    localStorage.setItem(old+'lastTrip', JSON.stringify({id:'oahu-demo-2026-11'}));
    localStorage.setItem(old+'packing:oahu-demo-2026-11', JSON.stringify({holo:true}));
    localStorage.setItem(old+'edits:oahu-demo-2026-11', JSON.stringify({customPacking:[{id:'pack-1',name:'Old custom item',qty:2,group:'Documents',from:[]}], quantities:{holo:3}}));}""", old)
  await pg.reload(); await reopen(pg); await wait_plan(pg)
  keys=await pg.evaluate('Object.keys(localStorage)')
  ok(f'{label} old keys migrated to gonow:*', all(k.startswith('gonow:') or k=='gonow.prep.v1' for k in keys) and 'gonow:answers' in keys, str(keys))
  await open_trip_prep(pg)
  ok(f'{label} migrated tick survives', await pg.locator('input[data-pack-id="holo"]').first.is_checked())
  ok(f'{label} migrated custom item survives', await pg.get_by_text('Old custom item').count()>=1)
  await ctx.close()
  # 360px timeline
  ctx,pg=await new(b, base, 360, 780); await pg.get_by_test_id('demo-oahu').click(); await continue_prep(pg)
  ok(f'{label} 360 no h-scroll (plan)', not await overflow(pg))
  await ctx.close()
async def pirate_plan_checks(pg,label):
  await pg.wait_for_timeout(3000)
  ok(f'{label} ready toast dismissed', 'Your plan is ready.' not in await pg.locator('#toast').inner_text())
  await open_trip_prep(pg)
  ok(f'{label} centralized prep sections', await pg.get_by_test_id('prep-section').count()==3 and await pg.get_by_test_id('trip-essentials').count()==1)
  await continue_prep(pg)
  ok(f'{label} no plan emoji', await pg.locator('main').evaluate(r"e=>! /(?![\u2190-\u21ff])\p{Extended_Pictographic}/u.test(e.textContent)"))
  for width in (1280,390):
    await pg.set_viewport_size({'width':width,'height':844})
    edges=await pg.evaluate("""()=>{let a=document.querySelector('.plan-header').getBoundingClientRect(),b=document.querySelector('#tab-content').getBoundingClientRect();return Math.abs(a.left-b.left)<=2&&Math.abs(a.right-b.right)<=2}""")
    ok(f'{label} aligned hero {width}', edges)
  ok(f'{label} opaque topbar', await pg.locator('.topbar').evaluate("e=>{let c=getComputedStyle(e).backgroundColor;return !c.startsWith('rgba')||parseFloat(c.split(',')[3])===1}"))

  await open_trip_prep(pg)
  for key in ('flights','hotel','food','activities','transport'):
    bucket=pg.get_by_test_id('bucket-'+key)
    ok(f'{label} budget {key} estimate and inclusion', bool(re.search(r'approx\.|Not researched yet',await bucket.text_content(),re.I)) and ('Included in your budget' in await bucket.text_content() or 'Not included' in await bucket.text_content()))
  summary=pg.locator('[data-testid=prep-section] details summary').first
  await summary.evaluate('e=>e.parentElement.open=false');await summary.focus();await pg.keyboard.press('Enter')
  ok(f'{label} budget disclosure Enter',await pg.get_by_test_id('budget-buckets').is_visible())
  await pg.keyboard.press('Space')
  ok(f'{label} budget disclosure Space',not await pg.get_by_test_id('budget-buckets').is_visible())
  await continue_prep(pg)
async def motion_checks(b,base,label):
  ctx,pg=await new(b,base,1280,800,reduced_motion='reduce')
  await open_form(pg)
  await pg.get_by_test_id('start-from').fill('Seattle'); await pg.get_by_test_id('start-to').fill('Oahu'); await pg.get_by_test_id('start-next').click()
  ok(f'{label} reduced flip disabled', await pg.locator('.question').evaluate("e=>getComputedStyle(e).animationName")=='none')
  ok(f'{label} reduced motion class', await pg.locator('html').evaluate("e=>e.classList.contains('reduce-motion')"))
  ok(f'{label} fonts', 'Fraunces Variable' in await pg.locator('h1').evaluate('e=>getComputedStyle(e).fontFamily') and 'Inter Variable' in await pg.locator('body').evaluate('e=>getComputedStyle(e).fontFamily'))
  await pg.get_by_test_id('start-over').click(); await pg.get_by_test_id('demo-oahu').click(); await continue_prep(pg)
  ok(f'{label} reduced plan flow and tile animation disabled', await pg.locator('.db-daycard').first.evaluate('e=>getComputedStyle(e).animationName')=='none')
  await ctx.close()
async def run(base, label, shots):
  async with async_playwright() as p:
    b=await p.chromium.launch()
    # Start screen screenshot (desktop)
    ctx,pg=await new(b, base, 1280, 800)
    await pg.wait_for_timeout(600)
    await open_form(pg)
    ok(f'{label} destination above fold', (await pg.get_by_test_id('start-to').bounding_box())['y']+(await pg.get_by_test_id('start-to').bounding_box())['height']<800)
    if shots: await pg.screenshot(path=str(ROOT/'screenshots/pirate-local-start.png'))
    await ctx.close()
    # A. Known destination Oahu, personal = yes
    ctx,pg=await new(b, base)
    ok(f'{label} start no h-scroll 390', not await overflow(pg))
    await answer(pg,'Oahu')
    ok(f'{label} fork shown', await pg.get_by_test_id('fork-yes').count()==1)
    await pg.get_by_test_id('fork-yes').click()
    ok(f'{label} personal Q food shown', await pg.locator('.food-group').count()==2)
    if shots: pass
    await pg.get_by_test_id('food-chip').first.click(); await pg.get_by_test_id('q-continue').click()
    await pg.get_by_test_id('pace-summary-edit').click()
    await pg.locator('[data-testid=pace-option][data-value=active]').check(); await pg.get_by_test_id('q-continue').click()
    await pg.get_by_test_id('mustdos').fill('Birthday dinner 11/26 7:30 PM'); await pg.get_by_test_id('stay').fill('The Kahala Hotel & Resort')
    await pg.get_by_test_id('q-continue').click()
    await wait_plan(pg)
    await pirate_plan_checks(pg,label)
    if shots: await pg.screenshot(path=str(ROOT/'screenshots/pirate-local-mobile.png'))
    await pg.evaluate("__gonow.go('home')"); await open_home_flow(pg)
    await pg.get_by_test_id('demo-oahu').click(); await continue_prep(pg)
    body=await plan_text(pg)
    ok(f'{label} oahu 5 days', await pg.get_by_test_id('db-day').locator('button').count()==5 and await plan_count(pg,'[data-testid=plan-day]')==5)
    ok(f'{label} under-21: no rental car stated', 'No rental car' in body or 'no rental car' in body.lower())
    ok(f'{label} under-21: no "Car: Needed"', 'Car: Needed' not in body and 'Rental car: Needed' not in body)
    ok(f'{label} Jurassic Adventure not UTV', 'Jurassic Adventure' in body)
    ok(f'{label} no UTV as plan item', await pg.locator('.item h3', has_text='UTV Raptor').count()==0)
    n=await plan_count(pg,'[data-testid=travel-chip]'); ok(f'{label} travel chips', n>15, f'{n} chips')
    chip=await pg.get_by_test_id('travel-chip').first.inner_text(); ok(f'{label} chip labeled approx', 'approx' in chip, chip)
    await open_trip_prep(pg)
    n=await pg.locator('input[data-pack-id]').count(); ok(f'{label} what-to-bring present in Trip prep', n>20, str(n))
    prep_body=await pg.get_by_test_id('trip-prep').inner_text()
    ok(f'{label} action-only prep', 'No flying for 24 h' not in prep_body and 'Thanksgiving' not in prep_body)
    await continue_prep(pg)
    ok(f'{label} day1 land 5:30 PM', '5:30 PM' in body)
    ok(f'{label} no Sample (demo data) fake tips', 'Sample (demo data)' not in body)
    ok(f'{label} no AI-generated image label', 'AI-generated' not in await pg.content())
    ok(f'{label} plan no h-scroll 390', not await overflow(pg))
    # sync: tick in activity -> packing; tick in packing -> activity
    await open_trip_prep(pg)
    t=pg.locator('input[data-pack-id]').first; pid=await t.get_attribute('data-pack-id'); await t.check()
    ok(f'{label} Trip prep packing state syncs live', await pg.evaluate('(id)=>__gonow.state.packed[id]',pid))
    ok(f'{label} packing no h-scroll', not await overflow(pg))
    t2=pg.locator('input[data-pack-id]').nth(5)
    pid2=await t2.get_attribute('data-pack-id'); await t2.check()
    await pg.reload(); await reopen(pg); await continue_prep(pg)
    await open_trip_prep(pg)
    ok(f'{label} packing ticks persist after reload', await pg.locator(f'input[data-pack-id="{pid}"]').first.is_checked() and await pg.locator(f'input[data-pack-id="{pid2}"]').first.is_checked())
    await continue_prep(pg)
    await open_trip_prep(pg)
    await pg.locator(f'input[data-pack-id="{pid}"]').first.uncheck()
    await continue_prep(pg)
    await open_trip_prep(pg)
    states=[await x.is_checked() for x in await pg.locator(f'input[data-pack-id="{pid}"]').all()]
    await continue_prep(pg)
    ok(f'{label} packing->activity sync (untick in packing clears activity ticks)', states and not any(states), f'{pid}: {len(states)} activity boxes')
    # edits
    before=await pg.locator('.item').count()
    await open_for(pg.get_by_test_id('item-remove').nth(2)); await pg.get_by_test_id('item-remove').nth(2).click(); after=await pg.locator('.item').count()
    ok(f'{label} remove item', after==before-1, f'{before}->{after}')
    await pg.get_by_test_id('undo').click(); ok(f'{label} undo', await pg.locator('.item').count()==before)
    await show_day(pg,3); await open_for(pg.get_by_test_id('rain-toggle').first); await pg.get_by_test_id('rain-toggle').first.check(); await show_day(pg,1); await open_for(pg.get_by_test_id('relax-toggle').first); await pg.get_by_test_id('relax-toggle').first.check()
    await open_for(pg.get_by_test_id('item-edit').first); await pg.get_by_test_id('item-edit').first.click(); await pg.get_by_test_id('edit-note').fill('My test note'); await pg.get_by_test_id('edit-save').click()
    await pg.reload(); await reopen(pg); await continue_prep(pg)
    relaxed=await pg.get_by_test_id('relax-toggle').first.is_checked(); note=await pg.get_by_text('My test note').count()>=1
    await show_day(pg,3); ok(f'{label} relax+rain toggles persist', relaxed and await pg.get_by_test_id('rain-toggle').first.is_checked())
    ok(f'{label} edit note persists', note)
    if shots:
      await open_for(pg.get_by_test_id('rain-toggle').first); await pg.get_by_test_id('rain-toggle').first.uncheck(); await show_day(pg,1); await open_for(pg.get_by_test_id('relax-toggle').first); await pg.get_by_test_id('relax-toggle').first.uncheck()
      await ctx.close()
      ctx,pg=await new(b, base, 1280, 860); await pg.get_by_test_id('demo-oahu').click(); await continue_prep(pg); await pg.wait_for_timeout(3500)
      el=pg.locator('[data-testid=plan-day]:visible').first
      await open_for(el.locator('.db-detail').first)
      await pg.evaluate("(()=>{const e=[...document.querySelectorAll('[data-testid=plan-day]')].find(e=>e.getClientRects().length);window.scrollTo(0,e.getBoundingClientRect().top+window.scrollY-130)})()"); await pg.wait_for_timeout(400)
      await pg.screenshot(path=str(ROOT/'screenshots/pirate-local-itinerary.png'))
    await ctx.close()
    # B. Template destination, under 21, quick plan
    ctx,pg=await new(b, base)
    await answer(pg,'Lisbon', ages=('19','24'), who='couple', styles=('nature','wandering'), start='2027-04-10', end='2027-04-14')
    await pg.get_by_test_id('fork-no').click(); await wait_plan(pg)
    body=await pg.locator('main').text_content()
    await open_trip_prep(pg)
    ok(f'{label} template banner absent in Trip prep', 'Sample/template plan — live AI generation coming soon' not in await pg.locator('main').text_content())
    await continue_prep(pg)
    ok(f'{label} template age rules', len(await pg.evaluate('__gonow.state.plan.ageRules'))>0)
    ok(f'{label} template no rental car', 'Rental car: optional' not in body.lower() and 'car: recommended' not in body.lower(), )
    ok(f'{label} template chips + bring', await pg.get_by_test_id('travel-chip').count()>3 and await pg.evaluate('__gonow.state.plan.packing.some(g=>g.items.length>0)'))
    ok(f'{label} quick-plan notice', await pg.get_by_test_id('quick-notice').count()==1)
    ok(f'{label} template no h-scroll', not await overflow(pg))
    await ctx.close()
    # C. Not sure -> recommendations
    ctx,pg=await new(b, base)
    await open_form(pg)
    await pg.get_by_test_id('start-from').fill('Seattle'); await pg.get_by_test_id('start-unsure').click(); await pg.get_by_test_id('start-next').click()
    await pg.get_by_test_id('date-start').fill('2027-02-10'); await pg.get_by_test_id('date-end').fill('2027-02-16'); await pg.get_by_test_id('q-continue').click()
    await pg.get_by_test_id('q-skip').click()  # Optional flights before budget.
    await pg.get_by_test_id('opt-3000').click(); await pg.get_by_test_id('q-continue').click()
    await pg.get_by_test_id('opt-family').click()
    if shots:
      await pg.wait_for_timeout(300); await pg.screenshot(path=str(ROOT/'screenshots/pirate-local-questions.png'))
    await pg.get_by_test_id('q-continue').click()
    await pg.get_by_test_id('q-continue').click() if await pg.get_by_test_id('q-continue').is_enabled() else await pg.get_by_test_id('q-skip').click()
    h=await pg.locator('h1').inner_text()
    if 'old' in h.lower(): await pg.get_by_test_id('q-skip').click()
    await pg.get_by_test_id('opt-nature').click(); await pg.get_by_test_id('q-continue').click()
    await pg.get_by_test_id('rec-card').first.wait_for()
    ok(f'{label} 3 recommendations', await pg.get_by_test_id('rec-card').count()==3)
    rb=await pg.locator('main').text_content()
    ok(f'{label} recs labeled estimate/typical', ('estimate' in rb.lower()) and ('not a forecast' in rb.lower()))
    ok(f'{label} recs no h-scroll', not await overflow(pg))
    name=await pg.get_by_test_id('rec-card').nth(1).locator('h2,h3').first.inner_text()
    await pg.get_by_test_id('rec-choose').nth(1).click()
    await pg.get_by_test_id('fork-no').click(); await wait_plan(pg)
    ok(f'{label} picked rec -> plan', name.split(',')[0].split('/')[0].strip()[:5] in await pg.locator('main').text_content(), name)
    await pg.get_by_test_id('photo-credits').first.click()
    cb=await pg.locator('main').text_content()
    ok(f'{label} credits screen', 'Pexels' in cb and 'Photo credits' in cb)
    ok(f'{label} credits no h-scroll', not await overflow(pg))
    await ctx.close()
    for check, args in (
      (affiliate_checks,(b,base,label)), (local_info_checks,(b,base,label)),
      (batch_a_checks,(b,base,label)), (daybuilder_checks,(b,base,label,shots)),
      (daybuilder_round5_checks,(b,base,label)), (daybuilder_senia_checks,(b,base,label)),
      (merged_checks,(b,base,label,shots)), (regression_checks,(b,base,label)),
      (motion_checks,(b,base,label))):
      try:
        await check(*args)
      except Exception as exc:
        ok(f'{label} {check.__name__} completed',False,str(exc))

async def batch_a_checks(b,base,label):
  ctx,pg=await new(b,base,360,780)
  ok(f'{label} header progress badge absent', await pg.get_by_test_id('rank-badge').count()==0)
  await answer(pg,'Oahu')
  await pg.get_by_test_id('fork-no').click()
  await through_picks(pg, OAHU_EXPORT_PICKS)
  await continue_prep(pg)
  # Item G: open the header menu to retain the screen/print action visibility check.
  await open_share_menu(pg)
  ok(f'{label} print button and screen stamp hidden', await pg.get_by_test_id('print-plan').is_visible() and not await pg.get_by_test_id('stamped-footer').is_visible())
  await pg.emulate_media(media='print')
  ok(f'{label} print chrome hidden', not await pg.locator('.topbar').is_visible() and not await pg.get_by_test_id('print-plan').is_visible() and not await pg.get_by_test_id('trip-prep-button').is_visible())
  ok(f'{label} print days and footer visible', all([await x.is_visible() for x in await pg.locator('[data-testid=plan-day]:visible').all()]) and await pg.get_by_test_id('stamped-footer').is_visible())
  print_details_failures = await pg.evaluate("""[...document.querySelectorAll('main details')].filter(d=>{
    // Hidden map, collapsed activity panels and screen-only menus are not printed.
    for(let p=d;p;p=p.parentElement)if(getComputedStyle(p).display==='none'||getComputedStyle(p).visibility==='hidden')return false;
    const c=[...d.children].find(x=>x.tagName!=='SUMMARY');
    return c && c.getBoundingClientRect().height<=0;
  }).map(d=>({testid:d.dataset.testid,classes:d.className,summary:d.querySelector('summary')?.textContent,body:d.children[1]?.outerHTML}))""")
  ok(f'{label} print details content visible', not print_details_failures, json.dumps(print_details_failures))
  await pg.emulate_media(media='screen')
  await pg.wait_for_timeout(2800)
  ok(f'{label} plan toast fully gone after auto-dismiss', await pg.locator('#toast').evaluate("e=>e.textContent==='' && (e.getBoundingClientRect().height===0 || getComputedStyle(e).opacity==='0')"))
  ok(f'{label} list default', await pg.get_by_test_id('view-list').get_attribute('aria-pressed')=='true' and not await pg.get_by_test_id('treasure-map').is_visible())
  await pg.get_by_test_id('view-map').click()
  ok(f'{label} map has five day buttons and no overflow', await pg.get_by_test_id('treasure-map').is_visible() and await pg.get_by_test_id('map-day').count()==5 and not await overflow(pg))
  await pg.get_by_test_id('map-day').nth(2).focus(); await pg.keyboard.press('Enter')
  ok(f'{label} map keyboard opens and focuses day in list', await pg.get_by_test_id('view-list').get_attribute('aria-pressed')=='true' and await pg.get_by_test_id('db-day-2026-11-27').get_attribute('aria-pressed')=='true' and await pg.get_by_test_id('db-day-2026-11-27').evaluate('e=>e===document.activeElement') and await pg.locator('#day-2').is_visible())
  await pg.get_by_test_id('view-map').click(); await pg.reload(); await reopen(pg); await continue_prep(pg)
  ok(f'{label} map preference persists', await pg.get_by_test_id('treasure-map').is_visible())
  await pg.get_by_test_id('view-list').click()
  # Edit a note and remove a different stop before both exports.
  edited_title=(await pg.locator('.item h3').first.text_content()).strip()
  await open_for(pg.get_by_test_id('item-edit').first); await pg.get_by_test_id('item-edit').first.click()
  await pg.get_by_test_id('edit-note').fill('Shared café note, bring water; enjoy 🌺'); await pg.get_by_test_id('edit-save').click()
  # Preserve the noted item and researched Diamond Head / Kualoa events.
  # Pick by title, then reuse the existing item-remove control (open parent disclosures first).
  titles=await pg.locator('.item h3').evaluate_all('es=>es.map(e=>e.textContent.trim())')
  idx=next(i for i,t in enumerate(titles) if t and 'Diamond Head' not in t and 'Kualoa' not in t and t != edited_title)
  removed=titles[idx] if idx < len(titles) else ''
  remove_button=pg.get_by_test_id('item-remove').nth(idx)
  await open_for(remove_button); await remove_button.click()
  print('ICS removed stop:',removed,'selected day:',await pg.evaluate('DayBuilder.selectedDate()'))
  ics=await pg.evaluate('window.__gonow.buildICS()')
  unfolded=ics.replace('\r\n ','')
  ok(f'{label} ICS headers and event count', ics.startswith('BEGIN:VCALENDAR\r\n') and 'VERSION:2.0\r\n' in ics and 'PRODID:' in ics and ics.count('BEGIN:VEVENT')>=12)
  ok(f'{label} ICS CRLF and UTF-8 folding', '\n' not in ics.replace('\r\n','') and all(len(line.encode('utf-8'))<=75 for line in ics.split('\r\n')))
  ok(f'{label} ICS timezone and researched events', 'TZID=Pacific/Honolulu' in ics and 'BEGIN:VTIMEZONE' in ics and 'Diamond Head' in unfolded and 'Kualoa' in unfolded)
  ok(f'{label} ICS respects note and removed stop', 'Shared café note\\, bring water\\; enjoy 🌺' in unfolded and ('SUMMARY:'+removed.replace(',', '\\,').replace(';','\\;')+'\r\n') not in unfolded)
  if label=='http':
    await open_share_menu(pg)
    async with pg.expect_download() as pending: await pg.get_by_test_id('download-ics').click()
    download=await pending.value
    ok(f'{label} ICS download filename and content', download.suggested_filename=='gonow-oahu-2026-11-25.ics' and Path(await download.path()).read_bytes().startswith(b'BEGIN:VCALENDAR\r\n'))
  else:
    await open_share_menu(pg)
    await pg.get_by_test_id('download-ics').click()
  await open_share_menu(pg)
  await pg.get_by_test_id('share-link').click(); url=await pg.get_by_test_id('share-url').input_value()
  ok(f'{label} share URL compact and excludes packing', len(url)<4000 and '#trip=j.' in url)
  await pg.get_by_test_id('modal-0').click()
  await pg.reload(); await reopen(pg); await continue_prep(pg)
  ok(f'{label} progress badge absent after reload', await pg.get_by_test_id('rank-badge').count()==0)
  await pg.get_by_test_id('start-over').click()
  ok(f'{label} progress badge absent after Start over', await pg.get_by_test_id('rank-badge').count()==0)
  await ctx.close()
  # Fresh recipient: no saved trip should be written before adoption.
  ctx,pg=await new(b,base)
  await pg.goto(url); await wait_plan(pg); await pg.get_by_test_id('shared-banner').wait_for()
  ok(f'{label} shared destination days note and removal', await plan_count(pg,'[data-testid=plan-day]')==5 and 'Oahu' in await pg.locator('h1').inner_text() and await pg.get_by_text('Your note: Shared café note, bring water; enjoy 🌺').count()==1 and removed not in await pg.locator('.item h3').all_text_contents())
  ok(f'{label} shared stamp and no saved-trip overwrite', await pg.get_by_test_id('stamped-footer').is_visible() and await pg.evaluate("localStorage.getItem('gonow:lastTrip')===null"))
  await pg.reload(); await wait_plan(pg); await pg.get_by_test_id('shared-banner').wait_for()
  ok(f'{label} shared reload remains a copy', await pg.evaluate("localStorage.getItem('gonow:lastTrip')===null"))
  await pg.get_by_test_id('adopt-shared').click()
  ok(f'{label} adoption saves trip', await pg.get_by_test_id('shared-banner').count()==0 and await pg.evaluate("localStorage.getItem('gonow:lastTrip')!==null"))
  saved=await pg.evaluate("localStorage.getItem('gonow:lastTrip')")
  await pg.goto(url); await wait_plan(pg); await pg.get_by_test_id('shared-banner').wait_for()
  await open_for(pg.get_by_test_id('item-remove').first); await pg.get_by_test_id('item-remove').first.click()
  ok(f'{label} recipient saved trip stays intact', await pg.evaluate("localStorage.getItem('gonow:lastTrip')")==saved)
  await pg.goto(base+'?fast=1#trip=j.corrupt%%%')
  await pg.get_by_text('This trip link couldn’t be opened. Start a new adventure below.').wait_for()
  ok(f'{label} corrupt share friendly start', await pg.get_by_test_id('start-next').is_visible() and 'couldn’t be opened' in await pg.locator('main').inner_text())
  await ctx.close()
async def affiliate_checks(b,base,label):
  for destination in ('Oahu','Lisbon'):
    ctx,pg=await new(b,base)
    if destination=='Oahu':
      await pg.get_by_test_id('demo-oahu').click()
    else:
      await answer(pg,destination,styles=('nature','wandering'))
      await pg.get_by_test_id('fork-no').click()
    await continue_prep(pg)
    await open_trip_prep(pg)
    tile=pg.get_by_test_id('book-links')
    ok(f'{label} {destination} booking searches outside prep',await tile.count()==0)
    # Item H moves the single disclosure behind Good to know in prep.
    # open_trip_prep already opens disclosures; reset before exercising the toggle.
    await pg.get_by_test_id('good-to-know').evaluate('e=>e.open=false')
    await pg.get_by_test_id('good-to-know-toggle').click()
    note=pg.get_by_test_id('affiliate-disclosure')
    ok(f'{label} {destination} disclosure visible',await note.is_visible() and "We may earn a fee" in await note.inner_text())
    domains={'booking':'www.booking.com','expedia':'www.expedia.com','skyscanner':'www.skyscanner.com','getyourguide':'www.getyourguide.com','viator':'www.viator.com'}
    await continue_prep(pg)
    links=await pg.locator('a[data-partner]').evaluate_all("els=>els.map(e=>({key:e.dataset.partner,href:e.href,rel:e.rel,target:e.target,text:e.textContent}))")
    ok(f'{label} {destination} distributed partner links',bool(links) and set(x['key'] for x in links).issubset(domains))
    for link in links:
      url=urlparse(link['href']);query=parse_qs(url.query)
      # Flight routes use known IATA codes; unknown routes use the homepage.
      dest_ok=(destination.lower() in unquote(link['href']).lower()) if link['key']!='skyscanner' else (('/LAX/HNL/' in url.path) if destination=='Oahu' else url.path=='/')
      ok(f"{label} {destination} {link['key']} safe search",link['href'].startswith('https://'+domains[link['key']]+'/') and dest_ok and not any(k in query for k in ('aid','partner_id','pid','mcid')) and {'sponsored','noopener'}.issubset(link['rel'].split()) and link['target']=='_blank' and link['text'] in ('Book','Reserve','Book flights','Find a hotel'))
    # DayBuilder mounts one day at a time; arrival day need not contain attractions.
    ok(f'{label} {destination} activity searches',await plan_count(pg, '[data-testid=item-book]')>0)
    if destination=='Oahu':
      await continue_prep(pg)
      await show_day(pg,1)
      stop=pg.locator('.item').filter(has=pg.locator('h3',has_text='Kualoa Ranch')).first
      ok(f'{label} Kualoa official link retained',await stop.locator('a[href^="https://www.kualoa.com/"]').count()>0)
    await pg.emulate_media(media='print')
    ok(f'{label} {destination} partner links hidden in print',not any([await x.is_visible() for x in await pg.locator('a[data-partner]').all()]))
    await ctx.close()

async def local_info_checks(b,base,label):
  ctx,pg=await new(b,base)
  calls=[];pg.on('request',lambda r: calls.append(r.url))
  await pg.get_by_test_id('demo-oahu').click();await continue_prep(pg)
  tile=pg.get_by_test_id('local-info')
  # Item H keeps local facts exclusively inside prep.
  ok(f'{label} local info outside prep',await tile.count()==0)
  await open_trip_prep(pg)
  await pg.get_by_test_id('good-to-know').evaluate('e=>e.open=true')
  await tile.get_by_test_id('info-asof').first.wait_for()
  body=await tile.inner_text()
  ok(f'{label} local static guidance',all(t in body for t in ('Pacific/Honolulu','Types A/B','120 V','USD','Local time now','2026-11','General guidance — check official sources')))
  ok(f'{label} local source and asof',await tile.get_by_test_id('info-source').count()==1 and 'Data date:' in body and 'As of' in body)
  forecast=date(2026,11,25)>=date.today() and date(2026,11,29)<=date.today()+timedelta(days=15)
  ok(f'{label} Oahu weather path',('Weather forecast' if forecast else 'Last year on these dates (not a forecast)') in body)
  ok(f'{label} Oahu no FX request','Uses US dollars (USD)' in body and not any('frankfurter.dev' in u for u in calls))
  weather_calls=[u for u in calls if 'open-meteo.com/v1/' in u]
  query=parse_qs(urlparse(weather_calls[0]).query)
  ok(f'{label} weather request dates',query['start_date']==['2026-11-25' if forecast else '2025-11-25'] and ('archive-api.' in weather_calls[0])!=forecast)
  count=len(weather_calls)
  await continue_prep(pg);await open_trip_prep(pg)
  await pg.reload(); await reopen(pg); await continue_prep(pg)
  await open_trip_prep(pg);await pg.get_by_test_id('good-to-know').evaluate('e=>e.open=true');tile=pg.get_by_test_id('local-info');await tile.get_by_test_id('info-asof').first.wait_for()
  ok(f'{label} weather session cache',len([u for u in calls if 'open-meteo.com/v1/' in u])==count)
  await ctx.close()
  ctx,pg=await new(b,base)
  calls=[];pg.on('request',lambda r:calls.append(r.url))
  # Use browser-local dates, matching the forecast window in the application.
  dates=await pg.evaluate("[3,6].map(n=>{let d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})")
  await answer(pg,'Lisbon',start=dates[0],end=dates[1])
  await pg.get_by_test_id('fork-no').click();await wait_plan(pg)
  await open_trip_prep(pg);await pg.get_by_test_id('good-to-know').evaluate('e=>e.open=true');tile=pg.get_by_test_id('local-info')
  await tile.get_by_test_id('fx-amount').wait_for();await tile.get_by_text('Weather forecast',exact=True).wait_for()
  await tile.get_by_test_id('fx-amount').fill('100')
  ok(f'{label} Lisbon FX converter',await tile.get_by_test_id('fx-result').inner_text()=='100 USD ≈ 90 EUR')
  ok(f'{label} Lisbon daily forecast','high 80 °F / low 65 °F' in await tile.inner_text() and 'Rain chance 20%' in await tile.inner_text() and any('api.open-meteo.com/v1/forecast' in u for u in calls))
  ok(f'{label} both live sources dated',await tile.get_by_test_id('info-source').count()==2 and await tile.get_by_test_id('info-asof').count()==2)
  ok(f'{label} local info narrow layout',not await overflow(pg))
  await ctx.close()
  ctx,pg=await new(b,base)
  # Invalid JSON with 200 avoids browser-generated resource-load console errors.
  async def invalid(route): await route.fulfill(status=200,content_type='application/json',body='invalid JSON')
  await pg.route('https://archive-api.open-meteo.com/**',invalid)
  await pg.route('https://api.open-meteo.com/**',invalid)
  await pg.route('https://api.frankfurter.dev/**',invalid)
  await answer(pg,'Lisbon',start=dates[0],end=dates[1])
  await pg.get_by_test_id('fork-no').click();await wait_plan(pg)
  await open_trip_prep(pg);await pg.get_by_test_id('good-to-know').evaluate('e=>e.open=true');tile=pg.get_by_test_id('local-info')
  await tile.get_by_test_id('info-retry').wait_for();await tile.get_by_text('Live rate unavailable',exact=True).wait_for()
  ok(f'{label} friendly live failure',"Couldn't load live weather — check open-meteo.com" in await tile.inner_text() and 'Europe/Lisbon' in await tile.inner_text())
  await pg.unroute('https://api.open-meteo.com/**',invalid)
  await tile.get_by_test_id('info-retry').click();await tile.get_by_text('Weather forecast',exact=True).wait_for()
  ok(f'{label} weather retry recovers',await tile.get_by_test_id('info-retry').count()==0)
  await ctx.close()
  # CRC is outside the ECB currency list: no Frankfurter request at all.
  ctx,pg=await new(b,base)
  calls=[];pg.on('request',lambda r:calls.append(r.url))
  await answer(pg,'Costa Rica',start=dates[0],end=dates[1])
  await pg.get_by_test_id('fork-no').click();await wait_plan(pg)
  await open_trip_prep(pg);await pg.get_by_test_id('good-to-know').evaluate('e=>e.open=true');tile=pg.get_by_test_id('local-info')
  await tile.get_by_text('Live rate unavailable',exact=False).wait_for()
  await tile.get_by_test_id('info-asof').first.wait_for()
  ok(f'{label} Costa Rica CRC skips Frankfurter',not any('api.frankfurter.dev' in u for u in calls) and 'CRC' in await tile.inner_text() and await tile.get_by_text('Live rate unavailable',exact=False).is_visible())
  await ctx.close()
async def db_open(b,base,w=1280,reduced_motion='no-preference'):
  ctx,pg=await new(b,base,w,844,reduced_motion,has_touch=True)
  await pg.get_by_test_id('demo-oahu').click()
  await continue_prep(pg)
  await pg.get_by_test_id('db-root').wait_for()
  await pg.get_by_test_id('db-root').scroll_into_view_if_needed()
  return ctx,pg

async def db_pointer(pg,handle,target,after=False):
  # Keep both endpoints visible; actual Pointer Events are generated by mouse.
  # Center the handle first; if the target is off-screen or under the sticky top bar,
  # center the target instead (the two are close together in these checks).
  await handle.evaluate("e=>e.scrollIntoView({block:'center'})")
  dest=await target.bounding_box()
  if dest['y']<120 or dest['y']+dest['height']>pg.viewport_size['height']-20:
    await target.evaluate("e=>e.scrollIntoView({block:'center'})")
    origin=await handle.bounding_box()
    if origin['y']+origin['height']>pg.viewport_size['height']-10:
      # Merged day cards are taller: put the handle near the bottom so both ends stay on screen.
      await pg.evaluate('d=>window.scrollBy(0,d)', origin['y']+origin['height']-pg.viewport_size['height']+70)
  origin=await handle.bounding_box()
  await pg.mouse.move(origin['x']+origin['width']/2,origin['y']+origin['height']/2)
  await pg.mouse.down()
  dest=await target.bounding_box()
  await pg.mouse.move(dest['x']+dest['width']/2,dest['y']+dest['height']*(.8 if after else .2),steps=18)
  await pg.mouse.up()

async def blocked_dive_is_unscheduled(pg):
  return await pg.evaluate("""() => {
    const saved=JSON.parse(localStorage.getItem('gonow:daybuilder:oahu-demo-2026-11'));
    const date=DayBuilder.selectedDate();
    const result=DayBuilder.reflow(saved.days[date],{departureDate:'2026-11-29',flightTime:saved.flightTime||''});
    return !result.items.some(i=>(i.tags||[]).includes('dive')) && result.unscheduled.some(i=>i.blockedReason==='No diving within 24h of your flight');
  }""")

async def add_reflow_fixture(pg, chest_id):
  """Explicitly seed scheduled intent for legacy reflow checks; tray is day-local.
  User-facing add/schedule behavior is covered in test_time_entry.py.
  """
  target_date = await pg.evaluate("DayBuilder.selectedDate()")
  await pg.evaluate("""id => {
    const key='gonow:daybuilder:oahu-demo-2026-11';
    const saved=JSON.parse(localStorage.getItem(key)) || {days:{}};
    const date=DayBuilder.selectedDate();
    saved.days[date] ||= DayBuilder.buildSuggested(date);
    const item={...DayBuilder.trayItems().find(i=>i.id===id),id:'instance-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)};
    const list=saved.days[date].items, at=list.findIndex(i=>i.id==='photos');
    list.splice(at<0?list.length:at,0,item);
    localStorage.setItem(key,JSON.stringify(saved));
  }""", chest_id)
  await pg.reload(); await reopen(pg)
  await pg.get_by_test_id('db-day-'+target_date).click()

async def daybuilder_checks(b,base,label,shots):
  ctx,pg=await db_open(b,base)
  day=pg.get_by_test_id('db-day-list')
  expected=[('5:35 AM–5:50 AM','Uber Reserve to Diamond Head'),('6:00 AM–7:30 AM','Diamond Head — 6:00 AM entry slot'),('7:35 AM–7:55 AM','Uber to Twin Fin, 2570 Kalākaua (Kualoa shuttle stop)'),('8:00 AM–9:10 AM','Kualoa Ranch shuttle from Twin Fin'),('9:10 AM–9:25 AM','Grab-and-go breakfast'),('9:30 AM–12:00 PM','Kualoa Ranch — Jurassic Adventure (not UTV)'),('1:00 PM–2:00 PM','Kualoa shuttle back to Waikiki'),('2:00 PM–2:20 PM','Uber to the Kahala'),('2:30 PM–4:30 PM','Free time at the Kahala (pool / beach downtime)'),('4:30 PM–5:30 PM','Get ready / change + makeup'),('5:40 PM–6:40 PM','Kahala Beach “Jennie” palms — sunset photos'),('7:30 PM–9:30 PM','Birthday dinner — La Mer at Halekulani')]
  async def timeline():
    return await day.get_by_test_id('db-pair').evaluate_all("es=>es.map(e=>[e.querySelector('[data-testid=db-time]').textContent,e.querySelector('strong').textContent])")
  ok(label+' db exact default',await timeline()==[list(x) for x in expected])
  await pg.locator('#live').evaluate('e=>e.remove()')
  ok(label+' db own live region',await pg.get_by_test_id('db-root').get_by_test_id('db-live').count()==1)
  ok(label+' db zero conflicts',await day.locator('.db-conflict').count()==0)
  ok(label+' db dinner departure','Uber ~20 min' in await day.inner_text())
  for date in ['2026-11-25','2026-11-26','2026-11-27','2026-11-28','2026-11-29']:
    await pg.get_by_test_id('db-day-'+date).click()
    ok(label+' db clear '+date,await day.locator('.db-conflict').count()==0)
  # The default departure keeps its sample anchor and now offers the shared editor.
  ok(label+' db flight anchor','Sample departure' in await day.inner_text() and await day.locator('.db-locked').count()==1)
  await pg.get_by_test_id('db-day-2026-11-26').click()
  async def ids():
    return await day.locator('[data-db-id]:not(.db-prep)').evaluate_all('es=>es.map(e=>e.dataset.dbId)')
  async def raw_ids():
    return await pg.evaluate("JSON.parse(localStorage.getItem('gonow:daybuilder:oahu-demo-2026-11')).days['2026-11-26'].items.map(i=>i.id)")
  locked=day.locator('[data-db-id=lamer]')
  ok(label+' db locked controls absent',await locked.locator('[data-db-action=handle],[data-db-action=up],[data-db-action=down]').count()==0)
  await locked.click();await pg.keyboard.press('ArrowUp')
  ok(label+' db locked stays anchored',(await timeline())[-1]==list(expected[-1]) and 'Locked booking' in await pg.get_by_test_id('db-live').inner_text())
  if await locked.get_by_test_id('db-expand').get_attribute('aria-expanded')=='true': await locked.get_by_test_id('db-expand').click()
  await open_add_menu(pg)
  assert await pg.get_by_test_id('db-tray-toggle').count()==0  # Item F: ideas are picked through Swap.
  # Item F: replace chest disclosure assertions with its removal; reflow fixtures below remain.
  ok(label+' old day tray absent',await pg.get_by_test_id('db-tray').count()==0)
  await pg.evaluate("""() => {
    window.dbSawShake = false;
    window.dbShakeObserver = new MutationObserver(records => {
      if (document.querySelector('.db-shake') || records.some(r => (r.oldValue || '').includes('db-shake'))) window.dbSawShake = true;
    });
    window.dbShakeObserver.observe([...document.querySelectorAll('[data-testid=db-root]')].find(e=>e.getClientRects().length), {subtree:true, childList:true, attributes:true, attributeFilter:['class'], attributeOldValue:true});
  }""")
  await add_reflow_fixture(pg, 'chest-1')
  instance=await day.locator('[data-db-id^=instance-]').last.get_attribute('data-db-id')
  ok(label+' db normal motion shake',await day.locator('.db-conflict').count()>0)
  baseline=[x for x in await ids() if x!=instance]
  wanted=baseline.copy();wanted.insert(wanted.index('photos'),instance)
  ok(label+' db pointer adds at index',await ids()==wanted)
  ok(label+' db parasail documented walk conflict',"Heads-up: Ends 7:00 PM — you'd miss La Mer" in await day.get_by_test_id('db-note').all_text_contents())
  ok(label+' db parasail exact',await day.locator('[data-db-id="'+instance+'"]').get_by_test_id('db-time').text_content()=='2:50 PM–4:20 PM' and await day.locator('[data-db-id=photos]').get_by_test_id('db-time').text_content()=='6:00 PM–7:00 PM')
  ok(label+' db free disappears',await day.locator('[data-db-id=free]').count()==0)
  ok(label+' db parasail late connector','Uber ~20 min · leave by 6:55 PM' in await day.inner_text() and await locked.locator('.db-note').count()==0)
  before=await raw_ids()
  await db_pointer(pg,(await card_action(pg, day.locator('[data-db-id="'+instance+'"]'), 'db-handle')),day.locator('[data-db-id=return-hotel]'),after=True)
  wanted=before.copy();wanted.remove(instance);wanted.insert(wanted.index('free'),instance)
  got=await raw_ids();ok(label+' db pointer reorders exact',got==wanted,str((before,got,wanted)))
  handle=(await card_action(pg, day.locator('[data-db-id="'+instance+'"]'), 'db-handle'))
  # After moving before free time, the flexible row can disappear. Use raw order
  # from the saved intent when asserting movement of exactly one slot.
  before=await raw_ids()
  await handle.focus();await pg.keyboard.press('Space')
  ok(label+' db picked style',await day.locator('.db-picked').count()==1)
  await pg.keyboard.press('ArrowDown');await pg.keyboard.press('Space')
  wanted=before.copy();at=wanted.index(instance);wanted[at:at+2]=reversed(wanted[at:at+2])
  ok(label+' db keyboard one slot',await raw_ids()==wanted)
  before=await raw_ids()
  await handle.focus();await pg.keyboard.press('Space');await pg.keyboard.press('ArrowUp');await pg.keyboard.press('Escape')
  ok(label+' db keyboard cancel',await raw_ids()==before and await pg.get_by_test_id('db-live').inner_text()=='Move cancelled')
  await pg.keyboard.press('Space');await pg.keyboard.press('Space')
  ok(label+' db keyboard announcement','Dropped' in await pg.get_by_test_id('db-live').inner_text())
  # Escape during an actual pointer drag removes feedback and preserves order.
  before=await raw_ids()
  await handle.scroll_into_view_if_needed()
  origin=await handle.bounding_box()
  await pg.mouse.move(origin['x']+10,origin['y']+10);await pg.mouse.down()
  await pg.mouse.move(origin['x']+50,origin['y']+30,steps=5)
  ok(label+' db pointer ghost',await pg.locator('.db-ghost').count()==1)
  await pg.keyboard.press('Escape');await pg.mouse.up()
  ok(label+' db pointer cancel',await raw_ids()==before and await pg.locator('.db-ghost,.db-drop-indicator').count()==0)
  await open_add_menu(pg)
  await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
  await add_reflow_fixture(pg, 'chest-0')
  notes=await day.get_by_test_id('db-note').all_text_contents()
  visible_notes=await day.locator('[data-testid=db-note]:visible').all_text_contents()
  ok(label+' db visible conflict heads-up',any('Heads-up' in n and "you'd miss La Mer" in n for n in visible_notes))
  ok(label+' db note references',await day.locator('.db-conflict').evaluate_all("es=>es.every(e=>e.getAttribute('aria-describedby').split(/\\s+/).every(id=>document.getElementById(id))&&(!e.querySelector('[data-db-action=handle]')||e.querySelector('[data-db-action=handle]').getAttribute('aria-describedby')===e.getAttribute('aria-describedby')))"))
  ok(label+' db La Mer dive conflict',any(re.fullmatch(r"Heads-up: Ends .* — you'd miss La Mer",n) for n in notes))
  ok(label+' db all notes described',await day.locator('.db-conflict').evaluate_all("es=>es.every(e=>e.getAttribute('aria-describedby').split(/\\s+/).length===e.querySelectorAll('[data-testid=db-note]').length)"))
  ok(label+' db locked no blame',await locked.get_by_test_id('db-note').count()==0 and 'db-conflict' not in (await locked.get_attribute('class')))
  ok(label+' db late connector',await day.locator('.db-travel-late').inner_text()=='Uber ~20 min · leave by 6:55 PM')
  # Start from suggested order so photos is directly before the locked dinner.
  await open_add_menu(pg)
  await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
  await (await card_action(pg, day.locator('[data-db-id=photos]'), 'db-down')).click()
  ok(label+' db move past locked',(await raw_ids()).index('photos')>(await raw_ids()).index('lamer') and await day.locator('[data-db-id=photos]').get_by_test_id('db-time').text_content()=='10:00 PM–11:00 PM' and await locked.get_by_test_id('db-time').text_content()=='7:30 PM–9:30 PM')
  ok(label+' db afterdark button','After dark — sunset ~5:48 PM' in await day.locator('[data-db-id=photos]').inner_text())
  await open_add_menu(pg)
  await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
  handle=(await card_action(pg, day.locator('[data-db-id=photos]'), 'db-handle'))
  await handle.focus();await pg.keyboard.press('Space');await pg.keyboard.press('ArrowDown');await pg.keyboard.press('Space')
  ok(label+' db afterdark keyboard','After dark — sunset ~5:48 PM' in await day.locator('[data-db-id=photos]').inner_text())
  edited=await timeline();await pg.reload(); await reopen(pg); await pg.get_by_test_id('db-root').wait_for()
  ok(label+' db persistence',await timeline()==edited)
  await open_add_menu(pg)
  await pg.get_by_test_id('day-add-own').click();await pg.get_by_test_id('add-own-booked').check()
  await pg.get_by_test_id('add-own-name').fill('Harbor reservation')
  await pg.get_by_test_id('add-own-start').fill('22:00');await pg.get_by_test_id('add-own-end').fill('23:00')
  await pg.get_by_test_id('add-own-end').fill('21:00')
  await pg.get_by_test_id('add-own-submit').click()
  ok(label+' db invalid booking','after start' in await pg.get_by_test_id('add-own-note').inner_text())
  await pg.get_by_test_id('add-own-end').fill('23:00')
  await pg.get_by_test_id('add-own-submit').click()
  booking=day.locator('.db-locked[data-db-id^=custom-]').filter(has_text='Harbor reservation')
  ok(label+' db custom booking','10:00 PM–11:00 PM' in await booking.text_content() and 'Locked' in await booking.inner_text())
  ok(label+' db booking focus',await booking.evaluate('e=>e.contains(document.activeElement)'))
  await (await card_action(pg, booking, 'db-delete')).click()
  ok(label+' db delete focus',await pg.evaluate("document.activeElement.matches('[data-testid=day-add-own], [data-db-id], [data-db-id] button')"))
  ok(label+' db delete booking',await booking.count()==0)
  await open_add_menu(pg)
  await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
  ok(label+' db reset focus',await pg.get_by_test_id('day-reset').evaluate('e=>e===document.activeElement'))
  ok(label+' db reset',await timeline()==[list(x) for x in expected])
  await pg.set_viewport_size({'width':390,'height':844})
  await open_add_menu(pg)
  assert await pg.get_by_test_id('db-tray-toggle').count()==0  # Item F: ideas are picked through Swap.
  await add_reflow_fixture(pg, 'chest-1')
  await (await card_action(pg, day.locator('[data-db-id^=instance-]').last, 'db-up')).tap()
  await open_add_menu(pg)
  if not await pg.get_by_test_id('add-own-sheet').is_visible(): await pg.get_by_test_id('day-add-own').click();await pg.get_by_test_id('add-own-booked').check()
  # Item F: sheet actions share a row; verify a usable target within the viewport.
  ok(label+' db mobile booking button',await pg.get_by_test_id('add-own-submit').evaluate('e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.width>=44&&r.right<=innerWidth}'))
  ok(label+' db mobile usable',not await overflow(pg))
  await pg.keyboard.press('Escape')  # Item F: dismiss the modal before switching days.
  ok(label+' db mobile tap targets',await day.locator('.db-controls button').evaluate_all('es=>es.every(e=>e.getBoundingClientRect().width>=40&&e.getBoundingClientRect().height>=40)'))
  await pg.get_by_test_id('db-day-2026-11-28').click()
  await add_reflow_fixture(pg, 'chest-0')
  ok(label+' db dive flight blocked',await blocked_dive_is_unscheduled(pg))
  await add_reflow_fixture(pg, 'chest-bar')
  ok(label+' db age warning','21+ only in the US' in await day.inner_text())
  if shots: await pg.screenshot(path=str(ROOT/'screenshots/daybuilder-mobile-conflict.png'))
  await ctx.close()
  ctx,pg=await db_open(b,base,reduced_motion='reduce')
  await open_add_menu(pg)
  assert await pg.get_by_test_id('db-tray-toggle').count()==0  # Item F: ideas are picked through Swap.
  await add_reflow_fixture(pg, 'chest-1')
  conflict=pg.locator('.db-conflict').first
  ok(label+' db reduced motion',await conflict.count()>0 and await conflict.evaluate("e=>getComputedStyle(e).animationName==='none'&&!e.classList.contains('db-shake')"))
  await ctx.close()

async def merged_checks(b,base,label,shots):
  """Phase 2: one merged day view, pop-open boxes, and the lock toggle. Screenshots: tests/shots_merged.py."""
  ctx,pg=await db_open(b,base)
  root=pg.get_by_test_id('db-root'); day=pg.get_by_test_id('db-day-list')
  dates=await pg.evaluate('window.__gonow.state.plan.days.map(d=>d.date)')
  ok(label+' merged no daynav or static day sections',await pg.locator('.daynav').count()==0 and await pg.locator('main section.day:not(.db-daycard)').count()==0)
  ok(label+' merged builder in itinerary without tiles',await pg.locator('#tab-content > [data-testid=db-root]:visible').count()==1 and await pg.locator('.tile-grid').count()==0)
  titles=[]
  for i,d in enumerate(dates):
    await pg.get_by_test_id('db-day-'+d).click()
    ok(f'{label} merged {d} appears exactly once',await pg.get_by_test_id('plan-day').count()==1 and await pg.locator(f'#day-{i}').count()==1 and await pg.locator(f'#day-{i}').get_attribute('data-testid')=='plan-day')
    titles.append(await pg.locator(f'#day-{i} .day-head h2, #day-{i} .day-head h3').first.inner_text())
    ok(f'{label} merged {d} has head, list and footer',await root.locator('.db-daycard .day-head').count()==1 and await root.locator('.db-daycard [data-testid=db-day-list]').count()==1 and (d==dates[-1] or await root.locator('.db-daycard .day-footer').count()==1))
  ok(label+' merged day titles distinct',len(set(titles))==5,str(titles))
  ok(label+' merged chips labelled Day N',[await pg.get_by_test_id('db-day-'+d).get_attribute('aria-label') for d in dates][0].startswith('Day 1'))
  await pg.get_by_test_id('db-day-2026-11-26').click()
  # Pop-open boxes
  row=day.locator('[data-db-id="2026-11-26-1"]'); ex=row.get_by_test_id('db-expand'); panel=row.get_by_test_id('db-detail')
  cid=await ex.get_attribute('aria-controls')
  ok(label+' expand aria wiring',await ex.get_attribute('aria-expanded')=='false' and cid==await panel.get_attribute('id') and not await panel.is_visible() and await panel.get_attribute('role')=='region')
  ok(label+' boxes compact by default',await root.locator('.db-content [data-testid=db-detail]:visible').count()==0)
  await ex.click()
  ok(label+' click expands',await ex.get_attribute('aria-expanded')=='true' and await panel.is_visible() and await row.evaluate("e=>e.classList.contains('is-open')"))
  ok(label+' expanded pops',await panel.evaluate("e=>e.classList.contains('db-pop')&&getComputedStyle(e).animationName==='tile-pop'"))
  # Diamond Head is time-locked; booking actions are checked on the unlocked ticketed tour below.
  ok(label+' locked entry has no booking action',await panel.locator('[data-testid=item-book], [data-testid=item-reserve]').count()==0)
  tour=day.locator('[data-db-id="2026-11-26-5"]')
  await tour.get_by_test_id('db-expand').click()
  ok(label+' ticketed expanded detail booking',await tour.get_by_test_id('db-detail').get_by_test_id('item-book').is_visible())
  await tour.get_by_test_id('db-expand').click()
  ok(label+' expanded checklist photo tip',await panel.get_by_test_id('bring-item').count()==0 and await panel.locator('.db-photo img').count()==1  and await panel.get_by_test_id('travel-chip').count()==1)
  ok(label+' prep moved out of activity box',await panel.get_by_test_id('bring-item').count()==0)
  await ex.click()
  ok(label+' second click collapses',await ex.get_attribute('aria-expanded')=='false' and not await panel.is_visible())
  photos=day.locator('[data-db-id=photos]')
  await photos.get_by_test_id('db-time').click()
  ok(label+' direct clock opens time editor',await photos.get_by_test_id('activity-time-form').is_visible() and await photos.get_by_test_id('db-expand').get_attribute('aria-expanded')=='false')
  await pg.keyboard.press('Escape')
  await ex.focus(); await pg.keyboard.press('Enter')
  ok(label+' Enter expands',await ex.get_attribute('aria-expanded')=='true' and await panel.is_visible())
  await pg.keyboard.press('Space')
  ok(label+' Space collapses',await ex.get_attribute('aria-expanded')=='false' and not await panel.is_visible())
  free=day.locator('[data-db-id=free]')
  await free.get_by_test_id('db-lock').click()
  if await pg.get_by_test_id('unlock-confirm').count(): await pg.get_by_test_id('unlock-accept').click()
  ok(label+' lock button does not toggle expand',await free.get_by_test_id('db-expand').get_attribute('aria-expanded')=='false')
  await free.get_by_test_id('db-lock').click()
  await pg.get_by_test_id('unlock-accept').click()
  photos=day.locator('[data-db-id=photos]')
  await (await card_action(pg, photos, 'db-up')).click(); await (await card_action(pg, photos, 'db-down')).click()
  ok(label+' up/down do not toggle',await photos.get_by_test_id('db-expand').get_attribute('aria-expanded')=='false')
  await open_add_menu(pg)
  await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
  await photos.get_by_test_id('db-expand').click()
  ok(label+' open before drag',await photos.get_by_test_id('db-expand').get_attribute('aria-expanded')=='true')
  await db_pointer(pg,(await card_action(pg, photos, 'db-handle')),day.locator('[data-db-id=return-hotel]'))
  order=await day.locator('[data-db-id]').evaluate_all('es=>es.map(e=>e.dataset.dbId)')
  moved=day.locator('[data-db-id=photos]')
  ok(label+' drag does not leave box expanded',order.index('photos')<order.index('return-hotel') and await moved.get_by_test_id('db-expand').get_attribute('aria-expanded')=='false' and not await moved.get_by_test_id('db-detail').is_visible(),str(order))
  await open_add_menu(pg)
  await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
  # Confirmed bookings use static tags to avoid dead unlock toggles.
  rows=day.locator('[data-testid=db-pair]:not(.db-prep)')
  n=await rows.count(); locks=day.locator('button[data-testid=db-lock]')  # Static indicators are not 44px toggle targets.
  ok(label+' lock toggle on every box',n>5 and await locks.count()+await day.get_by_test_id('db-locked-tag').count()==n,f'{n} rows {await locks.count()} locks')
  ok(label+' lock toggle 44px padlock',await locks.evaluate_all("es=>es.every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&e.querySelector('svg')&&['true','false'].includes(e.getAttribute('aria-pressed'))})"))
  ok(label+' lock and move menu share card',await day.locator('[data-db-id=free]').evaluate("e=>!!e.querySelector('.db-controls [data-db-action=lock]')&&!!e.querySelector('.db-controls [data-testid=db-more]')&&['handle','up','down','remove'].every(a=>e.querySelector('[data-testid=db-more-menu] [data-db-action='+a+']'))"))
  lamer=day.locator('[data-db-id=lamer]').get_by_test_id('db-locked-tag')
  ok(label+' booking starts locked',await lamer.count()==1 and await lamer.evaluate("e=>e.tagName==='SPAN'&&!e.hasAttribute('role')&&!e.hasAttribute('tabindex')"))
  ok(label+' open box starts unlocked',await free.get_by_test_id('db-lock').get_attribute('aria-pressed')=='false' and (await free.get_by_test_id('db-lock').get_attribute('aria-label')).startswith('Lock '))
  # 11/27: lock the dive at 8:00, then push lunch into it.
  await pg.get_by_test_id('db-day-2026-11-27').click()
  dive=day.locator('[data-db-id=dive-1127]')
  async def t(id): return await day.locator(f'[data-db-id="{id}"]').get_by_test_id('db-time').text_content()
  async def order27(): return await day.locator('[data-db-id]:not(.db-prep)').evaluate_all('es=>es.map(e=>e.dataset.dbId)')
  before=await t('dive-1127')
  await dive.get_by_test_id('db-lock').click()
  dl=dive.get_by_test_id('db-lock')
  ok(label+' user lock pressed',await dl.get_attribute('aria-pressed')=='true' and await dl.get_attribute('aria-label')=='Unlock time' and await dive.evaluate("e=>e.classList.contains('db-user-locked')&&e.classList.contains('db-locked')"))
  ok(label+' user lock keeps 8:00',before=='8:00 AM–11:00 AM' and await t('dive-1127')==before and 'Locked' in await pg.get_by_test_id('db-live').inner_text())
  ok(label+' locked box immovable',await dive.locator('[data-db-action=handle],[data-db-action=up],[data-db-action=down],[data-db-action=remove]').count()==0)
  await dive.focus(); await pg.keyboard.press('ArrowDown')
  ok(label+' locked box keyboard immovable',await t('dive-1127')==before and 'unlock' in (await pg.get_by_test_id('db-live').inner_text()).lower())
  ok(label+' expand still works on locked box',await dive.get_by_test_id('db-expand').count()==1)
  for _ in range(4):
    o=await order27()
    if o.index('lunch-1127')<o.index('dive-1127'): break
    await (await card_action(pg, day.locator('[data-db-id=lunch-1127]'), 'db-up')).click()
  o=await order27()
  notes=' '.join(await day.get_by_test_id('db-note').all_text_contents())
  ok(label+' reorder works around lock',o.index('lunch-1127')<o.index('dive-1127') and await t('dive-1127')==before,str(o))
  ok(label+' conflict warning when pushed into lock',('Dive' in notes or 'dive' in notes) and await day.locator('.db-conflict').count()>0,notes)
  # Persistence across reload
  await pg.reload(); await reopen(pg); await pg.get_by_test_id('db-root').wait_for(); await pg.get_by_test_id('db-day-2026-11-27').click()
  dive=day.locator('[data-db-id=dive-1127]')
  ok(label+' lock persists across reload',await dive.get_by_test_id('db-lock').get_attribute('aria-pressed')=='true' and await t('dive-1127')==before and (await order27())==o)
  saved=await pg.evaluate("JSON.parse(localStorage.getItem('gonow:daybuilder:oahu-demo-2026-11')).days['2026-11-27'].items.find(i=>i.id==='dive-1127')")
  ok(label+' lock stored in localStorage',saved.get('locked') and saved.get('userLocked'))
  # Share round-trip
  await open_share_menu(pg)
  await pg.get_by_test_id('share-link').click(); url=await pg.get_by_test_id('share-url').input_value(); await pg.get_by_test_id('modal-0').click()
  ok(label+' share link carries builder',len(url)<4000 and '#trip=j.' in url)
  c2,p2=await new(b,base,1280,844)
  await p2.goto(url); await p2.get_by_test_id('shared-banner').wait_for(); await p2.get_by_test_id('db-root').wait_for()
  await p2.get_by_test_id('db-day-2026-11-27').click()
  d2=p2.get_by_test_id('db-day-list')
  ok(label+' share round-trip keeps lock and order',await d2.locator('[data-db-id=dive-1127]').get_by_test_id('db-lock').get_attribute('aria-pressed')=='true' and await d2.locator('[data-db-id=dive-1127]').get_by_test_id('db-time').text_content()==before and await d2.locator('[data-db-id]:not(.db-prep)').evaluate_all('es=>es.map(e=>e.dataset.dbId)')==o)
  ok(label+' shared copy writes no builder state',await p2.evaluate("localStorage.getItem('gonow:daybuilder:oahu-demo-2026-11')===null"))
  await p2.get_by_test_id('adopt-shared').click(); await p2.get_by_test_id('db-root').wait_for()
  ok(label+' adopting saves the shared builder',await p2.evaluate("(JSON.parse(localStorage.getItem('gonow:daybuilder:oahu-demo-2026-11')||'{}').days||{})['2026-11-27']?.items.find(i=>i.id==='dive-1127')?.userLocked===true"))
  await c2.close()
  # Unlock restores normal reflow
  await dive.get_by_test_id('db-lock').click()
  await pg.get_by_test_id('unlock-accept').click()
  ok(label+' unlock restores reflow',await dive.get_by_test_id('db-lock').get_attribute('aria-pressed')=='false' and await dive.get_by_test_id('db-handle').count()==1 and not any('dive' in n.lower() for n in await day.get_by_test_id('db-note').all_text_contents()) and await dive.get_by_test_id('db-note').count()==0 and await t('dive-1127')!=before and 'Unlocked' in await pg.get_by_test_id('db-live').inner_text())
  # Confirmed bookings stay fixed; the old unlock control was a dead toggle.
  senia=day.locator('[data-db-id=senia]')
  ok(label+' booking stays locked',await senia.locator('button[data-testid=db-lock]').count()==0 and await senia.get_by_test_id('db-locked-tag').count()==1 and await senia.get_by_test_id('db-up').count()==0)
  await open_add_menu(pg)
  await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
  ok(label+' reset restores default locks',await day.locator('[data-db-id=senia]').get_by_test_id('db-locked-tag').count()==1 and await day.locator('[data-db-id=dive-1127]').get_by_test_id('db-lock').get_attribute('aria-pressed')=='false' and await t('senia')=='6:00 PM–8:00 PM' and await t('dive-1127')==before)
  # Print: every day, every box open, no controls
  await pg.evaluate("window.dispatchEvent(new Event('beforeprint'))"); await pg.emulate_media(media='print')
  pa=root.locator('.db-print-all')
  ok(label+' print renders all five days open',await pa.locator('.db-print-day').count()==5 and await pa.is_visible() and not await root.locator('.db-content').is_visible())
  ok(label+' print shows details not controls',await pa.locator('.db-detail').count()>20 and await pa.locator('.db-detail').first.is_visible() and await pa.locator('[data-db-action=lock],[data-db-action=handle]').count()==0 and await pa.locator('[data-testid]:not([data-testid=plan-day]:visible), [id]').count()==0)
  ok(label+' print titles visible',await pa.locator('.db-expand strong').first.is_visible())
  await pg.emulate_media(media='screen'); await pg.evaluate("window.dispatchEvent(new Event('afterprint'))")
  ok(label+' after print back to one day',await root.locator('.db-print-all').inner_html()=='' and await root.locator('.db-content').is_visible() and await pg.get_by_test_id('plan-day').count()==1)
  await ctx.close()
  # Reduced motion: no pop animation
  ctx,pg=await db_open(b,base,reduced_motion='reduce')
  row=pg.get_by_test_id('db-day-list').locator('[data-db-id="2026-11-26-1"]'); await row.get_by_test_id('db-expand').click()
  ok(label+' reduced motion no pop',await row.get_by_test_id('db-detail').is_visible() and await row.get_by_test_id('db-detail').evaluate("e=>!e.classList.contains('db-pop')&&getComputedStyle(e).animationName==='none'"))
  await ctx.close()
  # Mobile: compact controls on one row
  ctx,pg=await db_open(b,base,390)
  day=pg.get_by_test_id('db-day-list')
  ok(label+' mobile no overflow',not await overflow(pg))
  ok(label+' mobile controls one row',await day.locator('.db-controls').evaluate_all("es=>es.every(c=>{const r=[...c.children].map(x=>x.getBoundingClientRect());return Math.max(...r.map(x=>x.top))<Math.min(...r.map(x=>x.bottom))})"))
  await ctx.close()
async def daybuilder_round5_checks(b,base,label):
  ctx,pg=await db_open(b,base,390)
  root=pg.get_by_test_id('db-root');day=pg.get_by_test_id('db-day-list')
  card=pg.get_by_test_id('plan-day').first
  text=await card.text_content()
  ok(label+' db source card',all(x in text for x in ['La Mer at Halekulani','Free time','Get ready']) and 'Spa' not in text)
  for selector in ['.db-activity small','.db-travel']:
    contrast=await readable(pg,selector)
    ok(label+' db contrast '+selector,contrast['ratio']>=4.5 and contrast['size']>=12,str(contrast))
  await open_add_menu(pg)
  assert await pg.get_by_test_id('db-tray-toggle').count()==0  # Item F: ideas are picked through Swap.
  await open_add_menu(pg)
  await pg.get_by_test_id('day-add-own').click();await pg.get_by_test_id('add-own-booked').check()
  ok(label+' db coarse pointer',await pg.evaluate("matchMedia('(pointer:coarse)').matches"))
  ok(label+' db all coarse targets',await root.locator('button:visible,input:visible,select:visible').evaluate_all('es=>es.every(e=>{const t=(e.type==="checkbox"&&e.closest("label"))||e,r=t.getBoundingClientRect();return r.width>=44&&r.height>=44})'))
  await pg.get_by_test_id('add-own-name').fill('Overlapping booking')
  await pg.get_by_test_id('add-own-start').fill('20:00');await pg.get_by_test_id('add-own-end').fill('21:00')
  await pg.get_by_test_id('add-own-submit').click()
  ok(label+' db booking overlap','Overlaps La Mer' in await pg.get_by_test_id('db-live').inner_text())  # Item F: sheet closes after adding; conflict is announced.
  ok(label+' db booking overlap announced','Overlaps' in await pg.get_by_test_id('db-live').inner_text())
  # Item F: the sheet closes, but its single conflict line stays on the new item.
  own=day.locator('[data-db-id]').filter(has=pg.get_by_test_id('db-activity').locator('strong').filter(has_text='Overlapping booking'))
  await expect(own).to_have_count(1)
  conflict=own.locator('.db-note').filter(has_text='Overlaps La Mer')
  await expect(conflict).to_have_count(1)
  await expect(conflict).to_be_visible()
  await pg.get_by_test_id('db-day-2026-11-28').click()
  await add_reflow_fixture(pg, 'chest-0')
  ok(label+' db flight unset blocks dive', await blocked_dive_is_unscheduled(pg))
  await pg.get_by_test_id('db-day-2026-11-29').click()
  await choose_flight_time(pg, '23:00')
  await pg.get_by_test_id('db-day-2026-11-28').click()
  # Put a dive early in the day so a late next-day flight leaves more than 24h.
  await open_add_menu(pg)
  await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
  await pg.evaluate("""() => {
    const key='gonow:daybuilder:oahu-demo-2026-11',saved=JSON.parse(localStorage.getItem(key));
    saved.days['2026-11-28'].items=[{...DayBuilder.trayItems()[0],preferred:540}];
    localStorage.setItem(key,JSON.stringify(saved));
  }""")
  await pg.reload(); await reopen(pg); await pg.get_by_test_id('db-day-2026-11-28').click()
  ok(label+' db flight late clears',await day.locator('.db-activity').filter(has_text='Beginner intro dive').count() > 0 and 'Keep 24 hrs between diving and flying' not in await day.inner_text())
  await pg.get_by_test_id('db-day-2026-11-29').click()
  ok(label+' db flight persisted',await pg.get_by_test_id('db-flight-time').input_value()=='23:00')
  await choose_flight_time(pg, '08:00')
  await pg.get_by_test_id('db-day-2026-11-28').click()
  ok(label+' db flight early blocks dive',await blocked_dive_is_unscheduled(pg))
  await ctx.close()
  ctx,pg=await db_open(b,base,390,'reduce')
  await (await card_action(pg, pg.get_by_test_id('db-day-list').locator('[data-db-id=photos]'), 'db-down')).click()
  photo=pg.get_by_test_id('db-day-list').locator('[data-db-id=photos]')
  ok(label+' db afterdark reduced motion','After dark' in await photo.inner_text() and not await photo.evaluate("e=>e.classList.contains('db-shake')"))
  await ctx.close()

SENIA_DAY=[('7:15 AM–7:45 AM','Uber to Kewalo Basin (Dive Oʻahu)',False),('8:00 AM–11:00 AM','Beginner intro dive — Dive Oʻahu, Kewalo Basin',False),('11:00 AM–11:30 AM','Rinse off & change',False),('11:50 AM–12:30 PM','Lunch at Ala Moana Center',False),('12:35 PM–3:30 PM','Black Friday shopping — Ala Moana Center',False),('3:30 PM–4:00 PM','Uber from Ala Moana to The Kahala',False),('4:00 PM–5:00 PM','Shower, change + makeup',False),('6:00 PM–8:00 PM','Dinner — Senia (Chinatown)',True),('8:00 PM–8:35 PM','Uber back to the Kahala',False)]
async def daybuilder_senia_checks(b,base,label):
  for w in (1280,390):
    tag=f'{label} {w} 11/27'
    ctx,pg=await db_open(b,base,w)
    day=pg.get_by_test_id('db-day-list')
    await pg.get_by_test_id('db-day-2026-11-27').click()
    async def timeline():
      return await day.get_by_test_id('db-pair').evaluate_all("es=>es.map(e=>[e.querySelector('[data-testid=db-time]').textContent,e.querySelector('strong').textContent,e.classList.contains('db-locked')])")
    async def senia_time(): return await day.locator('[data-db-id=senia]').get_by_test_id('db-time').text_content()
    ok(tag+' exact default',await timeline()==[list(x) for x in SENIA_DAY],str(await timeline()))
    ok(tag+' zero conflicts',await day.locator('.db-conflict').count()==0 and await pg.get_by_test_id('db-summary').inner_text()=='All clear')
    txt=await day.inner_text()
    ok(tag+' walk to Ala Moana','Walk ~20 min' in txt)
    ok(tag+' 5:10 Uber to Senia','Uber ~35 min' in txt)
    senia=day.locator('[data-db-id=senia]')
    ok(tag+' Senia locked badge',await senia.evaluate("e=>e.classList.contains('db-locked')") and 'Locked' in await senia.inner_text())
    ok(tag+' Senia no move controls',await senia.locator('[data-db-action=handle],[data-db-action=up],[data-db-action=down],[data-db-action=remove]').count()==0)
    order=await day.locator('[data-db-id]').evaluate_all('es=>es.map(e=>e.dataset.dbId)')
    ok(tag+' Uber + prep precede Senia',order.index('uber-kahala')<order.index('prep-senia')==order.index('senia')-1)
    await senia.focus();await pg.keyboard.press('ArrowUp');await pg.keyboard.press('Space')
    ok(tag+' Senia keyboard immovable',await senia_time()=='6:00 PM–8:00 PM' and 'Locked booking' in await pg.get_by_test_id('db-live').inner_text())
    if await senia.get_by_test_id('db-expand').get_attribute('aria-expanded')=='true': await pg.keyboard.press('Space')
    # Reorder: the hotel Uber before shopping pushes the afternoon past 6:00.
    await (await card_action(pg, day.locator('[data-db-id=uber-kahala]'), 'db-up')).click()
    notes=await day.get_by_test_id('db-note').all_text_contents()
    ok(tag+' reorder conflict',any(n.endswith("you'd miss Senia") for n in notes),str(notes))
    ok(tag+' reorder lock stays',await senia_time()=='6:00 PM–8:00 PM' and await senia.get_by_test_id('db-note').count()==0)
    ok(tag+' reorder announced',"you'd miss Senia" in await pg.get_by_test_id('db-live').inner_text())
    await open_add_menu(pg)
    await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
    ok(tag+' reset clear',await timeline()==[list(x) for x in SENIA_DAY] and await day.locator('.db-conflict').count()==0)
    # Add the parasail (lands after dinner, still clear), then drag it in front of the hotel Uber.
    await open_add_menu(pg)
    assert await pg.get_by_test_id('db-tray-toggle').count()==0  # Item F: ideas are picked through Swap.
    await add_reflow_fixture(pg, 'chest-1')
    ok(tag+' add after dinner clear',await day.locator('.db-conflict').count()==0 and await senia_time()=='6:00 PM–8:00 PM')
    instance=await day.locator('[data-db-id^=instance-]').last.get_attribute('data-db-id')
    tgt=day.locator('[data-db-id=uber-kahala]');h=(await card_action(pg, day.locator('[data-db-id="'+instance+'"]'), 'db-handle'))
    if w == 390:
      # Keyboard reordering can reach the Uber without both rows sharing the viewport.
      await h.focus()
      await pg.keyboard.press('Space')
      for _ in range(await day.locator('[data-db-id]').count()):
        order=await day.locator('[data-db-id]').evaluate_all('es=>es.map(e=>e.dataset.dbId)')
        if order.index(instance)==order.index('uber-kahala')-1:
          break
        await pg.keyboard.press('ArrowUp')
      else:
        raise AssertionError('Could not place added activity immediately before uber-kahala: '+str(order))
      await pg.keyboard.press('Space')
    else:
      # Keep the handle visible and the drop point below the sticky bar.
      await h.scroll_into_view_if_needed()
      await tgt.evaluate("e=>window.scrollBy(0,e.getBoundingClientRect().top-140)")
      o=await h.bounding_box()
      if o['y']+o['height']>pg.viewport_size['height']-20:
        await pg.evaluate('d=>window.scrollBy(0,d)',o['y']+o['height']-pg.viewport_size['height']+20)
      o=await h.bounding_box();d=await tgt.bounding_box()
      top=await pg.locator('.topbar').evaluate('e=>e.getBoundingClientRect().bottom')
      drop_y=d['y']+d['height']*.2
      if drop_y<top+8:
        # Round up the clearance to account for integer page scroll positions.
        await pg.evaluate('d=>window.scrollBy(0,Math.floor(d))',drop_y-top-8)
      o=await h.bounding_box();d=await tgt.bounding_box()
      await pg.mouse.move(o['x']+o['width']/2,o['y']+o['height']/2);await pg.mouse.down()
      await pg.mouse.move(d['x']+d['width']/2,d['y']+d['height']*.2,steps=18);await pg.mouse.up()
    order=await day.locator('[data-db-id]').evaluate_all('es=>es.map(e=>e.dataset.dbId)')
    ok(tag+' drag inserts',order.index(instance)==order.index('uber-kahala')-1,str(order))
    notes=await day.get_by_test_id('db-note').all_text_contents()
    ok(tag+' drag conflict',any(n.endswith("you'd miss Senia") for n in notes),str(notes))
    ok(tag+' drag lock stays',await senia_time()=='6:00 PM–8:00 PM' and await senia.get_by_test_id('db-note').count()==0)
    ok(tag+' drag late connector','leave by 5:10 PM' in await day.locator('.db-travel-late').inner_text())
    await open_add_menu(pg)
    await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
    await pg.get_by_test_id('db-day-2026-11-26').click()
    ok(tag+' 11/26 La Mer intact',await day.locator('[data-db-id=lamer]').get_by_test_id('db-time').text_content()=='7:30 PM–9:30 PM' and await day.locator('.db-conflict').count()==0)
    ok(tag+' no overflow',not await overflow(pg))
    await ctx.close()

async def regression_checks(b,base,label):
  """Export sync, Relax times, print page breaks, photo provenance, and lock preservation."""
  ctx,pg=await db_open(b,base)
  ok(label+' one day at a time', await pg.get_by_test_id('plan-day').count()==1 and await pg.locator('main section.day:not(.db-daycard)').count()==0 and await pg.get_by_test_id('db-day').locator('button').count()==5)
  day=pg.get_by_test_id('db-day-list')
  for _ in range(8):
    ids=await day.locator('[data-db-id]').evaluate_all('es=>es.map(e=>e.dataset.dbId)')
    if ids.index('photos')>ids.index('lamer'): break
    await (await card_action(pg, day.locator('[data-db-id=photos]'), 'db-down')).click()
  async def clock(row_id):
    return await day.locator(f'[data-db-id="{row_id}"]').get_by_test_id('db-time').evaluate('e=>e.textContent')
  photo_time=await clock('photos')
  lamer_time=await clock('lamer')
  ok(label+' reorder photos after dinner', photo_time=='10:00 PM–11:00 PM' and lamer_time=='7:30 PM–9:30 PM', photo_time+' / '+lamer_time)
  ics=await pg.evaluate('window.__gonow.buildICS()')
  unfolded=ics.replace('\r\n ','')
  text=await pg.evaluate('window.__gonow.planText()')
  ok(label+' ICS matches reflowed times', '20261126T220000' in unfolded and '20261126T230000' in unfolded and '20261126T174000' not in unfolded and '20261126T193000' in unfolded and '20261126T213000' in unfolded)
  ok(label+' copy text matches reflowed times', '10:00 PM–11:00 PM' in text and 'Kahala Beach' in text and '5:40 PM–6:40 PM' not in text and '7:30 PM–9:30 PM' in text)
  await pg.evaluate("navigator.clipboard.writeText=t=>{window.__copied=t;return Promise.resolve()}")
  await open_share_menu(pg)
  await pg.get_by_test_id('copy').click()
  ok(label+' copy button uses the same text', await pg.evaluate('window.__copied')==text)
  await open_share_menu(pg)
  await pg.get_by_test_id('share-link').click(); url=await pg.get_by_test_id('share-url').input_value(); await pg.get_by_test_id('modal-0').click()
  c2,p2=await new(b,base)
  await p2.goto(url); await p2.get_by_test_id('db-root').wait_for(); await p2.get_by_test_id('db-day-2026-11-26').click()
  shared_time=await p2.get_by_test_id('db-day-list').locator('[data-db-id=photos]').get_by_test_id('db-time').evaluate('e=>e.textContent')
  shared_ics=await p2.evaluate('window.__gonow.buildICS()')
  ok(label+' share keeps reflowed export', shared_time==photo_time and '20261126T220000' in shared_ics.replace('\r\n ',''))
  await c2.close()
  await pg.evaluate("window.dispatchEvent(new Event('beforeprint'))"); await pg.emulate_media(media='print')
  breaks=await pg.evaluate("()=>[...document.querySelectorAll('.db-print-all .db-print-day')].map(e=>getComputedStyle(e).breakBefore)")
  details_ok=await pg.evaluate("()=>{const rows=[...document.querySelectorAll('.db-print-all .db-detail')];return rows.length>20&&rows.every(e=>e.getBoundingClientRect().height>0)}")
  controls=await pg.locator('.db-print-all [data-db-action=lock], .db-print-all [data-db-action=handle], .db-print-all [data-db-action=up], .db-print-all [data-db-action=down]').count()
  printed=await pg.locator('.db-print-all').inner_text()
  ok(label+' print each day starts a page', breaks==['page','page','page','page','page'], str(breaks))
  ok(label+' print shows reflowed details without controls', '10:00 PM' in printed and '7:30 PM' in printed and details_ok and controls==0)
  await pg.emulate_media(media='screen'); await pg.evaluate("window.dispatchEvent(new Event('afterprint'))")
  await open_add_menu(pg)
  await pg.get_by_test_id('day-reset').click();await pg.get_by_test_id('day-reset-confirm').click()
  ok(label+' reset restores 5:40 photos', await clock('photos')=='5:40 PM–6:40 PM', await clock('photos'))
  # 11/28 Relax changes the builder clock and keeps locks plus reorder.
  await pg.get_by_test_id('db-day-2026-11-28').click()
  day=pg.get_by_test_id('db-day-list')
  async def clock(row_id):
    return await day.locator(f'[data-db-id="{row_id}"]').get_by_test_id('db-time').evaluate('e=>e.textContent')
  uber0=await clock('2026-11-28-0')
  ok(label+' 11/28 uber starts at 5:10', uber0.startswith('5:10 AM'), uber0)
  await day.locator('[data-db-id="2026-11-28-7"]').get_by_test_id('db-lock').click()
  sail=await clock('2026-11-28-7')
  await (await card_action(pg, day.locator('[data-db-id="2026-11-28-6"]'), 'db-down')).click()
  async def vis():
    return await day.locator('[data-db-id]').evaluate_all('es=>es.map(e=>e.dataset.dbId)')
  order=await vis()
  await open_for(pg.locator('#day-3 [data-testid=relax-toggle]')); await pg.locator('#day-3 [data-testid=relax-toggle]').check()
  uber1=await clock('2026-11-28-0')
  title=await day.locator('[data-db-id="2026-11-28-0"] .db-expand strong').inner_text()
  on_ids=await vis()
  ok(label+' relax sets 7:30 builder time', uber1=='7:30 AM–8:10 AM' and 'later start' in title and '2026-11-28-1' not in on_ids, uber1+' | '+title+' | '+str(on_ids))
  ok(label+' relax preserves order and lock', on_ids==[i for i in order if i!='2026-11-28-1'] and await clock('2026-11-28-7')==sail and await day.locator('[data-db-id="2026-11-28-7"]').get_by_test_id('db-lock').get_attribute('aria-pressed')=='true')
  relax_ics=await pg.evaluate("window.__gonow.buildICS().replace(/\\r\\n /g,'')")
  ok(label+' relax ICS uses 7:30 not 5:10', '20261128T073000' in relax_ics and '20261128T081000' in relax_ics and '20261128T051000' not in relax_ics and 'later start' in relax_ics and not any(line.startswith('SUMMARY') and 'Pillbox' in line for line in relax_ics.split('\r\n')))
  await open_for(pg.locator('#day-3 [data-testid=relax-toggle]')); await pg.locator('#day-3 [data-testid=relax-toggle]').uncheck()
  off_ids=await vis()
  uber2=await clock('2026-11-28-0')
  ok(label+' relax off restores sunrise plan', off_ids==order and uber2==uber0 and '2026-11-28-1' in off_ids and await day.locator('[data-db-id="2026-11-28-7"]').get_by_test_id('db-lock').get_attribute('aria-pressed')=='true')
  await open_for(pg.locator('#day-3 [data-testid=relax-toggle]')); await pg.locator('#day-3 [data-testid=relax-toggle]').check()
  ok(label+' relax on again', await clock('2026-11-28-0')=='7:30 AM–8:10 AM' and '2026-11-28-1' not in await vis())
  await open_for(pg.locator('#day-3 [data-testid=relax-toggle]')); await pg.locator('#day-3 [data-testid=relax-toggle]').uncheck()
  # Photos: real credited files, never the generic island image.
  await pg.get_by_test_id('db-day-2026-11-26').click()
  photos=await pg.evaluate("""()=>{const DB=window.DayBuilder,cur=DB.selectedDate(),out=[];
    for(const d of window.__gonow.state.plan.days){DB.selectDay(d.date,false);
      document.querySelectorAll('.db-content .db-photo img').forEach(i=>out.push({date:d.date,src:i.getAttribute('src'),alt:i.getAttribute('alt'),credit:!!i.closest('.db-photo').querySelector('.image-label a[href]')}));}
    DB.selectDay(cur,false);return out;}""")
  ok(label+' activity photos are credited and specific', len(photos)>=8 and all(p['src'] and 'oahu.jpg' not in p['src'] and p['src'].startswith('images/activity-') and p['alt'] and p['credit'] for p in photos), str(photos)[:400])
  ok(label+' Diamond Head summit photo', any(p['date']=='2026-11-26' and p['src'].endswith('activity-diamond-head-summit.jpg') and 'Waikiki' in p['alt'] for p in photos))
  await ctx.close()

async def main():
  await run((SITE/'index.html').resolve().as_uri(), 'file', True)
  srv=subprocess.Popen([sys.executable,'-m','http.server','8793','-d',str(SITE)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
  try: await run('http://127.0.0.1:8793/index.html','http',False)
  finally: srv.terminate()
  ok('zero console errors', len(errors)==0, json.dumps(errors[:10]))
  print('\nSUMMARY', sum(r[1] for r in results), '/', len(results))
if __name__ == '__main__':
  asyncio.run(main())
