
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
    if (overMapBar()) return switchMap();
    for (let i = 0; i < 3; i++) if (overCard(i)) selectedChar = i;
    return start();
  }
  if (state === 'upgrade') { clickUpgrade(); if (state === 'playing') tryLock(); return; }
  if (state === 'paused') { state = 'playing'; tryLock(); return; }
  if (state === 'gunsmith') return clickSmith();
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
  { id: 'jump', label: 'JUMP', x: W - 40, y: 490 },
  { id: 'crch', label: 'CRCH', x: W - 40, y: 550 },
  { id: 'smith', label: 'GUN', x: W - 100, y: 190 },
  { id: 'zoom', label: 'ZOOM', x: W - 100, y: 250 },
  { id: 'band', label: 'BAND', x: W - 100, y: 310 },
  { id: 'med', label: 'MED', x: W - 100, y: 370 },
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
    if (overMapBar()) return switchMap();
    for (let i = 0; i < 3; i++) if (overCard(i)) selectedChar = i;
    return start();
  }
  if (state === 'upgrade') return clickUpgrade();
  if (state === 'gunsmith') return clickSmith();
  const b = TBTN.find(b => Math.hypot(p.x - b.x, p.y - b.y) <= (b.r || 26) + 6);
  if (b) {
    if (b.id === 'fire') {
      if (state === 'playing') { touch.fire = true; touch.ids[e.pointerId] = 'fire'; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
    } else if (b.id === 'pause') keyPressed('p');
    else if (state === 'playing') {
      if (b.id === 'wpn') player.nextWeapon();
      if (b.id === 'zoom') player.toggleZoom();
      if (b.id === 'band') player.startHeal('band');
      if (b.id === 'med') player.startHeal('med');
      if (b.id === 'smith') openSmith();
      if (b.id === 'rel') player.reloadStart();
      if (b.id === 'gre') player.throwGrenade();
      if (b.id === 'dash') player.dash();
      if (b.id === 'use') useAction();
      if (b.id === 'jump' && !player.driving) player.jump();
      if (b.id === 'crch' && !player.driving) player.toggleCrouch();
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
  if (k === 'm') Sound.toggleMute();
  if (k === 'n') Sound.toggleMusic();
  if (state === 'menu' || state === 'over') {
    if (k >= '1' && k <= '3') selectedChar = +k - 1;
    if (k === 'arrowleft' || k === 'a') selectedChar = (selectedChar + 2) % 3;
    if (k === 'arrowright' || k === 'd') selectedChar = (selectedChar + 1) % 3;
    if (k === 'enter') start();
    if (k === 't') switchMap();
    return;
  }
  if (state === 'upgrade') { if (k >= '1' && k <= '3') pickUpgrade(+k - 1); return; }
  if (state === 'gunsmith') {
    if (k === 'b' || k === 'escape' || k === 'enter') closeSmith();
    else if (k >= '1' && k <= '4') { if (player.guns[+k - 1]) { player.weaponIdx = +k - 1; player.reloading = 0; player.zoom = false; } }
    else { const si = ['a', 's', 'd', 'f'].indexOf(k); if (si >= 0) player.fit(SLOTS[si]); }
    return;
  }
  if (k === 'p') { state = state === 'paused' ? 'playing' : 'paused'; if (state === 'playing') tryLock(); return; }
  if (state !== 'playing') return;
  if (k === 'f') { useAction(); return; }
  if (player.driving || player.enter) return;
  if (k === 'r') player.reloadStart();
  if (k === 'g') player.throwGrenade();
  if (k === ' ') player.jump();
  if (k === 'v') player.dash();
  if (k === 'c') player.toggleCrouch();
  if (k >= '1' && k <= '4') player.switchTo(+k - 1);
  if (k === 'z') player.toggleZoom();
  if (k === 'l') { player.torch = !player.torch; notify('Flashlight ' + (player.torch ? 'on' : 'off')); }
  if (k === 'o') { nextWeather(); WX.auto = false; notify('Weather: ' + WEATHERS[WX.name].label); }
  if (k === 'i') { TOD.hour = (TOD.hour + 3) % 24; notify('Time ' + fmtTime()); }
  if (k === 'k') { killcamOn = !killcamOn; notify('Killcam ' + (killcamOn ? 'on' : 'off')); }
  if (k === 'h') player.startHeal('band');
  if (k === 'j') player.startHeal('med');
  if (k === 'b') openSmith();
}

// ---------- Data ----------
let state = 'menu', player, bullets, enemyBullets, enemies, pickups, particles, grenades, boss;
let score, wave, enemiesToSpawn, spawnTimer, waveDelay, shake, kills, best = 0, choices = [];
try { best = +localStorage.getItem('war3d-best') || 0; } catch (e) {}

const WEAPONS = [
  { name: 'Rifle', rate: 0.14, spread: 0.04, pellets: 1, speed: 650, dmg: 1, mag: 30, snd: 'shoot' },
  { name: 'Shotgun', rate: 0.7, spread: 0.3, pellets: 6, speed: 550, dmg: 1, mag: 8, snd: 'shotgun' },
  { name: 'SMG', rate: 0.07, spread: 0.12, pellets: 1, speed: 600, dmg: 0.6, mag: 50, snd: 'smg' },
  { name: 'Sniper', rate: 1.0, spread: 0.012, pellets: 1, speed: 1200, dmg: 4, mag: 5, snd: 'sniperShot', scoped: true, zoom: 24 },
];
// Attachments: one per slot on each weapon. They are found as crates and fitted at the gunsmith (B).
const ATTS = {
  scope:    { name: 'Scope',          slot: 'optic',  desc: 'Z zooms in; steadier aim while zoomed' },
  silencer: { name: 'Silencer',       slot: 'muzzle', desc: 'Quiet shot, no muzzle flash, -10% damage' },
  extmag:   { name: 'Extended Mag',   slot: 'mag',    desc: '+50% magazine, slightly slower reload' },
  laser:    { name: 'Laser Sight',    slot: 'side',   desc: 'Red dot and a tighter spread' },
};
const SLOTS = ['optic', 'muzzle', 'mag', 'side'], SLOT_ATT = { optic: 'scope', muzzle: 'silencer', mag: 'extmag', side: 'laser' };
let toast = { text: '', t: 0 };
let killcam = null, killcamOn = true, killcamCool = 0;
function notify(text) { toast = { text, t: 2.6 }; }

const UPGRADES = [
  { name: 'Body Armor', desc: '+25 max HP and full heal', apply: p => { p.maxHp += 25; p.hp = p.maxHp; } },
  { name: 'Hollow Points', desc: '+25% weapon damage', apply: p => p.dmgMul *= 1.25 },
  { name: 'Trigger Finger', desc: '+20% fire rate', apply: p => p.rateMul *= 0.8 },
  { name: 'Running Shoes', desc: '+12% move speed', apply: p => p.speed *= 1.12 },
  { name: 'Grenade Pack', desc: '+3 grenades', apply: p => p.grenades += 3 },
  { name: 'Quick Hands', desc: '35% faster reload', apply: p => p.reloadMul *= 0.65 },
  { name: 'Medic Bag', desc: '+3 bandages and +1 medkit', apply: p => { p.bandages += 3; p.medkits += 1; } },
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
let selectedChar = 0, selectedMap = REAL_MAPS.kochi ? 'kochi' : Object.keys(REAL_MAPS)[0] || 'proc', mapBusy = false;
try { const q = new URLSearchParams(location.search).get('map'); if (q === 'proc' || REAL_MAPS[q]) selectedMap = q; } catch (e) {}
const MAP_LIST = Object.values(REAL_MAPS).map(m => [m.id, m.name + ': real streets and buildings']).concat([['proc', 'Random countryside battlefield']]);
const mapBar = () => ({ x: W / 2 - 330, y: 198, w: 660, h: 32 });
const overMapBar = () => { const r = mapBar(); return mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h; };
function switchMap() {
  if (mapBusy || !ready) return;
  const i = MAP_LIST.findIndex(m => m[0] === selectedMap); selectedMap = MAP_LIST[(i + 1) % MAP_LIST.length][0]; mapBusy = true; Sound.ui();
  setTimeout(() => {                                       // let the "building the map" message paint first
    generateMap(selectedMap); clearDecals(); resetDestruct(); player.x = SPAWN.x; player.y = SPAWN.y; player.fy = player.fyVis = floorY(player.x, player.y); mapBusy = false;
  }, 60);
}
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
    this.x = SPAWN.x; this.y = SPAWN.y; this.r = 14;
    this.hp = ch.hp; this.maxHp = ch.hp; this.speed = ch.speed;
    this.armor = ch.name === 'Heavy' ? 40 : 0; this.bleed = 0; this.bandages = 2; this.medkits = 1; this.heal = null; this.beat = 0; this.sinceHit = 99;   // health system
    this.weaponIdx = ch.weapon; this.cool = 0;
    this.guns = {}; this.guns[ch.weapon] = { ammo: WEAPONS[ch.weapon].mag, res: WEAPONS[ch.weapon].mag * 3, att: {} };   // owned weapons: magazine, reserve ammo, fitted attachments
    this.attInv = { scope: 0, silencer: 0, extmag: 0, laser: 0 }; this.zoom = false; this.zoomK = 0; this.swapT = 0;
    this.reloading = 0; this.angle = 0; this.hurt = 0;
    this.dmgMul = 1; this.rateMul = 1; this.reloadMul = 1; this.grenades = ch.grenades;
    this.dashT = 0; this.dashCool = 0; this.dx = 1; this.dy = 0; this.phase = 0; this.driving = null; this.enter = null;
    this.speedNow = 0; this.back = false;
    this.fy = floorY(this.x, this.y); this.fyVis = this.fy; this.vx = 0; this.vy = 0; this.vz = 0; this.grounded = true; this.coyote = 0; this.jumpBuf = 0;
    this.crouch = false; this.crouchK = 0; this.airK = 0; this.stamina = 100; this.staminaLock = 0; this.sprinting = false;
    this.spreadNow = 0.03; this.bloom = 0; this.recoil = 0; this.faceAngle = -Math.PI / 2;
    this.mesh = makeHuman({ tint: ch.tint, gun: ['rifle', 'shotgun', 'smg'][ch.weapon] }); scene.add(this.mesh);
  }
  get weapon() { return WEAPONS[this.weaponIdx]; }
  get gs() { return this.guns[this.weaponIdx]; }
  get ammo() { return this.gs.ammo; }
  set ammo(v) { this.gs.ammo = v; }
  get magSize() { return Math.round(this.weapon.mag * (this.gs.att.mag ? 1.5 : 1)); }
  get scoped() { return !!(this.weapon.scoped || this.gs.att.optic); }
  zoomFov() { return this.weapon.scoped ? this.weapon.zoom : 34; }
  toggleZoom() { if (this.scoped && !this.driving) { this.zoom = !this.zoom; Sound.cloth(); } }
  reloadStart() { if (this.reloading <= 0 && this.ammo < this.magSize && this.gs.res > 0) { this.reloading = 1.2 * this.reloadMul * (this.gs.att.mag ? 1.15 : 1); Sound.reload(this.reloading); } }
  giveWeapon(i) {
    if (this.guns[i]) { this.guns[i].res += WEAPONS[i].mag * 2; notify(`${WEAPONS[i].name}: +${WEAPONS[i].mag * 2} ammo`); return; }
    this.guns[i] = { ammo: WEAPONS[i].mag, res: WEAPONS[i].mag * 2, att: {} }; notify(`Picked up ${WEAPONS[i].name}  (press ${i + 1})`);
  }
  giveAmmo() { for (const k in this.guns) { const g = this.guns[k], w = WEAPONS[k]; g.res += Math.ceil(w.mag * 1.5); } notify('Ammo restocked'); }
  fit(slot) {                                           // toggle an attachment on the current weapon from the gunsmith
    const key = SLOT_ATT[slot], g = this.gs;
    if (slot === 'optic' && this.weapon.scoped) return;
    if (g.att[slot]) { g.att[slot] = false; this.attInv[key]++; if (slot === 'optic') this.zoom = false; if (slot === 'mag' && g.ammo > this.magSize) { g.res += g.ammo - this.magSize; g.ammo = this.magSize; } }
    else if (this.attInv[key] > 0) { this.attInv[key]--; g.att[slot] = true; }
  }
  jump() { this.jumpBuf = 0.14; }
  toggleCrouch() { this.crouch = !this.crouch; Sound.cloth(); }
  update(dt) {
    // ---- input, relative to the camera ----
    let ix = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
    let iy = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
    if (ix && iy) { ix *= 0.7071; iy *= 0.7071; }
    if (touch.move) { const v = stickVec(touch.move); ix = v.x; iy = v.y; }
    const analog = Math.min(1, Math.hypot(ix, iy)), moving = analog > 0.05;
    let mx = 0, my = 0;
    if (moving) { const fwd = -iy, rt = ix, c = Math.cos(look.yaw), s = Math.sin(look.yaw); mx = c * fwd - s * rt; my = s * fwd + c * rt; this.dx = mx; this.dy = my; }
    const ml = Math.hypot(mx, my) || 1, fdx = Math.cos(aimAngle), fdy = Math.sin(aimAngle), fdot = moving ? (mx * fdx + my * fdy) / ml : 0;
    this.crouchK += ((this.crouch ? 1 : 0) - this.crouchK) * Math.min(1, dt * 10);
    // ---- sprint uses stamina; you cannot shoot while sprinting ----
    const firing = mouse.down || touch.fire;
    this.sprinting = !!((keys['shift'] || (touch.on && analog > 0.93)) && moving && fdot > 0.25 && !this.crouch && !firing && !this.heal && this.stamina > 0 && this.staminaLock <= 0 && this.grounded);
    if (this.sprinting) { this.stamina -= 22 * dt; if (this.stamina <= 0) { this.stamina = 0; this.staminaLock = 1.3; } }
    else { this.staminaLock -= dt; if (this.staminaLock <= 0) this.stamina = Math.min(100, this.stamina + (moving ? 9 : 20) * dt); }
    // ---- target velocity: jog, sprint, crouch-walk; strafing and backpedalling are slower; uphill is slower ----
    let top = this.speed * 0.68;
    if (this.sprinting) top = this.speed; else if (this.crouch) top *= 0.5;
    if (this.zoom) top *= 0.6;
    if (this.heal) top *= 0.55;
    if (!this.sprinting && moving) top *= fdot >= 0 ? 0.92 + 0.08 * fdot : 0.92 + 0.2 * fdot;
    if (moving && this.grounded) { const l = 20, h1 = hAt(wx(this.x + mx / ml * l), wz(this.y + my / ml * l)), h0 = hAt(wx(this.x), wz(this.y)); top *= 1 - clampN((h1 - h0) * 0.55, -0.1, 0.4); }
    top *= analog;
    let tvx = moving ? mx / ml * top : 0, tvy = moving ? my / ml * top : 0;
    if (this.dashT > 0) { tvx = this.dx * 650; tvy = this.dy * 650; this.dashT -= dt; }
    this.dashCool -= dt;
    const acc = this.dashT > 0 ? 6000 : this.grounded ? (moving ? 1700 : 2000) : 260, ex = tvx - this.vx, ey = tvy - this.vy, el = Math.hypot(ex, ey), stp = acc * dt;
    if (el <= stp) { this.vx = tvx; this.vy = tvy; } else { this.vx += ex / el * stp; this.vy += ey / el * stp; }
    // ---- jump: buffered for a moment before landing and forgiving for a moment after leaving a ledge ----
    this.jumpBuf -= dt; this.coyote = this.grounded ? 0.1 : this.coyote - dt;
    if (this.jumpBuf > 0 && this.coyote > 0) { this.vz = 5.7; this.grounded = false; this.coyote = 0; this.jumpBuf = 0; this.crouch = false; Sound.jump(); }
    // ---- move and collide; the feet height lets you hop onto low cover and stand on it ----
    this.x = Math.max(this.r, Math.min(FW - this.r, this.x + this.vx * dt));
    this.y = Math.max(this.r, Math.min(FH - this.r, this.y + this.vy * dt));
    const x0 = this.x, y0 = this.y;
    pushOut(this, this.r, null, this.fy + (this.grounded ? 0 : 0.55));   // in the air you can get over cover up to ~0.8 m above your feet
    if (this.x !== x0 || this.y !== y0) {                           // hit something: lose the speed that was pushing into it
      const nx = this.x - x0, ny = this.y - y0, nl = Math.hypot(nx, ny) || 1, dot = (this.vx * nx + this.vy * ny) / nl;
      if (dot < 0) { this.vx -= nx / nl * dot; this.vy -= ny / nl * dot; }
    }
    const floor = supportH(this.x, this.y, this.fy);
    if (this.grounded) { if (floor < this.fy - 0.12) this.grounded = false; else this.fy = floor; }
    if (!this.grounded) {
      this.vz -= 17 * dt; this.fy += this.vz * dt;
      if (this.fy <= floor && this.vz <= 0) {
        const imp = -this.vz; this.fy = floor; this.vz = 0; this.grounded = true;
        if (imp > 3.2) { shake = Math.max(shake, imp * 0.9); Sound.land(imp); this.vx *= 0.75; this.vy *= 0.75; }
      }
    }
    this.airK += ((this.grounded ? 0 : 1) - this.airK) * Math.min(1, dt * 12);
    const sp = Math.hypot(this.vx, this.vy);
    this.speedNow = sp; this.back = sp > 20 && (this.vx * fdx + this.vy * fdy) < -0.3 * sp;
    this.angle = aimAngle;
    const tgt = this.sprinting ? Math.atan2(this.vy, this.vx) : aimAngle;      // while sprinting the body faces the way you run
    let dA = tgt - this.faceAngle; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); this.faceAngle += dA * Math.min(1, dt * (this.sprinting ? 10 : 18));
    // ---- footsteps, by surface ----
    if (this.grounded && sp > 20) {
      this.stepD = (this.stepD || 0) + sp * dt; const every = this.sprinting ? 52 : this.crouch ? 30 : 38;
      if (this.stepD >= every) { this.stepD = 0; Sound.step(surfaceAt(this.x, this.y), this.sprinting ? 1.3 : this.crouch ? 0.4 : 0.9); }
    } else this.stepD = 30;
    // ---- accuracy: the cone widens when moving, jumping or sprinting and tightens when still or crouched; firing adds bloom ----
    const w = this.weapon, still = sp < 12;
    const mult = !this.grounded ? 2.8 : this.sprinting ? 2.4 : this.crouch ? (still ? 0.5 : 0.9) : still ? 0.8 : 1.4;
    const aimK = (this.gs.att.side ? 0.8 : 1) * (this.zoom ? 0.55 : 1);
    this.spreadNow += (w.spread * mult * aimK + this.bloom - this.spreadNow) * Math.min(1, dt * 12);
    this.bloom = Math.max(0, this.bloom - w.spread * 1.4 * dt); this.recoil = Math.max(0, this.recoil - dt * 0.4);
    this.cool -= dt; this.hurt -= dt;
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { const take = Math.min(this.magSize - this.ammo, this.gs.res); this.ammo += take; this.gs.res -= take; }
    } else if (firing && this.cool <= 0 && !this.sprinting && this.swapT <= 0 && !this.heal) {
      if (this.ammo > 0) this.shoot();
      else if (this.gs.res > 0) this.reloadStart();
      else { this.cool = 0.4; Sound.dry && Sound.dry(); if (!this.dryNote || this.dryNote < performance.now() - 1500) { notify('Out of ammo - find an ammo crate or switch weapon'); this.dryNote = performance.now(); } }
    }
    this.swapT -= dt; if (this.sprinting || this.driving) this.zoom = false;
    this.healUpdate(dt);
  }
  switchTo(i) {
    if (i === this.weaponIdx) return;
    if (!this.guns[i]) { notify(`${WEAPONS[i].name} not found yet`); return; }
    this.weaponIdx = i; this.reloading = 0; this.zoom = false; this.swapT = 0.3; this.cool = 0.2; Sound.cloth();
  }
  nextWeapon() { for (let k = 1; k <= WEAPONS.length; k++) { const i = (this.weaponIdx + k) % WEAPONS.length; if (this.guns[i]) return this.switchTo(i); } }
  dash() {
    if (this.dashCool > 0) return;
    this.dashT = 0.16; this.dashCool = this.ch.dashCool; Sound.dash();
  }
  shoot() {
    const w = this.weapon, att = this.gs.att, sil = att.muzzle, dmgK = sil ? 0.9 : 1;
    for (let i = 0; i < w.pellets; i++) {
      const a = this.angle + (Math.random() - 0.5) * 2 * this.spreadNow;
      bullets.push({ x: this.x + Math.cos(a) * 20, y: this.y + Math.sin(a) * 20,
        vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, dmg: w.dmg * this.dmgMul * dmgK, life: 1 });
    }
    this.cool = w.rate * this.rateMul; this.ammo--; shake = Math.max(shake, sil ? 1.5 : w.snd === 'sniperShot' ? 6 : 3); if (sil) Sound.suppressed(); else Sound[w.snd]();
    this.bloom = Math.min(w.spread, this.bloom + w.spread * 0.16); this.recoil = Math.min(0.14, this.recoil + (w.pellets > 1 ? 0.05 : 0.012));
  }
  throwGrenade() {
    if (this.grenades <= 0) return;
    this.grenades--; Sound.grenadeThrow();
    const d = Math.max(120, Math.min(380, Math.hypot(aim.x - this.x, aim.y - this.y)));
    grenades.push({ x: this.x, y: this.y, vx: Math.cos(this.angle) * 340, vy: Math.sin(this.angle) * 340, t: d / 340, t0: d / 340 });
  }
  damage(n) {
    if (this.dashT > 0) return;
    if (this.driving) n *= 0.35;
    if (this.armor > 0) { const ab = Math.min(this.armor, n * 0.6); this.armor -= ab; n -= ab; if (this.armor <= 0) { this.armor = 0; notify('Armor destroyed'); } Sound.impact && Sound.impact(this.x, this.y, 'metal'); }
    if (n > 0 && !this.driving) bloodFx(this.x, this.y, Math.cos(this.angle), Math.sin(this.angle), 4, 0);
    this.hp -= n; this.hurt = 0.15; this.sinceHit = 0; shake = Math.max(shake, 6); Sound.hurt();
    if (n >= 7 && Math.random() < Math.min(0.85, 0.25 + n / 40)) { if (this.bleed <= 0) notify('You are bleeding! Use a bandage (H)'); this.bleed = Math.min(14, this.bleed + 5 + n / 6); }   // bigger hits bleed longer
    if (this.heal && n > 0) this.heal.t = Math.max(0, this.heal.t - 0.35);             // being hit disturbs treatment
    if (this.hp <= 0) gameOver();
  }
  startHeal(kind) {
    if (this.heal || this.driving || this.enter || state !== 'playing') return;
    if (kind === 'band') { if (this.bandages <= 0) return notify('No bandages'); if (this.hp >= this.maxHp && this.bleed <= 0) return notify('You are not hurt'); this.heal = { kind, t: 2.2, dur: 2.2 }; }
    else { if (this.medkits <= 0) return notify('No medkits'); if (this.hp >= this.maxHp && this.bleed <= 0) return notify('You are not hurt'); this.heal = { kind, t: 4.5, dur: 4.5 }; }
    this.zoom = false; Sound.cloth();
  }
  healUpdate(dt) {
    if (this.bleed > 0) { this.bleed -= dt; this.hp -= 1.6 * dt; if (this.hp <= 0) { this.hp = 0; gameOver(); return; } if (Math.random() < dt * 3 && state === 'playing') { const a = Math.random() * 6.283; particles.push({ x: this.x + Math.cos(a) * 8, y: this.y + Math.sin(a) * 8, vx: 0, vy: 0, life: 0.5, color: '#a01010', h: 0.8, vh: -1 }); } }
    this.sinceHit += dt;
    if (this.sinceHit > 10 && this.hp < this.maxHp * 0.25 && !this.heal) this.hp = Math.min(this.maxHp * 0.25, this.hp + 1.5 * dt);   // you catch your breath, but only up to a quarter of your health
    if (this.hp < this.maxHp * 0.3) { this.beat -= dt; if (this.beat <= 0) { this.beat = 0.5 + 0.7 * (this.hp / (this.maxHp * 0.3)); Sound.heartbeat(); } }
    const h = this.heal; if (!h) return;
    h.t -= dt; this.hp = Math.min(this.maxHp, this.hp + (h.kind === 'band' ? 14 : 55) / h.dur * dt);
    if (h.t <= 0) {
      if (h.kind === 'band') { this.bandages--; this.bleed = 0; notify('Bleeding stopped'); } else { this.medkits--; this.bleed = 0; this.hp = Math.min(this.maxHp, this.hp + 10); notify('Medkit used'); }
      this.heal = null;
    }
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
  const valid = (x, y) => x > 40 && x < FW - 40 && y > 40 && y < FH - 40 && pointFree(x, y, t.r + 8) && !buildingAt(x, y) && Math.hypot(x - player.x, y - player.y) >= 520;
  let x = 0, y = 0, ok = false;
  for (let tries = 0; tries < 30 && !ok; tries++) {       // appear 30-45 m away, never inside a building or on top of cover
    const a = Math.random() * 6.283, d = type === 'boss' ? 800 : rnd(620, 860);
    x = clampN(player.x + Math.cos(a) * d, 60, FW - 60); y = clampN(player.y + Math.sin(a) * d, 60, FH - 60); ok = valid(x, y);
  }
  for (let k = 0; k < 80 && !ok && roads.length; k++) { const p = pick(pick(roads).pts); x = p.x; y = p.y; ok = valid(x, y); }   // tight streets: fall back to a street
  const hp = type === 'boss' ? t.hp + wave * 5 : t.hp + Math.floor(wave / 4);
  const e = { ...t, type, x, y, hp, maxHp: hp, cool: Math.random() * (t.rate || 1), flash: 0, side: Math.random() < 0.5 ? 1 : -1, stuck: 0 };
  e.mesh = makeEnemyMesh(e); scene.add(e.mesh);
  enemies.push(e);
  if (type === 'boss') { boss = e; Sound.bossRoar(); }
}

function start() {
  if (!ready || mapBusy) return;
  Sound.engineOff(); Sound.ui(); playerBuilding = null;
  look.yaw = -Math.PI / 2; look.pitch = 0.14; tryLock();
  if (player) removeMesh(player.mesh);
  for (const e of enemies) removeMesh(e.mesh);
  generateMap();
  player = new Player(CHARACTERS[selectedChar]);
  bullets = []; enemyBullets = []; enemies = []; pickups = []; particles = []; grenades = []; boss = null;
  score = 0; wave = 0; kills = 0; shake = 0; waveDelay = 0; spawnTimer = 0; enemiesToSpawn = 0;
  clearDecals(); resetDestruct(); killcam = null; killcamCool = 0;
  state = 'playing'; nextWave();
}
const randAtt = () => pick(Object.keys(ATTS)), randWpn = () => { const w = WEAPONS.map((_, i) => i).filter(i => !player.guns[i]); return w.length ? pick(w) : rnd(0, 1) < 0.5 ? 1 : 3; };
function dropCrates() {                                 // loot lying around the field at the start of every wave
  const spots = [];
  for (let k = 0; k < 60 && spots.length < 4; k++) {
    const a = Math.random() * 6.283, d = rnd(180, 560), x = clampN(player.x + Math.cos(a) * d, 60, FW - 60), y = clampN(player.y + Math.sin(a) * d, 60, FH - 60);
    if (pointFree(x, y, 16) && !buildingAt(x, y)) spots.push({ x, y });
  }
  const kinds = [{ kind: 'wpn', w: randWpn() }, { kind: 'att', a: randAtt() }, { kind: 'ammo' }, { kind: pick(['med', 'armor', 'band']) }];
  if (wave === 1) kinds[0] = { kind: 'wpn', w: 3 };
  spots.forEach((p, i) => pickups.push({ ...p, ...kinds[i] }));
  if (spots.length) notify('Loot crates dropped nearby - check the radar');
  if (wave > 1 && wave % 2 === 0 && spots.length > 1) pickups.push({ x: spots[1].x + 24, y: spots[1].y, kind: 'armor' });
}
function nextWave() {
  wave++; enemiesToSpawn = 5 + wave * 3; waveDelay = 0; Sound.wave(); dropCrates();
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
  state = 'over'; Sound.engineOff(); Sound.death(); Sound.skid(0); Sound.horn(false);
  if (score > best) { best = score; try { localStorage.setItem('war3d-best', best); } catch (e) {} }
}

function boom(x, y, color, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = 40 + Math.random() * 160;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, color, h: 0.3 + Math.random(), vh: 1 + Math.random() * 4 });
  }
}
// Impact and blood particles. Directions are the bullet's travel (vx, vy); debris sprays back towards the shooter.
const METAL = ['vehicle', 'barrel', 'barrier', 'container', 'tower'], WOOD = ['door', 'fence', 'furn', 'furnTall', 'crate', 'plank'];
function spray(x, y, h, n, cols, spd, life, o = {}) {
  const l = Math.hypot(o.dx || 0, o.dy || 0) || 1, bx = o.dx ? o.dx / l : 0, by = o.dy ? o.dy / l : 0, cone = o.cone === undefined ? 1.1 : o.cone;
  for (let i = 0; i < n; i++) {
    const a = o.dx ? Math.atan2(by, bx) + (Math.random() - 0.5) * cone : Math.random() * 6.28, s = spd * (0.35 + Math.random() * 0.65);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), color: pick(cols), h: h + (Math.random() - 0.5) * 0.3, vh: (o.up === undefined ? 2 : o.up) * (0.4 + Math.random()), g: o.g, drag: o.drag });
  }
}
function impactFx(x, y, kind, vx, vy) {
  const dx = -vx, dy = -vy, h = 1.1;
  if (METAL.includes(kind)) { spray(x, y, h, 9, ['#fff1b0', '#ffc54a', '#ff9a2a'], 330, 0.3, { dx, dy, up: 1.5 }); spray(x, y, h, 3, ['#777', '#999'], 40, 0.7, { dx, dy, up: 1.2, g: -1, drag: 2 }); }
  else if (WOOD.includes(kind)) { spray(x, y, h, 8, ['#a0723f', '#c89a62', '#7a5430'], 220, 0.5, { dx, dy, up: 2.5 }); spray(x, y, h, 3, ['#b9a98f'], 40, 0.6, { dx, dy, g: -0.5, drag: 2 }); }
  else { spray(x, y, h, 6, ['#c9bda5', '#b0a58f', '#8e8573'], 160, 0.55, { dx, dy, up: 1.5, drag: 1.5 }); spray(x, y, h, 4, ['#d8d0c0', '#bdb5a5'], 35, 0.9, { dx, dy, up: 0.8, g: -0.8, drag: 2.5 }); }
}
function bloodFx(x, y, vx, vy, n, splat) {
  spray(x, y, 1.15, n, ['#9a0d0d', '#c01818', '#6e0808'], 200, 0.6, { dx: vx, dy: vy, cone: 1.0, up: 2.5, g: 14, drag: 0.6 });
  if (splat) { const l = Math.hypot(vx, vy) || 1; for (let i = 0; i < splat; i++) addBlood(x + vx / l * (12 + Math.random() * 45) + (Math.random() - 0.5) * 20, y + vy / l * (12 + Math.random() * 45) + (Math.random() - 0.5) * 20, 0.35 + Math.random() * 0.5); }
}
function tryKillcam(e) {
  if (!killcamOn || killcam || killcamCool > 0 || player.driving || state !== 'playing') return;
  const d = Math.hypot(e.x - player.x, e.y - player.y), last = enemies.every(o => o === e || o.hp <= 0) && enemiesToSpawn <= 0;
  if (!(d > 480 || e.type === 'boss' || e.type === 'tank' || last)) return;
  const h = e.lastHit, az = h ? Math.atan2(h.vy, h.vx) + 2.4 : Math.random() * 6.28;
  killcam = { e: { x: e.x, y: e.y }, t: 0, dur: 1.6, az, d: Math.round(d / U), w: player.weapon.name, big: e.type === 'boss' || e.type === 'tank' };
  killcamCool = 8; Sound.killcam && Sound.killcam();
}
function fire(e, angle, speed, dmg) {
  e.mflash = 0.09; Sound.enemyShot(e.x, e.y, e.type);
  enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 3, dmg });
}
function explode(g) {
  const R = 95;
  boom(g.x, g.y, '#fa3', 40); boom(g.x, g.y, '#888', 20); addScorch(g.x, g.y, 4.5); blastWorld(g.x, g.y, R, 12); spray(g.x, g.y, 0.6, 16, ['#6a625a', '#8a8278'], 110, 1.3, { up: 3, g: -1, drag: 1.2 }); shake = 14; Sound.boom(g.x, g.y);
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
    Sound.engineOn(); Sound.engineSet(Math.abs(v.speed) / v.T.max, v.thr || 0);
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
    if (e.speedNow > 0 && e.type !== 'tank' && e.type !== 'boss') { e.stepD = (e.stepD || 0) + e.speedNow * dt; if (e.stepD > 40) { e.stepD = 0; if (Math.hypot(e.x - player.x, e.y - player.y) < 1100) Sound.enemyStep(e.x, e.y, buildingAt(e.x, e.y) ? 'concrete' : 'grass'); } }
    e.flash -= dt; e.angle = Math.atan2(dy, dx); e.speedNow = 0; e.mflash = (e.mflash || 0) - dt;
    if (!e.shoots || wp || d > e.range * ENV.vis * 0.6) {
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
      if (e.cool <= 0 && d < e.range * ENV.vis && (onScreen(e.x, e.y) || d < 360)) {
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
        e.hp -= b.dmg; b.life = 0; e.flash = 0.06; e.lastHit = { vx: b.vx, vy: b.vy };
        if (e.type === 'tank' || e.type === 'boss') { spray(b.x, b.y, 1.2, 7, ['#fff1b0', '#ffc54a'], 300, 0.3, { dx: -b.vx, dy: -b.vy, up: 1.5 }); addBulletHole(b.x - b.vx * 0.004, b.y - b.vy * 0.004, b.vx, b.vy, 'vehicle'); }
        else bloodFx(b.x, b.y, b.vx, b.vy, 5 + Math.round(b.dmg * 3), 1);
        Sound.hitEnemy(e.x, e.y, e.type);
      }
    }
  }
  for (const b of enemyBullets) {
    if (!b.whizzed && b.life > 0 && !player.driving && Math.hypot(b.x - player.x, b.y - player.y) < 55) { b.whizzed = true; Sound.whiz(b.x, b.y); }
    if (player.driving) { if (b.life > 0 && inOBB(player.driving, b.x, b.y)) { b.life = 0; damageVehicle(player.driving, b.dmg * 0.8); boom(b.x, b.y, '#fa6', 3); Sound.impact(b.x, b.y, 'vehicle'); } }
    else if (b.life > 0 && Math.hypot(b.x - player.x, b.y - player.y) < player.r + 3) {
      b.life = 0; player.damage(b.dmg);
    }
  }

  for (const e of enemies) {
    if (e.hp <= 0 && !e.counted) {
      e.counted = true; kills++; score += e.score; removeMesh(e.mesh);
      boom(e.x, e.y, e.color, e.r > 20 ? 40 : 14);
      if (e.r > 20) { addScorch(e.x, e.y, 5); spray(e.x, e.y, 1, 16, ['#fff1b0', '#ffc54a', '#ff8a2a'], 300, 0.5, { up: 4 }); }
      else { addBlood(e.x, e.y, 1.1 + Math.random() * 0.4); const h = e.lastHit; bloodFx(e.x, e.y, h ? h.vx : 1, h ? h.vy : 0, 14, 2); }
      tryKillcam(e);
      if (e.r > 20) { shake = 12; Sound.boom(e.x, e.y, 0.9); }
      if (e.type === 'boss') { pickups.push({ x: e.x, y: e.y, kind: 'hp' }, { x: e.x + 30, y: e.y, kind: 'ammo' }, { x: e.x - 30, y: e.y, kind: 'att', a: randAtt() }, { x: e.x, y: e.y + 30, kind: 'wpn', w: randWpn() }, { x: e.x + 30, y: e.y + 30, kind: 'med' }, { x: e.x - 30, y: e.y + 30, kind: 'armor' }); boss = null; }
      else if (Math.random() < 0.28) {
        const r = Math.random();
        const k = r < 0.18 ? 'band' : r < 0.26 ? 'med' : r < 0.34 ? 'armor' : r < 0.5 ? 'hp' : r < 0.68 ? 'ammo' : r < 0.76 ? 'gren' : r < 0.89 ? 'wpn' : 'att';
        pickups.push({ x: e.x, y: e.y, kind: k, w: k === 'wpn' ? randWpn() : undefined, a: k === 'att' ? randAtt() : undefined });
      }
    }
  }
  enemies = enemies.filter(e => e.hp > 0);

  for (const p of pickups) {
    if (Math.hypot(p.x - player.x, p.y - player.y) < player.r + 10) {
      p.got = true; Sound.pickup();
      if (p.kind === 'hp') player.hp = Math.min(player.maxHp, player.hp + 25);
      else if (p.kind === 'gren') player.grenades += 2;
      else if (p.kind === 'band') { player.bandages += 2; notify('Bandages +2  (H to use)'); }
      else if (p.kind === 'med') { player.medkits += 1; notify('Medkit +1  (J to use)'); }
      else if (p.kind === 'armor') { player.armor = Math.min(100, player.armor + 50); notify('Armor vest +50'); }
      else if (p.kind === 'wpn') player.giveWeapon(p.w);
      else if (p.kind === 'att') { player.attInv[p.a]++; notify(`Found ${ATTS[p.a].name} - press B to fit it`); }
      else player.giveAmmo();
    }
  }
  pickups = pickups.filter(p => !p.got);

  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.h = Math.max(0.05, p.h + p.vh * dt); p.vh -= (p.g === undefined ? 12 : p.g) * dt; if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; } }
  particles = particles.filter(p => p.life > 0);
  const inb = b => b.life > 0 && b.x > -20 && b.x < FW + 20 && b.y > -20 && b.y < FH + 20;
  const alive = (b, fromEnemy) => {
    if (!inb(b)) return false;
    if (bulletBlocked(b.x, b.y) || bulletBlocked(b.x - b.vx * dt / 2, b.y - b.vy * dt / 2)) {
      const kind = lastHitKind; let hx = b.x, hy = b.y;
      for (let i = 0; i < 10 && bulletBlocked(hx, hy); i++) { hx -= b.vx * dt / 10; hy -= b.vy * dt / 10; }      // back up to the surface the bullet struck
      const obs = lastHitObs; lastHitKind = kind;
      if (obs && obs.hp && !obs.gone) damageObstacle(obs, fromEnemy ? 1 : b.dmg);          // crates, plank walls and barrels take damage
      else if (kind === 'wall') hitWindowAt(hx, hy);                                      // a bullet that strikes a pane breaks it
      addBulletHole(hx, hy, b.vx, b.vy, kind); impactFx(hx, hy, kind, b.vx, b.vy); Sound.impact(b.x, b.y, kind); return false;
    }
    return true;
  };
  bullets = bullets.filter(b => alive(b, false));
  enemyBullets = enemyBullets.filter(b => alive(b, true));
  updateDestruct(dt);
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
  else t.b.door.manual = !t.b.door.manual;
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
  ctx.fillStyle = '#122'; ctx.fillRect(15, 31, 200, 6); ctx.fillStyle = '#5ad'; ctx.fillRect(15, 31, 200 * player.armor / 100, 6);
  if (player.armor > 0) text(`ARMOR ${Math.ceil(player.armor)}`, 220, 37, 10, 'left', '#8cf');
  ctx.fillStyle = '#123'; ctx.fillRect(15, 39, 200, 4); ctx.fillStyle = player.staminaLock > 0 ? '#c84' : '#5bd'; ctx.fillRect(15, 39, 200 * player.stamina / 100, 4);
  text(`${player.ch.name}${player.crouch ? ' (crouched)' : player.sprinting ? ' (sprint)' : !player.grounded ? ' (air)' : ''}   Score ${score}   Best ${best}`, 15, 60);
  if (player.bleed > 0) text(`BLEEDING ${player.bleed.toFixed(0)}s`, 15, 78, 14, 'left', Math.sin(performance.now() / 150) > 0 ? '#ff4040' : '#a02020');
  text(`Wave ${wave}`, W - 15, 28, 16, 'right');
  text(`${fmtTime()}  ${WEATHERS[WX.name].label}`, W - 15, 112, 12, 'right', '#cdd8c0');
  if (ENV.night > 0.5 && !player.torch && !player.driving) text('[L] flashlight', W - 15, 128, 11, 'right', '#cc9');
  const w = player.weapon;
  if (player.driving) {
    const v = player.driving;
    text(`${Math.round(Math.abs(v.speed) / U * 3.6)} km/h`, W - 15, 50, 22, 'right');
    ctx.fillStyle = '#222'; ctx.fillRect(W - 215, 62, 200, 10); ctx.fillStyle = v.hp > v.maxHp * 0.3 ? '#3c9' : '#e83'; ctx.fillRect(W - 215, 62, 200 * Math.max(0, v.hp) / v.maxHp, 10);
    text('Vehicle', W - 220, 71, 11, 'right', '#cdb');
  } else {
  text(`${w.name}  ${player.reloading > 0 ? 'RELOADING' : player.ammo + ' / ' + player.gs.res}`, W - 15, 50, 16, 'right');
  text(`Grenades ${player.grenades}   Dash ${player.dashCool > 0 ? player.dashCool.toFixed(1) + 's' : 'READY'}`, W - 15, 72, 14, 'right', '#cdb');
  }
  if (!touch.on) text(player.driving ? 'W/S gas and brake · A/D steer · Space handbrake · F get out · mouse look' : 'WASD move · Shift sprint · Space jump · C crouch · V dash · mouse look · LMB shoot · RMB/G grenade · R reload · 1-4 weapon · Z zoom · B gunsmith · K killcam · L light · O weather · I time · H bandage · J medkit · F open doors / enter vehicles · M mute · N music · P pause (Esc frees mouse)', W / 2, H - 10, 11, 'center', '#cdb');
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
  const mb = mapBar(), hov = overMapBar();
  ctx.fillStyle = hov ? '#3c4a2e' : '#262f1e'; ctx.fillRect(mb.x, mb.y, mb.w, mb.h); ctx.strokeStyle = '#9ab07a'; ctx.strokeRect(mb.x, mb.y, mb.w, mb.h);
  text('Map: ' + MAP_LIST.find(m => m[0] === selectedMap)[1] + '   (T or click to change)', W / 2, mb.y + 21, 13, 'center', '#dfe8c8');
  if (REAL_MAPS[selectedMap]) text(selectedMap === 'prague' ? 'Map data: Prague-Bubeneč sample dataset (momepy, BSD-3)' : 'Map data: © OpenStreetMap contributors (ODbL)', W / 2, H - 12, 10, 'center', 'rgba(230,240,210,0.55)');
  if (mapBusy) { ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H); text('Building the map...', W / 2, H / 2, 26, 'center', '#ee8'); }
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

function drawKillcam() {                                 // letterbox bars, label and a slight tint while the cutaway plays
  const k = killcam, t = k.t / k.dur, bar = 58 * Math.min(1, t * 8, (1 - t) * 8 + 0.0);
  ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
  if (bar > 40) { text('KILLCAM', 24, H - bar + 36, 22, 'left', '#ff6a50'); text(`${k.w}  ·  ${k.d} m${k.big ? '  ·  HEAVY TARGET' : ''}`, W - 24, H - bar + 36, 16, 'right', '#eee'); }
  ctx.fillStyle = 'rgba(255,60,40,0.06)'; ctx.fillRect(0, 0, W, H);
}
function drawHealth() {                                  // low-health / bleeding vignette, supplies and treatment progress
  const hpK = player.hp / player.maxHp, low = clampN((0.35 - hpK) / 0.35, 0, 1), a = Math.max(low * (0.55 + 0.15 * Math.sin(performance.now() / 220)), player.bleed > 0 ? 0.22 : 0, player.hurt > 0 ? 0.35 : 0);
  if (a > 0.02) { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85); g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  text(`[H] Bandage x${player.bandages}   [J] Medkit x${player.medkits}`, W / 2 + 190, H - 40, 12, 'left', player.bandages + player.medkits ? '#9e9' : '#777');
  const h = player.heal; if (h) {
    const x = W / 2 - 90, y = H / 2 + 70, k = 1 - h.t / h.dur;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 4, y - 22, 188, 40); ctx.fillStyle = '#244'; ctx.fillRect(x, y, 180, 8); ctx.fillStyle = '#4e8'; ctx.fillRect(x, y, 180 * k, 8);
    text(h.kind === 'band' ? 'Applying bandage...' : 'Using medkit...', W / 2, y - 6, 12, 'center', '#9fc');
  }
}
function drawWeaponBar() {                              // slots 1-4 along the bottom, with the fitted attachments
  const x0 = W / 2 - 2 * 74;
  WEAPONS.forEach((w, i) => {
    const x = x0 + i * 74, own = !!player.guns[i], cur = i === player.weaponIdx;
    ctx.fillStyle = cur ? 'rgba(80,110,50,0.8)' : 'rgba(0,0,0,0.45)'; ctx.fillRect(x, H - 62, 68, 34);
    ctx.strokeStyle = cur ? '#ee8' : 'rgba(255,255,255,0.3)'; ctx.strokeRect(x, H - 62, 68, 34);
    text(`${i + 1}`, x + 6, H - 50, 10, 'left', cur ? '#ee8' : '#9a9');
    text(w.name, x + 34, H - 46, 12, 'center', own ? '#fff' : '#666');
    if (own) { const a = player.guns[i].att; text(['optic', 'muzzle', 'mag', 'side'].map((k, j) => a[k] ? 'SMXL'[j] : '').join(''), x + 34, H - 33, 10, 'center', '#c9f'); }
  });
  const inv = Object.keys(ATTS).reduce((n, k) => n + player.attInv[k], 0);
  if (inv) text(`${inv} attachment${inv > 1 ? 's' : ''} in bag - press B`, W / 2, H - 70, 12, 'center', '#c9f');
  if (toast.t > 0) { ctx.globalAlpha = Math.min(1, toast.t); text(toast.text, W / 2, 96, 15, 'center', '#ee8'); ctx.globalAlpha = 1; }
}
function drawScope() {                                  // dark vignette ring while zoomed through an optic
  const k = player.zoomK; if (k < 0.15) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.3);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(W / 2 - 160, H / 2); ctx.lineTo(W / 2 - 10, H / 2); ctx.moveTo(W / 2 + 10, H / 2); ctx.lineTo(W / 2 + 160, H / 2); ctx.moveTo(W / 2, H / 2 - 160); ctx.lineTo(W / 2, H / 2 - 10); ctx.moveTo(W / 2, H / 2 + 10); ctx.lineTo(W / 2, H / 2 + 160); ctx.stroke();
  ctx.restore();
}

// ---------- Gunsmith (B): fit attachments to the weapons you carry ----------
let smithOpen = false;
function openSmith() { if (state !== 'playing' || player.driving || player.enter) return; state = 'gunsmith'; mouse.down = false; }
function closeSmith() { state = 'playing'; tryLock(); }
const smithRect = { gun: i => [60, 150 + i * 62, 230, 52], slot: j => [330, 170 + j * 82, 520, 70], done: [W / 2 - 70, H - 70, 140, 40] };
const hit = r => mouse.x >= r[0] && mouse.x <= r[0] + r[2] && mouse.y >= r[1] && mouse.y <= r[1] + r[3];
function clickSmith() {
  if (hit(smithRect.done)) return closeSmith();
  WEAPONS.forEach((_, i) => { if (player.guns[i] && hit(smithRect.gun(i))) { player.weaponIdx = i; player.reloading = 0; player.zoom = false; Sound.ui(); } });
  SLOTS.forEach((sl, j) => { if (hit(smithRect.slot(j))) { player.fit(sl); Sound.ui(); } });
}
function drawSmith() {
  ctx.fillStyle = 'rgba(8,12,6,0.88)'; ctx.fillRect(0, 0, W, H);
  text('GUNSMITH', W / 2, 70, 36, 'center'); text('Select a weapon (1-4 or click). Click a slot or press A / S / D / F to fit or remove. B or Enter to close.', W / 2, 100, 13, 'center', '#cdb');
  WEAPONS.forEach((w, i) => {
    const r = smithRect.gun(i), own = !!player.guns[i], cur = i === player.weaponIdx;
    ctx.fillStyle = cur ? '#4a5a3a' : hit(r) && own ? '#38442c' : '#222a1a'; ctx.fillRect(...r); ctx.strokeStyle = cur ? '#ee8' : '#555'; ctx.strokeRect(...r);
    text(`[${i + 1}] ${w.name}`, r[0] + 14, r[1] + 22, 17, 'left', own ? '#fff' : '#666');
    text(own ? `${player.guns[i].ammo} + ${player.guns[i].res} rounds` : 'not found yet', r[0] + 14, r[1] + 41, 12, 'left', own ? '#cdb' : '#666');
  });
  const w = player.weapon, a = player.gs.att;
  text(`${w.name}   mag ${player.magSize}   damage ${(w.dmg * player.dmgMul * (a.muzzle ? 0.9 : 1)).toFixed(1)}`, 330, 150, 16, 'left', '#ee8');
  SLOTS.forEach((sl, j) => {
    const r = smithRect.slot(j), key = SLOT_ATT[sl], at = ATTS[key], on = !!a[sl], have = player.attInv[key], locked = sl === 'optic' && w.scoped;
    ctx.fillStyle = on ? '#3a4e5e' : hit(r) && (have || on) ? '#38442c' : '#222a1a'; ctx.fillRect(...r); ctx.strokeStyle = on ? '#7cf' : '#555'; ctx.strokeRect(...r);
    text(`[${'ASDF'[j]}]  ${at.name}`, r[0] + 16, r[1] + 28, 18, 'left', locked ? '#888' : '#fff');
    text(locked ? 'Built-in scope (Z to zoom)' : at.desc, r[0] + 16, r[1] + 52, 13, 'left', '#cdb');
    text(locked ? 'BUILT-IN' : on ? 'FITTED - click to remove' : have ? `${have} in bag - click to fit` : 'none found', r[0] + r[2] - 14, r[1] + 28, 13, 'right', on ? '#7cf' : have ? '#ee8' : '#777');
  });
  const r = smithRect.done; ctx.fillStyle = hit(r) ? '#5a6a4a' : '#3a4a2a'; ctx.fillRect(...r); ctx.strokeStyle = '#ee8'; ctx.strokeRect(...r); text('DONE', W / 2, r[1] + 26, 18, 'center');
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
  if (state === 'playing' || state === 'paused') { drawRadar(); if (!player.driving && !killcam) drawCrosshair(); }
  if (state === 'playing' && !player.driving && !killcam) drawScope();
  if (killcam && state === 'playing') drawKillcam();
  if (state === 'playing') drawPrompt();
  if (state === 'playing' || state === 'paused') { drawHealth(); drawWeaponBar(); }
  if (state === 'gunsmith') drawSmith();
  drawTouch();
  if (state === 'menu') overlay('WAR 3D', 'Survive the waves. Beat the bosses.', 'Pick a soldier to begin', true);
  if (state === 'over') overlay('GAME OVER', `Score ${score} · Wave ${wave} · Kills ${kills} · Best ${best}`, 'Pick a soldier to play again', true);
  if (state === 'paused') overlay('PAUSED', '', touch.on ? 'Tap II to resume' : 'Click or press P to resume');
  if (state === 'upgrade') drawUpgrade();
}

let last = performance.now(), frameDt = 0.016, ready = false, loadError = '';
function loop(t) {
  const rdt = Math.min(0.05, (t - last) / 1000); last = t; toast.t -= rdt; killcamCool -= rdt;
  if (killcam && (state !== 'playing' || (killcam.t += rdt) >= killcam.dur)) killcam = null;
  const dt = killcam ? rdt * 0.3 : rdt; frameDt = dt;           // killcam = slow motion
  requestAnimationFrame(loop);
  if (!ready) {
    ctx.setTransform(SS, 0, 0, SS, 0, 0); ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#14170f'; ctx.fillRect(0, 0, W, H);
    text(loadError ? 'Could not load: ' + loadError : 'Loading soldier model and building the map...', W / 2, H / 2, 20, 'center', loadError ? '#f88' : '#cdb');
    return;
  }
  if (state !== 'playing') Sound.engineOff();
  if (state !== 'playing' && document.pointerLockElement) document.exitPointerLock();
  updateCamera(rdt); updateAim();
  if (state === 'playing') update(dt);
  Sound.paused = state !== 'playing' && state !== 'menu';
  Sound.update(dt, state === 'playing' ? clampN(enemies.length / 10 + (boss ? 0.4 : 0), 0, 1) : 0.05);
  draw();
}
function boot() {
  player = new Player(CHARACTERS[0]); score = 0; wave = 0; kills = 0; shake = 0; boss = null;
  bullets = []; enemyBullets = []; enemies = []; pickups = []; particles = []; grenades = [];
  generateMap(); player.x = SPAWN.x; player.y = SPAWN.y; player.fy = player.fyVis = floorY(player.x, player.y); makePortraits(); ready = true;
}
setTimeout(() => {
  try {
    const bin = atob(SOLDIER_B64), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer, '', gltf => { HUMAN.gltf = gltf; try { boot(); } catch (e) { loadError = e.message; console.error(e); } }, err => { loadError = String(err && err.message || err); });
  } catch (e) { loadError = e.message; console.error(e); }
}, 40);
requestAnimationFrame(loop);
