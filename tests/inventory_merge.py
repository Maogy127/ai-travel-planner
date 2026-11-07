"""Before/after content inventory for the merged day view.
Serves site-v-before-merge/ and site/ side by side, opens the Oahu demo in each, and checks that
every piece of day-card content from the old static cards is still reachable in the merged builder:
day titles + summaries, notes, activity titles/descriptions, tips, bring checklist items (by pack id),
photos, and every link (Book this, sources, maps). Times are excluded because the builder reflows them."""
import asyncio, subprocess, sys, time, json, re
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent.parent
OLD_DIR=ROOT/'tests'/'baseline-before-merge'
NEW_DIR=ROOT/'site' if (ROOT/'site'/'index.html').exists() else ROOT
OLD,NEW=8796,8797
SEL='h2,h3,h4,p,summary,label,li>small,a,figcaption,.chip,.tag'
COLLECT=r"""(scopes)=>{
  const norm=s=>(s||'').replace(/\s+/g,' ').trim();
  const out={texts:[],hrefs:[],packs:[],imgs:[],full:''};
  for(const scope of scopes){
    out.full+=' '+norm(scope.textContent);
    scope.querySelectorAll('%s').forEach(e=>{if(e.closest('time'))return;const c=e.cloneNode(true);c.querySelectorAll('time').forEach(t=>t.remove());const t=norm(c.textContent);if(t)out.texts.push(t);});
    scope.querySelectorAll('a[href]').forEach(a=>out.hrefs.push(a.getAttribute('href')));
    scope.querySelectorAll('[data-pack-id]').forEach(e=>out.packs.push(e.dataset.packId));
    scope.querySelectorAll('img').forEach(i=>out.imgs.push(i.getAttribute('src')));
  }
  out.full=norm(out.full);return out;}""".replace('%s',SEL)
async def open_demo(b,port):
  ctx=await b.new_context(viewport={'width':1280,'height':900})
  await ctx.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='text/css', body=''))
  await ctx.route('https://fonts.gstatic.com/**', lambda r: r.fulfill(status=200, body=''))
  pg=await ctx.new_page(); await pg.goto(f'http://127.0.0.1:{port}/index.html?fast=1')
  await pg.get_by_test_id('demo-oahu').click(); await pg.get_by_test_id('age-rules').wait_for(state='attached'); await pg.wait_for_timeout(500)
  return ctx,pg
async def main():
  servers=[subprocess.Popen([sys.executable,'-m','http.server',str(p),'-d',str(d)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL) for p,d in ((OLD,OLD_DIR),(NEW,NEW_DIR))]
  time.sleep(1); fails=0; report={}
  try:
    async with async_playwright() as p:
      b=await p.chromium.launch()
      ctx,pg=await open_demo(b,OLD)
      dates=await pg.evaluate('window.__gonow.state.plan.days.map(d=>d.date)')
      old={}
      for i,d in enumerate(dates):
        old[d]=await pg.evaluate(f"()=>({COLLECT})([document.getElementById('day-{i}')])")
      await ctx.close()
      ctx,pg=await open_demo(b,NEW)
      new={}; counts={}
      for i,d in enumerate(dates):
        await pg.get_by_test_id('db-day-'+d).click()
        await pg.evaluate("()=>document.querySelectorAll('.db-content [data-db-action=expand][aria-expanded=false]').forEach(b=>b.click())")
        counts[d]=await pg.evaluate("()=>document.querySelectorAll('.db-content [data-testid=plan-day]').length")
        new[d]=await pg.evaluate(f"()=>({COLLECT})([document.querySelector('.db-content [data-testid=plan-day]')])")
      await ctx.close(); await b.close()
    for d in dates:
      o,n=old[d],new[d]
      missing_text=[t for t in dict.fromkeys(o['texts']) if t not in n['full'] and t not in n['texts']]
      missing_href=sorted(set(o['hrefs'])-set(n['hrefs']))
      missing_pack=sorted(set(o['packs'])-set(n['packs']))
      missing_img=sorted(set(o['imgs'])-set(n['imgs']))
      okd=counts[d]==1 and not (missing_text or missing_href or missing_pack or missing_img)
      fails+=not okd
      report[d]={'old':{k:len(set(v)) for k,v in o.items() if k!='full'},'new':{k:len(set(v)) for k,v in n.items() if k!='full'},
                 'day cards':counts[d],'missing_text':missing_text,'missing_href':missing_href,'missing_pack':missing_pack,'missing_img':missing_img}
      print(('PASS' if okd else 'FAIL'),d,json.dumps(report[d],ensure_ascii=False))
  finally:
    for s in servers: s.terminate()
  (ROOT/'tests/inventory_merge.json').write_text(json.dumps(report,indent=1,ensure_ascii=False))
  print('INVENTORY', 'OK' if not fails else f'{fails} day(s) lost content'); sys.exit(1 if fails else 0)
asyncio.run(main())
