// ---------- Pickups as real objects: modelled items lying on the ground, picked up with F ----------
const ITEM_NAMES = { hp: 'Health pack', band: 'Bandages', med: 'Medkit', armor: 'Armor vest', ammo: 'Ammo box' };
const ITEM_RING = { hp: '#44dd66', band: '#ffffff', med: '#ff4466', armor: '#44ddcc', ammo: '#ffcc33', gren: '#ff9a50', wpn: '#44aaff', att: '#bb66ff' };
function pickupName(p) {
  if (p.kind === 'gren' && !p.gt) p.gt = pick(['frag', 'frag', 'smoke', 'flash']);
  return p.kind === 'wpn' ? WEAPONS[p.w].name : p.kind === 'att' ? ATTS[p.a].name : p.kind === 'gren' ? NADES[p.gt].name[0] + NADES[p.gt].name.slice(1).toLowerCase() + ' grenade' : ITEM_NAMES[p.kind] || 'Item';
}
function nearestPickup() {
  let best = null, bd = 44;
  for (const p of pickups) { if (p.got) continue; const d = Math.hypot(p.x - player.x, p.y - player.y); if (d < bd) { bd = d; best = p; } }
  return best;
}
function collectPickup(p) {
  if (p.got) return; if (DAILY.on && DAILY.cfg.mod.id === 'nohl' && (p.kind === 'hp' || p.kind === 'band' || p.kind === 'med')) { p.kind = 'ammo'; }
  p.got = true; Sound.pickup(); removePickupMesh(p);
  spray(p.x, p.y, 0.5, 8, ['#ffffff', ITEM_RING[p.kind] || '#ffcc33'], 70, 0.5, { up: 2, g: 6 });
  if (p.kind === 'hp') { player.hp = Math.min(player.maxHp, player.hp + 25); notify('Health pack  +25 HP'); }
  else if (p.kind === 'gren') { if (!p.gt) pickupName(p); giveNade(player, p.gt, p.gt === 'frag' ? 2 : 1); }
  else if (p.kind === 'band') { player.bandages += 2; notify('Bandages +2  (H to use)'); }
  else if (p.kind === 'med') { player.medkits += 1; notify('Medkit +1  (J to use)'); }
  else if (p.kind === 'armor') { player.armor = Math.min(100, player.armor + 50); notify('Armor vest +50'); }
  else if (p.kind === 'wpn') player.giveWeapon(p.w);
  else if (p.kind === 'att') { player.attInv[p.a]++; notify(`Found ${ATTS[p.a].name} - press B to fit it`); }
  else player.giveAmmo();
}
// ----- models: each is a merged, vertex-coloured mesh sitting on the ground (metres) -----
const itemMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 }), ITEM_GEO = {};
const IB = (w, h, d, color, x, y, z, rx = 0, rz = 0) => ({ geo: new THREE.BoxGeometry(w, h, d), color, matrix: M4(x, y, z, 1, 1, 1, rx, rz) });
const IC = (r0, r1, h, color, x, y, z, rx = 0, rz = 0, seg = 12) => ({ geo: new THREE.CylinderGeometry(r1, r0, h, seg), color, matrix: M4(x, y, z, 1, 1, 1, rx, rz) });
const IS = (r, color, x, y, z, sx = 1, sy = 1, sz = 1) => ({ geo: new THREE.SphereGeometry(r, 10, 8), color, matrix: M4(x, y, z, sx, sy, sz) });
function itemParts(p) {
  switch (p.kind) {
    case 'hp': return [IB(0.3, 0.15, 0.2, '#f2f2ee', 0, 0.075, 0), IB(0.12, 0.012, 0.035, '#d82020', 0, 0.156, 0), IB(0.035, 0.012, 0.12, '#d82020', 0, 0.156, 0), IB(0.1, 0.03, 0.03, '#2a2a2a', 0, 0.16, 0.1), IB(0.02, 0.05, 0.03, '#888', 0.12, 0.1, 0.1)];
    case 'med': return [IB(0.42, 0.2, 0.28, '#e8eee8', 0, 0.1, 0), IB(0.42, 0.04, 0.28, '#c82828', 0, 0.2, 0), IB(0.16, 0.012, 0.05, '#fff', 0, 0.226, 0), IB(0.05, 0.012, 0.16, '#fff', 0, 0.226, 0), IB(0.05, 0.06, 0.03, '#2a2a2a', -0.13, 0.12, 0.15), IB(0.05, 0.06, 0.03, '#2a2a2a', 0.13, 0.12, 0.15), IB(0.14, 0.03, 0.05, '#2a2a2a', 0, 0.235, -0.05)];
    case 'band': return [IC(0.06, 0.06, 0.07, '#f1ede0', -0.07, 0.035, 0.03), IC(0.06, 0.06, 0.07, '#f1ede0', 0.06, 0.035, 0.05), IC(0.06, 0.06, 0.07, '#f1ede0', 0.0, 0.035, -0.07), IC(0.062, 0.062, 0.02, '#c9a66a', -0.07, 0.035, 0.03), IC(0.062, 0.062, 0.02, '#c9a66a', 0.06, 0.035, 0.05), IB(0.14, 0.03, 0.1, '#e8e8e4', 0.14, 0.015, -0.08)];
    case 'armor': return [IB(0.46, 0.05, 0.56, '#4c5636', 0, 0.025, 0), IB(0.36, 0.045, 0.34, '#3a432a', 0, 0.07, -0.06), IB(0.1, 0.03, 0.2, '#4c5636', -0.19, 0.06, 0.28), IB(0.1, 0.03, 0.2, '#4c5636', 0.19, 0.06, 0.28), IB(0.1, 0.05, 0.08, '#2e3322', -0.12, 0.095, 0.1), IB(0.1, 0.05, 0.08, '#2e3322', 0.0, 0.095, 0.1), IB(0.1, 0.05, 0.08, '#2e3322', 0.12, 0.095, 0.1), IB(0.3, 0.012, 0.04, '#c9b04a', 0, 0.1, -0.2)];
    case 'ammo': return [IB(0.4, 0.2, 0.18, '#4a5236', 0, 0.1, 0), IB(0.41, 0.02, 0.19, '#363c28', 0, 0.2, 0), IB(0.12, 0.03, 0.03, '#1a1a1a', 0, 0.225, 0), IB(0.1, 0.012, 0.06, '#d8c04a', -0.1, 0.206, 0), IB(0.02, 0.05, 0.03, '#8a8a8a', 0.12, 0.12, 0.095), IC(0.012, 0.012, 0.07, '#d4a63a', 0.29, 0.012, 0.06, 0, Math.PI / 2, 6), IC(0.012, 0.012, 0.07, '#d4a63a', 0.31, 0.012, 0.02, 0, Math.PI / 2, 6), IC(0.012, 0.012, 0.07, '#d4a63a', 0.27, 0.012, -0.03, 0, Math.PI / 2, 6)];
    case 'gren': return p.gt === 'smoke' ? [IC(0.036, 0.036, 0.15, '#7d848a', 0, 0.036, 0, 0, Math.PI / 2), IC(0.038, 0.038, 0.03, '#e8e8e8', 0, 0.038, 0, 0, Math.PI / 2), IC(0.03, 0.03, 0.03, '#444', 0.085, 0.036, 0, 0, Math.PI / 2)]
      : p.gt === 'flash' ? [IC(0.035, 0.035, 0.13, '#c9ced2', 0, 0.035, 0, 0, Math.PI / 2), IC(0.037, 0.037, 0.025, '#222', 0.075, 0.036, 0, 0, Math.PI / 2), IC(0.037, 0.037, 0.025, '#222', -0.075, 0.036, 0, 0, Math.PI / 2)]
      : [IS(0.048, '#46583a', 0, 0.056, 0, 1, 1.15, 1), IC(0.02, 0.02, 0.03, '#3a3a3a', 0, 0.115, 0), IB(0.012, 0.014, 0.09, '#8a8a8a', 0.02, 0.12, 0), IC(0.016, 0.016, 0.01, '#c8c8c8', 0.0, 0.13, 0.03, Math.PI / 2, 0)];
    case 'att': return p.a === 'scope' ? [IC(0.034, 0.034, 0.3, '#1c1d20', 0, 0.04, 0, 0, Math.PI / 2), IC(0.045, 0.045, 0.06, '#1c1d20', 0.13, 0.04, 0, 0, Math.PI / 2), IC(0.045, 0.045, 0.06, '#1c1d20', -0.12, 0.04, 0, 0, Math.PI / 2), IC(0.036, 0.036, 0.004, '#4a78c8', 0.161, 0.04, 0, 0, Math.PI / 2), IB(0.14, 0.03, 0.05, '#2a2a2c', 0, 0.01, 0)]
      : p.a === 'silencer' ? [IC(0.032, 0.032, 0.3, '#232426', 0, 0.034, 0, 0, Math.PI / 2, 14), IC(0.034, 0.034, 0.03, '#4a4c50', 0.14, 0.034, 0, 0, Math.PI / 2, 14), IC(0.034, 0.034, 0.03, '#4a4c50', -0.14, 0.034, 0, 0, Math.PI / 2, 14)]
      : p.a === 'extmag' ? [IB(0.06, 0.26, 0.036, '#1d1f22', 0, 0.036, 0, 0, Math.PI / 2 - 0.12), IB(0.064, 0.012, 0.04, '#b9a14a', -0.12, 0.05, 0, 0, Math.PI / 2 - 0.12), IC(0.012, 0.012, 0.05, '#d4a63a', 0.07, 0.02, 0.06, 0, Math.PI / 2, 6)]
      : [IB(0.1, 0.05, 0.05, '#1c1d20', 0, 0.025, 0), IB(0.1, 0.012, 0.07, '#2e3034', 0, 0.056, 0), IC(0.012, 0.012, 0.01, '#ff3a2a', 0.055, 0.03, 0, 0, Math.PI / 2, 8), IB(0.05, 0.03, 0.04, '#444', -0.09, 0.02, 0)];
  }
  return [];
}
function makePickupMesh(p) {
  const g = new THREE.Group();
  if (p.kind === 'wpn') {                                                       // a real rifle / shotgun / SMG / sniper lying on its side
    const gun = buildGun(GUNKIND[WEAPONS[p.w].name]); gun.position.set(-0.5, 0.1, 0); gun.rotation.x = Math.PI / 2; gun.traverse(o => { if (o.isMesh) o.castShadow = true; }); gun.userData.muzzle.visible = false; g.add(gun);
  } else {
    const key = p.kind + (p.gt || '') + (p.a || ''); if (!ITEM_GEO[key]) ITEM_GEO[key] = mergeGeos(itemParts(p));
    const m = new THREE.Mesh(ITEM_GEO[key], itemMat); m.castShadow = true; m.receiveShadow = true; m.scale.setScalar(1.3); g.add(m);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: ITEM_RING[p.kind] || '#fff', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, fog: false })); ring.position.y = 0.03; ring.userData.ring = true; g.add(ring);
  if (p.kind === 'wpn' || p.kind === 'att') { const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 6, 1, true), new THREE.MeshBasicMaterial({ color: ITEM_RING[p.kind], transparent: true, opacity: 0.28, depthWrite: false, fog: false })); beam.position.y = 1.6; g.add(beam); }
  g.rotation.y = p.ry === undefined ? (p.ry = Math.random() * 6.283) : p.ry; return g;
}
const pickMeshes = new Map(); let pickFrame = 0;
function removePickupMesh(p) { const m = pickMeshes.get(p); if (m) { scene.remove(m); pickMeshes.delete(p); } }
function clearPickupMeshes() { for (const m of pickMeshes.values()) scene.remove(m); pickMeshes.clear(); }
function syncPickups(t) {
  pickFrame++; const target = state === 'playing' && !player.driving ? nearestPickup() : null;
  for (const p of pickups) {
    if (p.got) continue; const d = Math.hypot(p.x - player.x, p.y - player.y); let m = pickMeshes.get(p);
    if (d > 1500) { if (m) m.visible = false; continue; }
    if (!m) { m = makePickupMesh(p); scene.add(m); pickMeshes.set(p, m); }
    m._f = pickFrame; m.visible = true; const x = wx(p.x), z = wz(p.y); m.position.set(x, floorY(p.x, p.y) + 0.01, z);
    const hot = p === target; m.children.forEach(c => { if (c.userData.ring) { c.material.opacity = hot ? 0.95 : 0.4 + 0.15 * Math.sin(t * 3 + p.x); c.scale.setScalar(hot ? 1.2 + 0.1 * Math.sin(t * 8) : 1); } });
  }
}
