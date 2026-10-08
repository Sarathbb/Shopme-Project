// ---------- Weapon workshop: inspect every gun, see its stats and mastery, preview attachments, equip skins earned through mastery ----------
const WS = { sel: 0, skin: 0, view: 0, att: { optic: false, muzzle: false, mag: false, side: false }, img: null };
const SKIN_IDS = Object.keys(GUN_SKINS), WS_VIEWS = [[0, 0], [0.6, 0], [1.45, 0], [0.3, 1.1]];
const wsBtn = () => ({ x: W - 472, y: 10, w: 108, h: 26 });
const overWsBtn = () => { const r = wsBtn(); return mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h; };
function drawWsBtn() { const r = wsBtn(); ctx.fillStyle = overWsBtn() ? '#3c4a2e' : '#262f1e'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = '#9ab07a'; ctx.strokeRect(r.x, r.y, r.w, r.h); text('Workshop [W]', r.x + r.w / 2, r.y + 18, 12, 'center', '#dfe8c8'); }
function openWorkshop() { WS.sel = loadoutSan().pri; WS.view = 0; WS.att = { optic: false, muzzle: false, mag: false, side: false }; wsPickSkin(); renderWsPreview(); state = 'workshop'; Sound.ui(); }
function closeWorkshop() { saveProfile(); state = 'menu'; Sound.ui(); }
function wsPickSkin() { const id = (profile.wskin && profile.wskin[WS.sel]) || 'std'; WS.skin = Math.max(0, SKIN_IDS.indexOf(id)); }
function renderWsPreview() {
  const kind = GUNKIND[WEAPONS[WS.sel].name], sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(srgb('#ffffff'), srgb('#556655'), 1.1));
  const dl = new THREE.DirectionalLight(srgb('#ffffff'), 2.4); dl.position.set(2, 4, 5); sc.add(dl); const dl2 = new THREE.DirectionalLight(srgb('#aac4ff'), 0.9); dl2.position.set(-3, 1, -4); sc.add(dl2);
  const gun = buildGun(kind, WS.att, SKIN_IDS[WS.skin]); gun.traverse(o => { if (o.isMesh) { o.castShadow = false; o.material = o.material.clone(); o.material.metalness = Math.min(o.material.metalness, 0.3); o.material.roughness = Math.min(o.material.roughness, 0.55); if (o.material.color && o.material.color.r + o.material.color.g + o.material.color.b < 0.25) o.material.color.multiplyScalar(2.2); } }); const bb = new THREE.Box3().setFromObject(gun), ctr = bb.getCenter(new THREE.Vector3()), len = bb.getSize(new THREE.Vector3()).x;
  const hold = new THREE.Group(); gun.position.sub(ctr); hold.add(gun); hold.rotation.y = WS_VIEWS[WS.view][0]; hold.rotation.x = WS_VIEWS[WS.view][1]; sc.add(hold);
  const pc = new THREE.PerspectiveCamera(26, 1, 0.1, 30); pc.position.set(0, 0.12, Math.max(2.6, len * 2.0)); pc.lookAt(0, 0, 0);
  const S = 360, rt = new THREE.WebGLRenderTarget(S, S), px = new Uint8Array(S * S * 4), oldTM = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, pc); renderer.setRenderTarget(null); renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d'), img = cx.createImageData(S, S);
  for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4); cx.putImageData(img, 0, 0);
  renderer.toneMapping = oldTM; rt.dispose(); WS.img = cv;
}
function wstat(w) { return { dmg: w.rocket ? 14 : w.dmg * w.pellets, rate: 1 / w.rate, mag: w.mag, acc: w.rocket ? 1 / 0.012 : 1 / (w.spread + 0.012) }; }
let _wsmax = null; const wsmax = () => _wsmax || (_wsmax = (() => { const o = { dmg: 0, rate: 0, mag: 0, acc: 0 }; for (const w of WEAPONS) { const s = wstat(w); for (const k in o) o[k] = Math.max(o[k], s[k]); } return o; })());
const wsRow = i => ({ x: 30, y: 100 + i * 46, w: 232, h: 40 }), wsSkinRow = j => ({ x: 650, y: 330 + j * 34, w: 220, h: 30 }), wsAtt = j => ({ x: 276 + j * 90, y: 478, w: 86, h: 28 });
function wsEquip(j) {
  const id = SKIN_IDS[j], s = GUN_SKINS[id]; WS.skin = j; if (masteryLvl(WS.sel) < s.lvl) { notify(`${s.name}: reach ${WEAPONS[WS.sel].name} mastery ${s.lvl} (${MASTERY_AT[s.lvl - 1]} kills)`); renderWsPreview(); return; }
  if (!profile.wskin) profile.wskin = {}; profile.wskin[WS.sel] = id; saveProfile(); renderWsPreview(); Sound.ui();
}
function wsKey(k) {
  if (k === 'escape' || k === 'w') return closeWorkshop();
  if (k === 'arrowup') { WS.sel = (WS.sel + WEAPONS.length - 1) % WEAPONS.length; wsPickSkin(); renderWsPreview(); }
  else if (k === 'arrowdown') { WS.sel = (WS.sel + 1) % WEAPONS.length; wsPickSkin(); renderWsPreview(); }
  else if (k === 'arrowleft') { WS.skin = (WS.skin + SKIN_IDS.length - 1) % SKIN_IDS.length; renderWsPreview(); } else if (k === 'arrowright') { WS.skin = (WS.skin + 1) % SKIN_IDS.length; renderWsPreview(); }
  else if (k === 'enter' || k === ' ') wsEquip(WS.skin);
  else if (k === 'r') { WS.view = (WS.view + 1) % WS_VIEWS.length; renderWsPreview(); }
  else if (k >= '1' && k <= '4') { const sl = SLOTS[+k - 1]; WS.att[sl] = !WS.att[sl]; renderWsPreview(); }
}
function clickWs() {
  const mx = mouse.x, my = mouse.y, inr = r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
  if (mx >= W / 2 - 70 && mx <= W / 2 + 70 && my >= H - 54 && my <= H - 20) return closeWorkshop();
  WEAPONS.forEach((_, i) => { if (inr(wsRow(i))) { WS.sel = i; wsPickSkin(); renderWsPreview(); Sound.ui(); } });
  SKIN_IDS.forEach((_, j) => { if (inr(wsSkinRow(j))) wsEquip(j); });
  SLOTS.forEach((sl, j) => { if (inr(wsAtt(j))) { WS.att[sl] = !WS.att[sl]; renderWsPreview(); Sound.ui(); } });
  if (mx >= 270 && mx <= 630 && my >= 100 && my <= 460) { WS.view = (WS.view + 1) % WS_VIEWS.length; renderWsPreview(); }
}
function drawWorkshop() {
  ctx.fillStyle = 'rgba(8,12,6,0.95)'; ctx.fillRect(0, 0, W, H); text('WEAPON WORKSHOP', W / 2, 46, 28, 'center'); text(`Level ${myLevel()}  ·  every gun levels up with its own kills and unlocks skins at mastery 2 to 5`, W / 2, 70, 11, 'center', '#9a9');
  WEAPONS.forEach((w, i) => { const r = wsRow(i), sel = i === WS.sel, lock = !weaponOpen(i); ctx.fillStyle = sel ? '#4a5a3a' : '#222a1a'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = sel ? '#ee8' : '#555'; ctx.strokeRect(r.x, r.y, r.w, r.h);
    text(`[${i + 1}] ${w.name}`, r.x + 12, r.y + 25, 14, 'left', lock ? '#667' : '#fff'); text(lock ? `🔒 Lv ${WUNLOCK[i]}` : `M${masteryLvl(i)}`, r.x + r.w - 10, r.y + 25, 12, 'right', lock ? '#889' : '#8f8'); });
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(270, 100, 360, 360); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(270, 100, 360, 360); if (WS.img) ctx.drawImage(WS.img, 270, 100, 360, 360);
  text(`${WEAPONS[WS.sel].name}  ·  ${GUN_SKINS[SKIN_IDS[WS.skin]].name}`, 450, 124, 14, 'center', '#ee8'); text('click the picture or press R to turn it', 450, 450, 10, 'center', '#889');
  text('PREVIEW ATTACHMENTS', 450, 470, 10, 'center', '#889'); SLOTS.forEach((sl, j) => { const r = wsAtt(j), on = WS.att[sl]; ctx.fillStyle = on ? '#3a4e5e' : '#222a1a'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = on ? '#7cf' : '#555'; ctx.strokeRect(r.x, r.y, r.w, r.h); text(`[${j + 1}] ${ATTS[SLOT_ATT[sl]].name.split(' ')[0]}`, r.x + r.w / 2, r.y + 19, 11, 'center', on ? '#fff' : '#aab'); });
  // stats and mastery
  const w = WEAPONS[WS.sel], st = wstat(w), rows = [['Damage', w.rocket ? 'splash' : (w.dmg * (w.pellets > 1 ? w.pellets : 1)).toFixed(1) + (w.pellets > 1 ? ' (x' + w.pellets + ')' : ''), st.dmg / wsmax().dmg], ['Fire rate', st.rate.toFixed(1) + '/s', st.rate / wsmax().rate], ['Magazine', String(w.mag), Math.log(1 + st.mag) / Math.log(1 + wsmax().mag)], ['Accuracy', w.rocket ? 'straight' : (st.acc / wsmax().acc * 100).toFixed(0) + '%', st.acc / wsmax().acc]];
  rows.forEach(([lab, val, k], i) => { const y = 112 + i * 34; text(lab, 650, y, 12, 'left', '#cdb'); text(val, 870, y, 12, 'right', '#ee8'); ctx.fillStyle = '#233'; ctx.fillRect(650, y + 6, 220, 8); ctx.fillStyle = '#7c4'; ctx.fillRect(650, y + 6, 220 * clampN(k, 0.04, 1), 8); });
  const ml = masteryLvl(WS.sel), kills = (profile.wk && profile.wk[WS.sel]) || 0; text(`MASTERY ${ml}/5`, 650, 262, 13, 'left', '#ee8'); text(`${kills} kills`, 870, 262, 12, 'right', '#cdb');
  const nx = ml < 5 ? MASTERY_AT[ml] : kills, pv = MASTERY_AT[ml - 1]; ctx.fillStyle = '#233'; ctx.fillRect(650, 270, 220, 8); ctx.fillStyle = '#7c4'; ctx.fillRect(650, 270, 220 * (ml >= 5 ? 1 : (kills - pv) / (nx - pv)), 8);
  text(ml < 5 ? `Next: ${MASTERY_TXT[ml]} at ${MASTERY_AT[ml]} kills` : 'Fully mastered', 650, 296, 11, 'left', '#9ab'); text('SKINS', 650, 322, 11, 'left', '#889');
  SKIN_IDS.forEach((id, j) => { const r = wsSkinRow(j), s = GUN_SKINS[id], lock = ml < s.lvl, cur = ((profile.wskin && profile.wskin[WS.sel]) || 'std') === id; ctx.fillStyle = j === WS.skin ? '#3a4a2c' : '#212a1a'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = cur ? '#8f8' : j === WS.skin ? '#ee8' : '#555'; ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = s.metal || '#1d1f22'; ctx.fillRect(r.x + 8, r.y + 8, 14, 14); ctx.fillStyle = s.wood || '#6b4a2b'; ctx.fillRect(r.x + 22, r.y + 8, 8, 14); text(s.name, r.x + 40, r.y + 20, 12, 'left', lock ? '#667' : '#dde'); text(lock ? `🔒 M${s.lvl}` : cur ? 'EQUIPPED' : '', r.x + r.w - 8, r.y + 20, 10, 'right', lock ? '#889' : '#8f8'); });
  if (toast.t > 0) { ctx.globalAlpha = Math.min(1, toast.t); text(toast.text, W / 2, H - 64, 13, 'center', '#fd4'); ctx.globalAlpha = 1; }
  ctx.fillStyle = '#3a4a2a'; ctx.fillRect(W / 2 - 70, H - 54, 140, 34); ctx.strokeStyle = '#ee8'; ctx.strokeRect(W / 2 - 70, H - 54, 140, 34); text('BACK', W / 2, H - 31, 16, 'center');
  text('Up/Down: weapon  ·  Left/Right + Enter: equip skin  ·  R: turn  ·  1-4: attachments  ·  Esc: back', W / 2, H - 6, 10, 'center', '#889');
}
