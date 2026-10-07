#!/usr/bin/env python3
"""Bake a real place from OpenStreetMap into the game.

    python3 tools/bake_osm.py --id kochi --name "Fort Kochi" --lat 9.9658 --lon 76.2420
    python3 tools/bake_osm.py --id kochi --name "Fort Kochi" --lat 9.9658 --lon 76.2420 --input overpass.json   # offline

It downloads building outlines and roads from the Overpass API (needs internet), keeps a 400 x 300 m window around the point,
and adds the place to src/realmap_data.js. Run `python3 build.py` afterwards; the map then shows up in the menu.
Data (c) OpenStreetMap contributors, ODbL.
"""
import argparse, json, math, os, re, sys, urllib.parse, urllib.request

HIGHWAYS = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link'
WIDTH = {'motorway': 12, 'trunk': 11, 'primary': 10, 'secondary': 9, 'tertiary': 8, 'residential': 6.6, 'unclassified': 6.6, 'living_street': 5.5, 'service': 4.5, 'road': 6}

def fetch(lat, lon, w, h):
    dlat, dlon = (h / 2 + 40) / 110540, (w / 2 + 40) / (111320 * math.cos(math.radians(lat)))
    bb = f'{lat - dlat},{lon - dlon},{lat + dlat},{lon + dlon}'
    q = f'[out:json][timeout:90];(way["building"]({bb});way["highway"~"^({HIGHWAYS})$"]({bb}););out geom;'
    req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': 'war-3d-map-baker/1.0'})
    return json.load(urllib.request.urlopen(req, timeout=120))

def area(r): return abs(sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))) / 2
def obb(r):
    best = None
    for deg in [i * 0.5 for i in range(180)]:
        a = math.radians(deg); c, s = math.cos(a), math.sin(a)
        xs = [p[0] * c + p[1] * s for p in r]; ys = [-p[0] * s + p[1] * c for p in r]
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        if best is None or w * h < best[0]: best = (w * h, a, (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, w, h)
    _, a, mx, my, w, h = best; c, s = math.cos(a), math.sin(a)
    return a, (mx * c - my * s, mx * s + my * c), w, h
def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1e-9; dm, im = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / L
        if d > dm: dm, im = d, i
    return dp(pts[:im + 1], eps)[:-1] + dp(pts[im:], eps) if dm > eps else [a, b]
def simplify_ring(r, eps):
    n = len(r); j0 = max(range(n), key=lambda j: math.hypot(r[j][0] - r[0][0], r[j][1] - r[0][1]))
    out = dp(r[:j0 + 1], eps)[:-1] + dp(r[j0:] + [r[0]], eps)[:-1]
    return out if len(out) >= 3 else r

def bake(data, args):
    W, H = args.width, args.height
    k = 111320 * math.cos(math.radians(args.lat))
    def pt(g): return ((g['lon'] - args.lon) * k + W / 2, -(g['lat'] - args.lat) * 110540 + H / 2)   # x east, y south, origin at the window corner
    buildings, streets = [], []
    for el in data.get('elements', []):
        if el.get('type') != 'way' or 'geometry' not in el: continue
        tags = el.get('tags', {}); pts = [pt(g) for g in el['geometry']]
        if 'building' in tags and len(pts) >= 4: buildings.append(pts[:-1] if pts[0] == pts[-1] else pts)
        elif 'highway' in tags: streets.append((pts, WIDTH.get(tags['highway'], 6.6)))
    houses, solids = [], []
    for r in buildings:
        cx, cy = sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r)
        if not (8 < cx < W - 8 and 8 < cy < H - 8): continue
        ar = area(r)
        if ar < 12: continue
        a, ctr, w, h = obb(r)
        if 80 <= ar <= 900 and ar / (w * h) >= 0.74 and min(w, h) >= 8.5: houses.append({'c': [round(ctr[0], 2), round(ctr[1], 2)], 'd': [round(w, 2), round(h, 2)], 'a': round(a, 4), 'ar': round(ar)})
        else: solids.append({'p': [[round(x, 1), round(y, 1)] for x, y in simplify_ring(r, 0.35)], 'ar': round(ar)})
    houses.sort(key=lambda e: math.hypot(e['c'][0] - W / 2, e['c'][1] - H / 2))
    for e in houses[34:]:                       # only the nearest 34 are enterable; the rest become solid blocks
        w, h = e['d']; a = e['a']; c, s = math.cos(a), math.sin(a); ctr = e['c']
        solids.append({'p': [[round(ctr[0] + dx * c - dy * s, 1), round(ctr[1] + dx * s + dy * c, 1)] for dx, dy in [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]], 'ar': e['ar']})
    houses = houses[:34]
    out_streets = []
    for pts, wd in streets:
        if not any(-30 < x < W + 30 and -30 < y < H + 30 for x, y in pts): continue
        out_streets.append({'p': [[round(x, 1), round(y, 1)] for x, y in dp(pts, 0.5)], 'w': wd})
    print(f'{len(houses)} enterable houses, {len(solids)} solid buildings, {len(out_streets)} streets')
    return {'id': args.id, 'name': args.name, 'lat': args.lat, 'lon': args.lon, 'size': [W, H], 'houses': houses, 'solids': solids, 'streets': out_streets}

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--id', required=True); ap.add_argument('--name', required=True); ap.add_argument('--lat', type=float, required=True); ap.add_argument('--lon', type=float, required=True)
    ap.add_argument('--width', type=int, default=400); ap.add_argument('--height', type=int, default=300); ap.add_argument('--input', help='use a saved Overpass JSON instead of downloading')
    args = ap.parse_args()
    data = json.load(open(args.input)) if args.input else fetch(args.lat, args.lon, args.width, args.height)
    entry = bake(data, args)
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'realmap_data.js')
    maps = {}
    if os.path.exists(path):
        m = re.search(r'const REAL_MAPS = (\{.*\});', open(path, encoding='utf-8').read(), re.S)
        if m: maps = json.loads(m.group(1))
    maps[args.id] = entry
    js = '// Real map data: windows of real places (building footprints and street centrelines) in metres.\n// Prague-Bubenec: momepy sample dataset (BSD-3). Places added with tools/bake_osm.py: (c) OpenStreetMap contributors, ODbL.\nconst REAL_MAPS = ' + json.dumps(maps, separators=(',', ':'), ensure_ascii=False) + ';\n'
    open(path, 'w', encoding='utf-8').write(js)
    print('wrote', os.path.normpath(path), '- now run: python3 build.py')

if __name__ == '__main__': main()
