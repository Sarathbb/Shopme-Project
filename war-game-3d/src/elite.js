// ---------- Elite enemies and squad tactics: shield troopers, night-vision operatives, officers who call reinforcements, pincer attacks ----------
const ELITE = { pincerT: 4, still: 0, warned: {} };
function pickElite() {                                               // elites start to appear from wave 3 and get more common later; never in Battle Royale or the training range
  if (gameMode === 'br' || gameMode === 'training' || wave < 3) return null;
  const r = Math.random(), more = Math.min(0.1, (wave - 3) * 0.02), liveOfficer = enemies.some(e => e.officer && e.hp > 0);
  if (wave >= 4 && r < 0.08 + more) return 'shield';
  if (wave >= 5 && r < 0.14 + more && !liveOfficer) return 'officer';
  if (ENV.night > 0.5 && r < 0.26 + more) return 'nvg';
  return null;
}
function shieldBlocks(e, b) {                                        // the riot shield covers the front: shots coming from the way he faces are stopped
  const from = Math.atan2(-b.vy, -b.vx), d = Math.atan2(Math.sin(from - e.angle), Math.cos(from - e.angle));
  return Math.abs(d) < 1.15;
}
function shieldSpark(e, b) {
  spray(b.x, b.y, 1.0, 5, ['#fff1b0', '#ffd27a'], 260, 0.25, { dx: -b.vx, dy: -b.vy, up: 1.2 }); Sound.impact(e.x, e.y, 'metal');
  if (!ELITE.warned.shield) { ELITE.warned.shield = 1; notify('Shield trooper: frontal fire is stopped - flank him or use grenades'); saidOnce('shield', 'Alpha', 'Shield trooper! Get round the side!', 12); }
}
function officerTick(e, dt) {                                        // an officer who sees you starts a radio call; kill him before it finishes
  if (e.called || e.hp <= 0) return;
  if (e.sees) {
    if (e.callT === 0) { notify('Officer is radioing for reinforcements - take him down!'); Sound.alert(e.x, e.y); saidOnce('officer', 'Alpha', 'Officer on the radio! Drop him!', 10); }
    e.callT += dt; if (e.callT >= 3.5) { e.called = true; callReinforcements(e); }
  } else e.callT = Math.max(0, e.callT - dt * 0.4);
}
function callReinforcements(e) {
  const n = Math.max(0, Math.min(3, 16 - enemies.filter(o => o.hp > 0).length)); Sound.alert(e.x, e.y);
  for (let i = 0; i < n; i++) { const o = spawnEnemy(player); if (o) { o.lastSeen = { x: player.x, y: player.y }; o.seenAge = 0; } }
  notify(n ? 'Reinforcements are coming in!' : 'The radio call went out'); saidOnce('reinf', 'Alpha', 'More of them on the way!', 8);
}
function elitePincer(dt) {                                           // stand still and they will try to surround you: two fighters swing round to opposite sides
  if (state !== 'playing' || gameMode === 'br' || gameMode === 'training') return;
  ELITE.still = player.speedNow < 30 ? ELITE.still + dt : 0; ELITE.pincerT -= dt; if (ELITE.pincerT > 0 || ELITE.still < 3) return;
  const c = enemies.filter(e => e.hp > 0 && e.ai && !e.stealth && !e.hold && e.role !== 'flank' && e.type !== 'sniper' && e.sees && Math.hypot(e.x - player.x, e.y - player.y) > 280);
  if (c.length < 3) return; ELITE.pincerT = 7;
  c.slice(0, 2).forEach((e, i) => { e.role = 'flank'; e.flankSide = i ? -1 : 1; e.mode = 'flank'; });
  saidOnce('pincer', 'Alpha', "They're trying to flank us!", 10);
}
function eliteGear(m, type) {                                        // simple props on the soldier model: riot shield, night-vision goggles, officer's cap and radio
  const mat = (c, em) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.2, emissive: em || '#000', emissiveIntensity: em ? 1 : 0 }), add = (w, h, d, c, x, y, z, em) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, em)); o.position.set(x, y, z); o.castShadow = true; m.add(o); return o; };
  if (type === 'shield') { add(0.07, 1.05, 0.62, '#34506a', 0.5, 1.0, 0); add(0.075, 0.16, 0.44, '#9ac4e8', 0.52, 1.38, 0, '#274a66'); add(0.08, 0.05, 0.64, '#1c2630', 0.5, 0.5, 0); }
  else if (type === 'nvg') { add(0.1, 0.07, 0.22, '#1c1e22', 0.14, 1.68, 0); for (const s of [-1, 1]) { add(0.1, 0.06, 0.06, '#2a2c30', 0.21, 1.68, s * 0.055); add(0.02, 0.04, 0.04, '#7dff9a', 0.265, 1.68, s * 0.055, '#3dff6a'); } }
  else if (type === 'officer') { add(0.17, 0.05, 0.19, '#2a2c1c', 0.0, 1.8, 0); add(0.2, 0.012, 0.12, '#1a1a14', 0.12, 1.78, 0); add(0.12, 0.3, 0.2, '#2c3a2a', -0.2, 1.3, 0); add(0.012, 0.35, 0.012, '#111', -0.22, 1.65, 0.07); }
}
function drawEliteTags() {                                           // name tags and the radio-call bar above elites
  ctx.save();
  for (const e of enemies) {
    if (e.hp <= 0 || !(e.shield || e.nvg || e.officer) || Math.hypot(e.x - player.x, e.y - player.y) > 700) continue;
    pv.set(wx(e.x), floorY(e.x, e.y) + (e.elev || 0) + 2.45, wz(e.y)).project(camera); if (pv.z > 1 || Math.abs(pv.x) > 1.05 || Math.abs(pv.y) > 1.05) continue;
    const x = (pv.x * 0.5 + 0.5) * W, y = (-pv.y * 0.5 + 0.5) * H, col = e.officer ? '#ffd24a' : e.shield ? '#8ec8ff' : '#7dff9a';
    text(e.officer ? 'OFFICER' : e.shield ? 'SHIELD' : 'NVG', x, y, 10, 'center', col);
    if (e.officer && e.callT > 0 && !e.called) { ctx.fillStyle = '#300'; ctx.fillRect(x - 20, y + 3, 40, 4); ctx.fillStyle = '#ff5a40'; ctx.fillRect(x - 20, y + 3, 40 * Math.min(1, e.callT / 3.5), 4); text('CALLING', x, y + 17, 9, 'center', '#ff8a70'); }
  }
  ctx.restore();
}
