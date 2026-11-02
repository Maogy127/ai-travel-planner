# GoNow

Open `index.html` directly, or serve this directory with any static HTTP server. No build, dependencies, API keys or network data calls are required. Google Fonts supplies Playfair Display and DM Sans when online; system fallbacks keep the site usable offline. Use `?fast=1` to skip the simulated planning delay.

Files: `index.html`, `css/styles.css`, `js/catalog.js`, `js/oahu.js`, `js/engine.js`, `js/ai.js`, `js/credits.js`, `js/app.js`, `credits.json` and `images/*.jpg`.

The 12 JPGs are real Pexels photos. `js/credits.js` supplies descriptions and photographer/license links for image overlays and the Photo credits screen; `credits.json` retains the same data.

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

The Share & export toolbar prints every day and detail with source URLs and a GoNow stamp, downloads an RFC 5545 calendar, or copies a trip link. `window.__gonow.buildICS()` returns the calendar string. Oahu events use Pacific/Honolulu (fixed HST); template events use floating local times or all-day summaries. Where no end time is supplied, timed events end at the next stop or one hour later. Calendar times remain suggestions to verify against bookings.

Links contain UTF-8 JSON encoded as base64url (`#trip=j.…`): answers, plan ID and itinerary edits, without packing ticks. Shared copies regenerate locally and keep the recipient’s saved trip intact until **Make it mine**. Links are readable by anyone who has them, including any notes and answers you include. Invalid links show a friendly start screen.

List is the default itinerary view. The illustrative SVG treasure route has keyboard-operable day buttons and a text day list; it is not geography or to scale. The view preference uses `gonow:view`.

Explorer rank uses `gonow:rank`. Each distinct action earns one point per trip: completing each question, finishing a plan, completing all three personalization questions, packing at least half, printing, downloading a calendar, creating a share link and viewing the map. Repeating an action for the same trip earns no additional points. `RANKS` in `js/app.js` defines thresholds: Deckhand 0, Navigator 5, First Mate 10, Captain 16. The badge opens earned-action details. Start over preserves rank; storage failures leave the tools usable.
