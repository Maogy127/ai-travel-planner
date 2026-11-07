# GoNow

Open `index.html` directly, or serve this directory with any static HTTP server. Home lists trips saved on this device. Start a trip, shape it in Draft, then Generate my plan to freeze a finished copy. Draft edits do not change that copy until you generate again. Activity search uses the on-device library only. It is not a live worldwide place search. No build, dependencies or API keys are required. Optional weather and exchange-rate calls load when the local info tile opens. Google Fonts supplies Playfair Display and DM Sans when online; system fallbacks keep the site usable offline. Use `?fast=1` to skip the simulated planning delay.

Files: `index.html`, `css/styles.css`, `js/catalog.js`, `js/oahu.js`, `js/daybuilder.js`, `js/engine.js`, `js/ai.js`, `js/credits.js`, `js/localinfo.js`, `js/affiliates.js`, `js/app.js`, `credits.json` and `images/*.jpg`.

Destination JPGs are real Pexels photos. Activity photos are separate real photographs from Wikimedia Commons, credited with the photographer and license; a stop is left without a picture when no verified photo of that place was available. The island banner is not reused as a photo of a specific venue. `js/credits.js` supplies descriptions and photographer/license links for image overlays and the Photo credits screen; `credits.json` retains the same data.

Oahu uses the supplied Nov 1, 2026 research, with linked sources and the specified 18/19-year-old itinerary. A notice explains when the fixed Oahu demo differs from the answers and offers a personalized template. Other destinations use labeled template guidance and rough climate/cost estimates. There is no live booking. Sharing uses a self-contained URL hash; no server receives the plan. The API integration boundary is documented in `js/ai.js`.

Answers, itinerary changes and packing ticks save separately on this device. Start over clears answers and the last-trip pointer, preserving packing ticks. Reset my edits preserves packing ticks. Local-storage failures leave the open plan usable.

Tests live outside this folder (in the project's `tests/` directory) and are not part of the site.

`window.__gonow` exposes `state` and `go(screen)` for inspection.

Main screen names: `start`, `dates`, `budget`, `who`, `ages`, `style`, `recommendations`, `fork`, `food`, `pace`, `musts`, `plan`, `credits`.

## Saved data

GoNow stores answers, itinerary edits, packing ticks and packing-list items in `localStorage` under `gonow:*` keys. Keys from the site's earlier name are migrated automatically on first load, so saved ticks and edits survive. **Reset my edits** clears itinerary changes only; packing ticks, quantities and added packing items are kept.

## Pirate Explorer interface

Onboarding is a parchment journal with a compass guide, page turns, selected-answer stamps, a stamp passport and pinned answers. Budget coverage defaults to all five categories and saves in `answers.covers`. The plan opens with a brief treasure-map reveal, then uses an accessible single-open accordion for days, budget, trip essentials, food, transport, packing guidance and booking reminders. Native buttons support Enter and Space; day navigation opens the corresponding tile.

Oahu facts and photos are unchanged. Its budget uses the supplied activity and transport ranges; unresearched flights, hotel and meals are explicitly identified. All bucket figures are approximate and coverage labels reflect the selected budget scope. Reduced-motion preferences disable animations and the simulated generation delay. `?fast=1` keeps animations under 600 ms without delaying access to the plan.

Run `python3 tests/test_full.py` from the project root. Regression screenshots use the project’s `screenshots/pirate-local-*.png` folder. Tests fulfill the optional Google Fonts stylesheet with empty CSS for deterministic offline/fallback testing and collect every failed request, page error and console error.


## Share, export and explorer tools

The Share & export toolbar prints every day and detail with source URLs and a GoNow stamp, downloads an RFC 5545 calendar, or copies a trip link. `window.__gonow.buildICS()` returns the calendar string and `window.__gonow.planText()` returns the copied text. On the Oahu demo, calendar events and the copied text use the day builder's current order and reflowed start and end, including after a reorder and after Relax changes 11/28. Each printed Oahu day starts on a new page with its details open and its move controls hidden. Template events use floating local times or all-day summaries, and end at the next stop or one hour later when no end time is supplied. Calendar times remain suggestions to verify against bookings.

Links contain UTF-8 JSON encoded as base64url (`#trip=j.…`): answers, plan ID and itinerary edits, without packing ticks. Shared copies regenerate locally and keep the recipient’s saved trip intact until **Make it mine**. Links are readable by anyone who has them, including any notes and answers you include. Invalid links show a friendly start screen.

List is the default itinerary view. The illustrative SVG treasure route has keyboard-operable day buttons and a text day list; it is not geography or to scale. The view preference uses `gonow:view`.

Explorer rank uses `gonow:rank`. Each distinct action earns one point per trip: completing each question, finishing a plan, completing all three personalization questions, packing at least half, printing, downloading a calendar, creating a share link and viewing the map. Repeating an action for the same trip earns no additional points. `RANKS` in `js/app.js` defines thresholds: Deckhand 0, Navigator 5, First Mate 10, Captain 16. The badge opens earned-action details. Start over preserves rank; storage failures leave the tools usable.

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
Treasure chest, fixed bookings and derived travel/preparation blocks. Move handles
support pointer drag and Space/Enter, arrow keys, Escape; move buttons also work
on touch screens. Builder edits save under
`gonow:daybuilder:oahu-demo-2026-11`. Reset to suggested restores the selected day.
Planning estimates and warnings require checking routes and actual reservations.
Run `node tests/daybuilder_logic.js` from the project root for pure scheduling
checks, and `python3 tests/shots_daybuilder.py` for the ten builder screenshots.
