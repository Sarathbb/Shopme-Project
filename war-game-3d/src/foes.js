// ---------- New enemies (heavy, dogs, helicopter, rooftop snipers) and the motorbike ----------
function elevTarget(angle) {                                   // an elevated enemy roughly in line with the shot, so the bullet can visibly climb to it
  let best = null, bd = 1e9;
  for (const e of enemies) { if (!(e.elev > 0) || e.hp <= 0) continue; const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy); if (d > 1100 || Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle))) > 0.16) continue; if (d < bd) { bd = d; best = e; } }
  return best ? { e: best, d: bd } : null;
}
function addRoofSniper() {                                     // a sniper on the roof edge of a tall building (maps with real buildings only)
  const roofs = obstacles.filter(o => o.kind === 'poly' && (o.hgt || 0) >= 4 && o.pts && Math.hypot(o.x + o.w / 2 - player.x, o.y + o.h / 2 - player.y) > 450 && Math.hypot(o.x + o.w / 2 - player.x, o.y + o.h / 2 - player.y) < 1500);
  for (let k = 0; k < 10 && roofs.length; k++) {
    const o = pick(roofs), pn = polyNearest(o.pts, player.x, player.y); let dx = player.x - pn.qx, dy = player.y - pn.qy; const l = Math.hypot(dx, dy) || 1;
    const x = pn.qx + dx / l * 12, y = pn.qy + dy / l * 12; if (!pointFree(x, y, 8) || buildingAt(x, y)) continue;
    const e = addEnemy('sniper'); Object.assign(e, { x, y, elev: o.hgt, hold: true, sight: 1100, range: 900, rate: 2.4, bspeed: 700, mode: 'attack', roof: true }); return e;
  }
  return null;
}
function updateHeli(e, dt) {
  e.flash -= dt; e.mflash = (e.mflash || 0) - dt; e.cool -= dt; e.hitCd = (e.hitCd || 0) - dt;
  e.ang += dt * 0.4 * e.dir; const R = e.orbitR + Math.sin(performance.now() / 1700 + e.phase) * 50, tx = player.x + Math.cos(e.ang) * R, ty = player.y + Math.sin(e.ang) * R;
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(e.speed * 1.6, d * 2.2 + 30); e.x += dx / d * sp * dt; e.y += dy / d * sp * dt;
  e.x = clampN(e.x, 30, FW - 30); e.y = clampN(e.y, 30, FH - 30); e.moveAngle = Math.atan2(dy, dx); e.speedNow = sp;
  const pd = Math.hypot(player.x - e.x, player.y - e.y); e.angle = Math.atan2(player.y - e.y, player.x - e.x);
  if (e.burst > 0) { e.bt -= dt; if (e.bt <= 0) { fire(e, e.angle + (Math.random() - 0.5) * 0.18, 520, e.bdmg); e.burst--; e.bt = 0.1; } }
  else if (e.cool <= 0 && pd < e.range * ENV.vis && !playerBuilding && !smokeCuts(e.x, e.y, player.x, player.y)) { e.burst = 4; e.bt = 0; e.cool = 2.8 + Math.random() * 1.2; }
  e.chopT = (e.chopT || 0) - dt; if (e.chopT <= 0) { e.chopT = 0.17; if (pd < 1500) Sound.heliChop(e.x, e.y); }
}
function heliCrash(e) {
  boom(e.x, e.y, '#fa3', 50); boom(e.x, e.y, '#555', 30); spray(e.x, e.y, 1, 20, ['#fff1b0', '#ffc54a', '#ff8a2a'], 320, 0.6, { up: 5 }); addScorch(e.x, e.y, 6); blastWorld(e.x, e.y, 90, 8); shake = Math.max(shake, 14); Sound.boom(e.x, e.y, 1.3);
  if (Math.hypot(e.x - player.x, e.y - player.y) < 110 && !player.driving) player.damage(18);
}
// ---------- meshes ----------
function makeDogMesh(e) {
  const g = new THREE.Group(), fur = stdMat(null, pick(['#6a4a2a', '#3a2c20', '#8a6a42', '#2a2a2c']), 0.9), dark = stdMat(null, '#1a1410', 0.9), box = (w, h, d, m, x, y, z, parent = g) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.castShadow = true; b.position.set(x, y, z); parent.add(b); return b; };
  const body = new THREE.Group(); g.add(body); box(0.85, 0.3, 0.28, fur, 0, 0.5, 0, body); box(0.3, 0.34, 0.3, fur, 0.32, 0.54, 0, body);
  const head = new THREE.Group(); head.position.set(0.62, 0.66, 0); body.add(head); box(0.26, 0.22, 0.22, fur, 0, 0, 0, head); box(0.18, 0.12, 0.14, dark, 0.19, -0.05, 0, head); box(0.06, 0.12, 0.05, dark, -0.04, 0.15, 0.07, head); box(0.06, 0.12, 0.05, dark, -0.04, 0.15, -0.07, head);
  const tail = box(0.36, 0.07, 0.07, fur, -0.55, 0.6, 0, body); tail.rotation.z = 0.5;
  const legs = []; for (const [lx, lz] of [[0.32, 0.1], [0.32, -0.1], [-0.3, 0.1], [-0.3, -0.1]]) { const p = new THREE.Group(); p.position.set(lx, 0.4, lz); body.add(p); box(0.08, 0.4, 0.08, fur, 0, -0.2, 0, p); legs.push(p); }
  g.userData = { dog: true, body, legs, head, flashMats: [fur, dark] }; g.scale.setScalar(1.1); return g;
}
function makeHeliMesh(e) {
  const g = new THREE.Group(), body = stdMat(null, '#3a4048', 0.5, 0.5), dark = stdMat(null, '#16181a', 0.6, 0.4), glass = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.85 });
  const box = (w, h, d, m, x, y, z, parent = g) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.castShadow = true; b.position.set(x, y, z); parent.add(b); return b; };
  const fus = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), body); fus.scale.set(2.2, 0.95, 0.95); fus.position.y = 1.1; fus.castShadow = true; g.add(fus);
  const cock = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), glass); cock.scale.set(0.95, 0.65, 0.78); cock.position.set(1.45, 1.25, 0); g.add(cock);
  box(3.6, 0.28, 0.3, body, -3.2, 1.45, 0); box(0.08, 0.9, 0.5, dark, -4.9, 1.6, 0);
  const tail = new THREE.Group(); tail.position.set(-4.9, 1.75, 0.12); g.add(tail); box(0.05, 0.9, 0.06, dark, 0, 0, 0, tail); box(0.05, 0.06, 0.9, dark, 0, 0, 0, tail);
  const rotor = new THREE.Group(); rotor.position.set(0, 2.25, 0); g.add(rotor); box(0.1, 0.1, 0.1, dark, 0, -0.05, 0, rotor); for (let i = 0; i < 2; i++) { const b = box(5.8, 0.04, 0.22, dark, 0, 0, 0, rotor); b.rotation.y = i * Math.PI / 2; }
  for (const sz of [-1, 1]) { box(2.4, 0.08, 0.1, dark, 0, 0.0, sz * 0.8); box(0.08, 0.7, 0.08, dark, 0.7, 0.4, sz * 0.7); box(0.08, 0.7, 0.08, dark, -0.7, 0.4, sz * 0.7); }
  box(0.9, 0.12, 0.12, dark, 1.4, 0.75, 0.55); box(0.9, 0.12, 0.12, dark, 1.4, 0.75, -0.55);       // gun pods
  g.userData = { heli: true, rotor, tail, flashMats: [body, dark] }; g.scale.setScalar(1.15); return g;
}
function makeBikeMesh(v) {
  const L = v.halfL * 2 / U, root = new THREE.Group(), g = new THREE.Group(); root.add(g);
  const body = stdMat(null, v.col, 0.35, 0.55), dark = stdMat(null, '#16171a', 0.7, 0.3), chrome = stdMat(null, '#9aa0a6', 0.3, 0.9), tire = stdMat(null, '#111', 0.9);
  const box = (w, h, d, m, x, y, z, parent = g) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.castShadow = true; b.receiveShadow = true; b.position.set(x, y, z); parent.add(b); return b; };
  const wheels = [], mkWheel = (parent, x) => { const geo = new THREE.CylinderGeometry(0.34, 0.34, 0.14, 16); geo.rotateX(Math.PI / 2); const w = new THREE.Mesh(geo, tire); w.castShadow = true; const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 10).rotateX(Math.PI / 2), chrome); w.add(hub); w.position.set(x, 0.34, 0); parent.add(w); wheels.push(w); return w; };
  mkWheel(g, -L * 0.36);
  box(L * 0.5, 0.2, 0.18, body, -L * 0.04, 0.62, 0); box(L * 0.22, 0.2, 0.3, body, L * 0.1, 0.84, 0); box(L * 0.3, 0.1, 0.26, dark, -L * 0.14, 0.82, 0); box(L * 0.2, 0.12, 0.22, body, -L * 0.34, 0.74, 0); box(0.3, 0.3, 0.2, chrome, -L * 0.08, 0.38, 0.0); box(0.7, 0.07, 0.07, chrome, -L * 0.28, 0.34, 0.14);
  const front = new THREE.Group(); front.position.set(L * 0.36, 0, 0); g.add(front); mkWheel(front, 0);
  const fork = box(0.07, 0.75, 0.07, chrome, -0.02, 0.62, 0.1, front); fork.rotation.z = 0.28; const fork2 = box(0.07, 0.75, 0.07, chrome, -0.02, 0.62, -0.1, front); fork2.rotation.z = 0.28;
  box(0.1, 0.08, 0.8, dark, -0.12, 1.0, 0, front); box(0.12, 0.14, 0.2, dark, 0.02, 1.08, 0, front);
  box(0.12, 0.14, 0.14, new THREE.MeshStandardMaterial({ color: '#f4f0d8', emissive: '#f4f0d8', emissiveIntensity: 0.6 }), 0.1, 0.95, 0, front);
  const rider = new THREE.Group(); rider.visible = false; g.add(rider); const suit = stdMat(null, '#35402c', 0.8), skin = stdMat(null, '#d8b08a', 0.7), helm = stdMat(null, '#1c2230', 0.3, 0.4);
  const torso = box(0.34, 0.55, 0.28, suit, -L * 0.12, 1.25, 0, rider); torso.rotation.z = -0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), helm); head.position.set(-L * 0.04, 1.68, 0); head.castShadow = true; rider.add(head);
  for (const sz of [-1, 1]) { const arm = box(0.5, 0.1, 0.1, suit, L * 0.06, 1.2, sz * 0.2, rider); arm.rotation.z = -0.3; const leg = box(0.1, 0.5, 0.12, suit, -L * 0.06, 0.62, sz * 0.2, rider); leg.rotation.z = 0.5; }
  const pivot = new THREE.Group(); g.add(pivot);
  root.userData = { pivot, wheels, front: [front], g, rider, bike: true };
  return root;
}
// ---------- sniper laser telegraph ----------
const LASER_MAX = 6, laserPos = new Float32Array(LASER_MAX * 6), laserGeo = new THREE.BufferGeometry(); laserGeo.setAttribute('position', new THREE.BufferAttribute(laserPos, 3));
const laserLines = new THREE.LineSegments(laserGeo, new THREE.LineBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.75, depthTest: false, fog: false })); laserLines.frustumCulled = false; laserLines.renderOrder = 6; scene.add(laserLines);
function syncLasers() {
  let n = 0;
  if (state === 'playing') for (const e of enemies) {
    if (n >= LASER_MAX) break; if (!(e.hold && e.sees && e.cool < 0.9 && e.hp > 0)) continue;
    const a = n * 6, ex = wx(e.x), ez = wz(e.y), px = wx(player.x), pz = wz(player.y);
    laserPos[a] = ex; laserPos[a + 1] = floorY(e.x, e.y) + (e.elev || 0) + 1.3; laserPos[a + 2] = ez; laserPos[a + 3] = px; laserPos[a + 4] = player.fyVis + 1.2; laserPos[a + 5] = pz; n++;
  }
  laserGeo.setDrawRange(0, n * 2); laserGeo.attributes.position.needsUpdate = true; laserLines.visible = n > 0;
}
