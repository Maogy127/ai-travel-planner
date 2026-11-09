"""Day-local preview regression; desktop and mobile use isolated contexts."""
import asyncio
from playwright.async_api import async_playwright
from test_time_entry import checks
from test_full import SITE

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for width in (1280, 390):
            await checks(browser, (SITE/'index.html').resolve().as_uri(), width)
        await browser.close()
if __name__ == '__main__': asyncio.run(main())
