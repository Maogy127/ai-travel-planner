"""Free AI (Firebase AI Logic, Gemini Developer API) + Open-Meteo weather. AI is always mocked here: no SDK, no quota.
Port 8871. Run: python3 tests/test_ai.py"""
import asyncio, json, subprocess, sys, os
from datetime import date, timedelta
from urllib.parse import urlparse, parse_qs
sys.path.insert(0, os.path.dirname(__file__))
from playwright.async_api import async_playwright, expect
from test_full import new, reopen
from test_pick_activities import open_picks

PORT = int(os.environ.get("GONOW_AI_PORT", "8871"))
B = f'http://127.0.0.1:{PORT}/index.html'
fails = []
def ok(name, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + name, '' if cond else detail)
    if not cond: fails.append(name)

PLAN_MOCK = """window.__aiCalls=[];window.GONOW_AI_MOCK=function(kind,prompt){window.__aiCalls.push({kind:kind,prompt:prompt});
 if(window.__aiFail)throw window.__aiFail;
 if(kind==='plan')return {days:[{date:'2026-11-28',stops:[{id:'diamond-head',time:'06:00'},{id:'bishop-museum',time:'10:00'}]},{date:'2026-11-27',stops:[{id:'pearl-harbor',time:'08:00'}]}],note:'Museums on cooler days, Pearl Harbor early'};
 return {changes:[{action:'remove',id:'kualoa'}],say:'Took Kualoa off your day'};};"""
DAILY_429 = "window.__aiFail=Object.assign(new Error('[429] Resource exhausted'),{customErrorData:{status:429,errorDetails:[{quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}});"
FAKE_VOICE = """window.SpeechRecognition=function(){var r=this;r.start=function(){setTimeout(function(){var res=[{transcript:window.__say||'',confidence:1}];res.isFinal=true;r.onresult&&r.onresult({resultIndex:0,results:[res]});r.onend&&r.onend();},50);};r.stop=function(){};r.abort=function(){};};"""

async def rainy(route):
    q = parse_qs(urlparse(route.request.url).query)
    s, e = date.fromisoformat(q['start_date'][0]), date.fromisoformat(q['end_date'][0])
    days = [(s + timedelta(days=i)).isoformat() for i in range((e - s).days + 1)]
    rain = [70 if d == '2026-11-28' else 10 for d in days]
    body = {'daily': {'time': days, 'weather_code': [61 if r > 50 else 1 for r in rain], 'temperature_2m_max': [81] * len(days), 'temperature_2m_min': [70] * len(days), 'precipitation_probability_max': rain}}
    await route.fulfill(status=200, content_type='application/json', body=json.dumps(body))

async def checkout(pg, w=390, acts=('diamond-head', 'bishop-museum', 'kualoa', 'pearl-harbor')):
    await open_picks(pg)
    # The shared question helper ends at 390 px; restore the width under test.
    await pg.set_viewport_size({'width': w, 'height': 844 if w < 600 else 900})
    for i in acts:
        t = pg.locator(f'[data-pick-toggle="{i}"]')
        if await t.get_attribute('aria-pressed') != 'true': await t.click()
    await pg.get_by_test_id('pick-next').click()
    await pg.get_by_test_id('pick-next').click()

def where(pg, pid):
    return pg.evaluate("id=>{const i=DayBuilder.editableItems().find(x=>x.id===id);return i?[i.date,i.start]:null;}", pid)

async def open_bar(pg):
    bar = pg.get_by_test_id('ai-bar')
    # The bar is always open (Nov 21, 2026): input pill, mic and send sit right on it.
    if await bar.evaluate("e=>e.tagName==='DETAILS'&&!e.open"):
        await bar.locator('summary').click()
    await expect(pg.get_by_test_id('ai-edit-input')).to_be_visible()

async def ai_plan(b, w):
    ctx, pg = await new(b, B, w, 844 if w < 600 else 900)
    await ctx.route('https://api.open-meteo.com/**', rainy)
    await ctx.add_init_script(PLAN_MOCK); await ctx.add_init_script(FAKE_VOICE); await pg.reload()
    try:
        await checkout(pg, w)
        ok(f'{w} viewport', await pg.evaluate('innerWidth') == w)
        await expect(pg.get_by_test_id('ai-toast')).to_contain_text('Planned with AI')
        calls = await pg.evaluate('window.__aiCalls.map(c=>c.kind)')
        ok(f'{w} one AI call plans the picks', calls == ['plan'], calls)
        prompt = await pg.evaluate('window.__aiCalls[0].prompt')
        ok(f'{w} prompt has picks, pace, feel and weather', all(s in prompt for s in ('"id":"bishop-museum"', 'Pace active: at most 420', '"feel"', '70% rain', '"booked":"2026-11-26 19:30"')), prompt[-400:])
        ok(f'{w} AI day and time used', await where(pg, 'bishop-museum') == ['2026-11-28', 600], await where(pg, 'bishop-museum'))
        ph = await where(pg, 'pearl-harbor')
        ok(f'{w} AI day kept, time checked by planner', ph[0] == '2026-11-27' and abs(ph[1] - 480) <= 120, ph)
        ok(f'{w} booked tables untouched', await where(pg, 'lamer') == ['2026-11-26', 1170] and await where(pg, 'senia') == ['2026-11-27', 1080])
        if w == 390:
            await pg.reload(); await reopen(pg); await expect(pg.get_by_test_id('db-root')).to_be_visible()
            ok('reload keeps the AI days without a new AI call', await where(pg, 'bishop-museum') == ['2026-11-28', 600] and await pg.evaluate('window.__aiCalls.length') == 0, await where(pg, 'bishop-museum'))
            await pg.evaluate("window.__aiCalls=[{kind:'plan',prompt:''}]")
        await open_bar(pg)
        ok(f'{w} status shows the AI note', 'Planned with AI · Museums on cooler days' in await pg.get_by_test_id('ai-status').inner_text())
        ok(f'{w} re-plan offered for a picks plan', await pg.get_by_test_id('ai-replan').is_visible())
        ok(f'{w} no emoji in AI bar', await pg.get_by_test_id('ai-bar').evaluate("e=>!/[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(e.innerText)"))
        bar = pg.get_by_test_id('ai-bar')
        ok(f'{w} bar title is one line', await bar.locator('h3').evaluate("e=>e.getBoundingClientRect().height<=30"))
        ok(f'{w} input, mic and send sit on the bar', await bar.locator('.ai-pill [data-testid=ai-edit-input]').is_visible() and await bar.locator('.ai-pill [data-testid=ai-voice-btn]').is_visible() and await bar.locator('.ai-pill [data-testid=ai-apply]').is_visible())
        ok(f'{w} placeholder', await pg.get_by_test_id('ai-edit-input').get_attribute('placeholder') == 'Ask AI to change your plan…')
        ok(f'{w} accent badge', await bar.locator('.ai-badge').evaluate("e=>getComputedStyle(e).backgroundColor!=='rgba(0, 0, 0, 0)'"))
        if w == 390:
            await pg.evaluate('scrollTo(0, document.body.scrollHeight)'); await pg.wait_for_timeout(300)
            ok('phone floating AI button shows once the bar is off screen', await pg.get_by_test_id('ai-fab').is_visible())
            await pg.get_by_test_id('ai-fab').click(); await pg.wait_for_timeout(700)
            ok('floating button brings the bar back and focuses the field', await pg.evaluate("document.activeElement&&document.activeElement.dataset.testid==='ai-edit-input'") and not await pg.get_by_test_id('ai-fab').is_visible())
        else:
            ok(f'{w} no floating button on desktop', not await pg.get_by_test_id('ai-fab').is_visible())
        small = await pg.evaluate("""()=>[...document.querySelectorAll('[data-testid=ai-bar] summary,[data-testid=ai-bar] button,[data-testid=ai-bar] input,[data-testid=ai-bar] select,[data-testid=day-weather] summary')].filter(e=>e.offsetParent).filter(e=>e.getBoundingClientRect().height<44).map(e=>e.dataset.testid||e.tagName)""")
        ok(f'{w} AI and weather targets >= 44px', not small, small)
        # Typed simple edit: parsed locally, no AI call, Undo restores.
        before = await where(pg, 'bishop-museum')
        await pg.get_by_test_id('ai-edit-input').fill('Move the museum to the afternoon')
        await pg.get_by_test_id('ai-apply').click()
        await expect(pg.get_by_test_id('ai-edit-toast')).to_contain_text('Moved Bishop Museum to')
        after = await where(pg, 'bishop-museum')
        ok(f'{w} simple edit moves the stop', after[0] == '2026-11-28' and after[1] >= 840, after)
        ok(f'{w} simple edit uses no AI call', await pg.evaluate('window.__aiCalls.length') == 1)
        await pg.get_by_test_id('ai-edit-toast').get_by_role('button', name='Undo').click()
        ok(f'{w} undo restores the edit', await where(pg, 'bishop-museum') == before)
        # Free-form edit goes to AI; the answer is applied with Undo.
        await pg.get_by_test_id('ai-edit-input').fill('make day 2 lighter')
        await pg.get_by_test_id('ai-apply').click()
        await expect(pg.get_by_test_id('ai-status')).to_have_text('Moved Kualoa Jurassic Adventure to Needs a time')
        k = await where(pg, 'kualoa')
        ok(f'{w} AI edit applied (Kualoa waits in Needs a time)', k is not None and k[1] is None, k)
        ok(f'{w} AI edit spent one call', await pg.evaluate("window.__aiCalls.map(c=>c.kind).join()") == 'plan,edit')
        await pg.get_by_test_id('ai-edit-toast').get_by_role('button', name='Undo').click()
        ok(f'{w} undo brings Kualoa back', (await where(pg, 'kualoa'))[1] is not None)
        # Locked stops are refused.
        await pg.get_by_test_id('ai-edit-input').fill('Move La Mer to 9 am')
        await pg.get_by_test_id('ai-apply').click()
        await pg.wait_for_timeout(300)
        ok(f'{w} booked stop never moved', await where(pg, 'lamer') == ['2026-11-26', 1170])
        # Voice: the existing voice input fills the field and applies on the final result.
        await pg.evaluate("window.__say='move kualoa to 9 am'")
        await pg.evaluate("document.querySelector('[data-testid=ai-status]').textContent='-'")
        await pg.get_by_test_id('ai-voice-btn').click()
        await expect(pg.get_by_test_id('ai-status')).not_to_have_text('-')
        await expect(pg.get_by_test_id('ai-status')).not_to_have_text('Working on it…')
        ok(f'{w} voice edit applied', (await where(pg, 'kualoa'))[1] == 540, [await where(pg, 'kualoa'), await pg.get_by_test_id('ai-status').inner_text(), await pg.get_by_test_id('ai-edit-input').input_value()])
        # Weather: one line in each day head, details behind a tap, rain tip names outdoor stops.
        await pg.get_by_test_id('db-day-2026-11-28').click()
        wx = pg.locator('[data-weather-date="2026-11-28"]')
        await expect(wx).to_contain_text('81° / 70° · 70% rain')
        await wx.locator('summary').click()
        txt = await wx.inner_text()
        ok(f'{w} weather details name the source', 'Forecast · Open-Meteo' in txt, txt)
        ok(f'{w} rain tip names an outdoor stop', 'Rain likely · consider moving Diamond Head' in txt, txt+str(await pg.evaluate("JSON.stringify(DayBuilder.editableItems().filter(i=>i.date==='2026-11-28'))")))
        # Re-plan with AI, then Undo back to the edited plan.
        before = await where(pg, 'kualoa')
        await pg.get_by_test_id('ai-replan').click()
        await expect(pg.get_by_test_id('ai-toast')).to_contain_text('Planned with AI')
        ok(f'{w} re-plan uses AI again', await pg.evaluate("window.__aiCalls.filter(c=>c.kind==='plan').length") == 2)
        await pg.get_by_test_id('ai-toast').get_by_role('button', name='Undo').click()
        await expect(pg.get_by_test_id('db-root')).to_be_visible()
        ok(f'{w} undo re-plan keeps your edits', await where(pg, 'kualoa') == before, await where(pg, 'kualoa'))
    finally:
        await ctx.close()

async def standard_undo(b):
    ctx, pg = await new(b, B, 390, 844)
    await ctx.add_init_script(PLAN_MOCK); await pg.reload()
    try:
        await checkout(pg)
        await expect(pg.get_by_test_id('ai-toast')).to_contain_text('Planned with AI')
        await pg.get_by_test_id('ai-toast').get_by_role('button', name='Undo').click()
        await expect(pg.get_by_test_id('db-root')).to_be_visible()
        std = await where(pg, 'bishop-museum')
        ok('undo gives the standard plan', std != ['2026-11-28', 600], std)
        await pg.reload(); await reopen(pg); await expect(pg.get_by_test_id('db-root')).to_be_visible()
        ok('standard choice kept on reload, no AI call', await where(pg, 'bishop-museum') == std and await pg.evaluate('window.__aiCalls.length') == 0)
    finally:
        await ctx.close()

async def at_limit(b):
    ctx, pg = await new(b, B, 390, 844)
    await ctx.add_init_script(PLAN_MOCK); await ctx.add_init_script(DAILY_429); await pg.reload()
    try:
        await checkout(pg)
        await expect(pg.get_by_test_id('db-root')).to_be_visible()
        await expect(pg.get_by_test_id('toast')).to_contain_text('Free AI is resting until tomorrow · standard plan')
        ok('limit falls back to the standard plan', await where(pg, 'bishop-museum') is not None)
        pause = await pg.evaluate("JSON.parse(localStorage.getItem('gonow:ai:pause'))")
        left = await pg.evaluate("p=>p.until-Date.now()", pause)
        ok('daily limit pauses until midnight Pacific', pause['kind'] == 'day' and 0 < left <= 86400000 and abs(left - await pg.evaluate('GoNowAI.msToPacificMidnight(Date.now())')) < 5000, pause)
        await open_bar(pg)
        ok('AI bar says resting', 'resting until tomorrow' in await pg.get_by_test_id('ai-status').inner_text())
        await pg.get_by_test_id('ai-replan').click()
        ok('re-plan stays put while resting', 'resting' in await pg.get_by_test_id('ai-status').inner_text() and await pg.evaluate("window.__aiCalls.length") == 1)
        await pg.get_by_test_id('ai-edit-input').fill('make it chill')
        await pg.get_by_test_id('ai-apply').click()
        await expect(pg.get_by_test_id('ai-status')).to_contain_text('resting')
        ok('no AI call while resting', await pg.evaluate("window.__aiCalls.length") == 1)
        await pg.get_by_test_id('ai-edit-input').fill('move bishop museum to 3 pm')
        await pg.get_by_test_id('ai-apply').click()
        await expect(pg.get_by_test_id('ai-edit-toast')).to_contain_text('Moved Bishop Museum')
        ok('simple edits still work at the limit', (await where(pg, 'bishop-museum'))[1] >= 900)
    finally:
        await ctx.close()

async def no_mock(b):
    # Automated browsers without a mock never spend the shared free quota; the plan appears as before.
    ctx, pg = await new(b, B, 390, 844)
    try:
        await checkout(pg)
        await expect(pg.get_by_test_id('db-root')).to_be_visible()
        ok('no AI attempt without a mock', await pg.evaluate("GoNowAI.uses()") == 0 and await pg.get_by_test_id('ai-planning').count() == 0)
        await pg.get_by_test_id('demo-oahu').count()
    finally:
        await ctx.close()
    ctx, pg = await new(b, B, 390, 844)
    try:
        from test_full import continue_prep
        await pg.get_by_test_id('demo-oahu').click(); await continue_prep(pg)
        await expect(pg.get_by_test_id('ai-bar')).to_be_visible()
        ok('demo plan: AI bar without re-plan', await pg.get_by_test_id('ai-replan').count() == 0)
    finally:
        await ctx.close()

async def main():
    srv = subprocess.Popen([sys.executable, os.path.join(os.path.dirname(__file__), 'serve_site.py'), str(PORT), '127.0.0.1'], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1.2)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome') if os.path.exists('/usr/bin/google-chrome') else await p.chromium.launch()
            for fn in (lambda: ai_plan(b, 390), lambda: ai_plan(b, 1280), lambda: standard_undo(b), lambda: at_limit(b), lambda: no_mock(b)):
                try: await fn()
                except Exception as e: ok('suite step completed', False, repr(e)[:400])
            await b.close()
    finally:
        srv.terminate()
    print('Done ·', len(fails), 'failed', fails)
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    asyncio.run(main())
