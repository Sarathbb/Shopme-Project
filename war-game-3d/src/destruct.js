// ---------- Destruction: breakable windows, wooden crates and plank walls, explosive barrels ----------
const WIN = [];                      // every window: world position, facing and its instance index (filled by buildWindows)
let WIN_SETS = null, blasts = [], fires = [];
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
const GLASS_COLS = ['#d6eefa', '#ffffff', '#9fc8dd', '#b8d9e8'], WOOD_COLS = ['#a0723f', '#c89a62', '#7a5430', '#d6b27a'];
const toGX = x => (x + FW / U / 2) * U, toGY = z => (z + FH / U / 2) * U;         // world metres back to field px

function shatterWindow(w) {
  if (w.broken || !WIN_SETS) return false; w.broken = true;
  WIN_SETS.glass.setMatrixAt(w.i, ZERO_M); WIN_SETS.glass.instanceMatrix.needsUpdate = true;
  if (w.li >= 0) { WIN_SETS.lit.setMatrixAt(w.li, ZERO_M); WIN_SETS.lit.instanceMatrix.needsUpdate = true; }
  _dp.set(w.x, w.y, w.z).addScaledVector(_dn.set(w.nx, 0, w.nz), 0.08); placeDecal(DEC.crack, _dp, _dn, w.w * 1.05, '#ffffff', w.h * 1.05);
  const gx = toGX(w.x), gy = toGY(w.z);
  spray(gx, gy, w.y, 16, GLASS_COLS, 150, 1.0, { dx: w.nx, dy: w.nz, cone: 2.2, up: 1.5, g: 14 });
  spray(gx, gy, w.y, 8, GLASS_COLS, 60, 1.0, { dx: -w.nx, dy: -w.nz, cone: 2.2, up: 1, g: 14 });
  Sound.glass && Sound.glass(gx, gy);
  return true;
}
function hitWindowAt(hx, hy) {                                    // a bullet struck the wall here: did it hit a pane?
  if (!WIN.length) return false;
  const X = wx(hx), Z = wz(hy), Y = hAt(X, Z) + AIM_H;
  for (const w of WIN) {
    if (w.broken) continue;
    const dx = X - w.x, dz = Z - w.z; if (Math.abs(dx) > 3 || Math.abs(dz) > 3) continue;
    if (Math.abs(dx * w.nx + dz * w.nz) > 0.7) continue;
    if (Math.abs(-dx * w.nz + dz * w.nx) < w.w / 2 + 0.12 && Math.abs(Y - w.y) < w.h / 2 + 0.55) return shatterWindow(w);
  }
  return false;
}
function blastWindows(x, y, R) { const X = wx(x), Z = wz(y), r = R / U; for (const w of WIN) if (!w.broken && Math.hypot(w.x - X, w.z - Z) < r) shatterWindow(w); }

// ----- wooden and explosive things -----
function obsCenter(o) { if (o.kind === 'barrel') return { x: o.x, y: o.y }; prep(o); return { x: o.cx, y: o.cy }; }
function armObstacle(o) {
  if (o.kind === 'crate') o.hp = o.maxHp = 5 + Math.round(Math.max(o.w, o.h) / 26) * 2;
  else if (o.kind === 'plank') o.hp = o.maxHp = 14;
  else if (o.kind === 'barrel' && o.col === '#b03a2e') { o.explosive = true; o.hp = o.maxHp = 3; }
}
function addDestructibles() {                                     // extra plank barricades and red fuel barrels around the buildings and the start area
  OG = null;                                                       // the spatial grid is rebuilt after this, so collision checks below scan the plain list
  for (const o of obstacles) armObstacle(o);
  const anchors = buildings.map(b => ({ x: b.cx, y: b.cy, r: Math.max(b.ow, b.oh) / 2 })).concat(obstacles.filter(o => o.kind === 'poly').map(o => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, r: Math.max(o.w, o.h) / 2 })));
  const spot = () => {
    for (let k = 0; k < 40; k++) {
      let x, y; if (anchors.length && Math.random() < 0.8) { const a = pick(anchors), ang = Math.random() * 6.283, d = a.r + rnd(45, 150); x = a.x + Math.cos(ang) * d; y = a.y + Math.sin(ang) * d; }
      else { const ang = Math.random() * 6.283, d = rnd(180, 700); x = SPAWN.x + Math.cos(ang) * d; y = SPAWN.y + Math.sin(ang) * d; }
      if (x < 100 || y < 100 || x > FW - 100 || y > FH - 100 || Math.hypot(x - SPAWN.x, y - SPAWN.y) < 120 || buildingAt(x, y) || roadDist(x, y) < 24 || !pointFree(x, y, 26)) continue;
      return { x, y };
    }
    return null;
  };
  for (let i = 0; i < 16; i++) {                                  // plank walls
    const s = spot(); if (!s) continue; const hz = Math.random() < 0.5, o = { kind: 'plank', x: s.x - (hz ? 40 : 5), y: s.y - (hz ? 5 : 40), w: hz ? 80 : 10, h: hz ? 10 : 80 };
    if (pointFree(s.x - (hz ? 34 : 0), s.y - (hz ? 0 : 34), 10) && pointFree(s.x + (hz ? 34 : 0), s.y + (hz ? 0 : 34), 10)) { armObstacle(o); obstacles.push(o); }
  }
  for (let i = 0; i < 9; i++) {                                   // clusters of red fuel barrels
    const s = spot(); if (!s) continue;
    for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) { const o = { kind: 'barrel', x: s.x + k * 19 + rnd(-3, 3), y: s.y + rnd(-8, 8), r: 7, col: '#b03a2e' }; if (pointFree(o.x, o.y, 9)) { armObstacle(o); obstacles.push(o); } }
  }
}
function breakObstacle(o, vx = 0, vy = 0) {
  if (o.gone) return; o.gone = true;
  const i = obstacles.indexOf(o); if (i >= 0) obstacles.splice(i, 1);
  if (o.mesh) { if (o.mesh.parent) o.mesh.parent.remove(o.mesh); const ci = CULL.findIndex(c => c.g === o.mesh); if (ci >= 0) CULL.splice(ci, 1); }
  const c = obsCenter(o);
  if (o.explosive) { blasts.push({ x: c.x, y: c.y, t: 0.05 + Math.random() * 0.12 }); return; }
  spray(c.x, c.y, 0.9, 26, WOOD_COLS, 260, 0.7, { up: 3.5, g: 14 });
  spray(c.x, c.y, 0.7, 8, ['#b9a98f', '#9c8f7a'], 50, 1.1, { up: 1, g: -0.5, drag: 2 });
  Sound.woodBreak && Sound.woodBreak(c.x, c.y);
}
function damageObstacle(o, dmg) {
  if (!o || !o.hp || o.gone) return;
  o.hp -= dmg;
  if (o.hp <= 0) { breakObstacle(o); return; }
  if (o.mesh && o.explosive) { const m = o.mesh.children[0] && o.mesh.children[0].material; if (m && m.emissive) { m.emissive.setRGB(0.7 * (1 - o.hp / o.maxHp), 0.1, 0); } }   // hot barrel glows as it takes damage
}
function blastWorld(x, y, R, dmg) {                               // an explosion hurts crates, planks and barrels and breaks windows
  for (const o of [...nearObs(x, y, R + 60)]) if (o.hp && !o.gone) { const c = obsCenter(o); if (Math.hypot(c.x - x, c.y - y) < R + (o.hw || o.r || 0)) damageObstacle(o, dmg); }
  blastWindows(x, y, R * 1.6);
}
function barrelExplosion(b) {
  const R = 125;
  boom(b.x, b.y, '#fa3', 36); boom(b.x, b.y, '#ffcc66', 18); boom(b.x, b.y, '#555', 22);
  spray(b.x, b.y, 0.6, 18, ['#ff8a2a', '#ffd060', '#ff5a1a'], 140, 0.9, { up: 6, g: -3 });
  spray(b.x, b.y, 0.8, 12, ['#5a544c', '#7a746a'], 70, 1.6, { up: 4, g: -1, drag: 1.5 });
  addScorch(b.x, b.y, 5.5); shake = Math.max(shake, 15); Sound.boom(b.x, b.y, 1.1);
  for (const e of enemies) { const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < R + e.r) { e.hp -= 12 * (1 - d / (R * 1.5)); e.flash = 0.12; e.lastHit = { vx: e.x - b.x, vy: e.y - b.y }; } }
  const pd = Math.hypot(player.x - b.x, player.y - b.y); if (pd < R * 0.75 && !player.driving) player.damage(Math.round(30 * (1 - pd / (R * 0.9))) + 6);
  for (const v of vehicles) if (Math.hypot(v.x - b.x, v.y - b.y) < R + 40 && v.hp > 0) damageVehicle(v, 45);
  blastWorld(b.x, b.y, R, 14);
  fires.push({ x: b.x, y: b.y, t: 6, e: 0 });
}
function updateDestruct(dt) {
  for (const b of blasts) { b.t -= dt; if (b.t <= 0) { b.done = true; barrelExplosion(b); } }
  blasts = blasts.filter(b => !b.done);
  for (const f of fires) {
    f.t -= dt; f.e -= dt;
    if (f.e <= 0) { f.e = 0.08; spray(f.x + rnd(-10, 10), f.y + rnd(-10, 10), 0.3, 1, ['#ff8a2a', '#ffd060', '#ff5a1a'], 14, 0.7, { up: 3.5, g: -2 }); if (Math.random() < 0.4) spray(f.x, f.y, 0.9, 1, ['#4a4640', '#6a645c'], 12, 1.4, { up: 2.5, g: -1.5, drag: 1 }); }
    for (const e of enemies) if (Math.hypot(e.x - f.x, e.y - f.y) < 38) { e.hp -= 2.5 * dt; e.flash = Math.max(e.flash, 0.03); }
    if (!player.driving && Math.hypot(player.x - f.x, player.y - f.y) < 30) { player.hp -= 3 * dt; player.hurt = Math.max(player.hurt, 0.05); if (player.hp <= 0) gameOver(); }
  }
  fires = fires.filter(f => f.t > 0);
}
function resetDestruct() { blasts = []; fires = []; }
