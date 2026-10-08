// ---------- AI squad: teammates who follow you, hold ground, move where you point, fight, go down and can be revived ----------
const SQUAD = { list: [], order: 'follow', goto: null, chat: [], said: {} };
const ALLY_DEF = [
  { name: 'Alpha', gun: 'rifle', rate: 0.34, dmg: 0.75, spread: 0.07, range: 470, head: 'helmet', tint: '#9fc0ff' },
  { name: 'Bravo', gun: 'smg', rate: 0.15, dmg: 0.42, spread: 0.13, range: 340, head: 'cap', tint: '#8ad0c8' },
];
function squadCount() { if (typeof DAILY !== 'undefined' && DAILY.on) return 0; return gameMode === 'br' ? (SET.brDuo ? 1 : 0) : SET.squad; }
function clearSquad() { for (const a of SQUAD.list) if (a.mesh) scene.remove(a.mesh); SQUAD.list = []; SQUAD.order = 'follow'; SQUAD.goto = null; SQUAD.chat = []; SQUAD.said = {}; }
function makeAlly(i, x, y) {
  const d = ALLY_DEF[i], a = { ...d, i, x, y, hp: 90, maxHp: 90, r: 11, state: 'ok', angle: 0, moveAngle: 0, speedNow: 0, phase: Math.random() * 6, crouchK: 0, cool: rnd(0, 0.5), tgtT: 0, tgt: null, hitT: 99, down: 0, reviveT: 0, mflash: 0, flash: 0, holdAt: null, cover: null, coverT: 0, strafeT: 0, sd: 1 };
  a.mesh = makeHuman({ tint: d.tint, gun: d.gun }); dressHuman(a.mesh, { skin: 'std', head: d.head, back: i ? 'radio' : 'none' }); scene.add(a.mesh); return a;
}
function spawnSquad() {
  clearSquad(); const n = squadCount();
  for (let i = 0; i < n; i++) { let x = player.x - 70 + i * 140, y = player.y + 70; for (let k = 0; k < 20 && !pointFree(x, y, 14); k++) { const ang = Math.random() * 6.283; x = player.x + Math.cos(ang) * 80; y = player.y + Math.sin(ang) * 80; } SQUAD.list.push(makeAlly(i, x, y)); }
  if (n) squadSay('Alpha', 'Squad ready. Tab: move to aim, Y: hold or follow.');
}
function reinforceSquad() {                                      // start of every wave or mission: fallen teammates are replaced and the rest are patched up
  const n = squadCount(); if (!n) return;
  for (let i = 0; i < n; i++) {
    const a = SQUAD.list[i];
    if (!a) { SQUAD.list[i] = makeAlly(i, player.x - 60 + i * 120, player.y + 70); continue; }
    if (a.state === 'dead' || !a.mesh) { SQUAD.list[i] = makeAlly(i, player.x - 60 + i * 120, player.y + 70); squadSay(ALLY_DEF[i].name, 'Reporting in.'); continue; }
    a.hp = a.maxHp; a.state = 'ok'; a.down = 0; a.reviveT = 0;
  }
}
function squadSay(who, msg) { SQUAD.chat.push({ who, msg, t: 6 }); if (SQUAD.chat.length > 4) SQUAD.chat.shift(); }
function saidOnce(key, who, msg, every = 9) { const t = performance.now() / 1000; if (t - (SQUAD.said[key] || -99) < every) return; SQUAD.said[key] = t; squadSay(who, msg); }
function squadOrder(kind) {
  if (!SQUAD.list.length) return;
  if (kind === 'toggle') { if (SQUAD.order === 'hold') { SQUAD.order = 'follow'; SQUAD.goto = null; squadSay('Alpha', 'On you.'); notify('Squad: FOLLOW'); } else { SQUAD.order = 'hold'; for (const a of SQUAD.list) a.holdAt = { x: a.x, y: a.y }; squadSay('Alpha', 'Holding position.'); notify('Squad: HOLD'); } }
  else if (kind === 'go') { SQUAD.order = 'go'; SQUAD.goto = { x: clampN(aim.x, 60, FW - 60), y: clampN(aim.y, 60, FH - 60) }; squadSay('Alpha', 'Moving.'); notify('Squad: MOVE TO AIM'); }
  Sound.ui();
}
function damageAlly(a, n) {
  if (a.state !== 'ok') return; a.hp -= n; a.hitT = 0; a.flash = 0.1; bloodFx(a.x, a.y, 1, 0, 3, 0);
  if (a.hp <= 0) { a.hp = 0; a.state = 'down'; a.down = 28; a.tgt = null; squadSay(a.name, "I'm hit! Need help!"); Sound.panic && Sound.panic(a.x, a.y); }
  else if (n > 6) saidOnce('hit' + a.i, a.name, 'Taking fire!', 7);
}
function nearestDown() { let best = null, bd = 56; for (const a of SQUAD.list) if (a.state === 'down') { const d = Math.hypot(a.x - player.x, a.y - player.y); if (d < bd) { bd = d; best = a; } } return best; }
function slotFor(a) {                                           // formation: behind the player, spread to the sides, relative to the way the camera looks
  const f = look.yaw, side = SQUAD.list.length > 1 ? (a.i ? 1 : -1) : 0.8, dx = Math.cos(f), dy = Math.sin(f);
  return { x: player.x - dx * 95 - dy * side * 75, y: player.y - dy * 95 + dx * side * 75 };
}
function updateSquad(dt) {
  if (!SQUAD.list.length) return;
  for (const a of SQUAD.list) {
    if (a.state === 'dead') continue;
    a.mflash -= dt; a.flash -= dt; a.hitT += dt; a.tgtT -= dt; a.cool -= dt; a.coverT -= dt; a.strafeT -= dt;
    if (a.state === 'down') {
      a.crouchK += (1 - a.crouchK) * Math.min(1, dt * 6); a.speedNow = 0;
      const near = !player.driving && Math.hypot(a.x - player.x, a.y - player.y) < 56;
      if (near && keys['f']) { a.reviveT += dt / 2.4; if (a.reviveT >= 1) { a.state = 'ok'; a.hp = a.maxHp * 0.55; a.reviveT = 0; a.hitT = 0; squadSay(a.name, 'Thanks. Back in it.'); Sound.pickup(); } } else a.reviveT = Math.max(0, a.reviveT - dt * 0.8);
      a.down -= dt; if (a.down <= 0) { a.state = 'dead'; if (a.mesh) { scene.remove(a.mesh); a.mesh = null; } squadSay(a.name, '...'); notify(a.name + ' is gone'); }
      continue;
    }
    a.crouchK += (0 - a.crouchK) * Math.min(1, dt * 6);
    if (a.hitT > 6 && a.hp < a.maxHp) a.hp = Math.min(a.maxHp, a.hp + 3 * dt);
    const dP = Math.hypot(a.x - player.x, a.y - player.y);
    if (dP > 1300 && !onScreen(a.x, a.y)) { const ang = Math.random() * 6.283, nx = player.x + Math.cos(ang) * 110, ny = player.y + Math.sin(ang) * 110; if (pointFree(nx, ny, 14)) { a.x = nx; a.y = ny; } }
    // target: the nearest enemy that can be seen
    if (a.tgtT <= 0) {
      a.tgtT = 0.25; let best = null, bd = a.range * 1.1 * ENV.vis;
      for (const e of enemies) { if (e.hp <= 0 || e.elev > 0) continue; const d = Math.hypot(e.x - a.x, e.y - a.y); if (d < bd && lineClear(a.x, a.y, e.x, e.y)) { bd = d; best = e; } }
      if (best && !a.tgt) saidOnce('contact', a.name, ['Contact!', 'Enemy ahead!', 'I see them!'][Math.floor(Math.random() * 3)], 10);
      a.tgt = best;
    }
    if (a.tgt && a.tgt.hp <= 0) { saidOnce('down' + a.i, a.name, ['Target down.', 'Got him.', 'One less.'][Math.floor(Math.random() * 3)], 6); a.tgt = null; }
    // where to stand
    let want = null, spd = 0, hold = false;
    if (SQUAD.order === 'hold') want = a.holdAt || (a.holdAt = { x: a.x, y: a.y }); else if (SQUAD.order === 'go' && SQUAD.goto) { want = { x: SQUAD.goto.x + (a.i ? 60 : -60), y: SQUAD.goto.y }; if (Math.hypot(want.x - a.x, want.y - a.y) < 60) { want = null; hold = true; } } else want = slotFor(a);
    if (a.tgt && a.hp < a.maxHp * 0.45) { if (a.coverT <= 0) { a.coverT = 1.5; a.cover = findCover(a, a.tgt, false); } if (a.cover) want = a.cover; }
    const ab = buildingAt(a.x, a.y);
    if (playerBuilding && ab !== playerBuilding && SQUAD.order === 'follow') { const t = Math.hypot(a.x - playerBuilding.doorOut.x, a.y - playerBuilding.doorOut.y) < 80 ? playerBuilding.doorIn : playerBuilding.doorOut; want = t; }
    else if (ab && ab !== playerBuilding && SQUAD.order === 'follow' && !playerBuilding) { const t = Math.hypot(a.x - ab.doorIn.x, a.y - ab.doorIn.y) < 70 ? ab.doorOut : ab.doorIn; want = t; }
    let dx = 0, dy = 0;
    if (want && !hold) { dx = want.x - a.x; dy = want.y - a.y; const l = Math.hypot(dx, dy); if (l > (a.tgt ? 40 : 28)) { spd = clampN(l * 2, 55, 195) * (a.tgt && l < 140 ? 0.5 : 1); dx /= l; dy /= l; } else { dx = dy = 0; } }
    if (a.tgt && !spd && SQUAD.order !== 'hold' && !a.cover) { if (a.strafeT <= 0) { a.strafeT = rnd(1, 2); a.sd = Math.random() < 0.5 ? 1 : -1; } const ex = a.tgt.x - a.x, ey = a.tgt.y - a.y, el = Math.hypot(ex, ey) || 1; dx = -ey / el * a.sd; dy = ex / el * a.sd; spd = 40; }
    if (spd) {
      let sx = 0, sy = 0; for (const o of SQUAD.list) if (o !== a && o.state === 'ok') { const ox = a.x - o.x, oy = a.y - o.y, od = Math.hypot(ox, oy); if (od < 30 && od > 0.1) { sx += ox / od; sy += oy / od; } }
      dx += sx * 0.6; dy += sy * 0.6; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      a.x += dx * spd * dt; a.y += dy * spd * dt; a.moveAngle = Math.atan2(dy, dx); a.phase += dt * spd * 0.1; pushOut(a, a.r); a.x = clampN(a.x, 40, FW - 40); a.y = clampN(a.y, 40, FH - 40);
    }
    a.speedNow = spd;
    for (const b of buildings) if (Math.hypot(a.x - (b.door.x + b.door.w / 2), a.y - (b.door.y + b.door.h / 2)) < 52) b.door.hold = 1.6;
    a.angle = a.tgt ? Math.atan2(a.tgt.y - a.y, a.tgt.x - a.x) : (spd ? a.moveAngle : a.angle);
    if (a.tgt && a.cool <= 0 && lineClear(a.x, a.y, a.tgt.x, a.tgt.y) && Math.hypot(a.tgt.x - a.x, a.tgt.y - a.y) < a.range * ENV.vis) {
      const ang = a.angle + (Math.random() - 0.5) * 2 * a.spread; bullets.push({ x: a.x + Math.cos(ang) * 18, y: a.y + Math.sin(ang) * 18, vx: Math.cos(ang) * 560, vy: Math.sin(ang) * 560, dmg: a.dmg, life: 1, vh: 0, ally: a });
      a.mflash = 0.08; a.cool = a.rate * (0.9 + Math.random() * 0.4); Sound.shoot({ at: [a.x, a.y], vol: 0.55, ref: 9, range: 220 }); aiNoise(a.x, a.y, 640);
    }
  }
}
function squadBullets() {                                         // enemy shots and blasts that reach a teammate
  for (const b of enemyBullets) { if (b.life <= 0) continue; for (const a of SQUAD.list) if (a.state === 'ok' && Math.hypot(b.x - a.x, b.y - a.y) < a.r + 3) { damageAlly(a, b.dmg); b.life = 0; break; } }
}
function squadBlast(x, y, R, dmg, enemy) { for (const a of SQUAD.list) if (a.state === 'ok') { const d = Math.hypot(a.x - x, a.y - y); if (d < R) damageAlly(a, dmg * (1 - d / (R * 1.1)) * (enemy ? 1 : 0.5)); } }
// ----- drawing -----
function syncSquad(t, dt) {
  for (const a of SQUAD.list) {
    const m = a.mesh; if (!m) continue; m.visible = true; m.position.set(wx(a.x), floorY(a.x, a.y) + (a.state === 'down' ? 0.28 : 0), wz(a.y)); m.rotation.y = -(a.angle || 0); m.rotation.z = a.state === 'down' ? 1.4 : 0;
    flashHuman(m, a.flash > 0 ? 0x992222 : 0); humanMuzzle(m, a.mflash > 0); updateHuman(m, dt, a.speedNow, false, a.crouchK, 0, false); dressTrack(m);
  }
}
function drawSquadHud() {
  if (!SQUAD.list.length) return;
  ctx.save();
  for (const a of SQUAD.list) {
    if (a.state === 'dead') continue; pv.set(wx(a.x), floorY(a.x, a.y) + (a.state === 'down' ? 0.9 : 2.3), wz(a.y)).project(camera);
    if (pv.z > 1 || Math.abs(pv.x) > 1.05 || Math.abs(pv.y) > 1.05) continue; const x = (pv.x * 0.5 + 0.5) * W, y = (-pv.y * 0.5 + 0.5) * H, col = a.state === 'down' ? '#ff6a5a' : SET.cb ? '#fff' : '#6ab4ff';
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 7, y - 12); ctx.lineTo(x + 7, y - 12); ctx.lineTo(x, y - 2); ctx.closePath(); ctx.fill();
    text(a.name, x, y - 16, 10, 'center', col); if (a.state === 'ok' && a.hp < a.maxHp) { ctx.fillStyle = '#300'; ctx.fillRect(x - 16, y + 1, 32, 3); ctx.fillStyle = '#6c6'; ctx.fillRect(x - 16, y + 1, 32 * a.hp / a.maxHp, 3); }
    if (a.state === 'down') { text(`DOWN ${Math.ceil(a.down)}s`, x, y + 12, 10, 'center', '#ff8a7a'); if (a.reviveT > 0) { ctx.fillStyle = '#123'; ctx.fillRect(x - 24, y + 16, 48, 5); ctx.fillStyle = '#6f8'; ctx.fillRect(x - 24, y + 16, 48 * a.reviveT, 5); } }
  }
  // panel under the radar
  const px = 14, py = 208; text('SQUAD  ' + SQUAD.order.toUpperCase(), px, py, 10, 'left', '#9ab');
  SQUAD.list.forEach((a, i) => { const y = py + 8 + i * 22; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px, y, 140, 18); text(a.name, px + 4, y + 13, 11, 'left', a.state === 'ok' ? '#cde' : '#f98'); ctx.fillStyle = '#300'; ctx.fillRect(px + 52, y + 6, 80, 6); ctx.fillStyle = a.state === 'ok' ? '#6c6' : a.state === 'down' ? '#e84' : '#555'; ctx.fillRect(px + 52, y + 6, 80 * (a.state === 'dead' ? 0 : a.hp / a.maxHp || (a.state === 'down' ? a.down / 28 : 0)), 6); });
  SQUAD.chat.forEach((c, i) => { c.t -= 0.016; });
  SQUAD.chat = SQUAD.chat.filter(c => c.t > 0);
  SQUAD.chat.forEach((c, i) => { ctx.globalAlpha = Math.min(1, c.t); text(`${c.who}: ${c.msg}`, 14, H - 100 - (SQUAD.chat.length - 1 - i) * 15, 11, 'left', '#9cf'); }); ctx.globalAlpha = 1;
  ctx.restore();
}
