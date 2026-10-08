// ---------- Ambient life: pedestrians who panic at gunfire, stray dogs, birds by day and bats by night, car alarms ----------
const AMB = { civs: [], birds: null, bird: [], scatter: 0, nextAlarmNoise: 0 };
const CIV_TINTS = ['#e8d6bc', '#bcd2e8', '#e8bcc4', '#c8e8bc', '#e8e4a8', '#d4bce8', '#f0c8a0', '#a8c8c8'];
function clearAmbient() { for (const c of AMB.civs) if (c.mesh) scene.remove(c.mesh); AMB.civs = []; }
function spawnAmbient() {
  clearAmbient(); const real = MAP.id !== 'proc', n = gameMode === 'br' ? 4 : real ? 9 : 5, pts = [];
  for (const r of roads) for (const p of r.pts) pts.push({ x: p.x, y: p.y, half: r.half });
  const spot = () => {
    for (let k = 0; k < 60; k++) {
      let x, y; if (pts.length && Math.random() < 0.8) { const p = pick(pts), a = Math.random() * 6.283, d = p.half + rnd(14, 60); x = p.x + Math.cos(a) * d; y = p.y + Math.sin(a) * d; } else { x = rnd(200, FW - 200); y = rnd(200, FH - 200); }
      if (x < 80 || y < 80 || x > FW - 80 || y > FH - 80 || buildingAt(x, y) || !pointFree(x, y, 12) || inLake(x, y, -40) || Math.hypot(x - player.x, y - player.y) < 200) continue; return { x, y };
    }
    return null;
  };
  for (let i = 0; i < n + 2; i++) {
    const s = spot(); if (!s) continue; const dog = i >= n, c = { x: s.x, y: s.y, dog, hp: dog ? 2 : 2, state: 'idle', t: rnd(0.5, 4), tx: s.x, ty: s.y, speedNow: 0, phase: Math.random() * 6, moveAngle: Math.random() * 6.28, angle: 0, crouchK: 0, flash: 0, fear: null, r: dog ? 8 : 9 };
    if (dog) c.mesh = makeDogMesh(c); else { const st = pick(['shirt', 'shirt', 'shirt', 'lungi', 'sari', 'sari', 'kurta']); c.mesh = makeCivilian({ style: st, scale: st === 'sari' || st === 'kurta' ? rnd(0.9, 0.97) : rnd(0.96, 1.04) }); }
    scene.add(c.mesh); AMB.civs.push(c);
  }
  if (!AMB.birds) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.12, 0, -0.3, 0.1, 0, 0, 0, 0, 0, -0.12, 0, 0.3, 0.1, 0, 0], 3)); g.computeVertexNormals();
    AMB.birds = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: true }), 40); AMB.birds.frustumCulled = false; AMB.birds.count = 0; scene.add(AMB.birds);
    for (let i = 0; i < 40; i++) AMB.bird.push({ a: Math.random() * 6.283, r: rnd(18, 70), h: rnd(9, 22), sp: rnd(0.25, 0.6) * (Math.random() < 0.5 ? 1 : -1), ph: Math.random() * 6, sc: 0, ox: 0, oz: 0, dx: 0, dz: 0 });
  }
}
function civScare(x, y, r) {
  for (const c of AMB.civs) {
    if (c.hp <= 0) continue; const d = Math.hypot(c.x - x, c.y - y); if (d > r) continue;
    c.fear = { x, y }; if (c.state !== 'flee' && c.state !== 'cower') { c.state = !c.dog && d < 260 ? 'cower' : 'flee'; c.t = c.state === 'cower' ? rnd(1.8, 3.2) : rnd(6, 10); if (c.dog) Sound.bark && Sound.bark(c.x, c.y); else Sound.panic && Sound.panic(c.x, c.y); }
  }
  if (r > 300) AMB.scatter = 3.5;
}
function civBlast(x, y, R) { for (const c of AMB.civs) if (c.hp > 0 && Math.hypot(c.x - x, c.y - y) < R) killCiv(c, 'blast'); }
function killCiv(c, why) {
  if (c.hp <= 0 && c.dead) return; c.hp = 0; c.dead = true; if (c.mesh) { scene.remove(c.mesh); c.mesh = null; }
  addBlood(c.x, c.y, 1.1); spray(c.x, c.y, 1, 10, ['#9a0d0d', '#c01818'], 120, 0.6, { up: 2.5, g: 14 });
  if (!c.dog) { score = Math.max(0, score - 150); notify('Civilian down!  -150'); Sound.hurt && Sound.hurt(); } else notify('A stray dog was killed  -50'), score = Math.max(0, score - 50);
  if (gameMode === 'mission' && MS.cur) MS.cur.noisy = true;
}
function updateAmbient(dt) {
  AMB.scatter -= dt; AMB.nextAlarmNoise -= dt;
  for (const c of AMB.civs) {
    if (c.hp <= 0) continue; const d = Math.hypot(c.x - player.x, c.y - player.y); if (d > 2400) continue;
    c.t -= dt; let spd = 0, dx = 0, dy = 0;
    if (c.state === 'idle') { if (c.t <= 0) { let tries = 0, tx, ty; do { const a = Math.random() * 6.283, L = rnd(120, 420); tx = clampN(c.x + Math.cos(a) * L, 100, FW - 100); ty = clampN(c.y + Math.sin(a) * L, 100, FH - 100); tries++; } while (tries < 12 && (buildingAt(tx, ty) || !pointFree(tx, ty, 12) || inLake(tx, ty, -40))); c.tx = tx; c.ty = ty; c.state = 'walk'; c.t = 14; } }
    else if (c.state === 'walk') { dx = c.tx - c.x; dy = c.ty - c.y; const l = Math.hypot(dx, dy); if (l < 20 || c.t <= 0) { c.state = 'idle'; c.t = rnd(2, 6); } else { spd = c.dog ? 70 : 42; dx /= l; dy /= l; } }
    else if (c.state === 'cower') { if (c.t <= 0) { c.state = 'flee'; c.t = rnd(6, 9); } }
    else if (c.state === 'flee') { const f = c.fear || { x: player.x, y: player.y }; dx = c.x - f.x; dy = c.y - f.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; spd = c.dog ? 190 : 150; if (c.t <= 0 || l > 700) { c.state = 'idle'; c.t = rnd(3, 6); c.fear = null; } }
    c.crouchK += ((c.state === 'cower' ? 1 : 0) - c.crouchK) * Math.min(1, dt * 8);
    c.speedNow = spd;
    if (spd) {
      c.x += dx * spd * dt; c.y += dy * spd * dt; c.moveAngle = Math.atan2(dy, dx); c.angle = c.moveAngle; c.phase += dt * spd * 0.1;
      if (pushOut(c, c.r) && c.state === 'walk') c.t -= dt * 3; if (buildingAt(c.x, c.y) && c.state !== 'flee') { c.x -= dx * spd * dt * 2; c.y -= dy * spd * dt * 2; c.state = 'idle'; c.t = 1; }
      c.x = clampN(c.x, 60, FW - 60); c.y = clampN(c.y, 60, FH - 60);
    }
  }
  for (const v of vehicles) {                                    // car alarms
    if (!(v.alarm > 0)) continue; v.alarm -= dt; v.alarmT = (v.alarmT || 0) - dt;
    if (v.alarmT <= 0) { v.alarmT = 0.3; v.alarmOn = !v.alarmOn; Sound.carAlarm && Sound.carAlarm(v.x, v.y, v.alarmOn); }
    if (AMB.nextAlarmNoise <= 0) { AMB.nextAlarmNoise = 2.5; aiNoise(v.x, v.y, 520); }
    if (v.alarm <= 0) v.alarmOn = false;
  }
}
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bp = new THREE.Vector3(), _bs = new THREE.Vector3(), _bc = new THREE.Color(), _by = new THREE.Vector3(0, 1, 0);
function syncAmbient(t, dt) {
  for (const c of AMB.civs) {
    const m = c.mesh; if (!m) continue; const d = Math.hypot(c.x - player.x, c.y - player.y) / U; m.visible = d < 130; if (!m.visible) continue;
    const x = wx(c.x), z = wz(c.y); m.position.set(x, floorY(c.x, c.y), z);
    if (c.dog) syncActor(c, 0, dt, d);
    else { m.rotation.y = -(c.angle || 0); updateHuman(m, dt, c.speedNow, false, c.crouchK, 0, true); m.userData.gun.visible = false; dressTrack(m); }
  }
  // birds by day, bats at night, none in rain
  const B = AMB.birds; if (!B) return; const night = ENV.night > 0.5, n = ENV.rain > 0.5 ? 0 : night ? 14 : 30; B.count = n; if (!n) return;
  const sc = AMB.scatter > 0, px = wx(player.x), pz = wz(player.y);
  for (let i = 0; i < n; i++) {
    const b = AMB.bird[i], sp = (night ? 1.7 : 1) * b.sp * (sc ? 2.6 : 1); b.a += sp * dt; const rr = b.r * (sc ? 1 + (3.5 - Math.max(0, AMB.scatter)) * 0.5 : 1);
    const x = px + Math.cos(b.a) * rr, z = pz + Math.sin(b.a) * rr, y = Math.max(hAt(x, z) + 5, b.h + Math.sin(t * 0.7 + b.ph) * 2 + (sc ? (3.5 - AMB.scatter) * 4 : 0) + (night ? -4 : 0));
    const heading = b.a + (sp > 0 ? Math.PI / 2 : -Math.PI / 2) + (night ? Math.sin(t * 5 + b.ph) * 0.5 : 0), flap = 0.55 + 0.45 * Math.sin(t * (night ? 18 : 11) + b.ph);
    _bq.setFromAxisAngle(_by, -heading); _bp.set(x, y, z); _bs.set(night ? 1.4 : 1, 1, flap * (night ? 1.5 : 1)); _bm.compose(_bp, _bq, _bs); B.setMatrixAt(i, _bm); B.setColorAt(i, _bc.set(night ? '#141418' : i % 3 ? '#2a2a2e' : '#dcdcd8'));
  }
  B.instanceMatrix.needsUpdate = true; if (B.instanceColor) B.instanceColor.needsUpdate = true;
}
