#!/usr/bin/env python3
"""Download free OSM city/region extracts and emit Overpass-shaped POI JSON."""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

import osmium

ROOT = Path(__file__).resolve().parent.parent
# City list lives in the Node prewarm script; keep a copy of slug/center/radius here.
sys.path.insert(0, str(Path(__file__).parent))

RAW = Path(os.environ.get('PREWARM_RAW', '/tmp/gonow-prewarm-raw'))
PBF = Path(os.environ.get('PREWARM_PBF', '/tmp/gonow-pbf'))
UA = 'GoNow-prewarm/1.0 (https://github.com/Maogy127/ai-travel-planner; gonow-preview@users.noreply.github.com)'

# Shared regional extracts, then per-city BBBike extracts.
EXTRACTS = {
    'hawaii': 'https://download.geofabrik.de/north-america/us/hawaii/hawaii-latest.osm.pbf',
    'nevada': 'https://download.geofabrik.de/north-america/us/nevada/nevada-latest.osm.pbf',
    'massachusetts': 'https://download.geofabrik.de/north-america/us/massachusetts/massachusetts-latest.osm.pbf',
    'arizona': 'https://download.geofabrik.de/north-america/us/arizona/arizona-latest.osm.pbf',
    'tennessee': 'https://download.geofabrik.de/north-america/us/tennessee/tennessee-latest.osm.pbf',
    'california': 'https://download.geofabrik.de/north-america/us/california/california-latest.osm.pbf',
    'kansai': 'https://download.geofabrik.de/asia/japan/kansai/kansai-latest.osm.pbf',
    'centro': 'https://download.geofabrik.de/europe/italy/centro/centro-latest.osm.pbf',
    'nord-est': 'https://download.geofabrik.de/europe/italy/nord-est/nord-est-latest.osm.pbf',
    'greece': 'https://download.geofabrik.de/europe/greece/greece-latest.osm.pbf',
    'gcc-states': 'https://download.geofabrik.de/asia/gcc-states/gcc-states-latest.osm.pbf',
    'taiwan': 'https://download.geofabrik.de/asia/taiwan/taiwan-latest.osm.pbf',
    'nusa-tenggara': 'https://download.geofabrik.de/asia/indonesia/nusa-tenggara/nusa-tenggara-latest.osm.pbf',
    'hong-kong': 'https://download.geofabrik.de/asia/china/hong-kong/hong-kong-latest.osm.pbf',
    'shanghai': 'https://download.geofabrik.de/asia/china/shanghai/shanghai-latest.osm.pbf',
}

BBBIKE = 'https://download.bbbike.org/osm/bbbike/{name}/{name}.osm.pbf'

# slug -> (extract_key_or_bbbike_name, kind)
# kind: 'geofabrik' uses EXTRACTS key; 'bbbike' uses CamelCase name.
CITIES = [
    ('los-angeles', 'LosAngeles', 'bbbike', 34.0522, -118.2437, 20000),
    ('new-york', 'NewYork', 'bbbike', 40.7128, -74.0060, 15000),
    ('san-francisco', 'SanFrancisco', 'bbbike', 37.7749, -122.4194, 12000),
    ('honolulu', 'hawaii', 'geofabrik', 21.3069, -157.8583, 25000),
    ('las-vegas', 'nevada', 'geofabrik', 36.1699, -115.1398, 15000),
    ('seattle', 'Seattle', 'bbbike', 47.6062, -122.3321, 12000),
    ('chicago', 'Chicago', 'bbbike', 41.8781, -87.6298, 14000),
    ('miami', 'Miami', 'bbbike', 25.7617, -80.1918, 14000),
    ('san-diego', 'california', 'geofabrik', 32.7157, -117.1611, 16000),
    ('washington-dc', 'WashingtonDC', 'bbbike', 38.9072, -77.0369, 12000),
    ('boston', 'massachusetts', 'geofabrik', 42.3601, -71.0589, 12000),
    ('austin', 'Austin', 'bbbike', 30.2672, -97.7431, 14000),
    ('denver', 'Denver', 'bbbike', 39.7392, -104.9903, 14000),
    ('portland', 'Portland', 'bbbike', 45.5152, -122.6784, 12000),
    ('new-orleans', 'NewOrleans', 'bbbike', 29.9511, -90.0715, 12000),
    ('nashville', 'tennessee', 'geofabrik', 36.1627, -86.7816, 12000),
    ('phoenix', 'arizona', 'geofabrik', 33.4484, -112.0740, 16000),
    ('philadelphia', 'Philadelphia', 'bbbike', 39.9526, -75.1652, 12000),
    ('tokyo', 'Tokyo', 'bbbike', 35.6762, 139.6503, 14000),
    ('kyoto', 'kansai', 'geofabrik', 35.0116, 135.7681, 14000),
    ('osaka', 'kansai', 'geofabrik', 34.6937, 135.5023, 14000),
    ('seoul', 'Seoul', 'bbbike', 37.5665, 126.9780, 14000),
    ('shanghai', 'shanghai', 'geofabrik', 31.2304, 121.4737, 14000),
    ('beijing', 'Beijing', 'bbbike', 39.9042, 116.4074, 14000),
    ('hong-kong', 'hong-kong', 'geofabrik', 22.3193, 114.1694, 14000),
    ('taipei', 'taiwan', 'geofabrik', 25.0330, 121.5654, 14000),
    ('singapore', 'Singapore', 'bbbike', 1.3521, 103.8198, 14000),
    ('bangkok', 'Bangkok', 'bbbike', 13.7563, 100.5018, 14000),
    ('bali', 'nusa-tenggara', 'geofabrik', -8.5500, 115.2000, 30000),
    ('london', 'London', 'bbbike', 51.5074, -0.1278, 12000),
    ('paris', 'Paris', 'bbbike', 48.8566, 2.3522, 10000),
    ('barcelona', 'Barcelona', 'bbbike', 41.3874, 2.1686, 10000),
    ('rome', 'centro', 'geofabrik', 41.9028, 12.4964, 10000),
    ('lisbon', 'Lisbon', 'bbbike', 38.7223, -9.1393, 10000),
    ('amsterdam', 'Amsterdam', 'bbbike', 52.3676, 4.9041, 10000),
    ('berlin', 'Berlin', 'bbbike', 52.5200, 13.4050, 12000),
    ('madrid', 'Madrid', 'bbbike', 40.4168, -3.7038, 10000),
    ('prague', 'Prag', 'bbbike', 50.0755, 14.4378, 10000),
    ('vienna', 'Wien', 'bbbike', 48.2082, 16.3738, 10000),
    ('florence', 'centro', 'geofabrik', 43.7696, 11.2558, 8000),
    ('venice', 'nord-est', 'geofabrik', 45.4408, 12.3155, 8000),
    ('athens', 'greece', 'geofabrik', 37.9838, 23.7275, 10000),
    ('istanbul', 'Istanbul', 'bbbike', 41.0082, 28.9784, 14000),
    ('dubai', 'gcc-states', 'geofabrik', 25.2048, 55.2708, 18000),
    ('sydney', 'Sydney', 'bbbike', -33.8688, 151.2093, 14000),
    ('melbourne', 'Melbourne', 'bbbike', -37.8136, 144.9631, 12000),
    ('auckland', 'Auckland', 'bbbike', -36.8509, 174.7645, 14000),
    ('vancouver', 'Vancouver', 'bbbike', 49.2827, -123.1207, 12000),
    ('toronto', 'Toronto', 'bbbike', 43.6532, -79.3832, 12000),
    ('mexico-city', 'MexicoCity', 'bbbike', 19.4326, -99.1332, 14000),
]

TOURISM = {'attraction', 'museum', 'viewpoint', 'zoo', 'aquarium', 'gallery'}
WELLNESS_LEISURE = {'spa', 'sauna', 'fitness_centre'}
WELLNESS_AMENITY = {'spa', 'sauna', 'public_bath', 'massage'}
FOOD = {'restaurant', 'cafe'}


def interesting(tags: dict) -> bool:
    if not tags.get('name'):
        return False
    if tags.get('tourism') in TOURISM:
        return True
    if tags.get('leisure') == 'park' or tags.get('natural') in {'beach', 'hot_spring'}:
        return True
    if tags.get('amenity') in FOOD or tags.get('amenity') in WELLNESS_AMENITY:
        return True
    if tags.get('leisure') in WELLNESS_LEISURE:
        return True
    return False


def bbox(lat, lng, radius):
    dlat = radius / 111320.0
    clat = max(0.2, math.cos(math.radians(lat)))
    dlng = radius / (111320.0 * clat)
    return (lng - dlng, lat - dlat, lng + dlng, lat + dlat)


def curl_get(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + '.part')
    cmd = [
        'curl', '-L', '--fail', '--retry', '4', '--retry-delay', '8',
        '-C', '-', '-A', UA, '-o', str(part), url,
    ]
    print('  curl', url)
    subprocess.check_call(cmd)
    part.rename(dest)
    print(f'  saved {dest.name} ({dest.stat().st_size/1e6:.1f} MB)')
    time.sleep(3)


def dated_geofabrik_urls(latest_url: str) -> list[str]:
    """-latest sometimes 307s to a dated file that is not published yet. Prefer complete dated copies."""
    if 'geofabrik.de' not in latest_url or not latest_url.endswith('-latest.osm.pbf'):
        return [latest_url]
    directory = latest_url.rsplit('/', 1)[0] + '/'
    prefix = latest_url.rsplit('/', 1)[1].replace('-latest.osm.pbf', '')
    try:
        listing = subprocess.check_output(['curl', '-sS', '-m', '30', '-A', UA, directory], text=True, errors='replace')
    except Exception:
        return [latest_url]
    import re
    dates = sorted(set(re.findall(rf'href="[^"]*({re.escape(prefix)}-(\d{{6}})\.osm\.pbf)"', listing)), reverse=True)
    dated = [directory + m[0].split('/')[-1] for m in dates]
    # Skip a dated file that has no .md5 yet (often still uploading) by putting it last.
    ready, pending = [], []
    for u in dated:
        name = u.rsplit('/', 1)[1]
        (ready if (name + '.md5') in listing else pending).append(u)
    return ready + pending + [latest_url]


def download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 10000:
        print(f'  have {dest.name} ({dest.stat().st_size/1e6:.1f} MB)')
        return dest
    errors = []
    for candidate in dated_geofabrik_urls(url):
        try:
            curl_get(candidate, dest)
            return dest
        except Exception as e:
            errors.append(f'{candidate}: {e}')
            print('  download miss', errors[-1])
    raise RuntimeError('download failed: ' + ' | '.join(errors[:4]))


def extract_source(kind: str, key: str) -> Path:
    if kind == 'bbbike':
        url = BBBIKE.format(name=key)
        return download(url, PBF / f'bbbike-{key}.osm.pbf')
    url = EXTRACTS[key]
    return download(url, PBF / f'{key}.osm.pbf')


def crop(src: Path, dest: Path, bb) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    box = f'{bb[0]:.5f},{bb[1]:.5f},{bb[2]:.5f},{bb[3]:.5f}'
    print(f'  osmium extract {src.name} bbox={box}')
    # smart keeps multipolygon relations (British Museum, palaces) complete; complete_ways dropped them.
    subprocess.check_call([
        'osmium', 'extract', '--overwrite', '--strategy', 'smart',
        '--bbox', box, '-o', str(dest), str(src),
    ])
    return dest


class PoiHandler(osmium.SimpleHandler):
    def __init__(self, bb):
        super().__init__()
        self.bb = bb
        self.elements = []
        self.seen = set()

    def _inside(self, lat, lon):
        return self.bb[1] <= lat <= self.bb[3] and self.bb[0] <= lon <= self.bb[2]

    def _tags(self, obj):
        return {t.k: t.v for t in obj.tags}

    def _add(self, typ, osm_id, lat, lon, tags, n=None):
        key = (typ, osm_id)
        if key in self.seen:
            return
        if not interesting(tags) or not self._inside(lat, lon):
            return
        if not (math.isfinite(lat) and math.isfinite(lon)):
            return
        self.seen.add(key)
        row = {'type': typ, 'id': osm_id, 'tags': tags, 'n': n or len(tags)}
        if typ == 'node':
            row['lat'] = lat
            row['lon'] = lon
        else:
            row['center'] = {'lat': lat, 'lon': lon}
        self.elements.append(row)

    def node(self, n):
        if not n.location.valid():
            return
        self._add('node', n.id, n.location.lat, n.location.lon, self._tags(n))

    def way(self, w):
        tags = self._tags(w)
        if not interesting(tags):
            return
        coords = []
        try:
            for n in w.nodes:
                if n.location.valid():
                    coords.append((n.location.lat, n.location.lon))
        except osmium.InvalidLocationError:
            return
        if not coords:
            return
        lat = sum(c[0] for c in coords) / len(coords)
        lon = sum(c[1] for c in coords) / len(coords)
        self._add('way', w.id, lat, lon, tags)

    def area(self, a):
        # Closed ways are already recorded in way(); this path keeps tagged multipolygon relations.
        if a.from_way():
            return
        tags = self._tags(a)
        if not interesting(tags):
            return
        lats, lons = [], []
        try:
            for ring in a.outer_rings():
                for node in ring:
                    lats.append(node.lat)
                    lons.append(node.lon)
        except osmium.InvalidLocationError:
            return
        if not lats:
            return
        self._add('relation', a.orig_id(), sum(lats) / len(lats), sum(lons) / len(lons), tags)


def scan(pbf: Path, bb) -> dict:
    h = PoiHandler(bb)
    h.apply_file(str(pbf), locations=True, idx='flex_mem')
    return {'elements': h.elements, 'generator': 'gonow-extract-city-pois'}


def process_city(row, force=False):
    slug, key, kind, lat, lng, radius = row
    out = RAW / f'{slug}-overpass.json'
    if not force and out.exists():
        try:
            data = json.loads(out.read_text())
            if len(data.get('elements') or []) >= 8:
                print(f'skip extract {slug} ({len(data["elements"])} elements)')
                return data
        except Exception:
            pass
    print(f'extract {slug}')
    src = extract_source(kind, key)
    bb = bbox(lat, lng, radius)
    cropped = PBF / f'crop-{slug}.osm.pbf'
    poi = PBF / f'poi-{slug}.osm.pbf'
    if force:
        for stale in (cropped, poi):
            try:
                stale.unlink()
            except FileNotFoundError:
                pass
    crop(src, cropped, bb)
    if not poi.exists() or poi.stat().st_size < 500:
        print(f'  osmium tags-filter {cropped.name}')
        subprocess.check_call([
            'osmium', 'tags-filter', '--overwrite', '-o', str(poi), str(cropped),
            'nwr/tourism=attraction,museum,viewpoint,zoo,aquarium,gallery',
            'nwr/leisure=park,spa,sauna,fitness_centre',
            'nwr/natural=beach,hot_spring',
            'nwr/amenity=restaurant,cafe,spa,sauna,public_bath,massage',
        ])
    data = scan(poi, bb)
    try:
        if poi.exists() and poi.stat().st_size > 20_000_000:
            poi.unlink()
    except Exception:
        pass
    RAW.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data))
    print(f'  {slug}: {len(data["elements"])} elements, {out.stat().st_size/1024:.1f} KB')
    # Cropped files are small enough to keep for resume; drop after success to save space if huge.
    try:
        if cropped.stat().st_size > 40_000_000:
            cropped.unlink()
    except Exception:
        pass
    return data


def main():
    force = '--force' in sys.argv
    only = [a[7:] for a in sys.argv if a.startswith('--only=')]
    rows = CITIES
    if only:
        rows = [r for r in CITIES if r[0] in only or r[0].replace('-', ' ') in only]
        if not rows:
            sys.exit('no cities matched')
    failures = []
    for row in rows:
        try:
            process_city(row, force=force)
        except Exception as e:
            print(f'FAIL {row[0]}: {e}', file=sys.stderr)
            failures.append({'slug': row[0], 'error': str(e)})
            time.sleep(2)
    (RAW / 'extract-failures.json').write_text(json.dumps(failures, indent=2))
    print('EXTRACT DONE', len(CITIES) - len(failures), '/', len(rows), 'failures', len(failures))
    if failures and len(failures) > 20:
        sys.exit(1)


if __name__ == '__main__':
    main()
