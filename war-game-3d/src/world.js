// ---------- World: terrain, roads, buildings, vegetation, props ----------
// Gameplay uses flat 2D shapes (rects and circles in field pixels); everything here also builds the 3D look.
const KINDS = {
  building: { rect: 1, stop: 1 }, container: { rect: 1, stop: 1 }, vehicle: { rect: 1, stop: 1 }, crate: { rect: 1, stop: 1 },
  barrier: { rect: 1, stop: 1 }, sandbag: { rect: 1, stop: 1 }, fence: { rect: 1, stop: 0 },
  rock: { round: 'r', stop: 1 }, barrel: { round: 'r', stop: 1 }, bale: { round: 'r', stop: 1 },
  tree: { round: 'tr', stop: 0 }, pole: { round: 'r', stop: 0 }, tower: { round: 'r', stop: 0 }, water: { round: 'r', stop: 0 },
};
const isRect = o => !!KINDS[o.kind].rect;
const rad = o => o[KINDS[o.kind].round];
let obstacles = [], roads = [], pond = null, forests = [], farm = null, town = null, bushes = [], poles = [], borderTrees = [];
let MAP_SEED = 1, groundCanvas = null, worldGroup = null, HG = null, HNX = 0, HNZ = 0;

// ---------- Noise and height ----------
const hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi + s * 31, yi), b = hash2(xi + 1 + s * 31, yi), c = hash2(xi + s * 31, yi + 1), d = hash2(xi + 1 + s * 31, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 1) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 2) * 0.15;
function segDist(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1, t = clampN(((px - a.x) * dx + (py - a.y) * dy) / l2, 0, 1);
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}
function roadDist(x, y) {     // px distance to the nearest road edge (negative on the road)
  let d = 1e9;
  for (const r of roads) for (let i = 0; i < r.pts.length - 1; i += 1) d = Math.min(d, segDist(x, y, r.pts[i], r.pts[i + 1]) - r.half);
  return d;
}
function rectDist(x, y, o) { const dx = Math.max(o.x - x, 0, x - (o.x + o.w)), dy = Math.max(o.y - y, 0, y - (o.y + o.h)); return Math.hypot(dx, dy); }
function hAt(xm, zm) {          // terrain height (m) at world metres
  if (!HG) return 0;
  const gx = clampN(xm + HNX / 2, 0, HNX - 0.001), gz = clampN(zm + HNZ / 2, 0, HNZ - 0.001), i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, S = HNX + 1;
  const a = HG[j * S + i], b = HG[j * S + i + 1], c = HG[(j + 1) * S + i], d = HG[(j + 1) * S + i + 1];
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
const gY = (x, y) => hAt(wx(x), wz(y));      // terrain height at field px

// ---------- Collision (used by the game logic) ----------
function pushOut(e, r) {
  let hit = null;
  for (const o of obstacles) {
    if (isRect(o)) {
      const cx = Math.max(o.x, Math.min(e.x, o.x + o.w)), cy = Math.max(o.y, Math.min(e.y, o.y + o.h));
      let dx = e.x - cx, dy = e.y - cy;
      const d = Math.hypot(dx, dy);
      if (d >= r) continue;
      if (d === 0) {
        const l = e.x - o.x, rr = o.x + o.w - e.x, t = e.y - o.y, b = o.y + o.h - e.y, m = Math.min(l, rr, t, b);
        if (m === l) { dx = -1; dy = 0; } else if (m === rr) { dx = 1; dy = 0; } else if (m === t) { dx = 0; dy = -1; } else { dx = 0; dy = 1; }
        e.x += dx * (m + r); e.y += dy * (m + r); hit = { x: dx, y: dy };
      } else { e.x = cx + dx / d * r; e.y = cy + dy / d * r; hit = { x: dx / d, y: dy / d }; }
    } else {
      const min = rad(o) + r, dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 0.01;
      if (d < min) { e.x = o.x + dx / d * min; e.y = o.y + dy / d * min; hit = { x: dx / d, y: dy / d }; }
    }
  }
  return hit;
}
function bulletBlocked(x, y) {          // cover stops bullets; tree trunks, fences, poles and water do not
  for (const o of obstacles) {
    if (!KINDS[o.kind].stop) continue;
    if (isRect(o)) { if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) return true; }
    else if (Math.hypot(x - o.x, y - o.y) < rad(o)) return true;
  }
  return false;
}
function pointFree(x, y, r) {
  for (const o of obstacles) {
    if (isRect(o)) { if (rectDist(x, y, o) < r) return false; }
    else if (Math.hypot(x - o.x, y - o.y) < rad(o) + r) return false;
  }
  return true;
}

// ---------- Map generation ----------
function catmull(pts, n) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function generateMap() {
  MAP_SEED = Math.floor(Math.random() * 900) + 1;
  obstacles = []; roads = []; pond = null; forests = []; farm = null; bushes = []; poles = []; borderTrees = [];

  // roads: a paved main road across the field and a dirt road crossing it
  const y0 = FH * rnd(0.4, 0.6), amp = rnd(110, 200), ph = rnd(0, 6), main = [];
  for (let x = -80; x <= FW + 80; x += 300) main.push({ x, y: y0 + Math.sin(x / 520 + ph) * amp });
  roads.push({ pts: catmull(main, 12), half: 60, kind: 'asphalt' });
  const x0 = FW * rnd(0.3, 0.7), side = [];
  for (let y = -80; y <= FH + 80; y += 280) side.push({ x: x0 + Math.sin(y / 450 + ph * 2) * 130, y });
  roads.push({ pts: catmull(side, 12), half: 38, kind: 'dirt' });
  const mp = roads[0].pts; town = mp.reduce((a, p) => Math.abs(p.x - x0) < Math.abs(a.x - x0) ? p : a, mp[0]);

  const placed = [];
  const bbox = o => isRect(o) ? { x: o.x, y: o.y, w: o.w, h: o.h } : { x: o.x - rad(o), y: o.y - rad(o), w: rad(o) * 2, h: rad(o) * 2 };
  const free = (o, gap, onRoad, roadGap) => {
    const b = bbox(o), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (b.x < 40 || b.y < 40 || b.x + b.w > FW - 40 || b.y + b.h > FH - 40) return false;
    if (b.x < FW / 2 + 130 && b.x + b.w > FW / 2 - 130 && b.y < FH / 2 + 130 && b.y + b.h > FH / 2 - 130) return false;   // keep the spawn clear
    if (pond && Math.hypot(cx - pond.x, cy - pond.y) < pond.r + Math.max(b.w, b.h) / 2 + 24) return false;
    if (!onRoad) for (const [px, py] of [[cx, cy], [b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) if (roadDist(px, py) < roadGap) return false;
    return placed.every(p => b.x > p.x + p.w + gap || b.x + b.w < p.x - gap || b.y > p.y + p.h + gap || b.y + b.h < p.y - gap);
  };
  const add = (o, gap = 30, onRoad = false, roadGap = 28) => { if (!free(o, gap, onRoad, roadGap)) return false; placed.push(bbox(o)); obstacles.push(o); return true; };

  // pond
  for (let i = 0; i < 80 && !pond; i++) {
    const p = { x: rnd(350, FW - 350), y: rnd(300, FH - 300), r: rnd(95, 135) };
    if (roadDist(p.x, p.y) > p.r + 90 && Math.hypot(p.x - FW / 2, p.y - FH / 2) > 420 && Math.hypot(p.x - town.x, p.y - town.y) > 520) pond = p;
  }
  if (pond) { obstacles.push({ kind: 'water', x: pond.x, y: pond.y, r: pond.r * 0.82 }); placed.push({ x: pond.x - pond.r, y: pond.y - pond.r, w: pond.r * 2, h: pond.r * 2 }); }

  // the village around the crossroads
  const wallCols = ['#e8dcc4', '#d9c9a6', '#c9b896', '#e6e2d8', '#b9c4c9', '#d7b8a0'], roofCols = ['#8c3b2f', '#6e4a3a', '#5b5f66', '#7a3e2a'];
  for (let i = 0, made = 0; i < 900 && made < 11; i++) {
    const style = made === 0 ? 'warehouse' : made < 3 ? 'concrete' : 'house';
    const w = style === 'warehouse' ? rnd(270, 330) : style === 'concrete' ? rnd(170, 210) : rnd(160, 230), h = style === 'warehouse' ? rnd(170, 200) : style === 'concrete' ? rnd(150, 180) : rnd(120, 170);
    const o = { kind: 'building', style, x: town.x + rnd(-620, 620) - w / 2, y: town.y + rnd(-420, 420) - h / 2, w, h, wall: pick(wallCols), roof: pick(roofCols), floors: style === 'house' && Math.random() < 0.35 ? 2 : 1 };
    if (add(o, 40, false, 34)) made++;
  }
  // farm in a quiet corner
  for (let i = 0; i < 100 && !farm; i++) {
    const f = { x: rnd(260, FW - 560), y: rnd(220, FH - 460), w: 340, h: 240 };
    if (Math.hypot(f.x + 170 - town.x, f.y + 120 - town.y) > 760 && Math.hypot(f.x + 170 - FW / 2, f.y + 120 - FH / 2) > 480 && roadDist(f.x + 170, f.y + 120) > 220 && (!pond || Math.hypot(f.x + 170 - pond.x, f.y + 120 - pond.y) > pond.r + 260)) {
      const b1 = { kind: 'building', style: 'barn', x: f.x + 20, y: f.y + 20, w: 190, h: 120, wall: '#9c3a2e', roof: '#5b5f66', floors: 1 };
      if (add(b1, 20, true)) { farm = f; add({ kind: 'building', style: 'house', x: f.x + 230, y: f.y + 60, w: 130, h: 110, wall: pick(wallCols), roof: pick(roofCols), floors: 1 }, 20, true); }
    }
  }
  if (farm) {
    const f = farm; farm.field = { x: f.x + (f.x + f.w + 340 < FW - 60 ? f.w + 20 : -300), y: f.y, w: 280, h: 240, crop: Math.random() < 0.5 ? 'wheat' : 'plow' };
    for (const [x, y, w, h] of [[f.x - 20, f.y - 20, 380, 6], [f.x - 20, f.y + f.h + 14, 380, 6], [f.x - 20, f.y - 20, 6, 120], [f.x - 20, f.y + f.h - 90, 6, 110]]) add({ kind: 'fence', x, y, w, h }, 4, true);
    for (let i = 0; i < 6; i++) add({ kind: 'bale', x: f.x + rnd(40, 320), y: f.y + rnd(160, 230), r: 14 }, 12, true);
  }
  // containers, vehicles, cover and clutter
  for (let i = 0; i < 300 && obstacles.filter(o => o.kind === 'container').length < 5; i++) {
    const hz = Math.random() < 0.5, col = pick(['#b03a2e', '#2e5f9e', '#3d7a4a', '#a8742a', '#c8c8c0']);
    add({ kind: 'container', x: town.x + rnd(-620, 620), y: town.y + rnd(-420, 420), w: hz ? 120 : 48, h: hz ? 48 : 120, col, hgt: 2.6 }, 36, false, 30);
  }
  const dirOf = (pts, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; return Math.abs(b.x - a.x) > Math.abs(b.y - a.y); };
  const vtypes = [['sedan', 88, 38], ['sedan', 88, 38], ['pickup', 100, 40], ['van', 96, 42], ['truck', 150, 52], ['jeep', 84, 40], ['wreck', 88, 38]];
  for (let i = 0, n = 0; i < 400 && n < 10; i++) {
    const r = Math.random() < 0.75 ? roads[0] : roads[1], k = Math.floor(rnd(2, r.pts.length - 2)), p = r.pts[k], hz = dirOf(r.pts, k), t = pick(vtypes);
    const off = rnd(-r.half * 0.55, r.half * 0.55), cx = hz ? p.x : p.x + off, cy = hz ? p.y + off : p.y, w = hz ? t[1] : t[2], h = hz ? t[2] : t[1];
    if (Math.hypot(cx - FW / 2, cy - FH / 2) < 160) continue;
    if (add({ kind: 'vehicle', type: t[0], col: pick(['#b02a2a', '#2a4a8c', '#d8d8d8', '#1c1c1c', '#c9a227', '#3b6e3b', '#7a7a7e']), x: cx - w / 2, y: cy - h / 2, w, h, hgt: 1.8, hz }, 14, true)) n++;
  }
  for (let i = 0, n = 0; i < 400 && n < 14; i++) {
    const hz = Math.random() < 0.5, t = pick(['barrier', 'barrier', 'sandbag']), L = t === 'barrier' ? 64 : 110, T = t === 'barrier' ? 18 : 26;
    const near = Math.random() < 0.6;
    if (add({ kind: t, x: near ? town.x + rnd(-640, 640) : rnd(80, FW - 200), y: near ? town.y + rnd(-420, 420) : rnd(80, FH - 200), w: hz ? L : T, h: hz ? T : L }, 26, Math.random() < 0.3, 20)) n++;
  }
  for (let i = 0, n = 0; i < 300 && n < 9; i++) {
    const q = pick(obstacles.filter(o => o.kind === 'building' || o.kind === 'container')); if (!q) break;
    if (add({ kind: 'crate', x: q.x + rnd(-40, q.w + 20), y: q.y + rnd(-40, q.h + 20), w: 26, h: Math.random() < 0.5 ? 26 : 52, hgt: 1.3 }, 6, false, 14)) n++;
  }
  for (let i = 0, n = 0; i < 300 && n < 12; i++) {
    const q = pick(obstacles.filter(o => o.kind === 'building' || o.kind === 'container')); if (!q) break;
    if (add({ kind: 'barrel', x: q.x + rnd(-40, q.w + 40), y: q.y + rnd(-40, q.h + 40), r: 7, col: pick(['#b03a2e', '#2e5f9e', '#3d7a4a', '#7a5a2a']) }, 4, false, 14)) n++;
  }
  // power poles along the main road, a water tower at the edge of the village
  for (let i = 4; i < roads[0].pts.length - 4; i += 14) {
    const p = roads[0].pts[i], q = roads[0].pts[i + 1], len = Math.hypot(q.x - p.x, q.y - p.y) || 1, nx = -(q.y - p.y) / len, ny = (q.x - p.x) / len;
    const o = { kind: 'pole', x: p.x + nx * 100, y: p.y + ny * 100, r: 4 };
    if (o.x > 40 && o.x < FW - 40 && o.y > 40 && o.y < FH - 40 && (Math.abs(o.x - FW / 2) > 60 || Math.abs(o.y - FH / 2) > 60)) { obstacles.push(o); poles.push(o); }
  }
  for (let i = 0; i < 100; i++) if (add({ kind: 'tower', x: town.x + rnd(-700, 700), y: town.y + rnd(-420, 420), r: 26 }, 40, false, 60)) break;

  // forests, scattered trees, rocks and bushes
  for (let i = 0; i < 200 && forests.length < 4; i++) {
    const f = { x: rnd(240, FW - 240), y: rnd(240, FH - 240), rx: rnd(260, 400), ry: rnd(180, 280), type: pick(['pine', 'mixed', 'oak']) };
    if (Math.hypot(f.x - FW / 2, f.y - FH / 2) < 460 || Math.hypot(f.x - town.x, f.y - town.y) < f.rx + 330) continue;
    if (pond && Math.hypot(f.x - pond.x, f.y - pond.y) < pond.r + Math.max(f.rx, f.ry) * 0.6) continue;
    if (forests.some(g => Math.hypot(g.x - f.x, g.y - f.y) < (g.rx + f.rx) * 0.9)) continue;
    forests.push(f);
  }
  const treeType = ty => ty === 'pine' ? (Math.random() < 0.85 ? 'pine' : 'birch') : ty === 'oak' ? (Math.random() < 0.8 ? 'oak' : 'birch') : pick(['pine', 'oak', 'oak', 'birch']);
  for (const f of forests) {
    for (let i = 0, n = 0; i < 700 && n < 42; i++) {
      const a = rnd(0, 6.283), d = Math.sqrt(Math.random());
      if (add({ kind: 'tree', type: treeType(f.type), x: f.x + Math.cos(a) * f.rx * d, y: f.y + Math.sin(a) * f.ry * d, tr: 7, r: rnd(26, 36), s: rnd(0.85, 1.3), ry: rnd(0, 6.28) }, 16, false, 24)) n++;
    }
  }
  for (let i = 0, n = 0; i < 400 && n < 40; i++) if (add({ kind: 'tree', type: treeType('mixed'), x: rnd(60, FW - 60), y: rnd(60, FH - 60), tr: 7, r: rnd(26, 36), s: rnd(0.8, 1.25), ry: rnd(0, 6.28) }, 40, false, 26)) n++;
  for (let i = 0, n = 0; i < 400 && n < 26; i++) if (add({ kind: 'rock', x: rnd(60, FW - 60), y: rnd(60, FH - 60), r: rnd(14, 28), v: Math.floor(rnd(0, 3)), ry: rnd(0, 6) }, 14, false, 20)) n++;
  const around = obstacles.filter(o => o.kind === 'tree' || o.kind === 'building' || o.kind === 'rock');
  for (let i = 0; i < 110 && around.length; i++) {
    const q = pick(around), a = rnd(0, 6.28), d = (q.r || 60) + rnd(14, 50), x = (q.x + (q.w || 0) / 2) + Math.cos(a) * d, y = (q.y + (q.h || 0) / 2) + Math.sin(a) * d;
    if (x > 40 && x < FW - 40 && y > 40 && y < FH - 40 && roadDist(x, y) > 20 && pointFree(x, y, 6)) bushes.push({ x, y, s: rnd(0.8, 1.5), ry: rnd(0, 6) });
  }
  for (let t = -300; t < FW + 300; t += 52) for (const [x, y] of [[t, -rnd(40, 300)], [t, FH + rnd(40, 300)]]) borderTrees.push({ kind: 'tree', type: pick(['pine', 'pine', 'oak', 'birch']), x, y, s: rnd(0.9, 1.5), ry: rnd(0, 6) });
  for (let t = -300; t < FH + 300; t += 52) for (const [x, y] of [[-rnd(40, 300), t], [FW + rnd(40, 300), t]]) borderTrees.push({ kind: 'tree', type: pick(['pine', 'pine', 'oak', 'birch']), x, y, s: rnd(0.9, 1.5), ry: rnd(0, 6) });
  buildHeightfield();
  paintGround();
  buildWorldMeshes();
}

function buildHeightfield() {
  HNX = FW / U; HNZ = FH / U; HG = new Float32Array((HNX + 1) * (HNZ + 1));
  const pads = obstacles.filter(o => o.kind === 'building'), segs = [];
  for (const r of roads) for (let i = 0; i < r.pts.length - 1; i++) segs.push([r.pts[i], r.pts[i + 1], r.half]);
  for (let j = 0; j <= HNZ; j++) for (let i = 0; i <= HNX; i++) {
    const px = i * U, py = j * U;
    let h = (fbm(i * 0.045, j * 0.045, MAP_SEED) - 0.47) * 7 + (fbm(i * 0.16, j * 0.16, MAP_SEED + 9) - 0.5) * 0.7;
    let rd = 1e9; for (const [a, b, hf] of segs) rd = Math.min(rd, segDist(px, py, a, b) - hf);
    let flat = smooth(15, 170, rd);
    for (const o of pads) flat = Math.min(flat, smooth(25, 190, rectDist(px, py, o)));
    if (farm) flat = Math.min(flat, smooth(30, 200, rectDist(px, py, farm)));
    flat = Math.min(flat, smooth(140, 460, Math.hypot(px - FW / 2, py - FH / 2)));
    if (pond) { const d = Math.hypot(px - pond.x, py - pond.y); flat = Math.min(flat, smooth(pond.r * 0.9, pond.r * 2.4, d)); h = h * flat - 1.25 * (1 - smooth(pond.r * 0.5, pond.r * 1.35, d)); }
    else h *= flat;
    HG[j * (HNX + 1) + i] = h;
  }
}

// ---------- Ground painting ----------
function paintGround() {
  const T = coarse ? 2048 : 3072, TH = Math.round(T * FH / FW), s = T / FW;
  groundCanvas = document.createElement('canvas'); groundCanvas.width = T; groundCanvas.height = TH;
  const g = groundCanvas.getContext('2d'); g.scale(s, s);
  g.fillStyle = '#56733a'; g.fillRect(0, 0, FW, FH);
  const greens = ['70,102,48', '48,78,38', '96,118,58', '82,96,44', '60,90,52'];
  for (let i = 0; i < 520; i++) { g.fillStyle = `rgba(${pick(greens)},${rnd(0.1, 0.28)})`; g.beginPath(); g.ellipse(rnd(0, FW), rnd(0, FH), rnd(30, 150), rnd(20, 100), rnd(0, 3), 0, 7); g.fill(); }
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${pick(['120,104,62', '104,90,54', '134,120,72'])},${rnd(0.12, 0.3)})`; g.beginPath(); g.ellipse(rnd(0, FW), rnd(0, FH), rnd(20, 90), rnd(14, 60), rnd(0, 3), 0, 7); g.fill(); }
  g.lineWidth = 1.1;
  for (let i = 0; i < 9000; i++) {
    const x = rnd(0, FW), y = rnd(0, FH), len = rnd(3, 8);
    g.strokeStyle = `rgba(${pick(['40,70,30', '110,140,60', '130,150,70', '30,55,28'])},${rnd(0.25, 0.55)})`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-2, 2), y - len); g.stroke();
  }
  for (const f of forests) {            // darker forest floor with leaf litter
    const grad = g.createRadialGradient(f.x, f.y, 10, f.x, f.y, Math.max(f.rx, f.ry) * 1.1);
    grad.addColorStop(0, 'rgba(48,52,30,0.7)'); grad.addColorStop(0.65, 'rgba(52,60,34,0.4)'); grad.addColorStop(1, 'rgba(52,70,38,0)');
    g.save(); g.translate(f.x, f.y); g.scale(1, f.ry / f.rx); g.translate(-f.x, -f.y); g.fillStyle = grad; g.beginPath(); g.arc(f.x, f.y, f.rx * 1.15, 0, 7); g.fill(); g.restore();
    for (let i = 0; i < 700; i++) { const a = rnd(0, 6.28), d = Math.sqrt(Math.random()); g.fillStyle = `rgba(${pick(['92,72,40', '70,56,30', '110,88,48'])},${rnd(0.25, 0.5)})`; g.fillRect(f.x + Math.cos(a) * f.rx * d, f.y + Math.sin(a) * f.ry * d, rnd(2, 5), rnd(1, 3)); }
  }
  if (farm) {                           // farm field: wheat or ploughed rows
    const fl = farm.field; g.fillStyle = fl.crop === 'wheat' ? '#b79a45' : '#6e5237'; g.fillRect(fl.x, fl.y, fl.w, fl.h);
    for (let x = fl.x; x < fl.x + fl.w; x += 7) { g.fillStyle = fl.crop === 'wheat' ? `rgba(${pick(['150,120,40', '200,170,80', '120,100,40'])},0.55)` : `rgba(${pick(['90,64,40', '60,44,28'])},0.6)`; g.fillRect(x, fl.y, 3.5, fl.h); }
    g.fillStyle = 'rgba(110,92,58,0.8)'; g.fillRect(farm.x - 20, farm.y - 20, farm.w + 40, farm.h + 40);   // yard
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${pick(['80,66,40', '140,124,84'])},0.4)`; g.fillRect(farm.x - 20 + rnd(0, farm.w + 40), farm.y - 20 + rnd(0, farm.h + 40), rnd(2, 6), rnd(2, 4)); }
  }
  if (pond) {                           // muddy bank
    const grad = g.createRadialGradient(pond.x, pond.y, pond.r * 0.6, pond.x, pond.y, pond.r * 1.5);
    grad.addColorStop(0, 'rgba(60,52,36,0.95)'); grad.addColorStop(0.55, 'rgba(110,98,66,0.8)'); grad.addColorStop(1, 'rgba(110,98,66,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(pond.x, pond.y, pond.r * 1.5, 0, 7); g.fill();
  }
  for (const o of obstacles) if (o.kind === 'building' || o.kind === 'container') {   // aprons and yards
    g.fillStyle = o.style === 'warehouse' || o.style === 'concrete' ? 'rgba(138,134,124,0.85)' : 'rgba(120,104,70,0.7)';
    g.fillRect(o.x - 22, o.y - 22, o.w + 44, o.h + 44);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${pick(['80,76,70', '170,166,156'])},0.3)`; g.fillRect(o.x - 22 + rnd(0, o.w + 44), o.y - 22 + rnd(0, o.h + 44), rnd(2, 6), rnd(2, 4)); }
  }
  for (const r of roads) {              // roads: gravel shoulder, surface, markings
    const trace = () => { g.beginPath(); g.moveTo(r.pts[0].x, r.pts[0].y); for (const p of r.pts) g.lineTo(p.x, p.y); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(128,118,92,0.75)'; g.lineWidth = r.half * 2 + 26; trace(); g.stroke();
    g.strokeStyle = r.kind === 'asphalt' ? '#3a3c40' : '#836a48'; g.lineWidth = r.half * 2; trace(); g.stroke();
    for (let i = 0; i < 5000; i++) { const p = r.pts[Math.floor(Math.random() * r.pts.length)]; g.fillStyle = r.kind === 'asphalt' ? `rgba(${pick(['70,72,76', '30,32,34', '110,112,116'])},0.5)` : `rgba(${pick(['100,80,52', '150,124,86', '70,56,36'])},0.5)`; g.fillRect(p.x + rnd(-r.half, r.half), p.y + rnd(-r.half, r.half), rnd(1.5, 4), rnd(1.5, 3)); }
    if (r.kind === 'asphalt') {
      g.strokeStyle = 'rgba(225,225,215,0.8)'; g.lineWidth = 3;
      for (const sd of [-1, 1]) { g.beginPath(); r.pts.forEach((p, i) => { const q = r.pts[Math.min(i + 1, r.pts.length - 1)], l = Math.hypot(q.x - p.x, q.y - p.y) || 1, nx = -(q.y - p.y) / l, ny = (q.x - p.x) / l; const x = p.x + nx * (r.half - 9) * sd, y = p.y + ny * (r.half - 9) * sd; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
      g.strokeStyle = 'rgba(232,200,70,0.9)'; g.lineWidth = 3; g.setLineDash([30, 26]); trace(); g.stroke(); g.setLineDash([]);
    } else {
      g.strokeStyle = 'rgba(70,54,34,0.45)'; g.lineWidth = 7;
      for (const sd of [-0.4, 0.4]) { g.beginPath(); r.pts.forEach((p, i) => { const q = r.pts[Math.min(i + 1, r.pts.length - 1)], l = Math.hypot(q.x - p.x, q.y - p.y) || 1, nx = -(q.y - p.y) / l, ny = (q.x - p.x) / l; const x = p.x + nx * r.half * sd, y = p.y + ny * r.half * sd; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
    }
  }
}

// ---------- Procedural textures (grey-ish, tinted by material colour) ----------
const TEX = {};
function ctex(key, w, h, draw) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return TEX[key] = t;
}
function speckle(g, w, h, n, cols, a, sz) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${pick(cols)},${rnd(a[0], a[1])})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(1, sz), rnd(1, sz)); } }
const texPlaster = () => ctex('plaster', 256, 256, (g, w, h) => { g.fillStyle = '#e4e0d6'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1800, ['120,110,96', '255,255,255', '90,84,70'], [0.05, 0.22], 3); for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(90,80,60,${rnd(0.03, 0.08)})`; g.fillRect(rnd(0, w), 0, rnd(4, 18), h); } });
const texBrick = () => ctex('brick', 256, 256, (g, w, h) => { g.fillStyle = '#7e7468'; g.fillRect(0, 0, w, h); for (let r = 0; r < 16; r++) for (let c = -1; c < 8; c++) { g.fillStyle = `rgb(${rnd(160, 205) | 0},${rnd(88, 118) | 0},${rnd(70, 94) | 0})`; g.fillRect(c * 32 + (r % 2 ? 16 : 0) + 1, r * 16 + 1, 30, 14); } speckle(g, w, h, 900, ['40,30,24', '220,200,180'], [0.05, 0.2], 2); });
const texConcrete = () => ctex('concrete', 256, 256, (g, w, h) => { g.fillStyle = '#a7a59e'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2600, ['70,70,66', '210,208,200', '120,118,112'], [0.06, 0.25], 3); g.strokeStyle = 'rgba(40,40,36,0.25)'; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } });
const texTile = () => ctex('tile', 256, 256, (g, w, h) => { g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h); for (let r = 0; r < 16; r++) for (let c = 0; c < 12; c++) { const v = rnd(150, 215) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(c * 21.4 + (r % 2 ? 10 : 0), r * 16, 20, 14); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(c * 21.4 + (r % 2 ? 10 : 0), r * 16 + 13, 20, 3); } });
const texMetal = () => ctex('metal', 128, 128, (g, w, h) => { g.fillStyle = '#b4b6b8'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0.0)'); g.fillStyle = gr; g.fillRect(x, 0, 8, h); } speckle(g, w, h, 500, ['90,70,50', '255,255,255'], [0.05, 0.2], 3); });
const texWood = () => ctex('wood', 256, 256, (g, w, h) => { g.fillStyle = '#8a6a44'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) { g.fillStyle = `rgba(0,0,0,${rnd(0.05, 0.18)})`; g.fillRect(0, y, w, 2); for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(${pick(['60,40,20', '170,130,90'])},0.35)`; g.beginPath(); const yy = y + rnd(2, 30); g.moveTo(0, yy); g.lineTo(w, yy + rnd(-2, 2)); g.stroke(); } } });
const texGrassMask = () => ctex('grassMask', 128, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { const x = rnd(8, w - 8), hh = rnd(50, 124), lean = rnd(-16, 16); g.strokeStyle = '#fff'; g.lineWidth = rnd(2, 4); g.lineCap = 'round'; g.beginPath(); g.moveTo(x, h + 4); g.quadraticCurveTo(x + lean * 0.3, h - hh * 0.6, x + lean, h - hh); g.stroke(); } });
const texGrassCol = () => ctex('grassCol', 64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#46702c'); gr.addColorStop(0.5, '#66903a'); gr.addColorStop(1, '#b0c462'); g.fillStyle = gr; g.fillRect(0, 0, w, h); speckle(g, w, h, 300, ['30,60,20', '150,170,70'], [0.1, 0.35], 3); });

const MATS = {};
function stdMat(tex, color, rough = 0.9, metal = 0, extra = {}) {
  const key = (tex ? tex.uuid : 'n') + color + rough + metal + JSON.stringify(extra);
  return MATS[key] || (MATS[key] = new THREE.MeshStandardMaterial({ map: tex || null, color: srgb(color), roughness: rough, metalness: metal, ...extra }));
}
function texBox(w, h, d, mat, tm = 2.5) {       // box whose texture tiles every `tm` metres on every face
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tm, uv.getY(i) * dims[f][1] / tm); }
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function put(m, x, y, z, ry = 0) { m.position.set(x, y, z); m.rotation.y = ry; return m; }
const nocast = m => { m.castShadow = false; return m; };
function gableRoof(len, wid, rise, over, mat, tm = 2) {   // ridge along x, centred on the origin at eave height
  const hx = len / 2 + over, hz = wid / 2 + over, sl = Math.hypot(hz, rise);
  const P = [], UV = [];
  const quad = (a, b, c, d, uA, uB, uC, uD) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); UV.push(...uA, ...uB, ...uC, ...uA, ...uC, ...uD); };
  quad([-hx, 0, -hz], [hx, 0, -hz], [hx, rise, 0], [-hx, rise, 0], [0, 0], [2 * hx / tm, 0], [2 * hx / tm, sl / tm], [0, sl / tm]);
  quad([-hx, rise, 0], [hx, rise, 0], [hx, 0, hz], [-hx, 0, hz], [0, sl / tm], [2 * hx / tm, sl / tm], [2 * hx / tm, 0], [0, 0]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function gableEnds(len, wid, rise, mat) {
  const P = [], hz = wid / 2;
  for (const x of [-len / 2, len / 2]) P.push(x, 0, -hz, x, 0, hz, x, rise, 0);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
}
const glassMat = () => stdMat(null, '#1c2a38', 0.08, 0.5);
function windowAt(g, x, y, z, ry, w = 1.0, h = 1.3) {          // frame + glass + sill, facing +z before rotation
  const grp = new THREE.Group();
  grp.add(nocast(put(new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.1), stdMat(null, '#e6e4de', 0.6)), 0, 0, 0)));
  grp.add(nocast(put(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), glassMat()), 0, 0, 0.01)));
  grp.add(nocast(put(new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.16), stdMat(null, '#e6e4de', 0.6)), 0, 0, 0.02)));
  grp.add(nocast(put(new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.08, 0.2), stdMat(null, '#cfcac0', 0.8)), 0, -h / 2 - 0.12, 0.08)));
  grp.position.set(x, y, z); grp.rotation.y = ry; g.add(grp);
}
// Place windows along the four faces of a len x wid box (len along x), skipping `skip` (door side)
function windowsAround(g, len, wid, y0, floors, doorFace) {
  for (let f = 0; f < floors; f++) {
    const y = y0 + 1.7 + f * 3.0;
    for (const [face, L, ry, ox, oz] of [[0, len, 0, 0, wid / 2 + 0.05], [1, len, Math.PI, 0, -wid / 2 - 0.05], [2, wid, Math.PI / 2, len / 2 + 0.05, 0], [3, wid, -Math.PI / 2, -len / 2 - 0.05, 0]]) {
      const n = Math.max(1, Math.floor(L / 2.8));
      for (let i = 0; i < n; i++) {
        const t = (i - (n - 1) / 2) * (L / n);
        if (face === 0 && f === 0 && doorFace && Math.abs(t) < 1.2) continue;
        const px = face < 2 ? t * (face === 1 ? -1 : 1) : ox, pz = face < 2 ? oz : t * (face === 2 ? -1 : 1);
        windowAt(g, px, y, pz, ry);
      }
    }
  }
}

function makeBuilding(o) {
  const bw = Math.max(o.w, o.h) / U, bd = Math.min(o.w, o.h) / U, g = new THREE.Group(), s = o.style, floors = o.floors || 1;
  const T = { plaster: texPlaster(), brick: texBrick(), concrete: texConcrete(), tile: texTile(), metal: texMetal(), wood: texWood() };
  let wallH = 3.0 * floors, rise = 1.6;
  const wallMat = s === 'warehouse' ? stdMat(T.metal, o.wall || '#9aa2a8', 0.55, 0.45) : s === 'barn' ? stdMat(T.wood, o.wall, 0.85) : s === 'concrete' ? stdMat(T.concrete, '#d4d2cc', 0.95) : stdMat(Math.random() < 0.3 ? T.brick : T.plaster, o.wall, 0.95);
  const y0 = 0.35;
  if (s === 'warehouse') { wallH = 6.0; rise = 1.7; } if (s === 'barn') { wallH = 4.2; rise = 2.6; } if (s === 'concrete') { wallH = 3.2 * floors + 0.2; }
  g.add(put(texBox(bw + 0.25, 0.4, bd + 0.25, stdMat(T.concrete, '#8f8d86', 1)), 0, 0.2, 0));
  g.add(put(texBox(bw, wallH, bd, wallMat, s === 'warehouse' ? 2 : 2.5), 0, y0 + wallH / 2, 0));
  const top = y0 + wallH;
  if (s === 'concrete') {
    g.add(put(texBox(bw + 0.2, 0.3, bd + 0.2, stdMat(T.concrete, '#b8b6ae', 1)), 0, top + 0.15, 0));
    for (const [px, pz, w, d] of [[0, bd / 2, bw + 0.2, 0.2], [0, -bd / 2, bw + 0.2, 0.2], [bw / 2, 0, 0.2, bd], [-bw / 2, 0, 0.2, bd]]) g.add(put(texBox(w, 0.7, d, stdMat(T.concrete, '#c8c6be', 1)), px, top + 0.65, pz));
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.5, 16), stdMat(null, '#b9bcc0', 0.5, 0.5)); tank.castShadow = true; g.add(put(tank, bw / 4, top + 1.2, 0));
    g.add(put(texBox(1.2, 0.8, 0.9, stdMat(T.metal, '#cfd2d4', 0.6, 0.4)), -bw / 4, top + 0.7, 0.2));
    windowsAround(g, bw, bd, y0, floors, true);
  } else if (s === 'warehouse' || s === 'barn') {
    const roofMat = new THREE.MeshStandardMaterial({ map: T.metal, color: srgb(s === 'barn' ? '#6a6e74' : '#8a9096'), roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide });
    const r = gableRoof(bw, bd, rise, 0.5, roofMat, 1.6); r.position.y = top; g.add(r);
    g.add(put(gableEnds(bw, bd, rise, wallMat), 0, top, 0));
    const door = nocast(new THREE.Mesh(new THREE.BoxGeometry(s === 'barn' ? 3.4 : 4.2, s === 'barn' ? 3.4 : 4.2, 0.2), stdMat(null, s === 'barn' ? '#6d2a22' : '#4a4f55', 0.7, 0.2)));
    g.add(put(door, 0, y0 + (s === 'barn' ? 1.7 : 2.1), bd / 2 + 0.06));
    g.add(nocast(put(new THREE.Mesh(new THREE.BoxGeometry(s === 'barn' ? 3.8 : 4.6, 0.15, 0.3), stdMat(null, '#e4e0d6', 0.8)), 0, y0 + (s === 'barn' ? 3.45 : 4.25), bd / 2 + 0.1)));
    for (let i = 0; i < Math.floor(bw / 4); i++) { const x = (i - (Math.floor(bw / 4) - 1) / 2) * 4; if (Math.abs(x) > 2.6) windowAt(g, x, y0 + wallH - 1.2, bd / 2 + 0.05, 0, 1.4, 0.7); windowAt(g, x, y0 + wallH - 1.2, -bd / 2 - 0.05, Math.PI, 1.4, 0.7); }
    if (s === 'warehouse') for (let i = 0; i < 3; i++) { const v = nocast(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 10), stdMat(null, '#c4c6c8', 0.5, 0.6))); g.add(put(v, (i - 1) * bw / 4, top + rise + 0.3, 0)); }
  } else {
    const roofMat = new THREE.MeshStandardMaterial({ map: T.tile, color: srgb(o.roof), roughness: 0.85, side: THREE.DoubleSide });
    const r = gableRoof(bw, bd, 1.2 + bd * 0.28, 0.45, roofMat, 1.8); r.position.y = top; g.add(r);
    g.add(put(gableEnds(bw, bd, 1.2 + bd * 0.28, wallMat), 0, top, 0));
    g.add(put(texBox(0.7, 1.8, 0.7, stdMat(T.brick, '#b8b0a4', 1)), bw * 0.28, top + 1.3, bd * 0.12));         // chimney
    g.add(put(texBox(0.9, 0.15, 0.9, stdMat(T.concrete, '#9a9890', 1)), bw * 0.28, top + 2.25, bd * 0.12));
    windowsAround(g, bw, bd, y0, floors, true);
    g.add(nocast(put(new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 0.14), stdMat(null, '#e4e0d6', 0.7)), 0, y0 + 1.15, bd / 2 + 0.05)));          // door frame
    g.add(nocast(put(new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.16), stdMat(T.wood, '#5a3a22', 0.7)), 0, y0 + 1.05, bd / 2 + 0.08)));
    g.add(put(texBox(2.0, 0.2, 1.0, stdMat(T.concrete, '#a7a59e', 1)), 0, 0.25, bd / 2 + 0.55));                                                       // step
  }
  o.hgt = y0 + wallH + rise * 0.8;
  if (o.w < o.h) g.rotation.y = Math.PI / 2;
  g.position.set(wx(o.x + o.w / 2), hAt(wx(o.x + o.w / 2), wz(o.y + o.h / 2)), wz(o.y + o.h / 2));
  return g;
}

function wheelSet(g, L, Wd, r, x0 = 0.32) {
  const m = stdMat(null, '#141414', 0.9);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.24, 14), m); w.rotation.x = Math.PI / 2; w.castShadow = true;
    g.add(put(w, sx * L * x0, r, sz * (Wd / 2 - 0.05)));
  }
}
function makeVehicle(o) {
  const L = Math.max(o.w, o.h) / U, Wd = Math.min(o.w, o.h) / U, g = new THREE.Group(), wreck = o.type === 'wreck';
  const body = stdMat(null, wreck ? '#2a2420' : o.type === 'jeep' ? '#5a6340' : o.col, wreck ? 0.95 : 0.35, wreck ? 0.1 : 0.55), glass = wreck ? stdMat(null, '#111', 1) : glassMat(), dark = stdMat(null, '#18191b', 0.7, 0.2);
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.castShadow = true; b.receiveShadow = true; g.add(put(b, x, y, z)); return b; };
  if (o.type === 'truck') {
    box(L * 0.28, 1.5, Wd, body, L * 0.36, 1.3, 0); box(L * 0.18, 0.8, Wd * 0.94, glass, L * 0.4, 1.7, 0);
    box(L * 0.66, 2.2, Wd, stdMat(null, '#c8c8c2', 0.7, 0.2), -L * 0.17, 1.65, 0); box(L, 0.3, Wd * 0.9, dark, 0, 0.55, 0);
    wheelSet(g, L, Wd, 0.5, 0.36); for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.24, 14), stdMat(null, '#141414', 0.9)); w.rotation.x = Math.PI / 2; g.add(put(w, -L * 0.3, 0.5, sz * (Wd / 2 - 0.05))); }
  } else if (o.type === 'van') {
    box(L, 1.0, Wd, body, 0, 0.8, 0); box(L * 0.88, 0.95, Wd * 0.96, body, -L * 0.04, 1.75, 0); box(L * 0.3, 0.6, Wd * 0.98, glass, L * 0.32, 1.78, 0);
    wheelSet(g, L, Wd, 0.36);
  } else if (o.type === 'pickup') {
    box(L, 0.7, Wd, body, 0, 0.75, 0); box(L * 0.32, 0.65, Wd * 0.94, body, L * 0.1, 1.38, 0); box(L * 0.3, 0.45, Wd * 0.96, glass, L * 0.11, 1.4, 0);
    box(L * 0.44, 0.35, 0.08, body, -L * 0.25, 1.2, Wd / 2 - 0.04); box(L * 0.44, 0.35, 0.08, body, -L * 0.25, 1.2, -Wd / 2 + 0.04); box(0.08, 0.35, Wd, body, -L * 0.47, 1.2, 0);
    wheelSet(g, L, Wd, 0.38);
  } else if (o.type === 'jeep') {
    box(L, 0.7, Wd, body, 0, 0.8, 0); box(0.1, 0.55, Wd * 0.9, glass, L * 0.14, 1.4, 0);
    for (const sz of [-1, 1]) box(0.1, 0.8, 0.1, body, -L * 0.2, 1.4, sz * Wd * 0.4); box(0.1, 0.1, Wd * 0.85, body, -L * 0.2, 1.8, 0);
    wheelSet(g, L, Wd, 0.4);
  } else {
    box(L, 0.65, Wd, body, 0, 0.72, 0); box(L * 0.52, 0.55, Wd * 0.9, body, -L * 0.05, 1.28, 0); box(L * 0.5, 0.4, Wd * 0.93, glass, -L * 0.05, 1.28, 0);
    wheelSet(g, L, Wd, 0.34);
  }
  if (!wreck) { for (const sz of [-1, 1]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: '#f4f0d8', emissive: '#f4f0d8', emissiveIntensity: 0.5 })); g.add(put(hl, L / 2, 0.85, sz * Wd * 0.33)); const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.3), new THREE.MeshStandardMaterial({ color: '#a01010', emissive: '#a01010', emissiveIntensity: 0.4 })); g.add(put(tl, -L / 2, 0.85, sz * Wd * 0.33)); } }
  else { g.rotation.z = rnd(-0.05, 0.05); }
  const hz = o.w >= o.h; if (!hz) g.rotation.y = Math.PI / 2;
  if (Math.random() < 0.5 && hz) g.rotation.y = Math.PI;
  g.position.set(wx(o.x + o.w / 2), hAt(wx(o.x + o.w / 2), wz(o.y + o.h / 2)), wz(o.y + o.h / 2));
  return g;
}
function makeContainer(o) {
  const L = Math.max(o.w, o.h) / U, Wd = Math.min(o.w, o.h) / U, g = new THREE.Group(), m = stdMat(texMetal(), o.col, 0.55, 0.5);
  g.add(put(texBox(L, 2.6, Wd, m, 1.2), 0, 1.3, 0));
  const dm = stdMat(null, '#2a2a2c', 0.6, 0.5); for (const sz of [-0.2, 0.2]) g.add(nocast(put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.3, 0.08), dm), L / 2 + 0.03, 1.3, sz * Wd)));
  if (o.w < o.h) g.rotation.y = Math.PI / 2;
  g.position.set(wx(o.x + o.w / 2), hAt(wx(o.x + o.w / 2), wz(o.y + o.h / 2)), wz(o.y + o.h / 2));
  return g;
}
function makeProp(o) {
  const g = new THREE.Group(), cx = wx(o.x + (o.w || 0) / 2), cz = wz(o.y + (o.h || 0) / 2);
  if (o.kind === 'crate') {
    const w = o.w / U, d = o.h / U, wood = stdMat(texWood(), '#a88660', 0.8), n = Math.max(1, Math.round(Math.max(w, d) / 1.3));
    for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * 1.3; const c = texBox(1.2, 1.2, 1.2, wood, 1.2); g.add(put(c, w >= d ? off : 0, 0.6, w >= d ? 0 : off, rnd(-0.1, 0.1))); if (Math.random() < 0.4) g.add(put(texBox(1.2, 1.2, 1.2, wood, 1.2), w >= d ? off : 0, 1.8, w >= d ? 0 : off, rnd(-0.2, 0.2))); }
  } else if (o.kind === 'barrier') {
    const L = Math.max(o.w, o.h) / U, c = stdMat(texConcrete(), '#c8c6c0', 1);
    g.add(put(texBox(L, 0.45, 0.8, c, 1.5), 0, 0.22, 0)); g.add(put(texBox(L, 0.7, 0.4, c, 1.5), 0, 0.8, 0)); g.add(put(texBox(L, 0.2, 0.3, stdMat(null, '#c42b20', 0.8), 1.5), 0, 0.5, 0.36));
    if (o.w < o.h) g.rotation.y = Math.PI / 2;
  } else if (o.kind === 'sandbag') {
    const L = Math.max(o.w, o.h) / U, bagA = stdMat(null, '#a8946a', 1), bagB = stdMat(null, '#968258', 1);
    for (let r = 0; r < 4; r++) for (let i = 0; i < Math.floor(L / 0.7) - (r % 2); i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), (i + r) % 2 ? bagA : bagB); b.scale.set(1.0, 0.55, 0.85); b.castShadow = true; b.receiveShadow = true; g.add(put(b, (i - (Math.floor(L / 0.7) - 1) / 2) * 0.7 + (r % 2) * 0.35, 0.2 + r * 0.26, 0)); }
    if (o.w < o.h) g.rotation.y = Math.PI / 2;
  } else if (o.kind === 'fence') {
    const L = Math.max(o.w, o.h) / U, wood = stdMat(texWood(), '#8a7352', 0.9), n = Math.max(2, Math.round(L / 2));
    for (let i = 0; i < n; i++) g.add(put(texBox(0.12, 1.3, 0.12, wood, 1), (i - (n - 1) / 2) * (L / (n - 1)), 0.65, 0));
    for (const y of [0.45, 0.95]) g.add(put(texBox(L, 0.1, 0.05, wood, 1), 0, y, 0.07));
    if (o.w < o.h) g.rotation.y = Math.PI / 2;
  } else if (o.kind === 'barrel') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14), stdMat(null, o.col, 0.45, 0.6)); b.castShadow = true; b.receiveShadow = true; g.add(put(b, 0, 0.45, 0));
    for (const y of [0.2, 0.7]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 14), stdMat(null, '#2a2a2a', 0.5, 0.7)); g.add(put(r, 0, y, 0)); }
  } else if (o.kind === 'bale') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 16), stdMat(null, '#c4a54a', 1)); b.rotation.z = Math.PI / 2; b.castShadow = true; b.receiveShadow = true; g.add(put(b, 0, 0.7, 0)); g.rotation.y = rnd(0, 3);
  } else if (o.kind === 'tower') {
    const steel = stdMat(null, '#8c9296', 0.5, 0.6);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 9, 8), steel); l.castShadow = true; l.position.set(sx * 1.4, 4.5, sz * 1.4); l.rotation.set(-sz * 0.05, 0, sx * 0.05); g.add(l); }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.4, 20), stdMat(null, '#b8c0c4', 0.45, 0.6)); tank.castShadow = true; g.add(put(tank, 0, 10.5, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.2, 20), stdMat(null, '#5a6064', 0.5, 0.6)); roof.castShadow = true; g.add(put(roof, 0, 12.8, 0));
  }
  g.position.set(cx, hAt(cx, cz), cz);
  return g;
}

// ---------- Vegetation templates (merged, vertex-coloured) and instancing ----------
function mergeGeos(list) {         // list of {geo, color, matrix}
  const pos = [], nor = [], col = [], idx = []; let base = 0;
  for (const { geo, color, matrix } of list) {
    const g = geo.clone().applyMatrix4(matrix), c = srgb(color), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); const v = rnd(0.88, 1.08); col.push(c.r * v, c.g * v, c.b * v); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.setIndex(idx);
  return out;
}
const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(sx, sy, sz));
function blob(r) {
  const g = new THREE.SphereGeometry(r, 12, 9), p = g.attributes.position, a = rnd(0, 6), b = rnd(0, 6);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / r, y = p.getY(i) / r, z = p.getZ(i) / r, k = 1 + 0.13 * Math.sin(x * 3.1 + a) * Math.sin(y * 2.7 + b) + 0.08 * Math.sin(z * 4.3 + a * 2); p.setXYZ(i, x * r * k, y * r * k * 0.85, z * r * k); }
  g.computeVertexNormals(); return g;
}
function treeTemplate(type, v) {
  const parts = [], trunk = (h, r0, r1, col) => ({ geo: new THREE.CylinderGeometry(r1, r0, h, 8), color: col, matrix: M4(0, h / 2, 0) });
  if (type === 'pine') {
    const h = rnd(7, 9.5); parts.push(trunk(h * 0.8, 0.3, 0.12, '#4a3524'));
    const layers = 6, g = pick(['#2d5a2e', '#27502a', '#33652f']);
    for (let i = 0; i < layers; i++) { const t = i / layers, r = (1 - t) * 2.2 + 0.4, y = 1.8 + t * (h - 2.6); parts.push({ geo: new THREE.ConeGeometry(r, 2.1, 9), color: g, matrix: M4(0, y + 1, 0, 1, 1, 1, 0, 0) }); }
  } else if (type === 'oak') {
    parts.push(trunk(3.4, 0.4, 0.22, '#4f3a28'));
    parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.16, 2, 6), color: '#4f3a28', matrix: M4(0.5, 3.5, 0, 1, 1, 1, 0, -0.7) }, { geo: new THREE.CylinderGeometry(0.1, 0.16, 2, 6), color: '#4f3a28', matrix: M4(-0.5, 3.4, 0.2, 1, 1, 1, 0, 0.7) });
    const g = pick(['#3f7a33', '#477f35', '#356b2e']);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, d = i === 0 ? 0 : rnd(1.1, 1.9); parts.push({ geo: blob(rnd(1.3, 2.0)), color: i % 3 === 0 ? '#52913c' : g, matrix: M4(Math.cos(a) * d, 4.8 + rnd(-0.4, 1.2), Math.sin(a) * d) }); }
  } else {
    parts.push(trunk(5.2, 0.2, 0.1, '#d9d6cc'));
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, d = rnd(0.5, 1.2); parts.push({ geo: blob(rnd(0.9, 1.4)), color: pick(['#74a64a', '#82b055', '#6a9c44']), matrix: M4(Math.cos(a) * d, 4.6 + rnd(-0.3, 1.5), Math.sin(a) * d) }); }
  }
  return mergeGeos(parts);
}
function instanced(geo, mat, items, place) {
  const im = new THREE.InstancedMesh(geo, mat, items.length), m = new THREE.Matrix4(), c = new THREE.Color();
  items.forEach((it, i) => { place(it, m, c); im.setMatrixAt(i, m); im.setColorAt(i, c); });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; return im;
}

function buildWorldMeshes() {
  if (worldGroup) { scene.remove(worldGroup); worldGroup.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); }
  worldGroup = new THREE.Group(); scene.add(worldGroup);
  const wg = worldGroup;
  // terrain
  const S = HNX + 1, pos = new Float32Array(S * (HNZ + 1) * 3), uv = new Float32Array(S * (HNZ + 1) * 2), idx = [];
  for (let j = 0; j <= HNZ; j++) for (let i = 0; i <= HNX; i++) {
    const k = j * S + i; pos[k * 3] = i - HNX / 2; pos[k * 3 + 1] = HG[k]; pos[k * 3 + 2] = j - HNZ / 2; uv[k * 2] = i / HNX; uv[k * 2 + 1] = 1 - j / HNZ;
    if (i < HNX && j < HNZ) idx.push(k, k + S, k + 1, k + 1, k + S, k + S + 1);
  }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  if (groundTex) groundTex.dispose();
  groundTex = new THREE.CanvasTexture(groundCanvas); groundTex.encoding = THREE.sRGBEncoding; groundTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); groundTex.wrapS = groundTex.wrapT = THREE.ClampToEdgeWrapping;
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, metalness: 0 })); terrain.receiveShadow = true; wg.add(terrain);
  if (pond) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(pond.r / U * 1.25, 48), new THREE.MeshStandardMaterial({ color: srgb('#2d5f72'), roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.88 }));
    w.rotation.x = -Math.PI / 2; w.position.set(wx(pond.x), -0.3, wz(pond.y)); w.receiveShadow = true; wg.add(w);
  }
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: srgb('#415a2f'), roughness: 1 }));
  outside.rotation.x = -Math.PI / 2; outside.position.y = -0.25; outside.receiveShadow = true; wg.add(outside);
  // buildings and props
  for (const o of obstacles) {
    if (o.kind === 'building') wg.add(makeBuilding(o));
    else if (o.kind === 'vehicle') wg.add(makeVehicle(o));
    else if (o.kind === 'container') wg.add(makeContainer(o));
    else if (['crate', 'barrier', 'sandbag', 'fence', 'barrel', 'bale', 'tower'].includes(o.kind)) wg.add(makeProp(o));
  }
  // power poles and wires
  const woodM = stdMat(null, '#5b4630', 0.9), wire = [];
  for (let i = 0; i < poles.length; i++) {
    const p = poles[i], x = wx(p.x), z = wz(p.y), y = hAt(x, z);
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 9, 8), woodM); pl.castShadow = true; wg.add(put(pl, x, y + 4.5, z));
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 2.4), woodM); wg.add(put(arm, x, y + 8.5, z, 0));
    p.top = { x, y: y + 8.5, z };
    if (i > 0) { const a = poles[i - 1].top, b = p.top; for (const dz of [-1, 0, 1]) { let prev = null; for (let k = 0; k <= 10; k++) { const t = k / 10, q = [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 0.7, a.z + (b.z - a.z) * t + dz * 1.0]; if (prev) wire.push(...prev, ...q); prev = q; } } }
  }
  if (wire.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3)); wg.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: srgb('#1a1a1a') }))); }
  // trees (instanced per template)
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  for (const type of ['pine', 'oak', 'birch']) {
    const items = obstacles.concat(borderTrees).filter(o => o.kind === 'tree' && o.type === type); if (!items.length) continue;
    const variants = [treeTemplate(type), treeTemplate(type), treeTemplate(type)];
    variants.forEach((geo, vi) => {
      const list = items.filter((_, i) => i % 3 === vi); if (!list.length) return;
      wg.add(instanced(geo, treeMat, list, (o, m, c) => { const x = wx(o.x), z = wz(o.y); m.compose(new THREE.Vector3(x, hAt(x, z) - 0.05, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.ry), new THREE.Vector3(o.s, o.s * rnd(0.95, 1.1), o.s)); c.setRGB(rnd(0.9, 1.05), rnd(0.9, 1.05), rnd(0.9, 1.05)); }));
    });
  }
  // rocks
  const rockGeos = [0, 1, 2].map(() => { const g = new THREE.IcosahedronGeometry(1, 1); const q = g.attributes.position; for (let i = 0; i < q.count; i++) { const k = 1 + rnd(-0.16, 0.16); q.setXYZ(i, q.getX(i) * k, q.getY(i) * k * 0.8, q.getZ(i) * k); } const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.max(p.getY(i), -0.35)); g.computeVertexNormals(); return g; });
  const rockMat = new THREE.MeshStandardMaterial({ color: srgb('#8a8984'), roughness: 0.95, flatShading: true });
  for (let v = 0; v < 3; v++) { const list = obstacles.filter(o => o.kind === 'rock' && o.v === v); if (list.length) wg.add(instanced(rockGeos[v], rockMat, list, (o, m, c) => { const x = wx(o.x), z = wz(o.y), r = o.r / U; m.compose(new THREE.Vector3(x, hAt(x, z) + r * 0.25, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.ry), new THREE.Vector3(r * 1.1, r * 0.9, r)); c.setRGB(rnd(0.75, 1.1), rnd(0.75, 1.05), rnd(0.7, 1)); })); }
  // bushes
  if (bushes.length) {
    const bg = mergeGeos([0, 1, 2].map(i => ({ geo: blob(0.7 + i * 0.05), color: pick(['#3c6b30', '#456f34', '#355f2c']), matrix: M4(Math.cos(i * 2.1) * 0.5, 0.55, Math.sin(i * 2.1) * 0.5) })));
    wg.add(instanced(bg, treeMat, bushes, (o, m, c) => { const x = wx(o.x), z = wz(o.y); m.compose(new THREE.Vector3(x, hAt(x, z), z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.ry), new THREE.Vector3(o.s, o.s, o.s)); c.setRGB(rnd(0.85, 1.1), rnd(0.9, 1.1), rnd(0.8, 1)); }));
  }
  // grass tufts (crossed alpha-tested quads)
  const gp = [], N = coarse ? 3500 : 6500;
  for (let i = 0; i < N * 3 && gp.length < N; i++) {
    const x = rnd(30, FW - 30), y = rnd(30, FH - 30);
    if (roadDist(x, y) < 40 || (pond && Math.hypot(x - pond.x, y - pond.y) < pond.r * 1.05) || !pointFree(x, y, 6)) continue;
    if (farm && farm.field.x < x && x < farm.field.x + farm.field.w && farm.field.y < y && y < farm.field.y + farm.field.h) continue;
    gp.push({ x, y, s: rnd(0.7, 1.4), ry: rnd(0, 6.28) });
  }
  const qa = new THREE.PlaneGeometry(0.9, 0.55), qb = qa.clone().rotateY(Math.PI / 2); qa.translate(0, 0.27, 0); qb.translate(0, 0.27, 0);
  const gg = new THREE.BufferGeometry(); const uvs = [], ps = [], ns = [], ix = [];
  [qa, qb].forEach((q, k) => { const p = q.attributes.position, u = q.attributes.uv, n = q.attributes.normal; for (let i = 0; i < p.count; i++) { ps.push(p.getX(i), p.getY(i), p.getZ(i)); ns.push(0, 1, 0); uvs.push(u.getX(i), u.getY(i)); } for (let i = 0; i < q.index.count; i++) ix.push(q.index.getX(i) + k * 4); });
  gg.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); gg.setAttribute('normal', new THREE.Float32BufferAttribute(ns, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); gg.setIndex(ix);
  const grass = instanced(gg, (() => { const m = texGrassMask(); m.encoding = THREE.LinearEncoding; return new THREE.MeshStandardMaterial({ map: texGrassCol(), alphaMap: m, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: 0xffffff }); })(), gp, (o, m, c) => { const x = wx(o.x), z = wz(o.y); m.compose(new THREE.Vector3(x, hAt(x, z), z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.ry), new THREE.Vector3(o.s, o.s, o.s)); c.setRGB(rnd(0.8, 1.1), rnd(0.85, 1.1), rnd(0.75, 1.0)); });
  grass.castShadow = false; wg.add(grass);
}
let groundTex = null;
