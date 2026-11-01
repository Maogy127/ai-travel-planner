# Wayfare

Open `index.html` directly, or serve this directory with any static HTTP server. No build, dependencies, API keys, network data calls or external assets are required. Use `?fast=1` to skip the simulated planning delay.

Files: `index.html`, `css/styles.css`, `js/catalog.js`, `js/oahu.js`, `js/engine.js`, `js/ai.js`, `js/credits.js`, `js/app.js`, `credits.json` and `images/*.jpg`.

The 12 JPGs are real Pexels photos. `js/credits.js` supplies descriptions and photographer/license links for image overlays and the Photo credits screen; `credits.json` retains the same data.

Oahu uses the supplied Nov 1, 2026 research, with linked sources and the specified 18/19-year-old itinerary. A notice explains when the fixed Oahu demo differs from the answers and offers a personalized template. Other destinations use labeled template guidance and rough climate/cost estimates. There is no live booking or sharing. The API integration boundary is documented in `js/ai.js`.

Answers, itinerary changes and packing ticks save separately on this device. Start over clears answers and the last-trip pointer, preserving packing ticks. Reset my edits preserves packing ticks. Local-storage failures leave the open plan usable.

Tests live outside this folder (in the project's `tests/` directory) and are not part of the site.

`window.__wayfare` exposes `state` and `go(screen)` for inspection.

Main screen names: `start`, `dates`, `budget`, `who`, `ages`, `style`, `recommendations`, `fork`, `food`, `pace`, `musts`, `plan`, `credits`.
