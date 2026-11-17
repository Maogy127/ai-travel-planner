"""Supervisor evidence generator, port 8894. No visual signoff is implied.

Run: python3 tests/test_batch_audit.py
SDK, weather and local data are MOCKED local fixtures; all other external requests
are blocked. Screenshots/text/JSON go to GONOW_AUDIT_DIR or shots-batch/audit.
Every independent case continues after failure; exit status is nonzero on failure.
"""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import expect
from test_full import (new, continue_prep, show_day, open_share_menu,
                       dashboard_action, errors as shared_errors, is_place_url)
from test_wellness_home import serve_checks
from test_accounts import mock_sdk
from test_flights_step import title_fits

BASE = 'http://127.0.0.1:8894/index.html'
OUT = Path(os.environ.get('GONOW_AUDIT_DIR', '/workspace/gonow-origin-fix/shots-batch/audit/'))
RECORDS = []
MOCKS = ['Firebase SDK: local ESM fixtures, no real auth',
         'Weather/local data: test_full.new local fixtures; Austin offline fallback',
         'External fonts: empty local stylesheet; external requests blocked']


class Audit:
    def __init__(self, pg, width, mode):
        self.pg, self.width, self.mode = pg, width, mode
        self.errors = []
        self.error_start = getattr(pg, '_batch_error_start', len(shared_errors))
        pg.on('pageerror', lambda error: self.errors.append(str(error)))
        pg.on('console', lambda msg: self.errors.append(msg.text)
              if msg.type == 'error' and not is_place_url(msg.location.get('url', '')) else None)
        pg.set_default_timeout(8000)

    async def capture(self, screen, failure=None):
        filename = f'audit-{self.mode}-{screen}-{self.width}.png'
        record = dict(filename=filename, width=self.width, screen=screen,
                      overflow=None, emptyHeadings=[], consoleErrors=list(self.errors),
                      mocks=MOCKS, failure=failure)
        try:
            await self.pg.evaluate('document.fonts.ready')
            record.update(await self.pg.evaluate('''()=>({
                overflow:document.documentElement.scrollWidth>innerWidth,
                emptyHeadings:[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
                    .filter(e=>e.checkVisibility()&&!e.innerText.trim()).map(e=>e.outerHTML)
            })'''))
            # inner_text excludes collapsed/hidden details; save beside each image.
            visible_text = await self.pg.locator('body').inner_text()
            (OUT / filename.replace('.png', '.txt')).write_text(visible_text)
            record['visibleText'] = visible_text
            await self.pg.screenshot(path=str(OUT / filename), full_page=True)
        except Exception as error:
            record['failure'] = str(error)
        record['helperErrors'] = shared_errors[self.error_start:]
        record['consoleErrors'] = list(dict.fromkeys(self.errors + [
            e for e in record['helperErrors'] if 'console ' in e or 'pageerror ' in e]))
        reasons = ([record['failure']] if record['failure'] else [])
        if record['overflow']:
            reasons.append('horizontal overflow')
        if record['emptyHeadings']:
            reasons.append('visible empty headings')
        if record['consoleErrors']:
            reasons.append('console/page errors (inspect JSON; blocked external requests are labeled mocks)')
        record['passed'] = not reasons
        RECORDS.append(record)
        (OUT / 'audit-records.json').write_text(json.dumps(RECORDS, indent=2))
        print(('FAIL' if reasons else 'PASS'), filename, '; '.join(reasons), flush=True)

    async def step(self, screen, action):
        try:
            await action()
            await self.capture(screen)
            return True
        except Exception as error:
            await self.capture(screen, str(error))
            return False

    async def click(self, screen, testid):
        return await self.step(screen, lambda: self.pg.get_by_test_id(testid).first.click())


async def context(browser, width):
    class OfflineBrowser:
        async def new_context(self, **kwargs):
            ctx = await browser.new_context(**kwargs)
            # Installed BEFORE new() navigates; its later local fixtures override this.
            async def offline(route):
                if route.request.url.startswith('http://127.0.0.1:8894/'):
                    await route.continue_()
                else:
                    await route.abort()
            await ctx.route('**/*', offline)
            return ctx
    error_start = len(shared_errors)
    ctx, pg = await new(OfflineBrowser(), BASE, width)
    pg._batch_error_start = error_start
    await mock_sdk(ctx)
    return ctx, pg


async def questions(browser, width, mode, personal=False):
    ctx, pg = await context(browser, width)
    audit = Audit(pg, width, mode)
    suffix = '-personal' if personal else ''
    topics = []
    async def topic_capture(screen):
        current = await pg.locator('[data-topic]').evaluate_all(
            'es=>es.filter(e=>e.checkVisibility()).map(e=>e.dataset.topic)')
        duplicates = set(topics).intersection(current) | {t for t in current if current.count(t)>1}
        topics.extend(current)
        await audit.capture(screen + suffix, 'Repeated topics: '+repr(duplicates) if duplicates else None)
    try:
        await pg.locator(f'[data-testid=mode-option][data-value={mode}]').click()
        await topic_capture('home')
        if mode == 'local':
            await pg.get_by_test_id('local-city').fill('Austin')
            await pg.get_by_test_id('local-start').click()
        else:
            await pg.get_by_test_id('home-destination').fill('Oahu')
            await pg.get_by_test_id('start-new-trip').click()
            await topic_capture('origin-start')
            await pg.get_by_test_id('start-from').fill('Los Angeles')
            await pg.get_by_test_id('start-next').click()
        for _ in range(15):
            screen = await pg.evaluate('__gonow.state.screen')
            if screen == 'fork':
                await audit.capture('fork' + suffix)
                await pg.get_by_test_id('fork-yes' if personal else 'fork-no').click()
                continue
            if screen not in ('dates', 'flights', 'budget', 'who', 'ages', 'style', 'food', 'pace', 'musts', 'stay'):
                break
            await topic_capture(screen)
            if screen == 'musts' and await pg.get_by_test_id('stay').is_visible():
                await audit.capture('stay' + suffix)
            if screen == 'flights' and personal:
                await pg.get_by_test_id('arrival-flight').fill('HA 11')
                await pg.get_by_test_id('arrival-time').fill('17:30')
                await pg.get_by_test_id('return-time').fill('20:00')
                await audit.capture('flights-provided' + suffix)
                await pg.get_by_test_id('q-continue').click()
            elif screen == 'dates':
                await pg.get_by_test_id('date-start').fill('2026-11-25')
                await pg.get_by_test_id('date-end').fill('2026-11-29')
                await pg.get_by_test_id('q-continue').click()
            else:
                await pg.get_by_test_id('q-skip').click()
        if mode == 'local':
            await expect(pg.get_by_test_id('local-plan')).to_be_visible()
            await audit.capture('plan')
        else:
            await expect(pg.get_by_test_id('pick-activities')).to_be_visible()
            await audit.capture('picks-activities' + suffix)
            # Stay lives on musts in the current flow, rather than a separate route.
            if personal:
                assert await pg.evaluate("__gonow.state.answers.completed.includes('musts')")
            await pg.locator('[data-pick-info=hanauma]').click()
            await audit.capture('picks-activity-details' + suffix)
            await pg.get_by_role('button', name='Close', exact=True).click()
            await pg.locator('[data-pick-toggle=diamond-head]').click()
            await pg.get_by_test_id('pick-next').click()
            await audit.capture('picks-food' + suffix)
            info = pg.locator('[data-pick-info]').first
            await info.click()
            await audit.capture('picks-food-details' + suffix)
            await pg.get_by_role('button', name='Close', exact=True).click()
            await pg.get_by_test_id('pick-next').click()
            await expect(pg.get_by_test_id('confirm-plan')).to_be_visible()
            await audit.capture('confirm-plan-draft' + suffix)
            for index, direction in [(0, 'arrival'), (-1, 'return')]:
                date = await pg.evaluate('i=>__gonow.state.plan.days.at(i).date', index)
                await pg.get_by_test_id('db-day-'+date).click()
                await audit.step(('provided' if personal else 'estimated')+'-flight-'+direction,
                                 lambda: title_fits(pg))
    except Exception as error:
        await audit.capture('question-path-failed' + suffix, str(error))
    finally:
        await ctx.close()


async def plan(browser, width):
    ctx, pg = await context(browser, width)
    audit = Audit(pg, width, 'trip')
    try:
        await pg.get_by_test_id('demo-oahu').click()
        await audit.capture('sample-confirm-plan')
        await pg.get_by_test_id('confirm-plan').click()
        await audit.capture('prep-collapsed')
        await audit.click('prep-good-to-know', 'good-to-know-toggle')
        await audit.click('book-checklist', 'trip-essentials')
        await pg.get_by_test_id('prep-continue').click()
        await show_day(pg, 1)
        await audit.capture('day-normal')
        for name, selector in [('attraction', '[data-db-id="2026-11-26-1"]'),
                               ('restaurant', '[data-db-id=lamer]')]:
            async def expand(selector=selector):
                await pg.locator(selector).get_by_test_id('db-expand').click()
            await audit.step('expanded-' + name, expand)
        await audit.step('how-we-count', lambda: pg.locator('.day-head > .wellness-rings').get_by_test_id('ring-breakdown-toggle').click())
        await audit.click('add-my-own', 'day-add-own')
        await pg.keyboard.press('Escape')
        await audit.step('share-menu', lambda: open_share_menu(pg))
        await pg.keyboard.press('Escape')
        await show_day(pg, 4)
        await audit.step('day-flyhome', lambda: title_fits(pg))
        await audit.step('expanded-flight', lambda: pg.locator('.db-flight-card').get_by_test_id('db-expand').click())
        await audit.click('edit-flight', 'edit-flight')
        await pg.keyboard.press('Escape')
        await audit.click('account-sign-in-mocked', 'sign-in')
        await audit.step('account-email-mocked', lambda: pg.get_by_test_id('sign-in-sheet').get_by_text('Email me a link', exact=True).click())
        await pg.get_by_role('button', name='Close', exact=True).click()
        # Real dashboard edit/generate controls create the existing finished screen.
        await pg.reload()
        await audit.capture('dashboard-summary')
        await dashboard_action(pg, 'edit-draft')
        await audit.capture('draft')
        await audit.click('finished', 'generate-plan')
    except Exception as error:
        await audit.capture('plan-path-failed', str(error))
    finally:
        await ctx.close()


async def checkin(browser, width):
    ctx, pg = await context(browser, width)
    audit = Audit(pg, width, 'trip')
    try:
        # new() appends ?fast=1; navigate explicitly to preserve the today override.
        await pg.goto(BASE + '?today=2026-11-28&fast=1')
        await pg.get_by_test_id('demo-oahu').click()
        await continue_prep(pg)
        await pg.get_by_test_id('track-toggle').click()
        await show_day(pg, 3)
        await audit.capture('checkin-collapsed')
        await pg.get_by_test_id('morning-checkin').locator('summary').click()
        await audit.capture('checkin-all-questions')
        for field, value in [('energy', 'low'), ('soreness', 'some'), ('sleep', 'poor')]:
            await pg.locator(f'[data-testid=checkin-{field}][data-value={value}]').click()
        await pg.get_by_test_id('checkin-save').click()
        await expect(pg.get_by_test_id('checkin-complete')).to_be_visible()
        await audit.capture('checkin-saved-day-summary')
        # Current UI removed evening/moments/completed-day routes. Document absence,
        # never invent a route or seed a completion that the UI cannot perform.
        RECORDS[-1]['unavailableScreens'] = ['Evening check-in', 'Moments', 'Completed day: no completion control in current UI']
    except Exception as error:
        await audit.capture('checkin-path-failed', str(error))
    finally:
        await ctx.close()


async def account_wait(page, label, condition):
    try:
        await page.wait_for_function(condition)
    except Exception as error:
        state = await page.evaluate("({user:window.goNowAccount?.user?.uid, group:window.goNowAccount?.group})")
        raise AssertionError(f"{label}: {condition}; account state={state}; {error}") from error


async def accounts(browser, width):
    ctx, pg = await context(browser, width)
    audit = Audit(pg, width, 'trip')
    member_ctx = None
    try:
        # Local SDK fixtures only: no real identity, email delivery or cloud writes.
        await pg.get_by_test_id('demo-oahu').click()
        await continue_prep(pg)
        await pg.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__invite=text}})")
        await pg.get_by_test_id('sign-in').click()
        await pg.get_by_test_id('sign-in-google').click()
        await audit.capture('account-sync-mocked')
        await pg.get_by_test_id('sync-yes').click()
        await open_share_menu(pg)
        await pg.get_by_test_id('invite-friends').click()
        await expect(pg.locator('#toast')).to_have_text('Invite link copied')
        link = await pg.evaluate('window.__invite')
        records = await pg.evaluate('window.__fbMock.dump()')
        trip_path = next(p for p in records if p.startswith('trips/'))
        member_ctx, member = await context(browser, width)
        member_audit = Audit(member, width, 'trip')
        await member.get_by_test_id('sign-in').click()
        await member.wait_for_function('!!window.__fbMock')
        await member.evaluate('(records)=>{for(const [p,d] of Object.entries(records))window.__fbMock.seed(p,d)}', records)
        await member.get_by_role('button', name='Close', exact=True).click()
        await member.evaluate('(link)=>location.hash=new URL(link).hash', link)
        await member_audit.capture('group-name-join-mocked')
        await member.get_by_test_id('join-name').fill('Alex')
        await member.get_by_test_id('join-anon').click()
        await account_wait(member, 'Named Alex join completed', 'window.goNowAccount.group !== null')
        await account_wait(pg, 'Curated demo invite starts with La Mer locked', 'window.goNowAccount.group?.locks.lamer === true')
        await pg.evaluate('(p)=>window.__fbMock.simulateAlex(p)', trip_path)
        # Curated demo must protect untouched booked dinner before and after Alex's update.
        await account_wait(pg, 'Curated demo invite preserves La Mer lock after simulateAlex', 'window.goNowAccount.group.locks.lamer === true')
        group = await pg.evaluate('(p)=>window.__fbMock.dump()[p]', trip_path)
        await member.evaluate('([p,d])=>{d.memberIds=window.goNowAccount.group.memberIds;d.members=window.goNowAccount.group.members;window.__fbMock.remote(p,d)}', [trip_path, group])
        await member.get_by_test_id('db-day-2026-11-26').click()
        await member.locator('[data-db-id=lamer]').get_by_test_id('db-time').click()
        await member_audit.capture('group-time-suggestion-mocked')
        sheet = member.get_by_test_id('group-time-suggestion')
        await sheet.locator('input').fill('19:00')
        await sheet.get_by_role('button', name='Send suggestion').click()
        await member.wait_for_function('Object.keys(window.goNowAccount.group.suggestions).length === 1')
        group = await member.evaluate('(p)=>window.__fbMock.dump()[p]', trip_path)
        await pg.evaluate('([p,d])=>window.__fbMock.remote(p,d)', [trip_path, group])
        await expect(pg.get_by_test_id('suggestion')).to_contain_text('Alex suggests 7:00 PM for')
        await audit.capture('group-owner-suggestion-mocked')
    except Exception as error:
        await audit.capture('account-path-failed-mocked', str(error))
    finally:
        if member_ctx:
            await member_ctx.close()
        await ctx.close()


async def checks(browser):
    OUT.mkdir(parents=True, exist_ok=True)
    RECORDS.clear()
    print('MOCKED: ' + '; '.join(MOCKS), flush=True)
    for width in (1280, 390):
        for mode, personal in [('trip', False), ('trip', True), ('local', False)]:
            try:
                await questions(browser, width, mode, personal)
            except Exception as error:
                print('FAIL question context', mode, width, str(error), flush=True)
                RECORDS.append(dict(filename=None, width=width, screen=mode+'-question-context',
                                    overflow=None, emptyHeadings=[], consoleErrors=[],
                                    failure=str(error), passed=False, mocks=MOCKS))
        # Independent contexts mean a broken wizard never suppresses plan/auth evidence.
        for case in (plan, checkin, accounts):
            try:
                await case(browser, width)
            except Exception as error:
                print('FAIL independent case', case.__name__, width, str(error), flush=True)
                RECORDS.append(dict(filename=None, width=width, screen=case.__name__,
                                    overflow=None, emptyHeadings=[], consoleErrors=[],
                                    failure=str(error), passed=False, mocks=MOCKS))
    (OUT / 'audit-records.json').write_text(json.dumps(RECORDS, indent=2))
    failed = sum(not row['passed'] for row in RECORDS)
    print(f'AUDIT {len(RECORDS)-failed}/{len(RECORDS)} captures passed; supervisor image review PENDING', flush=True)
    if failed:
        raise AssertionError(f'{failed} audit failures; evidence: {OUT}')


if __name__ == '__main__':
    asyncio.run(serve_checks(8894, checks))
