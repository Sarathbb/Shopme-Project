// ---------- Renderer, sky, lights ----------
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const FOG = srgb('#c9d9e8');
scene.fog = new THREE.Fog(FOG, 70, 200); scene.background = FOG;
const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 600);
const SUN_DIR = new THREE.Vector3(-0.5, 0.72, 0.48).normalize();
const LIGHT_DIR = SUN_DIR.clone();                                // direction of whichever of sun or moon is lighting the world (set by sky.js)
const hemi = new THREE.HemisphereLight(srgb('#c4dcff'), srgb('#6b7650'), 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(srgb('#fff0d6'), 2.5);
sun.castShadow = true; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
sun.shadow.mapSize.set(coarse ? 1536 : 3072, coarse ? 1536 : 3072);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 160 });
scene.add(sun, sun.target);
const interiorLight = new THREE.PointLight(srgb('#ffe3b8'), 0, 16, 1.4);
scene.add(interiorLight);
const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: srgb('#3d74c0') }, mid: { value: srgb('#8fbbe8') }, bot: { value: srgb('#d6e3ee') }, sunDir: { value: SUN_DIR }, moonDir: { value: new THREE.Vector3(0, -1, 0) },
    sunCol: { value: srgb('#ffd890') }, cloudCol: { value: srgb('#ffffff') }, sunVis: { value: 1 }, night: { value: 0 }, cover: { value: 0.3 }, dark: { value: 0 }, flash: { value: 0 }, time: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 moonDir; uniform vec3 sunCol; uniform vec3 cloudCol;
    uniform float sunVis; uniform float night; uniform float cover; uniform float dark; uniform float flash; uniform float time; varying vec3 vP;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
    void main(){ vec3 d = normalize(vP); float h = clamp(d.y, 0.0, 1.0);
      vec3 c = mix(bot, mid, smoothstep(0.0, 0.22, h)); c = mix(c, top, smoothstep(0.18, 0.85, h));
      float s = max(dot(d, sunDir), 0.0); c += sunCol * (pow(s, 24.0) * 0.35 + pow(s, 1500.0) * 6.0) * sunVis * (1.0 - dark * 0.8);
      if (night > 0.02 && d.y > 0.0) {                                               // stars and the moon
        vec2 uv = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 70.0; vec2 id = floor(uv); float r = h21(id), tw = 0.6 + 0.4 * sin(time * 2.5 + r * 60.0);
        float st = step(0.987, r) * smoothstep(0.0, 0.25, d.y) * tw * smoothstep(0.35, 0.0, length(fract(uv) - 0.5));
        float m = dot(d, moonDir); c += vec3(0.85, 0.9, 1.0) * st * night * (1.0 - cover) * (1.0 - dark);
        c += vec3(0.9, 0.93, 1.0) * (smoothstep(0.9988, 0.9994, m) * 3.0 + pow(max(m, 0.0), 60.0) * 0.12) * night * (1.0 - dark * 0.9);
      }
      float cl = 0.0;
      if (d.y > 0.02) { vec2 uv = d.xz / (d.y + 0.25) * 1.6 + vec2(time * 0.004, 0.0); float nn = n2(uv) * 0.6 + n2(uv * 2.3) * 0.3 + n2(uv * 5.1) * 0.1; cl = smoothstep(0.62 - cover * 0.36, 0.84 - cover * 0.3, nn) * smoothstep(0.02, 0.2, d.y);
        vec3 cc = mix(cloudCol, cloudCol * 0.45, dark); c = mix(c, cc, clamp(cl * (0.75 + 0.25 * cover), 0.0, 1.0)); }
      c += vec3(0.65, 0.72, 1.0) * flash * (0.45 + cl * 0.9);
      gl_FragColor = vec4(c, 1.0);
#include <encodings_fragment>
    }`,
}));
sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);

// ---------- Tanks and the boss (the soldiers are the rigged model in human.js) ----------
const CYLG = new THREE.CylinderGeometry(1, 1, 1, 14), BOXG = new THREE.BoxGeometry(1, 1, 1);
function part(geo, mat, sx, sy, sz, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
function removeMesh(m) { if (!m) return; scene.remove(m); if (m.userData.flashMats) m.userData.flashMats.forEach(mt => mt.dispose()); }
function makeTank(e) {
  const r = e.r / U, big = e.type === 'boss', g = new THREE.Group();
  const col = big ? '#6e2a24' : '#5d6046';
  const hullMat = new THREE.MeshStandardMaterial({ color: srgb(col), roughness: 0.65, metalness: 0.35 }), turMat = new THREE.MeshStandardMaterial({ color: srgb(big ? '#82332b' : '#6a6d50'), roughness: 0.6, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: srgb('#1c1d1f'), roughness: 0.8, metalness: 0.3 }), track = new THREE.MeshStandardMaterial({ color: srgb('#262626'), roughness: 0.95 });
  for (const m of [hullMat, turMat]) m.userData.mine = true;
  const hull = new THREE.Group(); g.add(hull);
  hull.add(part(BOXG, hullMat, r * 1.7, r * 0.5, r * 1.1, 0, r * 0.62, 0));
  hull.add(part(BOXG, hullMat, r * 0.5, r * 0.3, r * 1.05, r * 0.95, r * 0.55, 0));
  for (const sz of [-1, 1]) {
    hull.add(part(BOXG, track, r * 2.0, r * 0.42, r * 0.34, 0, r * 0.32, sz * r * 0.7));
    for (let i = 0; i < 6; i++) hull.add(part(CYLG, dark, r * 0.17, r * 0.34, r * 0.17, (i - 2.5) * r * 0.34, r * 0.28, sz * r * 0.88)).rotation.x = Math.PI / 2;
  }
  const tur = new THREE.Group(); tur.position.y = r * 1.05; g.add(tur);
  tur.add(part(CYLG, turMat, r * 0.58, r * 0.34, r * 0.58, 0, 0, 0));
  tur.add(part(BOXG, turMat, r * 0.5, r * 0.28, r * 0.5, -r * 0.3, 0, 0));
  const barrel = part(CYLG, dark, r * 0.07, r * 1.35, r * 0.07, r * 0.95, 0.02, 0); barrel.rotation.z = Math.PI / 2; tur.add(barrel);
  const brake = part(CYLG, dark, r * 0.1, r * 0.16, r * 0.1, r * 1.62, 0.02, 0); brake.rotation.z = Math.PI / 2; tur.add(brake);
  tur.add(part(CYLG, dark, r * 0.14, r * 0.08, r * 0.14, -r * 0.1, r * 0.22, r * 0.2));
  if (big) {
    for (const sz of [-1, 1]) { const b2 = part(CYLG, dark, r * 0.05, r * 0.95, r * 0.05, r * 0.7, 0.0, sz * r * 0.34); b2.rotation.z = Math.PI / 2; tur.add(b2); }
    for (const sz of [-1, 1]) hull.add(part(new THREE.ConeGeometry(1, 1, 8), turMat, r * 0.14, r * 0.4, r * 0.14, -r * 0.75, r * 0.95, sz * r * 0.4));
  }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(r * 0.25, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false })); muzzle.position.set(r * 1.8, 0.02, 0); muzzle.visible = false; tur.add(muzzle);
  g.userData = { hull, tur, muzzle, flashMats: [hullMat, turMat] };
  return g;
}
const ENEMY_LOOK = { heavy: { tint: '#8e949c', gun: 'rifle' }, soldier: { tint: '#d98a7a', gun: 'rifle' }, runner: { tint: '#e0c36a', gun: 'smg' }, sniper: { tint: '#a58ad6', gun: 'sniper' }, dummy: { tint: '#f0d860', gun: 'rifle' }, shield: { tint: '#7e9cc0', gun: 'smg' }, nvg: { tint: '#6f8a6a', gun: 'rifle' }, officer: { tint: '#d8bc50', gun: 'smg' } };
function makeEnemyMesh(e) {
  if (e.type === 'tank' || e.type === 'boss') return makeTank(e);
  if (e.type === 'dog') return makeDogMesh(e);
  if (e.type === 'heli') return makeHeliMesh(e);
  const L0 = ENEMY_LOOK[e.type] || ENEMY_LOOK.soldier, L = { tint: e.tint || L0.tint, gun: e.gun || L0.gun };
  const m = makeHuman({ tint: L.tint, gun: L.gun, scale: e.type === 'runner' ? 0.96 : e.type === 'heavy' ? 1.22 : 1 }); eliteGear(m, e.type); return m;
}
const GUNKIND = { Rifle: 'rifle', Shotgun: 'shotgun', SMG: 'smg', Sniper: 'sniper' };

// ---------- Effects: pooled bullets, grenades, pickups, particles ----------
const pools = { bul: [], ebul: [], gren: [], pick: [], rk: [] };
function sync(pool, list, make, place) {
  while (pool.length < list.length) { const m = make(); scene.add(m); pool.push(m); }
  for (let i = 0; i < pool.length; i++) { if (i < list.length) { pool[i].visible = true; place(pool[i], list[i]); } else pool[i].visible = false; }
}
const SPHG = new THREE.SphereGeometry(1, 10, 8);
const bulletMesh = (c, sx, sy) => { const m = new THREE.Mesh(SPHG, new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); m.scale.set(sx, sy, sy); return m; };
const MAXP = 1800, pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), colCache = {};
const col = s => colCache[s] || (colCache[s] = srgb(s));
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 14, 0, 7); g.fill(); return new THREE.CanvasTexture(c); })();   // round droplets instead of squares
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.24, vertexColors: true, map: dotTex, alphaTest: 0.5 }));
pts.frustumCulled = false; scene.add(pts);
// ---------- Decals: bullet holes, blood splats and scorch marks (ring buffers, oldest are replaced) ----------
function decalTex(draw) { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
const TEX_HOLE = decalTex(g => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 30); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(0.1, 'rgba(0,0,0,0)'); r.addColorStop(0.14, 'rgba(0,0,0,1)'); r.addColorStop(0.22, 'rgba(10,8,6,0.85)'); r.addColorStop(0.4, 'rgba(20,16,12,0.25)'); r.addColorStop(0.62, 'rgba(20,16,12,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#000'; g.beginPath(); g.arc(32, 32, 6, 0, 7); g.fill();                         // the hole itself
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, l = 9 + Math.random() * 14; g.beginPath(); g.moveTo(32 + Math.cos(a) * 7, 32 + Math.sin(a) * 7); g.lineTo(32 + Math.cos(a) * l, 32 + Math.sin(a) * l); g.stroke(); }   // cracks / chipped edge
});
const TEX_BLOOD = decalTex(g => {
  g.fillStyle = '#5c0808'; for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, d = Math.random() * 20, r = 3 + Math.random() * 9 * (1 - d / 28); g.globalAlpha = 0.55 + Math.random() * 0.4; g.beginPath(); g.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, r, 0, 7); g.fill(); }
  g.globalAlpha = 1; g.fillStyle = '#7a0b0b'; g.beginPath(); g.arc(32, 32, 9, 0, 7); g.fill();
  for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28, d = 20 + Math.random() * 10; g.beginPath(); g.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 1 + Math.random() * 2, 0, 7); g.fill(); }
});
const TEX_SCORCH = decalTex(g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 31); r.addColorStop(0, 'rgba(0,0,0,0.85)'); r.addColorStop(0.5, 'rgba(8,6,4,0.6)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const TEX_BROKEN = decalTex(g => {                                  // a smashed pane: dark opening with jagged glass teeth around the frame
  g.fillStyle = 'rgba(8,12,18,0.93)'; g.fillRect(4, 4, 56, 56);
  g.fillStyle = 'rgba(205,228,242,0.85)';
  for (let i = 0; i < 26; i++) { const t = i / 26 * 4, side = Math.floor(t), u = (t - side) * 56 + 4, d = 3 + Math.random() * 11; g.beginPath();
    const P = [[u, 4], [60, u], [60 - u + 4, 60], [4, 60 - u + 4]][side], N = [[0, 1], [-1, 0], [0, -1], [1, 0]][side];
    g.moveTo(P[0] - N[1] * 3, P[1] + N[0] * 3); g.lineTo(P[0] + N[0] * d, P[1] + N[1] * d); g.lineTo(P[0] + N[1] * 3, P[1] - N[0] * 3); g.fill(); }
  g.strokeStyle = 'rgba(190,215,230,0.45)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(4 + Math.random() * 56, 4); g.lineTo(4 + Math.random() * 56, 60); g.stroke(); }
});
function makeDecalSet(tex, max, double) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: double ? THREE.DoubleSide : THREE.FrontSide });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, max); mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 2;
  mesh.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(mesh);
  return { mesh, max, n: 0, next: 0 };
}
const DEC = { hole: makeDecalSet(TEX_HOLE, 320), blood: makeDecalSet(TEX_BLOOD, 160), scorch: makeDecalSet(TEX_SCORCH, 24), crack: makeDecalSet(TEX_BROKEN, 400, true) };
const _dm = new THREE.Matrix4(), _dq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _dp = new THREE.Vector3(), _ds = new THREE.Vector3(), _dn = new THREE.Vector3(), _dcol = new THREE.Color(), _zax = new THREE.Vector3(0, 0, 1);
function placeDecal(set, pos, normal, size, color, sy) {
  _dq.setFromUnitVectors(_zax, normal); if (!sy) { _rq.setFromAxisAngle(_zax, Math.random() * 6.28); _dq.multiply(_rq); }      // a size pair means an upright decal (windows): no random spin
  _ds.set(size, sy || size, 1); _dm.compose(pos, _dq, _ds);
  const i = set.next; set.next = (set.next + 1) % set.max; set.n = Math.min(set.max, set.n + 1);
  set.mesh.setMatrixAt(i, _dm); set.mesh.setColorAt(i, _dcol.set(color)); set.mesh.count = set.n; set.mesh.instanceMatrix.needsUpdate = true; set.mesh.instanceColor.needsUpdate = true;
}
const HOLE_TINT = { vehicle: '#ffffff', sandbag: '#d8c9a0', barrel: '#ffffff', rock: '#ddd', door: '#e8c9a0', fence: '#e8c9a0', furn: '#e8c9a0', furnTall: '#e8c9a0' };
function addBulletHole(x, y, vx, vy, kind) {                     // a dark hole on whatever the bullet struck, facing back towards the shooter
  const l = Math.hypot(vx, vy) || 1, top = KINDS[kind] && KINDS[kind].top, gy = floorY(x, y);
  _dn.set(-vx / l, 0, -vy / l);
  _dp.set(wx(x), gy + (top ? Math.min(AIM_H, top * 0.8) : AIM_H + (Math.random() - 0.5) * 0.3), wz(y)).addScaledVector(_dn, 0.04);
  placeDecal(DEC.hole, _dp, _dn, 0.13 + Math.random() * 0.08, HOLE_TINT[kind] || '#ffffff');
}
function addGroundDecal(set, x, y, size, color) {
  _dn.set(0, 1, 0); _dp.set(wx(x), floorY(x, y) + 0.05, wz(y)); placeDecal(set, _dp, _dn, size, color || '#ffffff');
}
const addBlood = (x, y, size) => addGroundDecal(DEC.blood, x, y, size), addScorch = (x, y, size) => addGroundDecal(DEC.scorch, x, y, size);
function clearDecals() { for (const k in DEC) {  DEC[k].n = 0; DEC[k].next = 0; DEC[k].mesh.count = 0; } }

// ---------- Muzzle-flash lights: one for your gun, one for the nearest enemy shooting ----------
const flashL = new THREE.PointLight(0xffb458, 0, 18, 2), flashE = new THREE.PointLight(0xffa040, 0, 20, 2); scene.add(flashL, flashE);
const _mzp = new THREE.Vector3();
const PICK = { hp: '#33cc33', ammo: '#ffcc33', gren: '#cc6633', band: '#ffffff', med: '#ff3355', armor: '#44ddcc', wpn: '#3399ff', att: '#bb55ff' };

function syncActor(e, flash, dt, cdist) {
  const m = e.mesh; if (!m) return;
  const x = wx(e.x), z = wz(e.y), y = floorY(e.x, e.y) + (e.elev || 0) + (e.type === 'heli' ? Math.sin(performance.now() / 600 + (e.phase || 0)) * 0.4 : 0);
  m.visible = cdist < 130; if (!m.visible) return;
  m.position.set(x, y, z);
  if (m.userData.heli) {
    const u = m.userData; u.rotor.rotation.y += 34 * dt; u.tail.rotation.z += 40 * dt; m.rotation.set(0, -(e.moveAngle || 0), 0); m.rotation.z = -0.12; for (const mt of u.flashMats) mt.emissive.setHex(flash);
  } else if (m.userData.dog) {
    const u = m.userData, sw = Math.sin((e.phase || 0) * 1.6) * 0.8 * Math.min(1, (e.speedNow || 0) / 120); m.rotation.y = -(e.moveAngle || 0); u.body.position.y = Math.abs(Math.sin((e.phase || 0) * 1.6)) * 0.07 * (e.speedNow > 20 ? 1 : 0);
    u.legs.forEach((l, i) => { l.rotation.z = (i % 2 ? sw : -sw) * (i < 2 ? 1 : -1); }); u.head.rotation.z = Math.sin((e.phase || 0) * 1.6) * 0.1; for (const mt of u.flashMats) mt.emissive.setHex(flash);
  } else if (m.userData.hull) {
    m.userData.hull.rotation.y = -(e.moveAngle || 0); m.userData.tur.rotation.y = -(e.angle || 0);
    for (const mt of m.userData.flashMats) mt.emissive.setHex(flash);
    m.userData.muzzle.visible = e.mflash > 0;
  } else {
    m.rotation.y = -(e.angle || 0);
    flashHuman(m, flash); humanMuzzle(m, e.mflash > 0);
    updateHuman(m, dt, e.speedNow || 0, false);
  }
}
function render3D(dt) {
  const t = performance.now() / 1000, adt = state === 'playing' ? dt : 0;
  updateEnvironment(dt || 0.016); syncZone(); { const k = clampN(0.12 + Math.max(0, ENV.elev) * 1.1, 0.12, 1) * (1 - ENV.dark * 0.5); for (const m of CAR_MATS) m.envMapIntensity = k; } waterTick(t); TREE_UNI.uTime.value = t; TREE_UNI.uWind.value = Q_SWAY * (1 + (WX.cur.storm || 0) * 2.2 + ENV.rain * 0.8 + ENV.dark * 0.5);
  const pm = player.mesh, pxm = wx(player.x), pzm = wz(player.y), pym = hAt(pxm, pzm);
  pm.visible = state !== 'over' && !player.driving;
  player.fyVis += (player.fy - player.fyVis) * Math.min(1, (dt || 0.016) * 16);
  pm.position.set(pxm, player.fyVis, pzm); pm.rotation.y = -player.faceAngle;
  flashHuman(pm, player.hurt > 0 ? 0x992222 : player.dashT > 0 ? 0x2a6a7a : 0);
  setHumanGun(pm, GUNKIND[player.weapon.name], player.gs.att);
  laserDot.visible = !!player.gs.att.side && state === 'playing' && !player.driving && !player.sprinting;
  if (laserDot.visible) laserDot.position.set(wx(aim.x), hAt(wx(aim.x), wz(aim.y)) + AIM_H, wz(aim.y));
  humanMuzzle(pm, player.cool > player.weapon.rate * player.rateMul - 0.045);
  { const mz = pm.userData.gun.userData.muzzle; if (mz.visible && pm.visible) { mz.getWorldPosition(_mzp); flashL.position.copy(_mzp); flashL.intensity = (player.gs.att.muzzle ? 1.5 : 14) * (0.65 + Math.random() * 0.35); } else flashL.intensity = 0; }
  { let best = null, bd = 1e9; for (const e of enemies) if (e.mflash > 0 && e.mesh) { const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < bd && d < 800) { bd = d; best = e; } }
    const mz = best && (best.mesh.userData.muzzle || (best.mesh.userData.gun && best.mesh.userData.gun.userData.muzzle));
    if (mz) { mz.getWorldPosition(_mzp); flashE.position.copy(_mzp); flashE.intensity = 12 * (0.65 + Math.random() * 0.35); } else flashE.intensity = 0; }
  updateHuman(pm, adt, player.speedNow, player.back, player.crouchK, player.airK, player.sprinting); setKnife(pm, player.knifeT || 0); dressTrack(pm);
  for (const e of enemies) syncActor(e, e.flash > 0 ? 0x666666 : 0, adt, Math.hypot(e.x - player.x, e.y - player.y) / U);
  sync(pools.rk, rockets, makeRocketMesh, (m, b) => { m.position.set(wx(b.x), hAt(wx(b.x), wz(b.y)) + AIM_H + 0.3, wz(b.y)); m.rotation.y = -Math.atan2(b.vy, b.vx); });
  sync(pools.bul, bullets, () => bulletMesh('#ffe066', 0.55, 0.06), (m, b) => { m.position.set(wx(b.x), hAt(wx(b.x), wz(b.y)) + AIM_H + (b.vh || 0) * (1 - b.life), wz(b.y)); m.rotation.y = -Math.atan2(b.vy, b.vx); });
  sync(pools.ebul, enemyBullets, () => bulletMesh('#ff5544', 0.4, 0.12), (m, b) => { m.material.color.set(SET.cb ? '#ffe34a' : '#ff5544'); m.position.set(wx(b.x), hAt(wx(b.x), wz(b.y)) + (b.h0 === undefined ? AIM_H : b.h0) + (b.vh || 0) * (3 - b.life), wz(b.y)); m.rotation.y = -Math.atan2(b.vy, b.vx); });
  sync(pools.gren, grenades, () => part(SPHG, new THREE.MeshStandardMaterial({ color: srgb('#38502e'), roughness: 0.6, metalness: 0.4 }), 0.14, 0.14, 0.14), (m, g) => {
    m.material.color.set(NADES[g.type || 'frag'].col); m.position.set(wx(g.x), hAt(wx(g.x), wz(g.y)) + 0.3 + Math.sin(Math.PI * (1 - g.t / g.t0)) * 2.5, wz(g.y));
  });
  syncPickups(t);
  const n = Math.min(MAXP, PART_CAP, particles.length);
  for (let i = 0; i < n; i++) {
    const p = particles[i], c = col(p.color);
    pPos[i * 3] = wx(p.x); pPos[i * 3 + 1] = hAt(wx(p.x), wz(p.y)) + (p.h || 0.5); pPos[i * 3 + 2] = wz(p.y);
    pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
  }
  pGeo.setDrawRange(0, n); pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  syncVehicles(adt || (state === 'playing' ? dt : 0)); syncNadePreview(); syncSmokes(t); syncLasers(); syncMission(t); syncAmbient(t, adt); syncSquad(t, adt); syncEvents(t);
  if (playerBuilding) { interiorLight.position.set(wx(playerBuilding.cx), hAt(pxm, pzm) + 2.6, wz(playerBuilding.cy)); interiorLight.intensity = playerBuilding.lightOn === false ? 0.15 : 2.4; } else interiorLight.intensity = 0;
  const snap = 68 / sun.shadow.mapSize.x * 4, sxm = Math.round(pxm / snap) * snap, szm = Math.round(pzm / snap) * snap;   // snap the shadow window to the texel grid so shadows do not shimmer
  sun.position.set(sxm + LIGHT_DIR.x * 80, pym + LIGHT_DIR.y * 80, szm + LIGHT_DIR.z * 80); sun.target.position.set(sxm, pym, szm); sun.target.updateMatrixWorld();
  sky.position.copy(camera.position); cullWorld(camera.position.x, camera.position.z);
  renderer.render(scene, camera);
}

// ---------- Camera: third person, behind the player's shoulder ----------
const look = { yaw: -Math.PI / 2, pitch: 0.14 };
const CAM = { dist: 5.0, pivotH: 1.7, shoulder: 0.75 }, CAM_CAR = { dist: 9.5, pivotH: 2.3, shoulder: 0 };
const camP = () => player && player.driving ? CAM_CAR : CAM;
const camDir = new THREE.Vector3(), pv = new THREE.Vector3();
const laserDot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2211', toneMapped: false })); laserDot.visible = false; scene.add(laserDot);
let aimAngle = -Math.PI / 2;
camera.fov = 62; camera.updateProjectionMatrix();
const aim = { x: FW / 2, y: FH / 2 };
const edgeTurn = v => Math.abs(v) < 0.3 ? 0 : Math.sign(v) * (Math.abs(v) - 0.3) / 0.7;
function camBlocked(x, y, z) {
  const g = hAt(x, z);
  if (y < g + 0.5) return true;
  const gx = (x + FW / U / 2) * U, gy = (z + FH / U / 2) * U;
  for (const o of nearObs(gx, gy, 60)) {
    if (o.kind === 'tree') { if (y > g + 1.8 && y < g + 9 && Math.hypot(gx - o.x, gy - o.y) < 36 * (o.s || 1)) return true; }
    else if (o.kind === 'container' && rectDist(gx, gy, o) < 8 && y < g + 3.0) return true;
    else if ((o.kind === 'wall' || o.kind === 'door') && !o.open && rectDist(gx, gy, o) < 5 && y < g + 3.4) return true;
    else if (o.kind === 'poly' && y < baseOf(o) + o.hgt + 0.4 && gx > o.x - 8 && gx < o.x + o.w + 8 && gy > o.y - 8 && gy < o.y + o.h + 8 && (pointInPoly(o.pts, gx, gy) || polyNearest(o.pts, gx, gy).d < 8)) return true;
  }
  for (const b of buildings) {            // outside walls and roofs block the camera; inside your own building the camera must stay inside it, under the ceiling
    if (b === playerBuilding) { const dx = gx - b.cx, dy = gy - b.cy, lx = dx * b.c0 + dy * b.s0, ly = -dx * b.s0 + dy * b.c0; if (Math.abs(lx) > b.ow / 2 - 10 || Math.abs(ly) > b.oh / 2 - 10 || y > g + 0.4 + b.wallH - 0.25) return true; continue; }
    const dx = gx - b.cx, dy = gy - b.cy, lx = dx * b.c0 + dy * b.s0, ly = -dx * b.s0 + dy * b.c0;
    if (Math.abs(lx) < b.ow / 2 + 8 && Math.abs(ly) < b.oh / 2 + 8 && y < hAt(wx(b.cx), wz(b.cy)) + b.hgt + 0.4) return true;
  }
  return false;
}
function killcamCamera(dt) {                               // slow-motion cutaway: the camera swings round the victim at close range
  const k = killcam, e = k.e, t = k.t / k.dur, az = k.az + t * 1.1, R = 6.5 - 2.5 * t, vx = wx(e.x), vz = wz(e.y), vy = floorY(e.x, e.y) + 1.15;
  const tx = vx + Math.cos(az) * R, tz = vz + Math.sin(az) * R, ty = vy + 0.5 + 0.4 * t;
  const g = hAt(tx, tz) + 0.6; camera.position.set(tx, Math.max(ty, g), tz); camera.lookAt(vx, vy, vz);
  const f = 40 - 8 * t; if (Math.abs(camera.fov - f) > 0.05) { camera.fov += (f - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld(true);
}
function updateCamera(dt) {
  if (killcam && state === 'playing') { killcamCamera(dt); return; }
  if (state === 'menu' || state === 'over' || state === 'loadout' || state === 'briefing' || state === 'debrief') { look.yaw += dt * 0.2; look.pitch = 0.22; }
  else if (state === 'playing') {
    look.yaw += ((keys['e'] ? 1 : 0) - (keys['q'] ? 1 : 0)) * 2.2 * dt;
    if (!touch.on && document.pointerLockElement !== canvas) {   // no pointer lock: turn by pushing the mouse toward a screen edge
      look.yaw += edgeTurn((mouse.x - W / 2) / (W / 2)) * 2.4 * dt;
      look.pitch += edgeTurn((mouse.y - H / 2) / (H / 2)) * 1.2 * dt;
    }
  }
  if (state === 'playing' && player.driving) {                    // the camera swings round behind the car as it turns
    const v = player.driving; let diff = v.heading - look.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(v.speed) > 25) look.yaw += diff * Math.min(1, dt * 2.4);
  }
  look.pitch = clampN(look.pitch, -0.12, 0.6);
  const fovT = state === 'playing' && player.zoom ? player.zoomFov() : SET.fov;     // scoped view
  if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 12); camera.updateProjectionMatrix(); }
  player.zoomK = clampN((SET.fov - camera.fov) / 30, 0, 1);
  const pit = look.pitch - (player.recoil || 0);          // gun recoil lifts the view a little
  const fx = Math.cos(look.yaw), fz = Math.sin(look.yaw), cp = Math.cos(pit), sp = Math.sin(pit);
  camDir.set(fx * cp, -sp, fz * cp);
  const px = wx(player.x), pz = wz(player.y);
  const C = camP(), pvx = px - fz * C.shoulder, pvy = (player.driving ? hAt(px, pz) : player.fyVis) + C.pivotH - (player.driving ? 0 : 0.45 * (player.crouchK || 0)), pvz = pz + fx * C.shoulder;
  let D = C.dist;
  for (let t = 0.6; t <= C.dist; t += 0.2) if (camBlocked(pvx - camDir.x * t, pvy - camDir.y * t, pvz - camDir.z * t)) { D = Math.max(0.9, t - 0.3); break; }      // sweep the camera back from the player and stop at the first thing in the way
  const j = shake * 0.02 * SET.shake;
  camera.position.set(pvx - camDir.x * D + (Math.random() - 0.5) * j, pvy - camDir.y * D + (Math.random() - 0.5) * j, pvz - camDir.z * D);
  camera.lookAt(camera.position.x + camDir.x, camera.position.y + camDir.y, camera.position.z + camDir.z);
  camera.updateMatrixWorld(true);
}
// The crosshair is the screen centre. Shots start at the player, so converge them on the crosshair line:
// on the nearest enemy under the crosshair, otherwise 19 units ahead.
function updateAim() {
  const fx = Math.cos(look.yaw), fy = Math.sin(look.yaw);
  const ox = player.x - fy * camP().shoulder * U, oy = player.y + fx * camP().shoulder * U;
  let along = 380;
  for (const e of enemies) {
    const rx = e.x - ox, ry = e.y - oy, a = rx * fx + ry * fy, lat = -rx * fy + ry * fx;
    if (a > 40 && a < along && Math.abs(lat) < e.r + 8) along = a;
  }
  aim.x = ox + fx * along; aim.y = oy + fy * along;
  aimAngle = Math.atan2(aim.y - player.y, aim.x - player.x);
}
function drawCrosshair() {
  const x = W / 2, y = H / 2, g = clampN(5 + (player.spreadNow || 0) * 230, 5, 62), L = 9;   // the gap shows how accurate the next shot is
  ctx.save(); ctx.lineCap = 'round';
  for (const [w, c] of [[4, 'rgba(0,0,0,0.55)'], [1.8, '#ffffff']]) {
    ctx.lineWidth = w; ctx.strokeStyle = c; ctx.beginPath();
    ctx.moveTo(x - g - L, y); ctx.lineTo(x - g, y); ctx.moveTo(x + g, y); ctx.lineTo(x + g + L, y);
    ctx.moveTo(x, y - g - L); ctx.lineTo(x, y - g); ctx.moveTo(x, y + g); ctx.lineTo(x, y + g + L); ctx.stroke();
  }
  ctx.fillStyle = '#ff4433'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 7); ctx.fill();
  ctx.restore();
}
// Radar: forward is up, so you can see what is behind you.
function drawRadar() {
  const cx = 75, cy = 135, R = 58, sc = R / 900, c = Math.cos(look.yaw), s = Math.sin(look.yaw);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill(); ctx.stroke();
  for (const e of enemies) {
    const dx = e.x - player.x, dy = e.y - player.y;
    let rx = (-dx * s + dy * c) * sc, ry = -(dx * c + dy * s) * sc;
    const d = Math.hypot(rx, ry); if (d > R - 4) { rx *= (R - 4) / d; ry *= (R - 4) / d; }
    ctx.fillStyle = e.type === 'boss' ? (SET.cb ? '#ffffff' : '#ff3333') : SET.cb ? '#ffd400' : '#ff9a90';
    ctx.beginPath(); ctx.arc(cx + rx, cy + ry, e.type === 'boss' ? 5 : 3, 0, 7); ctx.fill();
  }
  for (const h of vehicles) { if (!h.hostile || h.burned) continue; const dx = h.x - player.x, dy = h.y - player.y; let rx = (-dx * s + dy * c) * sc, ry = -(dx * c + dy * s) * sc; const d = Math.hypot(rx, ry); if (d > R - 4) { rx *= (R - 4) / d; ry *= (R - 4) / d; } ctx.fillStyle = '#ff5030'; ctx.fillRect(cx + rx - 3.5, cy + ry - 3.5, 7, 7); }
  for (const o of evPoints()) { const dx = o.x - player.x, dy = o.y - player.y; let rx = (-dx * s + dy * c) * sc, ry = -(dx * c + dy * s) * sc; const d = Math.hypot(rx, ry); if (d > R - 4) { rx *= (R - 4) / d; ry *= (R - 4) / d; } ctx.fillStyle = o.col; ctx.fillRect(cx + rx - 3, cy + ry - 3, 6, 6); }
  for (const a of SQUAD.list) { const dx = a.x - player.x, dy = a.y - player.y; let rx = (-dx * s + dy * c) * sc, ry = -(dx * c + dy * s) * sc; const d = Math.hypot(rx, ry); if (d > R - 4) { rx *= (R - 4) / d; ry *= (R - 4) / d; } ctx.fillStyle = a.state === 'down' ? '#ffcc33' : '#4aa8ff'; ctx.beginPath(); ctx.arc(cx + rx, cy + ry, 3, 0, 7); ctx.fill(); }
  for (const o of objPoints()) { const dx = o.x - player.x, dy = o.y - player.y; let rx = (-dx * s + dy * c) * sc, ry = -(dx * c + dy * s) * sc; const d = Math.hypot(rx, ry); if (d > R - 4) { rx *= (R - 4) / d; ry *= (R - 4) / d; } ctx.fillStyle = o.col; ctx.beginPath(); ctx.arc(cx + rx, cy + ry, 4, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.stroke(); }
  for (const pk of pickups) {                                    // loot shows as small squares
    if (!['wpn', 'att', 'med', 'armor'].includes(pk.kind)) continue;
    const dx = pk.x - player.x, dy = pk.y - player.y;
    let rx = (-dx * s + dy * c) * sc, ry = -(dx * c + dy * s) * sc;
    const d = Math.hypot(rx, ry); if (d > R - 4) { rx *= (R - 4) / d; ry *= (R - 4) / d; }
    ctx.fillStyle = PICK[pk.kind]; ctx.fillRect(cx + rx - 2.5, cy + ry - 2.5, 5, 5);
  }
  ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 4, cy + 4); ctx.lineTo(cx + 4, cy + 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function onScreen(x, y) {
  pv.set(wx(x), hAt(wx(x), wz(y)) + AIM_H, wz(y)).project(camera);
  return Math.abs(pv.x) < 1.02 && Math.abs(pv.y) < 1.02 && pv.z < 1;
}
function drawStealthHud() {                                        // suspicion icons above unalerted enemies, alert flash, and where hunting enemies think you are
  ctx.save(); let n = 0;
  for (const e of enemies) {
    if (!e.stealth || e.hp <= 0) continue;
    const a = e.alertFlash > 0, su = e.susp || 0; if (!a && !(su > 0.08 && e.alertT <= 0)) continue;
    pv.set(wx(e.x), floorY(e.x, e.y) + (e.elev || 0) + 2.35, wz(e.y)).project(camera); if (pv.z > 1 || Math.abs(pv.x) > 1.05 || Math.abs(pv.y) > 1.05) continue;
    const x = (pv.x * 0.5 + 0.5) * W, y = (-pv.y * 0.5 + 0.5) * H, k = a ? 1 : Math.min(1, su);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill();
    ctx.strokeStyle = a ? '#ff3a2a' : k > 0.7 ? '#ff9a2a' : '#ffe34a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); ctx.lineWidth = 1;
    text(a ? '!' : '?', x, y + 5, 14, 'center', a ? '#ff6a5a' : '#ffe34a');
  }
  ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(255,230,120,0.8)';
  for (const e of enemies) {                                         // "last known position": where an alerted enemy that lost you is heading
    if (!e.stealth || e.hp <= 0 || e.alertT <= 0 || e.sees || n >= 4 || !e.lastSeen) continue;
    pv.set(wx(e.lastSeen.x), hAt(wx(e.lastSeen.x), wz(e.lastSeen.y)) + 0.3, wz(e.lastSeen.y)).project(camera); if (pv.z > 1 || Math.abs(pv.x) > 1 || Math.abs(pv.y) > 1) continue; n++;
    const x = (pv.x * 0.5 + 0.5) * W, y = (-pv.y * 0.5 + 0.5) * H; ctx.beginPath(); ctx.ellipse(x, y, 18, 8, 0, 0, 7); ctx.stroke(); text('?', x, y + 4, 11, 'center', '#ffe66a');
  }
  ctx.restore();
}
function drawIndicators() {
  for (const e of enemies) {
    if (gameMode === 'br' && !(e.sees && e.tgt === player)) continue;               // in Battle Royale only enemies that have spotted you are marked
    pv.set(wx(e.x), hAt(wx(e.x), wz(e.y)) + AIM_H, wz(e.y)).project(camera);
    if (Math.abs(pv.x) <= 1 && Math.abs(pv.y) <= 1 && pv.z < 1) continue;
    let sx = pv.z > 1 ? -pv.x : pv.x, sy = pv.z > 1 ? -pv.y : pv.y;
    const m = Math.max(Math.abs(sx), Math.abs(sy)) || 1; sx /= m; sy /= m;
    const x = clampN((sx * 0.5 + 0.5) * W, 22, W - 22), y = clampN((-sy * 0.5 + 0.5) * H, 22, H - 22);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(y - H / 2, x - W / 2));
    ctx.fillStyle = e.type === 'boss' ? (SET.cb ? '#ffffff' : '#ff3333') : SET.cb ? 'rgba(255,212,0,0.9)' : 'rgba(255,100,90,0.85)';
    const s = e.type === 'boss' ? 13 : 8;
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s, -s * 0.8); ctx.lineTo(-s, s * 0.8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// Soldier portraits for the menu cards, rendered once from the real 3D model.
const portraits = [];
function makePortraits() {
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(srgb('#ffffff'), srgb('#667766'), 1.0));
  const dl = new THREE.DirectionalLight(srgb('#ffffff'), 2.2); dl.position.set(3, 5, 6); sc.add(dl);
  const pc = new THREE.PerspectiveCamera(30, 1, 0.1, 50); pc.position.set(1.5, 1.6, 5.4); pc.lookAt(0.2, 1.0, 0);
  const S = 256, rt = new THREE.WebGLRenderTarget(S, S), px = new Uint8Array(S * S * 4);
  const oldTM = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  CHARACTERS.forEach(c => {
    const m = makeHuman({ tint: c.tint, gun: ['rifle', 'shotgun', 'smg'][c.weapon] });
    m.rotation.y = -0.45; sc.add(m);
    for (let i = 0; i < 3; i++) updateHuman(m, 0.05, 0, false);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, pc); renderer.setRenderTarget(null);
    renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const cx = cv.getContext('2d'), img = cx.createImageData(S, S);
    for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
    cx.putImageData(img, 0, 0); portraits.push(cv); sc.remove(m);
  });
  renderer.toneMapping = oldTM; rt.dispose();
}
function resize() { renderer.setSize(stage.clientWidth, stage.clientHeight, false); }
addEventListener('resize', resize); resize();
