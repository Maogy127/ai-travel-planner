"""Computed browser contrast pairs on real UI surfaces, own port 8832."""
from test_full import open_home_flow
import asyncio
import sys
from playwright.async_api import expect
from test_full import new
from test_voice import MOCK
from test_wellness_home import serve_checks
BASE = 'http://127.0.0.1:8832/index.html'

# Resolve transparent backgrounds through actual ancestors; reject gradients so
# a pair cannot silently pass on a guessed background. All tested text is solid.
MEASURE = '''(el) => {
 const s=getComputedStyle(el), rgb=c=>(c.match(/[\\d.]+/g)||[]).map(Number);
 let node=el, bg;
 while(node){const cs=getComputedStyle(node);if(cs.backgroundImage!=='none')throw Error('Gradient behind '+el.outerHTML);const c=rgb(cs.backgroundColor);if(c.length>=3&&(c[3]??1)===1){bg=c;break;}node=node.parentElement;}
 if(!bg)bg=[255,255,255];
 const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const a=lum(rgb(s.color)),b=lum(bg),size=parseFloat(s.fontSize),weight=parseFloat(s.fontWeight);
 return {ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),min:size>=24||(size>=19&&weight>=700)?3:4.5,front:s.color,back:bg};
}'''

async def pair(pg, selector, label):
    element=pg.locator(selector + ':visible').first
    await expect(element).to_be_visible()
    result=await element.evaluate(MEASURE)
    assert result['ratio'] >= result['min'], (label,result)
    print(f"PASS {label}: {result['ratio']:.2f}:1 >= {result['min']}")

async def token_pair(pg, front, back, label):
    result=await pg.evaluate('''([front,back])=>{const e=document.createElement('span');e.textContent='Contrast';e.style.cssText=`position:fixed;color:var(--${front});background:var(--${back});font:16px sans-serif`;document.body.append(e);return [front,back]}''', [front,back])
    try:
        await pair(pg,'body>span:last-child',label)
    finally:
        await pg.locator('body>span:last-child').evaluate('e=>e.remove()')

async def checks(browser):
    for width in (1280,390):
        ctx,pg=await new(browser,BASE,width)
        try:
            await pg.add_init_script(MOCK)
            await pg.reload()
            for front,back in [('ink','bg'),('ink-2','bg'),('ink-2','surface'),('accent-text','bg')]:
                await token_pair(pg,front,back,f'{front} on {back} {width}')
            await pair(pg,'.intro>p.muted','home secondary')
            await pair(pg,'[data-testid=start-new-trip]','primary button')
            await pair(pg,'[data-testid=activity-chip]','chip on soft')
            await pg.locator('[data-testid=activity-chip]').first.click()
            await pair(pg,'[data-testid=activity-chip][aria-pressed=true]','selected chip')
            await pair(pg,'.pace-option:has(input:checked) strong','selected pace')
            hues=await pg.evaluate('''() => {const css=getComputedStyle(document.documentElement);function hue(hex){let [r,g,b]=hex.trim().slice(1).match(/../g).map(x=>parseInt(x,16)/255);let max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;return ((max===r?(g-b)/d:max===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;}let diff=Math.abs(hue(css.getPropertyValue('--move'))-hue(css.getPropertyValue('--accent')));return Math.min(diff,360-diff);}''')
            assert hues>=20,hues
            print(f'PASS movement vs terracotta hue difference {hues:.2f} degrees')
            await pg.evaluate("__gonow.go('musts')")
            await pg.get_by_test_id('voice-btn').click()
            await pair(pg,'[data-testid=voice-btn].is-listening','voice listening')
            await pg.evaluate("__gonow.go('home')")
            await open_home_flow(pg)
            await pg.get_by_test_id('demo-oahu').click()
            from test_full import continue_prep
            await continue_prep(pg)
            await expect(pg.get_by_test_id('db-root')).to_be_visible()
            for selector,label in [('.db-time','time box'),('[data-testid=db-lock]','lock icon'),('.db-travel','travel connector'),('.day-head .compact-values','day summary'),('.day-head .compact-values','day summary'),('.day-head .compact-values','day summary')]:
                await pair(pg,selector,label)
            await pg.get_by_test_id('view-map').click()
            await pair(pg,'.map-pin','map pin number')
        finally:
            await ctx.close()

if __name__ == '__main__':
    try:
        asyncio.run(serve_checks(8832,checks))
    except Exception as error:
        print('FAIL contrast:',error)
        sys.exit(1)
