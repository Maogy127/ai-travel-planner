# GoNow

Open `index.html` directly, or serve this directory with any static HTTP server. Home lists trips saved on this device. Start a trip and review the plan as a Draft. Confirm plan saves a finished snapshot and opens Trip prep. The draft editor’s Generate my plan also freezes a finished copy. Draft edits do not change that copy until you generate again. Activity search uses the on-device library only. It is not a live worldwide place search. No build, dependencies or API keys are required. Optional weather and exchange-rate calls load when the local info tile opens. Fraunces Variable and Inter Variable are self-hosted in `fonts/` with `font-display: swap`, Georgia/system fallbacks and SIL OFL licenses in each family directory. No font service is contacted. Use `?fast=1` to skip the simulated planning delay.

Files: `index.html`, `css/styles.css`, `js/catalog.js`, `js/oahu.js`, `js/daybuilder.js`, `js/engine.js`, `js/ai.js`, `js/credits.js`, `js/localinfo.js`, `js/affiliates.js`, `js/app.js`, `credits.json` and `images/*.jpg`.

Destination JPGs are real Pexels photos. Activity photos are separate real photographs from Wikimedia Commons, credited with the photographer and license; a stop is left without a picture when no verified photo of that place was available. The island banner is not reused as a photo of a specific venue. `js/credits.js` supplies descriptions and photographer/license links for image overlays and the Photo credits screen; `credits.json` retains the same data.

Oahu uses the supplied Nov 1, 2026 research, with linked sources and the specified 18/19-year-old itinerary. A notice explains when the fixed Oahu demo differs from the answers and offers a personalized template. Other destinations use labeled template guidance and rough climate/cost estimates. There is no live booking. Sharing uses a self-contained URL hash; no server receives the plan. The API integration boundary is documented in `js/ai.js`.

Answers, itinerary changes and packing ticks save separately on this device. Start over clears answers and the last-trip pointer, preserving packing ticks. Reset my edits preserves packing ticks. Local-storage failures leave the open plan usable.

Tests live outside this folder (in the project's `tests/` directory) and are not part of the site.

`window.__gonow` exposes `state` and `go(screen)` for inspection.

Main screen names: `start`, `dates`, `budget`, `who`, `ages`, `style`, `recommendations`, `fork`, `food`, `pace`, `musts`, `plan`, `credits`.

## Saved data

GoNow stores answers, itinerary edits, packing ticks and packing-list items in `localStorage` under `gonow:*` keys. Keys from the site's earlier name are migrated automatically on first load, so saved ticks and edits survive. **Reset my edits** clears itinerary changes only; packing ticks, quantities and added packing items are kept.

## Wellness design

Warm sand and terracotta tokens live at the top of `css/styles.css`. `--accent` is decorative; `--accent-text` supplies accessible text and primary buttons. Sleep uses purple, movement amber, recovery teal. The home and onboarding entry share a native radio pace picker (Not sure by default) and nine activity toggles; preferences and destination save with existing answers. Home destination voice shares the requests recognition, language and unsupported behavior.

Calm progress dots replace the journal stamps. Existing test IDs and the trip lists, question flow, editable schedule, locks, travel connectors, activity tray and exports remain. Display-only concentric rings appear on the sample day and itinerary headers. `js/rings.js` documents the pure `GoNowRings.scoreDay(items, level, nextItems)` estimates: sleep window after the last stop, weighted activity minutes, and explicit recovery blocks. Missing times use documented defaults. These are plan estimates, not medical advice; they do not measure health or change the itinerary.

Oahu facts and photos are unchanged. Its budget uses the supplied activity and transport ranges; unresearched flights, hotel and meals are explicitly identified. All bucket figures are approximate and coverage labels reflect the selected budget scope. Reduced-motion preferences disable animations and the simulated generation delay. `?fast=1` keeps animations under 600 ms without delaying access to the plan.

Run `python3 tests/test_full.py` from the project root. Regression screenshots use the project’s `screenshots/pirate-local-*.png` folder. Tests load local fonts and collect failed requests, page errors and console errors.


## Share and export

The Share & export toolbar prints every day and detail with source URLs and a GoNow credit, downloads an RFC 5545 calendar, or copies a trip link. `window.__gonow.buildICS()` returns the calendar string and `window.__gonow.planText()` returns the copied text. On the Oahu demo, calendar events and the copied text use the day builder's current order and reflowed start and end, including after a reorder and after Relax changes 11/28. Each printed Oahu day starts on a new page with its details open and its move controls hidden. Template events use floating local times or all-day summaries, and end at the next stop or one hour later when no end time is supplied. Calendar times remain suggestions to verify against bookings.

Links contain UTF-8 JSON encoded as base64url (`#trip=j.…`): answers, plan ID and itinerary edits, without packing ticks. Shared copies regenerate locally and keep the recipient’s saved trip intact until **Make it mine**. Links are readable by anyone who has them, including any notes and answers you include. Invalid links show a friendly start screen.

List is the default itinerary view. The Map uses vendored Leaflet 1.9.4 (`vendor/leaflet-1.9.4`, license included) with on-demand OpenStreetMap tiles and visible Leaflet/OSM attribution. The map reads current DayBuilder schedules, groups consecutive activities at the same place, and keeps a text stop list and List day-jump buttons. Prep and travel are omitted as pins, except airport arrivals and departures resolving to HNL. Lines connect stops directly; they are not road routes. `js/geo.js` retains supplied Nominatim-verified coordinates (November 14, 2026), source descriptions and approximate-area flags. Approximate locations are labeled; unknown places are never geocoded or guessed. Missing Leaflet or offline tiles leave the stop list available. Printing keeps the selected map stop list and hides the interactive map. The view preference uses `gonow:view`.

Planning progress uses `gonow:rank`. Each distinct action earns one point per trip: completing each question, finishing a plan, completing all three personalization questions, packing at least half, printing, downloading a calendar, creating a share link and viewing the map. Repeating an action for the same trip earns no additional points. `RANKS` in `js/app.js` defines thresholds: Getting started 0, Settled in 5, Finding your rhythm 10, Traveling well 16. The badge opens earned-action details. Start over preserves rank; storage failures leave the tools usable.

## Weather, money & local info

`js/localinfo.js` holds general guidance for every catalog destination, checked November 2026: IANA timezone, currency, languages, domestic plugs/voltage, hedged tipping guidance and an approximate central coordinate. Costa Rica uses San José; Bali uses Denpasar. These points do not represent itinerary stops. Check official sources before travel. Electrical guidance reference: https://www.worldstandards.eu/electricity/plug-voltage-by-country/.

The plan's **Weather, money & local info** accordion loads optional public data only when opened. Trips entirely within today through today + 15 days request Open-Meteo daily Fahrenheit highs/lows and rain probability. Other dates request the same dates in the previous year from Open-Meteo Archive, explicitly labeled **Last year on these dates (not a forecast)** with average highs/lows. February 29 maps to February 28 in a non-leap year. Historical weather is context for one year, not a climate normal or prediction; unavailable archive dates show the friendly retry state.

Non-USD destinations request Frankfurter's USD reference rate, with a small USD converter. Unsupported currencies or failed requests show **Live rate unavailable**; USD destinations make no FX request. Reference rates are indicative, not transaction quotes. Each live section links its source and shows the fetch time in the viewer's local time plus response data dates. Successful validated responses cache in `sessionStorage` for one hour; storage failures are tolerated. Requests have independent six-second AbortController timeouts. Weather Retry bypasses its cache. Static information works offline and through `file://`; online data is optional and needs no key or backend. Destination time uses `Intl.DateTimeFormat` when the tile renders or opens.

All browser test contexts mock Open-Meteo forecast/archive and Frankfurter before navigation. Success fixtures derive weather dates from request parameters and provide a deterministic 0.9 reference rate; invalid-JSON fixtures exercise failures and retry without browser resource-load errors. Both file and HTTP runs include these checks. Chromium tests must be run in an environment that supports Chromium.


## Partner search links

The **Book this** tile offers Booking.com and Expedia hotel searches and Skyscanner flight searches. Bookable itinerary stops add secondary GetYourGuide and Viator searches using the activity name and destination. Existing official operator sources remain first and unchanged. Searches do not supply prices or availability and make no requests until clicked. Every partner link opens a new tab with `noopener noreferrer sponsored`; partner links are hidden in print while official source URLs remain.

`js/affiliates.js` defines `window.GONOW_AFFILIATES` and the single `gonowPartnerURL` builder. Enrollment is disabled and all IDs are empty, so no affiliate parameters are appended. TODO comments identify placeholders. Only enabling the config and supplying a nonempty ID plus a configured parameter enables attribution; Viator mcid is also empty. Expedia Group Travel Creator Program and Skyscanner parameter names must be configured from actual enrollment details. All template values and attribution values are URL encoded. Skyscanner uses a dated route only with known IATA codes for both ends; otherwise it opens the homepage. The small explicit airport lookup covers LAX and HNL; ambiguous destinations fall back. Verify dates, airports and traveler details on partner sites.

Both file and HTTP regression runs cover the partner domains, destination searches (or flight IATA/homepage fallback), absent attribution parameters, disclosure, link relationships, official Kualoa source and print hiding. They also check that a Costa Rica CRC plan displays **Live rate unavailable** without requesting Frankfurter.

The Oahu sample includes **Build your day**, a separate editable itinerary with a
Activity ideas, fixed bookings and derived travel/preparation blocks. Move handles
support pointer drag and Space/Enter, arrow keys, Escape; move buttons also work
on touch screens. Builder edits save under
`gonow:daybuilder:oahu-demo-2026-11`. Reset to suggested restores the selected day.
Planning estimates and warnings require checking routes and actual reservations.
Run `node tests/daybuilder_logic.js` from the project root for pure scheduling
checks, and `python3 tests/shots_daybuilder.py` for the ten builder screenshots.

In Draft, click a travel time box to edit its departure. Arrival updates from the
travel duration and shows “est.” until you explicitly edit the arrival. Saved
departures reflow following unlocked items; locked bookings stay fixed and any
conflicts show heads-up notes. Prep stays automatic and flights use their own input.
Run `python3 tests/test_travel_time.py` for travel UI and versioned-asset checks
(on its own HTTP port 8817).

Voice input on trip requests uses browser SpeechRecognition (Chrome, Edge or Safari, where supported). It needs microphone permission and may use the browser provider’s network speech service; GoNow adds no speech backend or network requests. English and 中文 language choice saves locally; final transcripts append to the editable requests and interim text stays in the live status. Unsupported browsers keep typing available.

New browser checks: `python3 tests/test_map.py` (port 8821) and `python3 tests/test_voice.py` (port 8822), each covering 1280px and 390px. Map tests mock OSM tiles, including failure cases; voice tests install a mock SpeechRecognition, including unsupported and permission cases. The shared browser helper also fulfills OSM tiles locally. Run these in a Chromium-capable environment.


Wellness checks: `node tests/test_rings.js` verifies pure deterministic estimates and level targets; `node tests/contrast_tokens.cjs` prints and asserts WCAG token ratios. `python3 tests/test_wellness_home.py` (8831) covers home, persistence, voice, local fonts, calm copy and responsive widths; `python3 tests/test_contrast.py` (8832) measures browser text contrast across home, listening, itinerary and map. Browser tests require Chromium and were not run in the restricted sandbox. `TEST-CHANGES.md` records every intentionally updated existing assertion.

Wellness details: the home pace is the trip default; each day can keep it or select
Gentle, Active or Athlete. Targets live only in `js/rings.js` (`LEVEL_GOALS`).
Group trips show equally weighted traveler rings and editable names/paces; activities
remain shared. Day overrides, travelers, optional sleep times and food preferences
are stored in the trip's answers in the existing `gonow:` localStorage family.
Optional bedtime/wake times constrain the planned sleep window using 45 minutes of
wind-down after the final stop and 30 minutes of preparation before the next day's
first stop. A bedtime also shows a marker 45 minutes earlier. Blank times retain
the existing estimates and show no marker.

Diet labels use only dedicated `tags` values or explicit “vegan options”,
“vegetarian menu” (and equivalent selected-diet meals/dishes) wording in an item's
own `title`/`desc`. A generated title repeating the user's cuisine choice is not
confirmation. The current Oahu/catalog/engine meals contain no such dietary
claims: they show no diet tags. Tags appear only with confirmed data. No ingredients,
allergen safety or restaurant suitability are inferred. `GoNowDiet.match` is pure;
explicitly supported meal suggestions sort first in the activity library, retaining
order otherwise. Free-text food notes are saved for reference, not interpreted as
verified menu facts.

Supervisor browser regressions: `tests/test_pace.py` (8833) and
`tests/test_wellness_questions.py` (8834), each at 1280 and 390 pixels.
Node checks: `node tests/test_rings.js`, `node tests/test_diet.js`.

## v2 preview

Home controls put pace first, activity chips second, and destination/voice/language
and Start planning last. The optional pace question uses the same four choices;
`normalizePace` alone derives legacy engine pace (Gentle → Easy, Active → Moderate,
Athlete → Full-on, Not sure → Moderate). Saved answers without level migrate
Easy → Gentle, Moderate → Active, Full-on → Athlete. Sleep remains optional.

Ring estimates count only explicit wellness metadata or conservative title/description
keywords. Travel, prep, meal and stay blocks never count. Generic tours, vehicle
sightseeing, shopping, photos and free time count zero; incidental walking in a
photo/tour description is not a movement session. Walk/stroll weight 0.5;
hike, swim, surf, cycle/bike, class, yoga, pilates, easy run/jog weight 1;
tempo/interval run, strength/gym/weights and steep hike weight 1.5.
Movement credit is duration × weight capped at 90 minutes per block.
Spa, massage, stretch, meditation, breathwork, nap and sauna credit duration capped
at 60 minutes; pool/beach downtime is capped at 30 minutes. Kind alone supplies
no wellness credit. Oahu source-backed wellness metadata survives DayBuilder copies.
Diamond Head is a 1.0 hike (stairs/tunnels, about 1.5 hours); steep Lanikai Pillbox
is 1.5; the paved Makapuʻu walk is 0.5. Each ring set has a tap/keyboard breakdown.

Actual DayBuilder Nov 26: Movement **150 → 90 minutes**, Recovery **120 → 30 minutes**.
Diamond Head 90 × 1 = 90 (block cap 90); Kualoa safari truck, transfers, meals,
prep and sunset photos = 0. Kahala pool/beach downtime 120 → cap 30.
Sleep stays **8 h 15 m**. `tests/test_rings.js` computes this from the actual reflowed
DayBuilder items and next day, and tests caps. `tests/test_ring_breakdown.py` uses
port 8835 at 1280 and 390 pixels for click and Enter behavior.

DayBuilder cards keep time editing, thumbnails, lock state and lock toggles visible.
More holds drag/reorder/archive/copy/move-day actions, with native keyboard opening,
arrow navigation, Escape focus return, Tab dismissal and outside-click dismissal.
The drag handle retains pointer and Space/arrow/Space reordering. Browser layout,
coarse targets and interactions need supervisor verification; Playwright was not
run in this sandbox. Existing assertion/interaction edits are listed in TEST-CHANGES.md.

Morning check-ins are optional, device-local records in
`gonow.checkin.v1`: date → stable traveler index ID → record.
Done or skipped check-ins collapse to one line and never prompt again. Voice input
uses the browser's existing Web Speech service, with English and Chinese parsing;
recognition availability and microphone permission depend on the browser.

Day ring goal precedence: an explicit day pace overrides every traveler's trip
pace for that day. “Same as trip” uses each traveler's own pace. Then that
traveler's low energy, some/a lot of soreness, or poor sleep multiplies the
movement goal by **0.6**, adds **15 minutes** to recovery, and leaves sleep
unchanged. These are planning estimates, not medical advice. Skipped check-ins
leave goals unchanged. Suggestions require an explicit Swap/Add; Keep plan/No
thanks dismisses them persistently. Locks are always preserved. Solo swaps use
DayBuilder's persisted update path; group swaps store a personal alternative,
show it on the card, and score it for that traveler without editing the shared
schedule. High energy offers a 30-minute optional run if soreness and poor sleep
are absent.

## Question flow

Trip mode: Home asks mode, pace, activities and destination. The next screen asks origin and summarizes the destination with an Edit link back to Home; it does not repeat pace or activities. The eight detail pages are: (1) dates, (2) total budget and covers, (3) who, (4) ages, (5) trip styles, then the personalization choice, (6) food, (7) Your days: pace/activity summary with optional inline Edit and sleep times, (8) musts and stay. Skip records the existing defaults; the quick-plan branch can skip the three optional personalization pages. Step/Page counters and passport stamps use this actual eight-page list.

Out in my city: Home asks mode, pace, activities, city and half/full/weekend length. Three remaining pages ask (1) trip styles/interests, (2) food, (3) Your days: summary/Edit and optional sleep, then the local plan. Dates, flights/origin, lodging, hotel budget, who/ages and trip musts/stay are omitted: this mode creates flexible nearby ideas rather than bookings or age-gated travel arrangements. Local Step/Page counters and stamps use these three pages. Pace and activities have one source of truth (`answers.level` and `answers.activities`); editing the summary updates the same Home controls.

Food is one page with exactly two groups: “Any dietary needs?” (`dietNeeds`, `allergens`, conditional `allergyOther`, `dietNotes`) and “What do you love to eat?” (`foodLoves`). Empty selections mean none; no exclusive “none” chip is needed. Current keys are display labels (for example `Vegan`, `Shellfish`, `High protein`).

`GoNowDiet.migrate` in `js/diet.js` runs when loading saved answers, opening saved trips/shared links, saving, and before generation. Legacy `food` Vegetarian/Vegan/Halal/Gluten-free and `diet` Vegetarian/Vegan/Gluten-free/Dairy-free map to `dietNeeds`. Legacy `food` Local classics/Seafood/Street food / casual/Fine dining and `diet` High protein/Low carb map to `foodLoves`; Coffee & bakeries maps to Healthy cafés & bowls. No preference/No restrictions are dropped. English nut/peanut/tree nut and Chinese 坚果/花生 map to allergen Nuts; shellfish/shrimp/crab/lobster and 贝/虾/蟹 map to Shellfish. Remaining allergy text becomes `allergyOther` and selects Other. Arrays dedupe. Existing new-schema arrays are authoritative, so clearing a selection cannot resurrect old answers. Old keys can remain in stored payloads but only the migration helper reads them.

Meal constraints use explicit venue title/description/tags. Explicit conflicts are excluded from suggestion lists or replaced with “A place that fits your needs”; booked, locked and requested meals remain with a menu-check warning. Unknown venues show “Check the menu”; positive dietary tags require evidence for every selected need. Soft food loves boost ordering only. Fine dining stays welcome, with a gentle day-level lunch/stroll note when the day's data identifies a tasting menu, fine dining or La Mer.

Food/flow test hooks: `food-chip` (`data-key`, `data-value`, `aria-pressed`), `allergy-other`, `diet-notes`, `diet-tag`, `dinner-balance`, `pace-summary`, `pace-summary-edit` (`aria-expanded`, `aria-controls="pace-inline"`), existing `pace-option`/`activity-chip` in the editor, and `data-topic` on question groups. Supervisor Chromium suites: `tests/test_food.py` port 8840; `tests/test_question_flow.py` port 8841, both at 1280/390. Node: `node tests/test_food.js`. No additional JS asset was introduced; the existing versioned `diet.js` remains in index.html, so the asset count stays 19.

### Ring estimates: home sleep and local time

The assumed home schedule is 22:30–06:30; users can edit it or clear both
fields for the original itinerary-only estimates. The shared time picker uses
visible editable `type=text` HH:MM inputs (the existing testids and names), plus
a complete 12-hour display button. Every native time input, including dynamic
booking, flight, schedule, move/copy and activity editors, is enhanced by the
same observer. Form input/change events and optional empty values are retained.
Picker choices use full HH:MM values. Date fields are unchanged.

`js/jetlag.js` maps unambiguous LA/LAX, SF/SFO, Seattle/SEA, New York/JFK/EWR/LGA,
Honolulu/HNL/Oahu, Chicago/ORD, London/LHR, Tokyo/NRT/HND and Shanghai/Beijing
origins to IANA zones; unknown origins assume America/Los_Angeles. Catalog
entries have explicit real IANA `tz` and central-area `center` fields.
Intl supplies each trip date's offset, including DST. LA→Oahu in November is
−120 minutes: Day 1 **20:30/04:30**, Day 2 **21:30/05:30**, Day 3 onward
**22:30/06:30**. July starts −180 minutes and aligns on Day 4. Each day moves
60 minutes toward the home clock schedule expressed in destination local time.
Eastbound or shifts of at least three hours suggest extra rest on Day 1.
City mode has no adjustment. All recommendations leave the shared itinerary
and locks intact; late locked dinners get a nap suggestion.

The day-head sleep ring describes the **preceding night**, not tonight. It uses
last night's final scheduled end (a proxy for getting back), plus 45 minutes
of wind-down, or the adjusted usual bedtime, whichever is later. Sleep ends at
the earlier of adjusted wake time and today's first departure minus 30 minutes
of preparation. The resulting window is clamped to 0–10 hours. Jet lag shifts
the preference window once; it is never subtracted again. With no prior day,
the usual bedtime supplies the estimate. An untimed flight uses the usual wake
preference (08:00 without preferences). Return times are schedule estimates.

The earlier 8h15 Day 2 value used Day 2's evening and Day 3's morning, without
sleep preferences. The reported 5h45 is not reproducible in the clean sample;
saved schedule changes can shorten the window. Corrected Day 2 is **7h30**:
Nov 25 dinner ends 20:50, wind-down ends 21:35 (later than adjusted bedtime
21:30), and the 05:35 Uber imposes a 05:05 cutoff (earlier than adjusted 05:30).
The nudge triggers strictly below 85% of goal **or** more than 60 minutes short.
Thus 6h50 of 8h triggers by the hour rule, while 7h00 does not. Keep plan is
saved per date. Suggestions require review; reserved slots remain fixed.

Clearly planned on-foot browsing at Ala Moana and the Royal Hawaiian/International
Market Place now has explicit walk metadata. Walk/wander/stroll credit is ×0.5,
capped at **60 credited minutes per block**; other movement caps at 90, recovery
at 60, pool/beach downtime at 30. Transport, meals, generic free time, vehicle
tours, parasail and diving/snorkeling without explicit swimming stay excluded.
Day 2 movement/recovery remain **90/30**.

These are the actual reflowed Oahu DayBuilder results with the assumed home sleep:

| Day | Sleep | Move | Recover |
| --- | --- | --- | --- |
| Nov 25 | 8h00 | 0 min | 0 min |
| Nov 26 | 7h30 | 90 min | 30 min |
| Nov 27 | 8h00 | 60 min | 0 min |
| Nov 28 | 6h10 | 142.5 min | 0 min |
| Nov 29 | 8h00 | 0 min | 0 min |

The earlier Day 2 8h15 statement above describes itinerary-only scoring.
Hotel uncertainty uses the catalog center (Oahu: Waikiki), never a fabricated
hotel. Adding/editing a hotel updates stay references and recomputes connectors
through DayBuilder's travel calculation, preserving locked start/end values.

For screenshots and local testing, `?today=2026-11-26` overrides the destination's
local date for the morning check-in. This query parameter is read once on page
load and must be a real ISO calendar date. Without it, `Intl.DateTimeFormat` uses
the destination catalog's IANA time zone (Oahu: `Pacific/Honolulu`). Check-ins
appear only in the plan on that date, directly below the day heading.

Changing a scheduled time preserves `originalTitle` for snapshots/export and
removes trailing time labels: an em/en dash followed by `H[:MM] AM/PM` and its
suffix, or a trailing `H[:MM] AM/PM [entry] slot`. A trailing dashed `sunrise` or
`sunset [photos]` label is removed only when the old clock matches that period
(before 10 AM or after 4 PM). Place names such as Sunset Beach remain intact.

### Simple days and Trip prep (budget-fix)

Questions and the Oahu sample open the **plan first**, marked Draft until confirmed.
**Confirm plan** saves a finished snapshot and opens **Trip prep**. Its three sections are
**Budget**, **Before you go**, and **What to bring**; none is rendered below the
itinerary. Continue focuses the plan heading. The compact header button reopens
prep and reports unchecked prep items. `gonow.prep.v1` stores each trip's `seen`
flag and checkbox map. Packing ticks also synchronize with the existing packing
store and activity checklists. Opening prep marks it seen. Confirmed trips can reopen prep from the plan header
or dashboard card. Loads always open Home or Your trips, ignoring stale screen/hash
routes; malformed trip lists are treated as empty and legacy migration is guarded. Drafts retain their existing editing flow.

Each item's home follows its scope:

- **Prep / Budget:** total/cost summary, the five budget buckets, inclusion status,
  researched cost details and source links.
- **Prep / Before you go:** trip-wide age rules and notices, hotel/flight booking
  searches and their disclosure, typical weather and its sources, local time,
  currency, language, plugs, tipping, weather/FX data and retry controls. Repeated
  notices are normalized and deduplicated. A flag already attached to a day's
  notes or activity stays there; a flag naming a trip date goes to that date.
- **Prep / What to bring:** the full grouped packing checklist, tick status,
  quantities, custom items, hide-packed and reset controls. Activity packing
  checklists remain synchronized shortcuts to these same packing items.
- **Day / collapsed Before you go:** that day's advance reservations, transport
  notes, booking to-dos and meal-balance suggestion. In the Oahu sample, Nov 25
  keeps Diamond Head/Kualoa/Uber Reserve bookings and dinner reconfirmation;
  Nov 26 keeps Thanksgiving closures/hours, the pre-dive reminder and Senia
  reconfirmation; Nov 27 keeps the next night's shuttle reservation; Nov 28
  keeps the airport ride reservation; Nov 29 keeps the dive-to-flight interval,
  online check-in and agricultural inspection. The dive-to-flight warning is
  removed from trip-wide prep because Nov 29 already owns it.
- **Day / info disclosure:** accommodation, rental-car status and typical
  conditions. Detailed transport instructions stay with their activity.
- **Food tile removed:** its meal stops already exist as chronological cards;
  the unique dinner-balance suggestion is in the day's notes.
- **Getting around tile removed:** each day's car/transport note is in that day's
  notes; route/travel connectors remain between activities.

The day ring is one small clickable summary. `ring-breakdown-toggle` and
`ring-breakdown` remain the disclosure hooks. `day-pace-link` reveals `day-pace`
and `day-pace-option`; `group-toggle` reveals group rows; `day-info` reveals
chips. `day-add` opens the add panel, retaining `db-tray-toggle`, `db-tray`,
`db-booking-toggle` and the booking form. Relax/rain/custom-item controls remain
under Day options. Sleep timing and pace suggestions are disclosures; only a
short-night prompt, a conflict, or today's check-in appears as an actionable
prompt by default. `?today=YYYY-MM-DD` continues to control test check-in dates.

Supervisor browser suites: `tests/test_dayview_simple.py` (8847) and
`tests/test_trip_prep.py` (8848), each at 1280 and 390 pixels. This work retains
`?v=20de649-budgetfix`; no commit or push is required.

Returning visitors with saved trips now land on **Your trips**, including on
reload of `#plan` / `#prep`. First visits keep the original home screen. `+ New
trip` opens that flow with a Your trips back button and the Oahu sample.

Dashboard status uses destination-local calendar dates from `Intl` (catalog
IANA time zone; UTC for unknown destinations). Trips are Draft until `confirmed === true` or a legacy finished snapshot exists. A finished trip whose start is in the future is Upcoming · N days;
start through end inclusive is In progress; otherwise it is Ready, including
undated and ended plans. A valid `?today=YYYY-MM-DD` overrides that calendar
date and treats next-activity selection as midnight; invalid dates are ignored.
The Today block includes date, theme, ring values and the next scheduled start
at or after destination-local current time.

`gonow:trips` remains the single trip list. Existing lists are retained; the
legacy `gonow:answers` / `gonow:lastTrip` pair is migrated only when no list
exists. An empty list is authoritative, preventing deleted trips from returning.
The existing `wayfare:` key migration also runs before reading trips. Records
retain answers, finished snapshot, plan, time zone, prep count and per-trip
builder/edit/packing archives. The active trip's existing storage keys remain
compatible; switching restores the selected trip's archive. Prep seen/tick
state stays in `gonow.prep.v1`, keyed by saved trip ID. Opening a plan always shows the itinerary; Trip prep opens only through an explicit action. Shared links retain their separate view flow.

Dashboard hooks: `dashboard`, `new-trip`, `trip-card`, `trip-status`,
`today-block`, `back-dashboard`. Card titles open live plans or drafts. The
More disclosure provides Open (finished snapshot when available), Edit draft,
and Delete, with `view-finished`, `edit-draft`, `delete-trip` hooks. Delete uses
a native modal `alertdialog`, focuses Cancel, restores focus on dismissal and
moves focus to the remaining screen heading after deletion.

Transport/flight cards have compact inline plane/car/bus/shuttle SVGs and no
photos; activities, meals and sights retain their verified photos. Day 1 and
Day 5 use `add-flight-time` buttons to open the GoNow time picker. The existing
`db-flight-time` value hook is retained as a hidden HH:MM input. Arrival time
is saved on its day item; departure time retains the existing flight-time
storage and safety checks. Both buttons show a complete selected time and Edit.

Supervisor browser suites: `tests/test_dashboard.py` (8849) and
`tests/test_transport_cards.py` (8850), at 1280 and 390 pixels. Pure dashboard
status/date tests run with `node tests/test_dashboard.js`. Assets retain
`?v=20de649-budgetfix`.
