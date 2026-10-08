// ---------- Missions: capture a zone, rescue a hostage, defend a base, destroy a convoy ----------
const MS = { n: 0, cur: null, done: 0, deck: [] };
const MTYPES = { capture: 'CAPTURE THE ZONE', rescue: 'RESCUE THE HOSTAGE', defend: 'DEFEND THE BASE', convoy: 'DESTROY THE CONVOY' };
const aliveEnemies = () => enemies.filter(e => e.hp > 0).length;
function freeSpot(minD, maxD, from = player) {
  for (let k = 0; k < 300; k++) {
    const a = Math.random() * 6.283, d = rnd(minD, maxD), x = clampN(from.x + Math.cos(a) * d, 200, FW - 200), y = clampN(from.y + Math.sin(a) * d, 200, FH - 200);
    if (pointFree(x, y, 46) && !buildingAt(x, y) && roadDist(x, y) > 35) return { x, y };
  }
  return { x: clampN(from.x + minD, 200, FW - 200), y: clampN(from.y, 200, FH - 200) };
}
function startMissions(deck) { MS.n = 0; MS.done = 0; MS.cur = null; MS.deck = deck || []; state = 'playing'; nextMission(); }
function clearMissionObjects() {
  for (let i = vehicles.length - 1; i >= 0; i--) { const v = vehicles[i]; if (v.convoy) { if (v.mesh && v.mesh.parent) v.mesh.parent.remove(v.mesh); vehicles.splice(i, 1); } }
  if (MS.cur) { if (MS.cur.hostage && MS.cur.hostage.mesh) scene.remove(MS.cur.hostage.mesh); if (MS.cur.baseMesh) scene.remove(MS.cur.baseMesh); }
  markerA.visible = markerB.visible = false;
}
function nextMission() {
  clearMissionObjects();
  MS.n++; wave = MS.n; for (const e of enemies) removeMesh(e.mesh); enemies = []; enemyBullets = []; smokes = [];
  if (!MS.deck.length) MS.deck = Object.keys(MTYPES).sort(() => Math.random() - 0.5);
  const type = MS.deck.shift(); MS.cur = DAILY.on ? withSeed(DAILY.cfg.seed + MS.n * 131, () => buildMission(type)) : buildMission(type); state = 'playing';
  notify(`MISSION ${MS.n}: ${MTYPES[type]}`); Sound.wave();
}
function buildMission(type) {
  const n = MS.n, m = { type, t: 0, done: false, delay: 1.6, spawnT: 1.5, status: '' };
  if (type === 'capture') {
    Object.assign(m, { ...freeSpot(700, 1200), r: 150, prog: 0, cap: Math.min(16, 5 + n * 2), interval: Math.max(1.8, 4 - n * 0.2) });
    for (let i = 0; i < 3; i++) spawnEnemy(m);
  } else if (type === 'rescue') {
    const camp = freeSpot(900, 1500); Object.assign(m, { ...camp, exit: { x: player.x, y: player.y, r: 110 }, hostage: { x: camp.x, y: camp.y, freed: false, cut: 0, moving: false }, guards: [], alarm: false });
    for (let i = 0, g = Math.min(9, 5 + Math.floor(n / 2)); i < g; i++) {
      const a = i / g * 6.283, d = rnd(60, 120), e = addEnemy(i === 0 && n >= 3 ? 'heavy' : 'soldier', camp);
      e.x = clampN(camp.x + Math.cos(a) * d, 60, FW - 60); e.y = clampN(camp.y + Math.sin(a) * d, 60, FH - 60); if (!pointFree(e.x, e.y, 12)) { e.x = camp.x + 30; e.y = camp.y + 30; }
      const pa = Math.random() * 6.283; Object.assign(e, { radio: false, seenAge: 99, lastSeen: { x: camp.x, y: camp.y }, guard: true, mode: 'search', role: 'assault', stealth: true, susp: 0, alertT: 0, alertFlash: 0, faceA: pa, pi: i, wait: 0,
        patrol: [0, 1, 2, 3].map(k => { const a = pa + k * 1.57 + i, d = 70 + (i % 3) * 45; return { x: clampN(camp.x + Math.cos(a) * d, 80, FW - 80), y: clampN(camp.y + Math.sin(a) * d, 80, FH - 80) }; }).filter(q => pointFree(q.x, q.y, 12)) }); m.guards.push(e);
    }
  } else if (type === 'defend') {
    const s = freeSpot(500, 900); Object.assign(m, { ...s, base: { x: s.x, y: s.y, hp: 140 + n * 10, maxHp: 140 + n * 10, r: 30 }, timeLeft: Math.min(90, 55 + n * 5), total: Math.min(90, 55 + n * 5), cap: Math.min(16, 7 + n * 2), interval: Math.max(1.6, 3 - n * 0.12) });
    m.baseMesh = makeBaseMesh(); m.baseMesh.position.set(wx(s.x), hAt(wx(s.x), wz(s.y)), wz(s.y)); scene.add(m.baseMesh);
  } else {
    buildConvoy(m);
  }
  return m;
}
function buildConvoy(m) {
  let path = null;
  const cands = roads.filter(r => r.pts.length >= 3).map(r => { let len = 0; for (let i = 1; i < r.pts.length; i++) len += Math.hypot(r.pts[i].x - r.pts[i - 1].x, r.pts[i].y - r.pts[i - 1].y); return { r, len, dn: Math.min(...r.pts.map(p => Math.hypot(p.x - player.x, p.y - player.y))) }; }).filter(c => c.len > 1200).sort((a, b) => a.dn - b.dn);
  if (cands.length) { const r = cands[0].r.pts; const df = Math.hypot(r[0].x - player.x, r[0].y - player.y), dl = Math.hypot(r[r.length - 1].x - player.x, r[r.length - 1].y - player.y); path = (df > dl ? r : r.slice().reverse()).map(p => ({ x: p.x, y: p.y })); }
  if (!path) { const a = Math.random() * 6.283; path = [{ x: clampN(player.x + Math.cos(a) * 1200, 150, FW - 150), y: clampN(player.y + Math.sin(a) * 1200, 150, FH - 150) }, { x: clampN(player.x - Math.cos(a) * 1200, 150, FW - 150), y: clampN(player.y - Math.sin(a) * 1200, 150, FH - 150) }]; }
  const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  m.path = path; m.cum = cum; m.len = cum[cum.length - 1]; m.veh = []; m.speed = 62 + Math.min(20, MS.n * 3); m.cap = Math.min(12, 4 + MS.n); m.interval = 6; m.escort = false;
  const kinds = [['truck', 150, 52], ['jeep', 84, 40], ['truck', 150, 52]];
  kinds.forEach((t, i) => {
    const v = new Vehicle({ type: t[0], col: '#4a5436', x: 0, y: 0, w: t[1], h: t[2], heading: 0 }); v.convoy = true; v.drivable = false; v.hp = v.maxHp = 55 + MS.n * 4; v.d = 90 + (kinds.length - 1 - i) * 175; v.speed = m.speed;
    placeOnPath(m, v); v.mesh = makeVehicleMesh(v); worldGroup.add(v.mesh); vehicles.push(v); m.veh.push(v);
  });
}
function placeOnPath(m, v) {
  const d = clampN(v.d, 0, m.len); let i = 1; while (i < m.cum.length - 1 && m.cum[i] < d) i++;
  const a = m.path[i - 1], b = m.path[i], l = m.cum[i] - m.cum[i - 1] || 1, t = (d - m.cum[i - 1]) / l; v.x = a.x + (b.x - a.x) * t; v.y = a.y + (b.y - a.y) * t; v.heading = Math.atan2(b.y - a.y, b.x - a.x);
}
function makeBaseMesh() {
  const g = new THREE.Group(), wood = stdMat(texWood(), '#8a7a58', 0.85), steel = stdMat(null, '#8c9296', 0.5, 0.6), red = new THREE.MeshStandardMaterial({ color: '#ff2a1a', emissive: '#ff2a1a', emissiveIntensity: 1.2 });
  const b = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = true; o.position.set(x, y, z); g.add(o); return o; };
  b(1.6, 1.2, 1.2, wood, 0, 0.6, 0); b(1.2, 1.0, 1.2, wood, 1.5, 0.5, 0.3); b(1.2, 1.0, 1.2, wood, -1.4, 0.5, -0.2); b(1.4, 1.0, 1.0, wood, 0.1, 1.7, 0.1);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 7, 8), steel); mast.position.set(0, 5, 0); mast.castShadow = true; g.add(mast); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), red); lamp.position.set(0, 8.6, 0); g.add(lamp);
  for (let i = 0; i < 3; i++) b(1.3 - i * 0.3, 0.05, 0.05, steel, 0, 3 + i * 1.3, 0); g.userData = { lamp };
  return g;
}
// ---------- the mission loop ----------
function spawnWaveAt(m, origin, cap, interval, dt) { const hz = DAILY.on && DAILY.cfg.mod.id === 'horde'; m.spawnT -= dt; if (m.spawnT <= 0 && aliveEnemies() < (hz ? Math.ceil(cap * 1.4) : cap)) { spawnEnemy(origin); m.spawnT = interval * (hz ? 0.65 : 1) * (0.8 + Math.random() * 0.5); } }
function missionComplete() {
  const m = MS.cur; if (m.done) return;
  if (m.type === 'rescue' && !m.noisy) { score += 400; notify('GHOST: nobody saw you  +400'); } m.done = true; m.delay = 2.2; MS.done++; score += 300 + MS.n * 100; Sound.wave();
  player.hp = Math.min(player.maxHp, player.hp + 30); dropCrates(); notify(`MISSION COMPLETE  +${300 + MS.n * 100}`);
}
function missionFail(why) { notify(why); endRun(false); }
function updateMission(dt) {
  const m = MS.cur; if (!m) return; m.t += dt;
  if (m.done) { m.delay -= dt; if (m.delay <= 0) { if (DAILY.on && MS.done >= 3) endRun(true); else offerUpgrades(); } return; }
  if (m.type === 'capture') {
    spawnWaveAt(m, m, m.cap, m.interval, dt);
    const inside = Math.hypot(player.x - m.x, player.y - m.y) < m.r, contested = enemies.some(e => e.hp > 0 && Math.hypot(e.x - m.x, e.y - m.y) < m.r * 0.8);
    if (inside && !contested) m.prog += dt / 22; else if (!inside) m.prog = Math.max(0, m.prog - dt / 90);
    m.status = contested && inside ? 'CONTESTED - kill the enemies in the zone' : inside ? 'Capturing...' : 'Get to the zone and hold it';
    if (m.prog >= 1) missionComplete();
  } else if (m.type === 'rescue') {
    if (m.guards.some(g => g.alertT > 0)) m.noisy = true;
    const h = m.hostage; if (!m.alarm && m.guards.some(g => g.hp > 0 && g.alertT > 0)) { m.alarm = true; for (const g of m.guards) { g.radio = true; g.lastSeen = { x: player.x, y: player.y }; g.seenAge = 0; } notify('Alarm! The guards spotted you'); }
    if (m.alarm) spawnWaveAt(m, player, 9, 9, dt);
    if (!h.freed) {
      const near = Math.hypot(player.x - h.x, player.y - h.y) < 70 && !player.driving;
      if (near && keys['f']) h.cut += dt / 2.2; else h.cut = Math.max(0, h.cut - dt * 0.6);
      m.status = near ? 'Hold F to cut the ropes' : m.guards.some(g => g.hp > 0) ? 'Reach the hostage - the guards have not seen you yet' : 'The camp is clear: free the hostage';
      if (h.cut >= 1) { h.freed = true; notify('Hostage freed! Take them to the extraction point'); Sound.pickup(); m.alarm = true; for (const g of m.guards) { g.radio = true; g.seenAge = 4; } }
    } else {
      const d = Math.hypot(player.x - h.x, player.y - h.y), tr = m.trail || (m.trail = []), last = tr[tr.length - 1];       // the hostage follows the trail you walked, so they get round buildings too
      if (!last || Math.hypot(player.x - last.x, player.y - last.y) > 28) tr.push({ x: player.x, y: player.y });
      h.moving = false;
      if (d > 80 && tr.length) {
        const t = tr[0], dd = Math.hypot(t.x - h.x, t.y - h.y), a = Math.atan2(t.y - h.y, t.x - h.x), sp = Math.min(210, 90 + d * 1.2);
        if (dd < 16) tr.shift(); else { h.x += Math.cos(a) * Math.min(dd, sp * dt); h.y += Math.sin(a) * Math.min(dd, sp * dt); h.angle = a; h.moving = true; pushOut(h, 8); }
      }
      m.status = 'Extract: get the hostage to the green zone';
      if (Math.hypot(h.x - m.exit.x, h.y - m.exit.y) < m.exit.r && Math.hypot(player.x - m.exit.x, player.y - m.exit.y) < m.exit.r + 40) missionComplete();
    }
  } else if (m.type === 'defend') {
    const b = m.base; spawnWaveAt(m, b, m.cap, m.interval, dt); m.timeLeft -= dt;
    for (const bl of enemyBullets) if (bl.life > 0 && Math.hypot(bl.x - b.x, bl.y - b.y) < 28) { b.hp -= bl.dmg * 0.7; bl.life = 0; spray(b.x, b.y, 1.2, 5, ['#fff1b0', '#ffc54a'], 200, 0.3, { dx: -bl.vx, dy: -bl.vy, up: 1.5 }); Sound.impact(b.x, b.y, 'crate'); }
    for (const e of enemies) if (e.hp > 0 && (e.bite || e.melee) && Math.hypot(e.x - b.x, e.y - b.y) < e.r + 34) { b.hp -= (e.bite ? 8 : e.melee) * dt * (e.bite ? 1 : 0); if (e.melee) { b.hp -= e.melee; e.hp = 0; boom(e.x, e.y, e.color); } }
    m.status = `Hold out - ${Math.ceil(m.timeLeft)}s`;
    if (b.hp <= 0) { boom(b.x, b.y, '#fa3', 40); Sound.boom(b.x, b.y, 1); missionFail('The base was destroyed!'); return; }
    if (m.timeLeft <= 0) missionComplete();
  } else {
    for (const v of m.veh) if (!v.burned) { v.d += m.speed * dt; placeOnPath(m, v); v.speed = m.speed; }
    const live = m.veh.filter(v => !v.burned), lead = live[0];
    if (!live.length) { missionComplete(); return; }
    if (live.some(v => v.d >= m.len - 20)) { missionFail('The convoy got away!'); return; }
    const dmin = Math.min(...live.map(v => Math.hypot(v.x - player.x, v.y - player.y)));
    if (!m.escort && dmin < 750) { m.escort = true; notify('Escorts!'); for (let i = 0; i < 4; i++) { const e = spawnEnemy(lead); if (e) { e.lastSeen = { x: player.x, y: player.y }; e.seenAge = 0; } } }
    if (m.escort) spawnWaveAt(m, lead, m.cap, m.interval, dt);
    m.status = `${live.length} vehicle${live.length > 1 ? 's' : ''} left - stop them before they escape (${Math.max(0, Math.round((m.len - lead.d) / 60))}s)`;
  }
}
// ---------- marker rings, hostage and HUD ----------
function mkMarker() {
  const g = new THREE.Group(), ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x66ffaa, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x66ffaa, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 60, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x66ffaa, transparent: true, opacity: 0.35, depthWrite: false, fog: false })); beam.position.y = 30;
  g.add(ring, disc, beam); g.visible = false; g.userData = { ring, disc, beam }; scene.add(g); return g;
}
const markerA = mkMarker(), markerB = mkMarker();
function setMarker(mk, x, y, rPx, color, beamOn) { mk.visible = true; mk.position.set(wx(x), hAt(wx(x), wz(y)) + 0.15, wz(y)); const r = rPx / U; mk.userData.ring.scale.set(r, 1, r); mk.userData.disc.scale.set(r, 1, r); mk.userData.beam.visible = !!beamOn; mk.userData.beam.scale.set(1, 1, 1); for (const k of ['ring', 'disc', 'beam']) mk.userData[k].material.color.setHex(color); }
function syncMission(t) {
  const on = gameMode === 'mission' && MS.cur && (state === 'playing' || state === 'paused' || state === 'gunsmith' || state === 'upgrade'); markerA.visible = markerB.visible = false; if (!on) return;
  const m = MS.cur;
  if (m.type === 'capture') setMarker(markerA, m.x, m.y, m.r, m.prog > 0.01 ? 0xffd24a : 0x66ffaa, true);
  else if (m.type === 'rescue') { const h = m.hostage; if (!h.freed) setMarker(markerA, h.x, h.y, 60, 0xffd24a, true); else setMarker(markerA, m.exit.x, m.exit.y, m.exit.r, 0x66ffaa, true);
    if (!h.mesh) { h.mesh = makeHuman({ tint: '#7fa8ff', gun: 'rifle' }); h.mesh.userData.gun.visible = false; scene.add(h.mesh); }
    h.mesh.position.set(wx(h.x), floorY(h.x, h.y), wz(h.y)); h.mesh.rotation.y = -(h.angle === undefined ? 1 : h.angle); updateHuman(h.mesh, 0.016, h.moving ? 130 : 0, false); }
  else if (m.type === 'defend') { setMarker(markerA, m.base.x, m.base.y, 150, 0x66aaff, false); if (m.baseMesh) m.baseMesh.userData.lamp.material.emissiveIntensity = 0.6 + 0.6 * Math.sin(t * 5); }
  else if (m.type === 'convoy') { const live = m.veh.filter(v => !v.burned); if (live.length) { const v = live[0]; setMarker(markerA, v.x, v.y, 70, 0xff5a40, true); } }
}
function objPoints() {                                         // positions of the current objective for the radar and the compass arrow
  const m = MS.cur; if (gameMode !== 'mission' || !m || m.done) return [];
  if (m.type === 'rescue') return m.hostage.freed ? [{ x: m.exit.x, y: m.exit.y, col: '#6f6' }] : [{ x: m.hostage.x, y: m.hostage.y, col: '#fd4' }];
  if (m.type === 'defend') return [{ x: m.base.x, y: m.base.y, col: '#6af' }];
  if (m.type === 'convoy') return m.veh.filter(v => !v.burned).map(v => ({ x: v.x, y: v.y, col: '#f64' }));
  return [{ x: m.x, y: m.y, col: '#6f6' }];
}
function drawMissionHud() {
  const m = MS.cur; if (!m) return; const pts = objPoints(); const px = W / 2 - 190;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px, 6, 380, 66); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(px, 6, 380, 66);
  text(`MISSION ${MS.n}  -  ${MTYPES[m.type]}`, W / 2, 24, 13, 'center', '#ee8');
  let prog = 0, label = ''; if (m.type === 'capture') { prog = m.prog; label = `${Math.round(m.prog * 100)}%`; } else if (m.type === 'defend') { prog = 1 - m.timeLeft / m.total; label = `Base ${Math.max(0, Math.round(m.base.hp))}/${m.base.maxHp}`; } else if (m.type === 'rescue') { prog = m.hostage.freed ? 0.5 + 0.5 * clampN(1 - Math.hypot(m.hostage.x - m.exit.x, m.hostage.y - m.exit.y) / 1200, 0, 1) : m.hostage.cut * 0.5; label = m.hostage.freed ? 'Extraction' : m.hostage.cut > 0 ? 'Cutting ropes' : 'Hostage'; } else { const live = m.veh.filter(v => !v.burned).length; prog = 1 - live / m.veh.length; label = `${live}/${m.veh.length} left`; }
  ctx.fillStyle = '#233'; ctx.fillRect(px + 12, 32, 356, 8); ctx.fillStyle = m.done ? '#8f8' : '#7c4'; ctx.fillRect(px + 12, 32, 356 * (m.done ? 1 : clampN(prog, 0, 1)), 8);
  if (m.type === 'defend') { ctx.fillStyle = '#e44'; ctx.fillRect(px + 12, 42, 356 * clampN(m.base.hp / m.base.maxHp, 0, 1), 4); }
  text(m.done ? 'MISSION COMPLETE' : m.status, W / 2, 62, 11, 'center', m.done ? '#8f8' : '#cdd8c0'); text(label, px + 366, 24, 11, 'right', '#9ab');
  if (pts.length) { const o = pts.reduce((a, b) => Math.hypot(a.x - player.x, a.y - player.y) < Math.hypot(b.x - player.x, b.y - player.y) ? a : b), dx = o.x - player.x, dy = o.y - player.y, rel = Math.atan2(dy, dx) - look.yaw;
    ctx.save(); ctx.translate(px - 24, 38); ctx.rotate(rel + Math.PI / 2); ctx.fillStyle = o.col; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.restore(); text(`${Math.round(Math.hypot(dx, dy) / U)} m`, px - 24, 62, 11, 'center', '#cdd'); }
  if (m.type === 'rescue' && !m.hostage.freed && m.hostage.cut > 0) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 90, H / 2 + 70, 180, 14); ctx.fillStyle = '#fd4'; ctx.fillRect(W / 2 - 88, H / 2 + 72, 176 * m.hostage.cut, 10); }
}
