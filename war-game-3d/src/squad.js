// ---------- AI squad: teammates who follow you, hold ground, move where you point, fight, go down and can be revived ----------
const SQUAD = { list: [], order: 'follow', goto: null, focus: null, chat: [], said: {} };
const NAMES = ['Alpha', 'Bravo'];
const ROLES = {                                                      // what each teammate is good at; swap a teammate's role at the loadout screen or with F beside them
  rifleman: { label: 'Rifleman', gun: 'rifle', tint: '#9fc0ff', head: 'helmet', rate: 0.34, dmg: 0.75, spread: 0.07, range: 470, hp: 90, spd: 195, bspeed: 560, scale: 1 },
  medic: { label: 'Medic', gun: 'smg', tint: '#8ad0c8', head: 'cap', back: 'medic', rate: 0.2, dmg: 0.4, spread: 0.12, range: 320, hp: 80, spd: 205, bspeed: 580, scale: 1 },
  sniper: { label: 'Sniper', gun: 'sniper', tint: '#b8b090', head: 'beret', rate: 1.3, dmg: 3.2, spread: 0.012, range: 850, hp: 70, spd: 175, bspeed: 1000, scale: 1, stay: true },
  heavy: { label: 'Heavy', gun: 'rifle', tint: '#a0a8a0', head: 'helmet', back: 'pack', rate: 0.11, dmg: 0.5, spread: 0.16, range: 380, hp: 150, spd: 150, bspeed: 540, scale: 1.18, taunt: true },
};
const ROLE_KEYS = Object.keys(ROLES);
const roleOf = i => { const r = profile.squadRoles && profile.squadRoles[i]; return ROLES[r] ? r : ['rifleman', 'medic'][i] || 'rifleman'; };
function squadCount() { if (gameMode === 'training') return TUT.squadOn ? 2 : 0; if (typeof DAILY !== 'undefined' && DAILY.on) return 0; return gameMode === 'br' ? (SET.brDuo ? 1 : 0) : SET.squad; }
function clearSquad() { for (const a of SQUAD.list) if (a.mesh) scene.remove(a.mesh); SQUAD.list = []; SQUAD.order = 'follow'; SQUAD.goto = null; SQUAD.focus = null; SQUAD.chat = []; SQUAD.said = {}; }
function makeAlly(i, x, y) {
  const rk = roleOf(i), d = ROLES[rk], a = { ...d, role: rk, name: NAMES[i], i, x, y, hp: d.hp, maxHp: d.hp, r: d.scale > 1 ? 13 : 11, medT: 6, state: 'ok', angle: 0, moveAngle: 0, speedNow: 0, phase: Math.random() * 6, crouchK: 0, cool: rnd(0, 0.5), tgtT: 0, tgt: null, hitT: 99, down: 0, reviveT: 0, mflash: 0, flash: 0, holdAt: null, cover: null, coverT: 0, strafeT: 0, sd: 1 };
  a.mesh = makeHuman({ tint: d.tint, gun: d.gun, scale: d.scale }); dressHuman(a.mesh, { skin: 'std', head: d.head, back: d.back || (i ? 'radio' : 'none') }); scene.add(a.mesh); return a;
}
function setRole(a, rk) {                                         // change a living teammate's role and weapon on the spot
  const d = ROLES[rk], hpK = a.hp / a.maxHp, pos = { x: a.x, y: a.y }; if (a.mesh) scene.remove(a.mesh);
  Object.assign(a, d, { role: rk, maxHp: d.hp, hp: Math.max(1, d.hp * hpK), r: d.scale > 1 ? 13 : 11, cover: null, tgt: null, ...pos });
  a.mesh = makeHuman({ tint: d.tint, gun: d.gun, scale: d.scale }); dressHuman(a.mesh, { skin: 'std', head: d.head, back: d.back || (a.i ? 'radio' : 'none') }); scene.add(a.mesh);
  if (!profile.squadRoles) profile.squadRoles = []; profile.squadRoles[a.i] = rk; saveProfile();
}
function swapRole(a) { const rk = ROLE_KEYS[(ROLE_KEYS.indexOf(a.role) + 1) % ROLE_KEYS.length]; setRole(a, rk); squadSay(a.name, ROLE_LINES[rk]); notify(`${a.name}: ${ROLES[rk].label}`); Sound.ui(); }
const ROLE_LINES = { rifleman: 'Rifle up. I will cover the front.', medic: 'Medic here. Stay close and I will patch you up.', sniper: 'Sniper in position. I will pick them off from range.', heavy: 'Heavy gun ready. Let them come.' };
const nearestAlly = () => { let best = null, bd = 50; for (const a of SQUAD.list) if (a.state === 'ok') { const d = Math.hypot(a.x - player.x, a.y - player.y); if (d < bd) { bd = d; best = a; } } return best; };
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
    if (a.state === 'dead' || !a.mesh) { SQUAD.list[i] = makeAlly(i, player.x - 60 + i * 120, player.y + 70); squadSay(NAMES[i], 'Reporting in.'); continue; }
    a.hp = a.maxHp; a.state = 'ok'; a.down = 0; a.reviveT = 0;
  }
}
let voiceOk = null;
function speak(who, msg) {                                        // optional text-to-speech: each teammate has their own pitch
  try { if (!window.speechSynthesis) return; const u = new SpeechSynthesisUtterance(msg); u.rate = 1.12; u.volume = Math.min(1, 0.8 * SET.vol.master * SET.vol.sfx); u.pitch = who === 'HQ' ? 0.7 : who === 'Alpha' ? 0.9 : 1.25; speechSynthesis.speak(u); } catch (e) {}
}
function squadSay(who, msg) { SQUAD.chat.push({ who, msg, t: 6 }); if (SQUAD.chat.length > 4) SQUAD.chat.shift(); if (Sound.radio) Sound.radio(); if (SET.squadVoice) speak(who, msg); }
function saidOnce(key, who, msg, every = 9) { const t = performance.now() / 1000; if (t - (SQUAD.said[key] || -99) < every) return; SQUAD.said[key] = t; squadSay(who, msg); }
function squadOrder(kind) {
  if (!SQUAD.list.length) return;
  if (kind === 'toggle') { if (SQUAD.order === 'hold') { SQUAD.order = 'follow'; SQUAD.goto = null; squadSay('Alpha', 'On you.'); notify('Squad: FOLLOW'); } else { SQUAD.order = 'hold'; for (const a of SQUAD.list) a.holdAt = { x: a.x, y: a.y }; squadSay('Alpha', 'Holding position.'); notify('Squad: HOLD'); } }
  else if (kind === 'go') { SQUAD.order = 'go'; SQUAD.goto = { x: clampN(aim.x, 60, FW - 60), y: clampN(aim.y, 60, FH - 60) }; squadSay('Alpha', 'Moving.'); notify('Squad: MOVE TO AIM'); }
  Sound.ui();
}
function squadFocus() {                                           // everyone shoots the enemy nearest to where you are aiming
  if (!SQUAD.list.length) return; if (SQUAD.focus && SQUAD.focus.hp > 0) { SQUAD.focus = null; squadSay('Alpha', 'Free fire.'); notify('Squad: FREE FIRE'); Sound.ui(); return; }
  let best = null, bd = 260; for (const e of enemies) { if (e.hp <= 0 || e.elev > 0) continue; const d = Math.hypot(e.x - aim.x, e.y - aim.y); if (d < bd) { bd = d; best = e; } }
  if (!best) { notify('Aim at an enemy to focus fire'); return; }
  SQUAD.focus = best; squadSay('Alpha', 'Focusing that one!'); notify('Squad: FOCUS FIRE'); Sound.ui();
}
function damageAlly(a, n) {
  if (a.state !== 'ok') return; a.hp -= n; a.hitT = 0; a.flash = 0.1; bloodFx(a.x, a.y, 1, 0, 3, 0);
  if (a.hp <= 0) { a.hp = 0; a.state = 'down'; a.down = 28; a.tgt = null; if (SQUAD.focus && a.i === 0) SQUAD.focus = null; squadSay(a.name, "I'm hit! Need help!"); Sound.panic && Sound.panic(a.x, a.y); }
  else if (n > 6) saidOnce('hit' + a.i, a.name, 'Taking fire!', 7);
}
function nearestDown() { let best = null, bd = 56; for (const a of SQUAD.list) if (a.state === 'down') { const d = Math.hypot(a.x - player.x, a.y - player.y); if (d < bd) { bd = d; best = a; } } return best; }
function slotFor(a) {                                           // formation: behind the player, spread to the sides, relative to the way the camera looks
  const f = look.yaw, side = SQUAD.list.length > 1 ? (a.i ? 1 : -1) : 0.8, dx = Math.cos(f), dy = Math.sin(f);
  const back = a.stay ? 160 : 95; return { x: player.x - dx * back - dy * side * 75, y: player.y - dy * back + dx * side * 75 };
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
      a.tgtT = 0.25; let best = null, bd = a.range * 1.1 * ENV.vis; const f = SQUAD.focus;
      if (f && f.hp > 0 && Math.hypot(f.x - a.x, f.y - a.y) < a.range * 1.2 * ENV.vis && lineClear(a.x, a.y, f.x, f.y)) best = f;
      else for (const e of enemies) { if (e.hp <= 0 || e.elev > 0) continue; const d = Math.hypot(e.x - a.x, e.y - a.y); if (d < bd && lineClear(a.x, a.y, e.x, e.y)) { bd = d; best = e; } }
      if (f && f.hp <= 0) SQUAD.focus = null;
      if (best && !a.tgt) saidOnce('contact', a.name, ['Contact!', 'Enemy ahead!', 'I see them!'][Math.floor(Math.random() * 3)], 10);
      if (best && best !== a.tgt) { if (best.officer) saidOnce('officer', a.name, 'Officer! Stop him calling for help!', 10); else if (best.shield) saidOnce('shield', a.name, 'Shield trooper! Go round the side!', 12); else if (best.nvg) saidOnce('nvg', a.name, 'Night vision! He can see us in the dark!', 14); else if (best.type === 'boss') saidOnce('boss', a.name, 'That is Dagan! Everything on him!', 20); else if (best.type === 'heli') saidOnce('heli', a.name, 'Gunship overhead!', 15); }
      a.tgt = best;
    }
    if (a.tgt && a.tgt.hp <= 0) { saidOnce('down' + a.i, a.name, a.role === 'sniper' ? ['Target neutralised.', 'One shot, one kill.'][Math.floor(Math.random() * 2)] : a.role === 'heavy' ? ['Suppressed.', 'Stay down.'][Math.floor(Math.random() * 2)] : ['Target down.', 'Got him.', 'One less.'][Math.floor(Math.random() * 3)], 6); a.tgt = null; }
    // where to stand
    let want = null, spd = 0, hold = false, work = null;
    a.medT -= dt;
    if (a.role === 'medic') {                                      // patch up the player and teammates; get to a downed teammate and bring them back
      if (a.medT <= 0 && player.hp < player.maxHp * 0.7 && dP < 170) { player.hp = Math.min(player.maxHp, player.hp + 28); player.bleed = 0; a.medT = 15; squadSay(a.name, ['Patching you up.', 'Hold still. Done.'][Math.floor(Math.random() * 2)]); Sound.pickup(); }
      else if (a.medT <= 0) for (const o of SQUAD.list) if (o !== a && o.state === 'ok' && o.hp < o.maxHp * 0.6 && Math.hypot(o.x - a.x, o.y - a.y) < 170) { o.hp = Math.min(o.maxHp, o.hp + 30); a.medT = 15; squadSay(a.name, o.name + ', you are patched.'); Sound.pickup(); break; }
      work = SQUAD.list.find(o => o.state === 'down' && !a.tgt);
      if (work) { const wd = Math.hypot(work.x - a.x, work.y - a.y); if (wd < 34) { work.reviveT = Math.max(work.reviveT, (a.reviveWork = (a.reviveWork || 0) + dt) / 3); if (a.reviveWork >= 3) { work.state = 'ok'; work.hp = work.maxHp * 0.55; work.reviveT = 0; work.hitT = 0; a.reviveWork = 0; squadSay(work.name, 'Thanks, Medic.'); Sound.pickup(); } hold = true; } }
      else a.reviveWork = 0;
    }
    if (work && !hold) want = { x: work.x, y: work.y }; else if (SQUAD.order === 'hold') want = a.holdAt || (a.holdAt = { x: a.x, y: a.y }); else if (SQUAD.order === 'go' && SQUAD.goto) { want = { x: SQUAD.goto.x + (a.i ? 60 : -60), y: SQUAD.goto.y }; if (Math.hypot(want.x - a.x, want.y - a.y) < 60) { want = null; hold = true; } } else want = slotFor(a);
    if (a.tgt && a.hp < a.maxHp * 0.45) { if (a.coverT <= 0) { a.coverT = 1.5; a.cover = findCover(a, a.tgt, false); } if (a.cover) want = a.cover; }
    const ab = buildingAt(a.x, a.y);
    if (playerBuilding && ab !== playerBuilding && SQUAD.order === 'follow') { const t = Math.hypot(a.x - playerBuilding.doorOut.x, a.y - playerBuilding.doorOut.y) < 80 ? playerBuilding.doorIn : playerBuilding.doorOut; want = t; }
    else if (ab && ab !== playerBuilding && SQUAD.order === 'follow' && !playerBuilding) { const t = Math.hypot(a.x - ab.doorIn.x, a.y - ab.doorIn.y) < 70 ? ab.doorOut : ab.doorIn; want = t; }
    let dx = 0, dy = 0;
    if (want && !hold) { dx = want.x - a.x; dy = want.y - a.y; const l = Math.hypot(dx, dy); if (l > (a.tgt ? 40 : 28)) { spd = clampN(l * 2, 55, a.spd) * (a.tgt && l < 140 ? 0.5 : 1); dx /= l; dy /= l; } else { dx = dy = 0; } }
    if (a.tgt && !spd && SQUAD.order !== 'hold' && !a.cover && !a.stay) { if (a.strafeT <= 0) { a.strafeT = rnd(1, 2); a.sd = Math.random() < 0.5 ? 1 : -1; } const ex = a.tgt.x - a.x, ey = a.tgt.y - a.y, el = Math.hypot(ex, ey) || 1; dx = -ey / el * a.sd; dy = ex / el * a.sd; spd = 40; }
    if (spd) {
      let sx = 0, sy = 0; for (const o of SQUAD.list) if (o !== a && o.state === 'ok') { const ox = a.x - o.x, oy = a.y - o.y, od = Math.hypot(ox, oy); if (od < 30 && od > 0.1) { sx += ox / od; sy += oy / od; } }
      dx += sx * 0.6; dy += sy * 0.6; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      a.x += dx * spd * dt; a.y += dy * spd * dt; a.moveAngle = Math.atan2(dy, dx); a.phase += dt * spd * 0.1; pushOut(a, a.r); a.x = clampN(a.x, 40, FW - 40); a.y = clampN(a.y, 40, FH - 40);
    }
    a.speedNow = spd;
    for (const b of buildings) if (Math.hypot(a.x - (b.door.x + b.door.w / 2), a.y - (b.door.y + b.door.h / 2)) < 52) b.door.hold = 1.6;
    a.angle = a.tgt ? Math.atan2(a.tgt.y - a.y, a.tgt.x - a.x) : (spd ? a.moveAngle : a.angle);
    if (a.tgt && a.cool <= 0 && lineClear(a.x, a.y, a.tgt.x, a.tgt.y) && Math.hypot(a.tgt.x - a.x, a.tgt.y - a.y) < a.range * ENV.vis) {
      const ang = a.angle + (Math.random() - 0.5) * 2 * a.spread; bullets.push({ x: a.x + Math.cos(ang) * 18, y: a.y + Math.sin(ang) * 18, vx: Math.cos(ang) * a.bspeed, vy: Math.sin(ang) * a.bspeed, dmg: a.dmg, life: 1, vh: 0, ally: a });
      a.mflash = 0.08; a.cool = a.rate * (0.9 + Math.random() * 0.4); (a.role === 'sniper' ? Sound.sniperShot : Sound.shoot).call(Sound, { at: [a.x, a.y], vol: a.role === 'sniper' ? 0.8 : 0.55, ref: 9, range: a.role === 'sniper' ? 320 : 220 }); aiNoise(a.x, a.y, a.role === 'sniper' ? 900 : 640);
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
  const f = SQUAD.focus; if (f && f.hp > 0) { pv.set(wx(f.x), floorY(f.x, f.y) + (f.elev || 0) + 2.7, wz(f.y)).project(camera); if (pv.z < 1) { const x = (pv.x * 0.5 + 0.5) * W, y = (-pv.y * 0.5 + 0.5) * H; ctx.strokeStyle = '#ff4a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.moveTo(x - 14, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 14, y); ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 5); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 14); ctx.stroke(); ctx.lineWidth = 1; } }
  // panel under the radar
  const px = 14, py = 208; text('SQUAD  ' + SQUAD.order.toUpperCase(), px, py, 10, 'left', '#9ab');
  SQUAD.list.forEach((a, i) => { const y = py + 8 + i * 22; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px, y, 140, 18); text(a.name + ' ' + (a.label || '')[0], px + 4, y + 13, 10, 'left', a.state === 'ok' ? '#cde' : '#f98'); ctx.fillStyle = '#300'; ctx.fillRect(px + 52, y + 6, 80, 6); ctx.fillStyle = a.state === 'ok' ? '#6c6' : a.state === 'down' ? '#e84' : '#555'; ctx.fillRect(px + 52, y + 6, 80 * (a.state === 'dead' ? 0 : a.hp / a.maxHp || (a.state === 'down' ? a.down / 28 : 0)), 6); });
  SQUAD.chat.forEach((c, i) => { c.t -= 0.016; });
  SQUAD.chat = SQUAD.chat.filter(c => c.t > 0);
  SQUAD.chat.forEach((c, i) => { ctx.globalAlpha = Math.min(1, c.t); text(`${c.who}: ${c.msg}`, 14, H - 100 - (SQUAD.chat.length - 1 - i) * 15, 11, 'left', '#9cf'); }); ctx.globalAlpha = 1;
  ctx.restore();
}
