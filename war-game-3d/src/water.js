// ---------- Water and boats: a lake (round pond on the field, or a generated waterfront on the real maps), drivable boats, ripples and wakes ----------
// LAKE is { type: 'circle', x, y, r } or { type: 'rect', x, y, w, h, axis: 'x'|'y', dir: 1|-1, thr } (water lies where coord*dir < thr*dir). The rectangle touches the map edge and reaches out to sea.
let LAKE = null; const WATER_Y = -0.2;
function lakeDepth(px, py) {                                   // 0 on land, up to 1 well inside the water (field px)
  if (!LAKE || LAKE.type !== 'rect') return 0;
  const d = LAKE.axis === 'y' ? (LAKE.thr - py) * LAKE.dir : (LAKE.thr - px) * LAKE.dir; return smooth(0, 110, d);
}
function inLake(x, y, m = 0) {
  if (!LAKE) return false;
  if (LAKE.type === 'circle') return Math.hypot(x - LAKE.x, y - LAKE.y) < LAKE.r - m;
  return (LAKE.axis === 'y' ? (LAKE.thr - y) * LAKE.dir : (LAKE.thr - x) * LAKE.dir) > m;
}
function lakePush(e, r) {                                      // walkers and cars cannot enter the water
  if (!LAKE) return;
  if (LAKE.type === 'circle') { const dx = e.x - LAKE.x, dy = e.y - LAKE.y, d = Math.hypot(dx, dy) || 1, lim = LAKE.r + r * 0.6; if (d < lim) { e.x = LAKE.x + dx / d * lim; e.y = LAKE.y + dy / d * lim; } return; }
  const lim = r + 6, c = LAKE.axis === 'y' ? e.y : e.x, to = LAKE.thr + LAKE.dir * lim;       // land side only: keep at least `lim` from the shore
  if ((c - to) * LAKE.dir < 0) { if (LAKE.axis === 'y') e.y = to; else e.x = to; }
}
function addLake() {                                           // real maps carry no water data in the export: carve a waterfront along the quietest edge
  LAKE = null; if (MAP.id === 'proc') { if (pond) { LAKE = { type: 'circle', x: pond.x, y: pond.y, r: pond.r * 0.92 }; spawnBoats(); } return; }
  const D = 640, edges = [['N', 0, 1], ['S', 0, -1], ['W', 1, 1], ['E', 1, -1]];
  const rectOf = e => e === 'N' ? { x: -400, y: -400, w: FW + 800, h: 400 + D } : e === 'S' ? { x: -400, y: FH - D, w: FW + 800, h: 400 + D } : e === 'W' ? { x: -400, y: -400, w: 400 + D, h: FH + 800 } : { x: FW - D, y: -400, w: 400 + D, h: FH + 800 };
  const hit = (R, x0, y0, x1, y1) => x1 > R.x && x0 < R.x + R.w && y1 > R.y && y0 < R.y + R.h;
  let best = null;
  for (const [e] of edges) {
    const R = rectOf(e); let sc = 0; for (const o of obstacles) { if (o.kind === 'poly' || o.kind === 'building') { const [a, b, c, d] = obsBox(o); if (hit(R, a, b, c, d)) sc += 3; } } for (const b of buildings) if (hit(R, b.x, b.y, b.x + b.w, b.y + b.h)) sc += 4; for (const r of roads) for (const p of r.pts) if (p.x > R.x && p.x < R.x + R.w && p.y > R.y && p.y < R.y + R.h) sc += 0.2;
    if (hit(R, SPAWN.x - 700, SPAWN.y - 700, SPAWN.x + 700, SPAWN.y + 700)) sc += 1e6;
    if (!best || sc < best.sc) best = { e, sc, R };
  }
  const R = best.R, e = best.e; LAKE = { type: 'rect', x: R.x, y: R.y, w: R.w, h: R.h, axis: e === 'N' || e === 'S' ? 'y' : 'x', dir: e === 'N' || e === 'W' ? 1 : -1, thr: e === 'N' ? R.y + R.h : e === 'S' ? R.y : e === 'W' ? R.x + R.w : R.x };
  const gone = new Set(); const margin = 36;
  for (const b of buildings) if (hit({ x: R.x - margin, y: R.y - margin, w: R.w + 2 * margin, h: R.h + 2 * margin }, b.x, b.y, b.x + b.w, b.y + b.h)) gone.add(b);
  buildings = buildings.filter(b => !gone.has(b));
  const nearGone = (x, y) => { for (const b of gone) if (x > b.x - 50 && x < b.x + b.w + 50 && y > b.y - 50 && y < b.y + b.h + 50) return true; return false; };
  obstacles = obstacles.filter(o => { const [a, b, c, d] = obsBox(o); if (hit(R, a, b, c, d)) return false; return !(o.kind !== 'poly' && nearGone((a + c) / 2, (b + d) / 2)); });
  vehicles = vehicles.filter(v => !inLake(v.x, v.y, -60)); bushes = bushes.filter(o => !inLake(o.x, o.y, -40)); poles = poles.filter(o => !inLake(o.x, o.y, -40)); borderTrees = borderTrees.filter(o => !inLake(o.x, o.y, -60));
  const nr = []; for (const r of roads) { let run = []; const flush = () => { if (run.length >= 2) nr.push({ ...r, pts: run }); run = []; }; for (const p of r.pts) { if (inLake(p.x, p.y, -30)) flush(); else run.push(p); } flush(); } roads = nr;
  spawnBoats();
}
function spawnBoats() {
  if (!LAKE) return; const cols = ['#b8452e', '#2f6aa0', '#e8e6de'];
  for (let i = 0; i < 2; i++) {
    let x, y, hd;
    if (LAKE.type === 'circle') { const a = i * 3.1 + 0.7, d = LAKE.r - 25 - 12; x = LAKE.x + Math.cos(a) * d; y = LAKE.y + Math.sin(a) * d; hd = a + 1.57; }
    else { const L = LAKE.axis === 'y' ? FW : FH, t = L * (i ? 0.62 : 0.32), off = 25 + 14; if (LAKE.axis === 'y') { x = t; y = LAKE.thr - LAKE.dir * off; hd = 0; } else { y = t; x = LAKE.thr - LAKE.dir * off; hd = Math.PI / 2; } }
    const v = new Vehicle({ type: 'boat', col: cols[i % 3], x: x - 70, y: y - 25, w: 140, h: 50, heading: hd }); vehicles.push(v);
  }
}
function moveBoat(v, dt) {
  v.heading += (v.speed / (v.halfL * 0.9)) * Math.tan(v.steer) * dt * 0.8;
  v.x += Math.cos(v.heading) * v.speed * dt; v.y += Math.sin(v.heading) * v.speed * dt;
  if (!LAKE) return; let hit = false;
  if (LAKE.type === 'circle') {                                // stay inside the round lake: the hull's reach towards the shore depends on its heading
    const dx = v.x - LAKE.x, dy = v.y - LAKE.y, d = Math.hypot(dx, dy) || 1, psi = Math.atan2(dy, dx), ext = Math.abs(Math.cos(v.heading - psi)) * v.halfL + Math.abs(Math.sin(v.heading - psi)) * v.halfW, lim = LAKE.r - ext - 4;
    if (d > lim) { v.x = LAKE.x + dx / d * lim; v.y = LAKE.y + dy / d * lim; hit = true; }
  } else {
    const nang = LAKE.axis === 'y' ? Math.PI / 2 : 0, ext = Math.abs(Math.cos(v.heading - nang)) * v.halfL + Math.abs(Math.sin(v.heading - nang)) * v.halfW, c = LAKE.axis === 'y' ? v.y : v.x, lim = LAKE.thr - LAKE.dir * (ext + 4);
    if ((c - lim) * LAKE.dir > 0) { if (LAKE.axis === 'y') v.y = lim; else v.x = lim; hit = true; }
    if (LAKE.axis === 'y') { v.x = clampN(v.x, 30, FW - 30); v.y = clampN(v.y, -380, FH + 380); } else { v.y = clampN(v.y, 30, FH - 30); v.x = clampN(v.x, -380, FW + 380); }
  }
  for (const o of vehicles) if (o !== v && o.type === 'boat' && inOBB(o, v.x, v.y, v.halfW)) { const dx = v.x - o.x, dy = v.y - o.y, d = Math.hypot(dx, dy) || 1; v.x += dx / d * 3; v.y += dy / d * 3; v.speed *= 0.9; }
  if (hit && Math.abs(v.speed) > 60) { if (v.occupiedBy) { shake = Math.max(shake, 3); Sound.crash && Sound.crash(Math.abs(v.speed) * 0.5, v.x, v.y); } v.speed *= 0.5; }
}
function boatWake(v, dt) {
  if (Math.abs(v.speed) < 50) return; v.wakeT = (v.wakeT || 0) - dt; if (v.wakeT > 0) return; v.wakeT = 0.05;
  const c = Math.cos(v.heading), s = Math.sin(v.heading);
  spray(v.x - c * v.halfL * 0.8 + (Math.random() - 0.5) * 12, v.y - s * v.halfL * 0.8 + (Math.random() - 0.5) * 12, 0.05, 3, ['#ffffff', '#d8eef4', '#bfe0ea'], 45, 0.9, { up: 0.8, g: 3, drag: 1.2 });
  if (Math.abs(v.speed) > 140) spray(v.x + c * v.halfL * 0.6, v.y + s * v.halfL * 0.6, 0.1, 2, ['#ffffff'], 60, 0.5, { up: 1.2, g: 5 });
}
function boatExitSpot(v) {                                     // the nearest dry ground, or null when the shore is too far away
  for (let d = 60; d <= 200; d += 24) for (let k = 0; k < 16; k++) {
    const a = k / 16 * 6.283, x = v.x + Math.cos(a) * (v.halfL + d), y = v.y + Math.sin(a) * (v.halfL + d);
    if (!inLake(x, y, -20) && x > 20 && x < FW - 20 && y > 20 && y < FH - 20 && pointFree(x, y, player.r + 3)) return { x, y };
  }
  return null;
}
// ----- meshes -----
function makeBoatMesh(v) {
  const L = v.halfL * 2 / U, Wd = v.halfW * 2 / U, g = new THREE.Group(), root = new THREE.Group(); root.add(g);
  const paint = carMat('paint', v.col), white = carMat('paint', '#ecebe4'), dark = carMat('plastic', '#1a1b1e'), chrome = carMat('chrome'), glass = carMat('glass'), wood = stdMat(texWood(), '#9a7a52', 0.8);
  const hullP = [[-L / 2, 0.05], [-L / 2, 0.85], [-L * 0.1, 0.92], [L * 0.28, 0.95], [L / 2, 1.18], [L * 0.46, 0.6], [L * 0.3, 0.1], [L * 0.1, -0.08], [-L * 0.35, -0.04]];
  const hull = new THREE.Mesh(extrudeProfile(chaikin(hullP, 2), Wd * 0.95, 0.06), paint); hull.castShadow = true; g.add(hull);
  const inner = new THREE.Mesh(extrudeProfile(chaikin([[-L / 2 + 0.15, 0.78], [-L / 2 + 0.15, 0.88], [L * 0.3, 0.92], [L * 0.3, 0.8]], 1), Wd * 0.8, 0.02), wood); g.add(inner);
  const stripe = new THREE.Mesh(extrudeProfile(chaikin([[-L / 2, 0.55], [-L / 2, 0.64], [L * 0.43, 0.7], [L * 0.43, 0.6]], 1), Wd * 0.97, 0.005), white); g.add(stripe);
  const box = (w, h, d, m, x, y, z, parent = g) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.castShadow = true; b.position.set(x, y, z); parent.add(b); return b; };
  box(0.55, 0.12, Wd * 0.7, wood, -L * 0.1, 0.9, 0); box(0.55, 0.12, Wd * 0.7, wood, -L * 0.3, 0.9, 0); box(0.1, 0.4, Wd * 0.7, dark, L * 0.12, 1.1, 0);
  box(0.08, 0.5, 0.08, chrome, L * 0.16, 1.45, Wd * 0.3); box(0.08, 0.5, 0.08, chrome, L * 0.16, 1.45, -Wd * 0.3); g.add(Object.assign(new THREE.Mesh(slantQuad(L * 0.16, 1.7, L * 0.22, 1.2, Wd * 0.32, Wd * 0.32), glass)));
  box(0.3, 0.7, 0.35, dark, -L / 2 - 0.12, 0.9, 0); box(0.08, 0.5, 0.18, chrome, -L / 2 - 0.2, 0.4, 0); { const pr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 12).rotateZ(Math.PI / 2), chrome); pr.position.set(-L / 2 - 0.25, 0.1, 0); g.add(pr); }
  const rider = new THREE.Group(); rider.visible = false; g.add(rider); const suit = cm('#35402c', 0.8), skin = cm('#d8b08a', 0.7);
  box(0.3, 0.5, 0.28, suit, -L * 0.1, 1.5, Wd * 0.18, rider); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skin); hd.position.set(-L * 0.1, 1.9, Wd * 0.18); rider.add(hd);
  const pivot = new THREE.Group(); g.add(pivot);
  root.userData = { pivot, wheels: [], front: [], g, rider, boat: true };
  return root;
}
// ----- water surface: ripples and a soft reflection -----
let WATER_MATS = [];
function waterMaterial() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) { const x = Math.random() * 128, y = Math.random() * 128, r = 3 + Math.random() * 9, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, Math.random() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const bump = new THREE.CanvasTexture(c); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(10, 10);
  const m = new THREE.MeshStandardMaterial({ color: srgb('#2a7488'), roughness: 0.16, metalness: 0.0, transparent: true, opacity: 0.9, bumpMap: bump, bumpScale: 0.45, emissive: srgb('#0a2a36'), emissiveIntensity: 0.35 });
  m.userData.bump = bump; WATER_MATS.push(m); return m;
}
function buildWaterMesh(wg) {
  WATER_MATS = []; if (!LAKE || LAKE.type !== 'rect') return;
  const w = LAKE.axis === 'y' ? (FW + 800) / U : LAKE.w / U, h = LAKE.axis === 'y' ? LAKE.h / U : (FH + 800) / U;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w + 700, h + 700).rotateX(-Math.PI / 2), waterMaterial()); mesh.material.userData.bump.repeat.set((w + 700) / 14, (h + 700) / 14);
  const cx = LAKE.axis === 'y' ? FW / 2 : LAKE.x + LAKE.w / 2, cy = LAKE.axis === 'y' ? LAKE.y + LAKE.h / 2 : FH / 2; mesh.position.set(wx(cx) + (LAKE.axis === 'x' ? -LAKE.dir * 340 : 0), WATER_Y + 0.08, wz(cy) + (LAKE.axis === 'y' ? -LAKE.dir * 340 : 0)); mesh.receiveShadow = true; wg.add(mesh);
}
function waterTick(t) { for (const m of WATER_MATS) { m.userData.bump.offset.set(t * 0.012, t * 0.008); } }
