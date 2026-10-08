// ---------- Grenade types (frag, smoke, flash), the throw-arc preview, smoke clouds and the knife ----------
const NADES = { bottle: { name: 'BOTTLE', col: '#6a9a6a', ui: '#9c9' }, frag: { name: 'FRAG', col: '#38502e', ui: '#ff9a50' }, smoke: { name: 'SMOKE', col: '#8a8f94', ui: '#b8c0c8' }, flash: { name: 'FLASH', col: '#ececec', ui: '#ffffff' } };
const NADE_KEYS = ['frag', 'smoke', 'flash'];
let smokes = [];
function nadeCount(p, t) { return t === 'frag' ? p.grenades : t === 'smoke' ? p.smokes : p.flashes; }
function giveNade(p, t, n = 1) { if (t === 'frag') p.grenades += n; else if (t === 'smoke') p.smokes += n; else p.flashes += n; notify(`${NADES[t].name} grenade +${n}`); }
function detonate(g) { if (g.type === 'bottle') { Sound.glass && Sound.glass(g.x, g.y); aiNoise(g.x, g.y, 640); spray(g.x, g.y, 0.2, 8, ['#cfe8d0', '#9ac89c'], 90, 0.5, { up: 2, g: 10 }); } else if (g.type === 'smoke') smokeBurst(g); else if (g.type === 'flash') flashBang(g); else explode(g); }
function smokeBurst(g) {
  smokes.push({ x: g.x, y: g.y, r: 10, rMax: 125, t: 17, life: 17, seed: Math.random() * 100 });
  boom(g.x, g.y, '#dfe3e6', 10); Sound.smokePop && Sound.smokePop(g.x, g.y); aiNoise(g.x, g.y, 500);
}
function smokeCuts(x0, y0, x1, y1) {                              // does the straight line between two points pass through a smoke cloud?
  for (const s of smokes) {
    if (s.r < 35 || s.t < 1.5) continue;
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, t = clampN(((s.x - x0) * dx + (s.y - y0) * dy) / l2, 0, 1);
    if (Math.hypot(x0 + dx * t - s.x, y0 + dy * t - s.y) < s.r * 0.78) return true;
  }
  return false;
}
function updateSmokes(dt) { for (const s of smokes) { s.t -= dt; s.r = Math.min(s.rMax, s.r + 80 * dt); } smokes = smokes.filter(s => s.t > 0); }
function flashBang(g) {
  const R = 330; Sound.flashbang && Sound.flashbang(g.x, g.y); aiNoise(g.x, g.y, 750);
  boom(g.x, g.y, '#ffffff', 16);
  for (const e of enemies) {
    const d = Math.hypot(e.x - g.x, e.y - g.y); if (d > R || !(e.ai || e.type === 'dog') || !lineClear(g.x, g.y, e.x, e.y)) continue;
    e.blind = clampN(5 * (1 - d / R) + 1, 1, 5.5); e.sees = false; e.mode = 'search'; e.blindA = Math.random() * 6.28;
  }
  const pd = Math.hypot(player.x - g.x, player.y - g.y);
  if (pd < R * 1.2 && !player.driving && lineClear(g.x, g.y, player.x, player.y)) {
    const facing = Math.cos(Math.atan2(g.y - player.y, g.x - player.x) - look.yaw) > -0.1 ? 1 : 0.35;      // looking away blunts it
    player.flashT = Math.max(player.flashT || 0, (3.4 * facing * (1 - pd / (R * 1.25)) + 0.4) * (SET.calm ? 0.35 : 1)); Sound.tinnitus && Sound.tinnitus(player.flashT);
  }
}
// ----- the arc preview while the throw button is held: a dotted arc and a ring where it will land -----
const NADE_N = 22, nadePos = new Float32Array(NADE_N * 3), nadeGeo = new THREE.BufferGeometry(); nadeGeo.setAttribute('position', new THREE.BufferAttribute(nadePos, 3));
const nadeDots = new THREE.Points(nadeGeo, new THREE.PointsMaterial({ size: 0.16, color: 0xffcc66, transparent: true, opacity: 0.9, depthTest: false, fog: false, map: dotTex, alphaTest: 0.4 }));
const nadeRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.55, depthTest: false, fog: false, side: THREE.DoubleSide }));
nadeDots.frustumCulled = false; nadeDots.renderOrder = 5; nadeRing.renderOrder = 5; nadeDots.visible = nadeRing.visible = false; scene.add(nadeDots, nadeRing);
function throwSpot(p) { const d = clampN(Math.hypot(aim.x - p.x, aim.y - p.y), 120, 380); return { x: p.x + Math.cos(p.angle) * d, y: p.y + Math.sin(p.angle) * d, d }; }
function syncNadePreview() {
  const on = state === 'playing' && player.nadeAim && !player.driving && nadeCount(player, player.nadeType) > 0; nadeDots.visible = nadeRing.visible = on; if (!on) return;
  const s = throwSpot(player), c = NADES[player.nadeType].ui; nadeDots.material.color.set(c); nadeRing.material.color.set(c);
  const x0 = wx(player.x), z0 = wz(player.y), x1 = wx(s.x), z1 = wz(s.y);
  for (let i = 0; i < NADE_N; i++) { const t = i / (NADE_N - 1), x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; nadePos[i * 3] = x; nadePos[i * 3 + 1] = hAt(x, z) + 0.3 + Math.sin(Math.PI * t) * 2.5 + (1 - t) * 1.0; nadePos[i * 3 + 2] = z; }
  nadeGeo.attributes.position.needsUpdate = true;
  const rr = (player.nadeType === 'frag' ? 95 : player.nadeType === 'flash' ? 330 : 125) / U;
  nadeRing.position.set(x1, hAt(x1, z1) + 0.1, z1); nadeRing.scale.set(rr, 1, rr);
}
// ----- smoke clouds in the world: a clump of soft grey puffs that grows, drifts up and fades -----
const smokePuffs = [], PUFF_GEO = new THREE.SphereGeometry(1, 10, 8);
function syncSmokes(t) {
  const need = smokes.length * 14; while (smokePuffs.length < need) { const m = new THREE.Mesh(PUFF_GEO, new THREE.MeshLambertMaterial({ color: 0xc4c9cc, transparent: true, opacity: 0.5, depthWrite: false })); m.renderOrder = 1; scene.add(m); smokePuffs.push(m); }
  let k = 0;
  for (const s of smokes) for (let i = 0; i < 14; i++, k++) {
    const m = smokePuffs[k], a = s.seed + i * 2.399, rr = s.r * 0.62 * (0.35 + 0.65 * ((i * 0.618) % 1)) / U, x = wx(s.x) + Math.cos(a + t * 0.05) * rr, z = wz(s.y) + Math.sin(a + t * 0.05) * rr;
    const age = s.life - s.t, size = Math.min(1, age / 2.5) * (2.6 + (i % 4) * 0.5) * (0.5 + s.r / s.rMax * 0.5), fade = Math.min(1, s.t / 3.5);
    m.visible = true; m.position.set(x, hAt(x, z) + 0.8 + (i % 5) * 0.55 + Math.sin(t * 0.4 + i) * 0.15 + age * 0.05, z); m.scale.setScalar(Math.max(0.01, size)); m.material.opacity = 0.52 * fade;
  }
  for (; k < smokePuffs.length; k++) smokePuffs[k].visible = false;
}
