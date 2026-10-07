
// ---------- Input ----------
const keys = {};
const mouse = { x: W / 2, y: H / 2, down: false };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (!keys[k]) keyPressed(k);
  keys[k] = true;
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * W / r.width;
  mouse.y = (e.clientY - r.top) * H / r.height;
});
canvas.addEventListener('mousedown', e => {
  Sound.init();
  if (state === 'menu' || state === 'over') {
    for (let i = 0; i < 3; i++) if (overCard(i)) selectedChar = i;
    return start();
  }
  if (state === 'upgrade') { clickUpgrade(); if (state === 'playing') tryLock(); return; }
  if (state === 'paused') { state = 'playing'; tryLock(); return; }
  tryLock();
  if (e.button === 2) player.throwGrenade(); else mouse.down = true;
});
// Mouse look: the cursor is captured while playing (Esc releases it and pauses).
let lockedOnce = false;
function tryLock() {
  if (touch.on || document.pointerLockElement === canvas || !canvas.requestPointerLock) return;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) {}
}
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || state !== 'playing') return;
  look.yaw += e.movementX * 0.0025; look.pitch += e.movementY * 0.002;
});
document.addEventListener('pointerlockchange', () => {
  const on = document.pointerLockElement === canvas;
  if (!on && lockedOnce && state === 'playing') state = 'paused';
  lockedOnce = on;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mouseup', () => mouse.down = false);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });

// ---------- Touch controls: left stick moves, right stick aims and fires ----------
const touch = { on: false, move: null, look: null, fire: false, ids: {} };
const TBTN = [
  { id: 'wpn', label: 'WPN', x: W - 40, y: 190 },
  { id: 'rel', label: 'R', x: W - 40, y: 250 },
  { id: 'gre', label: 'G', x: W - 40, y: 310 },
  { id: 'dash', label: 'DASH', x: W - 40, y: 370 },
  { id: 'use', label: 'USE', x: W - 40, y: 430 },
  { id: 'pause', label: 'II', x: W / 2, y: 30, r: 18 },
  { id: 'fire', label: 'FIRE', x: W - 120, y: H - 100, r: 42 },
];
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
function stickVec(s) {
  const dx = s.x - s.sx, dy = s.y - s.sy, d = Math.hypot(dx, dy), m = Math.min(d, 55) / 55;
  return { x: d > 8 ? dx / d * m : 0, y: d > 8 ? dy / d * m : 0, mag: d, angle: Math.atan2(dy, dx) };
}
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  e.preventDefault(); Sound.init(); touch.on = true;
  const p = canvasPos(e); mouse.x = p.x; mouse.y = p.y;
  if (state === 'menu' || state === 'over') {
    for (let i = 0; i < 3; i++) if (overCard(i)) selectedChar = i;
    return start();
  }
  if (state === 'upgrade') return clickUpgrade();
  const b = TBTN.find(b => Math.hypot(p.x - b.x, p.y - b.y) <= (b.r || 26) + 6);
  if (b) {
    if (b.id === 'fire') {
      if (state === 'playing') { touch.fire = true; touch.ids[e.pointerId] = 'fire'; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
    } else if (b.id === 'pause') keyPressed('p');
    else if (state === 'playing') {
      if (b.id === 'wpn') player.switchTo((player.weaponIdx + 1) % WEAPONS.length);
      if (b.id === 'rel') player.reloadStart();
      if (b.id === 'gre') player.throwGrenade();
      if (b.id === 'dash') player.dash();
      if (b.id === 'use') useAction();
    }
    return;
  }
  const role = p.x < W / 2 ? 'move' : 'look';
  if (!touch[role]) {
    touch[role] = { sx: p.x, sy: p.y, x: p.x, y: p.y, lx: p.x, ly: p.y }; touch.ids[e.pointerId] = role;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }
}, { passive: false });
canvas.addEventListener('pointermove', e => {
  const role = touch.ids[e.pointerId];
  if (!role || role === 'fire' || !touch[role]) return;
  e.preventDefault(); const p = canvasPos(e), t = touch[role]; t.x = p.x; t.y = p.y;
  if (role === 'look') { look.yaw += (p.x - t.lx) * 0.006; look.pitch += (p.y - t.ly) * 0.004; t.lx = p.x; t.ly = p.y; }
}, { passive: false });
const touchEnd = e => {
  const role = touch.ids[e.pointerId];
  if (role) { touch[role] = null; delete touch.ids[e.pointerId]; }
};
canvas.addEventListener('pointerup', touchEnd);
canvas.addEventListener('pointercancel', touchEnd);

function keyPressed(k) {
  Sound.init();
  if (k === 'm') Sound.muted = !Sound.muted;
  if (state === 'menu' || state === 'over') {
    if (k >= '1' && k <= '3') selectedChar = +k - 1;
    if (k === 'arrowleft' || k === 'a') selectedChar = (selectedChar + 2) % 3;
    if (k === 'arrowright' || k === 'd') selectedChar = (selectedChar + 1) % 3;
    if (k === 'enter') start();
    return;
  }
  if (state === 'upgrade') { if (k >= '1' && k <= '3') pickUpgrade(+k - 1); return; }
  if (k === 'p') { state = state === 'paused' ? 'playing' : 'paused'; if (state === 'playing') tryLock(); return; }
  if (state !== 'playing') return;
  if (k === 'f') { useAction(); return; }
  if (player.driving || player.enter) return;
  if (k === 'r') player.reloadStart();
  if (k === 'g') player.throwGrenade();
  if (k === ' ') player.dash();
  if (k >= '1' && k <= '3') player.switchTo(+k - 1);
}

// ---------- Sound (synthesised, no files) ----------
const Sound = {
  ac: null, muted: false,
  init() { if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } },
  tone(freq, dur, type = 'square', vol = 0.06, slide = 0) {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ac.destination); o.start(t); o.stop(t + dur);
  },
  noise(dur, vol = 0.12) {
    if (!this.ac || this.muted) return;
    const n = this.ac.sampleRate * dur, buf = this.ac.createBuffer(1, n, this.ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ac.createBufferSource(), g = this.ac.createGain();
    g.gain.value = vol; s.buffer = buf; s.connect(g).connect(this.ac.destination); s.start();
  },
  shoot() { this.tone(420, 0.07, 'square', 0.04, -300); },
  shotgun() { this.noise(0.15, 0.1); this.tone(150, 0.12, 'sawtooth', 0.05, -100); },
  hit() { this.tone(200, 0.04, 'triangle', 0.04); },
  hurt() { this.tone(120, 0.18, 'sawtooth', 0.08, -60); },
  boom() { this.noise(0.4, 0.2); this.tone(90, 0.3, 'sine', 0.1, -60); },
  pickup() { this.tone(600, 0.08, 'sine', 0.06); setTimeout(() => this.tone(900, 0.1, 'sine', 0.06), 70); },
  dash() { this.tone(300, 0.12, 'sine', 0.05, 400); },
  wave() { [400, 500, 650].forEach((f, i) => setTimeout(() => this.tone(f, 0.15, 'square', 0.05), i * 110)); },
  reload() { this.tone(250, 0.05, 'square', 0.04); },
  engineOn() {
    if (!this.ac || this.eng) return;
    const o = this.ac.createOscillator(), g = this.ac.createGain(), f = this.ac.createBiquadFilter();
    o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0.03; o.connect(f).connect(g).connect(this.ac.destination); o.start(); this.eng = { o, g };
  },
  engineSet(r) { if (this.eng) { this.eng.o.frequency.value = 38 + 120 * r; this.eng.g.gain.value = this.muted ? 0 : 0.025 + 0.045 * r; } },
  engineOff() { if (this.eng) { try { this.eng.o.stop(); } catch (e) {} this.eng = null; } },
};

// ---------- Data ----------
let state = 'menu', player, bullets, enemyBullets, enemies, pickups, particles, grenades, boss;
let score, wave, enemiesToSpawn, spawnTimer, waveDelay, shake, kills, best = 0, choices = [];
try { best = +localStorage.getItem('war3d-best') || 0; } catch (e) {}

const WEAPONS = [
  { name: 'Rifle', rate: 0.14, spread: 0.04, pellets: 1, speed: 650, dmg: 1, mag: 30, snd: 'shoot' },
  { name: 'Shotgun', rate: 0.7, spread: 0.3, pellets: 6, speed: 550, dmg: 1, mag: 8, snd: 'shotgun' },
  { name: 'SMG', rate: 0.07, spread: 0.12, pellets: 1, speed: 600, dmg: 0.6, mag: 50, snd: 'shoot' },
];

const UPGRADES = [
  { name: 'Body Armor', desc: '+25 max HP and full heal', apply: p => { p.maxHp += 25; p.hp = p.maxHp; } },
  { name: 'Hollow Points', desc: '+25% weapon damage', apply: p => p.dmgMul *= 1.25 },
  { name: 'Trigger Finger', desc: '+20% fire rate', apply: p => p.rateMul *= 0.8 },
  { name: 'Running Shoes', desc: '+12% move speed', apply: p => p.speed *= 1.12 },
  { name: 'Grenade Pack', desc: '+3 grenades', apply: p => p.grenades += 3 },
  { name: 'Quick Hands', desc: '35% faster reload', apply: p => p.reloadMul *= 0.65 },
  { name: 'Field Medic', desc: 'Heal 60 HP', apply: p => p.hp = Math.min(p.maxHp, p.hp + 60) },
];

const CHARACTERS = [
  { name: 'Rifleman', color: '#4a7fd0', helmet: '#2b4f8a', tint: '#b4c8f0', hp: 100, speed: 190, weapon: 0, grenades: 3, dashCool: 1.2,
    desc: 'Balanced. Starts with rifle.' },
  { name: 'Heavy', color: '#6a8f4a', helmet: '#3d5a2a', tint: '#b6dc9a', hp: 170, speed: 150, weapon: 1, grenades: 2, dashCool: 1.6,
    desc: 'Tanky. Starts with shotgun.' },
  { name: 'Scout', color: '#d99a3a', helmet: '#8a5a1a', tint: '#f0cf94', hp: 75, speed: 245, weapon: 2, grenades: 3, dashCool: 0.7,
    desc: 'Fast and agile. Starts with SMG.' },
];
let selectedChar = 0;
const cardX = i => 90 + i * 270;
const overCard = i => mouse.x >= cardX(i) && mouse.x <= cardX(i) + 240 && mouse.y >= 300 && mouse.y <= 500;

const TYPES = {
  soldier: { r: 12, hp: 2, speed: 80, color: '#b33', score: 10, shoots: true, rate: 1.8, range: 300, bspeed: 260, bdmg: 8 },
  runner: { r: 10, hp: 1, speed: 150, color: '#e83', score: 15, shoots: false, melee: 10 },
  sniper: { r: 11, hp: 2, speed: 60, color: '#a4a', score: 30, shoots: true, rate: 2.6, range: 560, bspeed: 520, bdmg: 14 },
  tank: { r: 22, hp: 12, speed: 45, color: '#654', score: 60, shoots: true, rate: 1.1, range: 400, bspeed: 260, bdmg: 15 },
  boss: { r: 40, hp: 60, speed: 35, color: '#822', score: 500, shoots: true, rate: 1.3, range: 700, bspeed: 280, bdmg: 12 },
};

// ---------- Player ----------
class Player {
  constructor(ch) {
    this.ch = ch;
    this.x = FW / 2; this.y = FH / 2; this.r = 14;
    this.hp = ch.hp; this.maxHp = ch.hp; this.speed = ch.speed;
    this.weaponIdx = ch.weapon; this.cool = 0; this.ammo = WEAPONS[ch.weapon].mag;
    this.reloading = 0; this.angle = 0; this.hurt = 0;
    this.dmgMul = 1; this.rateMul = 1; this.reloadMul = 1; this.grenades = ch.grenades;
    this.dashT = 0; this.dashCool = 0; this.dx = 1; this.dy = 0; this.phase = 0; this.driving = null; this.enter = null;
    this.speedNow = 0; this.back = false;
    this.mesh = makeHuman({ tint: ch.tint, gun: ['rifle', 'shotgun', 'smg'][ch.weapon] }); scene.add(this.mesh);
  }
  get weapon() { return WEAPONS[this.weaponIdx]; }
  reloadStart() { if (this.reloading <= 0 && this.ammo < this.weapon.mag) { this.reloading = 1.2 * this.reloadMul; Sound.reload(); } }
  update(dt) {
    let dx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
    let dy = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    if (touch.move) { const v = stickVec(touch.move); dx = v.x; dy = v.y; }
    if (dx || dy) {                          // WASD and the stick are relative to the camera
      const fwd = -dy, rt = dx, c = Math.cos(look.yaw), s = Math.sin(look.yaw);
      dx = c * fwd - s * rt; dy = s * fwd + c * rt;
      this.dx = dx; this.dy = dy; this.phase += dt * 12;
    }
    let sp = this.speed;
    if (this.dashT > 0) { sp = 650; dx = this.dx; dy = this.dy; this.dashT -= dt; }
    this.dashCool -= dt;
    this.x = Math.max(this.r, Math.min(FW - this.r, this.x + dx * sp * dt));
    this.y = Math.max(this.r, Math.min(FH - this.r, this.y + dy * sp * dt));
    pushOut(this, this.r);
    const mv = Math.hypot(dx, dy);
    this.speedNow = mv * sp; this.back = mv > 0.05 && (dx * Math.cos(aimAngle) + dy * Math.sin(aimAngle)) < -0.3 * mv;
    this.angle = aimAngle;
    this.cool -= dt; this.hurt -= dt;
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.ammo = this.weapon.mag;
    } else if ((mouse.down || touch.fire) && this.cool <= 0) {
      if (this.ammo <= 0) this.reloadStart(); else this.shoot();
    }
  }
  switchTo(i) {
    if (i === this.weaponIdx) return;
    this.weaponIdx = i; this.ammo = this.weapon.mag; this.reloading = 0;
  }
  dash() {
    if (this.dashCool > 0) return;
    this.dashT = 0.16; this.dashCool = this.ch.dashCool; Sound.dash();
  }
  shoot() {
    const w = this.weapon;
    for (let i = 0; i < w.pellets; i++) {
      const a = this.angle + (Math.random() - 0.5) * 2 * w.spread;
      bullets.push({ x: this.x + Math.cos(a) * 20, y: this.y + Math.sin(a) * 20,
        vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, dmg: w.dmg * this.dmgMul, life: 1 });
    }
    this.cool = w.rate * this.rateMul; this.ammo--; shake = Math.max(shake, 3); Sound[w.snd]();
  }
  throwGrenade() {
    if (this.grenades <= 0) return;
    this.grenades--;
    const d = Math.max(120, Math.min(380, Math.hypot(aim.x - this.x, aim.y - this.y)));
    grenades.push({ x: this.x, y: this.y, vx: Math.cos(this.angle) * 340, vy: Math.sin(this.angle) * 340, t: d / 340, t0: d / 340 });
  }
  damage(n) {
    if (this.dashT > 0) return;
    if (this.driving) n *= 0.35;
    this.hp -= n; this.hurt = 0.15; shake = Math.max(shake, 6); Sound.hurt();
    if (this.hp <= 0) gameOver();
  }
}

// ---------- Game flow ----------
function spawnEnemy() {
  const roll = Math.random();
  let type = 'soldier';
  if (wave >= 3 && roll < 0.1) type = 'tank';
  else if (wave >= 4 && roll < 0.22) type = 'sniper';
  else if (roll < 0.45) type = 'runner';
  addEnemy(type);
}
function addEnemy(type) {
  const t = TYPES[type];
  let x, y, tries = 0;
  do {          // appear 30-45 m away, outside the player's immediate surroundings
    const a = Math.random() * 6.283, d = type === 'boss' ? 800 : rnd(620, 860);
    x = clampN(player.x + Math.cos(a) * d, 60, FW - 60); y = clampN(player.y + Math.sin(a) * d, 60, FH - 60);
  } while (++tries < 24 && (!pointFree(x, y, t.r + 8) || buildingAt(x, y) || Math.hypot(x - player.x, y - player.y) < 520));
  const hp = type === 'boss' ? t.hp + wave * 5 : t.hp + Math.floor(wave / 4);
  const e = { ...t, type, x, y, hp, maxHp: hp, cool: Math.random() * (t.rate || 1), flash: 0, side: Math.random() < 0.5 ? 1 : -1, stuck: 0 };
  e.mesh = makeEnemyMesh(e); scene.add(e.mesh);
  enemies.push(e);
  if (type === 'boss') boss = e;
}

function start() {
  if (!ready) return;
  Sound.engineOff(); playerBuilding = null;
  look.yaw = -Math.PI / 2; look.pitch = 0.14; tryLock();
  if (player) removeMesh(player.mesh);
  for (const e of enemies) removeMesh(e.mesh);
  generateMap();
  player = new Player(CHARACTERS[selectedChar]);
  bullets = []; enemyBullets = []; enemies = []; pickups = []; particles = []; grenades = []; boss = null;
  score = 0; wave = 0; kills = 0; shake = 0; waveDelay = 0; spawnTimer = 0; enemiesToSpawn = 0;
  state = 'playing'; nextWave();
}
function nextWave() {
  wave++; enemiesToSpawn = 5 + wave * 3; waveDelay = 0; Sound.wave();
  if (wave % 5 === 0) addEnemy('boss');
  state = 'playing';
}
function offerUpgrades() {
  choices = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
  state = 'upgrade';
}
function pickUpgrade(i) {
  if (!choices[i]) return;
  choices[i].apply(player); Sound.pickup(); nextWave();
}
function clickUpgrade() {
  for (let i = 0; i < 3; i++) {
    const x = 90 + i * 270;
    if (mouse.x >= x && mouse.x <= x + 240 && mouse.y >= 200 && mouse.y <= 420) return pickUpgrade(i);
  }
}
function gameOver() {
  state = 'over';
  if (score > best) { best = score; try { localStorage.setItem('war3d-best', best); } catch (e) {} }
}

function boom(x, y, color, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = 40 + Math.random() * 160;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, color, h: 0.3 + Math.random(), vh: 1 + Math.random() * 4 });
  }
}
function fire(e, angle, speed, dmg) {
  e.mflash = 0.09;
  enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 3, dmg });
}
function explode(g) {
  const R = 95;
  boom(g.x, g.y, '#fa3', 40); boom(g.x, g.y, '#888', 20); shake = 14; Sound.boom();
  for (const e of enemies) {
    const d = Math.hypot(e.x - g.x, e.y - g.y);
    if (d < R + e.r) { e.hp -= 10 * player.dmgMul; e.flash = 0.1; }
  }
  const pd = Math.hypot(player.x - g.x, player.y - g.y);
  if (pd < R * 0.6) player.damage(15);
}

function update(dt) {
  updateEnter(dt);
  if (player.driving) {
    const v = player.driving;
    driveVehicle(v, dt); runOver(v);
    player.x = v.x; player.y = v.y; player.angle = v.heading; player.speedNow = 0; player.cool -= dt; player.hurt -= dt;
    Sound.engineOn(); Sound.engineSet(Math.abs(v.speed) / v.T.max);
  } else if (!player.enter) player.update(dt);
  coastVehicles(dt);
  playerBuilding = player.driving ? null : buildingAt(player.x, player.y);
  updateBuildings(dt);

  if (enemiesToSpawn > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnEnemy(); enemiesToSpawn--; spawnTimer = Math.max(0.3, 1.2 - wave * 0.06); }
  } else if (enemies.length === 0) {
    waveDelay += dt;
    if (waveDelay > 1.2) offerUpgrades();
  }

  for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
  for (const b of enemyBullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
  for (const g of grenades) { g.x += g.vx * dt; g.y += g.vy * dt; g.t -= dt; if (g.t <= 0) { g.dead = true; explode(g); } }
  grenades = grenades.filter(g => !g.dead);

  for (const e of enemies) {
    const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
    let mx = dx, my = dy, md = d, wp = false;
    const eb = buildingAt(e.x, e.y);
    if (playerBuilding && eb !== playerBuilding) {            // the player is indoors: go to the door, then straight through it
      const t = Math.hypot(e.x - playerBuilding.doorOut.x, e.y - playerBuilding.doorOut.y) < 80 ? playerBuilding.doorIn : playerBuilding.doorOut;
      mx = t.x - e.x; my = t.y - e.y; md = Math.hypot(mx, my) || 1; wp = true;
    } else if (eb && eb !== playerBuilding) {                 // an enemy is indoors and the player is not: leave by the door
      const t = Math.hypot(e.x - eb.doorIn.x, e.y - eb.doorIn.y) < 70 ? eb.doorOut : eb.doorIn;
      mx = t.x - e.x; my = t.y - e.y; md = Math.hypot(mx, my) || 1; wp = true;
    }
    e.hitCd = (e.hitCd || 0) - dt;
    e.flash -= dt; e.angle = Math.atan2(dy, dx); e.speedNow = 0; e.mflash = (e.mflash || 0) - dt;
    if (!e.shoots || wp || d > e.range * 0.6) {
      e.x += mx / md * e.speed * dt; e.y += my / md * e.speed * dt;
      e.phase = (e.phase || 0) + dt * e.speed * 0.1; e.moveAngle = Math.atan2(my, mx); e.speedNow = e.speed;
      // Collide with the map; when blocked, slide along the obstacle (and switch sides if stuck).
      const onMap = e.x > 0 && e.x < FW && e.y > 0 && e.y < FH;
      const hit = onMap ? pushOut(e, e.r > 20 ? e.r * 0.55 : e.r) : null;
      if (hit) {
        e.x += -hit.y * e.side * e.speed * dt * 0.9; e.y += hit.x * e.side * e.speed * dt * 0.9;
        e.stuck += dt; if (e.stuck > 1.5) { e.side = -e.side; e.stuck = 0; }
      } else e.stuck = Math.max(0, e.stuck - dt);
    }
    if (e.shoots) {
      e.cool -= dt;
      if (e.cool <= 0 && d < e.range && (onScreen(e.x, e.y) || d < 360)) {
        const a = Math.atan2(dy, dx);
        if (e.type === 'boss') {
          for (let i = -1; i <= 1; i++) fire(e, a + i * 0.2, e.bspeed, e.bdmg);
          if (e.hp < e.maxHp / 2) for (let i = 0; i < 12; i++) fire(e, i * Math.PI / 6 + e.cool, 180, 8);
        } else {
          fire(e, a + (Math.random() - 0.5) * (e.type === 'sniper' ? 0.03 : 0.25), e.bspeed, e.bdmg);
        }
        e.cool = e.rate;
      }
    }
    if (e.melee && (player.driving ? inOBB(player.driving, e.x, e.y, e.r) : d < e.r + player.r)) { if (player.driving) damageVehicle(player.driving, e.melee * 1.5); else player.damage(e.melee); e.hp = 0; boom(e.x, e.y, e.color); }
    for (const b of buildings) if (Math.hypot(e.x - (b.door.x + b.door.w / 2), e.y - (b.door.y + b.door.h / 2)) < 52) b.door.hold = 1.6;   // enemies open doors as they pass
  }

  for (const b of bullets) {
    for (const e of enemies) {
      if (e.hp > 0 && b.life > 0 && Math.hypot(b.x - e.x, b.y - e.y) < e.r + 3) {
        e.hp -= b.dmg; b.life = 0; e.flash = 0.06; boom(b.x, b.y, '#ee8', 3); Sound.hit();
      }
    }
  }
  for (const b of enemyBullets) {
    if (player.driving) { if (b.life > 0 && inOBB(player.driving, b.x, b.y)) { b.life = 0; damageVehicle(player.driving, b.dmg * 0.8); boom(b.x, b.y, '#fa6', 3); Sound.hit(); } }
    else if (b.life > 0 && Math.hypot(b.x - player.x, b.y - player.y) < player.r + 3) {
      b.life = 0; player.damage(b.dmg);
    }
  }

  for (const e of enemies) {
    if (e.hp <= 0 && !e.counted) {
      e.counted = true; kills++; score += e.score; removeMesh(e.mesh);
      boom(e.x, e.y, e.color, e.r > 20 ? 40 : 14);
      if (e.r > 20) { shake = 12; Sound.boom(); }
      if (e.type === 'boss') { pickups.push({ x: e.x, y: e.y, kind: 'hp' }, { x: e.x + 30, y: e.y, kind: 'ammo' }); boss = null; }
      else if (Math.random() < 0.2) {
        const r = Math.random();
        pickups.push({ x: e.x, y: e.y, kind: r < 0.5 ? 'hp' : r < 0.85 ? 'ammo' : 'gren' });
      }
    }
  }
  enemies = enemies.filter(e => e.hp > 0);

  for (const p of pickups) {
    if (Math.hypot(p.x - player.x, p.y - player.y) < player.r + 10) {
      p.got = true; Sound.pickup();
      if (p.kind === 'hp') player.hp = Math.min(player.maxHp, player.hp + 25);
      else if (p.kind === 'gren') player.grenades += 2;
      else { player.ammo = player.weapon.mag; player.reloading = 0; }
    }
  }
  pickups = pickups.filter(p => !p.got);

  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.h = Math.max(0.05, p.h + p.vh * dt); p.vh -= 12 * dt; }
  particles = particles.filter(p => p.life > 0);
  const inb = b => b.life > 0 && b.x > -20 && b.x < FW + 20 && b.y > -20 && b.y < FH + 20;
  const alive = b => {
    if (!inb(b)) return false;
    if (bulletBlocked(b.x, b.y) || bulletBlocked(b.x - b.vx * dt / 2, b.y - b.vy * dt / 2)) { boom(b.x, b.y, '#cb9', 3); return false; }
    return true;
  };
  bullets = bullets.filter(alive);
  enemyBullets = enemyBullets.filter(alive);
  shake = Math.max(0, shake - dt * 20);
}

// ---------- Drawing ----------
function text(s, x, y, size = 16, align = 'left', color = '#fff') {
  ctx.fillStyle = color; ctx.font = `${size}px monospace`; ctx.textAlign = align; ctx.fillText(s, x, y);
}

// ---------- Doors and vehicles: the F key ----------
function nearestDoor() {
  let best = null, bd = 80;
  for (const b of buildings) { const d = b.door, dist = Math.hypot(d.x + d.w / 2 - player.x, d.y + d.h / 2 - player.y); if (dist < bd) { bd = dist; best = b; } }
  return best ? { b: best, dist: bd } : null;
}
function interactTarget() {
  if (player.driving) return { type: 'exit' };
  if (player.enter) return null;
  const v = nearestVehicle(), d = nearestDoor();
  const vd = v ? Math.hypot(v.x - player.x, v.y - player.y) - v.halfL : 1e9;
  if (v && (!d || vd < d.dist)) return { type: 'vehicle', v };
  if (d) return { type: 'door', b: d.b };
  return null;
}
function useAction() {
  const t = interactTarget(); if (!t) return;
  if (t.type === 'exit') exitVehicle(false);
  else if (t.type === 'vehicle') startEnter(t.v);
  else { t.b.door.manual = !t.b.door.manual; Sound.tone(t.b.door.manual ? 160 : 120, 0.15, 'triangle', 0.06, -40); }
}
function drawPrompt() {
  const t = interactTarget(); if (!t) return;
  let msg = t.type === 'exit' ? (Math.abs(player.driving.speed) > 70 ? 'Slow down to get out' : 'F  Get out') : t.type === 'vehicle' ? 'F  Enter vehicle' : t.b.door.manual ? 'F  Close door' : 'F  Open door';
  if (touch.on) msg = msg.replace(/^F /, 'USE:');
  ctx.save(); ctx.font = '18px monospace'; const w = ctx.measureText(msg).width + 36;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - w / 2, H - 120, w, 34); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeRect(W / 2 - w / 2, H - 120, w, 34);
  text(msg, W / 2, H - 97, 18, 'center', '#ffe9a0'); ctx.restore();
}
function drawHUD() {
  ctx.fillStyle = '#400'; ctx.fillRect(15, 15, 200, 14);
  ctx.fillStyle = '#e44'; ctx.fillRect(15, 15, 200 * Math.max(0, player.hp) / player.maxHp, 14);
  text(`${Math.ceil(Math.max(0, player.hp))}/${player.maxHp}`, 20, 27, 11, 'left', '#fff');
  text(`${player.ch.name}   Score ${score}   Best ${best}`, 15, 50);
  text(`Wave ${wave}`, W - 15, 28, 16, 'right');
  const w = player.weapon;
  if (player.driving) {
    const v = player.driving;
    text(`${Math.round(Math.abs(v.speed) / U * 3.6)} km/h`, W - 15, 50, 22, 'right');
    ctx.fillStyle = '#222'; ctx.fillRect(W - 215, 62, 200, 10); ctx.fillStyle = v.hp > v.maxHp * 0.3 ? '#3c9' : '#e83'; ctx.fillRect(W - 215, 62, 200 * Math.max(0, v.hp) / v.maxHp, 10);
    text('Vehicle', W - 220, 71, 11, 'right', '#cdb');
  } else {
  text(`${w.name}  ${player.reloading > 0 ? 'RELOADING' : player.ammo + '/' + w.mag}`, W - 15, 50, 16, 'right');
  text(`Grenades ${player.grenades}   Dash ${player.dashCool > 0 ? player.dashCool.toFixed(1) + 's' : 'READY'}`, W - 15, 72, 14, 'right', '#cdb');
  }
  if (!touch.on) text(player.driving ? 'W/S gas and brake · A/D steer · Space handbrake · F get out · mouse look' : 'WASD move · mouse look (Q/E turn) · LMB shoot · RMB/G grenade · Space dash · R reload · 1/2/3 weapon · F open doors / enter vehicles · P pause (Esc frees mouse)', W / 2, H - 10, 11, 'center', '#cdb');
  if (boss && boss.hp > 0) {
    ctx.fillStyle = '#222'; ctx.fillRect(W / 2 - 200, 66, 400, 12);
    ctx.fillStyle = '#c33'; ctx.fillRect(W / 2 - 200, 66, 400 * boss.hp / boss.maxHp, 12);
    text('BOSS', W / 2, 62, 12, 'center');
  }
}

function overlay(title, sub, hint, select) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  const top = select ? 90 : H / 2 - 40;
  text(title, W / 2, top, 56, 'center');
  if (sub) text(sub, W / 2, top + 40, 20, 'center');
  text(hint, W / 2, top + 90, 20, 'center', '#ee8');
  if (!select) return;
  text('Choose your soldier (click or tap a card, or 1-3 / A-D then Enter)', W / 2, 270, 14, 'center', '#cdb');
  CHARACTERS.forEach((c, i) => {
    const x = cardX(i), sel = i === selectedChar || overCard(i);
    ctx.fillStyle = sel ? '#4a5a3a' : '#2a3320'; ctx.fillRect(x, 300, 240, 200);
    ctx.strokeStyle = i === selectedChar ? '#ee8' : '#666'; ctx.lineWidth = i === selectedChar ? 3 : 1;
    ctx.strokeRect(x, 300, 240, 200); ctx.lineWidth = 1;
    if (portraits[i]) ctx.drawImage(portraits[i], x + 70, 300, 100, 100);
    text(`[${i + 1}] ${c.name}`, x + 120, 410, 20, 'center');
    text(c.desc, x + 120, 435, 12, 'center', '#cdb');
    text(`HP ${c.hp}  Speed ${c.speed}  ${WEAPONS[c.weapon].name}`, x + 120, 460, 12, 'center', '#ee8');
    text(`Grenades ${c.grenades}  Dash ${c.dashCool}s`, x + 120, 480, 12, 'center', '#ee8');
  });
}

function drawUpgrade() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
  text(`WAVE ${wave} CLEARED`, W / 2, 120, 40, 'center');
  text('Choose an upgrade (click or press 1-3)', W / 2, 160, 18, 'center', '#ee8');
  choices.forEach((c, i) => {
    const x = 90 + i * 270, hover = mouse.x >= x && mouse.x <= x + 240 && mouse.y >= 200 && mouse.y <= 420;
    ctx.fillStyle = hover ? '#4a5a3a' : '#2a3320'; ctx.fillRect(x, 200, 240, 220);
    ctx.strokeStyle = '#ee8'; ctx.strokeRect(x, 200, 240, 220);
    text(`[${i + 1}]`, x + 120, 240, 18, 'center', '#ee8');
    text(c.name, x + 120, 290, 20, 'center');
    const words = c.desc.split(' '); let line = '', y = 335;
    for (const wd of words) {
      if ((line + wd).length > 22) { text(line, x + 120, y, 14, 'center', '#cdb'); line = ''; y += 20; }
      line += wd + ' ';
    }
    text(line, x + 120, y, 14, 'center', '#cdb');
  });
}

function drawTouch() {
  if (!touch.on || (state !== 'playing' && state !== 'paused')) return;
  ctx.lineWidth = 2;
  [['move', 110, 'MOVE']].forEach(([role, ix, label]) => {
    const s = touch[role];
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const bx = s ? s.sx : ix, by = s ? s.sy : H - 110;
    ctx.beginPath(); ctx.arc(bx, by, 55, 0, 7); ctx.fill(); ctx.stroke();
    if (s) {
      const v = stickVec(s);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(bx + v.x * 55, by + v.y * 55, 24, 0, 7); ctx.fill();
    } else text(label, bx, by + 4, 12, 'center', 'rgba(255,255,255,0.5)');
  });
  if (!touch.look) text('DRAG TO LOOK', W * 0.68, H / 2, 12, 'center', 'rgba(255,255,255,0.4)');
  for (const b of TBTN) {
    ctx.fillStyle = b.id === 'fire' ? 'rgba(200,40,30,0.45)' : 'rgba(0,0,0,0.35)'; ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r || 26, 0, 7); ctx.fill(); ctx.stroke();
    text(b.label, b.x, b.y + 4, b.label.length > 2 ? 11 : 15, 'center');
  }
  ctx.lineWidth = 1;
}

function draw() {
  ctx.setTransform(SS, 0, 0, SS, 0, 0);
  ctx.clearRect(0, 0, W, H);
  render3D(frameDt);
  canvas.style.cursor = state === 'playing' ? 'none' : 'default';
  if (state !== 'menu') { drawIndicators(); drawHUD(); }
  if (state === 'playing' || state === 'paused') { drawRadar(); if (!player.driving) drawCrosshair(); }
  if (state === 'playing') drawPrompt();
  drawTouch();
  if (state === 'menu') overlay('WAR 3D', 'Survive the waves. Beat the bosses.', 'Pick a soldier to begin', true);
  if (state === 'over') overlay('GAME OVER', `Score ${score} · Wave ${wave} · Kills ${kills} · Best ${best}`, 'Pick a soldier to play again', true);
  if (state === 'paused') overlay('PAUSED', '', touch.on ? 'Tap II to resume' : 'Click or press P to resume');
  if (state === 'upgrade') drawUpgrade();
}

let last = performance.now(), frameDt = 0.016, ready = false, loadError = '';
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t; frameDt = dt;
  requestAnimationFrame(loop);
  if (!ready) {
    ctx.setTransform(SS, 0, 0, SS, 0, 0); ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#14170f'; ctx.fillRect(0, 0, W, H);
    text(loadError ? 'Could not load: ' + loadError : 'Loading soldier model and building the map...', W / 2, H / 2, 20, 'center', loadError ? '#f88' : '#cdb');
    return;
  }
  if (state !== 'playing') Sound.engineOff();
  if (state !== 'playing' && document.pointerLockElement) document.exitPointerLock();
  updateCamera(dt); updateAim();
  if (state === 'playing') update(dt);
  draw();
}
function boot() {
  player = new Player(CHARACTERS[0]); score = 0; wave = 0; kills = 0; shake = 0; boss = null;
  bullets = []; enemyBullets = []; enemies = []; pickups = []; particles = []; grenades = [];
  generateMap(); makePortraits(); ready = true;
}
setTimeout(() => {
  try {
    const bin = atob(SOLDIER_B64), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer, '', gltf => { HUMAN.gltf = gltf; try { boot(); } catch (e) { loadError = e.message; console.error(e); } }, err => { loadError = String(err && err.message || err); });
  } catch (e) { loadError = e.message; console.error(e); }
}, 40);
requestAnimationFrame(loop);
