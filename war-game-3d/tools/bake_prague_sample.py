# Bakes the Prague-Bubenec sample (needs bubenec_raw.json extracted from momepy's bubenec.gpkg; see README)
import json, math
raw = json.load(open('bubenec_raw.json')); k = raw['k']
B = raw['B']; S = raw['S']
# game coordinates in metres: x east, y south (so y = -north)
cx0 = sum(p[0] for r in B for p in r) / sum(len(r) for r in B); cy0 = sum(p[1] for r in B for p in r) / sum(len(r) for r in B)
def g(p): return ((p[0]-cx0)*k, -(p[1]-cy0)*k)
Bm = [[g(p) for p in r[:-1] if True] for r in B]   # drop the closing duplicate point
Sm = [[g(p) for p in s] for s in S]
def area(r): return abs(sum(r[i][0]*r[(i+1)%len(r)][1]-r[(i+1)%len(r)][0]*r[i][1] for i in range(len(r))))/2
def obb(r):
    best = None
    for deg in [i*0.5 for i in range(0, 180)]:
        a = math.radians(deg); c, s = math.cos(a), math.sin(a)
        xs = [p[0]*c+p[1]*s for p in r]; ys = [-p[0]*s+p[1]*c for p in r]
        w, h = max(xs)-min(xs), max(ys)-min(ys)
        if best is None or w*h < best[0]: best = (w*h, a, (max(xs)+min(xs))/2, (max(ys)+min(ys))/2, w, h)
    _, a, mx, my, w, h = best; c, s = math.cos(a), math.sin(a)
    return a, (mx*c - my*s, mx*s + my*c), w, h
def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy) or 1e-9
    dm, im = 0, 0
    for i in range(1, len(pts)-1):
        d = abs((pts[i][0]-a[0])*dy - (pts[i][1]-a[1])*dx)/L
        if d > dm: dm, im = d, i
    if dm > eps: return dp(pts[:im+1], eps)[:-1] + dp(pts[im:], eps)
    return [a, b]
def simplify_ring(r, eps):
    # split the ring at its two farthest points so Douglas-Peucker works on both halves
    n = len(r); i0 = 0; j0 = max(range(n), key=lambda j: math.hypot(r[j][0]-r[0][0], r[j][1]-r[0][1]))
    a = dp(r[i0:j0+1], eps); b = dp(r[j0:]+[r[0]], eps)
    out = a[:-1] + b[:-1]
    return out if len(out) >= 3 else r
# choose the densest window
WW, WH = 400, 300
xs = [p[0] for r in Bm for p in r]; ys = [p[1] for r in Bm for p in r]
cent = [(sum(p[0] for p in r)/len(r), sum(p[1] for p in r)/len(r)) for r in Bm]
best = None
for ox in range(int(min(xs)), int(max(xs)-WW)+1, 10):
    for oy in range(int(min(ys)), int(max(ys)-WH)+1, 10):
        n = sum(1 for c in cent if ox+20 < c[0] < ox+WW-20 and oy+20 < c[1] < oy+WH-20)
        if best is None or n > best[0]: best = (n, ox, oy)
n, ox, oy = best
print('window', WW, WH, 'buildings inside', n, 'origin', ox, oy)
enter, solids = [], []
for r, c in zip(Bm, cent):
    if not (ox+8 < c[0] < ox+WW-8 and oy+8 < c[1] < oy+WH-8): continue
    r2 = [(p[0]-ox, p[1]-oy) for p in r]
    ar = area(r2); a, ctr, w, h = obb(r2); ratio = ar/(w*h)
    if 80 <= ar <= 900 and ratio >= 0.74 and min(w, h) >= 8.5:
        enter.append({'c': [round(ctr[0],2), round(ctr[1],2)], 'd': [round(w,2), round(h,2)], 'a': round(a,4), 'ar': round(ar)})
    else:
        sr = simplify_ring(r2, 0.35)
        solids.append({'p': [[round(x,1), round(y,1)] for x, y in sr], 'ar': round(ar)})
print('enterable candidates', len(enter), 'solid polygons', len(solids))
# keep the 34 enterable buildings nearest the window centre, the rest become solid blocks
enter.sort(key=lambda e: math.hypot(e['c'][0]-WW/2, e['c'][1]-WH/2))
keep, extra = enter[:34], enter[34:]
for e in extra:
    w, h = e['d']; a = e['a']; c, s = math.cos(a), math.sin(a); ctr = e['c']
    corners = [(ctr[0] + dx*c - dy*s, ctr[1] + dx*s + dy*c) for dx, dy in [(-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2)]]
    solids.append({'p': [[round(x,1), round(y,1)] for x, y in corners], 'ar': e['ar']})
streets = []
for s in Sm:
    pts = [(p[0]-ox, p[1]-oy) for p in s]
    if not any(-30 < x < WW+30 and -30 < y < WH+30 for x, y in pts): continue
    pts = dp(pts, 0.4)
    streets.append([[round(x,1), round(y,1)] for x, y in pts])
total = sum(sum(math.hypot(s[i+1][0]-s[i][0], s[i+1][1]-s[i][1]) for i in range(len(s)-1)) for s in streets)
print('enterable', len(keep), 'solids', len(solids), 'streets', len(streets), 'street length m', round(total))
data = {'id': 'prague', 'name': 'Prague, Bubeneč', 'lat': round(raw['lat'], 5), 'lon': round(raw['lon'], 5), 'size': [WW, WH], 'houses': keep, 'solids': solids, 'streets': streets}
js = "// Real map data: a %dx%d m window of Prague-Bubeneč (building footprints and street centrelines), converted to metres.\n// Source: the Bubeneč sample dataset shipped with the momepy package (BSD-3-Clause).\nconst REAL_MAPS = {"prague": %s};\n" % (WW, WH, json.dumps(data, separators=(',', ':')))
open('../src/realmap_data.js', 'w').write(js)
print('bytes', len(js))
