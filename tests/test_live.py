# Run the full suite against the deployed GitHub Pages site (no screenshots).
import asyncio, json, sys, time
sys.path.insert(0, __import__('os').path.dirname(__file__))
import test_full as t
URL = (sys.argv[1] if len(sys.argv) > 1 else 'https://maogy127.github.io/ai-travel-planner/index.html')
async def main():
  await t.run(URL, 'live', False)
  t.ok('zero console errors', len(t.errors)==0, json.dumps(t.errors[:10]))
  print('\nSUMMARY', sum(r[1] for r in t.results), '/', len(t.results))
asyncio.run(main())
