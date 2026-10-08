// ---------- Vehicles: models with opening doors, driving, collisions ----------
// Speeds are in field px per second (20 px = 1 m).
const VT = {
  sedan: { max: 340, rev: 100, acc: 220, brk: 420, steer: 0.62, hp: 130, door: [0.02, 0.3] },
  pickup: { max: 320, rev: 95, acc: 200, brk: 400, steer: 0.58, hp: 150, door: [0.1, 0.28] },
  van: { max: 290, rev: 90, acc: 170, brk: 380, steer: 0.55, hp: 160, door: [0.27, 0.28] },
  truck: { max: 250, rev: 80, acc: 140, brk: 340, steer: 0.5, hp: 240, door: [0.36, 0.2] },
  jeep: { max: 370, rev: 110, acc: 250, brk: 430, steer: 0.66, hp: 170, door: [0.02, 0.28] },
  bike: { max: 470, rev: 70, acc: 340, brk: 520, steer: 0.85, hp: 70, door: [0.0, 0.2] },
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
function makeVehicleMesh(v) { return v.type === 'bike' ? makeBikeMesh(v) : makeCarMesh(v); }
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
    if (u.bike) { u.rider.visible = !!v.occupiedBy; u.g.rotation.x = -v.steer * 0.55 * Math.min(1, Math.abs(v.speed) / 250); }
  }
}

// ---------- Driving ----------
function driveVehicle(v, dt) {
  const T = v.T;
  let thr = (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 1 : 0), st = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
  if (touch.move) { const sv = stickVec(touch.move); thr = -sv.y; st = sv.x; }
  v.thr = Math.max(0, thr);
  Sound.skid(keys[' '] && Math.abs(v.speed) > 100 ? 1 : (Math.abs(v.steer) > 0.45 && Math.abs(v.speed) > 200 ? 0.5 : 0)); Sound.horn(!!keys['h']);
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
    if (imp > 110 && v.occupiedBy) { damageVehicle(v, (imp - 90) * 0.1); shake = Math.max(shake, 7); Sound.crash(imp, v.x, v.y); }
    v.speed *= 0.55;
  }
}
// cars that nobody is driving roll to a stop
function coastVehicles(dt) {
  for (const v of vehicles) if (!v.occupiedBy && !v.convoy && Math.abs(v.speed) > 1) { v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 220 * dt); v.steer *= 0.9; moveVehicle(v, dt); }
}
function damageVehicle(v, n) {
  if (v.burned) return;
  v.hp -= n;
  if (v.hp <= 0) explodeVehicle(v);
}
function explodeVehicle(v) {
  boom(v.x, v.y, '#fa3', 50); boom(v.x, v.y, '#555', 30); boom(v.x, v.y, '#ffcc66', 20); shake = 16; Sound.boom(v.x, v.y, 1.4);
  for (const e of enemies) if (Math.hypot(e.x - v.x, e.y - v.y) < 140) { e.hp -= 12; e.flash = 0.1; }
  blastWorld(v.x, v.y, 150, 12); addScorch(v.x, v.y, 5);
  const driver = v.occupiedBy; v.hp = 0; v.speed = 0;
  if (driver) { exitVehicle(true); player.damage(30); }
  burnVehicle(v);
}
function runOver(v) {
  if (Math.abs(v.speed) < 90) return;
  for (const e of enemies) {
    if (e.hitCd > 0 || !inOBB(v, e.x, e.y, e.r * 0.8)) continue;
    e.hitCd = 0.45; e.hp -= e.type === 'boss' ? 4 : e.type === 'tank' ? 5 : 10; e.flash = 0.12;
    boom(e.x, e.y, '#a02020', 10); Sound.hitEnemy(e.x, e.y, e.type); shake = Math.max(shake, 5); v.speed *= 0.94;
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
  player.enter = { v, t: 0, x0: player.x, y0: player.y }; v.doorHold = 1.4; Sound.carDoor(true, v.x, v.y);
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
  Sound.engineOff(); Sound.carDoor(true, v.x, v.y);
}
function updateEnter(dt) {
  const e = player.enter; if (!e) return;
  e.t += dt; const k = Math.min(1, e.t / 0.5), dp = doorPoint(e.v);
  player.x = e.x0 + (dp.x - e.x0) * k; player.y = e.y0 + (dp.y - e.y0) * k;
  if (e.t >= 0.6) { player.driving = e.v; e.v.occupiedBy = true; e.v.doorHold = 0.5; player.enter = null; Sound.carDoor(false, e.v.x, e.v.y); Sound.engineOn(); look.yaw = e.v.heading; look.pitch = 0.2; }
}
