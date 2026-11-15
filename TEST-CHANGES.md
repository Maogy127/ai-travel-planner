# Changed assertions

- `tests/test_full.py:220`: `ok(f'{label} fonts', 'Playfair Display' in await pg.locator('h1').evaluate('e=>getComputedStyle(e).fontFamily') and 'DM Sans' in await pg.locator('body').evaluate('e=>getComputedStyle(e).fontFamily'))` → `ok(f'{label} fonts', 'Fraunces Variable' in await pg.locator('h1').evaluate('e=>getComputedStyle(e).fontFamily') and 'Inter Variable' in await pg.locator('body').evaluate('e=>getComputedStyle(e).fontFamily'))`. Intentional wellness font/copy or local asset version change; functional assertions preserved.
- `tests/test_full.py:353`: `ok(f'{label} fresh rank Deckhand', 'Deckhand' in await pg.get_by_test_id('rank-badge').inner_text())` → `ok(f'{label} fresh rank Getting started', 'Getting started' in await pg.get_by_test_id('rank-badge').inner_text())`. Intentional wellness font/copy or local asset version change; functional assertions preserved.
- `tests/test_full.py:393`: `ok(f'{label} real actions increase rank', 'Deckhand' not in rank_text)` → `ok(f'{label} real actions increase rank', 'Getting started' not in rank_text)`. Intentional wellness font/copy or local asset version change; functional assertions preserved.
- `tests/test_travel_time.py:17`: `assert path.endswith('?v=11c2dfb-mapvoice'), path` → `assert path.endswith('?v=122593a-wellness'), path`. Intentional wellness font/copy or local asset version change; functional assertions preserved.
- `tests/test_map.py:95`: `assert all(urlparse(u).hostname in ('127.0.0.1', 'tile.openstreetmap.org', 'fonts.googleapis.com') for u in requests), requests` → `assert all(urlparse(u).hostname in ('127.0.0.1', 'tile.openstreetmap.org') for u in requests), requests`. Intentional wellness font/copy or local asset version change; functional assertions preserved.

- `tests/check-ui.cjs:42`: `for (const f of ['catalog','oahu','engine','ai','credits','localinfo','affiliates','app']) vm.runInContext(fs.readFileSync(`${jsRoot}${f}.js`,'utf8'),ctx);` → `for (const f of ['catalog','oahu','engine','ai','credits','localinfo','affiliates','rings','app']) vm.runInContext(fs.readFileSync(`${jsRoot}${f}.js`,'utf8'),ctx);`. Load the new classic ring script used by the renderer.
- `tests/check-ui.cjs:46`: `assert(node('view').innerHTML.includes('Photo:'));` → `assert(node('view').innerHTML.includes('Come home better than you left.'));`. Intentional removal of page-turn decoration / photo-led hero, or added versioned assets; functional coverage retained.
- `tests/check-ui.cjs:47`: `assert(node('view').innerHTML.includes(ctx.PHOTO_CREDITS[0].alt));` → `assert(node('view').innerHTML.includes('Plan estimates, not medical advice'));`. Intentional removal of page-turn decoration / photo-led hero, or added versioned assets; functional coverage retained.
- `tests/test_travel_time.py:14`: `"els => els.map(e => e.getAttribute('src') || e.getAttribute('href')).filter(p => /^(js|css|vendor)\\//.test(p))")` → `"els => els.map(e => e.getAttribute('src') || e.getAttribute('href')).filter(p => /^(js|css|vendor|fonts)\\//.test(p))")`. Intentional removal of page-turn decoration / photo-led hero, or added versioned assets; functional coverage retained.
- `tests/test_travel_time.py:15`: `assert len(assets) == 13` → `assert len(assets) == 15`. Intentional removal of page-turn decoration / photo-led hero, or added versioned assets; functional coverage retained.
- `tests/test_full.py:90`: `ok('page flip + contextual guide', await pg.locator('[data-flip=true].page-flip').count()==1 and hint!=await pg.get_by_test_id('guide').inner_text())` → `ok('step progress + contextual guide', 'Step 2 of 5' in await pg.get_by_test_id('stamp-bar').inner_text() and hint!=await pg.get_by_test_id('guide').inner_text())`. Intentional removal of page-turn decoration / photo-led hero, or added versioned assets; functional coverage retained.
- `tests/test_full.py:218`: `ok(f'{label} reduced flip disabled', await pg.locator('[data-flip=true]').evaluate("e=>getComputedStyle(e).animationName")=='none')` → `ok(f'{label} reduced flip disabled', await pg.locator('.question').evaluate("e=>getComputedStyle(e).animationName")=='none')`. Intentional removal of page-turn decoration / photo-led hero, or added versioned assets; functional coverage retained.

## Second wellness pass

- Restored the exact existing corrupt-share message “This trip link couldn’t be opened. Start a new adventure below.” No assertion change.
- Scanned every exact text/inner-text assertion in `tests/test_full.py`, including later DayBuilder, affiliate and local-information sections. No additional copy assertion changes required.
- `tests/test_travel_time.py`: asset count 15 → 16 for the versioned `js/diet.js` script. Version and HTTP checks remain intact.
- `tests/check-ui.cjs`: added `diet` to the script harness for the new pure dietary matcher.
- Added independent pace and wellness-question browser regressions; did not run Playwright. Left the pre-existing seasonal-weather failure in `tests/test_flow.py` unchanged.
- `tests/test_wellness_home.py`: scoped the day ring visibility locator to `.day-head > [data-testid=wellness-rings]` so newly required traveler rings do not cause a strict-locator error; visibility assertion retained.

## v2

- J2 — `tests/test_full.py:755`: require lock and the More trigger in `.db-controls`, with handle/up/down/remove inside the same card's `db-more-menu`; preserves action availability after the menu moved outside the controls row. The mobile one-row assertion is unchanged.

- More-menu layout fix: no repository tests or assertions edited. All 11 Node test files pass; JavaScript/Python syntax checks and `git diff --check` pass. A temporary offline browser check for 390px/1280px could not launch Chromium because the sandbox denied an operation.

- `tests/test_travel_time.py`: expected asset version is `5600d63-v2`; asset count and response checks retained.
- `tests/test_wellness_questions.py`: replace unknown-tag assertions with zero demo diet tags; preference and persistence checks retained.
- `tests/shots_daybuilder.py:61`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/shots_daybuilder.py:68`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/shots_daybuilder.py:76`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_flow.py:56`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/verify_live_tray.py:72`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/verify_live_tray.py:83`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/verify_live_tray.py:91`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/verify_live_tray.py:100`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/verify_live_tray.py:159`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:604`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:607`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:642`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:646`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:671`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:736`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:736`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:741`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:772`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:804`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:868`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:897`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:909`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:958`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_full.py:998`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_time_entry.py:118`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_time_entry.py:120`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_time_entry.py:125`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_time_entry.py:127`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_time_entry.py:148`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_time_entry.py:154`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_time_entry.py:156`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_time_entry.py:183`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_time_entry.py:185`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_time_entry.py:192`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_time_entry.py:243`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_time_entry.py:245`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/verify_live.py:52`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/verify_live.py:60`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/verify_live.py:70`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/verify_live.py:83`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/verify_live.py:103`: open the card More menu through `card_action` before the existing action; retain its assertion/drag target.
- `tests/test_rings.js`: generic Rest now counts zero; explicit Meditation retains the recovery fixture intent. Add actual DayBuilder Day 2 expectations and movement/recovery cap coverage.
- `tests/test_diet.js`: add actual demo meal evidence checks; supported fixture retained.
- Added `tests/test_ring_breakdown.py` (8835), desktop/mobile click and keyboard breakdown checks.
- No old Easy/Moderate/Full-on UI clicks found in Python tests; engine pace fixtures remain valid. Destination-above-fold runs only at 1280 and is unchanged.
- `tests/check-ui.cjs` and `tests/verify-ui.py`: personalized Easy template fixtures now set `level:'gentle'` instead of mutating legacy pace; existing template assertions retained.
- `tests/check-ui.cjs`: add rendered evidence-only diet tag coverage (no demo tags; supported Vegan-options fixture shows a tag).
- `tests/check-ui.cjs`: add saved legacy pace migrations (Easy/Moderate/Full-on) and level precedence coverage.
- `tests/test_pace.py`: add four-option onboarding picker and derived Easy pace coverage while keeping optional sleep visible.

- `tests/test_time_entry.py:121`: restore dialog heading assertion or select the new pace picker; preserve flow intent.

- `tests/test_time_entry.py:128`: restore dialog heading assertion or select the new pace picker; preserve flow intent.

- `tests/test_time_entry.py:157`: restore dialog heading assertion or select the new pace picker; preserve flow intent.

- `tests/test_time_entry.py:186`: restore dialog heading assertion or select the new pace picker; preserve flow intent.

- `tests/test_time_entry.py:246`: restore dialog heading assertion or select the new pace picker; preserve flow intent.

- `tests/test_full.py:251`: restore dialog heading assertion or select the new pace picker; preserve flow intent.

- `tests/check-ui.cjs:42`: load the new classic checkin script before app rendering, matching index.html.
- `tests/test_checkin.js:1`: new pure English/Chinese parser, negation, immutable suggestions, locked-item exclusion, high/okay energy, goal factors/precedence, per-day/per-traveler storage, and encouraging ring copy coverage.
- `tests/test_checkin.py:1`: new supervisor browser suite on 8836 at 1280/390; shared new/show_day/serve_checks helpers and SpeechRecognition mock cover hold/keyboard/click voice, Chinese parsing, group-only swaps/rings, persistence/dismissals/skip, moments, rendered copy and 44px controls. Uses the unlocked Nov 28 hike; Nov 26's reserved hike remains protected.
- `tests/test_tray_preview.py:1`: audited (no edit); imports the corrected dialog-heading checks from test_time_entry.
- `tests/verify_live.py:53`, `tests/verify_live_tray.py:73`, `tests/test_full.py:612`: audited every card_action call; remaining uses target activity rows, not dialog headings. Searched all tests/*.py, *.js and *.cjs for obsolete pace-option clicks; the stale test_full.py:251 click was the remaining one.
- `tests/test_checkin.js:35`: additionally verify personal ring score isolation and swapped activity export/import persistence.
- `tests/test_checkin.py:116`: additionally exercise solo explicit swap/add, unchanged locked reservations, same time slot and reload persistence.

- `tests/test_full.py:361`: assert header progress badge absence instead of its removed Getting started copy.
- `tests/test_full.py:400`: remove rank earning/details dependencies; retain reload/reopen/Start over flow and assert badge stays absent after reload and reset (lines 401, 403).
- `tests/test_full.py:666`: route Harbor reservation deletion through `card_action` because Delete is inside More; deletion and focus assertions unchanged. Pointer-cancel and no-plan-emoji assertions unchanged.
- `tests/test_travel_time.py:15`: asset count 16 → 17 for `js/checkin.js`; retain exact v2 version and HTTP response assertions.
- `tests/test_wellness_home.py:53`: replace removed sample-ring visibility/caption checks with explicit absence checks for sample card, sample rings, all home rings, header badge and sample title at both widths.
- `tests/test_wellness_home.py:72`: verify medical-estimate caption on day-view rings and badge absence in the day view, preserving caption coverage after removing home rings.
- `tests/test_contrast.py:49`: remove home-ring contrast loop after selected-pace check; the existing day-view sleep/movement/recovery contrast checks at line 59 now cover the real remaining rings.
- `tests/check-ui.cjs:47`: replace home sample caption expectation with sample-rings, wellness-rings and rank-badge absence checks in the offline rendering harness.
- `tests/daybuilder_logic.js:97`: add mounted high-energy suggestion insertion, scheduled Sunrise run, export/import persistence and wellness metadata checks; verifies HH:MM add path without a browser.
- `tests/test_checkin.py:36`: assert voice status remains exactly Listening… after a final transcript arrives while recording.
- `tests/test_checkin.py:43`: read per-traveler goals from accessible SVG labels instead of removed expanded goal text in compact rows; retain 54/90 min goal checks.
- `tests/test_checkin.py:128`: assert solo saved copy has no Traveler 1 prefix; exercise Edit reopening the saved form and resaving before the unchanged swap checks.
- `tests/test_pace.py:48`: verify traveler name via accessible container label and all three goals via SVG label after compacting the row; retain encouraging-copy check.
- `tests/test_pace.py:51`: verify single Details control, initially hidden breakdown, keyboard Enter expansion, visible panel and click collapse via aria-expanded.

Validation for Parts D–F: all 11 `tests/*.js` / `tests/*.cjs` Node suites pass; `node --check` passes for all `js/*.js` and Node test files; all top-level Python tests parse via `ast.parse`; `git diff --check` passes. Playwright left to supervisor; no network, commit or push performed.

- I1 — `tests/test_daybuilder_logic.js`: add parser unit checks rejecting “within 24 h”, “24 h in advance”, “book 48 h ahead” and refund notice; retain positive duration examples. Assert Nov 28 shuttle uses the existing 60-minute fallback (<=60), 20:45–21:45.
- I1 — `tests/test_rings.js`: assert default Day 4 sleep is exactly **9.25 h (9 h 15 m)**: 21:45 final activity + 60-minute wind-down, default 08:00 wake because Day 5 flight is untimed. Add corrupt explicit/inferred end guards and 26:00 cap coverage. Other days' demo start/end times are unchanged against the pre-I1 working-tree snapshot; existing DayBuilder and `test_full.py` expectations are unchanged.
