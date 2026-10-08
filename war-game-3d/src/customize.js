// ---------- Character customisation: camo skins, headgear and back gear, unlocked by level ----------
const SKINS = [
  { id: 'std', name: 'Standard issue', lvl: 1, tint: null }, { id: 'wood', name: 'Woodland camo', lvl: 3, tint: '#9db484' }, { id: 'desert', name: 'Desert camo', lvl: 5, tint: '#e0c48e' },
  { id: 'arctic', name: 'Arctic white', lvl: 7, tint: '#eef2f6' }, { id: 'urban', name: 'Urban grey', lvl: 9, tint: '#8a9199' }, { id: 'night', name: 'Night ops', lvl: 12, tint: '#454b57' },
  { id: 'crimson', name: 'Crimson guard', lvl: 14, tint: '#d08080' }, { id: 'gold', name: 'Gold elite', lvl: 18, tint: '#f2d46a' },
];
const HEADS = [{ id: 'none', name: 'Bare head', lvl: 1 }, { id: 'cap', name: 'Field cap', lvl: 2 }, { id: 'beret', name: 'Beret', lvl: 4 }, { id: 'helmet', name: 'Combat helmet', lvl: 6 }, { id: 'headset', name: 'Radio headset', lvl: 8 }, { id: 'nvg', name: 'Night-vision goggles', lvl: 11 }];
const BACKS = [{ id: 'none', name: 'No pack', lvl: 1 }, { id: 'pack', name: 'Backpack', lvl: 3 }, { id: 'radio', name: 'Radio pack', lvl: 7 }, { id: 'medic', name: 'Medic bag', lvl: 10 }];
const CUST_CATS = [['skin', 'CAMO', SKINS], ['head', 'HEADGEAR', HEADS], ['back', 'BACK GEAR', BACKS]];
const myLevel = () => levelOf(profile.xp).level;
const lookOf = () => Object.assign({ skin: 'std', head: 'none', back: 'none' }, profile.look || {});
function skinTint(look, fallback) { const s = SKINS.find(x => x.id === look.skin); return s && s.tint ? s.tint : fallback; }
const cm = (c, r = 0.7, m = 0.1) => new THREE.MeshStandardMaterial({ color: srgb(c), roughness: r, metalness: m });
function accessory(kind, accent) {                                       // meshes in root space around the item's anchor: x forward, y up, z right
  const g = new THREE.Group(), add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  const dk = cm('#1c1d20'), ac = cm(accent || '#4c5636'), cloth = cm('#3a4030', 0.9, 0);
  if (kind === 'cap') { add(new THREE.CylinderGeometry(0.118, 0.126, 0.09, 18), ac, 0, 0.115, 0); add(new THREE.BoxGeometry(0.13, 0.012, 0.19), ac, 0.13, 0.085, 0, 0, 0, -0.12); add(new THREE.SphereGeometry(0.118, 14, 8, 0, 6.283, 0, 1.57), ac, 0, 0.158, 0); }
  else if (kind === 'beret') { const b = add(new THREE.CylinderGeometry(0.16, 0.135, 0.045, 20), cm('#7a2530', 0.95, 0), -0.01, 0.125, 0.02, 0, 0, -0.18); add(new THREE.SphereGeometry(0.018, 8, 6), dk, 0.04, 0.165, 0.045); }
  else if (kind === 'helmet') { add(new THREE.SphereGeometry(0.142, 18, 12, 0, 6.283, 0, 1.75), ac, 0, 0.06, 0); add(new THREE.CylinderGeometry(0.15, 0.15, 0.018, 20), dk, 0, 0.065, 0); add(new THREE.BoxGeometry(0.05, 0.04, 0.05), dk, 0.14, 0.12, 0); for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.012, 0.012), cm('#d6c9a0', 0.9, 0), 0, 0.2, sz * 0.05); }
  else if (kind === 'headset') { add(new THREE.TorusGeometry(0.125, 0.012, 6, 18, Math.PI), dk, 0, 0.1, 0, 0, Math.PI / 2, 0); for (const sz of [-1, 1]) { add(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 14), dk, 0, 0.0, sz * 0.118, Math.PI / 2, 0, 0); add(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 12), cm('#3c4a58'), 0, 0.0, sz * 0.14, Math.PI / 2, 0, 0); } add(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 6), dk, 0.07, -0.03, 0.12, 0, 0, 1.1); add(new THREE.SphereGeometry(0.014, 8, 6), dk, 0.11, -0.07, 0.07); }
  else if (kind === 'nvg') { add(new THREE.BoxGeometry(0.075, 0.07, 0.18), dk, 0.12, 0.075, 0); for (const sz of [-1, 1]) { add(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12), cm('#2a2c30', 0.4, 0.5), 0.17, 0.075, sz * 0.045, 0, 0, Math.PI / 2); add(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 12), new THREE.MeshStandardMaterial({ color: '#33ff77', emissive: '#22dd66', emissiveIntensity: 0.9 }), 0.205, 0.075, sz * 0.045, 0, 0, Math.PI / 2); } add(new THREE.TorusGeometry(0.13, 0.014, 6, 20), cloth, 0, 0.075, 0, Math.PI / 2, 0, 0); add(new THREE.BoxGeometry(0.06, 0.1, 0.09), dk, 0, 0.14, 0); }
  else if (kind === 'pack') { add(new THREE.BoxGeometry(0.2, 0.42, 0.3), ac, 0, 0, 0); add(new THREE.BoxGeometry(0.1, 0.2, 0.26), cm('#363c28'), -0.1, -0.08, 0); for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.22, 0.08), cm('#363c28'), 0, -0.05, sz * 0.19); add(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 10), cm('#52583f'), -0.02, 0.26, 0, Math.PI / 2, 0, 0); }
  else if (kind === 'radio') { add(new THREE.BoxGeometry(0.14, 0.3, 0.22), dk, 0, 0, 0); add(new THREE.BoxGeometry(0.02, 0.1, 0.16), cm('#2e4a2e'), -0.08, 0.04, 0); add(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 6), dk, -0.04, 0.4, 0.08, 0, 0, 0.12); for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 8), new THREE.MeshStandardMaterial({ color: '#ff5533', emissive: '#ff3311', emissiveIntensity: 0.6 }), -0.08, 0.1 - i * 0.04, 0.05 - i * 0.05, 0, 0, Math.PI / 2); }
  else if (kind === 'medic') { add(new THREE.BoxGeometry(0.17, 0.3, 0.3), cm('#d8d8d2'), 0, 0, 0); add(new THREE.BoxGeometry(0.012, 0.16, 0.05), cm('#cc2222'), -0.088, 0, 0); add(new THREE.BoxGeometry(0.012, 0.05, 0.16), cm('#cc2222'), -0.088, 0, 0); for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.16, 0.05), ac, 0.0, -0.02, sz * 0.17); }
  return g;
}
const _am = new THREE.Matrix4(), _ar = new THREE.Matrix4();
function dressHuman(root, look) {                                         // attach the chosen headgear and back gear; they follow the head and spine bones
  const u = root.userData; if (u.dress) for (const it of u.dress) root.remove(it.g); u.dress = [];
  const accent = { std: '#4c5636', wood: '#3f5a2a', desert: '#8a7448', arctic: '#aeb8c0', urban: '#4a5058', night: '#22252c', crimson: '#6a2428', gold: '#a8883a' }[look.skin] || '#4c5636';
  if (look.head && look.head !== 'none') u.dress.push({ g: accessory(look.head, accent), bone: 'mixamorigHead', rest: [0, 1.66, 0] });
  if (look.back && look.back !== 'none') u.dress.push({ g: accessory(look.back, accent), bone: 'mixamorigSpine2', rest: [-0.2, 1.3, 0] });
  for (const it of u.dress) root.add(it.g);
}
function dressTrack(root) {
  const u = root.userData; if (!u.dress || !u.dress.length) return; root.updateMatrixWorld(true); _ar.copy(root.matrixWorld).invert();
  for (const it of u.dress) {
    const bone = u.bones[it.bone]; if (!bone) continue; _am.multiplyMatrices(_ar, bone.matrixWorld);
    if (!it.off) it.off = _am.clone().invert().multiply(new THREE.Matrix4().makeTranslation(it.rest[0], it.rest[1], it.rest[2]));
    _am.multiply(it.off); _am.decompose(it.g.position, it.g.quaternion, it.g.scale);
  }
}
// ----- preview image of the current look -----
let custPreview = null;
function renderPreview() {
  const look = lookOf(), ch = CHARACTERS[selectedChar], sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(srgb('#ffffff'), srgb('#667766'), 1.0));
  const dl = new THREE.DirectionalLight(srgb('#ffffff'), 2.2); dl.position.set(3, 5, 6); sc.add(dl);
  const pc = new THREE.PerspectiveCamera(30, 1, 0.1, 50); pc.position.set(1.6, 1.5, 4.6); pc.lookAt(0.0, 1.0, 0);
  const S = 360, rt = new THREE.WebGLRenderTarget(S, S), px = new Uint8Array(S * S * 4), oldTM = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  const m = makeHuman({ tint: skinTint(look, ch.tint), gun: ['rifle', 'shotgun', 'smg'][ch.weapon] }); dressHuman(m, look); m.rotation.y = -0.6; sc.add(m);
  for (let i = 0; i < 3; i++) updateHuman(m, 0.05, 0, false); dressTrack(m);
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, pc); renderer.setRenderTarget(null); renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d'), img = cx.createImageData(S, S);
  for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4); cx.putImageData(img, 0, 0);
  renderer.toneMapping = oldTM; rt.dispose(); removeMesh(m); custPreview = cv;
}
// ----- the screen -----
const CUST = { cat: 0, idx: [0, 0, 0] };
const custBtn = () => ({ x: W - 354, y: 10, w: 108, h: 26 });
const overCust = () => { const r = custBtn(); return mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h; };
function drawCustBtn() { const r = custBtn(); ctx.fillStyle = overCust() ? '#3c4a2e' : '#262f1e'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = '#9ab07a'; ctx.strokeRect(r.x, r.y, r.w, r.h); text('Customize [C]', r.x + r.w / 2, r.y + 18, 12, 'center', '#dfe8c8'); }
function openCustomize() { const l = lookOf(); CUST.idx = CUST_CATS.map(([k, , list]) => Math.max(0, list.findIndex(o => o.id === l[k]))); CUST.cat = 0; state = 'customize'; renderPreview(); Sound.ui(); }
function closeCustomize() { saveProfile(); state = 'menu'; Sound.ui(); }
function equipSel(cat, i) {
  const [k, , list] = CUST_CATS[cat], o = list[i]; if (!o) return;
  if (myLevel() < o.lvl) { notify(`${o.name} unlocks at level ${o.lvl}`); Sound.dry && Sound.dry(); return; }
  profile.look = Object.assign(lookOf(), { [k]: o.id }); CUST.idx[cat] = i; renderPreview(); Sound.ui();
}
const custRow = (cat, i) => ({ x: 40 + cat * 0, y: 150 + i * 36, w: 300, h: 32 });
function custKey(k) {
  const list = CUST_CATS[CUST.cat][2];
  if (k === 'escape' || k === 'c') return closeCustomize();
  if (k === 'arrowleft' || k === 'a') CUST.cat = (CUST.cat + 2) % 3; else if (k === 'arrowright' || k === 'd') CUST.cat = (CUST.cat + 1) % 3;
  else if (k === 'arrowup' || k === 'w') CUST.idx[CUST.cat] = (CUST.idx[CUST.cat] + list.length - 1) % list.length; else if (k === 'arrowdown' || k === 's') CUST.idx[CUST.cat] = (CUST.idx[CUST.cat] + 1) % list.length;
  else if (k === 'enter' || k === ' ') equipSel(CUST.cat, CUST.idx[CUST.cat]);
}
function clickCust() {
  const mx = mouse.x, my = mouse.y;
  CUST_CATS.forEach((c, i) => { if (mx >= 40 + i * 105 && mx <= 40 + i * 105 + 100 && my >= 92 && my <= 122) { CUST.cat = i; Sound.ui(); } });
  if (mx >= W / 2 - 70 && mx <= W / 2 + 70 && my >= H - 54 && my <= H - 20) return closeCustomize();
  CUST_CATS[CUST.cat][2].forEach((o, i) => { const r = custRow(0, i); if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) { CUST.idx[CUST.cat] = i; equipSel(CUST.cat, i); } });
}
function drawCustomize() {
  ctx.fillStyle = 'rgba(8,12,6,0.94)'; ctx.fillRect(0, 0, W, H); text('CUSTOMIZE SOLDIER', W / 2, 52, 28, 'center'); text(`Level ${myLevel()}  ·  higher levels unlock more camo and gear`, W / 2, 76, 12, 'center', '#9a9');
  CUST_CATS.forEach(([k, name], i) => { const on = i === CUST.cat; ctx.fillStyle = on ? '#4a5a3a' : '#222a1a'; ctx.fillRect(40 + i * 105, 92, 100, 30); ctx.strokeStyle = on ? '#ee8' : '#555'; ctx.strokeRect(40 + i * 105, 92, 100, 30); text(name, 90 + i * 105, 112, 11, 'center', on ? '#fff' : '#9a9'); });
  const [k, , list] = CUST_CATS[CUST.cat], cur = lookOf()[k];
  list.forEach((o, i) => { const r = custRow(0, i), lock = myLevel() < o.lvl, sel = i === CUST.idx[CUST.cat], on = o.id === cur; ctx.fillStyle = sel ? '#3a4a2c' : '#212a1a'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = on ? '#8f8' : sel ? '#ee8' : '#444'; ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (o.tint) { ctx.fillStyle = o.tint; ctx.fillRect(r.x + 8, r.y + 8, 16, 16); } text(o.name, r.x + (o.tint ? 34 : 12), r.y + 21, 13, 'left', lock ? '#667' : '#dde'); text(lock ? `🔒 Lv ${o.lvl}` : on ? 'EQUIPPED' : '', r.x + r.w - 10, r.y + 21, 11, 'right', lock ? '#a88' : '#8f8'); });
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(400, 100, 440, 400); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(400, 100, 440, 400); if (custPreview) ctx.drawImage(custPreview, 440, 120, 360, 360);
  text(CHARACTERS[selectedChar].name, 620, 494, 12, 'center', '#9a9');
  if (toast.t > 0) { ctx.globalAlpha = Math.min(1, toast.t); text(toast.text, W / 2, H - 64, 13, 'center', '#fd4'); ctx.globalAlpha = 1; }
  ctx.fillStyle = '#3a4a2a'; ctx.fillRect(W / 2 - 70, H - 54, 140, 34); ctx.strokeStyle = '#ee8'; ctx.strokeRect(W / 2 - 70, H - 54, 140, 34); text('BACK', W / 2, H - 31, 16, 'center');
  text('Arrows or click  ·  Enter: equip  ·  Esc/C: back', W / 2, H - 6, 10, 'center', '#889');
}
