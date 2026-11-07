"""Mobile layout and browser behavior checks. Run from the repository root."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 390, "height": 844})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        root = Path(__file__).resolve().parent.parent
        site = root / "site" if (root / "site" / "index.html").exists() else root
        await page.goto(site.joinpath("index.html").resolve().as_uri() + "?fast=1")

        async def check(screen):
            await page.evaluate("document.fonts.ready")
            assert await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), screen
            print("390px, no horizontal scroll:", screen)

        await check("start")
        for screen in ["dates", "budget", "who", "ages", "style", "food", "pace", "musts"]:
            await page.evaluate("screen => window.__gonow.go(screen)", screen)
            await check("questions / " + screen)
        await page.evaluate("window.__gonow.go('start')")
        await page.get_by_test_id("demo-oahu").click()
        await page.get_by_test_id("age-rules").wait_for(state="attached")
        await check("plan")
        assert await page.get_by_test_id("plan-day").count() == 1
        assert await page.get_by_test_id("db-day-2026-11-25").get_attribute("aria-label") == "Day 1 · Wed 25"
        assert await page.get_by_test_id("curated-notice").count() == 0
        await page.locator("#day-1 [data-testid=rain-toggle]").check()
        await page.reload()
        await page.get_by_test_id("age-rules").wait_for(state="attached")
        assert await page.locator("#day-1 [data-testid=rain-toggle]").is_checked()
        details = page.locator("details").filter(has=page.locator("summary", has_text="What to bring")).first
        await details.evaluate("""e=>{const d=e.closest('.db-detail');if(d&&d.hidden){const b=document.querySelector('[aria-controls=\"'+d.id+'\"]');if(b)b.click();}}""")
        await details.locator("summary").click()
        bring = details.get_by_test_id("bring-item").first
        pack_id = await bring.get_attribute("data-pack-id")
        await bring.check()
        await page.get_by_test_id("tab-packing").click()
        await check("packing")
        pack = page.locator(f'input[data-pack-id="{pack_id}"]')
        assert await pack.is_checked()
        await pack.uncheck()
        await page.get_by_test_id("tab-plan").click()
        assert not await page.locator(f'input[data-pack-id="{pack_id}"]').first.is_checked()
        await page.get_by_test_id("photo-credits").click()
        await check("credits")
        credit_count = await page.evaluate("window.PHOTO_CREDITS.length")
        assert await page.locator(".credit-card").count() == credit_count and credit_count >= 22
        assert "Wikimedia Commons" in await page.locator("main").inner_text() and "Pexels" in await page.locator("main").inner_text()
        assert await page.locator("#toast").inner_text() == ""
        for img in await page.locator("img").all():
            assert await img.get_attribute("alt")
        await page.evaluate("window.__gonow.go('recommendations')")
        await check("recommendations")
        assert await page.get_by_test_id("rec-card").count() == 3
        await page.evaluate("""() => {
            Object.assign(window.__gonow.state.answers, {
                start:'2027-01-01',end:'2027-01-05',food:['Vegan'],
                pace:'Easy',mustdos:'Museum visit',stay:'My Hotel'
            });
            window.__gonow.go('musts');
        }""")
        await page.get_by_test_id("q-continue").click()
        await page.locator("#trip-essentials [data-testid=tile-toggle]").click()
        await page.get_by_test_id("curated-notice").wait_for()
        await page.get_by_test_id("build-template").click()
        await page.get_by_test_id("tab-plan").wait_for()
        await check("personalized Oahu template")
        text = await page.locator("#view").evaluate("e => e.textContent")
        for expected in ["Vegan", "Staying: My Hotel", "Museum visit", "You requested this", "Jan 1–5, 2027"]:
            assert expected in text, expected
        assert not errors, errors
        print("PASS: mobile screens, rain persistence, credits, templates; zero console errors")
        await browser.close()


asyncio.run(main())
