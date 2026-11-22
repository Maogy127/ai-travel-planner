# Pre-warmed city place snapshots

Versioned, statically hosted place catalogs for popular travel cities. GoNow loads `js/city-index.js`, then lazy-loads one `data/cities/<slug>.json` file when someone plans that city.

- Source: OpenStreetMap (ODbL, © OpenStreetMap contributors) plus Wikidata (CC0).
- The app never calls Google Places to build these files.
- Live Overpass / Nominatim remain the fallback for unknown cities, and for a hotel-centred lookup when the live request succeeds.
- Rebuild with `python3 tools/extract-city-pois.py` followed by `node tools/prewarm-cities.cjs --no-overpass`.
