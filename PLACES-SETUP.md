# Google Places setup (GoNow any-city picks)

GoNow calls **Places API (New) Text Search** straight from the browser for any city without a curated catalog. It makes two searches per city ("top sights and things to do in X" and "popular restaurants and cafes in X"), returns 20 results each, and caches the result for 1 day on the device. If the key is missing, refused or slow, the app falls back to OpenStreetMap (Overpass). It waits about 8 s per server, fails fast and shows "Couldn’t load places nearby. Try again or plan without picks."

The key lives in `js/places-config.js`:

```js
window.GONOW_PLACES_CONFIG = { GOOGLE_PLACES_KEY: '…' };
```

Leave it empty (`''`) to use OpenStreetMap only. This is a **browser key**, so every visitor can see it. Its safety comes from the restrictions below, not from hiding it.

## 1. Enable the API
1. Google Cloud console → pick the project (this preview uses `gonow-8e9e8`).
2. APIs & Services → Library → **Places API (New)** → Enable. The legacy "Places API" is not needed.
3. Billing must be on for the project.

## 2. Create and restrict the key
APIs & Services → Credentials → Create credentials → API key, then Edit:
- **Application restrictions → Websites (HTTP referrers):**
  - `https://maogy127.github.io/*`
  - `https://raw.githack.com/*`
  - Optional, for local testing: `http://localhost/*` and `http://127.0.0.1/*`. Remove these for production.
- **API restrictions → Restrict key → Places API (New) only.**

## 3. Cap the cost
- APIs & Services → Places API (New) → **Quotas**:
  - Set a daily cap on "Text Search requests per day", e.g. 300/day, which is about 150 city loads.
  - Also cap "Place Photo requests per day", e.g. 3000/day. Cards load photos lazily at 480 px.
- Billing → **Budgets & alerts** → create a budget for the project, e.g. $20/month, with email alerts at 50%, 90% and 100%.

## What a city load costs
- Field mask, the only fields requested:
  - `places.id, displayName, location, primaryType, types, formattedAddress, googleMapsUri`
  - `photos.name, photos.authorAttributions`
  - `rating, userRatingCount`
  - `regularOpeningHours.periods, regularOpeningHours.weekdayDescriptions`
- Rating and opening hours put Text Search on the **Enterprise** SKU. No reviews, website, phone or price are requested.
- Each new city costs 2 Text Search calls plus the photos actually scrolled into view. Reloads and Swap/Edit picks reuse the cache: 1 day on the device. A lean copy without photos, address, rating or hours text is kept for at most 30 days for saved trips.
- To cut cost further, drop `rating`, `userRatingCount` and `regularOpeningHours.*` from `FIELDS` in `js/placesource.js`. That moves Text Search to the cheaper Pro SKU, and cards then show the category and an estimated duration instead.

## Attribution
- Pick lists show "Places data © Google Maps".
- Place details show the photo author from `authorAttributions`.
- Keep both if you change the UI.

## Rotating the key
1. Create a new restricted key.
2. Paste it into `js/places-config.js`.
3. Bump the cache tag in `index.html` and push.
4. Delete the old key.
