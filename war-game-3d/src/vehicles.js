// ---------- Vehicles: models with opening doors, driving, collisions ----------
// Speeds are in field px per second (20 px = 1 m).
const VT = {
  sedan: { max: 340, rev: 100, acc: 220, brk: 420, steer: 0.62, hp: 130, door: [0.02, 0.3] },
  pickup: { max: 320, rev: 95, acc: 200, brk: 400, steer: 0.58, hp: 150, door: [0.1, 0.28] },
  van: { max: 290, rev: 90, acc: 170, brk: 380, steer: 0.55, hp: 160, door: [0.27, 0.28] },
  truck: { max: 250, rev: 80, acc: 140, brk: 340, steer: 0.5, hp: 240, door: [0.36, 0.2] },
  jeep: { max: 370, rev: 110, acc: 250, brk: 430, steer: 0.66, hp: 170, door: [0.02, 0.28] },
  wreck: { max: 0, rev: 0, acc: 0, brk: 0, steer: 0, hp: 1, door: [0.02, 0.3] },
};
class Vehicle {
  constructor(o) {
    this.type = o.type; this.col = o.col; this.x = o.x + o.w / 2; this.y = o.y + o.h / 2; this.heading = o.heading;
    this.halfL = Math.max(o.w, o.h) / 2; this.halfW = Math.min(o.w, o.h) / 2;
    this.speed = 0; this.steer = 0; this.hp = VT[o.type].hp; this.maxHp = this.hp; this.doorHold = 0; this.doorT = 0; this.spin = 0;
    this.drivable = o.type !== 'wreck'; this.burned = o.type === 'wreck'; this.mesh = null; this.pitch = 0; this.roll = 0;
  }
  get T() { return VT[this.type]; }
  fwd() { return { x: Math.cos(this.heading), y: Math.sin(this.heading) }; }
  left() { return { x: Math.sin(this.heading), y: -Math.cos(this.heading) }; }
}
function obbLocal(v, x, y) { const c = Math.cos(v.heading), s = Math.sin(v.heading), dx = x - v.x, dy = y - v.y; return { lx: dx * c + dy * s, ly: -dx * s + dy * c, c, s }; }
function inOBB(v, x, y, m = 0) { const p = obbLocal(v, x, y); return Math.abs(p.lx) < v.halfL + m && Math.abs(p.ly) < v.halfW + m; }
// push a circle out of an oriented box; returns the push direction or null
function pushOutOBB(e, r, v) {
  const p = obbLocal(v, e.x, e.y), cx = clampN(p.lx, -v.halfL, v.halfL), cy = clampN(p.ly, -v.halfW, v.halfW);
  const dx = p.lx - cx, dy = p.ly - cy, d = Math.hypot(dx, dy);
  let nx, ny, push;
  if (d > 0) { if (d >= r) return null; nx = dx / d; ny = dy / d; push = r - d; }
  else {                                  // centre inside the box: leave through the nearest face
    const ex = v.halfL - Math.abs(p.lx), ey = v.halfW - Math.abs(p.ly);
    if (ex < ey) { nx = Math.sign(p.lx) || 1; ny = 0; push = ex + r; } else { nx = 0; ny = Math.sign(p.ly) || 1; push = ey + r; }
  }
  const wxn = nx * p.c - ny * p.s, wyn = nx * p.s + ny * p.c;
  e.x += wxn * push; e.y += wyn * push;
  return { x: wxn, y: wyn };
}

// ---------- Model ----------
function makeVehicleMesh(v) {
  const L = v.halfL * 2 / U, Wd = v.halfW * 2 / U, g = new THREE.Group(), root = new THREE.Group(), wreck = v.type === 'wreck';
  root.add(g);
  const body = stdMat(null, wreck ? '#2a2420' : v.type === 'jeep' ? '#5a6340' : v.col, wreck ? 0.95 : 0.32, wreck ? 0.1 : 0.55);
  const glass = wreck ? stdMat(null, '#111', 1) : glassMat(), dark = stdMat(null, '#18191b', 0.7, 0.2);
  const box = (w, h, d, m, x, y, z, parent = g) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.castShadow = true; b.receiveShadow = true; b.position.set(x, y, z); parent.add(b); return b; };
  const T = v.type;
  if (T === 'truck') {
    box(L * 0.28, 1.5, Wd, body, L * 0.36, 1.3, 0); box(L * 0.18, 0.8, Wd * 0.94, glass, L * 0.4, 1.7, 0);
    box(L * 0.66, 2.2, Wd, stdMat(null, '#c8c8c2', 0.7, 0.2), -L * 0.17, 1.65, 0); box(L, 0.3, Wd * 0.9, dark, 0, 0.55, 0);
  } else if (T === 'van') {
    box(L, 1.0, Wd, body, 0, 0.8, 0); box(L * 0.88, 0.95, Wd * 0.96, body, -L * 0.04, 1.75, 0); box(L * 0.3, 0.6, Wd * 0.98, glass, L * 0.32, 1.78, 0);
  } else if (T === 'pickup') {
    box(L, 0.7, Wd, body, 0, 0.75, 0); box(L * 0.32, 0.65, Wd * 0.94, body, L * 0.1, 1.38, 0); box(L * 0.3, 0.45, Wd * 0.96, glass, L * 0.11, 1.4, 0);
    box(L * 0.44, 0.35, 0.08, body, -L * 0.25, 1.2, Wd / 2 - 0.04); box(L * 0.44, 0.35, 0.08, body, -L * 0.25, 1.2, -Wd / 2 + 0.04); box(0.08, 0.35, Wd, body, -L * 0.47, 1.2, 0);
  } else if (T === 'jeep') {
    box(L, 0.7, Wd, body, 0, 0.8, 0); box(0.1, 0.55, Wd * 0.9, glass, L * 0.14, 1.4, 0);
    for (const sz of [-1, 1]) box(0.1, 0.8, 0.1, body, -L * 0.2, 1.4, sz * Wd * 0.4); box(0.1, 0.1, Wd * 0.85, body, -L * 0.2, 1.8, 0);
    box(0.5, 0.5, 0.5, dark, -L * 0.1, 1.2, Wd * 0.2); box(0.5, 0.5, 0.5, dark, L * 0.02, 1.2, Wd * 0.2);
  } else {
    box(L, 0.65, Wd, body, 0, 0.72, 0); box(L * 0.52, 0.55, Wd * 0.9, body, -L * 0.05, 1.28, 0); box(L * 0.5, 0.4, Wd * 0.93, glass, -L * 0.05, 1.28, 0);
  }
  // wheels: front pair steers, all spin
  const wr = T === 'truck' ? 0.5 : T === 'van' ? 0.36 : T === 'jeep' ? 0.4 : T === 'pickup' ? 0.38 : 0.34, wm = stdMat(null, '#141414', 0.9);
  const wheels = [], front = [];
  for (const [fx, isF] of [[0.32, true], [-0.32, false]]) for (const sz of [-1, 1]) {
    if (wreck && Math.random() < 0.3) continue;
    const grp = new THREE.Group(); grp.position.set(L * (T === 'truck' && !isF ? -0.3 : fx), wr, sz * (Wd / 2 - 0.05));
    const geo = new THREE.CylinderGeometry(wr, wr, 0.24, 14); geo.rotateX(Math.PI / 2);
    const w = new THREE.Mesh(geo, wm); w.castShadow = true; grp.add(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.5, wr * 0.5, 0.26, 10).rotateX(Math.PI / 2), stdMat(null, '#9a9ea2', 0.4, 0.8)); grp.add(hub);
    g.add(grp); wheels.push(w); if (isF) front.push(grp);
  }
  if (T === 'truck') for (const sz of [-1, 1]) { const grp = new THREE.Group(); grp.position.set(-L * 0.42, wr, sz * (Wd / 2 - 0.05)); const geo = new THREE.CylinderGeometry(wr, wr, 0.24, 14); geo.rotateX(Math.PI / 2); const w = new THREE.Mesh(geo, wm); w.castShadow = true; grp.add(w); g.add(grp); wheels.push(w); }
  if (!wreck) for (const sz of [-1, 1]) {
    box(0.06, 0.16, 0.3, new THREE.MeshStandardMaterial({ color: '#f4f0d8', emissive: '#f4f0d8', emissiveIntensity: 0.5 }), L / 2, 0.85, sz * Wd * 0.33);
    box(0.06, 0.14, 0.3, new THREE.MeshStandardMaterial({ color: '#a01010', emissive: '#a01010', emissiveIntensity: 0.4 }), -L / 2, 0.85, sz * Wd * 0.33);
  }
  // driver door (left side): a dark cabin recess with a seat, and a hinged panel in front of it
  const [dxf, dlf] = VT[T].door, dx = L * dxf, dl = L * dlf, dy = T === 'truck' ? 1.25 : 0.95, dh = T === 'truck' ? 1.3 : 0.62;
  box(dl, dh, 0.05, stdMat(null, '#141416', 0.9), dx, dy, -Wd / 2 + 0.01); box(dl * 0.6, 0.12, 0.38, stdMat(null, '#2a2a30', 0.9), dx - dl * 0.1, dy - 0.15, -Wd / 2 + 0.2);
  box(dl * 0.6, 0.4, 0.1, stdMat(null, '#2a2a30', 0.9), dx - dl * 0.3, dy + 0.1, -Wd / 2 + 0.2);
  const pivot = new THREE.Group(); pivot.position.set(dx + dl / 2, dy, -Wd / 2 - 0.03); g.add(pivot);
  box(dl, dh, 0.06, body, -dl / 2, 0, 0, pivot); box(dl * 0.86, dh * 0.45, 0.07, glass, -dl / 2, dh * 0.34, 0, pivot); box(0.14, 0.04, 0.06, stdMat(null, '#c8c8c8', 0.3, 0.9), -dl + 0.2, -0.02, -0.05, pivot);
  if (wreck) g.rotation.z = rnd(-0.05, 0.05);
  root.userData = { pivot, wheels, front, g };
  return root;
}
function burnVehicle(v) {
  v.burned = true; v.drivable = false;
  v.mesh.traverse(m => { if (m.material && m.material.color && !m.userData.burnt) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.12); if (m.material.emissive) m.material.emissive.setHex(0); m.userData.burnt = true; } });
}
function syncVehicles(dt) {
  for (const v of vehicles) {
    const m = v.mesh; if (!m) continue;
    v.doorT = clampN(v.doorT + ((v.doorHold > 0 || v.occupiedOpen) ? 1 : -1) * dt * 3, 0, 1);
    const x = wx(v.x), z = wz(v.y), c = Math.cos(v.heading), s = Math.sin(v.heading), hl = v.halfL / U, hw = v.halfW / U;
    const hF = hAt(x + c * hl, z + s * hl), hB = hAt(x - c * hl, z - s * hl), hLf = hAt(x + s * hw, z - c * hw), hR = hAt(x - s * hw, z + c * hw);
    const tp = Math.atan2(hF - hB, hl * 2), tr = Math.atan2(hR - hLf, hw * 2);
    v.pitch += (tp - v.pitch) * Math.min(1, dt * 8); v.roll += (tr - v.roll) * Math.min(1, dt * 8);
    m.position.set(x, hAt(x, z), z); m.rotation.order = 'YZX'; m.rotation.set(v.roll * 0.8, -v.heading, v.pitch);
    const u = m.userData;
    u.pivot.rotation.y = -1.15 * v.doorT;
    v.spin += (v.speed / U) * dt / 0.36;
    for (const w of u.wheels) w.rotation.z = -v.spin;
    for (const f of u.front) f.rotation.y = -v.steer * 0.9;
  }
}

// ---------- Driving ----------
function driveVehicle(v, dt) {
  const T = v.T;
  let thr = (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 1 : 0), st = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
  if (touch.move) { const sv = stickVec(touch.move); thr = -sv.y; st = sv.x; }
  const sp = v.speed;
  if (thr > 0.05) v.speed += (sp < -5 ? T.brk : T.acc) * thr * dt;
  else if (thr < -0.05) v.speed -= (sp > 5 ? T.brk : T.acc * 0.7) * -thr * dt;
  else v.speed -= Math.sign(sp) * Math.min(Math.abs(sp), 70 * dt);
  if (keys[' ']) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 560 * dt);
  v.speed = clampN(v.speed, -T.rev, T.max);
  const target = st * T.steer * (1 - 0.55 * Math.min(1, Math.abs(v.speed) / T.max));
  v.steer += (target - v.steer) * Math.min(1, dt * 7);
  moveVehicle(v, dt);
}
function moveVehicle(v, dt) {
  v.heading += (v.speed / (v.halfL * 1.25)) * Math.tan(v.steer) * dt;
  v.x += Math.cos(v.heading) * v.speed * dt; v.y += Math.sin(v.heading) * v.speed * dt;
  let hit = 0;
  for (const off of [-0.62, 0, 0.62]) {         // three circles along the body keep the car out of walls, trees and rocks
    const p = { x: v.x + Math.cos(v.heading) * v.halfL * off, y: v.y + Math.sin(v.heading) * v.halfL * off }, ox = p.x, oy = p.y;
    pushOut(p, v.halfW * 1.05, v);
    const dx = p.x - ox, dy = p.y - oy; if (dx || dy) { v.x += dx; v.y += dy; hit = Math.max(hit, Math.hypot(dx, dy)); }
  }
  v.x = clampN(v.x, 30, FW - 30); v.y = clampN(v.y, 30, FH - 30);
  if (hit > 0.4 && Math.abs(v.speed) > 40) {
    const imp = Math.abs(v.speed);
    if (imp > 110 && v.occupiedBy) { damageVehicle(v, (imp - 90) * 0.1); shake = Math.max(shake, 7); Sound.hit(); }
    v.speed *= 0.55;
  }
}
// cars that nobody is driving roll to a stop
function coastVehicles(dt) {
  for (const v of vehicles) if (!v.occupiedBy && Math.abs(v.speed) > 1) { v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 220 * dt); v.steer *= 0.9; moveVehicle(v, dt); }
}
function damageVehicle(v, n) {
  if (v.burned) return;
  v.hp -= n;
  if (v.hp <= 0) explodeVehicle(v);
}
function explodeVehicle(v) {
  boom(v.x, v.y, '#fa3', 50); boom(v.x, v.y, '#555', 30); boom(v.x, v.y, '#ffcc66', 20); shake = 16; Sound.boom();
  for (const e of enemies) if (Math.hypot(e.x - v.x, e.y - v.y) < 140) { e.hp -= 12; e.flash = 0.1; }
  const driver = v.occupiedBy; v.hp = 0; v.speed = 0;
  if (driver) { exitVehicle(true); player.damage(30); }
  burnVehicle(v);
}
function runOver(v) {
  if (Math.abs(v.speed) < 90) return;
  for (const e of enemies) {
    if (e.hitCd > 0 || !inOBB(v, e.x, e.y, e.r * 0.8)) continue;
    e.hitCd = 0.45; e.hp -= e.type === 'boss' ? 4 : e.type === 'tank' ? 5 : 10; e.flash = 0.12;
    boom(e.x, e.y, '#a02020', 10); Sound.hit(); shake = Math.max(shake, 5); v.speed *= 0.94;
    if (e.type === 'tank' || e.type === 'boss') damageVehicle(v, 9);
  }
}

// ---------- Getting in and out ----------
function doorPoint(v) { const f = v.fwd(), l = v.left(), dx = v.halfL * 2 * VT[v.type].door[0]; return { x: v.x + f.x * dx + l.x * (v.halfW + 20), y: v.y + f.y * dx + l.y * (v.halfW + 20) }; }
function nearestVehicle() {
  let best = null, bd = 1e9;
  for (const v of vehicles) { if (!v.drivable) continue; const d = Math.hypot(v.x - player.x, v.y - player.y); if (d < bd && inOBB(v, player.x, player.y, 48)) { bd = d; best = v; } }
  return best;
}
function startEnter(v) {
  if (Math.abs(v.speed) > 40) return;
  player.enter = { v, t: 0, x0: player.x, y0: player.y }; v.doorHold = 1.4; Sound.tone(200, 0.1, 'triangle', 0.05);
}
function exitVehicle(forced) {
  const v = player.driving; if (!v) return;
  if (!forced && Math.abs(v.speed) > 70) return;
  const f = v.fwd(), l = v.left(), r = player.r + 3;
  const spots = [[l.x, l.y, v.halfW + 34], [-l.x, -l.y, v.halfW + 34], [-f.x, -f.y, v.halfL + 34], [f.x, f.y, v.halfL + 34]];
  let spot = null;
  for (const [dx, dy, d] of spots) { const x = v.x + dx * d, y = v.y + dy * d; if (pointFree(x, y, r) && x > 20 && x < FW - 20 && y > 20 && y < FH - 20) { spot = { x, y }; break; } }
  if (!spot) spot = { x: v.x + l.x * (v.halfW + 34), y: v.y + l.y * (v.halfW + 34) };
  player.x = spot.x; player.y = spot.y; player.fy = floorY(spot.x, spot.y); player.vx = player.vy = player.vz = 0; player.grounded = true; player.driving = null; v.occupiedBy = null; v.doorHold = 1.2; v.occupiedOpen = false;
  Sound.engineOff(); Sound.tone(180, 0.1, 'triangle', 0.05);
}
function updateEnter(dt) {
  const e = player.enter; if (!e) return;
  e.t += dt; const k = Math.min(1, e.t / 0.5), dp = doorPoint(e.v);
  player.x = e.x0 + (dp.x - e.x0) * k; player.y = e.y0 + (dp.y - e.y0) * k;
  if (e.t >= 0.6) { player.driving = e.v; e.v.occupiedBy = true; e.v.doorHold = 0.5; player.enter = null; Sound.engineOn(); look.yaw = e.v.heading; look.pitch = 0.2; }
}
