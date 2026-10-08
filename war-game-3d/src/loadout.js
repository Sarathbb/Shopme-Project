// ---------- Loadout and weapon mastery: unlock guns, attachments and kits by level; every gun levels up with its own kills ----------
const WUNLOCK = [1, 4, 2, 6, 8, 10, 13];                                        // player level that unlocks each weapon (indices match WEAPONS: rifle, shotgun, SMG, sniper); your soldier's own gun is always open
const AUNLOCK = { silencer: 3, scope: 5, laser: 7, extmag: 9 };
const MASTERY_AT = [0, 15, 45, 100, 180];                            // kills with a weapon needed for mastery level 1..5
const MASTERY_TXT = ['', '+8% damage', 'Tighter spread', 'Faster reload', '+10% damage and +10% magazine'];
const LKITS = [
  { id: 'assault', name: 'Assault pack', lvl: 1, desc: '+2 frag grenades', apply: p => { p.grenades += 2; } },
  { id: 'medic', name: 'Medic pack', lvl: 1, desc: '+2 bandages, +1 medkit', apply: p => { p.bandages += 2; p.medkits += 1; } },
  { id: 'armor', name: 'Armour plates', lvl: 3, desc: 'Start with 30 armor', apply: p => { p.armor = Math.max(p.armor, 30); } },
  { id: 'recon', name: 'Recon pack', lvl: 5, desc: '+2 smoke, +2 flash, +2 bottles', apply: p => { p.smokes += 2; p.flashes += 2; p.bottles += 2; } },
  { id: 'ammo', name: 'Ammo bearer', lvl: 7, desc: 'Two spare magazines for each gun', apply: p => { for (const k in p.guns) p.guns[k].res += WEAPONS[k].mag * 2; } },
];
const LO = { focus: 0 };
function weaponSkinId(i) { const id = profile.wskin && profile.wskin[i], s = GUN_SKINS[id]; return s && masteryLvl(i) >= s.lvl ? id : 'std'; }
const weaponOpen = i => i === CHARACTERS[selectedChar].weapon || myLevel() >= WUNLOCK[i];
const attOpen = k => myLevel() >= AUNLOCK[k], kitOpen = k => myLevel() >= k.lvl;
function masteryLvl(i) { const k = (profile.wk && profile.wk[i]) || 0; let L = 1; while (L < 5 && k >= MASTERY_AT[L]) L++; return L; }
function masteryK(i) {                                                // bonuses in force for weapon i (off in Battle Royale and the Daily so those stay a fair fight)
  const o = { dmg: 1, spread: 1, reload: 1, mag: 1 };
  if (gameMode === 'br' || (typeof DAILY !== 'undefined' && DAILY.on)) return o;
  const L = masteryLvl(i); if (L >= 2) o.dmg *= 1.08; if (L >= 3) o.spread = 0.88; if (L >= 4) o.reload = 0.85; if (L >= 5) { o.dmg *= 1.1; o.mag = 1.1; }
  return o;
}
function weaponKill(i) {
  if (i === undefined || i < 0) return; if (!profile.wk) profile.wk = [];
  const before = masteryLvl(i); profile.wk[i] = (profile.wk[i] || 0) + 1; const after = masteryLvl(i);
  if (after > before) { notify(`${WEAPONS[i].name} mastery ${after}: ${MASTERY_TXT[after - 1]}`); Sound.wave(); saveProfile(); }
}
function loadoutSan() {                                               // the saved choice, corrected for what is actually unlocked right now
  const s = profile.loadout || {}, ch = CHARACTERS[selectedChar];
  let pri = s.pri !== undefined && weaponOpen(s.pri) ? s.pri : ch.weapon;
  let sec = s.sec !== undefined && s.sec >= 0 && s.sec !== pri && weaponOpen(s.sec) ? s.sec : -1;
  const att = (s.att || []).filter(k => AUNLOCK[k] && attOpen(k)).slice(0, 2);
  const kit = LKITS.find(k => k.id === s.kit && kitOpen(k)) ? s.kit : 'assault';
  return { pri, sec, att, kit };
}
function applyLoadout(p) {
  const L = loadoutSan(), mk = (i, res) => ({ ammo: WEAPONS[i].mag, res: WEAPONS[i].mag * res, att: {} });
  p.guns = {}; p.guns[L.pri] = mk(L.pri, 3); if (L.sec >= 0) p.guns[L.sec] = mk(L.sec, 2); p.weaponIdx = L.pri;
  for (const k of L.att) { const slot = ATTS[k].slot; if (slot === 'optic' && WEAPONS[L.pri].scoped) { p.attInv[k]++; continue; } p.guns[L.pri].att[slot] = true; }
  p.guns[L.pri].ammo = p.magSize;
  LKITS.find(k => k.id === L.kit).apply(p);
}
function openLoadout() { LO.focus = loRows().length - 2; state = 'loadout'; Sound.ui(); }
function closeLoadout() { saveProfile(); state = 'menu'; Sound.ui(); }
function loRows() {                                                   // every clickable thing on the screen, in the order the arrow keys walk through
  const r = [];
  for (let i = 0; i < WEAPONS.length; i++) r.push({ k: 'pri', i, x: 40 + (i % 4) * 101, y: 104 + Math.floor(i / 4) * 36, w: 97, h: 30 });
  r.push({ k: 'sec', x: 40, y: 200, w: 400, h: 30 });
  for (let i = 0; i < 4; i++) r.push({ k: 'att', i, x: 40, y: 274 + i * 34, w: 400, h: 30 });
  for (let i = 0; i < LKITS.length; i++) r.push({ k: 'kit', i, x: 470, y: 104 + i * 34, w: 390, h: 30 });
  for (let i = 0; i < 2; i++) r.push({ k: 'squad', i, x: 470, y: 296 + i * 34, w: 390, h: 30 });
  r.push({ k: 'deploy', x: W / 2 - 80, y: H - 62, w: 160, h: 38 }); r.push({ k: 'back', x: 40, y: H - 62, w: 110, h: 38 });
  return r;
}
function loAct(r) {
  const s = profile.loadout = loadoutSan();
  if (r.k === 'deploy') { saveProfile(); return start(); }
  if (r.k === 'back') return closeLoadout();
  if (r.k === 'pri') { if (!weaponOpen(r.i)) { notify(`${WEAPONS[r.i].name} unlocks at level ${WUNLOCK[r.i]}`); return; } s.pri = r.i; if (s.sec === r.i) s.sec = -1; }
  else if (r.k === 'sec') { const opts = [-1, 0, 1, 2, 3, 4, 5, 6].filter(i => i < 0 || (i !== s.pri && weaponOpen(i))); s.sec = opts[(opts.indexOf(s.sec) + 1) % opts.length]; }
  else if (r.k === 'att') { const k = Object.keys(AUNLOCK)[r.i]; if (!attOpen(k)) { notify(`${ATTS[k].name} unlocks at level ${AUNLOCK[k]}`); return; } const at = s.att.slice(); const j = at.indexOf(k); if (j >= 0) at.splice(j, 1); else if (at.length < 2) at.push(k); else { notify('Two attachments at most - drop one first'); return; } s.att = at; }
  else if (r.k === 'squad') { if (SET.squad < r.i + 1) { notify('Turn on more teammates in Settings > GAMEPLAY'); return; } if (!profile.squadRoles) profile.squadRoles = []; const cur = roleOf(r.i); profile.squadRoles[r.i] = ROLE_KEYS[(ROLE_KEYS.indexOf(cur) + 1) % ROLE_KEYS.length]; }
  else if (r.k === 'kit') { const k = LKITS[r.i]; if (!kitOpen(k)) { notify(`${k.name} unlocks at level ${k.lvl}`); return; } s.kit = k.id; }
  Sound.ui(); saveProfile();
}
function loadoutKey(k) {
  const rows = loRows();
  if (k === 'escape') return closeLoadout();
  if (k === 'arrowdown' || k === 's') LO.focus = (LO.focus + 1) % rows.length; else if (k === 'arrowup' || k === 'w') LO.focus = (LO.focus + rows.length - 1) % rows.length;
  else if (k === 'enter' || k === ' ') loAct(rows[LO.focus]);
}
function clickLoadout() { const rows = loRows(); rows.forEach((r, i) => { if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) { LO.focus = i; loAct(r); } }); }
function drawLoadout() {
  ctx.fillStyle = 'rgba(8,12,6,0.94)'; ctx.fillRect(0, 0, W, H);
  text('LOADOUT', W / 2, 46, 30, 'center'); text(`Level ${myLevel()}  ·  guns, attachments and kits unlock as you rank up; every gun levels up with its own kills`, W / 2, 68, 11, 'center', '#9a9');
  const L = loadoutSan(), rows = loRows(), hdr = (t, x, y) => text(t, x, y, 12, 'left', '#ee8');
  hdr('PRIMARY WEAPON', 40, 98); hdr('SECONDARY (optional)', 40, 194); hdr('ATTACHMENTS FITTED AT START (2 max)', 40, 268); hdr('EQUIPMENT KIT', 470, 98); hdr('SQUAD ROLES (click to change)', 470, 290);
  rows.forEach((r, n) => {
    const foc = n === LO.focus, over = mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h; let lab = '', sub = '', on = false, lock = false, on2 = false;
    if (r.k === 'pri') { lock = !weaponOpen(r.i); on = L.pri === r.i; lab = WEAPONS[r.i].name; sub = lock ? `🔒${WUNLOCK[r.i]}` : `M${masteryLvl(r.i)}`; }
    else if (r.k === 'sec') { lab = 'Secondary:  ' + (L.sec >= 0 ? WEAPONS[L.sec].name : 'none'); sub = 'click to change'; on = L.sec >= 0; }
    else if (r.k === 'att') { const k = Object.keys(AUNLOCK)[r.i]; lock = !attOpen(k); on = L.att.includes(k); lab = ATTS[k].name; sub = lock ? `🔒 Lv ${AUNLOCK[k]}` : on ? 'FITTED' : ''; }
    else if (r.k === 'kit') { const k = LKITS[r.i]; lock = !kitOpen(k); on = L.kit === k.id; lab = k.name; sub = lock ? `🔒 Lv ${k.lvl}` : k.desc; }
    else if (r.k === 'squad') { const on = SET.squad >= r.i + 1, rk = roleOf(r.i); lab = `${NAMES[r.i]}:  ${on ? ROLES[rk].label : 'not in squad'}`; sub = on ? ({ rifleman: 'steady rifle fire', medic: 'heals you and revives', sniper: 'long range, stays back', heavy: 'tough, draws fire' })[rk] : 'Settings > GAMEPLAY'; lock = !on; on2 = on; }
    else if (r.k === 'deploy') { ctx.fillStyle = foc || over ? '#5a7a3a' : '#3a4a2a'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = '#ee8'; ctx.lineWidth = foc ? 3 : 1; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.lineWidth = 1; text('DEPLOY', r.x + r.w / 2, r.y + 26, 18, 'center'); return; }
    else { ctx.fillStyle = foc || over ? '#4a3a2e' : '#2e251c'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = foc ? '#ee8' : '#a08060'; ctx.lineWidth = foc ? 3 : 1; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.lineWidth = 1; text('BACK', r.x + r.w / 2, r.y + 26, 16, 'center'); return; }
    ctx.fillStyle = foc || over ? '#3a4a2c' : '#212a1a'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = on || on2 ? '#8f8' : foc ? '#ee8' : '#555'; ctx.lineWidth = on || on2 || foc ? 2 : 1; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.lineWidth = 1;
    const sm = r.k === 'pri'; text(lab, r.x + (sm ? 7 : 12), r.y + 20, sm ? 11 : 13, 'left', lock ? '#667' : '#dde'); text(sub, r.x + r.w - (sm ? 6 : 10), r.y + 20, sm ? 9 : 11, 'right', lock ? '#889' : on ? '#8f8' : '#9ab');
  });
  const w = L.pri, ml = masteryLvl(w), kills = (profile.wk && profile.wk[w]) || 0, px = 470, py = 372;               // mastery panel for the primary gun
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(px, py, 390, 128); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(px, py, 390, 128);
  text(`${WEAPONS[w].name.toUpperCase()} MASTERY  ${ml}/5`, px + 14, py + 24, 14, 'left', '#ee8'); text(`${kills} kills`, px + 376, py + 24, 12, 'right', '#cdb');
  const next = ml < 5 ? MASTERY_AT[ml] : kills, prev = MASTERY_AT[ml - 1]; ctx.fillStyle = '#233'; ctx.fillRect(px + 14, py + 34, 362, 8); ctx.fillStyle = '#7c4'; ctx.fillRect(px + 14, py + 34, 362 * (ml >= 5 ? 1 : (kills - prev) / (next - prev)), 8);
  for (let i = 1; i < 5; i++) text(`${i + 1}  ${MASTERY_TXT[i]}${i + 1 <= ml ? '' : '   (' + MASTERY_AT[i] + ' kills)'}`, px + 14, py + 60 + (i - 1) * 17, 11, 'left', i + 1 <= ml ? '#8f8' : '#778');
  text('Bonuses apply in Survival, Missions and Campaign', px + 14, py + 122, 9, 'left', '#889');
  if (toast.t > 0) { ctx.globalAlpha = Math.min(1, toast.t); text(toast.text, W / 2, H - 76, 13, 'center', '#fd4'); ctx.globalAlpha = 1; }
  text('Up/Down + Enter, or click  ·  Esc: back  ·  Enter on DEPLOY starts', W / 2, H - 8, 10, 'center', '#889');
}
