// ---------- Settings: quality presets (with auto mode), display, audio, accessibility and key bindings; all saved on the device ----------
const SET_KEY = 'war3d-settings';
const ACTIONS = [
  ['forward', 'Move forward', 'w'], ['back', 'Move back', 's'], ['left', 'Move left', 'a'], ['right', 'Move right', 'd'], ['sprint', 'Sprint', 'shift'], ['jump', 'Jump', ' '], ['crouch', 'Crouch', 'c'], ['dash', 'Dash', 'v'],
  ['reload', 'Reload', 'r'], ['use', 'Use / pick up', 'f'], ['grenade', 'Throw grenade', 'g'], ['gtype', 'Grenade type', 't'], ['knife', 'Knife', 'x'], ['distract', 'Throw bottle', 'u'], ['heal', 'Bandage', 'h'], ['medkit', 'Medkit', 'j'],
  ['zoom', 'Scope zoom', 'z'], ['light', 'Flashlight', 'l'], ['smith', 'Gunsmith', 'b'], ['squadHold', 'Squad: follow / hold', 'y'], ['squadGo', 'Squad: move to aim', 'tab'],
];
const SET = { squad: 2, brDuo: false, squadVoice: false, lite: false, q: 'auto', fps: false, fov: 62, shake: 1, calm: false, cb: false, sens: 1, invY: false, vol: { master: 1, music: 1, sfx: 1 }, keys: {} };
try { const j = JSON.parse(localStorage.getItem(SET_KEY) || '{}'); Object.assign(SET, j, { vol: Object.assign(SET.vol, j.vol || {}), keys: j.keys || {} }); } catch (e) {}
const saveSet = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) {} };
const bindOf = a => SET.keys[a] || ACTIONS.find(x => x[0] === a)[2];
let REMAP = {}, BLOCK = {};
function rebuildRemap() {                                          // the game reads fixed keys; a custom key is translated to the default one, and a freed default key is ignored
  REMAP = {}; BLOCK = {}; const used = {}; for (const [a] of ACTIONS) used[bindOf(a)] = 1;
  for (const [a, , def] of ACTIONS) if (bindOf(a) !== def) REMAP[bindOf(a)] = def;
  for (const [a, , def] of ACTIONS) if (bindOf(a) !== def && !used[def]) BLOCK[def] = 1;
}
const canonKey = k => REMAP[k] || (BLOCK[k] ? null : k);
rebuildRemap();
const keyLabel = k => k === ' ' ? 'SPACE' : k.startsWith('arrow') ? k.slice(5).toUpperCase() + ' ARROW' : k.length === 1 ? k.toUpperCase() : k.toUpperCase();

// ----- quality -----
const DPR = window.devicePixelRatio || 1;
const QLEVELS = [
  { name: 'Low',    pr: Math.min(DPR, 1),                shadow: false, smap: 1024, cull: 110, part: 500,  rain: 0.4, grass: false, sway: 0, lights: false },
  { name: 'Medium', pr: Math.min(DPR, 1.5),              shadow: true,  smap: 2048, cull: 160, part: 1000, rain: 0.7, grass: true,  sway: 1, lights: true },
  { name: 'High',   pr: Math.min(DPR, coarse ? 1.5 : 2), shadow: true,  smap: coarse ? 1536 : 3072, cull: 215, part: 1800, rain: 1, grass: true, sway: 1, lights: true },
];
let CULL_D = 215, PART_CAP = 1800, RAIN_FRAC = 1, Q_SWAY = 1, Q_LIGHTS = true, GRASS_MESH = null, qApplied = -1;
let LITE = false;                                                   // low-detail effects: events, music and ambience do less work
const PERF = { upd: 0, frame: 0, calls: 0, tris: 0, acc: 0, n: 0, fps: 60, auto: coarse ? 1 : 2, lowN: 0, highT: 0, cool: 4 };
const qLevel = () => SET.q === 'auto' ? PERF.auto : SET.q === 'low' ? 0 : SET.q === 'med' ? 1 : 2;
function applyQuality(force) {
  const L = qLevel(); if (L === qApplied && !force) return; qApplied = L; const q = QLEVELS[L];
  renderer.setPixelRatio(q.pr); resize();
  sun.castShadow = q.shadow;
  if (sun.shadow.mapSize.x !== q.smap) { sun.shadow.mapSize.set(q.smap, q.smap); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  LITE = L === 0 || !!SET.lite; CULL_D = q.cull; PART_CAP = q.part; RAIN_FRAC = q.rain; Q_SWAY = q.sway; Q_LIGHTS = q.lights;
  flashL.visible = flashE.visible = torch.visible = q.lights; if (GRASS_MESH) GRASS_MESH.visible = q.grass;
}
function perfTick(rdt) {                                           // measure the frame rate twice a second; in Auto, step the quality down fast and back up slowly
  PERF.acc += rdt; PERF.n++; PERF.cool -= rdt; if (PERF.acc < 0.5) return;
  PERF.fps = Math.round(PERF.n / PERF.acc); PERF.acc = 0; PERF.n = 0;
  if (SET.q !== 'auto' || mapBusy || (state !== 'playing' && state !== 'menu')) { PERF.lowN = 0; PERF.highT = 0; return; }
  if (PERF.fps < 38) { PERF.lowN++; PERF.highT = 0; } else { PERF.lowN = 0; PERF.highT = PERF.fps > 56 ? PERF.highT + 0.5 : 0; }
  if (PERF.lowN >= 3 && PERF.auto > 0 && PERF.cool <= 0) { PERF.auto--; PERF.cool = 5; PERF.lowN = 0; applyQuality(); }
  else if (PERF.highT >= 14 && PERF.auto < 2 && PERF.cool <= 0) { PERF.auto++; PERF.cool = 14; PERF.highT = 0; applyQuality(); }
}
const SEC = { shake: [1, 0.4, 0], calm: false };
// ----- the screen -----
const SETUI = { tab: 0, sel: 0, capture: null, back: 'menu', hover: -1, msg: '' };
const TABS = ['GRAPHICS', 'AUDIO', 'CONTROLS', 'ACCESSIBILITY', 'GAMEPLAY'];
function openSettings(from) { SETUI.back = from || (state === 'paused' ? 'paused' : 'menu'); SETUI.capture = null; SETUI.sel = 0; state = 'settings'; Sound.ui(); }
function closeSettings() { saveSet(); SETUI.capture = null; state = SETUI.back; Sound.ui(); }
const choice = (label, opts, get, set) => ({ t: 'choice', label, opts, get, set });
const slider = (label, min, max, step, get, set, fmt) => ({ t: 'slider', label, min, max, step, get, set, fmt });
const toggle = (label, get, set, hint) => ({ t: 'toggle', label, get, set, hint });
function settingsItems() {
  const I = [];
  if (SETUI.tab === 0) {
    I.push(choice('Quality', ['Auto', 'Low', 'Medium', 'High'], () => ['auto', 'low', 'med', 'high'].indexOf(SET.q), i => { SET.q = ['auto', 'low', 'med', 'high'][i]; applyQuality(true); }));
    I.push(toggle('Show frame rate and timings', () => SET.fps, v => SET.fps = v, 'FPS, quality level, game and frame time, draw calls and triangles.'));
    I.push(toggle('Low-detail effects', () => SET.lite, v => { SET.lite = v; applyQuality(true); }, 'Simpler music, ambience and event effects. On automatically at the Low quality level.'));
    I.push(slider('Field of view', 50, 90, 2, () => SET.fov, v => SET.fov = v, v => v + '°'));
    I.push({ t: 'info', label: `Now running at the ${QLEVELS[qLevel()].name} preset  ·  ${PERF.fps} fps`, hint: 'Auto lowers the preset if the frame rate drops and raises it again when it recovers. Low turns off shadows, grass, tree sway and flash lights and renders fewer pixels.' });
  } else if (SETUI.tab === 1) {
    const vol = k => slider(k[1], 0, 1, 0.1, () => SET.vol[k[0]], v => { SET.vol[k[0]] = v; }, v => Math.round(v * 100) + '%');
    I.push(vol(['master', 'Master volume']), vol(['music', 'Music volume']), vol(['sfx', 'Effects volume']));
    I.push(toggle('Mute everything (M)', () => Sound.muted, v => Sound.setMuted(v)));
    I.push(toggle('Music on (N)', () => Sound.musicOn, v => { if (v !== Sound.musicOn) Sound.toggleMusic(); }));
  } else if (SETUI.tab === 2) {
    I.push(slider('Mouse sensitivity', 0.3, 3, 0.1, () => SET.sens, v => SET.sens = v, v => v.toFixed(1) + 'x'));
    I.push(toggle('Invert vertical look', () => SET.invY, v => SET.invY = v));
    ACTIONS.forEach(([a, name]) => I.push({ t: 'key', label: name, a }));
    I.push({ t: 'button', label: 'Reset all keys to default', fn: () => { SET.keys = {}; rebuildRemap(); SETUI.msg = 'Keys reset'; } });
  } else if (SETUI.tab === 3) {
    I.push(toggle('Colour-blind friendly markers', () => SET.cb, v => SET.cb = v, 'Enemy markers, enemy shots and the zone use yellow and blue instead of red and green.'));
    I.push(toggle('Reduce flashes', () => SET.calm, v => SET.calm = v, 'Dims flashbang white-outs and lightning.'));
    I.push(choice('Screen shake', ['Full', 'Reduced', 'Off'], () => SEC.shake.indexOf(SET.shake), i => SET.shake = SEC.shake[i]));
    I.push({ t: 'info', label: 'Touch settings (sticks, gyro, vibration, left-handed) are under SET during play on a touchscreen.', hint: '' });
  } else {
    I.push(choice('Squad (Survival and Missions)', ['Solo', '1 teammate', '2 teammates'], () => SET.squad, i => SET.squad = i));
    I.push(toggle('Battle Royale duo (one teammate)', () => SET.brDuo, v => SET.brDuo = v));
    I.push(toggle('Squad voice (text to speech)', () => SET.squadVoice, v => SET.squadVoice = v, 'Teammates and HQ speak their radio lines aloud, if your browser supports speech.'));
    I.push({ t: 'info', label: 'Teammates follow you, fight, go down and can be revived (hold F next to them). Daily challenges are always solo so scores stay comparable.', hint: 'Orders: Y holds or follows, Tab sends them to where you aim, 0 focuses fire on the enemy you aim at, F beside a teammate changes their role. They are replaced at the start of each wave or mission. Changes apply from the next run.' });
  }
  // layout
  const keyTab = SETUI.tab === 2; let y = 124;
  I.forEach((it, i) => {
    if (it.t === 'key') { const k = i - 2, col = k % 2, row = Math.floor(k / 2); it.r = { x: 60 + col * 400, y: 214 + row * 26, w: 380, h: 23 }; }
    else { const first = keyTab && it.t === 'button'; it.r = first ? { x: 60, y: 214 + Math.ceil(ACTIONS.length / 2) * 26 + 4, w: 380, h: 24 } : { x: 100, y: y, w: 700, h: it.t === 'info' ? 54 : 40 }; if (!first) y += it.t === 'info' ? 62 : keyTab ? 44 : 48; }
  });
  return I;
}
function adjustItem(it, dir) {
  if (it.t === 'choice') { const n = it.opts.length; it.set((it.get() + dir + n) % n); }
  else if (it.t === 'slider') { const v = Math.round(clampN(it.get() + dir * it.step, it.min, it.max) * 1000) / 1000; it.set(v); }
  else if (it.t === 'toggle') it.set(!it.get());
}
function activateItem(it) {
  if (it.t === 'key') { SETUI.capture = it.a; SETUI.msg = ''; } else if (it.t === 'button') it.fn(); else if (it.t === 'toggle' || it.t === 'choice') adjustItem(it, 1);
  Sound.ui(); saveSet();
}
function captureKey(raw) {
  const a = SETUI.capture; SETUI.capture = null; if (raw === 'escape') return;
  const other = ACTIONS.find(x => x[0] !== a && bindOf(x[0]) === raw);
  if (other) SET.keys[other[0]] = bindOf(a);                       // that key was taken: swap, so nothing is left unbound
  SET.keys[a] = raw; rebuildRemap(); saveSet(); SETUI.msg = other ? `Swapped with "${other[1]}"` : ''; Sound.ui();
}
function settingsKey(k) {
  const I = settingsItems();
  if (k === 'escape' || k === 'o') return closeSettings();
  if (k >= '1' && k <= '5') { SETUI.tab = +k - 1; SETUI.sel = 0; return; }
  if (k === 'arrowup' || k === 'w') SETUI.sel = (SETUI.sel + I.length - 1) % I.length; else if (k === 'arrowdown' || k === 's') SETUI.sel = (SETUI.sel + 1) % I.length;
  else if (k === 'arrowleft' || k === 'a') { const it = I[SETUI.sel]; if (it.t !== 'key' && it.t !== 'button') { adjustItem(it, -1); saveSet(); } }
  else if (k === 'arrowright' || k === 'd') { const it = I[SETUI.sel]; if (it.t !== 'key' && it.t !== 'button') { adjustItem(it, 1); saveSet(); } }
  else if (k === 'enter' || k === ' ') activateItem(I[SETUI.sel]);
  if (I[SETUI.sel] && I[SETUI.sel].t === 'info') SETUI.sel = (SETUI.sel + 1) % I.length;
}
function clickSettings() {
  const mx = mouse.x, my = mouse.y;
  TABS.forEach((t, i) => { if (mx >= 40 + i * 170 && mx <= 40 + i * 170 + 162 && my >= 62 && my <= 94) { SETUI.tab = i; SETUI.sel = 0; Sound.ui(); } });
  if (mx >= W / 2 - 70 && mx <= W / 2 + 70 && my >= H - 54 && my <= H - 20) return closeSettings();
  const I = settingsItems();
  I.forEach((it, i) => {
    const r = it.r; if (it.t === 'info' || mx < r.x || mx > r.x + r.w || my < r.y || my > r.y + r.h) return; SETUI.sel = i;
    if (it.t === 'slider') { const tx = r.x + r.w - 260, f = clampN((mx - tx) / 240, 0, 1); if (mx >= tx - 10) { it.set(Math.round((it.min + (it.max - it.min) * f) / it.step) * it.step); Sound.ui(); saveSet(); } }
    else if (it.t === 'choice' || it.t === 'toggle') { adjustItem(it, mx < r.x + r.w / 2 ? -1 : 1); Sound.ui(); saveSet(); }
    else activateItem(it);
  });
}
function drawSettings() {
  ctx.fillStyle = 'rgba(8,12,6,0.93)'; ctx.fillRect(0, 0, W, H); text('SETTINGS', W / 2, 44, 28, 'center');
  TABS.forEach((t, i) => { const x = 40 + i * 170, on = i === SETUI.tab; ctx.fillStyle = on ? '#4a5a3a' : '#222a1a'; ctx.fillRect(x, 62, 162, 32); ctx.strokeStyle = on ? '#ee8' : '#555'; ctx.strokeRect(x, 62, 162, 32); text(`${i + 1}  ${t}`, x + 81, 83, 11, 'center', on ? '#fff' : '#9a9'); });
  const I = settingsItems(); if (SETUI.sel >= I.length) SETUI.sel = 0;
  I.forEach((it, i) => {
    const r = it.r, sel = i === SETUI.sel, hov = mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h && it.t !== 'info';
    if (it.t === 'info') { text(it.label, r.x, r.y + 18, 13, 'left', '#cdd8c0'); if (it.hint) { const cut = it.hint.length > 96 ? it.hint.lastIndexOf(' ', 96) : it.hint.length; text(it.hint.slice(0, cut), r.x, r.y + 38, 11, 'left', '#889'); if (cut < it.hint.length) text(it.hint.slice(cut + 1), r.x, r.y + 52, 11, 'left', '#889'); } return; }
    ctx.fillStyle = sel ? '#3a4a2c' : hov ? '#2c3822' : '#212a1a'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = sel ? '#ee8' : '#444'; ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (it.t === 'key') { const cap = SETUI.capture === it.a; text(it.label, r.x + 10, r.y + 19, 12, 'left', '#dde'); text(cap ? 'press a key... (Esc cancels)' : keyLabel(bindOf(it.a)), r.x + r.w - 10, r.y + 19, 12, 'right', cap ? '#fd4' : bindOf(it.a) !== ACTIONS.find(x => x[0] === it.a)[2] ? '#8cf' : '#ee8'); return; }
    text(it.label, r.x + 14, r.y + r.h / 2 + 5, 14, 'left', it.t === 'button' ? '#f99' : '#dde');
    if (it.t === 'slider') { const tx = r.x + r.w - 260, f = (it.get() - it.min) / (it.max - it.min); ctx.fillStyle = '#123'; ctx.fillRect(tx, r.y + 17, 200, 6); ctx.fillStyle = '#7c4'; ctx.fillRect(tx, r.y + 17, 200 * f, 6); ctx.fillStyle = '#ee8'; ctx.beginPath(); ctx.arc(tx + 200 * f, r.y + 20, 8, 0, 7); ctx.fill(); text(it.fmt(it.get()), r.x + r.w - 14, r.y + r.h / 2 + 5, 14, 'right', '#ee8'); }
    else if (it.t === 'choice') text('<  ' + it.opts[it.get()] + '  >', r.x + r.w - 14, r.y + r.h / 2 + 5, 14, 'right', '#ee8');
    else if (it.t === 'toggle') { text(it.get() ? 'ON' : 'OFF', r.x + r.w - 14, r.y + r.h / 2 + 5, 14, 'right', it.get() ? '#9e9' : '#a88'); if (it.hint && sel) text(it.hint, r.x + 14, r.y + r.h + 14, 11, 'left', '#889'); }
  });
  if (SETUI.msg) text(SETUI.msg, W / 2, H - 66, 12, 'center', '#fd4');
  const bx = W / 2 - 70; ctx.fillStyle = '#3a4a2a'; ctx.fillRect(bx, H - 54, 140, 34); ctx.strokeStyle = '#ee8'; ctx.strokeRect(bx, H - 54, 140, 34); text('BACK', W / 2, H - 31, 16, 'center');
  text('Click or arrows to change  ·  Enter: select  ·  1-4: tabs  ·  Esc/O: back', W / 2, H - 6, 10, 'center', '#889');
}
const settingsBtn = () => ({ x: W - 236, y: 10, w: 108, h: 26 });
const overSettingsBtn = () => { const r = settingsBtn(); return mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h; };
function drawSettingsBtn() { const r = settingsBtn(); ctx.fillStyle = overSettingsBtn() ? '#3c4a2e' : '#262f1e'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = '#9ab07a'; ctx.strokeRect(r.x, r.y, r.w, r.h); text('Settings [O]', r.x + r.w / 2, r.y + 18, 12, 'center', '#dfe8c8'); }
