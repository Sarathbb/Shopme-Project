// ---------- Vehicle combat: roof machine guns, a rocket pod on the jeep, armed enemy trucks and boats that hunt you ----------
let rockets = [];
const VG = { heat: 0, lock: 0, cool: 0, rcool: 0, rockets: 6 };      // the mounted gun on the vehicle you drive
const GUNNED = { jeep: { mg: true, rocket: true }, boat: { mg: true } };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const hostiles = () => vehicles.filter(v => v.hostile && !v.burned);
function makeTurret() {
  const g = new THREE.Group(), pivot = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: '#3a3f44', roughness: 0.5, metalness: 0.5 }), dark = new THREE.MeshStandardMaterial({ color: '#1e2226', roughness: 0.6, metalness: 0.4 });
  const add = (geo, m, x, y, z, parent = pivot) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  add(new THREE.CylinderGeometry(0.2, 0.24, 0.22, 12), dark, 0, 0.11, 0, g); g.add(pivot); pivot.position.y = 0.3;
  add(new THREE.BoxGeometry(0.5, 0.16, 0.16), steel, 0.12, 0.12, 0); const barrel = add(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), dark, 0.62, 0.12, 0); barrel.rotation.z = Math.PI / 2;
  add(new THREE.BoxGeometry(0.06, 0.4, 0.5), steel, 0.34, 0.25, 0); add(new THREE.BoxGeometry(0.18, 0.1, 0.1), dark, -0.12, 0.1, 0);
  const muz = add(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc860, toneMapped: false }), 1.0, 0.12, 0); muz.visible = false;
  g.userData = { pivot, muz }; return g;
}
function attachTurret(root, v) {                                    // jeeps and boats carry a gun; armed enemy trucks too
  const L = v.halfL * 2 / U; let pos = null;
  if (v.type === 'jeep') pos = [-L * 0.12, 1.2]; else if (v.type === 'pickup' && v.armed) pos = [-L * 0.2, 1.15]; else if (v.type === 'boat') pos = [L * 0.2, 0.95];
  if (!pos) return; const t = makeTurret(); t.scale.setScalar(1.7); t.position.set(pos[0], pos[1], 0); (root.userData.g || root).add(t); root.userData.turret = t;
}
function giveRockets(n) { VG.rockets = Math.min(10, VG.rockets + n); }
// ----- the gun you drive -----
function playerVehicleGun(dt) {
  const v = player.driving; if (!v) return; const G = GUNNED[v.type]; v.mflash = (v.mflash || 0) - dt; VG.rcool -= dt; VG.cool -= dt; VG.lock -= dt; VG.heat = Math.max(0, VG.heat - (VG.lock > 0 ? 0.25 : 0.38) * dt);
  v.turretA = Math.atan2(aim.y - v.y, aim.x - v.x); if (!G) return;
  if ((mouse.down || touch.fire) && VG.cool <= 0 && VG.lock <= 0 && G.mg) {
    const a = v.turretA + (Math.random() - 0.5) * 0.07, d = Math.max(v.halfL, v.halfW) + 16;
    bullets.push({ x: v.x + Math.cos(a) * d, y: v.y + Math.sin(a) * d, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, dmg: 0.9, life: 1, vh: 0, veh: true });
    VG.cool = 0.075; VG.heat += 0.052; v.mflash = 0.06; Sound.shoot({ at: [v.x, v.y], vol: 0.9, ref: 10, range: 260 }); aiNoise(v.x, v.y, 1000); shake = Math.max(shake, 1.2);
    if (VG.heat >= 1) { VG.lock = 1.8; notify('Gun overheated'); Sound.dry && Sound.dry(); }
  }
}
function vehicleRocket() {
  const v = player.driving; if (!v || !GUNNED[v.type] || !GUNNED[v.type].rocket) { notify('Rockets: only the jeep has a rocket pod'); return; }
  if (VG.rcool > 0) return; if (VG.rockets <= 0) { notify('Out of rockets - ammo crates restock the pod'); return; }
  VG.rockets--; VG.rcool = 3.2; const a = Math.atan2(aim.y - v.y, aim.x - v.x), d = Math.max(v.halfL, v.halfW) + 18;
  rockets.push({ x: v.x + Math.cos(a) * d, y: v.y + Math.sin(a) * d, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, life: 2.4, mine: true }); v.mflash = 0.1; shake = Math.max(shake, 5);
  Sound.rocket && Sound.rocket(v.x, v.y);
}
function rocketBlast(r) {
  const R = 118; boom(r.x, r.y, '#fa3', 40); boom(r.x, r.y, '#777', 24); addScorch(r.x, r.y, 4.5); blastWorld(r.x, r.y, R, 14); spray(r.x, r.y, 0.6, 18, ['#6a625a', '#8a8278'], 120, 1.4, { up: 3, g: -1, drag: 1.2 }); shake = Math.max(shake, 12); Sound.boom(r.x, r.y, 1.1);
  aiNoise(r.x, r.y, 1300); civBlast(r.x, r.y, R); squadBlast(r.x, r.y, R, 18, false);
  for (const e of enemies) { const d = Math.hypot(e.x - r.x, e.y - r.y); if (e.hp > 0 && d < R + e.r) { e.hp -= 14 * Math.max(0.25, 1 - d / (R + e.r)); e.flash = 0.1; if (r.wi !== undefined) e.lastW = r.wi; e.lastHit = { vx: e.x - r.x, vy: e.y - r.y }; } }
  for (const v of vehicles) if (!v.burned && v !== player.driving) { const d = Math.hypot(v.x - r.x, v.y - r.y); if (d < R + v.halfL) damageVehicle(v, 75 * Math.max(0.3, 1 - d / (R + v.halfL))); }
  const pd = Math.hypot(player.x - r.x, player.y - r.y); if (pd < R * 0.6) { if (player.driving) damageVehicle(player.driving, 20); else player.damage(14); }
}
function updateRockets(dt) {
  for (const r of rockets) {
    r.x += r.vx * dt; r.y += r.vy * dt; r.life -= dt; if (!LITE || Math.random() < 0.5) spray(r.x, r.y, AIM_H + 0.2, 1, ['#aaa', '#777'], 8, 0.8, { up: 0.5, g: -0.2 }); if (!LITE) spray(r.x, r.y, AIM_H + 0.2, 1, ['#ffb040'], 10, 0.25, {});
    let hit = r.life <= 0 || bulletBlocked(r.x, r.y);
    if (!hit) for (const e of enemies) if (e.hp > 0 && Math.hypot(e.x - r.x, e.y - r.y) < e.r + 5) { hit = true; break; }
    if (hit) { r.dead = true; rocketBlast(r); }
  }
  rockets = rockets.filter(r => !r.dead);
}
// ----- armed enemy trucks and boats -----
function makeHostile(type, x, y, heading) {
  const boat = type === 'boat', v = new Vehicle({ type, col: boat ? '#5a4030' : '#4a3f35', x: x - (boat ? 70 : 50), y: y - (boat ? 25 : 20), w: boat ? 140 : 100, h: boat ? 50 : 40, heading });
  Object.assign(v, { hostile: true, armed: true, drivable: false, hp: 100 + Math.min(wave, 10) * 7, ttl: 110, gcool: 1.2, burst: 0, turretA: heading, stuck: 0, rev: 0, hitCd: 0 }); v.maxHp = v.hp;
  v.mesh = makeVehicleMesh(v); worldGroup.add(v.mesh); vehicles.push(v); return v;
}
function roomFor(x, y, h) {                                         // a truck-sized stretch of open ground with no parked vehicle in the way
  if (buildingAt(x, y)) return false;
  for (const k of [-1.3, -0.65, 0, 0.65, 1.3, 2.0]) if (!pointFree(x + Math.cos(h) * 50 * k, y + Math.sin(h) * 50 * k, 30)) return false;
  for (const o of vehicles) if (Math.hypot(o.x - x, o.y - y) < 150) return false; return true;
}
function spawnTechnical() {
  let p = null; for (let k = 0; k < 120 && roads.length && !p; k++) { const q = pick(pick(roads).pts); if (Math.hypot(q.x - player.x, q.y - player.y) >= 750 && roomFor(q.x, q.y, Math.atan2(player.y - q.y, player.x - q.x))) p = q; }
  for (let k = 0; k < 80 && !p; k++) { const q = freeSpot(750, 1150); if (roomFor(q.x, q.y, Math.atan2(player.y - q.y, player.x - q.x))) p = q; }
  if (!p) p = freeSpot(750, 1100); const v = makeHostile('pickup', p.x, p.y, Math.atan2(player.y - p.y, player.x - p.x)); notify('Armed truck approaching!'); saidOnce('tech', 'Alpha', 'Technical! Armed truck coming in!', 10); Sound.alert(p.x, p.y); return v;
}
function spawnPatrolBoat() {
  if (!LAKE) return null; let best = null, bd = -1;
  for (let k = 0; k < 40; k++) { const a = Math.random() * 6.283, r0 = LAKE.type === 'circle' ? Math.random() * (LAKE.r - 90) : 0, x = LAKE.type === 'circle' ? LAKE.x + Math.cos(a) * r0 : rnd(120, FW - 120), y = LAKE.type === 'circle' ? LAKE.y + Math.sin(a) * r0 : rnd(120, FH - 120);
    if (!inLake(x, y, 90)) continue; const d = Math.hypot(x - player.x, y - player.y); if (d > bd) { bd = d; best = { x, y }; } }
  if (!best) return null; const v = makeHostile('boat', best.x, best.y, Math.atan2(player.y - best.y, player.x - best.x)); notify('Patrol boat on the water!'); return v;
}
function aiDrive(v, dt) {
  const d = Math.hypot(player.x - v.x, player.y - v.y), want = Math.atan2(player.y - v.y, player.x - v.x), boat = v.type === 'boat'; let thr = 0, st = 0;
  if (v.rev > 0) { v.rev -= dt; thr = -1; st = -(v.revSteer || 1); }
  else {
    let best = null; for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.7, -1.7]) { const h = want + da, px = v.x + Math.cos(h) * (v.halfL + 90), py = v.y + Math.sin(h) * (v.halfL + 90); if (boat ? inLake(px, py, 30) : pointFree(px, py, v.halfW)) { best = h; break; } }
    if (best === null) { v.rev = 0.9; v.revSteer = Math.random() < 0.5 ? 1 : -1; }
    else {
      st = clampN(angDiff(best, v.heading) * 1.8, -1, 1);
      thr = boat ? (d > 300 ? 1 : 0.25) : d > 320 ? 1 : player.driving ? (d < 170 ? 0.3 : 0.8) : 0.85;
      if (Math.abs(v.speed) < 22 && thr > 0) { v.stuck += dt; if (v.stuck > 0.9) { v.rev = 1.0; v.revSteer = Math.sign(st) || 1; v.stuck = 0; } } else v.stuck = 0;
    }
  }
  applyDrive(v, thr, st, dt, false); if (boat) boatWake(v, dt);
}
function updateHostileVehicles(dt) {
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i]; if (!v.hostile) continue;
    if (v.burned) { v.ttl -= dt * 0.5; if (v.ttl < -60) { if (v.mesh && v.mesh.parent) v.mesh.parent.remove(v.mesh); vehicles.splice(i, 1); } continue; }
    v.ttl -= dt; v.hitCd -= dt; v.mflash = (v.mflash || 0) - dt;
    if (v.ttl <= 0 && Math.hypot(v.x - player.x, v.y - player.y) > 800) { if (v.mesh && v.mesh.parent) v.mesh.parent.remove(v.mesh); vehicles.splice(i, 1); continue; }
    aiDrive(v, dt); coastFix(v);
    const d = Math.hypot(player.x - v.x, player.y - v.y); v.turretA = Math.atan2(player.y - v.y, player.x - v.x);
    // the gunner: bursts of fire when there is a clear line
    v.gcool -= dt;
    if (v.gcool <= 0 && d < 560 * ENV.vis && lineClear(v.x, v.y, player.x, player.y)) {
      if (v.burst <= 0) { v.burst = 6; v.gcool = 1.7; } else { v.burst--; v.gcool = 0.17; const a = v.turretA + (Math.random() - 0.5) * 0.16; fire(v, a, 420, 6); }
    }
    // ramming
    if (v.type !== 'boat' && v.hitCd <= 0) {
      const pv = player.driving;
      if (!pv && Math.abs(v.speed) > 100 && inOBB(v, player.x, player.y, player.r + 2)) { player.damage(12 + Math.abs(v.speed) * 0.04); v.hitCd = 1; v.speed *= 0.5; shake = Math.max(shake, 8); Sound.crash && Sound.crash(120, v.x, v.y); }
      else if (pv && (inOBB(v, pv.x, pv.y, pv.halfW) || inOBB(pv, v.x, v.y, v.halfW))) { const rel = Math.abs(v.speed) + Math.abs(pv.speed) * 0.5; v.hitCd = 0.8; damageVehicle(v, rel * 0.06); damageVehicle(pv, rel * 0.07); const dx = v.x - pv.x, dy = v.y - pv.y, dd = Math.hypot(dx, dy) || 1; v.x += dx / dd * 18; v.y += dy / dd * 18; v.speed *= 0.5; shake = Math.max(shake, 9); Sound.crash && Sound.crash(rel, v.x, v.y); }
    }
  }
}
function coastFix(v) { v.x = clampN(v.x, 30, FW - 30); v.y = clampN(v.y, 30, FH - 30); }
function hostileDown(v) {
  v.counted = true; kills++; const pts = v.type === 'boat' ? 200 : 150; score += pts; notify(`${v.type === 'boat' ? 'Patrol boat' : 'Armed truck'} destroyed  +${pts}`);
  pickups.push({ x: v.x + 30, y: v.y, kind: 'ammo' }); if (Math.random() < 0.6) pickups.push({ x: v.x - 30, y: v.y + 10, kind: pick(['med', 'armor', 'band']) });
  saidOnce('tdown', 'Alpha', 'Technical is burning!', 8);
}
function clearVehicleCombat() { rockets = []; VG.heat = VG.lock = VG.cool = VG.rcool = 0; VG.rockets = 6; for (let i = vehicles.length - 1; i >= 0; i--) if (vehicles[i].hostile) { const v = vehicles[i]; if (v.mesh && v.mesh.parent) v.mesh.parent.remove(v.mesh); vehicles.splice(i, 1); } }
function updateVehicleCombat(dt) { if (player.driving) playerVehicleGun(dt); updateRockets(dt); updateHostileVehicles(dt); }
function drawVehicleHud() {
  const v = player.driving;
  if (v && GUNNED[v.type]) {
    const G = GUNNED[v.type], x = W / 2 - 110, y = H - 100; ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, 220, G.rocket ? 38 : 24); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect(x, y, 220, G.rocket ? 38 : 24);
    text('MG', x + 8, y + 16, 11, 'left', VG.lock > 0 ? '#f66' : '#cdb'); ctx.fillStyle = '#222'; ctx.fillRect(x + 32, y + 8, 176, 8); ctx.fillStyle = VG.lock > 0 ? '#e44' : VG.heat > 0.7 ? '#fa4' : '#7c4'; ctx.fillRect(x + 32, y + 8, 176 * Math.min(1, VG.heat), 8);
    if (G.rocket) { text('RKT', x + 8, y + 32, 11, 'left', VG.rockets ? '#cdb' : '#f66'); text(`x${VG.rockets}`, x + 40, y + 32, 11, 'left', '#fd8'); ctx.fillStyle = '#222'; ctx.fillRect(x + 76, y + 26, 132, 6); ctx.fillStyle = VG.rcool > 0 ? '#a64' : '#7c4'; ctx.fillRect(x + 76, y + 26, 132 * (VG.rcool > 0 ? 1 - Math.min(1, VG.rcool / 3.2) : 1), 6); }
    ctx.restore();
  }
  ctx.save();
  for (const h of vehicles) {                                         // tags on enemy vehicles
    if (!h.hostile || h.burned || Math.hypot(h.x - player.x, h.y - player.y) > 800) continue;
    pv.set(wx(h.x), floorY(h.x, h.y) + 2.6, wz(h.y)).project(camera); if (pv.z > 1 || Math.abs(pv.x) > 1.05 || Math.abs(pv.y) > 1.05) continue;
    const x = (pv.x * 0.5 + 0.5) * W, y = (-pv.y * 0.5 + 0.5) * H; text(h.type === 'boat' ? 'PATROL BOAT' : 'TECHNICAL', x, y, 10, 'center', '#ff8a70'); ctx.fillStyle = '#300'; ctx.fillRect(x - 22, y + 3, 44, 4); ctx.fillStyle = '#e55'; ctx.fillRect(x - 22, y + 3, 44 * clampN(h.hp / h.maxHp, 0, 1), 4);
  }
  ctx.restore();
}
function makeRocketMesh() {
  const g = new THREE.Group(), b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), new THREE.MeshStandardMaterial({ color: '#6a6e72', roughness: 0.5, metalness: 0.5 })); b.rotation.z = Math.PI / 2; g.add(b);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), new THREE.MeshStandardMaterial({ color: '#b03020', roughness: 0.5 })); tip.rotation.z = -Math.PI / 2; tip.position.x = 0.5; g.add(tip);
  const fl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false })); fl.position.x = -0.5; g.add(fl); return g;
}
