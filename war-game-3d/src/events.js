// ---------- Dynamic events: a gunship crashes, the power goes out, a storm closes in, civilians need escorting ----------
const EVT = { cur: null, cool: 50, black: 0, blackTarget: 0, prevWx: null, trail: [], marker: null };
const EVENT_INFO = {
  crash: { title: 'GUNSHIP DOWN', time: 90 },
  blackout: { title: 'POWER CUT', time: 70 },
  storm: { title: 'STORM FRONT', time: 70 },
  escort: { title: 'CIVILIANS IN DANGER', time: 130 },
  raid: { title: 'ARMED TRUCKS', time: 110 },
  boats: { title: 'PATROL BOAT', time: 100 },
};
function evOk() { return (gameMode === 'survival' ? wave >= 2 : gameMode === 'mission' && MS.n >= 2) && !DAILY.on && !(gameMode === 'mission' && (!MS.cur || MS.cur.done || MS.cur.type === 'boss')) && state === 'playing'; }
function resetEvents() {
  endEvent(true); EVT.cool = 45 + Math.random() * 25; EVT.black = EVT.blackTarget = 0;
  if (EVT.marker) EVT.marker.visible = false;
}
function farSpot(from, min) { let z = null; for (let k = 0; k < 12; k++) { z = freeSpot(min, min + 400, from); if (Math.hypot(z.x - from.x, z.y - from.y) >= min * 0.85) return z; } return z; }
function startRandomEvent() {
  const w = { crash: 3, escort: 3, storm: WX.name === 'storm' ? 0 : 2.4, blackout: ENV.night > 0.3 ? 3 : 0, raid: wave >= 4 ? 2.6 : 0, boats: LAKE ? 2.2 : 0 }, last = EVT.last; if (last) w[last] *= 0.25;
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0), pick = 'crash'; for (const k in w) { r -= w[k]; if (r <= 0) { pick = k; break; } }
  startEvent(pick);
}
function startEvent(kind) {
  if (EVT.cur) endEvent(true); const info = EVENT_INFO[kind], ev = EVT.cur = { kind, t: info.time, total: info.time, status: '', done: false, pts: [] }; EVT.last = kind;
  if (kind === 'crash') {
    const s = freeSpot(520, 900); Object.assign(ev, { x: s.x, y: s.y, fall: 2.6, h: 46, mesh: makeHeliMesh({}), loot: false, claimed: false, smokeT: 0 }); worldGroup.add(ev.mesh); ev.mesh.visible = true; ev.fire = new THREE.PointLight(0xff8a30, 0, 26, 1.6); ev.fire.position.set(0, 1.5, 0); ev.mesh.add(ev.fire);
    ev.status = 'A gunship is going down!'; notify('A gunship is going down nearby!'); saidOnce('crash', 'Alpha', 'Gunship down! Look at that smoke!', 8); Sound.alert(player.x, player.y);
  } else if (kind === 'blackout') {
    EVT.blackTarget = 1; for (const b of buildings) { b._lo = b.lightOn; if (b.lampMat) { b.lightOn = false; b.lampMat.emissiveIntensity = 0; } }
    Sound.blackout && Sound.blackout(); ev.status = 'The power is out across the district. Use your flashlight (L). Enemies see less too.'; notify('POWER CUT: the lights have gone out!'); saidOnce('blackout', 'Alpha', "Power's out! Flashlights if you need them.", 8);
  } else if (kind === 'storm') {
    EVT.prevWx = WX.name; setWeather(Math.random() < 0.55 ? 'storm' : 'fog'); WX.timer = 1e9; ev.status = WX.name === 'storm' ? 'A storm front: heavy rain, thunder and poor visibility for everyone.' : 'Thick fog rolls in: poor visibility for everyone.'; notify(WX.name === 'storm' ? 'A storm is closing in!' : 'Fog is rolling in!'); saidOnce('storm', 'Alpha', 'Visibility is dropping fast.', 8);
  } else if (kind === 'escort') {
    const s = freeSpot(520, 850), z = farSpot(s, 700), n = 2 + (Math.random() < 0.5 ? 1 : 0); Object.assign(ev, { x: s.x, y: s.y, zone: { x: z.x, y: z.y, r: 120 }, civs: [], freed: false, saved: 0, lost: 0 });
    const styles = [{ style: 'shirt', shirt: '#c97a3a', pants: '#33353a', head: 'none' }, { style: 'sari', shirt: '#2a8a6a', pants: '#2a8a6a', head: 'none' }, { style: 'kurta', shirt: '#d8d4c8', pants: '#3a3a40', head: 'none' }];
    for (let i = 0; i < n; i++) { const a = i / n * 6.283, c = { x: s.x + Math.cos(a) * 30, y: s.y + Math.sin(a) * 30, hp: 40, angle: 0, moving: false, mesh: makeCivilian(styles[i % 3]), idx: i }; scene.add(c.mesh); ev.civs.push(c); }
    for (let i = 0; i < 3; i++) { const e = addEnemy('soldier', s); e.lastSeen = { x: s.x, y: s.y }; e.seenAge = 0; e.mode = 'search'; }
    EVT.trail = []; ev.status = 'Find the civilians, then lead them to the safe zone'; notify(`${n} civilians are trapped nearby, and gunmen are closing in!`); saidOnce('escort', 'Alpha', 'Civilians under fire! Get to them!', 8);
  }
  else if (kind === 'raid') { const n = wave >= 5 ? 2 : 1; ev.veh = []; for (let i = 0; i < n; i++) ev.veh.push(spawnTechnical()); ev.status = `${n} armed truck${n > 1 ? 's' : ''} hunting you: kill them before they run you over (jeep rockets help)`; }
  else if (kind === 'boats') { const b = spawnPatrolBoat(); if (!b) { EVT.cur = null; EVT.cool = 20; return; } ev.veh = [b]; ev.status = 'A patrol boat is on the water. Take it out or stay off the shore'; }
  EVT.marker = EVT.marker || mkMarker(); if (Sound.stinger) Sound.stinger(kind === 'boats' ? 'raid' : kind);
}
function endEvent(silent, msg) {
  const ev = EVT.cur; if (!ev) return;
  if (ev.mesh) { worldGroup.remove(ev.mesh); ev.mesh = null; }
  if (ev.civs) for (const c of ev.civs) if (c.mesh) { scene.remove(c.mesh); c.mesh = null; }
  if (ev.kind === 'blackout') { EVT.blackTarget = 0; for (const b of buildings) if (b._lo !== undefined) { b.lightOn = b._lo; if (b.lampMat) b.lampMat.emissiveIntensity = b.lightOn ? 0.9 : 0; b._lo = undefined; } if (!silent) { Sound.powerOn && Sound.powerOn(); } }
  if (ev.kind === 'storm' && EVT.prevWx) { setWeather(EVT.prevWx); EVT.prevWx = null; }
  if (EVT.marker) EVT.marker.visible = false;
  EVT.cur = null; EVT.cool = 70 + Math.random() * 50; if (msg) notify(msg);
}
function evPoints() {                                              // objective positions for the radar
  const ev = EVT.cur; if (!ev) return [];
  if (ev.kind === 'crash' && ev.loot && !ev.claimed) return [{ x: ev.x, y: ev.y, col: '#fa4' }];
  if (ev.kind === 'raid' || ev.kind === 'boats') return ev.veh.filter(v => !v.burned).map(v => ({ x: v.x, y: v.y, col: '#f64' }));
  if (ev.kind === 'escort') return ev.freed ? [{ x: ev.zone.x, y: ev.zone.y, col: '#6f6' }] : [{ x: ev.x, y: ev.y, col: '#fd4' }];
  return [];
}
function evCivHit(b) {                                             // enemy bullets that find a civilian
  const ev = EVT.cur; if (!ev || ev.kind !== 'escort') return;
  for (const c of ev.civs) if (c.hp > 0 && b.life > 0 && Math.hypot(b.x - c.x, b.y - c.y) < 11) { c.hp -= b.dmg * 3; b.life = 0; bloodFx(c.x, c.y, b.vx, b.vy, 5, 1); if (c.hp <= 0) { ev.lost++; Sound.panic && Sound.panic(c.x, c.y); notify('A civilian was killed!'); score = Math.max(0, score - 100); } }
}
function updateEvents(dt) {
  EVT.black += (EVT.blackTarget - EVT.black) * Math.min(1, dt * 1.6);
  if (!EVT.cur) { if (evOk()) { EVT.cool -= dt; if (EVT.cool <= 0) startRandomEvent(); } return; }
  const ev = EVT.cur; ev.t -= dt;
  if (ev.kind === 'crash') {
    if (ev.fall > 0) {                                             // the gunship spirals down, then hits the ground
      ev.fall -= dt; const k = Math.max(0, ev.fall / 2.6); ev.h = 46 * k * k; ev.smokeT -= dt; if (ev.smokeT <= 0) { ev.smokeT = 0.05; spray(ev.x, ev.y, ev.h + 1.5, 2, ['#222', '#444'], 15, 2.2, { up: 1, g: -0.4 }); }
      if (ev.fall <= 0) { ev.h = 0; boom(ev.x, ev.y, '#fa3', 50); boom(ev.x, ev.y, '#444', 30); addScorch(ev.x, ev.y, 6); blastWorld(ev.x, ev.y, 100, 8); shake = Math.max(shake, 10); Sound.boom(ev.x, ev.y, 1.3); aiNoise(ev.x, ev.y, 1600); ev.loot = true; ev.status = 'Reach the wreck to salvage its supplies before the enemy does';
        const kinds = [{ kind: 'ammo' }, { kind: 'armor' }, { kind: 'med' }, Math.random() < 0.5 ? { kind: 'wpn', w: randWpn() } : { kind: 'att', a: randAtt() }]; kinds.forEach((k, i) => { const a = i / 4 * 6.283 + 0.6; pickups.push({ x: ev.x + Math.cos(a) * 42, y: ev.y + Math.sin(a) * 42, ...k }); });
        for (let i = 0; i < 3; i++) { const e = addEnemy('soldier', ev); e.lastSeen = { x: ev.x, y: ev.y }; e.seenAge = 0; e.mode = 'search'; } }
    } else {
      ev.smokeT -= dt; if (ev.smokeT <= 0) { ev.smokeT = 0.12; spray(ev.x, ev.y, 1.4, 2, ['#2a2a2a', '#555', '#777'], 14, 3.2, { up: 3, g: -0.5 }); spray(ev.x, ev.y, 0.6, 1, ['#ff8a2a', '#ffd24a'], 25, 0.6, { up: 2 }); }
      if (!ev.claimed && Math.hypot(player.x - ev.x, player.y - ev.y) < 120) { ev.claimed = true; score += 150; ev.status = 'Supplies in reach - grab them!'; notify('Wreck reached: +150'); }
      if (ev.claimed && !pickups.some(p => Math.hypot(p.x - ev.x, p.y - ev.y) < 80)) { endEvent(false, 'Salvage complete'); return; }
    }
  } else if (ev.kind === 'escort') {
    const alive = ev.civs.filter(c => c.hp > 0);
    if (!ev.freed) {
      if (Math.hypot(player.x - ev.x, player.y - ev.y) < 130 && !player.driving) { ev.freed = true; ev.status = 'Lead them to the green safe zone'; notify('Follow me! Get to the safe zone!'); for (const c of ev.civs) c.moving = false; saidOnce('esc2', 'Alpha', 'Civilians with us. Move out!', 8); }
    } else {
      const tr = EVT.trail, last = tr[tr.length - 1]; if (!last || Math.hypot(player.x - last.x, player.y - last.y) > 26) { tr.push({ x: player.x, y: player.y }); if (tr.length > 60) tr.shift(); }
      for (const c of alive) {
        const d = Math.hypot(player.x - c.x, player.y - c.y), tp = tr[Math.max(0, tr.length - 2 - c.idx * 2)] || player; c.moving = false;
        if (d > 70 + c.idx * 20) { const dd = Math.hypot(tp.x - c.x, tp.y - c.y), a = Math.atan2(tp.y - c.y, tp.x - c.x), sp = Math.min(215, 95 + d * 1.2); if (dd > 6) { c.x += Math.cos(a) * Math.min(dd, sp * dt); c.y += Math.sin(a) * Math.min(dd, sp * dt); c.angle = a; c.moving = true; pushOut(c, 8); } }
      }
      const inZone = alive.filter(c => Math.hypot(c.x - ev.zone.x, c.y - ev.zone.y) < ev.zone.r);
      if (alive.length && inZone.length === alive.length && Math.hypot(player.x - ev.zone.x, player.y - ev.zone.y) < ev.zone.r + 60) { const n = alive.length; score += n * 200; player.hp = Math.min(player.maxHp, player.hp + 25); Sound.wave(); endEvent(false, `${n} civilians saved  +${n * 200}`); return; }
    }
    if (!alive.length) { endEvent(false, 'The civilians were lost'); return; }
  } else if (ev.kind === 'raid' || ev.kind === 'boats') {
    if (ev.veh.every(v => v.burned || !vehicles.includes(v))) { score += 100; endEvent(false, 'Threat destroyed  +100'); return; }
  } else if (ev.kind === 'storm') { ev.status = WX.name === 'storm' ? 'Storm: heavy rain and poor visibility for everyone' : 'Fog: poor visibility for everyone'; }
  else if (ev.kind === 'blackout') { ev.status = EVT.black > 0.5 ? 'No power. Flashlight (L) helps; enemies see less too' : 'Power returning'; }
  if (ev.t <= 0) endEvent(false, ev.kind === 'escort' ? 'The civilians were lost' : ev.kind === 'blackout' ? 'Power is back on' : ev.kind === 'storm' ? 'The weather is clearing' : null);
}
function syncEvents(t) {
  const ev = EVT.cur, mk = EVT.marker; if (mk) mk.visible = false; if (!ev) return;
  if (ev.kind === 'crash' && ev.mesh) {
    const m = ev.mesh, fy = floorY(ev.x, ev.y); m.position.set(wx(ev.x), fy + ev.h, wz(ev.y)); m.visible = true;
    if (ev.fire) ev.fire.intensity = (ev.fall > 0 ? 1.5 : 4) * (0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 9));
    if (ev.fall > 0) { m.rotation.set(0.25, t * 7, 0.5); m.userData.rotor.rotation.y += 0.9; } else { m.rotation.set(0.12, 0.7, 0.5); m.position.y = fy + 0.5; }
    if (mk && ev.loot && !ev.claimed) setMarker(mk, ev.x, ev.y, 70, 0xffa040, true);
  } else if (ev.kind === 'escort') {
    for (const c of ev.civs) { if (!c.mesh) continue; const m = c.mesh; m.visible = c.hp > 0; m.position.set(wx(c.x), floorY(c.x, c.y), wz(c.y)); m.rotation.y = -c.angle; updateHuman(m, 0.016, c.moving ? 130 : 0, false, c.hp > 0 && !ev.freed ? 0.8 : 0, 0, true); dressTrack(m); }
    if (mk) { if (ev.freed) setMarker(mk, ev.zone.x, ev.zone.y, ev.zone.r, 0x66ffaa, true); else setMarker(mk, ev.x, ev.y, 70, 0xffd24a, true); }
  }
}
function drawEvents() {
  const ev = EVT.cur; if (!ev || (state !== 'playing' && state !== 'paused')) return;
  const w = 350, x = W / 2 - 140, y = gameMode === 'mission' ? 78 : 12, lines = wrapText(ev.status, w - 28, 11), h = 40 + lines.length * 14;
  ctx.save(); ctx.fillStyle = 'rgba(40,20,0,0.55)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(255,170,60,0.7)'; ctx.strokeRect(x, y, w, h);
  text('EVENT  ·  ' + EVENT_INFO[ev.kind].title, W / 2, y + 17, 13, 'center', '#ffb84a'); lines.forEach((ln, i) => text(ln, W / 2, y + 33 + i * 14, 11, 'center', '#f0e4cc'));
  ctx.fillStyle = '#321'; ctx.fillRect(x + 10, y + h - 6, w - 20, 3); ctx.fillStyle = '#fa4'; ctx.fillRect(x + 10, y + h - 6, (w - 20) * clampN(ev.t / ev.total, 0, 1), 3);
  const pts = evPoints(); if (pts.length) { const o = pts[0], dx = o.x - player.x, dy = o.y - player.y, rel = Math.atan2(dy, dx) - look.yaw; ctx.translate(x - 22, y + h / 2); ctx.rotate(rel + Math.PI / 2); ctx.fillStyle = o.col; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 7); ctx.lineTo(0, 3); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.rotate(-(rel + Math.PI / 2)); text(`${Math.round(Math.hypot(dx, dy) / U)} m`, 0, 24, 10, 'center', '#fc8'); }
  ctx.restore();
}
