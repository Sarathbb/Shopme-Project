// ---------- Real-world map: the streets and buildings of an actual place (see realmap_data.js) ----------
function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
  }
  return out;
}
// walk along a polyline and call fn(x, y, tangentAngle) every `spacing` px
function walkLine(pts, spacing, fn) {
  let carry = spacing * rnd(0.2, 1);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    for (let t = carry; t < L; t += spacing * rnd(0.85, 1.2)) { fn(a.x + (b.x - a.x) * t / L, a.y + (b.y - a.y) * t / L, ang); carry = t + spacing * rnd(0.85, 1.2) - L; }
    carry = Math.max(0, carry);
  }
}
function rotRect(cx, cy, w, h, a) {      // an obstacle rect at any angle
  const hw = w / 2, hh = h / 2, ca = Math.cos(a), sa = Math.sin(a), ex = Math.abs(hw * ca) + Math.abs(hh * sa), ey = Math.abs(hw * sa) + Math.abs(hh * ca);
  return { x: cx - ex, y: cy - ey, w: ex * 2, h: ey * 2, cx, cy, hw, hh, a, ca, sa };
}

function generateReal(d) {
  MAP = { id: d.id, amp: 0.16, urban: true };
  FW = d.size[0] * U; FH = d.size[1] * U; MAP_SEED = 77;
  obstacles = []; roads = []; pond = null; forests = []; farm = null; bushes = []; poles = []; borderTrees = []; buildings = []; vehicles = [];
  for (const s of d.streets) { const line = Array.isArray(s) ? s : s.p, wd = Array.isArray(s) ? 6.6 : s.w; roads.push({ pts: densify(line.map(([x, y]) => ({ x: x * U, y: y * U })), 24), half: wd * U / 2, kind: 'asphalt', real: true }); }
  town = { x: FW / 2, y: FH / 2 };
  const wallCols = ['#e8dcc4', '#d9c9a6', '#c9b896', '#e6e2d8', '#b9c4c9', '#d7b8a0', '#e3d3b0', '#cfd8c4', '#e9c9a0', '#d8d0c0'], roofCols = ['#8c3b2f', '#6e4a3a', '#5b5f66', '#7a3e2a', '#9a4a30'];

  // houses you can walk into: real footprints, each with a door facing the nearest street
  for (const h of d.houses) {
    const w = h.d[0] * U, hh = h.d[1] * U, cx = h.c[0] * U, cy = h.c[1] * U, a = h.a, ex = Math.abs(w / 2 * Math.cos(a)) + Math.abs(hh / 2 * Math.sin(a)), ey = Math.abs(w / 2 * Math.sin(a)) + Math.abs(hh / 2 * Math.cos(a));
    setupBuilding({ kind: 'building', style: h.ar > 420 ? 'concrete' : 'house', x: cx - ex, y: cy - ey, w: ex * 2, h: ey * 2, cx, cy, ow: w, oh: hh, a0: a, wall: pick(wallCols), roof: pick(roofCols) });
  }
  // everything else: solid blocks and L-shaped buildings, extruded from the real outline
  for (const s of d.solids) {
    const pts = s.p.map(([x, y]) => [x * U, y * U]);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const floors = s.ar < 250 ? 2 : s.ar < 600 ? 3 : 4;
    obstacles.push({ kind: 'poly', pts, x: x0, y: y0, w: x1 - x0, h: y1 - y0, floors, hgt: 0.4 + floors * 3.1 + 0.5, wall: pick(wallCols), roofTone: pick(['#5e5f63', '#6a4a3e', '#4f5358', '#7a4638']) });
  }
  // spawn on the street nearest the middle of the map
  let sp = null, best = 1e9;
  for (const r of roads) for (const p of r.pts) { const dd = Math.hypot(p.x - FW / 2, p.y - FH / 2); if (dd < best && pointFree(p.x, p.y, 60)) { best = dd; sp = p; } }
  SPAWN = sp ? { x: sp.x, y: sp.y } : { x: FW / 2, y: FH / 2 };
  const okAt = (x, y, r) => x > 30 && x < FW - 30 && y > 30 && y < FH - 30 && Math.hypot(x - SPAWN.x, y - SPAWN.y) > 90 && pointFree(x, y, r);

  // street trees on the pavement, and garden trees
  const treeType = () => { const r = Math.random(); return r < 0.45 ? 'oak' : r < 0.72 ? 'birch' : 'pine'; };
  const addTree = (x, y) => obstacles.push({ kind: 'tree', type: treeType(), x, y, tr: 7, r: rnd(26, 36), s: rnd(0.85, 1.3), ry: rnd(0, 6.28) });
  for (const r of roads) walkLine(r.pts, 330, (x, y, a) => {
    for (const sd of [-1, 1]) { const px = x - Math.sin(a) * sd * (r.half + 36), py = y + Math.cos(a) * sd * (r.half + 36); if (okAt(px, py, 40) && Math.random() < 0.8) addTree(px, py); }
  });
  for (let i = 0, n = 0; i < 1500 && n < 240; i++) { const x = rnd(40, FW - 40), y = rnd(40, FH - 40); if (roadDist(x, y) > 100 && okAt(x, y, 44)) { addTree(x, y); n++; } }

  // parked cars along the kerb, cover in the streets, clutter near buildings, poles
  const vtypes = [['sedan', 88, 38], ['sedan', 88, 38], ['pickup', 100, 40], ['van', 96, 42], ['truck', 150, 52], ['jeep', 84, 40], ['bike', 38, 16], ['bike', 38, 16], ['wreck', 88, 38]];
  for (let i = 0, n = 0; i < 600 && n < 18; i++) {
    const r = pick(roads), k = Math.floor(rnd(2, Math.max(3, r.pts.length - 2))), p = r.pts[k], q = r.pts[Math.min(r.pts.length - 1, k + 1)], ang = Math.atan2(q.y - p.y, q.x - p.x), t = pick(vtypes);
    const off = pick([-1, 1]) * r.half * rnd(0.35, 0.6), cx = p.x - Math.sin(ang) * off, cy = p.y + Math.cos(ang) * off;
    if (!okAt(cx, cy, 52)) continue;
    vehicles.push(new Vehicle({ type: t[0], col: pick(['#b02a2a', '#2a4a8c', '#d8d8d8', '#1c1c1c', '#c9a227', '#3b6e3b', '#7a7a7e']), x: cx - t[1] / 2, y: cy - t[2] / 2, w: t[1], h: t[2], heading: ang + (Math.random() < 0.5 ? 0 : Math.PI) })); n++;
  }
  for (let i = 0, n = 0; i < 500 && n < 16; i++) {
    const r = pick(roads), k = Math.floor(rnd(1, Math.max(2, r.pts.length - 1))), p = r.pts[k], q = r.pts[Math.min(r.pts.length - 1, k + 1)], ang = Math.atan2(q.y - p.y, q.x - p.x) + rnd(-0.3, 0.3), t = pick(['barrier', 'barrier', 'sandbag']);
    const off = rnd(-r.half * 0.5, r.half * 0.5), cx = p.x - Math.sin(ang) * off, cy = p.y + Math.cos(ang) * off;
    if (!okAt(cx, cy, 46)) continue;
    obstacles.push({ kind: t, ...rotRect(cx, cy, t === 'barrier' ? 64 : 110, t === 'barrier' ? 18 : 26, ang) }); n++;
  }
  const near = buildings.concat(obstacles.filter(o => o.kind === 'poly'));
  for (let i = 0, n = 0; i < 400 && n < 10 && near.length; i++) { const q = pick(near), x = q.x + rnd(-30, q.w + 30), y = q.y + rnd(-30, q.h + 30), st = Math.random() < 0.4; if (okAt(x, y, 26) && !buildingAt(x, y)) { obstacles.push({ kind: 'crate', x: x - 13, y: y - 13, w: 26, h: Math.random() < 0.5 ? 26 : 52, stack: st, top: st ? 2.4 : 1.2 }); n++; } }
  for (let i = 0, n = 0; i < 400 && n < 12 && near.length; i++) { const q = pick(near), x = q.x + rnd(-30, q.w + 30), y = q.y + rnd(-30, q.h + 30); if (okAt(x, y, 14) && !buildingAt(x, y)) { obstacles.push({ kind: 'barrel', x, y, r: 7, col: pick(['#b03a2e', '#2e5f9e', '#3d7a4a', '#7a5a2a']) }); n++; } }
  for (const r of roads) {
    if (r.pts.length < 6) continue;
    walkLine(r.pts, 560, (x, y, a) => { const px = x - Math.sin(a) * (r.half + 52), py = y + Math.cos(a) * (r.half + 52); if (okAt(px, py, 12)) { const o = { kind: 'pole', x: px, y: py, r: 4 }; obstacles.push(o); poles.push(o); } });
  }
  // bushes in the gardens
  const around = obstacles.filter(o => o.kind === 'tree').concat(buildings);
  for (let i = 0; i < 160 && around.length; i++) {
    const q = pick(around), a = rnd(0, 6.28), dd = (q.r || 60) + rnd(14, 50), x = q.x + (q.w || 0) / 2 + Math.cos(a) * dd, y = q.y + (q.h || 0) / 2 + Math.sin(a) * dd;
    if (x > 40 && x < FW - 40 && y > 40 && y < FH - 40 && roadDist(x, y) > 40 && pointFree(x, y, 8) && !buildings.some(b => rectDist(x, y, b) < 16)) bushes.push({ x, y, s: rnd(0.8, 1.5), ry: rnd(0, 6) });
  }
  // a ring of trees outside the map edge
  for (let t = -300; t < FW + 300; t += 60) for (const [x, y] of [[t, -rnd(40, 300)], [t, FH + rnd(40, 300)]]) borderTrees.push({ kind: 'tree', type: pick(['pine', 'oak', 'oak', 'birch']), x, y, s: rnd(0.9, 1.5), ry: rnd(0, 6) });
  for (let t = -300; t < FH + 300; t += 60) for (const [x, y] of [[-rnd(40, 300), t], [FW + rnd(40, 300), t]]) borderTrees.push({ kind: 'tree', type: pick(['pine', 'oak', 'oak', 'birch']), x, y, s: rnd(0.9, 1.5), ry: rnd(0, 6) });
  finishMap();
}

// ---------- Solid buildings: the real outline, extruded ----------
let POLY_WALL = null;
function makePolyBuilding(o) {
  const g = new THREE.Group(), base = hAt(wx(o.x + o.w / 2), wz(o.y + o.h / 2)); o.base = base;
  if (!POLY_WALL) { POLY_WALL = texPlaster().clone(); POLY_WALL.repeat.set(0.4, 0.4); POLY_WALL.needsUpdate = true; }
  const P = o.pts.map(([x, y]) => new THREE.Vector2(wx(x), -wz(y)));
  if (THREE.ShapeUtils.isClockWise(P)) P.reverse();
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(P), { depth: o.hgt, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, [stdMat(null, o.roofTone, 0.9, 0), stdMat(POLY_WALL, o.wall, 0.95)]);
  mesh.position.y = base; mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  // windows on every floor, and one door on a street-facing wall (all instanced through winQ)
  const pm = o.pts.map(([x, y]) => [wx(x), wz(y)]);
  let doorEdge = -1, doorBest = 1e9;
  pm.forEach((a, i) => { const b = pm[(i + 1) % pm.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 4.5) return; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, dd = roadDist(mx * U + FW / 2, mz * U + FH / 2); if (dd < doorBest) { doorBest = dd; doorEdge = i; } });
  pm.forEach((a, i) => {
    const b = pm[(i + 1) % pm.length], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 3) return;
    let nx = dz / L, nz = -dx / L; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (pointInPoly(pm, mx + nx * 0.4, mz + nz * 0.4)) { nx = -nx; nz = -nz; }
    const n = Math.floor(L / 3.3);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, px = a[0] + dx * t, pz = a[1] + dz * t;
      for (let f = 0; f < o.floors; f++) {
        if (f === 0 && i === doorEdge && Math.abs(t - 0.5) < 0.5 / n + 0.02) continue;
        winQ.push({ g: null, x: px + nx * 0.04, y: base + 0.4 + 1.6 + f * 3.1, z: pz + nz * 0.04, ry: Math.atan2(nx, nz), w: 1.0, h: 1.3 });
      }
    }
    if (i === doorEdge) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 0.14), stdMat(texWood(), '#4a3220', 0.7)); door.position.set(mx + nx * 0.06, base + 0.4 + 1.1, mz + nz * 0.06); door.rotation.y = Math.atan2(nx, nz); g.add(door);
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.7), stdMat(texConcrete(), '#a7a59e', 1)); step.position.set(mx + nx * 0.4, base + 0.5, mz + nz * 0.4); step.rotation.y = Math.atan2(nx, nz); g.add(step);
    }
  });
  // chimney
  let sx = 0, sz = 0; for (const [x, z] of pm) { sx += x; sz += z; } sx /= pm.length; sz /= pm.length;
  if (pointInPoly(pm, sx, sz)) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), stdMat(texBrick(), '#b8b0a4', 1)); c.position.set(sx, base + o.hgt + 0.9, sz); c.castShadow = true; g.add(c); }
  return g;
}
