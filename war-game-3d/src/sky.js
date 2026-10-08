// ---------- Day / night cycle and weather: sky, sun and moon, fog, rain, lightning, flashlight ----------
const TOD = { hour: 9, speed: 1 / 20, auto: true };                   // one game hour every 20 s, so a full day lasts 8 minutes
const WEATHERS = {
  clear:  { label: 'Clear',  cloud: 0.22, rain: 0,    fog: 0,   dark: 0,    storm: 0 },
  cloudy: { label: 'Cloudy', cloud: 0.8,  rain: 0,    fog: 0.12, dark: 0.3,  storm: 0 },
  rain:   { label: 'Rain',   cloud: 1,    rain: 0.75, fog: 0.3, dark: 0.5,  storm: 0 },
  storm:  { label: 'Storm',  cloud: 1,    rain: 1,    fog: 0.4, dark: 0.7,  storm: 1 },
  fog:    { label: 'Fog',    cloud: 0.6,  rain: 0,    fog: 1,   dark: 0.25, storm: 0 },
};
const WX = { name: 'clear', cur: { cloud: 0.22, rain: 0, fog: 0, dark: 0, storm: 0 }, timer: 90, auto: true, flash: 0, nextBolt: 6, pulse: 0 };
const ENV = { night: 0, elev: 1, vis: 1, rain: 0, fog: 0, dark: 0 };     // read by the rest of the game
const C = s => srgb(s);
// time-of-day palette: [hour, top, mid, bottom, fog, sun colour, hemisphere sky, hemisphere ground, hemisphere strength, exposure]
const PAL = [
  [0,    '#04060e', '#0a1122', '#131d36', '#0c1424', '#9fb4ff', '#4a5f9a', '#1a2030', 0.30, 1.35],
  [5,    '#04060e', '#0a1122', '#131d36', '#0c1424', '#9fb4ff', '#4a5f9a', '#1a2030', 0.30, 1.35],
  [6.3,  '#2c3f78', '#c98a78', '#f0b07a', '#c9a090', '#ffb070', '#9aa6d8', '#6b5a50', 0.55, 1.1],
  [8.5,  '#3d74c0', '#8fbbe8', '#d6e3ee', '#c9d9e8', '#fff0d6', '#c4dcff', '#6b7650', 0.80, 1.0],
  [16,   '#3d74c0', '#8fbbe8', '#d6e3ee', '#c9d9e8', '#fff0d6', '#c4dcff', '#6b7650', 0.80, 1.0],
  [18,   '#2f3d7a', '#d9806a', '#f4a45c', '#c79a88', '#ff9a50', '#a8a0c8', '#6b5448', 0.52, 1.1],
  [19.6, '#10162e', '#3a3358', '#6a4a5a', '#3a3350', '#ff8a50', '#5a68a0', '#2a2530', 0.36, 1.25],
  [21,   '#04060e', '#0a1122', '#131d36', '#0c1424', '#9fb4ff', '#4a5f9a', '#1a2030', 0.30, 1.35],
  [24,   '#04060e', '#0a1122', '#131d36', '#0c1424', '#9fb4ff', '#4a5f9a', '#1a2030', 0.30, 1.35],
].map(r => ({ h: r[0], c: r.slice(1, 8).map(x => typeof x === 'string' ? C(x) : x), n: [r[8], r[9]] }));
const _tc = [0, 1, 2, 3, 4, 5, 6].map(() => new THREE.Color()), _grey = new THREE.Color(), _wh = new THREE.Color(1, 1, 1);
const sstep = (a, b, x) => { const t = clampN((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function palette(h) {
  let i = 0; while (i < PAL.length - 2 && h >= PAL[i + 1].h) i++;
  const a = PAL[i], b = PAL[i + 1], t = clampN((h - a.h) / (b.h - a.h), 0, 1), k = t * t * (3 - 2 * t);
  for (let j = 0; j < 7; j++) _tc[j].copy(a.c[j]).lerp(b.c[j], k);
  return { c: _tc, hemiI: a.n[0] + (b.n[0] - a.n[0]) * k, expo: a.n[1] + (b.n[1] - a.n[1]) * k };
}
function setWeather(name) { if (WEATHERS[name]) { WX.name = name; WX.timer = 70 + Math.random() * 70; } }
function nextWeather() {
  const names = Object.keys(WEATHERS), i = names.indexOf(WX.name); setWeather(names[(i + 1) % names.length]);
}
function pickWeather() {                                               // a plausible next weather: mostly clear and cloudy, storms are rare
  const w = { clear: WX.name === 'clear' ? 1 : 4, cloudy: 3, rain: WX.name === 'cloudy' || WX.name === 'rain' ? 3 : 1, storm: WX.name === 'rain' ? 2 : 0.4, fog: ENV.night > 0.5 || TOD.hour < 8 ? 1.6 : 0.5 };
  w[WX.name] *= 0.2; let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'clear';
}
const fmtTime = () => { const h = Math.floor(TOD.hour) % 24, m = Math.floor((TOD.hour % 1) * 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };
try { const q = new URLSearchParams(location.search); if (q.get('time')) { TOD.hour = +q.get('time') % 24; TOD.auto = q.get('time') !== 'stop' && q.get('freeze') === null; } if (q.get('weather') && WEATHERS[q.get('weather')]) { setWeather(q.get('weather')); Object.assign(WX.cur, WEATHERS[q.get('weather')]); WX.auto = false; } } catch (e) {}

// ----- rain: streaks in a box that follows the camera -----
const RAIN_N = 2600, rainPos = new Float32Array(RAIN_N * 6), rainOff = new Float32Array(RAIN_N * 3);
for (let i = 0; i < RAIN_N; i++) { rainOff[i * 3] = (Math.random() - 0.5) * 44; rainOff[i * 3 + 1] = Math.random() * 26 - 8; rainOff[i * 3 + 2] = (Math.random() - 0.5) * 44; }
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xbfd0e0, transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
rain.frustumCulled = false; rain.visible = false; scene.add(rain);
// ----- flashlight / vehicle headlights: one spotlight that follows you -----
const torch = new THREE.SpotLight(0xfff1d6, 0, 52, 0.5, 0.9, 1.2); torch.castShadow = false; scene.add(torch, torch.target);
const _td = new THREE.Vector3(), _tr = new THREE.Vector3();
let torchK = 0;

function updateEnvironment(dt) {
  if (TOD.auto && (state === 'playing' || state === 'menu' || state === 'over')) TOD.hour = (TOD.hour + dt * TOD.speed) % 24;
  // ---- weather: drift towards the target, change it from time to time ----
  if (WX.auto && state === 'playing') { WX.timer -= dt; if (WX.timer <= 0) setWeather(pickWeather()); }
  const tg = WEATHERS[WX.name]; for (const k of ['cloud', 'rain', 'fog', 'dark', 'storm']) WX.cur[k] += (tg[k] - WX.cur[k]) * Math.min(1, dt * 0.35);
  const W = WX.cur, FL = WX.flash * (SET.calm ? 0.3 : 1);
  if (W.storm > 0.6 && state === 'playing') { WX.nextBolt -= dt; if (WX.nextBolt <= 0) { WX.nextBolt = 5 + Math.random() * 11; WX.flash = 1; WX.pulse = 0.14; Sound.thunder && Sound.thunder(0.25 + Math.random() * 2.4); } }
  if (WX.pulse > 0) { WX.pulse -= dt; if (WX.pulse <= 0) WX.flash = 0.8; }
  WX.flash = Math.max(0, WX.flash - dt * 3.2);
  // ---- sun, moon and the palette ----
  const hr = TOD.hour, ang = (hr - 6) / 12 * Math.PI, elev = Math.sin((hr - 6) / 24 * Math.PI * 2);
  const P = palette(hr), day = sstep(-0.1, 0.3, elev);
  ENV.elev = elev; ENV.night = 1 - sstep(-0.2, 0.05, elev);
  SUN_DIR.set(-Math.cos(ang) * 0.9, Math.sin(ang) * 0.85, 0.45).normalize();
  const moon = sky.material.uniforms.moonDir.value.set(SUN_DIR.x * -1, Math.max(0.35, -SUN_DIR.y), -SUN_DIR.z).normalize();
  const sunI = 2.5 * sstep(0.0, 0.3, elev), moonI = 0.6 * ENV.night, useSun = sunI >= moonI, dk = W.dark;
  LIGHT_DIR.copy(useSun ? (SUN_DIR.y < 0.12 ? _td.copy(SUN_DIR).setY(0.12).normalize() : SUN_DIR) : moon);
  sun.color.copy(useSun ? P.c[4] : C('#9fb4ff')); sun.intensity = Math.max(sunI, moonI) * (1 - dk * 0.88);
  _grey.setScalar((P.c[5].r + P.c[5].g + P.c[5].b) / 3); hemi.color.copy(P.c[5]).lerp(_grey, dk * 0.6); hemi.groundColor.copy(P.c[6]);
  hemi.intensity = P.hemiI * (1 - dk * 0.42) + FL * 2.4;
  const fogAmt = Math.max(W.fog, W.rain * 0.4); ENV.fog = fogAmt; ENV.rain = W.rain; ENV.dark = dk;
  scene.fog.near = 70 * (1 - fogAmt * 0.92); scene.fog.far = 200 * (1 - fogAmt * 0.72);
  const g = P.c[3].r * 0.3 + P.c[3].g * 0.59 + P.c[3].b * 0.11; _grey.setRGB(g * 0.92, g * 0.97, g * 1.02);
  scene.fog.color.copy(P.c[3]).lerp(_grey, Math.min(1, fogAmt * 0.8 + dk * 0.5)).lerp(_wh, FL * 0.3); scene.background = scene.fog.color;
  renderer.toneMappingExposure = P.expo * (1 - dk * 0.14);
  const u = sky.material.uniforms; u.top.value.copy(P.c[0]); u.mid.value.copy(P.c[1]); u.bot.value.copy(scene.fog.color).lerp(P.c[2], 1 - fogAmt * 0.85);
  for (const k of ['top', 'mid']) { const c = u[k].value, l = (c.r + c.g + c.b) / 3; c.lerp(_grey.setScalar(l * 0.95), dk * 0.85 + fogAmt * 0.4); }
  u.sunCol.value.copy(P.c[4]); u.cloudCol.value.copy(_wh).lerp(P.c[1], 0.35).multiplyScalar(0.1 + 0.9 * day);
  u.sunVis.value = sstep(-0.08, 0.1, elev); u.night.value = ENV.night; u.cover.value = W.cloud; u.dark.value = dk; u.flash.value = FL; u.time.value = performance.now() / 1000;
  ENV.vis = clampN(1 - ENV.night * 0.3 - fogAmt * 0.38 - W.rain * 0.08, 0.45, 1);
  // ---- window glow at night ----
  if (WIN_SETS && WIN_SETS.view) { const v = WIN_SETS.view.material.color, d = clampN(0.12 + Math.max(0, ENV.elev) * 1.1, 0.05, 1) * (1 - ENV.dark * 0.45); v.setRGB(d, d * (1 - ENV.night * 0.05), d * (1 + ENV.night * 0.35)); }       // the daylight outside a window follows the sky
  if (WIN_SETS && WIN_SETS.lit) { WIN_SETS.lit.visible = ENV.night > 0.04; WIN_SETS.lit.material.opacity = ENV.night * 0.92; }
  // ---- rain streaks ----
  const rk = playerBuilding ? 0 : W.rain;
  rain.visible = rk > 0.03;
  if (rain.visible) {
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, n = Math.floor(RAIN_N * rk * RAIN_FRAC), fall = 26 * dt, sl = 0.07 * (1 + W.storm);
    for (let i = 0; i < n; i++) {
      let y = rainOff[i * 3 + 1] - fall; if (y < -9) y += 28; rainOff[i * 3 + 1] = y;
      const x = cx + rainOff[i * 3], z = cz + rainOff[i * 3 + 2], j = i * 6;
      rainPos[j] = x; rainPos[j + 1] = cy + y; rainPos[j + 2] = z; rainPos[j + 3] = x + sl * 4; rainPos[j + 4] = cy + y - 0.9; rainPos[j + 5] = z;
    }
    rainGeo.setDrawRange(0, n * 2); rainGeo.attributes.position.needsUpdate = true; rain.material.opacity = 0.25 + 0.3 * rk;
  }
  // ---- flashlight (L) and headlights at night ----
  const wantTorch = state === 'playing' && player && (player.torch || (player.driving && ENV.night > 0.35));
  torchK += ((wantTorch ? 1 : 0) - torchK) * Math.min(1, dt * 10);
  torch.intensity = torchK * 3.6 * (Q_LIGHTS ? 1 : 0);
  if (torchK > 0.01) {
    camera.getWorldDirection(_td);
    if (player.driving) { const v = player.driving, h = v.heading, fx = Math.cos(h), fz = Math.sin(h); torch.position.set(wx(v.x) + fx * 2.1, hAt(wx(v.x), wz(v.y)) + 0.85, wz(v.y) + fz * 2.1); torch.target.position.set(torch.position.x + fx * 16, torch.position.y - 1.6, torch.position.z + fz * 16); }
    else { _tr.set(-_td.z, 0, _td.x).normalize(); torch.position.set(wx(player.x) + _tr.x * 0.25, player.fyVis + 1.5, wz(player.y) + _tr.z * 0.25); torch.target.position.copy(torch.position).addScaledVector(_td, 12); }
    torch.target.updateMatrixWorld();
  }
}

const TOD_AUTO0 = TOD.auto, WX_AUTO0 = WX.auto;
