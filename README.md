# GoNow

Open `index.html` directly, or serve this directory with any static HTTP server. Home lists trips saved on this device. Start a trip, shape it in Draft, then Generate my plan to freeze a finished copy. Draft edits do not change that copy until you generate again. Activity search uses the on-device library only. It is not a live worldwide place search. No build, dependencies or API keys are required. Optional weather and exchange-rate calls load when the local info tile opens. Fraunces Variable and Inter Variable are self-hosted in `fonts/` with `font-display: swap`, Georgia/system fallbacks and SIL OFL licenses in each family directory. No font service is contacted. Use `?fast=1` to skip the simulated planning delay.

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
claims: they show “Diet info not confirmed — check the menu”. No ingredients,
allergen safety or restaurant suitability are inferred. `GoNowDiet.match` is pure;
explicitly supported meal suggestions sort first in the activity library, retaining
order otherwise. Free-text food notes are saved for reference, not interpreted as
verified menu facts.

Supervisor browser regressions: `tests/test_pace.py` (8833) and
`tests/test_wellness_questions.py` (8834), each at 1280 and 390 pixels.
Node checks: `node tests/test_rings.js`, `node tests/test_diet.js`.
