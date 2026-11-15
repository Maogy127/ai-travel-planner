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

## budget-fix

- Import cleanup: removed the circular `from test_full import open_add_menu` self-import from `tests/test_full.py`; `open_add_menu` remains defined locally. Checked all 35 `tests/*.py` files and found no other self-imports. Moved existing module docstrings above prepended imports in 22 files; no test logic or assertions changed.
- Validation: `python3 -c "import ast,sys; from pathlib import Path; [ast.parse(p.read_text(), filename=str(p)) for p in Path('tests').glob('*.py')]"` passed for all 35 files; `cd tests && python3 -c "import test_full"` passed without launching a browser.

- `tests/test_option_wrap.py:1`: add supervisor Chromium audit on port 8837 for whole-word option wrapping, panel legends, covers layout/targets and document overflow at 1280/390 across home, all question steps, five demo days and morning check-in.
- `tests/test_travel_time.py:17`: expect `?v=20de649-budgetfix` to match every local asset in index.html; retain asset count and response checks.

- `tests/test_travel_time.py:15`: increase versioned asset count 17 → 18 for js/styles.js; retain HTTP and version checks.
- `tests/test_full.py:89`: replace legacy style fixtures/selectors with hotel/nature, preserving flow and max-two swap intent.
- `tests/test_full.py:147`: replace legacy style fixtures/selectors with hotel/nature, preserving flow and max-two swap intent.
- `tests/test_full.py:149`: replace legacy style fixtures/selectors with hotel/nature, preserving flow and max-two swap intent.
- `tests/test_full.py:186`: replace legacy style fixtures/selectors with hotel/nature, preserving flow and max-two swap intent.
- `tests/test_full.py:311`: replace legacy style fixtures/selectors with hotel/nature, preserving flow and max-two swap intent.
- `tests/test_full.py:334`: replace legacy style fixtures/selectors with hotel/nature, preserving flow and max-two swap intent.
- `tests/test_full.py:428`: replace legacy style fixtures/selectors with hotel/nature, preserving flow and max-two swap intent.
- `tests/check-engine.cjs:4`: load shared styles before engine/AI, matching index.html.
- `tests/check-engine.cjs:6`: replace legacy style fixtures/selectors with hotel/nature, preserving flow and max-two swap intent.
- `tests/check-ui.cjs:42`: load shared styles before engine/AI/app, matching index.html.

- `tests/test_styles.js:1`: add exact six-option contract, migration/dedupe/cap/unknown cases, all 66 destination/style generation combinations, legacy-read guards, ranking and curated matcher coverage.
- `tests/test_styles.py:1`: add supervisor Chromium suite on 8838 at 1280/390 for ordered visible labels/hints, targets, existing third-choice swap/message and legacy localStorage migration.
- `tests/test_option_wrap.py:54`: require all six style labels and hints so the existing text-node whole-word audit covers the complete new group at both widths.
- `tests/check-ui.cjs:88`: add real app initialization from legacy localStorage styles and assert migration to nature.

Validation: all 12 top-level Node suites pass; JavaScript syntax checks, Python AST parsing and `git diff --check` pass. Chromium suites left to supervisor. No network, commit or push.

- `tests/test_local_mode.js`: add pure local generator coverage for all five Oahu aliases, half/full/weekend day counts, exact catalog title provenance, all four paces, interest selection, immutable answers, generic-title whitelist and absence of travel items/costs.
- `tests/test_local_mode.py`: add supervisor Chromium suite on 8839 using shared `new`/`serve_checks`, at 1280/390: arrow-key/focus and click mode selection, reload persistence, local fields and voice languages, Oahu source blocks, generic Austin starter, no travel items, Change plan mode preservation, and original trip fields → dates.
- `tests/test_option_wrap.py`: extend both-width audits to local home and Oahu/Austin local plan screens before retaining every existing question/demo audit.
- `tests/test_travel_time.py`: increase asset count 18 → 19 for versioned `js/local.js`; retain HTTP and exact `?v=20de649-budgetfix` assertions.

Local-mode validation: all 13 top-level Node suites pass; JavaScript syntax checks, Python AST parsing and `git diff --check` pass. Chromium execution left to supervisor. No network, commit or push.

Food/flow continuation (no additional JS asset; version and asset count stay unchanged):

- `tests/test_food.js:1`: add old food/diet migration, English/Chinese allergy parsing and dedupe/idempotence, explicit nut/shellfish conflicts, unknown and confirmed evidence, vegetarian/poke uncertainty, stable soft ranking, locked/booked retention, fine-dining detection/day balance and banned-word checks for food/balance copy; verify local food suggestions also filter explicit conflicts. Mapping: old hard food/diet options → dietNeeds; old food interests and diet High protein/Low carb → foodLoves; Coffee & bakeries → Healthy cafés & bowls; old none options dropped; recognized English/Chinese allergens → Nuts/Shellfish, remainder → allergyOther + Other. New arrays are authoritative.
- `tests/test_food.py:1`: add supervisor Chromium suite on 8840 at 1280/390: exact two groups/options, Other reveal, persistence, legacy saved-state migration, La Mer day balance, neutral unknown meal tags, seeded explicit shellfish conflicts replaced in swappable suggestions and the locked La Mer booking retained with its warning.
- `tests/test_question_flow.py:1`: add supervisor Chromium suite on 8841 at 1280/390 walking both modes, topic uniqueness, actual page/step counts, home-only initial pace/activity picker, accessible summary editor and shared Home answer updates.
- `tests/test_option_wrap.py:54`: retain all prior audits; pass through the three local questions before local-plan checks; audit both merged food groups and both collapsed/expanded pace-summary layouts.
- `tests/test_local_mode.py:38`: pass through the new local style/food/sleep pages on both local routes; assert trip destination summary/Edit instead of a repeated destination input, retaining mode/voice/source/travel exclusion checks.
- `tests/test_full.py:86`: keep the legacy direct-start validation helper for its destination/error/voice fixtures; the new question-flow suite covers the Home route. Update progress expectation to eight actual trip detail pages and use merged food chips plus summary Edit during personalization.
- `tests/test_pace.py:65`: assert the default collapsed summary has no picker, then expand Edit before testing the original pace synchronization.
- `tests/test_wellness_home.py:64`: assert destination survives in the summary with Edit and no repeated input after Home, preserving all existing typography/voice/flow checks.
- `tests/test_wellness_questions.py:11`: replace removed diet group/chips with merged food group/chips; replace exclusive none-option checks with toggle-off/empty semantics; require neutral menu-check tags for unconfirmed demo meals while preserving sleep/reload assertions.
- `tests/check-ui.cjs:63`: use authoritative dietNeeds in the personalized fixture, expect neutral unknown meal tags, then require positive evidence after adding a confirmed vegan description.
- `tests/verify-ui.py:66`: update personalized fixture to authoritative dietNeeds; retain all existing render checks.

Food/flow validation: Node suites, JS syntax, Python AST parsing and whitespace checks run locally; Chromium suites are prepared for the supervisor and have not been run in this sandbox. No network, commit or push.
- `tests/smoke.py:56`: enter the surprise-destination branch through Home's “I'm not sure yet”, preserving recommendations coverage while avoiding a second destination question.
Final validation: all 14 top-level Node scripts pass (including food, local, contrast tokens, photo provenance and both day-builder suites); all application/test JavaScript syntax checks, Python AST checks and `git diff --check` pass. Chromium execution remains with the supervisor.

- `tests/test_timepicker.js`: add exhaustive quarter-hour 12/24-hour round trips, noon/midnight, invalid partial values and step wrapping.
- `tests/test_jetlag.js`: add November −2h and July −3h DST checks, exact Day 1/2/3 windows, eastbound/larger-shift rest flags, unknown origin and city-mode handling, demo Day 1 415/60 and Day 2 7.25 sleep hours, and all catalog centers/zones.
- `tests/test_timepicker.py`: add supervisor suite on 8843 at 1280/390 for whole-field opening, popover/sheet position, chips, 15-minute and AM/PM steppers, Escape/focus return, outside dismissal, HH:MM fill compatibility and DayBuilder departure editing through the picker.
- `tests/test_jetlag.py`: add supervisor suite on 8842 at both widths for home copy, complete valid sleep values/no partial markers, gentle LA/sunrise guidance, unchanged locks and no local-mode note.
- `tests/test_stay.py`: add supervisor suite on 8844 at both widths for uncertainty clear/disable/re-enable/focus, personalized Waikiki planning, no demo hotel in stay header, add-later connector recomputation and persisted answers, plus no local hotel controls.
- `tests/test_travel_time.py`: versioned asset count 19 → 21 for timepicker.js and jetlag.js; both use ?v=20de649-budgetfix.
- `tests/test_rings.js`: walk cap expectation 90 → 60; assert all five adjusted Oahu days: sleep [415/60,7.25,370/60,8,8], move [0,90,60,142.5,0], recovery [0,30,0,0,0]. Retain itinerary-only Day 2 and corruption guard tests.
- `tests/test_pace.py`: add expand_group helper before editing and after reload, preserving individual pace/name/persistence intent with the initially collapsed group section.
- `tests/test_wellness_questions.py`: update home-schedule heading/defaults; explicitly clear both fields to exercise itinerary estimates; retain persistence/diet checks and use adjusted Day 2 20:45 wind-down.
- `tests/check-ui.cjs`: load pure jetlag module before app in the VM, matching the new runtime dependency.
- `tests/test_stay.js`: add all catalog centers/Oahu/fallback checks and a hotel-change reflow fixture proving immutable inputs, recomputed travel connectors and unchanged locked start/end/locked values.

Validation for time/sleep/hotel/group/ring work: all 12 `tests/test_*.js` suites plus `check-engine.cjs` and `check-ui.cjs` pass; all `js/*.js` syntax checks, Python test AST parsing and `git diff --check` pass. Chromium is reserved for the supervisor; no browser tests were executed here. No network, commit or push.

- `tests/test_move_time.js`: add offline pure-function coverage for conservative title cleanup, real Nov 27 overlapping stops, touching endpoints, atomic cascading shifts, locked stops and immutable inputs.
- `tests/test_move_time.py`: add supervisor Chromium regression on port 8845 at 1280/390 in plan and draft: Diamond Head unlock/move, preserved clock, 3 PM conflict choices, modal focus/Escape, chronological order, title/originalTitle, transfer review, both days' movement, locked replace/shift safeguards, successful unlocked cascade, replacement tray, untimed move and Pick a time.
- `tests/test_checkin.py`: load with validated `today` overrides, assert non-today/planning hiding and heading-first placement, remove sweet-moment persistence/UI assertions and assert its absence. Preserve voice, group, swaps, skip and persistence checks using the appropriate date override.
- `tests/test_checkin.js`: remove unused sweet-moment storage assertions; retain morning-check-in persistence and personal suggestion/score coverage.
- `tests/test_time_entry.py`: explicitly clear the new default retained move time in the two intentionally unscheduled moves; choose Keep both when existing scheduling/time tests intentionally overlap stops.
- `tests/test_option_wrap.py`: expand morning check-in only when present, because non-today planning views intentionally hide it.
- `tests/test_checkin.js`: additionally cover destination midnight boundaries (Honolulu/Tokyo), valid/invalid `today` overrides and leap dates through pure date helpers.
- `tests/test_time_entry.py`: accept Keep both for timed Add a copy overlaps as well.
- `tests/test_travel_time.py`: select Keep both for intentional travel overlaps; expect the existing prep block to retain its 4–5 PM time after choosing Keep both.
- `tests/test_timepicker.py`: accept Keep both if a picker-selected departure overlaps an existing stop.
- `tests/test_time_entry.py`: schedule the intentionally untimed moved item from the now-visible Needs a time tray, without reopening the mobile search sheet over it.
- `tests/test_move_time.js`: add cross-day snapshot/export round trip for `originalTitle` and assert source/target movement changes by −90/+90 minutes.

Validation for move/time and check-in cleanup: all 18 Node test files (`test_*.js`, `daybuilder_logic.js`, `check-engine.cjs`, `check-ui.cjs`, `contrast_tokens.cjs`, `test_photo_provenance.cjs`) pass. All `js/*.js` syntax checks, all Python test AST checks and `git diff --check` pass. Chromium regressions were prepared for the supervisor, not run here. No network, commit or push.

### Rings card feedback (budget-fix)
- `tests/test_rings.js`: added preceding-night five-day table, both sleep clock times and pace/jet-lag explanation, strict 85% / >60-minute threshold edges (including 6h50), immutable locked-item proposal and DayBuilder shift validation, free recovery gap, contextual rest copy. Existing itinerary-only scoring assertions remain as compatibility coverage.
- `tests/test_checkin.js` and `tests/test_checkin.py`: replaced bare rest-line assertions with the contextual no-recovery sentence.
- Added supervisor-only `tests/test_rings_card.py`, port 8846, widths 1280/390: corrected clean Day 2 explanation; saved late-evening 5h45 reproduction, nudge cause/time, suggest-only reserved-slot proposal, unchanged schedule, dismissal across reload, both breakdown times and pace, overflow check. Clean Day 2 is 7h30/90/30, so a nudge there would violate the requested threshold.
- Validation: all `tests/test_*.js`, `tests/check-engine.cjs`, and `tests/check-ui.cjs` pass; syntax checks pass for all JS and the two touched Python tests; `git diff --check` passes. Chromium is left for the supervisor. The UI render check caught an absent-DayBuilder path; guarded that lookup and reran successfully.

### Simple day view and first-visit Trip prep (budget-fix)

Placement follows the amendment: there are no Budget/prep/packing tiles below
the plan. Budget moves to Trip prep; essentials, booking searches, weather,
money/local information merge into its Before you go; packing moves to What to
bring. Food's duplicate meal list is removed; dinner-balance guidance moves to
the day's collapsed notes. Getting around's per-day car/transport notes move to
that day's notes. Thanksgiving's date-specific flag moves to Nov 26. The repeated
no-flying-after-diving flag stays only in Nov 29's notes. README lists the homes.

- Added `tests/test_dayview_simple.py` (port 8847, 1280/390): default title/date,
  compact ring and Enter disclosure, photos/times/cards/connectors, collapsed
  pace/group/add/booking/chips/day notes, quiet clean-night nudge state, icon
  labels, 44px hit areas, reachable controls and overflow.
- Added `tests/test_trip_prep.py` (port 8848, 1280/390): first-visit intro,
  exactly three prep sections, left-aligned icon/title geometry, heading focus,
  Continue, persisted ticks and seen flag, count/All set, reentry, no bottom
  tiles, normalized day/prep note comparison (sources stripped), and overflow.
- `tests/test_full.py`: added `continue_prep`, `wait_plan`, `open_trip_prep`,
  `open_day_pace`, `open_add_menu`, `open_group`, `open_info`, `open_guidance`.
  Readiness waits handle the intro; add/reset actions open their panel; relax
  and rain actions open their disclosure. Budget accordion checks now exercise
  prep's budget disclosure with Enter/Space. Affiliate/local-info and packing
  synchronization/persistence/custom-item checks use prep. Legacy storage
  assertions allow the requested `gonow.prep.v1` store. Shared-plan readiness,
  reduced motion and print checks follow the new entry/control locations.
- `tests/check-ui.cjs`: assert first prep, exactly three sections, per-saved-trip
  seen state, independent prep for another trip ID, repeat plan entry and
  Continue; preserve generated-plan/routing checks and update ready-toast timing.
- `tests/test_rings.js`: assert a single compact ring trigger containing the SVG
  and summary, collapsed breakdown, and absence of the old goal grid/caption.
- `tests/test_pace.py`: wait through prep, open pace before edits, inspect goals
  through the ring SVG's accessible label, retaining group/pace intent.
- `tests/test_checkin.py`: handle prep and collapsed pace; open the breakdown to
  inspect contextual rest guidance instead of expecting a default banner.
- `tests/test_ring_breakdown.py`: handle prep and check compact movement/recovery
  summary text while retaining disclosure/keyboard/contribution checks.
- `tests/test_contrast.py`: handle prep and measure the visible lock icon and
  compact summary instead of removed lock chips and goal-grid text.
- `tests/test_wellness_home.py`: handle prep and expect no caption in the compact
  day summary; retain home, persisted preferences and calm-copy assertions.
- `tests/test_travel_time.py`: handle first-visit prep before existing plan assertions; preserve the original scenario.
- `tests/test_option_wrap.py`: handle first-visit prep before existing plan assertions; preserve the original scenario.
- `tests/test_time_entry.py`: handle first-visit prep before existing plan assertions; open the add panel for booking/tray/reset actions.
- `tests/test_timepicker.py`: handle first-visit prep before existing plan assertions; preserve the original scenario.
- `tests/test_stay.py`: handle first-visit prep before existing plan assertions; preserve the original scenario.
- `tests/test_wellness_questions.py`: handle first-visit prep before existing plan assertions; open sleep/pace guidance before reading its content.
- `tests/test_rings_card.py`: handle first-visit prep before existing plan assertions; preserve the original scenario.
- `tests/test_jetlag.py`: handle first-visit prep before existing plan assertions; open sleep/pace guidance before reading its content.
- `tests/test_food.py`: handle first-visit prep before existing plan assertions; open day notes before asserting dinner-balance guidance.
- `tests/test_map.py`: handle first-visit prep before existing plan assertions; preserve the original scenario.
- `tests/test_flow.py`: handle first-visit prep before existing plan assertions; preserve the original scenario.
- `tests/verify_live.py`: handle first-visit prep before existing plan assertions; open the add panel for booking/tray/reset actions.
- `tests/verify_live_tray.py`: handle first-visit prep before existing plan assertions; open the add panel for booking/tray/reset actions.
- `tests/inventory_merge.py`: handle first-visit prep before existing plan assertions; preserve the original scenario.
- `tests/shots_merged.py`: handle first-visit prep before existing plan assertions; preserve the original scenario.
- `tests/shots_daybuilder.py`: handle first-visit prep before existing plan assertions; open the add panel for booking/tray/reset actions.
- `tests/smoke.py`: handle first-visit prep before existing plan assertions; preserve the original scenario.
- `tests/verify-ui.py`: handle first-visit prep before existing plan assertions; replace the old essentials tile with plan options when checking template routing.
- `tests/test_move_time.py`: pass first-visit prep and tolerate direct plan
  restoration after reload while preserving move/time conflict scenarios.
- Reload helpers in `tests/test_pace.py`, `tests/test_checkin.py`,
  `tests/test_stay.py`, and `tests/test_wellness_questions.py` now tolerate
  direct active-trip restoration. `tests/test_trip_prep.py` requires a plan
  after reload without clicking a saved-trip button.
- The shared packing renderer is retained in prep (status, quantities, custom
  items, hide/reset). Its checkbox testid is `prep-item`; `pack-item` remains
  reachable as the item container and `data-pack-id` remains on the checkbox.
  Packing sync tests select the checkbox through `data-pack-id`.
- `tests/test_trip_prep.py` also checks the live header count while checking
  items inside prep, including All set before Continue. The compact ring's
  accessible name includes its values as well as the breakdown action.

Validation: all 18 Node suites pass, including mounted DayBuilder rendering,
engine/UI render checks, ring-summary coverage, color tokens and photo
provenance; changed app/ring paths were rerun after the final refinements.
All JS syntax checks, Python test compilation and `git diff --check` pass.
The broader mounted-render test caught an icon-label helper scope error; it was
fixed and the mounted-render suite rerun successfully. Chromium is reserved for
the supervisor; the new viewport suites have not been run here. Existing
uncommitted work and the version query are retained. No network, commit or push.

Dashboard and transport follow-up (under `## budget-fix`):
- `tests/test_travel_time.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions; count the added versioned dashboard asset.
- `tests/test_pace.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions.
- `tests/test_time_entry.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions.
- `tests/test_checkin.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions.
- `tests/test_full.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions. Flight edits use picker actions.
- `tests/test_stay.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions.
- `tests/test_trip_prep.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions.
- `tests/verify_live_tray.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions.
- `tests/test_flow.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions.
- `tests/test_move_time.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions.
- `tests/verify-ui.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions.
- `tests/test_wellness_questions.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions.
- `tests/smoke.py`: route saved-trip/reload actions through dashboard helpers; retain original assertions.
- `tests/test_dashboard.js` (new): pure UMD Draft/Ready/Upcoming/In progress rules, inclusive endpoints, Honolulu midnight boundaries and strict `?today` date validation.
- `tests/test_dashboard.py` (new, 8849): 1280/390 first visit, reload dashboard, status/dates/prep, multiple trips, new-trip/back flow, legacy single/list migration, cancel/delete/focus, Today override/next activity, whole-word wrapping and overflow.
- `tests/test_transport_cards.py` (new, 8850): 1280/390 transport SVG/no-image assertions, retained activity photos, Day 1 chip and Day 5 stepper flight-time selection, complete labels/values, reload persistence and overflow.
- `tests/check-ui.cjs`: load the dashboard script in the VM, matching the versioned HTML asset order.
- `tests/daybuilder_logic.js`: make the click mock distinguish the new flight picker selector; assert mounted car/shuttle icons while retaining movement/reflow checks.
- `tests/test_full.py`: `show_day` now reopens a dashboard trip before day navigation; flight-time helper uses the real hour/minute steppers, starting from the existing value. Frozen-plan and draft helpers retain their distinct behaviors.
- `tests/test_travel_time.py`: reload now asserts dashboard visibility before opening Edit draft; asset count is 22.
- `tests/test_food.py`: use `open_home_flow` to enter + New trip when home controls or the demo are needed after a saved trip; preserve the original home/local/map/voice intent.
- `tests/test_contrast.py`: use `open_home_flow` to enter + New trip when home controls or the demo are needed after a saved trip; preserve the original home/local/map/voice intent.
- `tests/test_option_wrap.py`: use `open_home_flow` to enter + New trip when home controls or the demo are needed after a saved trip; preserve the original home/local/map/voice intent.
- `tests/test_wellness_home.py`: use `open_home_flow` to enter + New trip when home controls or the demo are needed after a saved trip; preserve the original home/local/map/voice intent.
- `tests/test_question_flow.py`: use `open_home_flow` to enter + New trip when home controls or the demo are needed after a saved trip; preserve the original home/local/map/voice intent.
- `tests/test_stay.py`: use `open_home_flow` to enter + New trip when home controls or the demo are needed after a saved trip; preserve the original home/local/map/voice intent.
- `tests/test_jetlag.py`: use `open_home_flow` to enter + New trip when home controls or the demo are needed after a saved trip; preserve the original home/local/map/voice intent.
- `tests/test_map.py`: use `open_home_flow` to enter + New trip when home controls or the demo are needed after a saved trip; preserve the original home/local/map/voice intent.
- `tests/test_full.py`: add `open_home_flow` for dashboard-to-home navigation; new trips retain the existing wellness pace/activity preferences.
- `tests/check-ui.cjs`: assert one rendered dashboard card, In progress, Today block and first next activity with a finished VM fixture and `?today=2026-11-26`.
- `tests/test_dashboard.py`: card status is compared with destination-local status logic, and both November endpoints are asserted explicitly.

Dashboard/transport validation: all 19 Node suites pass. All app JavaScript
syntax checks, Python test AST compilation and `git diff --check` pass.
Chromium suites on 8849 and 8850 are added for the supervisor and were not run
here. No network access, commit or push; prior uncommitted work is retained.

### Finished-plan crash and proofreading follow-up (budget-fix)

- `tests/check-ui.cjs`: return null for the nonexistent `tab-content` test id; exercise both static itinerary and merged builder mount paths, assert removed tabs/tiles are absent, assert saved-trip dashboard on application reload, and expect nonmatching Oahu answers to generate a personalized template directly.
- `tests/check-engine.cjs`: expect incomplete/nonmatching demo answers to use the template route while retaining age-rule, packing and cost checks.
- `tests/test_styles.js`: update nonmatching-interest routing assertion and add ages 30/31 with a user hotel, personal metadata and no demo age claims.
- `tests/test_local_mode.js`: preserve catalog provenance after replacing lodging copy with “nearby”; assert local titles omit lodging wording and meals omit generic access guidance.
- `tests/test_timepicker.js`: add 12-hour parsing checks for evening, noon, midnight and invalid hour input.
- `tests/test_question_flow.py`: assert a single accessible Step X of N progress indicator and no passport, pinned summary or page-number footer.
- `tests/test_full.py`: replace passport/stamp progress assertions with accessible progress and retained-answer checks; use Trip prep for packing, expand its disclosures for packing interactions, remove obsolete tab interactions, and verify itinerary/builder placement without tile wrappers. Keep print visibility checks on actual day sections.
- `tests/test_trip_prep.py`: include the Before you go disclosure summary in section checks, assert packing categories begin collapsed, and open disclosures before checking their items.
- `tests/test_timepicker.py`: open the single visible picker button, verify restored button focus, invisible raw text after blur, one human time display, and both fill formats.
- `tests/smoke.py`, `tests/verify-ui.py`: route packing checks through Trip prep, expand disclosures for item interactions, and expect personalized Oahu templates without the old mismatch/template-button detour.

Validation: all 19 Node suites passed; JavaScript syntax, Python test AST syntax
and `git diff --check` passed. Chromium is reserved for the supervisor; no browser
or network was used. Selector audit removed obsolete bottom-tile/tab render paths;
packing status/progress accesses remain guarded and local info mounts only in prep.
Copy audit retains legacy storage identifiers/migration filters and the actual
“Jurassic Adventure” tour name; user-facing chest actions now say “ideas”.

## budget-fix

### Chromium r3 follow-up

- `tests/test_full.py`: move removed per-card packing/disclosure checks into Trip prep, retain live checkbox state and reload persistence checks, and verify all three centralized prep sections. Budget checks accept the actual generated estimates and still require inclusion/exclusion labels; keyboard checks explicitly start with the budget disclosure closed. The personalized flow remains covered, followed by explicitly opening the Oahu sample for the fixed five-day/Jurassic/no-fly/arrival assertions. Template notices are checked in Trip prep. Expanded activity checks retain photos, booking links, keyboard expansion and travel coverage while requiring removed packing UI to be absent. The guidance helper opens its new pace parent. The shared dashboard helper uses the new More icon button.
- `tests/test_question_flow.py`: use `wait_plan` to pass first-visit Trip prep before asserting the plan header; retain topic uniqueness, progress and saved-answer checks.
- `tests/test_trip_prep.py`: require the new Before you go count, compare it with rendered tasks, require merged notes to be present and deduplicated, and retain the title alignment, checkbox, persistence and completion assertions.
- `tests/test_styles.py`: hoist the awaited label-text lookup outside `any(...)` to avoid constructing an async generator; retain the original banned-label assertion.
- `tests/test_jetlag.py`, `tests/test_stay.py`, `tests/test_rings_card.py`, `tests/test_dayview_simple.py`: print PASS after each assertion/expectation; no assertions changed.
- `tests/check-ui.cjs`: load the real DayBuilder dependencies for the shared dashboard/day ring calculation, then restore the deliberately builder-free VM path for the remaining static-render assertions. Existing dashboard and navigation assertions remain intact.
- `tests/test_budget_fix.js` (new): offline regression checks for unique per-day template titles, at most one breakfast before/equal to 11 AM, capitalized Couple, explicit demo routing with Athlete, and shared 8h00/7h05 ring formatting.

App fixes cover today's check-in placement and visible traveler alternatives,
finished-plan banner, map times, time-editor focus/Escape, move dialogs,
fixed-viewport picker steppers and flight labels/chips, preserved generated prep
times, compact day disclosures, dashboard ring parity/Open today/More, centralized
merged prep notes, personalized card controls/meals, origin copy and local labels.

Validation: all 20 Node suites passed. JavaScript syntax checks, Python AST syntax
checks and `git diff --check` passed. Chromium was not launched; the supervisor
must validate browser completion and both viewport layouts. No network, commit
or push was performed by this agent.

### Chromium r4 follow-up

- `tests/test_checkin.py`: scope the placement assertion to shown Day 4 and require title → compact rings → today check-in.
- `tests/test_flow.py`: open the intentional dashboard More button; retain action/Open coverage and add explicit Delete confirmation, cancel, and confirmed removal checks.
- `tests/test_map.py`: allow the plan's weather host `api.open-meteo.com`; retain tile and stop time checks.
- `tests/test_full.py`: return from Trip prep to Day 2 before checking Kualoa's activity link; isolate browser check sections so locator exceptions report FAIL and later sections still run.
- `tests/test_wellness_questions.py`: explicitly select and scope Day 2 for wind-down and live compact ring assertions, retaining the 8:45 PM expectation.
- `tests/test_trip_prep.py`: print PASS after every assertion/expectation without changing them.

App fixes: shared plan/draft day builder for generated trips with separate storage, compact ring/check-in order, five disclosed booking partners, prep essentials selector, print details bodies, move-conflict Tab/Escape handling, stable activity menus, an inner budget grid, and visible picker buttons.

Validation: all 20 Node suites pass; additional offline Oahu/Lisbon builder smoke checks pass. All app JavaScript syntax and Python test AST checks pass; `git diff --check` passes. Chromium remains supervisor-run. No network, commit, or push.

### Chromium r5 follow-up

- `tests/test_plan_render.cjs` (new): mounts the real DayBuilder with app banner/day-header/detail helpers for the Oahu demo, personalized Oahu template, and Lisbon Apr 10–14, 2027 template. Exercises every day, schedule export, print rendering, and missing template weather; prints thrown stacks. Reproduced the missing Oahu tray item `.id` exception before the fix.
- `tests/test_move_time.js`: verifies replaced derived Shower prep remains unscheduled through reflow and snapshot restoration.
- `tests/test_timepicker.py`: adds PASS output after each assertion/expectation; assertions remain unchanged.

App fixes: destination-specific idea trays, safe missing weather, fresh builder schedule on remount, unique prep markers, template travel connectors, visible check-in alternatives on activity cards, derived prep replacement and visible Needs a time after draft callbacks, card-scoped menu lookup, print disclosure DOM restoration, and dietary personalization retaining the matching curated itinerary. Map preference remains stored and is applied before builder mount. The pre-existing seasonal snapshot assertion is unchanged.

Validation: all 21 Node suites pass; app/test JavaScript syntax and Python test AST checks pass; `git diff --check` passes. The real-builder smoke also checks compact ring restoration after sleep/diet personalization and template route connector counts. Chromium was not launched; supervisor verification is still required. No network, commit, or push.


### Chromium r6 follow-up

- `tests/test_full.py`: wait for visible Trip prep, builder, plan-day or map content rather than the first DOM match; include the visible map so persisted Map reloads can finish. `db_open` now continues through the intentionally added first-visit Trip prep. The print check excludes disclosures whose computed display/visibility or ancestors keep them out of print, retains the positive-height check for each visible disclosure's first non-summary child, and reports failing bodies for diagnosis. No visible itinerary detail assertion was relaxed.
- `tests/test_plan_render.cjs`: drive the real delegated untimed move and scheduling handlers; require a 15:00 Nov 27 conflict naming Black Friday shopping before the schedule changes, then verify Keep both schedules the moved activity. Exercise More menu opening/closing and viewport bounds with measured-rectangle fixtures at 1280 and 390. These are offline handler/geometry checks; they do not claim Chromium layout coverage.

App fixes:
- Apply list/map preference after builder mount through the existing `setMap` path; the default list builder stays visible without `hidden`.
- Exempt personal traveler alternatives from the compact-card rule that hides direct `small` children. Alternatives remain on activity cards outside the collapsed group UI; shared itinerary data is unchanged.
- Route timed transfer/schedule submissions through the existing Replace / Shift / Keep both conflict flow, including items previously moved without a time.
- Position open More menus in viewport coordinates, with clamped bounds and scrollable height, while retaining card ancestry for delegated actions.

Validation: all 21 Node suites pass, including the new transfer and menu checks. App/test JavaScript syntax, all Python test AST syntax, and `git diff --check` pass. Chromium was not launched and remains supervisor-run. The known seasonal snapshot weather assertion is unchanged. No network, commit, or push.

### Chromium r7 follow-up

- `tests/test_move_time.py`: accept the initial 06:00–07:30 move's real overlap with the 07:15 Kewalo ride using Keep both before editing. The original start==360, modal keyboard/Escape, 15:00 shopping-conflict, and subsequent move assertions remain intact.
- `tests/test_full.py`: remove the Nov 27 lunch through its stable source-item selector instead of the positional second detail heading/action. Builder card/detail order makes the old positional expectation obsolete; the scenario still edits a note, removes a different stop, and requires Diamond Head and Kualoa in the calendar. Print the selected date and removed title for supervisor diagnosis.
- `tests/test_plan_render.cjs`: extend the existing real-builder VM coverage for default Nov 26 selection and the full curated timeline, one departure flight/lock, lock button accessible names and badge markup, actual ICS contents after note/removal, print-media-only disclosure opening plus beforeprint idempotence/restoration, solo swap id/title/time/lock persistence through dashboard reopen/remount, shared banner/list/prep Continue without adoption, and measurement only after unhiding the More menu. Add the real anchor top coordinate and TextEncoder/TextDecoder to the offline browser fixture; preserve both viewport bounds and the 15:00 shopping-conflict assertions.

App fixes: print media changes open and restore disclosures; shared links skip
first-visit prep and start in List without adoption; stored plans reopen without
regenerating a different template; saved builder actions retain current traveler
answers; the curated builder defaults to Nov 26, real arrival cards alone receive
arrival metadata, and only the departure anchor becomes a locked flight. Locked
badges and exact Lock time / Unlock time names are restored. Menus are explicitly
unhidden before measurement, flip/clamp within the viewport, and retain card
ancestry. Visible form targets and clipped, fillable raw time inputs have at least
44px bounds. Plan-ready toast waits until the plan is shown.

Validation: all 21 Node suites pass, including actual app-context calendar
removal/note export and persisted solo traveler answers. Syntax checks pass for
39 application/test JavaScript files and 35 Python test files; `git diff --check`
passes. Chromium layout/clickability remains supervisor-run. The known
`snapshot weather is seasonal` failure and its assertion are unchanged. No
Chromium, network, commit, or push was used. Existing untracked Python cache is
left untouched.

### Chromium r8 follow-up

- `tests/test_full.py`: explicitly select Nov 27 before locating and removing lunch (`2026-11-27-2`) for the ICS scenario. The note/removal assertions and Diamond Head/Kualoa requirements remain intact.
- `tests/test_plan_render.cjs`: require the locked La Mer title without pictographs, the locked flight's builder title, the Kahala rest-stop photo, photoless transport details, and adoption with fresh prep storage landing on the plan while preserving the builder schedule.

App fixes: sanitize locked original titles, prefer the flight builder title, keep the two compact ring/group controls at least 44×44px, allow rest-stop photos, and mark Trip prep seen when adopting without regenerating the adopted builder. Header Trip prep remains available.

Validation: all 21 Node suites pass; syntax checks pass for 39 JavaScript and 35 Python files; `git diff --check` passes. Chromium remains supervisor-run. The known `snapshot weather is seasonal` failure is untouched. No network, commit, or push.


- `tests/test_full.py`: when removing a stop before ICS export, pick the first `.item h3` title that is not Diamond Head or Kualoa (instead of the positional second heading or a demo-only lunch-1127 selector). batch_a uses a generated Oahu plan, not the curated demo ids; this still edits a note, removes a different stop, and requires Diamond Head and Kualoa in the calendar.
- `tests/test_full.py`: "print shows details not controls" now ignores `data-testid=plan-day` on `.db-print-day`. Print rendering still strips controls, other test ids, and element ids; the day test id is kept so print-media checks can find each printed day. Details must still be visible and lock/handle controls must stay absent.

## budget-fix

### Chromium r13 follow-up

- `tests/test_budget_fix.js`: explicitly request `templateOahu` for template meal/personalization coverage. Require the curated sample and mismatch notice for non-exact answers, including fork-no with flights unchecked; require Diamond Head/Kualoa and verify explicit template opt-out. Demo options also retain the baseline mismatch rule.
- `tests/check-engine.cjs`: explicitly set `templateOahu` in the template routing/age-rule check.
- `tests/test_styles.js`: non-demo interests now require the curated mismatch notice; adult personalized-template coverage explicitly opts into `templateOahu`. These replace obsolete automatic-template expectations under the restored Oahu rule.

App fixes: all Oahu answers use the curated sample unless `templateOahu` is set, preserving style normalization. At mobile widths, when Needs a time holds pending cards, the activity dock opens in normal page flow so it cannot cover Schedule; search, Close and desktop sidebar styling remain available. Chromium validation stays supervisor-run; seasonal-weather assertions are untouched.

- `tests/check-ui.cjs`: the personalized January template-render scenario explicitly sets `templateOahu`; its dates, meals, requested stop, stay and UI assertions remain intact.
- `tests/check-ui.cjs`: explicitly opted-in Oahu templates already suppress the curated banner photo in `planBanner`; assert that existing behavior instead of the obsolete automatic-template photo expectation.

### Preview polish

- `tests/check-ui.cjs`: walk every trip/local question and compare normalized kicker text with heading, subtitle and budget legend; reject containment and repeated Choose/Pick instruction phrases. Check the labeled pace summary, hotel option row and clear/disable behavior, local rendered provenance/times (including 8:00 AM), and absence of the plan-ready toast on prep and after Continue. Load the real local generator after its diet dependency in the VM fixture.
- `tests/test_budget_fix.js`: exercise the actual note-count and group-pace formatters for singular/plural, two/three travelers and mixed paces; require six distinct style icon paths, none using the sparkle fallback.
- `tests/test_local_mode.js`: require 12-hour times for catalog and generic plans, chronological ordering across noon, and 12:00 PM formatting. No existing expectations removed.
- `tests/test_question_flow.py`: add supervisor-run visible kicker/heading/subtitle/legend comparisons on every step in both modes and require the visible Pace & activities label.
- `tests/test_local_mode.py`: add supervisor-run assertions excluding visible `source:` text and requiring 12-hour result times.
- `tests/test_trip_prep.py`: intentionally update the obsolete bare-count essentials summary to `1 note` / `N notes`. Replace the obsolete day-disclosure collection with an explicit assertion that day disclosures are absent; retain plan-data-to-prep notice coverage and deduplication. Add toast absence checks on prep and after Continue. These expectations changed because preparation now belongs in Trip prep, with explicit quantity grammar.

App fixes: remove day-card Before-you-go disclosures and retain their preparation notices in the existing deduplicated essentials list; move booking, booking-todo and meal-balance reminders to dated Trip prep disclosures. Correct note grammar. Give question kickers independent copy, simplify budget instructions, remove the hotel chip, and place a styled Not sure yet toggle in the options row with the exact hotel label. Render six distinct line icons. Remove local source labels and format/sort local times consistently. Collapse matching traveler paces into Both/Everyone, label the pace summary, suppress the plan-ready toast once prep is seen and clear any lingering ready toast on prep entry. Keep packing quantities inline and reserve fixed-footer/safe-area clearance with heading/legend/option scroll margins.

Validation: all 21 Node suites pass. Chromium, screenshots and real 390×844 / 1280×800 viewport checks remain supervisor-run. The known `snapshot weather is seasonal` failure is untouched. No network, commit or push.

Final offline checks: 21/21 Node suites; `node --check` on 39 JavaScript files; Python AST syntax on 35 files without cache writes; `git diff --check` clean. Existing untracked `tests/__pycache__/` left untouched.

- r15 leftover disclosure assertions: `tests/test_full.py` now reads the visible Trip prep content for the unchanged no-fly / “No flying for 24 h” requirement before continuing to the plan. `tests/test_food.py` opens Trip prep and requires visible dinner-balance in the Nov 26 dated `.prep-day-notes`, retains the banned-language check, then continues to the plan for the remaining day checks. Food-page assertions are unchanged. `tests/test_dayview_simple.py` replaces the removed day-disclosure click with an explicit count-zero assertion and removes its obsolete hidden-body selector; all other simplified day-view checks remain intact. Search outside `baseline-before-merge` found no other stale day-card disclosure expectations.

Validation for the r15 test updates: 21/21 Node suites pass; `node --check` passes on 39 JavaScript files; Python AST syntax passes on 35 files without cache writes; `git diff --check` passes. App behavior and the known `snapshot weather is seasonal` failure are unchanged. Chromium remains supervisor-run. No Chromium, network, commit, or push.

### Preview polish 2

- `tests/check-ui.cjs`: reverse the obsolete hotel-option ordering assertion: `stay-unsure` now follows the stay input. Existing clear/disable coverage remains. Require the slim demo summary (14 notes), dated groups, separate Packing 0/51 progress and no packing `From:` lines.
- `tests/test_budget_fix.js`: add unset pace coverage for one, two and three travelers; preserve matching and mixed pace checks. Exercise the actual prep selector and remaining-count helper for normalized deduplication, dated notes, one no-fly notice, Thanksgiving coverage, compact names and All set while all packing remains unchecked. These are new regression checks.
- `tests/test_trip_prep.py`: replace obsolete all-raw-prep inclusion and packing-inclusive badge expectations with the deduplicated key-action set, a small count (at most 15), dated checklists, no-fly/Thanksgiving coverage, no routine card tips and no packing source lines. Count nested checklist notes in the summary. Complete only real to-dos, verify All set with packing unchecked, and verify those to-do ticks persist after reopening. Packing is intentionally no longer a prerequisite for All set.

App fixes: put the hotel unsure option below its field; exclude packing from live and saved prep counts and recompute dashboard counts instead of trusting old packing-inclusive caches. Keep key booking actions and day-changing safety, normalize/dedupe trip-wide notices, and group actions by date. Preserve existing booking links and dinner-balance disclosures. Show Packing 0/51 separately by What to bring with live tick updates. Remove packing source lines and shorten six packing names without changing ids or quantities. All-unsure traveler groups read “Pace not set yet”.

Expected fresh Oahu demo: **Trip prep · 14 left**, **Before you go · 14 notes**, **Packing 0/51**. Validation: all 21 Node suites, JavaScript syntax (39 files), Python AST syntax (35 files), and `git diff --check`. Chromium/screenshots/audit.py remain supervisor-run. The known seasonal snapshot-weather assertion is untouched. No network, commit or push; existing untracked Python cache left untouched.

### Preview polish 3

- `tests/check-ui.cjs`: replace the obsolete `Packing 0/51` expectation with one `packing-status` line reading `Packed N of 51`; reject `prep-packing-count` and `Packing N/M` headings. Exercise a prep checkbox tick, require `Packed 1 of 51`, preserve the real-to-do badge (`Trip prep · 14 left`), and confirm Reset ticks restores `Packed 0 of 51` and clears packed state.
- App: remove the duplicate What to bring count paragraph and its tick updater; use `Packed N of M` beside the existing progress bar, retaining the completion note on that same line. No Before-you-go note text or high-elevation wrapping changed. Search of tests excluding `baseline-before-merge` found no other old packing-count expectations.

Validation: all 21 Node suites pass; JavaScript syntax passes on 40 files (including the root service worker), Python AST syntax passes on 35 files without cache writes, and `git diff --check` passes. Chromium/screenshots remain supervisor-run. The known `snapshot weather is seasonal` failure is untouched. No Chromium, network, commit or push; existing untracked Python cache left untouched.

### Preview polish 4

- `tests/check-ui.cjs`: require exact-age inputs only (no range buttons/copy), labeled input counts for solo/couple/friends/family, Continue boundaries and real input handlers, Back/Skip, mismatched saved lengths, legacy numeric-string ages and removal of obsolete range keys. Exercise the actual library alcohol restriction with adults, under-21 travelers, age zero and blank ages; the internal library helper is exposed only inside the test VM.
- `tests/check-engine.cjs`: cover solo 30/22, groups 30+20 and 40+38+10, blanks, invalid values and age zero against drinking, young-driver and kids rules.
- `tests/daybuilder_logic.js`: blanks, invalid and missing ages do not create alcohol conflicts. `tests/test_daybuilder_logic.js`: supply exact under-21 ages for the existing alcohol restriction assertion and require no assumed restriction when ages are absent.
- App: remove the range buttons and handlers; normalize saved/imported/shared ages and drop obsolete age band/range/choice keys. Repair input counts on the Ages step while preserving entered values. Apply valid exact ages consistently in engine, app library, DayBuilder and AI matching, preserving the Skip fallback. Hide native number spinners in question fields.

Validation: all 21 Node suites pass; `node --check` passes on 39 JavaScript files; `python3 -m py_compile` passes on 35 Python files with cache redirected to `/tmp`; `git diff --check` passes. Repo search outside `tests/baseline-before-merge` found no obsolete range-button references other than the new negative assertions. No Chromium, network, commit or push. The known `snapshot weather is seasonal` assertion, Before-you-go note text and high-elevation wrapping are untouched. Existing untracked screenshots and Python cache are left untouched.

#### Plan first, then confirm

- Remove the first-plan prep redirect. Questions and the Oahu sample show the itinerary as Draft, with one Confirm plan action and hint. Confirm saves `confirmed=true` and the builder/edits/packed/time/weather snapshot, announces success and focuses the Trip prep heading. The draft editor’s Generate action also confirms; ordinary `rememberTrip()` saves never create a snapshot. Continue returns through normal plan navigation.
- Confirmed plans expose the existing `trip-prep-button`; confirmed dashboard cards add `card-trip-prep` with `data-trip` and saved `prepLeft` (fallback calculation for old records). Saved-trip opening can target prep after generation finishes. Draft cards retain their existing editor actions. Status accepts explicit true or a legacy snapshot; otherwise it remains Draft. Unconfirmed prep navigation, including popstate, resolves to plan.
- Load always selects Home/Your trips rather than restoring screen/hash/active-trip routes (shared trip links retain their existing flow). Legacy migration is guarded; malformed/non-array trip JSON is empty, and invalid list entries lacking an ID are ignored. Missing optional card fields keep their fallbacks. README flow text now documents these choices.
- `tests/check-ui.cjs` and `tests/test_plan_render.cjs`: require plan before confirmation, no implicit snapshot, explicit confirmation/prep, saved confirmation, and independent unconfirmed plans staying on plan. Preserve all Ages checks. `tests/test_budget_fix.js`: exercise actual saved-list parsing against malformed data and explicit/legacy confirmation. `tests/test_dashboard.js`: add strict boolean confirmation, legacy snapshot and date-status cases.
- `tests/test_plan_confirm.py` (new, supervisor port 8850): at 1280/390 cover sample/questions to plan, exclusive confirm/prep buttons, Draft dashboard, draft Generate, confirmation snapshot/seen/focus, header count, card prep navigation, unconfirmed popstate, empty/legacy/malformed storage and missing fields with #prep and no page errors. `tests/test_trip_prep.py` now explicitly confirms before first prep. `tests/test_full.py` shared helpers assert plan first then confirm before prep, covering dependent food tests too; dashboard, smoke and verify-ui explicitly confirm where required. Existing seasonal-weather assertions remain unchanged.

Validation: all 21 Node suites pass; `node --check` passes on 39 JavaScript files; `python3 -m py_compile` passes on 36 Python files with cache redirected to `/tmp`; `git diff --check` passes. Chromium/Playwright remain supervisor-run. No network, commit or push. Existing Ages work, screenshots/cache, known seasonal snapshot-weather failure, high-elevation wrapping and Before-you-go note text are preserved.

#### Planner-enforced rules; Before you go = actions only

Preserves the uncommitted exact Ages inputs and Plan-first / Confirm plan flow. The owner's earlier note-text restriction is lifted for this change. No network, commit, push, Chromium or Playwright execution.

- `js/oahu.js`: Thanksgiving closures for Pearl Harbor, Bishop Museum, Polynesian Cultural Center, Ala Moana Center/shopping and Rainbow Drive-In; curated opening hours for Diamond Head, Kualoa Jurassic Adventure, Aunty Pat's and Black Friday shopping. Reserve rides/shuttle are bookable actions; existing La Mer/Senia reservations are already booked.
- `js/daybuilder.js`: shared `closedOn`, `blockedOn`, `nearestAllowed` and operating-rule helpers. Template generation and reflow exclude blocked stops, retaining them in the unscheduled tray. Add, transfer/move, drag/reorder, custom booking, time edits and conflict shifts validate before applying. Rejections preserve the original and offer an open-day action. Diving uses activity end to flight departure, with exactly 24 hours allowed. Unknown flight times conservatively use departure-day midnight. Generic trips use their own departure date. No parasail/elevation science was added: those existed only as prose, not modeled rules.
- `js/engine.js`: applies the same operating rules before returning generated templates, including requested stops; blocked requests remain unscheduled.
- `js/app.js`: Before you go has only `book`, `id`, `insurance`, `visa` actions, short labels and checkboxes. ID/insurance are omitted for local outings. Actions honor removed/booked items and persisted builder changes; legacy notice ticks cannot affect counts. Dashboard recomputes counts rather than trusting stale `prepLeft`. Informational notices, sources, day groups, tips and demo footer are removed from prep. Existing weather/FX/local information and partner searches remain available in collapsed plan disclosures, outside prep. Live local information initializes only when opened. The known seasonal snapshot-weather assertion and weather classification remain unchanged.
- New testids: `blocked-message`, `blocked-reason`, `blocked-suggest`, `travel-info`, `booking-searches`. Action labels expose `data-action-kind`; existing `prep-item`/`data-prep-id` remain.
- New `tests/test_planner_rules.cjs`: real helpers, engine, mounted add/move handlers, suggestion clicks, time edits, boundary timing, prep actions, legacy ticks and hidden empty prep. Updated prior note/count assertions in Node and Python suites, including affiliate/local-info checks relocated to the plan disclosures.
- New supervisor-only `tests/test_planner_rules.py`, port **8851**, 1280 and 390px: reason/suggestion visibility, successful suggestion add, safe diving, action kinds/lengths/counts, empty section and overflow; PASS/FAIL output. Browser execution remains pending supervisor.

#### Track together vs each person

- Parties of 2+ get preselected `Track together` / `Track each person` radio options on Who’s coming. Solo has no choice; exact Ages remain one input per traveler. Header `track-toggle` changes modes in one tap, re-renders and saves answers plus the saved trip. New testids: `track-choice`, `opt-together`, `opt-each`, `track-toggle`.
- Names, individual pace selectors/rings, group disclosure, person check-in tabs and traveler alternatives require both `track === 'each'` and 2+ travelers. Together uses a shared ring/check-in and shared swaps. Switching retains individual data for switching back.
- Migration: explicit `together`/`each` wins. Missing/invalid track becomes `each` only for a nonblank personal name (excluding old `Traveler N` placeholders), a non-unsure pace different from the first traveler, or nonempty `gonow.checkin.v1` records for `traveler-1` or higher. Otherwise use `together`. Migration reads the small existing check-in map; no expensive schedule reconstruction. Saved-trip opening uses the same normalizer.
- Existing browser per-person tests in `test_pace.py`, `test_checkin.py` and the `test_full.py` group helper now explicitly opt into Each person.

#### No empty sections

Audit findings and fixes:

- Group disclosure repeated `Pace not set yet` below the day pace. Its button now says `Each person`; the day has exactly one pace status/control line.
- Day guidance used regex relocation into the pace disclosure. Removed that relocation: Sleep timing / Suggestions keep their own content and disclosures. The shared `section()` guard omits blank generated guidance; controls count as content.
- Final `pruneEmptySections()` checks h2–h4 and summary sibling bodies, removing empty headings or heading-only disclosures. Runs after plan/prep render and DayBuilder `afterRender`, covering day details, plan and Trip prep, including headings nested in divs.
- Lazy Travel info initially had an empty body. It now has the short placeholder `Open for local details.` until its existing on-open mount fills it.
- `Pace suggestions` becomes `Suggestions`, avoiding a second Pace-prefixed line. Detailed suggestions remain behind a tap. No additional empty guidance/status found in the offline all-days audit of Oahu sample, generated Oahu and Lisbon across solo / 2 together / 2 each / 3 each.
- New `tests/test_track_mode.js`: actual render helpers, default/solo choices, all migration branches, persistence through the actual header handler, section helper and DOM guard, all-day mode/pace/empty-disclosure audit.
- New supervisor-only `tests/test_track_mode.py`, port **8852**, 1280/390: sample and Lisbon, four party/mode fixtures, one-tap toggle, saved answers, per-person UI/check-in tabs, every rendered day expanded and scanned for empty headings/duplicate pace lines, plus plan/Trip prep scans. PASS/FAIL output; not executed here.

Validation: all **23 Node suites pass**. JS/Python syntax and `git diff --check` pass. No browser, network, commit or push. Existing polish-4 work and the known seasonal snapshot-weather failure remain untouched. Browser layout/DOM confirmation is pending supervisor execution.

COPY-AUDIT (each changed or retained flow label → final text):

| String/context | Final text |
|---|---|
| Track option / hint | Track together / One shared plan |
| Track option / hint | Track each person / Per-person check-ins |
| Header tracking toggle | Tracking: Together / Tracking: Each person |
| Individual group disclosure | Each person |
| Day guidance disclosure | Suggestions |
| Lazy travel info body | Open for local details. |
| Ages heading | How old is everyone? / How old are you? |
| Ages legend (screen readers) | Traveler ages |
| Ages subtitle | We check activity age limits. |
| Ages field | Your age / Traveler N age |
| Ages validation | Native number input, 0–110; Continue disabled until valid |
| Plan label / dashboard draft status | Draft |
| Plan confirmation button | Confirm plan |
| Confirmation hint | Confirm to start prep. |
| Finished status | Ready |
| Prep heading | Trip prep |
| Header / dashboard prep button | Trip prep · N left / Trip prep · All set |
| Prep sections | Budget / Before you go · N to do / What to bring |
| Budget disclosure / continue button | Budget breakdown / Continue to my plan |
| Closure reason | Closed Thu, Nov 26 |
| Opening-hours reason | Outside opening hours |
| Dive reason | No diving within 24h of your flight |
| Suggestion button | Add to Fri, Nov 27 (date varies) |
| Successful library add | Added · booking still needed |
| Plan information / search disclosures | Travel info / Booking searches |
| Diamond Head booking | Book Diamond Head |
| Kualoa booking | Book Kualoa Jurassic Adventure |
| Dive booking | Book Intro dive |
| Parasail booking | Book Waikiki parasail |
| Diamond Head transport | Book Uber Reserve to Diamond Head |
| Kailua transport | Book Uber Reserve to Kailua Beach Park |
| Makapuʻu transport | Book Uber Reserve: Makapuʻu → Waikiki |
| Kahala shuttle | Book Kahala shuttle |
| Airport transport | Book Uber Reserve to HNL |
| Domestic / international ID | Bring photo ID / Bring passport |
| Insurance / visa | Consider travel insurance / Check visa rules |
| Generic bookings | Book + activity label; at most 8 words / 48 characters |

Former Before-you-go inventory (all 14 former Oahu checkbox notices, plus informational blocks and generic notices):

| OLD NOTE | Became |
|---|---|
| Thanksgiving closure / Kualoa / Diamond Head / Black Friday hours; dinner clocks | **Enforced rule**: closure/hour data; existing dinner anchors remain |
| No flying for 24 h after diving (trip/item/day duplicates) | **Enforced rule**: hard 24-hour window |
| Book Diamond Head’s 6 AM slot | **Action**: Book Diamond Head |
| Book Kualoa direct / request shuttle pickup | **Action**: Book Kualoa Jurassic Adventure |
| Book Thursday's 5:35 AM Uber Reserve | **Action**: Book Uber Reserve to Diamond Head |
| Reconfirm birthday dinner | **Dropped**: existing reservation is already booked |
| Reconfirm Senia / plan dinner Uber | **Dropped**: existing reservation and travel anchor |
| Reserve Saturday's Kahala shuttle | **Action**: Book Kahala shuttle |
| Dive: Book now / confirm check-in and sizes | **Action**: Book Intro dive |
| No high elevation / same-day parasail | **Dropped**: prose only, no existing modeled rule |
| Book Sunday airport Uber Reserve | **Action**: Book Uber Reserve to HNL |
| Skip wet Pillbox trail / shoes grip | **Dropped**: condition prose, no modeled condition input |
| Parasail conditions / refund policy | **Action**: Book Waikiki parasail |
| Check in online | **Dropped**: outside the owner's four action kinds |
| Per-day booking/meal balance/todo groups | **Action** bookings consolidated; informational groups **dropped** |
| Local tips / sources / demo research footer | **Dropped** from Before you go |
| Typical conditions / weather / local time, voltage, FX | **Dropped** from Before you go; weather/FX/local info retained under plan Travel info |
| Booking searches | **Action**: collapsed Booking searches in plan |
| Generic booking/lead-time notes | **Action**: one Book label per unbooked bookable item |
| Generic age/height/weight, safety, car, opening-hour prose | **Dropped** from prep; existing age blocks and modeled opening rules remain enforced |
| Generic tips / conditions / source lists / template banner | **Dropped** from Before you go |
| New identity / insurance / international entry tasks | **Action**: ID or passport, insurance, visa |

The Oahu sample now starts with **11 actions**: four activities, five reserved rides/shuttle, ID and insurance. Packing remains excluded. Browser checks own the 390px visual fit verification.

Final validation: **22/22 Node suites pass**, **41 JS/CJS syntax checks pass**, **37 Python AST syntax checks pass**, and **git diff --check passes**. Includes a regression proving frozen prep counts ignore later draft builder changes. Browser/390px checks are prepared for the supervisor, not executed here. Existing screenshots/cache and the known seasonal snapshot-weather test remain untouched.

#### Demo day audit

- **Nov 25:** arrival/check-in photos match HNL/Kahala. Arrival stays unknown until a flight time is supplied. No titled-clock mismatch, conflict or blocked stop.
- **Nov 26:** the fresh source and mounted app already produced Diamond Head **6:00–7:30 AM**, locked, with the **5:35–5:50 AM** ride before it. Made its preferred 6 AM start and 90-minute duration explicit alongside the lock. Verified `images/activity-diamond-head.jpg` exists and is credited; Kualoa uses its separate ranch photo. No miss/overlap warnings. The reported 8:15 start/Kualoa photo did not reproduce with default state; no existing test asserted that old time or those warnings.
- **Nov 27:** Kewalo photo matches the dive location; Senia remains locked at 6 PM. No titled-clock mismatch, conflict or blocked stop.
- **Nov 28 — fixed:** `Waikiki Beach sunset with Diamond Head` incorrectly inherited the crater park's 6 AM–6 PM hours and was removed as outside opening hours. Diamond Head's rule now requires the title to start with the park name, in both source-data enrichment and dynamic operating rules. Waikiki sunset remains scheduled with its credited Waikiki sunset image. Lanikai/Makapuʻu photos match their stops. No conflicts or blocked stops.
- **Nov 29:** flight time stays unknown; HNL photo mapping is correct. No titled-clock mismatch, conflict or blocked stop.
- New `tests/test_demo_days.js`: offline real-app DOM harness plus standalone DayBuilder reflow; all five days in Together and Each modes, zero conflicts/notes or blocked stops, every clock-bearing rendered title matches its scheduled start, all mapped photos match expected places and existing files/credits, Diamond Head's lock/start/duration and preceding ride, and retention of Day 4 sunset.
- New supervisor-only `tests/test_demo_days.py`: port **8853**, **1280/390**, Together/Each, Day 2 exact 6:00–7:30 AM display, Diamond Head thumbnail and expanded images, no Kualoa photo or warning elements, no page errors/overflow; PASS/FAIL lines. Added but not run here.

Preserved Ages, Plan-first/Confirm, planner rules, Before you go actions, tracking and empty-section work. No pick-activities or Check-out changes; no network, commit, push or browser execution. The known seasonal snapshot-weather failure is untouched. No new product copy.

Validation: all **24 Node suites pass**; syntax passes for **42 JavaScript** and **39 Python** files (Python cache redirected to `/tmp/gonow-demo-audit-pycache`). `git diff --check` passes. Playwright remains pending supervisor execution.

#### Supervisor run fixes + proofread

- r20 planner rules: replace the contradictory empty Before you go text assertion with Continue to plan and a `Trip prep · All set` header check; Python compilation and `git diff --check` pass, with no Chromium run.
- Read r19 supervisor logs. Updated full-suite assertions for prep’s removed demo footer and hard dive-flight block: unsafe/unknown/early departures retain dives unscheduled, while a late departure schedules the dive. The seasonal snapshot-weather assertion stays untouched.
- Storage cases now navigate through about:blank for a real load. Prep heading layout checks allow the icon-free Before you go summary. Prep-page count checks use that summary; plan-header checks remain after Continue. Chromium tests are edited only, pending supervisor execution.
- Ages gets a question heading, short subtitle, hidden legend and solo label. Tracking choices have their own visible legend and spacing. Confirm plan has a filled primary style; Draft has a muted status style. Header tracking names include Tracking and retain one-tap pressed-state behavior.
- Curated notice and template button shortened. Plan metadata uses actual entered party/ages; explicit sample opening still supplies 18/19.
- Removed the repeated prep-page header button. Four sample Uber Reserve bookings merge into one action with ride details behind a tap: eight sample actions total. Counts persist consistently; legacy ticks migrate only when every underlying ride was checked. Node coverage checks all/partial/no legacy ticks.
- Diamond Head thumbnail and expanded photo use the credited Waikiki silhouette. The crater interior is no longer displayed. Day 4 also uses this image, on a different day; no same-day duplicate. Demo-day and provenance assertions updated.
- Day 2 shuttle arrives 9:10 before the fixed 9:30 tour. The 15-minute stop is explicitly Grab-and-go breakfast, with quick-bite/earlier-breakfast guidance in expanded details. Preserved the Kualoa place lookup to avoid adding a spurious transfer. All five demo days retain zero warnings in both tracking modes.

COPY-AUDIT additions:

| Context | Final text |
|---|---|
| Tracking group legend | How should we track? |
| Curated notice | Curated Oahu demo · not tailored to you |
| Template button | Use my answers instead |
| Merged booking | Book N Uber Reserve rides |
| Ride disclosure | Ride details |
| Dive booking | Book intro dive |
| Quick breakfast | Grab-and-go breakfast |
| Prep count | Before you go · N to do |

Validation: all 24 Node suites pass; syntax checks pass for 42 JavaScript and 39 Python files; git diff --check passes. No browser tests, network, commit or push. All prior uncommitted polish work retained.
