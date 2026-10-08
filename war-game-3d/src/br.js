// ---------- Battle Royale: loot the map, fight bots, stay inside the shrinking zone, be the last one standing ----------
const BR = { zone: null, total: 25, bots: 24, killsAtStart: 0, winT: 0 };
const KITS = {
  rifle:   { rate: 0.55, bdmg: 7,   bspeed: 560, range: 430, sight: 600, pellets: 0 },
  smg:     { rate: 0.2,  bdmg: 4,   bspeed: 520, range: 300, sight: 520, pellets: 0 },
  shotgun: { rate: 1.25, bdmg: 3.5, bspeed: 480, range: 210, sight: 480, pellets: 5 },
  sniper:  { rate: 2.2,  bdmg: 16,  bspeed: 900, range: 760, sight: 900, pellets: 0 },
};
const BOT_TINTS = ['#d98a7a', '#8ab4d9', '#9ad98a', '#d9c98a', '#c98ad9', '#d9a08a', '#8ad9c9'];
const ZONE = { radii: [1, 0.56, 0.33, 0.18, 0.09, 0.03], wait: 35, shrink: 40, dps: [1, 1.5, 2.5, 4, 7] };

function lootRoll() {
  const r = Math.random();
  if (r < 0.24) { const w = Math.random(); return { kind: 'wpn', w: w < 0.3 ? 0 : w < 0.55 ? 2 : w < 0.8 ? 1 : 3 }; }
  if (r < 0.42) return { kind: 'ammo' }; if (r < 0.54) return { kind: 'band' }; if (r < 0.61) return { kind: 'med' };
  if (r < 0.69) return { kind: 'armor' }; if (r < 0.80) return { kind: 'att', a: randAtt() }; if (r < 0.86) return { kind: 'gren' };
  return { kind: 'ammo' };
}
function scatterLoot() {
  const add = (x, y) => pickups.push({ x, y, ...lootRoll() });
  for (const b of buildings) {                                   // 2-4 items inside every enterable house
    const n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0, got = 0; k < 60 && got < n; k++) {
      const lx = rnd(-b.ow / 2, b.ow / 2) * 0.85, ly = rnd(-b.oh / 2, b.oh / 2) * 0.85, x = b.cx + lx * b.c0 - ly * b.s0, y = b.cy + lx * b.s0 + ly * b.c0;
      if (buildingAt(x, y) === b && pointFree(x, y, 10)) { add(x, y); got++; }
    }
  }
  for (let k = 0, got = 0; k < 400 && got < (FW * FH > 2e7 ? 45 : 22); k++) {            // and out in the open
    const x = rnd(150, FW - 150), y = rnd(150, FH - 150);
    if (!buildingAt(x, y) && pointFree(x, y, 14) && roadDist(x, y) > 10) { add(x, y); got++; }
  }
}
function addBot(x, y, kit) {
  const K = KITS[kit], e = { ...TYPES.soldier, type: 'bot', kit, snd: kit, gun: kit, tint: pick(BOT_TINTS), rate: K.rate, bdmg: K.bdmg, bspeed: K.bspeed, range: K.range, sight: K.sight, pellets: K.pellets,
    x, y, hp: 4, maxHp: 4, speed: 82, score: 100, cool: Math.random() * 2, flash: 0, side: Math.random() < 0.5 ? 1 : -1, stuck: 0,
    ai: true, mode: 'advance', modeT: 0, percT: Math.random() * 0.3, hurtT: 9, gCool: rnd(8, 16), strafeT: 0, seenAge: 99, lastSeen: { x, y }, role: 'assault', flankSide: 1, canNade: Math.random() < 0.4, radio: false, prevHp: 4, sees: false, phase: Math.random() * 6 };
  e.mesh = makeEnemyMesh(e); scene.add(e.mesh); enemies.push(e); return e;
}
function startBR() {
  playerBuilding = null; player.x = SPAWN.x; player.y = SPAWN.y; player.fy = player.fyVis = floorY(player.x, player.y);
  for (const k in player.guns) player.guns[k].res = WEAPONS[k].mag; player.grenades = 0; player.armor = 0; player.bandages = 1; player.medkits = 0;   // a fair start: one spare magazine
  scatterLoot();
  const kits = Object.keys(KITS), spots = [], big = FW * FH > 2e7; BR.bots = big ? 24 : 11; BR.total = BR.bots + 1;      // the small countryside field gets fewer bots
  const gap = big ? 420 : 200, nearP = big ? 750 : 420;
  for (let k = 0; k < 4000 && spots.length < BR.bots; k++) {
    const x = rnd(150, FW - 150), y = rnd(150, FH - 150);
    if (Math.hypot(x - player.x, y - player.y) < nearP || buildingAt(x, y) || !pointFree(x, y, 16) || spots.some(s => Math.hypot(s.x - x, s.y - y) < gap)) continue;
    spots.push({ x, y });
  }
  spots.forEach((s, i) => { const kit = i % 7 === 6 ? 'sniper' : kits[i % 3]; addBot(s.x, s.y, kit); });
  const R0 = Math.hypot(FW, FH) / 2 * 1.02;
  BR.zone = { x: FW / 2, y: FH / 2, r: R0, from: { x: FW / 2, y: FH / 2, r: R0 }, to: null, phase: 0, state: 'wait', t: ZONE.wait + 15, R0 };
  planZone(BR.zone); BR.winT = 0;
  state = 'playing'; Sound.wave(); notify('Battle Royale: loot houses, stay inside the zone, be the last one alive');
}
function planZone(z) {                                            // where the next circle will be
  const R1 = z.R0 * ZONE.radii[Math.min(ZONE.radii.length - 1, z.phase + 1)], slack = Math.max(0, z.from.r - R1);
  const a = Math.random() * 6.283, d = Math.random() * slack * 0.8;
  z.to = { x: clampN(z.from.x + Math.cos(a) * d, R1 * 0.4, FW - R1 * 0.4), y: clampN(z.from.y + Math.sin(a) * d, R1 * 0.4, FH - R1 * 0.4), r: R1 };
}
const brAlive = () => enemies.filter(e => e.hp > 0).length + (player.hp > 0 ? 1 : 0);
function hurtBot(e, dmg, owner) { e.hp -= dmg; e.flash = 0.06; e.killer = owner; }
function updateBR(dt) {
  const z = BR.zone; if (!z) return;
  z.t -= dt;
  if (z.state === 'wait') { if (z.t <= 0 && z.phase < ZONE.radii.length - 2) { z.state = 'shrink'; z.t = ZONE.shrink; z.from = { x: z.x, y: z.y, r: z.r }; Sound.boss && Sound.boss(); notify('The zone is closing!'); } }
  else {
    const k = clampN(1 - z.t / ZONE.shrink, 0, 1); z.x = z.from.x + (z.to.x - z.from.x) * k; z.y = z.from.y + (z.to.y - z.from.y) * k; z.r = z.from.r + (z.to.r - z.from.r) * k;
    if (z.t <= 0) { z.phase++; z.state = 'wait'; z.t = ZONE.wait; z.from = { x: z.x, y: z.y, r: z.r }; if (z.phase < ZONE.radii.length - 1) planZone(z); }
  }
  const dps = ZONE.dps[Math.min(ZONE.dps.length - 1, z.phase)];
  z.outside = Math.hypot(player.x - z.x, player.y - z.y) > z.r;
  if (z.outside && !player.driving) { player.sinceHit = 0; player.hp -= dps * dt; player.hurt = Math.max(player.hurt, 0.04); if (player.hp <= 0 && state === 'playing') { player.hp = 0; gameOver(); return; } }
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const out = Math.hypot(e.x - z.x, e.y - z.y) > z.r - 30;
    if (out && Math.hypot(e.x - z.x, e.y - z.y) > z.r) e.hp -= dps * 0.06 * dt;
    // destinations for bots with nobody to fight: investigate noise, head into the zone, or wander between spots
    if (e.tgt && (e.tgt === player || e.tgt.hp > 0)) { e.dest = null; continue; }
    e.destT = (e.destT || 0) - dt;
    if (e.seenAge < 4) { e.dest = e.lastSeen; continue; }
    if (!e.dest || e.destT <= 0 || Math.hypot(e.dest.x - e.x, e.dest.y - e.y) < 40 || (out && !e.toZone)) {
      e.toZone = out; const cx = out ? z.x : e.x, cy = out ? z.y : e.y;
      for (let k = 0; k < 20; k++) { const a = Math.random() * 6.283, d = out ? rnd(0, z.r * 0.5) : rnd(250, 700), x = clampN(cx + Math.cos(a) * d, 120, FW - 120), y = clampN(cy + Math.sin(a) * d, 120, FH - 120); if (Math.hypot(x - z.x, y - z.y) < z.r * 0.9 && !buildingAt(x, y) && pointFree(x, y, 14)) { e.dest = { x, y }; break; } }
      e.destT = rnd(8, 18);
    }
  }
  // bullets from bots hurt other bots too
  for (const b of enemyBullets) {
    if (b.life <= 0 || !b.owner) continue;
    for (const e of enemies) if (e !== b.owner && e.hp > 0 && Math.hypot(b.x - e.x, b.y - e.y) < e.r + 3) { hurtBot(e, b.dmg / 8, b.owner); b.life = 0; bloodFx(b.x, b.y, b.vx, b.vy, 4, 0); Sound.hitEnemy(e.x, e.y, 'soldier'); break; }
  }
  if (state === 'playing' && enemies.every(e => e.hp <= 0)) { BR.winT += dt; if (BR.winT > 1.2) brWin(); } else BR.winT = 0;
}
function brWin() { endRun(true); }
const KIT_WPN = { rifle: 0, shotgun: 1, smg: 2, sniper: 3 };
const botDrop = e => { const r = Math.random(); pickups.push({ x: e.x, y: e.y, ...(r < 0.4 ? { kind: 'wpn', w: KIT_WPN[e.kit] } : r < 0.7 ? { kind: 'ammo' } : r < 0.85 ? { kind: 'band' } : { kind: 'armor' }) }); };
// ---- the zone wall in the world, and its HUD ----
const zoneWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 90, 72, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }));
const zoneNext = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 40, 72, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, fog: false }));
zoneWall.visible = zoneNext.visible = false; zoneWall.frustumCulled = zoneNext.frustumCulled = false; scene.add(zoneWall, zoneNext);
function syncZone() {
  const on = gameMode === 'br' && BR.zone && (state === 'playing' || state === 'paused' || state === 'over' || state === 'gunsmith'); zoneWall.visible = zoneNext.visible = !!on; if (!on) return;
  const z = BR.zone, y = hAt(wx(z.x), wz(z.y));
  zoneWall.position.set(wx(z.x), y + 15, wz(z.y)); zoneWall.scale.set(z.r / U, 1, z.r / U); zoneWall.material.opacity = 0.14 + 0.06 * Math.sin(performance.now() / 400);
  zoneNext.position.set(wx(z.to.x), y + 8, wz(z.to.y)); zoneNext.scale.set(z.to.r / U, 1, z.to.r / U); zoneNext.visible = z.state === 'wait' || z.state === 'shrink';
}
function drawBRHud() {
  const z = BR.zone; if (!z) return;
  text(`ALIVE ${brAlive()}`, W - 15, 28, 18, 'right', '#fff'); 
  const t = Math.max(0, Math.ceil(z.t)), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
  text(`${z.state === 'wait' ? (z.phase >= ZONE.radii.length - 2 ? 'Final circle' : 'Zone closes in') : 'Zone closing'} ${z.phase >= ZONE.radii.length - 2 && z.state === 'wait' ? '' : mm + ':' + ss}`, W / 2, 18, 13, 'center', z.state === 'shrink' ? '#ff8a70' : '#cdd8c0');
  // arrow to the safe zone's centre
  const dx = z.x - player.x, dy = z.y - player.y, rel = Math.atan2(dy, dx) - look.yaw, dist = Math.hypot(dx, dy), ax = W / 2, ay = 46;
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(rel + Math.PI / 2); ctx.fillStyle = z.outside ? '#ff5a40' : 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.restore();
  text(`${Math.round(Math.max(0, dist - z.r) / U)} m ${z.outside ? 'to the zone' : 'inside'}`, ax, ay + 26, 11, 'center', z.outside ? '#ff8a70' : '#9ab');
  if (z.outside) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 150); text('OUTSIDE THE ZONE - GET INSIDE!', W / 2, 150, 20, 'center', '#ff5a40'); ctx.globalAlpha = 1; const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); g.addColorStop(0, 'rgba(120,0,160,0)'); g.addColorStop(1, 'rgba(120,0,160,0.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
}
