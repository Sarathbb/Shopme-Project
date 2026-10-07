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
scene.add(new THREE.HemisphereLight(srgb('#c4dcff'), srgb('#6b7650'), 0.8));
const sun = new THREE.DirectionalLight(srgb('#fff0d6'), 2.5);
sun.castShadow = true; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
sun.shadow.mapSize.set(coarse ? 1536 : 2048, coarse ? 1536 : 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 160 });
scene.add(sun, sun.target);
const interiorLight = new THREE.PointLight(srgb('#ffe3b8'), 0, 16, 1.4);
scene.add(interiorLight);
const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: srgb('#3d74c0') }, mid: { value: srgb('#8fbbe8') }, bot: { value: srgb('#d6e3ee') }, sunDir: { value: SUN_DIR } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; varying vec3 vP;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
    void main(){ vec3 d = normalize(vP); float h = clamp(d.y, 0.0, 1.0);
      vec3 c = mix(bot, mid, smoothstep(0.0, 0.22, h)); c = mix(c, top, smoothstep(0.18, 0.85, h));
      float s = max(dot(d, sunDir), 0.0); c += vec3(1.0, 0.82, 0.55) * pow(s, 24.0) * 0.35 + vec3(1.0, 0.95, 0.85) * pow(s, 1500.0) * 6.0;
      if (d.y > 0.02) { vec2 uv = d.xz / (d.y + 0.25) * 1.6; float cl = smoothstep(0.52, 0.8, n2(uv) * 0.6 + n2(uv * 2.3) * 0.3 + n2(uv * 5.1) * 0.1); c = mix(c, vec3(1.0), cl * 0.75 * smoothstep(0.02, 0.2, d.y)); }
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
const ENEMY_LOOK = { soldier: { tint: '#d98a7a', gun: 'rifle' }, runner: { tint: '#e0c36a', gun: 'smg' }, sniper: { tint: '#a58ad6', gun: 'sniper' } };
function makeEnemyMesh(e) {
  if (e.type === 'tank' || e.type === 'boss') return makeTank(e);
  const L = ENEMY_LOOK[e.type] || ENEMY_LOOK.soldier;
  const m = makeHuman({ tint: L.tint, gun: L.gun, scale: e.type === 'runner' ? 0.96 : 1 }); return m;
}
const GUNKIND = { Rifle: 'rifle', Shotgun: 'shotgun', SMG: 'smg' };

// ---------- Effects: pooled bullets, grenades, pickups, particles ----------
const pools = { bul: [], ebul: [], gren: [], pick: [] };
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
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.28, vertexColors: true }));
pts.frustumCulled = false; scene.add(pts);
const PICK = { hp: '#33cc33', ammo: '#ffcc33', gren: '#cc6633' };

function syncActor(e, flash, dt, cdist) {
  const m = e.mesh; if (!m) return;
  const x = wx(e.x), z = wz(e.y), y = floorY(e.x, e.y);
  m.visible = cdist < 130; if (!m.visible) return;
  m.position.set(x, y, z);
  if (m.userData.hull) {
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
  const pm = player.mesh, pxm = wx(player.x), pzm = wz(player.y), pym = hAt(pxm, pzm);
  pm.visible = state !== 'over' && !player.driving;
  player.fyVis += (player.fy - player.fyVis) * Math.min(1, (dt || 0.016) * 16);
  pm.position.set(pxm, player.fyVis, pzm); pm.rotation.y = -player.faceAngle;
  flashHuman(pm, player.hurt > 0 ? 0x992222 : player.dashT > 0 ? 0x2a6a7a : 0);
  setHumanGun(pm, GUNKIND[player.weapon.name]);
  humanMuzzle(pm, player.cool > player.weapon.rate * player.rateMul - 0.045);
  updateHuman(pm, adt, player.speedNow, player.back, player.crouchK, player.airK);
  for (const e of enemies) syncActor(e, e.flash > 0 ? 0x666666 : 0, adt, Math.hypot(e.x - player.x, e.y - player.y) / U);
  sync(pools.bul, bullets, () => bulletMesh('#ffe066', 0.55, 0.06), (m, b) => { m.position.set(wx(b.x), hAt(wx(b.x), wz(b.y)) + AIM_H, wz(b.y)); m.rotation.y = -Math.atan2(b.vy, b.vx); });
  sync(pools.ebul, enemyBullets, () => bulletMesh('#ff5544', 0.4, 0.12), (m, b) => { m.position.set(wx(b.x), hAt(wx(b.x), wz(b.y)) + AIM_H, wz(b.y)); m.rotation.y = -Math.atan2(b.vy, b.vx); });
  sync(pools.gren, grenades, () => part(SPHG, new THREE.MeshStandardMaterial({ color: srgb('#38502e'), roughness: 0.6, metalness: 0.4 }), 0.14, 0.14, 0.14), (m, g) => {
    m.position.set(wx(g.x), hAt(wx(g.x), wz(g.y)) + 0.3 + Math.sin(Math.PI * (1 - g.t / g.t0)) * 2.5, wz(g.y));
  });
  sync(pools.pick, pickups, () => { const m = part(BOXG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.3 }), 0.5, 0.5, 0.5); return m; }, (m, p) => {
    if (m.userData.kind !== p.kind) { m.userData.kind = p.kind; m.material.color.copy(col(PICK[p.kind])); m.material.emissive.copy(col(PICK[p.kind])); m.material.emissiveIntensity = 0.5; }
    m.position.set(wx(p.x), hAt(wx(p.x), wz(p.y)) + 0.7 + Math.sin(t * 3 + p.x) * 0.1, wz(p.y)); m.rotation.y = t * 2;
  });
  const n = Math.min(MAXP, particles.length);
  for (let i = 0; i < n; i++) {
    const p = particles[i], c = col(p.color);
    pPos[i * 3] = wx(p.x); pPos[i * 3 + 1] = hAt(wx(p.x), wz(p.y)) + (p.h || 0.5); pPos[i * 3 + 2] = wz(p.y);
    pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
  }
  pGeo.setDrawRange(0, n); pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  syncVehicles(adt || (state === 'playing' ? dt : 0));
  if (playerBuilding) { interiorLight.position.set(wx(playerBuilding.cx), hAt(pxm, pzm) + 2.6, wz(playerBuilding.cy)); interiorLight.intensity = 1.5; } else interiorLight.intensity = 0;
  sun.position.set(pxm + SUN_DIR.x * 80, pym + SUN_DIR.y * 80, pzm + SUN_DIR.z * 80); sun.target.position.set(pxm, pym, pzm); sun.target.updateMatrixWorld();
  sky.position.copy(camera.position); cullWorld(camera.position.x, camera.position.z);
  renderer.render(scene, camera);
}

// ---------- Camera: third person, behind the player's shoulder ----------
const look = { yaw: -Math.PI / 2, pitch: 0.14 };
const CAM = { dist: 5.0, pivotH: 1.7, shoulder: 0.75 }, CAM_CAR = { dist: 9.5, pivotH: 2.3, shoulder: 0 };
const camP = () => player && player.driving ? CAM_CAR : CAM;
const camDir = new THREE.Vector3(), pv = new THREE.Vector3();
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
    else if (o.kind === 'poly' && y < baseOf(o) + o.hgt + 0.4 && gx > o.x - 8 && gx < o.x + o.w + 8 && gy > o.y - 8 && gy < o.y + o.h + 8 && (pointInPoly(o.pts, gx, gy) || polyNearest(o.pts, gx, gy).d < 8)) return true;
  }
  for (const b of buildings) {            // outside walls and roofs block the camera, except the one you are standing in
    if (b === playerBuilding) continue;
    const dx = gx - b.cx, dy = gy - b.cy, lx = dx * b.c0 + dy * b.s0, ly = -dx * b.s0 + dy * b.c0;
    if (Math.abs(lx) < b.ow / 2 + 8 && Math.abs(ly) < b.oh / 2 + 8 && y < hAt(wx(b.cx), wz(b.cy)) + b.hgt + 0.4) return true;
  }
  return false;
}
function updateCamera(dt) {
  if (state === 'menu' || state === 'over') { look.yaw += dt * 0.2; look.pitch = 0.22; }
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
  const pit = look.pitch - (player.recoil || 0);          // gun recoil lifts the view a little
  const fx = Math.cos(look.yaw), fz = Math.sin(look.yaw), cp = Math.cos(pit), sp = Math.sin(pit);
  camDir.set(fx * cp, -sp, fz * cp);
  const px = wx(player.x), pz = wz(player.y);
  const C = camP(), pvx = px - fz * C.shoulder, pvy = (player.driving ? hAt(px, pz) : player.fyVis) + C.pivotH - (player.driving ? 0 : 0.45 * (player.crouchK || 0)), pvz = pz + fx * C.shoulder;
  let D = C.dist;
  while (D > 1.2 && camBlocked(pvx - camDir.x * D, pvy - camDir.y * D, pvz - camDir.z * D)) D -= 0.4;
  const j = shake * 0.02;
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
    ctx.fillStyle = e.type === 'boss' ? '#ff3333' : '#ff9a90';
    ctx.beginPath(); ctx.arc(cx + rx, cy + ry, e.type === 'boss' ? 5 : 3, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 4, cy + 4); ctx.lineTo(cx + 4, cy + 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function onScreen(x, y) {
  pv.set(wx(x), hAt(wx(x), wz(y)) + AIM_H, wz(y)).project(camera);
  return Math.abs(pv.x) < 1.02 && Math.abs(pv.y) < 1.02 && pv.z < 1;
}
function drawIndicators() {
  for (const e of enemies) {
    pv.set(wx(e.x), hAt(wx(e.x), wz(e.y)) + AIM_H, wz(e.y)).project(camera);
    if (Math.abs(pv.x) <= 1 && Math.abs(pv.y) <= 1 && pv.z < 1) continue;
    let sx = pv.z > 1 ? -pv.x : pv.x, sy = pv.z > 1 ? -pv.y : pv.y;
    const m = Math.max(Math.abs(sx), Math.abs(sy)) || 1; sx /= m; sy /= m;
    const x = clampN((sx * 0.5 + 0.5) * W, 22, W - 22), y = clampN((-sy * 0.5 + 0.5) * H, 22, H - 22);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(y - H / 2, x - W / 2));
    ctx.fillStyle = e.type === 'boss' ? '#ff3333' : 'rgba(255,100,90,0.85)';
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
