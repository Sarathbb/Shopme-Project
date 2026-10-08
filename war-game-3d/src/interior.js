// ---------- Enterable buildings: walls with a real doorway, rooms, furniture ----------
// A building is laid out in a local frame (metres): x runs along the front wall, z points out of the door.
// The same layout feeds the 3D meshes and the 2D collision rects the game logic uses.
const WALL_T = 0.3;
// A building has a frame at angle b.fa: local x runs along the front wall, local z points out of the door (any angle).
const SIDE_A = { S: 0, N: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 };
const bToGame = (b, lx, lz) => { const c = Math.cos(b.fa), s = Math.sin(b.fa); return { x: b.cx + U * (lx * c - lz * s), y: b.cy + U * (lx * s + lz * c) }; };
function bRect(b, lx, lz, sx, sz) {            // a rotated rect obstacle (with its axis-aligned bounds) for a box in the building's frame
  const c = bToGame(b, lx, lz), hw = sx * U / 2, hh = sz * U / 2, ca = Math.cos(b.fa), sa = Math.sin(b.fa);
  const ex = Math.abs(hw * ca) + Math.abs(hh * sa), ey = Math.abs(hw * sa) + Math.abs(hh * ca);
  return { x: c.x - ex, y: c.y - ey, w: ex * 2, h: ey * 2, cx: c.x, cy: c.y, hw, hh, a: b.fa, ca, sa };
}
// [type, wall, width, depth, height, tall(blocks bullets), flat(no collision), count]
const ITEMS = {
  house: {
    B: [['counter', 'back', 3.0, 0.65, 0.92], ['fridge', 'back', 0.8, 0.75, 1.9, 1], ['tvunit', 'right', 1.5, 0.45, 0.6], ['shelf', 'right', 1.1, 0.38, 1.9, 1],
      ['rug', 'free', 3.0, 2.0, 0.03, 0, 1], ['sofa', 'free', 2.1, 0.95, 0.85], ['coffee', 'free', 1.1, 0.6, 0.45], ['table', 'free', 1.7, 0.95, 0.76], ['plant', 'free', 0.5, 0.5, 1.2], ['lamp', 'free', 0.4, 0.4, 1.6]],
    A: [['bed', 'back', 1.7, 2.1, 0.6], ['night', 'back', 0.5, 0.45, 0.55, 0, 0, 2], ['wardrobe', 'left', 1.5, 0.62, 2.1, 1], ['desk', 'right', 1.4, 0.65, 0.78], ['chair', 'free', 0.5, 0.5, 0.9],
      ['rug', 'free', 2.4, 1.6, 0.03, 0, 1], ['plant', 'free', 0.5, 0.5, 1.2]],
  },
  concrete: {
    B: [['locker', 'left', 0.5, 0.55, 1.9, 1, 0, 4], ['cabinet', 'right', 0.55, 0.6, 1.4, 1, 0, 3], ['cooler', 'back', 0.4, 0.4, 1.3], ['couch', 'back', 1.9, 0.85, 0.8],
      ['desk', 'free', 1.6, 0.8, 0.76, 0, 0, 4], ['chair', 'free', 0.5, 0.5, 0.9, 0, 0, 3], ['plant', 'free', 0.5, 0.5, 1.2, 0, 0, 2], ['rug', 'free', 3.2, 2.2, 0.03, 0, 1]],
  },
  warehouse: {
    B: [['rack', 'left', 3.4, 0.9, 3.4, 1, 0, 3], ['rack', 'right', 3.4, 0.9, 3.4, 1, 0, 3], ['bench', 'back', 2.4, 0.75, 0.95], ['forklift', 'free', 1.3, 2.6, 2.1, 1],
      ['pallet', 'free', 1.2, 1.2, 1.3, 1, 0, 6], ['barrel', 'free', 0.62, 0.62, 0.9, 0, 0, 4]],
  },
  barn: {
    B: [['bale', 'free', 1.4, 1.1, 1.1, 1, 0, 6], ['tractor', 'free', 2.0, 3.2, 2.1, 1], ['bench', 'back', 2.2, 0.7, 0.95], ['barrel', 'free', 0.62, 0.62, 0.9, 0, 0, 3], ['pallet', 'free', 1.2, 1.2, 1.2, 1, 0, 2]],
  },
};

function setupBuilding(b) {
  if (b.cx === undefined) { b.cx = b.x + b.w / 2; b.cy = b.y + b.h / 2; }
  if (b.ow === undefined) { b.ow = b.w; b.oh = b.h; b.a0 = 0; }
  b.c0 = Math.cos(b.a0); b.s0 = Math.sin(b.a0);
  let best = 1e9, q = roads[0].pts[0];                                  // the door faces the nearest road
  for (const r of roads) for (const p of r.pts) { const d = Math.hypot(p.x - b.cx, p.y - b.cy); if (d < best) { best = d; q = p; } }
  const dx0 = q.x - b.cx, dy0 = q.y - b.cy, dx = dx0 * b.c0 + dy0 * b.s0, dy = -dx0 * b.s0 + dy0 * b.c0;   // direction to the road in the building's own frame
  b.side = Math.abs(dx) * b.oh > Math.abs(dy) * b.ow ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
  b.fa = b.a0 + SIDE_A[b.side]; b.th = -b.fa;
  const ew = b.side === 'E' || b.side === 'W', T = WALL_T, big = b.style === 'warehouse' || b.style === 'barn';
  const Lw = b.Lw = (ew ? b.oh : b.ow) / U, Ld = b.Ld = (ew ? b.ow : b.oh) / U;
  b.dW = big ? 4.0 : 2.3; b.dH = big ? 3.6 : 2.3;
  b.wallH = b.style === 'warehouse' ? 6.0 : b.style === 'barn' ? 4.4 : b.style === 'concrete' ? 3.3 : 3.0;
  b.doorX = 0; b.part = null;
  const full = { x0: -Lw / 2 + T, x1: Lw / 2 - T, z0: -Ld / 2 + T, z1: Ld / 2 - T };
  b.rooms = { A: full, B: full };
  if (b.style === 'house') {                                              // two rooms and an open doorway between them
    if (Lw >= Ld) {
      const pp = -Lw / 2 + Lw * 0.38, gap = rnd(-0.12, 0.12) * Ld;
      b.part = { axis: 'x', pos: pp, gap }; b.doorX = (pp + Lw / 2) / 2;
      b.rooms = { A: { ...full, x1: pp - 0.12 }, B: { ...full, x0: pp + 0.12 } };
    } else {
      const pp = -Ld / 2 + Ld * 0.42, gap = rnd(-0.18, 0.18) * Lw;
      b.part = { axis: 'z', pos: pp, gap };
      b.rooms = { A: { ...full, z1: pp - 0.12 }, B: { ...full, z0: pp + 0.12 } };
    }
  }
  // wall pieces: inFace is the box face (0:+x 1:-x 4:+z 5:-z) that looks into the room, 'both' for partitions
  const walls = [], add = (cx, cz, sx, sz, inFace) => { if (sx > 0.05 && sz > 0.05) walls.push({ cx, cz, sx, sz, inFace }); };
  add(0, -Ld / 2 + T / 2, Lw - 2 * T, T, 4); add(-Lw / 2 + T / 2, 0, T, Ld, 0); add(Lw / 2 - T / 2, 0, T, Ld, 1);
  const fl = -Lw / 2 + T, fr = Lw / 2 - T, d0 = b.doorX - b.dW / 2, d1 = b.doorX + b.dW / 2;
  add((fl + d0) / 2, Ld / 2 - T / 2, d0 - fl, T, 5); add((d1 + fr) / 2, Ld / 2 - T / 2, fr - d1, T, 5);
  if (b.part) {
    const p = b.part, g0 = p.gap - 1.0, g1 = p.gap + 1.0;
    if (p.axis === 'x') { add(p.pos, (full.z0 + g0) / 2, 0.2, g0 - full.z0, 'both'); add(p.pos, (g1 + full.z1) / 2, 0.2, full.z1 - g1, 'both'); }
    else { add((full.x0 + g0) / 2, p.pos, g0 - full.x0, 0.2, 'both'); add((g1 + full.x1) / 2, p.pos, full.x1 - g1, 0.2, 'both'); }
  }
  b.walls = walls;
  for (const w of walls) obstacles.push({ kind: 'wall', ...bRect(b, w.cx, w.cz, w.sx, w.sz) });
  const door = { kind: 'door', ...bRect(b, b.doorX, Ld / 2 - T / 2, b.dW, T), open: false, manual: false, hold: 0, t: 0, b };
  obstacles.push(door); b.door = door;
  b.doorOut = bToGame(b, b.doorX, Ld / 2 + 1.8); b.doorIn = bToGame(b, b.doorX, Ld / 2 - T - 1.6);
  b.inside = false;
  const base = obstacles.length;                       // furniture goes in after the walls; retry layouts that wall off a room
  for (let k = 0, ratio = 0; k < 10; k++) {
    obstacles.length = base; b.items = placeItems(b); ratio = interiorReach(b);
    if (ratio >= 0.9) break;
    if (k === 9) { obstacles.length = base; b.items = []; }
  }
  b.inside = false; b.rise = b.style === 'concrete' ? 1.0 : b.style === 'warehouse' ? 1.7 : b.style === 'barn' ? 2.6 : 1.2 + Math.min(Lw, Ld) * 0.28;
  b.hgt = 0.4 + b.wallH + b.rise * 0.8;
  buildings.push(b);
}

// share of the free floor that can be walked to from the front door (a player-sized circle must fit)
function interiorReach(b) {
  const T = WALL_T, C = 0.4, was = b.door.open; b.door.open = true;
  const list = obstacles.filter(o => { if (o.kind === 'poly') return false; const [x0, y0, x1, y1] = obsBox(o); return x1 > b.x - 30 && x0 < b.x + b.w + 30 && y1 > b.y - 30 && y0 < b.y + b.h + 30; });
  const nx = Math.floor((b.Lw - 2 * T) / C), nz = Math.floor((b.Ld - 2 * T) / C), grid = []; let total = 0, start = null, best = 1e9;
  for (let i = 0; i < nx; i++) {
    grid[i] = [];
    for (let j = 0; j < nz; j++) {
      const p = bToGame(b, -b.Lw / 2 + T + (i + 0.5) * C, -b.Ld / 2 + T + (j + 0.5) * C), f = pointFreeList(list, p.x, p.y, 13); grid[i][j] = f;
      if (f) { total++; const d = Math.hypot(p.x - b.doorIn.x, p.y - b.doorIn.y); if (d < best) { best = d; start = [i, j]; } }
    }
  }
  let reach = 0;
  if (start) {
    const seen = new Set([start[0] + ',' + start[1]]), q = [start];
    while (q.length) { const [i, j] = q.pop(); reach++; for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + a, nj = j + c; if (ni < 0 || nj < 0 || ni >= nx || nj >= nz || !grid[ni][nj]) continue; const k = ni + ',' + nj; if (!seen.has(k)) { seen.add(k); q.push([ni, nj]); } } }
  }
  b.door.open = was;
  return reach / Math.max(1, total);
}
function placeItems(b) {
  const T = WALL_T, Lw = b.Lw, Ld = b.Ld, out = [], taken = [], tmpl = ITEMS[b.style] || {};
  const keep = [{ x0: b.doorX - 1.8, x1: b.doorX + 1.8, z0: Ld / 2 - T - 4.0, z1: Ld / 2 }];       // clear path from the front door
  if (b.part) { const p = b.part; keep.push(p.axis === 'x' ? { x0: p.pos - 1.7, x1: p.pos + 1.7, z0: p.gap - 1.7, z1: p.gap + 1.7 } : { x0: p.gap - 1.7, x1: p.gap + 1.7, z0: p.pos - 1.7, z1: p.pos + 1.7 }); }
  const ov = (a, c, m) => a.x0 < c.x1 + m && a.x1 > c.x0 - m && a.z0 < c.z1 + m && a.z1 > c.z0 - m;
  const put1 = (type, cx, cz, sx, sz, h, ry, tall, flat) => {
    out.push({ type, lx: cx, lz: cz, sx, sz, h, ry, tall, flat });
    if (!flat) { const sw = Math.abs(Math.sin(ry)) > 0.5, r = bRect(b, cx, cz, sw ? sz : sx, sw ? sx : sz); obstacles.push({ kind: tall ? 'furnTall' : 'furn', ...r, top: h, onFloor: true }); }
  };
  for (const room of ['A', 'B']) {
    if (room === 'A' && b.rooms.A === b.rooms.B) continue;
    const R = b.rooms[room];
    for (const [type, wall, sx, sz, h, tall, flat, n] of tmpl[room] || []) {
      for (let c = 0; c < (n || 1); c++) {
        for (let k = 0; k < 40; k++) {
          const rot = { back: 0, left: Math.PI / 2, right: -Math.PI / 2, front: Math.PI }[wall] ?? pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
          const sw = Math.abs(Math.sin(rot)) > 0.5, ew = sw ? sz : sx, ed = sw ? sx : sz;
          if (R.x1 - R.x0 < ew + 0.1 || R.z1 - R.z0 < ed + 0.1) break;
          let cx, cz;
          if (wall === 'back') { cz = R.z0 + ed / 2 + 0.03; cx = rnd(R.x0 + ew / 2, R.x1 - ew / 2); }
          else if (wall === 'front') { cz = R.z1 - ed / 2 - 0.03; cx = rnd(R.x0 + ew / 2, R.x1 - ew / 2); }
          else if (wall === 'left') { cx = R.x0 + ew / 2 + 0.03; cz = rnd(R.z0 + ed / 2, R.z1 - ed / 2); }
          else if (wall === 'right') { cx = R.x1 - ew / 2 - 0.03; cz = rnd(R.z0 + ed / 2, R.z1 - ed / 2); }
          else { cx = rnd(R.x0 + ew / 2 + 0.2, R.x1 - ew / 2 - 0.2); cz = rnd(R.z0 + ed / 2 + 0.2, R.z1 - ed / 2 - 0.2); }
          const fp = { x0: cx - ew / 2, x1: cx + ew / 2, z0: cz - ed / 2, z1: cz + ed / 2 };
          if (keep.some(q => ov(fp, q, 0)) || (!flat && taken.some(q => ov(fp, q, 0.35)))) continue;
          if (!flat) taken.push(fp);
          put1(type, cx, cz, sx, sz, h, rot, tall, flat);
          if (type === 'table') for (const [ox, oz, cr] of [[0, ed / 2 + 0.38, Math.PI], [0, -ed / 2 - 0.38, 0], [ew / 2 + 0.38, 0, -Math.PI / 2], [-ew / 2 - 0.38, 0, Math.PI / 2]]) {
            const cfp = { x0: cx + ox - 0.25, x1: cx + ox + 0.25, z0: cz + oz - 0.25, z1: cz + oz + 0.25 };
            if (cfp.x0 < R.x0 || cfp.x1 > R.x1 || cfp.z0 < R.z0 || cfp.z1 > R.z1 || keep.some(q => ov(cfp, q, 0)) || taken.some(q => ov(cfp, q, 0.05))) continue;
            taken.push(cfp); put1('chair', cx + ox, cz + oz, 0.5, 0.5, 0.9, cr, 0, 0);
          }
          break;
        }
      }
    }
  }
  return out;
}
function buildingAt(x, y) {
  for (const b of buildings) {
    if (x < b.x - 4 || x > b.x + b.w + 4 || y < b.y - 4 || y > b.y + b.h + 4) continue;
    const dx = x - b.cx, dy = y - b.cy, lx = dx * b.c0 + dy * b.s0, ly = -dx * b.s0 + dy * b.c0;
    if (Math.abs(lx) < b.ow / 2 - 6 && Math.abs(ly) < b.oh / 2 - 6) return b;
  }
  return null;
}

// ---------- Furniture meshes (origin on the floor, front towards +z) ----------
const fm = (c, r = 0.8, m = 0) => stdMat(null, c, r, m);
function itemMesh(it) {
  const g = new THREE.Group(), { sx, sz, h } = it, wood = stdMat(texWood(), pick(['#a88660', '#8a6a44', '#b59870']), 0.7), dark = fm('#222428', 0.6, 0.3);
  const fab = fm(pick(['#4a5f7a', '#7a4a4a', '#5a7a5a', '#8a7a52', '#5a5a6a']), 0.95);
  const B = (w, hh, d, x, y, z, m) => { const o = texBox(w, hh, d, m || wood, 1); o.position.set(x, y + hh / 2, z); g.add(o); return o; };
  const C = (rt, rb, hh, x, y, z, m, seg = 12) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hh, seg), m); o.position.set(x, y + hh / 2, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  switch (it.type) {
    case 'bed': B(sx, 0.3, sz, 0, 0.08, 0, wood); B(sx - 0.1, 0.22, sz - 0.2, 0, 0.38, 0.05, fm('#e9e6df', 1)); B(sx - 0.1, 0.1, sz * 0.55, 0, 0.6, 0.35, fab); B(sx, 0.9, 0.1, 0, 0.1, -sz / 2 + 0.05, wood);
      for (const px of [-0.4, 0.4]) B(0.6, 0.14, 0.38, px, 0.6, -sz / 2 + 0.4, fm('#f2f0ea', 1)); break;
    case 'night': B(sx, h, sz, 0, 0, 0, wood); C(0.07, 0.1, 0.25, 0, h, 0, fm('#e8d9a8', 0.6), 8); break;
    case 'wardrobe': B(sx, h, sz, 0, 0, 0, wood); B(0.03, h - 0.2, 0.03, 0, 0.1, sz / 2 + 0.01, dark); break;
    case 'desk': B(sx, 0.05, sz, 0, h - 0.05, 0, wood); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(0.05, h - 0.05, 0.05, dx * (sx / 2 - 0.05), 0, dz * (sz / 2 - 0.05), dark);
      B(0.5, 0.3, 0.03, 0, h, -sz * 0.25, fm('#101214', 0.3, 0.4)); B(0.15, 0.05, 0.1, 0, h, -sz * 0.25 + 0.1, dark); B(0.4, 0.02, 0.15, 0, h, sz * 0.1, dark); break;
    case 'chair': B(0.46, 0.05, 0.46, 0, 0.45, 0, wood); B(0.46, 0.45, 0.05, 0, 0.5, -0.2, wood); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(0.04, 0.45, 0.04, dx * 0.2, 0, dz * 0.2, wood); break;
    case 'sofa': B(sx, 0.35, sz, 0, 0.08, 0, fab); B(sx, 0.5, 0.25, 0, 0.35, -sz / 2 + 0.12, fab); for (const s of [-1, 1]) B(0.2, 0.3, sz, s * (sx / 2 - 0.1), 0.35, 0, fab); break;
    case 'coffee': B(sx, 0.05, sz, 0, h - 0.05, 0, wood); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(0.05, h - 0.05, 0.05, dx * (sx / 2 - 0.05), 0, dz * (sz / 2 - 0.05), dark); break;
    case 'table': B(sx, 0.06, sz, 0, h - 0.06, 0, wood); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(0.07, h - 0.06, 0.07, dx * (sx / 2 - 0.08), 0, dz * (sz / 2 - 0.08), wood); break;
    case 'tvunit': B(sx, h, sz, 0, 0, 0, wood); B(1.0, 0.6, 0.05, 0, h, 0, fm('#0c0d0f', 0.2, 0.4)); B(0.1, 0.1, 0.1, 0, h, 0, dark); break;
    case 'shelf': B(sx, h, sz, 0, 0, 0, wood); for (let i = 0; i < 5; i++) for (let k = 0; k < 4; k++) B(0.1, 0.28, 0.2, -sx / 2 + 0.15 + k * 0.24, 0.12 + i * 0.36, 0.06, fm(pick(['#8a3a3a', '#3a5a8a', '#6a7a3a', '#caa84a']), 0.9)); break;
    case 'counter': B(sx, 0.85, sz, 0, 0, 0, fm('#d8d4c8', 0.6)); B(sx + 0.04, 0.05, sz + 0.04, 0, 0.85, 0, fm('#4a4a4e', 0.4, 0.2)); B(0.6, 0.03, 0.45, -sx * 0.25, 0.9, 0, fm('#2a2a2c', 0.3, 0.6)); break;
    case 'fridge': B(sx, h, sz, 0, 0, 0, fm('#e4e6e8', 0.35, 0.4)); B(0.03, 0.6, 0.03, sx / 2 - 0.12, 1.0, sz / 2 + 0.01, dark); break;
    case 'plant': C(0.2, 0.15, 0.35, 0, 0, 0, fm('#8a5a3a', 0.8)); { const l = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), fm('#3c7a38', 0.9)); l.position.set(0, 0.85, 0); l.castShadow = true; g.add(l); } break;
    case 'lamp': C(0.025, 0.025, 1.4, 0, 0, 0, dark, 6); C(0.18, 0.12, 0.25, 0, 1.4, 0, new THREE.MeshStandardMaterial({ color: srgb('#f3e2b0'), emissive: srgb('#f3e2b0'), emissiveIntensity: 0.6 }), 10); break;
    case 'rug': B(sx, 0.03, sz, 0, 0, 0, fm(pick(['#7a3a3a', '#3a5a7a', '#6a6a4a', '#5a4a6a']), 1)); break;
    case 'locker': B(sx, h, sz, 0, 0, 0, fm('#5a6a74', 0.5, 0.5)); B(0.3, 0.02, 0.02, 0, h * 0.8, sz / 2 + 0.01, dark); break;
    case 'cabinet': B(sx, h, sz, 0, 0, 0, fm('#8a8e92', 0.5, 0.5)); for (const y of [0.2, 0.7, 1.15]) B(0.3, 0.03, 0.03, 0, y, sz / 2 + 0.01, dark); break;
    case 'cooler': B(0.35, 0.8, 0.35, 0, 0, 0, fm('#cfd4d8', 0.5, 0.3)); C(0.15, 0.15, 0.4, 0, 0.8, 0, new THREE.MeshStandardMaterial({ color: srgb('#9ac8e8'), transparent: true, opacity: 0.7, roughness: 0.1 }), 12); break;
    case 'couch': B(sx, 0.4, sz, 0, 0.05, 0, fab); B(sx, 0.5, 0.2, 0, 0.35, -sz / 2 + 0.1, fab); break;
    case 'rack': { const st = fm('#3e5a8a', 0.5, 0.6); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(0.07, h, 0.07, dx * (sx / 2 - 0.05), 0, dz * (sz / 2 - 0.05), st);
      for (let i = 0; i < 4; i++) { B(sx, 0.06, sz, 0, 0.3 + i * 0.95, 0, fm('#e08a2a', 0.5, 0.5)); for (let k = 0; k < 3; k++) if (Math.random() < 0.8) B(0.9, 0.55, 0.6, -sx / 3 + k * (sx / 3), 0.36 + i * 0.95, 0, stdMat(texWood(), '#b89868', 0.9)); } } break;
    case 'pallet': B(sx, 0.14, sz, 0, 0, 0, wood); for (let i = 0; i < 2; i++) B(sx * 0.46, h - 0.14, sz * 0.9, (i - 0.5) * sx * 0.5, 0.14, 0, stdMat(texWood(), '#b89868', 0.9)); break;
    case 'barrel': C(0.3, 0.3, 0.9, 0, 0, 0, fm(pick(['#b03a2e', '#2e5f9e', '#3d7a4a']), 0.45, 0.6), 14); break;
    case 'bench': B(sx, 0.08, sz, 0, h - 0.08, 0, wood); for (const s of [-1, 1]) B(0.08, h - 0.08, sz - 0.1, s * (sx / 2 - 0.1), 0, 0, dark); B(sx, 0.5, 0.05, 0, h, -sz / 2 + 0.03, stdMat(texWood(), '#8a6a44', 0.9)); break;
    case 'forklift': B(sx, 0.7, sz, 0, 0.3, 0, fm('#d9a620', 0.5, 0.4)); B(sx * 0.9, 1.2, 0.2, 0, 0.9, -sz * 0.28, dark); B(0.08, 2.0, 0.08, -sx / 2 + 0.1, 0, sz / 2 - 0.2, dark); B(0.08, 2.0, 0.08, sx / 2 - 0.1, 0, sz / 2 - 0.2, dark); B(sx * 0.9, 0.06, 0.8, 0, 2.0, sz / 2 - 0.2, dark);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(0.28, 0.28, 0.2, dx * (sx / 2), 0, dz * (sz / 2 - 0.4), dark, 10).rotation.z = Math.PI / 2; break;
    case 'tractor': B(sx * 0.8, 0.9, sz * 0.55, 0, 0.55, sz * 0.15, fm('#2f6a2f', 0.5, 0.4)); B(sx * 0.7, 0.9, 0.9, 0, 1.4, -sz * 0.05, fm('#2f6a2f', 0.5, 0.4)); C(0.5, 0.5, 0.3, sx / 2, 0, -sz * 0.3, dark, 14).rotation.z = Math.PI / 2; C(0.5, 0.5, 0.3, -sx / 2, 0, -sz * 0.3, dark, 14).rotation.z = Math.PI / 2;
      C(0.3, 0.3, 0.2, sx / 2, 0, sz * 0.35, dark, 14).rotation.z = Math.PI / 2; C(0.3, 0.3, 0.2, -sx / 2, 0, sz * 0.35, dark, 14).rotation.z = Math.PI / 2; break;
    case 'bale': { const o = C(0.55, 0.55, sx, 0, 0.55, 0, fm('#c4a54a', 1), 14); o.rotation.z = Math.PI / 2; o.position.y = 0.55; } break;
    default: B(sx, h, sz, 0, 0, 0, wood);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = !it.flat; o.receiveShadow = true; } });
  return g;
}

// ---------- Building meshes ----------
function makeBuilding(b) {
  const g = new THREE.Group(), T = WALL_T, Lw = b.Lw, Ld = b.Ld, H = b.wallH, y0 = 0.4, s = b.style, big = s === 'warehouse' || s === 'barn';
  const tex = { plaster: texPlaster(), brick: texBrick(), concrete: texConcrete(), tile: texTile(), metal: texMetal(), wood: texWood() };
  const outer0 = s === 'warehouse' ? stdMat(tex.metal, b.wall || '#9aa2a8', 0.55, 0.45) : s === 'barn' ? stdMat(tex.wood, b.wall, 0.85) : s === 'concrete' ? stdMat(tex.concrete, '#d4d2cc', 0.95) : stdMat(Math.random() < 0.3 ? tex.brick : tex.plaster, b.wall, 0.95);
  const inner0 = s === 'warehouse' ? stdMat(tex.metal, '#aab0b4', 0.6, 0.3) : s === 'barn' ? stdMat(tex.wood, '#9a7a52', 0.9) : s === 'concrete' ? stdMat(tex.concrete, '#e0ded8', 0.95) : stdMat(tex.plaster, pick(['#efe9dc', '#e4ecef', '#eadfd2', '#e7ece0']), 0.95);
  const outer = outer0.clone(), inner = inner0.clone(); b.wallMats = [outer, inner]; b.wallMeshes = []; b.roofParts = [];
  g.add(put(texBox(Lw + 0.3, 0.4, Ld + 0.3, stdMat(tex.concrete, '#8f8d86', 1)), 0, 0.2, 0));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(Lw - 2 * T, Ld - 2 * T), s === 'house' ? stdMat(tex.wood, '#b8946a', 0.65) : stdMat(tex.concrete, s === 'barn' ? '#8a7a5a' : '#9a9890', 0.9));
  floor.material = floor.material.clone(); floor.material.map = floor.material.map.clone(); floor.material.map.repeat.set((Lw - 2 * T) / 2.5, (Ld - 2 * T) / 2.5); floor.material.map.needsUpdate = true;
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, y0 + 0.01, 0); floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(Lw - 2 * T, Ld - 2 * T), stdMat(null, s === 'house' ? '#f3efe6' : s === 'barn' ? '#8a7048' : '#dcdad4', 0.95));      // the underside of the roof: a proper ceiling, so the room is closed from inside
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, y0 + H - 0.01, 0); ceil.receiveShadow = true; g.add(ceil);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.08, 14), new THREE.MeshStandardMaterial({ color: '#fff4d8', emissive: '#ffe6b0', emissiveIntensity: 0.7 })); lamp.position.set(0, y0 + H - 0.06, 0); g.add(lamp);
  for (const w of b.walls) {
    const m = texBox(w.sx, H, w.sz, w.inFace === 'both' ? Array(6).fill(inner) : Array.from({ length: 6 }, (_, i) => i === w.inFace ? inner : outer), 2.5);
    m.position.set(w.cx, y0 + H / 2, w.cz); g.add(m); b.wallMeshes.push(m);
  }
  // lintel over the doorway
  const lint = texBox(b.dW + 0.1, H - b.dH, T, [outer, outer, outer, outer, outer, inner], 2.5); lint.position.set(b.doorX, y0 + b.dH + (H - b.dH) / 2, Ld / 2 - T / 2); g.add(lint); b.wallMeshes.push(lint);
  // door leaves swing outward from hinges at the sides of the opening
  b.leaves = [];
  const leafMat = s === 'warehouse' ? stdMat(null, '#4a4f55', 0.6, 0.4) : s === 'barn' ? stdMat(tex.wood, '#7a2a22', 0.8) : stdMat(tex.wood, '#6a4a2e', 0.7);
  for (const sg of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(b.doorX + sg * b.dW / 2, y0, Ld / 2 - T / 2 + 0.05);
    const lw = b.dW / 2 - 0.03, leaf = texBox(lw, b.dH - 0.03, 0.09, leafMat, 1.2); leaf.position.set(-sg * lw / 2, b.dH / 2, 0); pivot.add(leaf);
    const hd = nocast(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.18), stdMat(null, '#c8b070', 0.3, 0.8))); hd.position.set(-sg * (lw - 0.15), b.dH * 0.45, 0); pivot.add(hd);
    g.add(pivot); b.leaves.push({ pivot, sg });
  }
  g.add(nocast(put(texBox(b.dW + 0.2, 0.12, 0.35, stdMat(tex.concrete, '#b0aea6', 1)), b.doorX, y0 + 0.06, Ld / 2 + 0.2)));         // threshold
  // windows on every wall, outside and inside
  const wy = y0 + (big ? H - 1.4 : 1.75), wh = big ? 0.8 : 1.3;
  const faces = [[Ld / 2, 0, Lw, 'z', 1], [-Ld / 2, 0, Lw, 'z', -1], [-Lw / 2, 0, Ld, 'x', -1], [Lw / 2, 0, Ld, 'x', 1]];
  for (const [pos, , len, axis, sgn] of faces) {
    const n = Math.max(1, Math.floor(len / (big ? 4.5 : 3.2)));
    for (let i = 0; i < n; i++) {
      const t = (i - (n - 1) / 2) * (len / n);
      if (axis === 'z' && sgn === 1 && Math.abs(t - b.doorX) < b.dW / 2 + 1.1) continue;
      if (b.part && ((b.part.axis === 'x' && axis === 'z' && Math.abs(t - b.part.pos) < 1.0) || (b.part.axis === 'z' && axis === 'x' && Math.abs(t - b.part.pos) < 1.0))) continue;
      if (axis === 'z') { windowAt(g, t, wy, pos + sgn * 0.05, sgn === 1 ? 0 : Math.PI, big ? 1.5 : 1.0, wh); windowAt(g, t, wy, pos - sgn * (T + 0.05), sgn === 1 ? Math.PI : 0, big ? 1.5 : 1.0, wh, true); }
      else { windowAt(g, pos + sgn * 0.05, wy, t, sgn === 1 ? Math.PI / 2 : -Math.PI / 2, big ? 1.5 : 1.0, wh); windowAt(g, pos - sgn * (T + 0.05), wy, t, sgn === 1 ? -Math.PI / 2 : Math.PI / 2, big ? 1.5 : 1.0, wh, true); }
    }
  }
  // roof (hidden while you are inside)
  const top = y0 + H, rp = b.roofParts, rise = b.rise;
  if (s === 'concrete') {
    rp.push(put(texBox(Lw + 0.2, 0.3, Ld + 0.2, stdMat(tex.concrete, '#b8b6ae', 1)), 0, top + 0.15, 0));
    for (const [px, pz, w, d] of [[0, Ld / 2, Lw + 0.2, 0.2], [0, -Ld / 2, Lw + 0.2, 0.2], [Lw / 2, 0, 0.2, Ld], [-Lw / 2, 0, 0.2, Ld]]) rp.push(put(texBox(w, 0.7, d, stdMat(tex.concrete, '#c8c6be', 1)), px, top + 0.65, pz));
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.5, 16), stdMat(null, '#b9bcc0', 0.5, 0.5)); tank.castShadow = true; rp.push(put(tank, Lw / 4, top + 1.2, 0));
    rp.push(put(texBox(1.2, 0.8, 0.9, stdMat(tex.metal, '#cfd2d4', 0.6, 0.4)), -Lw / 4, top + 0.7, 0.2));
  } else if (big) {
    const roofMat = new THREE.MeshStandardMaterial({ map: tex.metal, color: srgb(s === 'barn' ? '#6a6e74' : '#8a9096'), roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide });
    const r = gableRoof(Lw, Ld, rise, 0.5, roofMat, 1.6); r.position.y = top; rp.push(r);
    const ge = gableEnds(Lw, Ld, rise, inner); ge.position.y = top; rp.push(ge);
    if (s === 'warehouse') for (let i = 0; i < 3; i++) { const v = nocast(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 10), stdMat(null, '#c4c6c8', 0.5, 0.6))); rp.push(put(v, (i - 1) * Lw / 4, top + rise + 0.3, 0)); }
  } else {
    const roofMat = new THREE.MeshStandardMaterial({ map: tex.tile, color: srgb(b.roof), roughness: 0.85, side: THREE.DoubleSide });
    const r = gableRoof(Lw, Ld, rise, 0.45, roofMat, 1.8); r.position.y = top; rp.push(r);
    const ge = gableEnds(Lw, Ld, rise, outer); ge.position.y = top; rp.push(ge);
    rp.push(put(texBox(0.7, 1.8, 0.7, stdMat(tex.brick, '#b8b0a4', 1)), Lw * 0.28, top + 1.3, -Ld * 0.12), put(texBox(0.9, 0.15, 0.9, stdMat(tex.concrete, '#9a9890', 1)), Lw * 0.28, top + 2.25, -Ld * 0.12));
  }
  rp.forEach(m => g.add(m));
  b.furnGroup = null;
  g.rotation.y = b.th;
  g.position.set(wx(b.cx), hAt(wx(b.cx), wz(b.cy)), wz(b.cy));
  b.group = g;
  return g;
}
function ensureInterior(b, on) {                // furniture meshes exist only while the player is within about 50 m
  if (on && !b.furnGroup) {
    const f = new THREE.Group();
    for (const it of b.items) { const m = itemMesh(it); m.position.set(it.lx, 0.41, it.lz); m.rotation.y = it.ry; f.add(m); }
    b.group.add(f); b.furnGroup = f;
  } else if (!on && b.furnGroup) {
    b.group.remove(b.furnGroup); b.furnGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); b.furnGroup = null;
  }
}
// Called every frame: swing doors and cut the building open while the player is inside it.
function updateBuildings(dt) {
  for (const b of buildings) {
    const d = b.door; d.hold = Math.max(0, d.hold - dt);
    d.open = d.manual || d.hold > 0;
    if (d.open !== !!b.wasOpen) { b.wasOpen = d.open; Sound.door(d.open, d.x + d.w / 2, d.y + d.h / 2); }
    d.t = clampN(d.t + (d.open ? 1 : -1) * dt * 2.6, 0, 1);
    for (const l of b.leaves) l.pivot.rotation.y = l.sg * 1.6 * d.t;
    const nd = Math.hypot(b.cx - player.x, b.cy - player.y); if (nd < 1000) ensureInterior(b, true); else if (nd > 1500) ensureInterior(b, false);
    const inside = playerBuilding === b;
    if (inside !== b.inside) {
      b.inside = inside;                                       // walls and roof stay solid: from inside you see the room, not the outside world
    }
  }
}
let playerBuilding = null;
