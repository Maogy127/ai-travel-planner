"""Supervisor Chromium food regression, port 8840."""
from test_full import open_home_flow
from test_full import wait_plan, open_day_pace, open_guidance, open_add_menu
import asyncio
import re
from playwright.async_api import expect
from test_full import new, show_day
from test_wellness_home import serve_checks
BASE = 'http://127.0.0.1:8840/index.html'
BANNED = re.compile(r'\b(unhealthy|guilt|guilty|cheat|junk|bad|sinful|indulgent|burn off|earn|punish|damage|splurge)\b', re.I)
NEEDS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Halal', 'Nuts', 'Shellfish', 'Other']
LOVES = ['Local classics', 'Seafood', 'Street food / casual', 'Fine dining', 'Healthy cafés & bowls', 'High protein', 'Low carb']
async def checks(browser):
    for width in (1280, 390):
        ctx, pg = await new(browser, BASE, width)
        try:
            await pg.evaluate("__gonow.go('food')")
            groups = pg.locator('.food-group')
            await expect(groups).to_have_count(2)
            assert await groups.locator('legend').all_text_contents() == ['Any dietary needs?', 'What do you love to eat?']
            assert await groups.nth(0).get_by_test_id('food-chip').all_text_contents() == NEEDS
            assert await groups.nth(1).get_by_test_id('food-chip').all_text_contents() == LOVES
            assert not BANNED.search(' '.join(await groups.all_text_contents()))
            await expect(pg.get_by_test_id('allergy-other')).to_be_hidden()
            await pg.locator('[data-testid=food-chip][data-value=Other]').click()
            await expect(pg.get_by_test_id('allergy-other')).to_be_visible()
            await pg.get_by_test_id('allergy-other').fill('Sesame')
            await pg.get_by_test_id('diet-notes').fill('Please confirm ingredients')
            await pg.reload()
            await pg.evaluate("__gonow.go('food')")
            await expect(pg.get_by_test_id('allergy-other')).to_have_value('Sesame')
            await expect(pg.get_by_test_id('diet-notes')).to_have_value('Please confirm ingredients')
            await pg.evaluate("localStorage.setItem('gonow:answers',JSON.stringify({food:['Seafood','Vegan','No preference'],diet:['High protein','No restrictions'],allergies:'peanuts, shrimp'}))")
            await pg.reload()
            await pg.evaluate("__gonow.go('food')")
            for value in ['Seafood', 'Vegan', 'High protein', 'Nuts', 'Shellfish']:
                await expect(pg.locator(f'[data-testid=food-chip][data-value="{value}"]')).to_have_attribute('aria-pressed', 'true')
            assert await pg.get_by_text('No preference', exact=True).count() == 0
            assert await pg.get_by_text('No restrictions', exact=True).count() == 0
            await pg.evaluate("__gonow.go('home')")
            await open_home_flow(pg)
            await pg.get_by_test_id('demo-oahu').click()
            from test_full import continue_prep
            await continue_prep(pg)
            await wait_plan(pg)
            # Demo preserves dietary answers through normalization.
            conflict_id = await pg.evaluate("""() => {
                __gonow.state.answers.allergens=['Shellfish'];__gonow.state.answers.dietNeeds=[];
                const meal=__gonow.state.plan.days[0].items.find(i=>i.kind==='meal');
                meal.title='Oyster bar';meal.desc='Seafood restaurant with shellfish';meal.tags=['shellfish'];
                const dinner=__gonow.state.plan.days[1].items.find(i=>i.kind==='meal'&&/La Mer/.test(i.title));
                dinner.tags=['shellfish'];return meal.id;
            }""")
            for day in range(5):
                await show_day(pg, day)
                if day == 0:
                    row = pg.locator(f'[data-db-source="{conflict_id}"]').first
                    await expect(row.locator('.db-expand strong')).to_have_text('A place that fits your needs')
                if day == 1:
                    await expect(pg.locator('[data-db-id=lamer]')).to_contain_text('La Mer')
                    await expect(pg.locator('[data-db-id=lamer]')).to_contain_text('Check the menu for Shellfish')
                    await pg.get_by_test_id('before-you-go').evaluate('e=>e.open=true')
                    await expect(pg.get_by_test_id('dinner-balance').first).to_be_visible()
                    assert not BANNED.search(' '.join(await pg.get_by_test_id('dinner-balance').all_text_contents()))
                assert await pg.locator('.db-activity > [data-testid=diet-tag]').filter(has_text='Check the menu').count() > 0 if day < 4 else True
                for row in await pg.locator('[data-db-source]').all():
                    if 'db-locked' not in (await row.get_attribute('class') or ''):
                        assert not re.search(r'seafood restaurant|shellfish|oyster bar', ' '.join(await row.locator('.db-expand strong,strong[id^=db-title]').all_text_contents()), re.I)
            print('PASS food groups, persistence, legacy migration and demo meals', width)
        finally:
            await ctx.close()
if __name__ == '__main__':
    asyncio.run(serve_checks(8840, checks))
