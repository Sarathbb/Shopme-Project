// ---------- Photo mode (free camera, filters, time and weather) and instant replay (slow motion, orbit camera, save a clip) ----------
const PHOTO_FILTERS = [
  { id: 'none', name: 'Natural', css: '' },
  { id: 'cinema', name: 'Cinematic', css: 'contrast(1.12) saturate(1.18) sepia(0.12) hue-rotate(-8deg)', bars: true, vig: 0.45 },
  { id: 'noir', name: 'Noir', css: 'grayscale(1) contrast(1.4) brightness(0.95)', vig: 0.55, grain: 1 },
  { id: 'vintage', name: 'Vintage', css: 'sepia(0.7) contrast(1.05) saturate(0.85)', vig: 0.6, grain: 1 },
  { id: 'vivid', name: 'Vivid', css: 'saturate(1.55) contrast(1.1)' },
  { id: 'night', name: 'Night vision', css: 'grayscale(1) sepia(1) hue-rotate(60deg) saturate(3.5) brightness(1.15)', vig: 0.6, grain: 1 },
  { id: 'cold', name: 'Cold steel', css: 'saturate(0.75) hue-rotate(18deg) contrast(1.12) brightness(0.98)', vig: 0.3 },
];
const PH = { prev: 'playing', pos: new THREE.Vector3(), yaw: 0, pitch: 0, fov: 62, filter: 0, ui: true, hour: 12, wx: 'clear', last: null, lastMx: 0, lastMy: 0, shotT: 0, thumbT: 0, wxSaved: null };
let grainTex = null;
function grainPattern() { if (grainTex) return grainTex; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), d = x.createImageData(128, 128); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 40; } x.putImageData(d, 0, 0); return grainTex = c; }
function applyFilterCSS() { const gl = renderer.domElement, v = (state === 'photo' || state === 'replay') ? PHOTO_FILTERS[state === 'photo' ? PH.filter : RP.filter].css : ''; if (gl.style.filter !== v) gl.style.filter = v; }
function fxOverlay(c, w, h, f) {                                    // vignette, letterbox bars and film grain, drawn on any 2D context
  if (f.vig) { const g = c.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${f.vig})`); c.fillStyle = g; c.fillRect(0, 0, w, h); }
  if (f.grain) { const p = c.createPattern(grainPattern(), 'repeat'); c.save(); c.translate(Math.random() * 64, Math.random() * 64); c.fillStyle = p; c.fillRect(-64, -64, w + 64, h + 64); c.restore(); }
  if (f.bars) { c.fillStyle = '#000'; c.fillRect(0, 0, w, h * 0.1); c.fillRect(0, h * 0.9, w, h * 0.1); }
}
function composeShot(w, h, f, mark) {                                // the 3D view with the chosen filter applied, as a new canvas
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); composeInto(x, w, h, f, mark); return c;
}
function composeInto(x, w, h, f, mark) {
  try { x.filter = f.css || 'none'; } catch (e) {} x.drawImage(renderer.domElement, 0, 0, w, h); try { x.filter = 'none'; } catch (e) {}
  fxOverlay(x, w, h, f); if (mark) { x.font = `${Math.round(h / 40)}px monospace`; x.textAlign = 'right'; x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillText('WAR 3D', w - h / 40, h - h / 40); x.textAlign = 'left'; }
}
function showThumb(url, label) {                                    // a small preview: right-click or long-press it to save if the browser blocks downloads
  let el = document.getElementById('photoThumb'); if (!el) { el = document.createElement('div'); el.id = 'photoThumb'; el.style.cssText = 'position:fixed;left:12px;top:78px;z-index:50;background:#000c;border:1px solid #9ab07a;padding:6px;font:11px monospace;color:#dfe8c8;max-width:220px;'; document.body.appendChild(el); }
  el.innerHTML = ''; const cap = document.createElement('div'); cap.textContent = label; el.appendChild(cap);
  if (/\.webm|video/.test(label)) { const v = document.createElement('video'); v.src = url; v.controls = true; v.loop = true; v.autoplay = true; v.muted = true; v.style.cssText = 'width:208px;display:block;margin-top:4px'; el.appendChild(v); }
  else { const im = document.createElement('img'); im.src = url; im.style.cssText = 'width:208px;display:block;margin-top:4px'; el.appendChild(im); }
  el.style.display = 'block'; clearTimeout(PH.thumbT); PH.thumbT = setTimeout(() => { el.style.display = 'none'; }, 9000);
}
async function deliverFile(blob, name, label) {                     // the artifact viewer hands out files through its downloads capability; elsewhere a normal download link is used
  const url = URL.createObjectURL(blob); showThumb(url, label);
  try { if (window.claude && window.claude.use) { const d = await window.claude.use('downloads'); if (d) { try { await d.save({ filename: name, data: blob }); notify('Saved ' + name); return; } catch (e) { if (e && (e.code === 'declined' || e.code === 'rate_limited')) return; } } } } catch (e) {}
  downloadBlob(blob, name);
}
function downloadBlob(blob, name) { try { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); }, 500); return a.href; } catch (e) { return URL.createObjectURL(blob); } }
function savePhoto() {
  render3D(0); const rd = renderer.domElement, c = composeShot(rd.width, rd.height, PHOTO_FILTERS[PH.filter], true);
  c.toBlob(b => { if (!b) return; PH.last = { bytes: b.size, w: c.width, h: c.height }; deliverFile(b, `war3d-photo-${Date.now()}.png`, 'Photo (PNG)'); try { navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).catch(() => {}); } catch (e) {} }, 'image/png');
  PH.shotT = 0.25; Sound.cloth && Sound.cloth(); Sound.click ? Sound.click() : Sound.ui();
}
// ----- photo mode -----
function enterPhoto() {
  if (state !== 'playing' && state !== 'paused' && state !== 'over' && state !== 'debrief') return; if (gameMode === 'br' && state === 'playing' && false) return;
  PH.prev = state === 'photo' ? PH.prev : state; PH.pos.copy(camera.position); PH.yaw = look.yaw; PH.pitch = clampN(look.pitch, -1.2, 1.2); PH.fov = camera.fov; PH.hour = TOD.hour; PH.wx = WX.name; PH.wxSaved = { auto: WX.auto, cur: { ...WX.cur }, timer: WX.timer }; PH.todAuto = TOD.auto; TOD.auto = false;
  PH.ui = true; state = 'photo'; mouse.down = false; if (document.pointerLockElement) document.exitPointerLock(); Sound.ui();
}
function exitPhoto() {
  if (state !== 'photo') return; TOD.hour = PH.hour; TOD.auto = PH.todAuto; setWeather(PH.wx); if (PH.wxSaved) { Object.assign(WX.cur, PH.wxSaved.cur); WX.auto = PH.wxSaved.auto; WX.timer = PH.wxSaved.timer; }
  camera.fov = SET.fov; camera.updateProjectionMatrix(); renderer.domElement.style.filter = ''; state = PH.prev === 'playing' ? 'paused' : PH.prev; Sound.ui();
}
function photoCamera(dt) {
  const sp = (keys['shift'] ? 18 : 6) * dt, fx = Math.cos(PH.yaw), fz = Math.sin(PH.yaw), cp = Math.cos(PH.pitch), sn = Math.sin(PH.pitch);
  const mv = (keys['w'] ? 1 : 0) - (keys['s'] ? 1 : 0) - (PH.my || 0), st = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0) + (PH.mx || 0), up = (keys[' '] ? 1 : 0) - (keys['c'] ? 1 : 0);
  PH.pos.x += (fx * cp * mv - fz * st) * sp; PH.pos.z += (fz * cp * mv + fx * st) * sp; PH.pos.y += (-sn * mv + up) * sp;
  if (keys['arrowleft']) PH.yaw -= dt * 1.4; if (keys['arrowright']) PH.yaw += dt * 1.4; if (keys['arrowup']) PH.pitch -= dt * 1; if (keys['arrowdown']) PH.pitch += dt * 1;
  PH.pitch = clampN(PH.pitch, -1.45, 1.45); PH.pos.x = clampN(PH.pos.x, -FW / U / 2 + 1, FW / U / 2 - 1); PH.pos.z = clampN(PH.pos.z, -FH / U / 2 + 1, FH / U / 2 - 1); PH.pos.y = Math.max(PH.pos.y, hAt(PH.pos.x, PH.pos.z) + 0.3);
  camera.position.copy(PH.pos); camera.lookAt(PH.pos.x + fx * cp, PH.pos.y - sn, PH.pos.z + fz * cp);
  if (Math.abs(camera.fov - PH.fov) > 0.05) { camera.fov += (PH.fov - camera.fov) * Math.min(1, dt * 12); camera.updateProjectionMatrix(); } camera.updateMatrixWorld(true);
  PH.shotT -= dt;
}
const PH_BTNS = () => [['filter', '◀ ' + PHOTO_FILTERS[PH.filter].name + ' ▶', 170], ['time', 'Time ' + fmtTime(), 110], ['wx', 'Weather: ' + WX.name, 140], ['ui', 'Hide UI', 80], ['shot', 'SAVE PHOTO', 120], ['exit', 'Exit', 60]];
function phBtnRects() { const b = PH_BTNS(); let tot = b.reduce((a, x) => a + x[2] + 8, -8), x = W / 2 - tot / 2; return b.map(([id, lab, w]) => { const r = { id, lab, x, y: H - 46, w, h: 32 }; x += w + 8; return r; }); }
function photoKey(k) {
  if (k === 'escape' || k === 'f2' || k === 'insert') return exitPhoto();
  if (k === 'enter' || k === 'p' || k === 'f') return savePhoto();
  if (k === 'h') { PH.ui = !PH.ui; return; }
  if (k === 'arrowleft' && keys['control']) return;
  if (k >= '1' && k <= '7') { PH.filter = +k - 1; return; }
  if (k === 'tab') { PH.filter = (PH.filter + 1) % PHOTO_FILTERS.length; return; }
  if (k === '[') TOD.hour = (TOD.hour + 23.5) % 24; if (k === ']') TOD.hour = (TOD.hour + 0.5) % 24;
  if (k === ',' || k === '.') photoWeather(k === '.' ? 1 : -1);
}
function photoWeather(d) { const names = Object.keys(WEATHERS), i = names.indexOf(WX.name); const n = names[(i + d + names.length) % names.length]; setWeather(n); WX.timer = 1e9; Object.assign(WX.cur, WEATHERS[n]); }
function clickPhoto() {
  if (!PH.ui) { PH.ui = true; return true; }
  for (const r of phBtnRects()) if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) {
    if (r.id === 'filter') { PH.filter = (PH.filter + (mouse.x < r.x + r.w / 2 ? PHOTO_FILTERS.length - 1 : 1)) % PHOTO_FILTERS.length; } else if (r.id === 'time') TOD.hour = (TOD.hour + (mouse.x < r.x + r.w / 2 ? 23 : 1)) % 24; else if (r.id === 'wx') photoWeather(1);
    else if (r.id === 'ui') PH.ui = false; else if (r.id === 'shot') savePhoto(); else exitPhoto(); Sound.ui(); return true;
  }
  mouse.down = true; PH.lastMx = mouse.x; PH.lastMy = mouse.y; return false;
}
function drawPhoto() {
  const f = PHOTO_FILTERS[PH.filter]; applyFilterCSS(); fxOverlay(ctx, W, H, f);
  if (PH.shotT > 0) { ctx.fillStyle = `rgba(255,255,255,${PH.shotT * 3})`; ctx.fillRect(0, 0, W, H); }
  if (!PH.ui) { text('tap or press H for controls', W / 2, H - 12, 10, 'center', 'rgba(255,255,255,0.35)'); return; }
  ctx.save(); for (const r of phBtnRects()) { ctx.fillStyle = r.id === 'shot' ? 'rgba(80,120,50,0.9)' : 'rgba(0,0,0,0.6)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = r.id === 'shot' ? '#ee8' : 'rgba(255,255,255,0.4)'; ctx.strokeRect(r.x, r.y, r.w, r.h); text(r.lab, r.x + r.w / 2, r.y + 21, 12, 'center', '#fff'); }
  text('PHOTO MODE', W / 2, 24, 14, 'center', 'rgba(255,255,255,0.8)');
  text('WASD fly · Space/C up/down · Shift fast · drag to look · wheel zoom · 1-7 filters · [ ] time · , . weather · Enter save · H hide · Esc exit', W / 2, 42, 10, 'center', 'rgba(255,255,255,0.55)'); ctx.restore();
}

// ---------- Instant replay ----------
const RP = { frames: [], acc: 0, id: 0, on: false, t: 0, speed: 0.5, paused: false, cam: 0, orbit: 0, ghosts: [], saved: null, prev: 'over', filter: 0, rec: null, recStart: 0, hasHot: 0, scrub: false };
const RP_HZ = 20, RP_SECS = 12;
function replayRecord(dt) {
  RP.acc += dt; if (RP.acc < 1 / RP_HZ) return; RP.acc = 0;
  const f = { p: [player.x, player.y, player.faceAngle, player.speedNow, player.crouchK, player.hp, player.driving], e: [], a: [], b: [], eb: [], g: [], v: [] };
  for (const e of enemies) { if (e.type === 'dummy') continue; if (e._rid === undefined) e._rid = ++RP.id; f.e.push([e._rid, e, e.x, e.y, e.angle, e.speedNow || 0, e.hp > 0 ? 1 : 0, e.mflash > 0 ? 1 : 0]); }
  for (const a of SQUAD.list) f.a.push([a, a.x, a.y, a.angle, a.speedNow || 0, a.state === 'down' ? 1 : 0, a.mflash > 0 ? 1 : 0]);
  for (let i = 0; i < Math.min(bullets.length, 40); i++) f.b.push(bullets[i].x, bullets[i].y, bullets[i].vx, bullets[i].vy);
  for (let i = 0; i < Math.min(enemyBullets.length, 40); i++) f.eb.push(enemyBullets[i].x, enemyBullets[i].y, enemyBullets[i].vx, enemyBullets[i].vy);
  for (const g of grenades) f.g.push(g.x, g.y);
  for (const v of vehicles) if ((Math.abs(v.speed) > 8 || v.occupiedBy || v.hostile) && Math.hypot(v.x - player.x, v.y - player.y) < 1200) f.v.push([v, v.x, v.y, v.heading, v.speed, v.turretA]);
  RP.frames.push(f); if (RP.frames.length > RP_HZ * RP_SECS) RP.frames.shift();
}
function replayClear() { RP.frames = []; RP.acc = 0; }
function startReplay() {
  if (RP.on) return; if (RP.frames.length < RP_HZ * 2) { notify('Not enough action recorded yet for a replay'); return; }
  if (state !== 'over' && state !== 'paused' && state !== 'debrief' && state !== 'playing') return;
  RP.prev = state === 'playing' ? 'paused' : state; RP.on = true; RP.t = 0; RP.paused = false; RP.cam = 0; RP.orbit = 0; RP.filter = 0;
  RP.saved = { enemies, bullets, enemyBullets, grenades, rockets, pos: { x: player.x, y: player.y, fa: player.faceAngle, sp: player.speedNow, cr: player.crouchK, drv: player.driving, hp: player.hp }, veh: vehicles.map(v => [v, v.x, v.y, v.heading, v.speed, v.turretA]), squad: SQUAD.list.map(a => [a, a.x, a.y, a.angle, a.speedNow, a.state]), camFov: camera.fov, ts: Sound.paused };
  const seen = new Map(); for (const f of RP.frames) for (const r of f.e) if (!seen.has(r[0])) seen.set(r[0], r[1]);
  RP.ghosts = new Map(); let n = 0; for (const [id, e] of seen) { if (n++ > 40) break; const g = { type: e.type, tint: e.tint, gun: e.gun, r: e.r, x: 0, y: 0, angle: 0, speedNow: 0, flash: 0, mflash: 0, hp: 1, phase: 0, elev: 0, shield: e.shield, nvg: e.nvg, officer: e.officer }; g.mesh = makeEnemyMesh(g); g.mesh.visible = false; scene.add(g.mesh); RP.ghosts.set(id, g); }
  enemies = [...RP.ghosts.values()]; bullets = []; enemyBullets = []; grenades = []; rockets = [];
  RP.focus = RP.frames[RP.frames.length - 1].p; state = 'replay'; mouse.down = false; Sound.ui(); if (document.pointerLockElement) document.exitPointerLock();
}
function replayApply(idx) {                                          // pose the whole world as it was in frame idx
  const f = RP.frames[clampN(idx, 0, RP.frames.length - 1)], p = f.p;
  player.x = p[0]; player.y = p[1]; player.fy = player.fyVis = floorY(p[0], p[1]); player.faceAngle = p[2]; player.speedNow = p[3]; player.crouchK = p[4]; player.driving = p[6]; player.hp = Math.max(1, p[5]);
  const live = new Set(); for (const r of f.e) { const g = RP.ghosts.get(r[0]); if (!g) continue; live.add(g); g.x = r[2]; g.y = r[3]; g.angle = r[4]; g.speedNow = r[5]; g.hp = r[6]; g.mflash = r[7] ? 0.1 : 0; g.elev = r[6] ? 0 : -0.55; g.mesh.rotation.z = r[6] ? 0 : 1.45; g.mesh.visible = true; }
  for (const g of RP.ghosts.values()) if (!live.has(g)) { g.mesh.visible = false; g.x = -9999; g.y = -9999; }
  for (const r of f.a) { const a = r[0]; a.x = r[1]; a.y = r[2]; a.angle = r[3]; a.speedNow = r[4]; a.state = r[5] ? 'down' : 'ok'; a.mflash = r[6] ? 0.1 : 0; }
  bullets = []; for (let i = 0; i < f.b.length; i += 4) bullets.push({ x: f.b[i], y: f.b[i + 1], vx: f.b[i + 2], vy: f.b[i + 3], life: 1 });
  enemyBullets = []; for (let i = 0; i < f.eb.length; i += 4) enemyBullets.push({ x: f.eb[i], y: f.eb[i + 1], vx: f.eb[i + 2], vy: f.eb[i + 3], life: 3 });
  grenades = []; for (let i = 0; i < f.g.length; i += 2) grenades.push({ x: f.g[i], y: f.g[i + 1], vx: 0, vy: 0, t: 0.5, t0: 1, type: 'frag' });
  for (const r of f.v) { const v = r[0]; v.x = r[1]; v.y = r[2]; v.heading = r[3]; v.speed = r[4]; if (r[5] !== undefined) v.turretA = r[5]; }
}
function replayCamera(dt) {
  const f = RP.frames[clampN(Math.floor(RP.t * RP_HZ), 0, RP.frames.length - 1)], px = wx(f.p[0]), pz = wz(f.p[1]), py = floorY(f.p[0], f.p[1]) + 1.3;
  RP.orbit += dt * (RP.cam === 1 ? 0.35 : 0.12);
  let az, R, h;
  if (RP.cam === 0) { az = look.yaw + Math.PI + Math.sin(RP.orbit) * 0.9 + RP.drag * 0.01; R = 6.5; h = 1.8; }       // follow, with a slow sweep
  else if (RP.cam === 1) { az = RP.orbit * 2 + RP.drag * 0.01; R = 8; h = 2.6; }                                    // orbit
  else { az = look.yaw + Math.PI * 0.9 + RP.drag * 0.01; R = 3.4; h = 1.2; }                                      // close shoulder
  const cx = px + Math.cos(az) * R, cz = pz + Math.sin(az) * R, cy = Math.max(py + h, hAt(cx, cz) + 0.8);
  camera.position.set(cx, cy, cz); camera.lookAt(px, py - 0.1, pz); const fv = RP.cam === 2 ? 48 : 52; if (Math.abs(camera.fov - fv) > 0.05) { camera.fov += (fv - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); } camera.updateMatrixWorld(true);
}
RP.drag = 0;
function updateReplay(rdt) {
  const dur = (RP.frames.length - 1) / RP_HZ; if (!RP.paused && !RP.scrub) RP.t += rdt * RP.speed; if (RP.t >= dur) { RP.t = 0; if (RP.rec && performance.now() - RP.recStart > 1500) stopRecording(); }
  replayApply(Math.floor(RP.t * RP_HZ));
}
function endReplay() {
  if (!RP.on) return; stopRecording(true); for (const g of RP.ghosts.values()) { if (g.mesh) { scene.remove(g.mesh); removeMesh && 0; } } RP.ghosts = new Map();
  const S = RP.saved; enemies = S.enemies; bullets = S.bullets; enemyBullets = S.enemyBullets; grenades = S.grenades; rockets = S.rockets;
  Object.assign(player, { x: S.pos.x, y: S.pos.y, faceAngle: S.pos.fa, speedNow: S.pos.sp, crouchK: S.pos.cr, driving: S.pos.drv, hp: S.pos.hp }); player.fy = player.fyVis = floorY(player.x, player.y);
  for (const r of S.veh) { r[0].x = r[1]; r[0].y = r[2]; r[0].heading = r[3]; r[0].speed = r[4]; r[0].turretA = r[5]; }
  for (const r of S.squad) { r[0].x = r[1]; r[0].y = r[2]; r[0].angle = r[3]; r[0].speedNow = r[4]; r[0].state = r[5]; }
  camera.fov = SET.fov; camera.updateProjectionMatrix(); renderer.domElement.style.filter = ''; RP.on = false; state = RP.prev; Sound.ui();
}
function startRecording() {
  if (RP.rec) return; if (typeof MediaRecorder === 'undefined') { notify('Video recording is not supported in this browser'); return; }
  const cv = RP.cv || (RP.cv = document.createElement('canvas')); cv.width = 960; cv.height = 540; let stream; try { stream = cv.captureStream(30); } catch (e) { notify('Video capture is not available here'); return; }
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']; const mime = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)); let mr; try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 3500000 } : {}); } catch (e) { notify('Could not start recording'); return; }
  const chunks = []; mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); }; mr.onstop = () => { if (RP.recCancel) { RP.recCancel = false; return; } const blob = new Blob(chunks, { type: mr.mimeType || 'video/webm' }); RP.lastClip = { bytes: blob.size }; const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm'; deliverFile(blob, `war3d-replay-${Date.now()}.${ext}`, `Replay clip (.${ext}, ${(blob.size / 1024).toFixed(0)} KB)`); };
  mr.start(250); RP.rec = mr; RP.recStart = performance.now(); RP.t = 0; RP.paused = false; notify('Recording one loop of the replay...');
}
function stopRecording(cancel) { const mr = RP.rec; if (!mr) return; RP.rec = null; if (cancel) RP.recCancel = true; try { mr.stop(); } catch (e) {} }
function replayCapture() { if (!RP.rec || !RP.cv) return; const x = RP.cv.getContext('2d'); composeInto(x, RP.cv.width, RP.cv.height, PHOTO_FILTERS[RP.filter], true); }
const RP_BTNS = () => [['cam', 'Camera ' + (RP.cam + 1), 90], ['speed', RP.speed + 'x', 54], ['pause', RP.paused ? 'Play' : 'Pause', 64], ['filter', PHOTO_FILTERS[RP.filter].name, 100], ['rec', RP.rec ? 'Recording...' : 'Save clip', 100], ['photo', 'Photo', 64], ['exit', 'Exit', 60]];
function rpBtnRects() { const b = RP_BTNS(); let tot = b.reduce((a, x) => a + x[2] + 8, -8), x = W / 2 - tot / 2; return b.map(([id, lab, w]) => { const r = { id, lab, x, y: H - 46, w, h: 32 }; x += w + 8; return r; }); }
function replayKey(k) {
  if (k === 'escape' || k === 'v') return endReplay();
  if (k === ' ') RP.paused = !RP.paused; else if (k === 'c') RP.cam = (RP.cam + 1) % 3; else if (k === '1') RP.speed = 1; else if (k === '2') RP.speed = 0.5; else if (k === '3') RP.speed = 0.25;
  else if (k === 'arrowleft') { RP.paused = true; RP.t = Math.max(0, RP.t - 1 / RP_HZ * 2); } else if (k === 'arrowright') { RP.paused = true; RP.t = Math.min((RP.frames.length - 1) / RP_HZ, RP.t + 1 / RP_HZ * 2); }
  else if (k === 'r') startRecording(); else if (k === 'tab') RP.filter = (RP.filter + 1) % PHOTO_FILTERS.length; else if (k === 'p') replayPhoto();
}
function replayPhoto() { render3D(0); const rd = renderer.domElement, c = composeShot(rd.width, rd.height, PHOTO_FILTERS[RP.filter], true); c.toBlob(b => { if (!b) return; deliverFile(b, `war3d-replay-frame-${Date.now()}.png`, 'Frame (PNG)'); }, 'image/png'); }
function clickReplay() {
  const bar = { x: 120, y: H - 66, w: W - 240, h: 12 };
  if (mouse.x >= bar.x && mouse.x <= bar.x + bar.w && mouse.y >= bar.y - 6 && mouse.y <= bar.y + bar.h + 6) { RP.t = (mouse.x - bar.x) / bar.w * (RP.frames.length - 1) / RP_HZ; RP.paused = true; return; }
  for (const r of rpBtnRects()) if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) {
    if (r.id === 'cam') RP.cam = (RP.cam + 1) % 3; else if (r.id === 'speed') RP.speed = RP.speed === 0.5 ? 0.25 : RP.speed === 0.25 ? 1 : 0.5; else if (r.id === 'pause') RP.paused = !RP.paused; else if (r.id === 'filter') RP.filter = (RP.filter + 1) % PHOTO_FILTERS.length;
    else if (r.id === 'rec') { if (RP.rec) stopRecording(); else startRecording(); } else if (r.id === 'photo') replayPhoto(); else endReplay(); Sound.ui(); return;
  }
  RP.dragging = true;
}
function drawReplay() {
  applyFilterCSS(); const f = PHOTO_FILTERS[RP.filter]; fxOverlay(ctx, W, H, f);
  const dur = (RP.frames.length - 1) / RP_HZ; ctx.save(); text('INSTANT REPLAY', W / 2, 30, 18, 'center', '#fff'); text(RP.rec ? '● REC' : `${RP.speed}x slow motion`, W / 2, 48, 11, 'center', RP.rec ? '#f66' : 'rgba(255,255,255,0.7)');
  const bar = { x: 120, y: H - 66, w: W - 240, h: 12 }; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bar.x, bar.y, bar.w, bar.h); ctx.fillStyle = '#7c4'; ctx.fillRect(bar.x, bar.y, bar.w * clampN(RP.t / dur, 0, 1), bar.h);
  text(`${RP.t.toFixed(1)}s / ${dur.toFixed(1)}s`, bar.x + bar.w + 8, bar.y + 10, 10, 'left', '#cdb');
  for (const r of rpBtnRects()) { ctx.fillStyle = r.id === 'rec' && RP.rec ? 'rgba(160,40,40,0.9)' : 'rgba(0,0,0,0.6)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.strokeRect(r.x, r.y, r.w, r.h); text(r.lab, r.x + r.w / 2, r.y + 21, 12, 'center', '#fff'); }
  text('Space pause · C camera · 1/2/3 speed · ←/→ step · Tab filter · R save clip · P frame · Esc exit', W / 2, H - 10, 10, 'center', 'rgba(255,255,255,0.5)'); ctx.restore();
}
function replayButtonRect() { return { x: W / 2 - 170, y: H - 60, w: 160, h: 34 }; }
function drawReplayButton() {                                         // on the game-over and pause screens
  if (RP.frames.length < RP_HZ * 2) return; const r = replayButtonRect(); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = '#9ab07a'; ctx.strokeRect(r.x, r.y, r.w, r.h); text('Replay [V]', r.x + r.w / 2, r.y + 22, 14, 'center', '#dfe8c8');
  const q = { x: W / 2 + 10, y: H - 60, w: 160, h: 34 }; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(q.x, q.y, q.w, q.h); ctx.strokeStyle = '#9ab07a'; ctx.strokeRect(q.x, q.y, q.w, q.h); text('Photo mode [F2]', q.x + q.w / 2, q.y + 22, 14, 'center', '#dfe8c8');
}
function clickReplayButtons() {
  const r = replayButtonRect(), q = { x: W / 2 + 10, y: H - 60, w: 160, h: 34 }, inr = z => mouse.x >= z.x && mouse.x <= z.x + z.w && mouse.y >= z.y && mouse.y <= z.y + z.h;
  if (RP.frames.length >= RP_HZ * 2 && inr(r)) { startReplay(); return true; } if (inr(q)) { enterPhoto(); return true; } return false;
}
