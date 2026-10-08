// ---------- Training: a guided first run (movement, shooting, stealth, grenades, squad orders, revive) and a target range to try every gun ----------
const TUT = { step: 0, t: 0, done: false, prevMap: null, moved: 0, lx: 0, ly: 0, k0: 0, dummies: [], guard: null, nades: 0, sw: new Set(), lastW: 0, reloaded: false, smith: false, crouched: false, sawHold: false, sawGo: false, sawFocus: false, enter: false, flash: 0, squadOn: false };
const TSTEPS = [
  { id: 'move', title: 'MOVE', text: 'Move with W A S D and look with the mouse. Hold Shift to sprint, Space to jump. On a touchscreen use the left stick and drag to look.', hint: () => `${Math.min(100, Math.round(TUT.moved / 4))}%`, ok: () => TUT.moved > 400 },
  { id: 'shoot', title: 'SHOOT', text: 'Left click to fire (or hold FIRE on touch). Knock down the three yellow targets.', init: () => { TUT.k0 = kills; spawnDummies(3, 260); }, hint: () => `${Math.min(3, kills - TUT.k0)}/3`, ok: () => kills - TUT.k0 >= 3 },
  { id: 'reload', title: 'RELOAD', text: 'Press R to reload. Always reload behind cover, not in the open.', ok: () => TUT.reloaded },
  { id: 'switch', title: 'WEAPONS', text: 'You carry all four guns on the range. Press 1, 2, 3 and 4 to switch (Z zooms with a scope) and try them on the targets.', hint: () => `${TUT.sw.size}/4`, ok: () => TUT.sw.size >= 4 },
  { id: 'smith', title: 'GUNSMITH', text: 'Press B to open the gunsmith. Fit an attachment to a gun, then press B again to close it. On a run, attachments are found in crates.', ok: () => TUT.smith && state === 'playing' },
  { id: 'crouch', title: 'CROUCH', text: 'Press C to crouch. You are harder to spot, quieter and steadier. You need it for the next step.', ok: () => TUT.crouched },
  { id: 'nade', title: 'GRENADES', text: 'Hold G to aim the arc, release to throw. T switches between frag, smoke and flash. Throw one now.', init: () => { player.grenades = Math.max(player.grenades, 3); spawnDummies(2, 330); }, ok: () => TUT.nades >= 1 },
  { id: 'stealth', title: 'STEALTH', text: 'A guard is on patrol. Stay low (C), keep out of his sight, come up behind him and press X for a silent knife kill. Shots and loud noises alert everyone nearby; B throws a bottle (U) to lure a guard away.', init: () => spawnGuard(), ok: () => TUT.guard && TUT.guard.hp <= 0 },
  { id: 'squad', title: 'SQUAD ORDERS', init: () => { TUT.squadOn = true; spawnSquad(); }, text: 'Two teammates are with you. Press Y to hold them in place, press Y again to bring them back, aim somewhere and press Tab to send them there.', hint: () => `${TUT.sawHold ? 'hold ✓' : 'hold'}  ${TUT.sawGo ? 'move ✓' : 'move'}`, ok: () => TUT.sawHold && TUT.sawGo },
  { id: 'focus', title: 'FOCUS FIRE', text: 'Aim at a target and press 5 so the whole squad fires on it. Press 5 again for free fire. F beside a teammate changes their role: rifleman, medic, sniper or heavy.', init: () => spawnDummies(2, 300), ok: () => TUT.sawFocus },
  { id: 'revive', title: 'REVIVE', text: 'Bravo is down! Run to him and HOLD F until the bar fills. In a real run a downed teammate bleeds out in 28 seconds.', init: () => { const a = SQUAD.list[1] || SQUAD.list[0]; if (a) { a.state = 'down'; a.down = 999; a.hp = 0; TUT.rev = a; squadSay(a.name, "I'm hit! Need help!"); } }, ok: () => !TUT.rev || TUT.rev.state === 'ok' },
  { id: 'loadout', title: 'READY', text: 'That is everything. Before each Survival, Missions or Campaign run you choose a loadout: guns unlock as you level up and each gun gains mastery with its kills. The campaign is in the menu (B changes mode). Stay as long as you like on the range; press Enter to finish.', ok: () => TUT.enter },
];
function startTraining() {
  Object.assign(TUT, { step: 0, t: 0, done: false, moved: 0, lx: player.x, ly: player.y, dummies: [], guard: null, nades: 0, sw: new Set([player.weaponIdx]), lastW: player.weaponIdx, reloaded: false, smith: false, crouched: false, sawHold: false, sawGo: false, sawFocus: false, enter: false, rev: null, flash: 0, squadOn: false });
  for (let i = 0; i < WEAPONS.length; i++) player.guns[i] = { ammo: WEAPONS[i].mag, res: WEAPONS[i].mag * 6, att: {} };      // the whole armoury, and attachments to play with
  for (const k in player.attInv) player.attInv[k] = 2; player.grenades = 5; player.smokes = 3; player.flashes = 3; player.bottles = 5;
  TUT.k0 = kills; state = 'playing'; notify('TRAINING: follow the steps at the top. ] skips a step');
}
function spawnDummies(n, dist) {
  for (let i = 0; i < n; i++) {
    const a = look.yaw + (i - (n - 1) / 2) * 0.42, p = { x: clampN(player.x + Math.cos(a) * dist, 80, FW - 80), y: clampN(player.y + Math.sin(a) * dist, 80, FH - 80) };
    const q = pointFree(p.x, p.y, 16) ? p : freeSpot(dist - 80, dist + 80), e = addEnemy('dummy'); e.x = q.x; e.y = q.y; e.dummy = true; e.spawn = { x: q.x, y: q.y }; TUT.dummies.push(e);
  }
}
function spawnGuard() {
  const c = freeSpot(380, 560), e = addEnemy('soldier'); e.x = c.x; e.y = c.y; const pa = Math.random() * 6.283;
  Object.assign(e, { hp: 2, maxHp: 2, rate: 999, cool: 9999, bdmg: 0, radio: false, seenAge: 99, lastSeen: { x: c.x, y: c.y }, guard: true, mode: 'search', role: 'assault', stealth: true, susp: 0, alertT: 0, alertFlash: 0, faceA: pa, pi: 0, wait: 0, canNade: false,
    patrol: [0, 1, 2, 3].map(k => ({ x: clampN(c.x + Math.cos(pa + k * 1.57) * 110, 80, FW - 80), y: clampN(c.y + Math.sin(pa + k * 1.57) * 110, 80, FH - 80) })).filter(q => pointFree(q.x, q.y, 12)) });
  TUT.guard = e;
}
function updateTraining(dt) {
  killcamCool = 99; player.hp = Math.max(player.hp, 1); TUT.t += dt;
  const sp = Math.hypot(player.x - TUT.lx, player.y - TUT.ly); if (sp < 60) TUT.moved += sp; TUT.lx = player.x; TUT.ly = player.y;
  TUT.sw.add(player.weaponIdx); if (player.reloading > 0) TUT.reloaded = true; if (player.crouch) TUT.crouched = true;
  for (const g of grenades) if (!g.enemy && !g.seen) { g.seen = true; TUT.nades++; }
  if (SQUAD.order === 'hold') TUT.sawHold = true; if (SQUAD.order === 'go') TUT.sawGo = true; if (SQUAD.focus && SQUAD.focus.hp > 0) TUT.sawFocus = true;
  for (const a of SQUAD.list) if (a.state === 'down') a.down = 999;
  for (const e of TUT.dummies) if (e.hp <= 0 && !e.respawn) e.respawn = TUT.t + 3;                           // the range puts targets back up
  TUT.dummies = TUT.dummies.map(e => { if (e.respawn && TUT.t > e.respawn) { const n = addEnemy('dummy'); n.x = e.spawn.x; n.y = e.spawn.y; n.dummy = true; n.spawn = e.spawn; return n; } return e; });
  const s = TSTEPS[TUT.step];
  if (s && !TUT.done) {
    if (!s.started) { s.started = true; if (s.init) s.init(); }
    if (s.ok()) { TUT.flash = 1.2; Sound.pickup(); TUT.step++; if (TUT.step >= TSTEPS.length) { TUT.done = true; } }
  }
  TUT.flash -= dt;
}
function trainEnter() { const s = TSTEPS[TUT.step]; if (s && s.id === 'loadout') TUT.enter = true; if (TUT.done || TUT.enter) leaveTraining(true); }
function leaveTraining(finished) {
  if (finished && !profile.tutDone) { profile.tutDone = true; profile.xp += 100; saveProfile(); }
  for (const e of enemies) removeMesh(e.mesh); enemies = []; TUT.dummies = []; clearSquad();
  if (TUT.prevMap) selectedMap = TUT.prevMap; menuMode = 'survival'; gameMode = 'survival'; state = 'menu'; Sound.engineOff(); if (document.pointerLockElement) document.exitPointerLock();
  for (const s of TSTEPS) s.started = false;
}
function skipTrainingStep() { const s = TSTEPS[TUT.step]; if (!s || TUT.done) return; if (!s.started && s.init) s.init(); s.started = true; TUT.step++; if (TUT.step >= TSTEPS.length) TUT.done = true; else { const n = TSTEPS[TUT.step]; n.started = true; if (n.init) n.init(); } }
function drawTraining() {
  if (gameMode !== 'training') return;
  if (state === 'gunsmith') TUT.smith = true;
  if (state !== 'playing' && state !== 'paused') return;
  const s = TSTEPS[Math.min(TUT.step, TSTEPS.length - 1)], w = 304, x = 14, y0 = 272;
  const lines = wrapText(s.text, w - 24, 11), h = 46 + lines.length * 15;
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.66)'; ctx.fillRect(x, y0, w, h); ctx.strokeStyle = TUT.flash > 0 ? '#8f8' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = TUT.flash > 0 ? 3 : 1; ctx.strokeRect(x, y0, w, h); ctx.lineWidth = 1;
  text(`TRAINING ${Math.min(TUT.step + 1, TSTEPS.length)}/${TSTEPS.length} · ${s.title}`, x + 12, y0 + 20, 12, 'left', '#ee8'); if (s.hint && !TUT.done) text(s.hint(), x + w - 12, y0 + 20, 12, 'right', '#9e9');
  lines.forEach((ln, i) => text(ln, x + 12, y0 + 40 + i * 15, 11, 'left', '#e8eedd'));
  for (let i = 0; i < TSTEPS.length; i++) { ctx.fillStyle = i < TUT.step ? '#7c4' : i === TUT.step ? '#ee8' : '#333'; ctx.fillRect(x + 12 + i * 23, y0 + h - 9, 19, 4); }
  ctx.restore();
  text(']  skip step    ·    pause (P) then Enter: leave training', W / 2, H - 20, 10, 'center', 'rgba(220,230,200,0.6)');
}
