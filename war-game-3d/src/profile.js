// ---------- Progression: XP, levels, unlocked starting perks, saved records ----------
const PROFILE_KEY = 'war3d-profile';
let profile = { v: 1, xp: 0, kills: 0, games: 0, wins: 0, bestScore: 0, bestWave: 0, bestPlace: 99, survival: [], br: [], mission: [] }, runResult = null;
function saveProfile() { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) {} }
function loadProfile() {
  try { const j = JSON.parse(localStorage.getItem(PROFILE_KEY)); if (j && j.v === 1) Object.assign(profile, j); } catch (e) {}
  try { const old = +localStorage.getItem('war3d-best') || 0; if (old > profile.bestScore) profile.bestScore = old; } catch (e) {}
}
const xpNeed = L => 100 + 60 * (L - 1);                              // XP needed to go from level L to L+1
function levelOf(xp) { let L = 1; while (xp >= xpNeed(L)) { xp -= xpNeed(L); L++; } return { level: L, into: xp, need: xpNeed(L) }; }
// Perks are unlocked by level and give you a better start in Survival mode (Battle Royale is always a fair fight)
const PERKS = [
  { lvl: 2,  name: 'Field Kit',     desc: 'Start with +2 bandages',            apply: p => { p.bandages += 2; } },
  { lvl: 3,  name: 'Medic Pouch',   desc: 'Start with +1 medkit',              apply: p => { p.medkits += 1; } },
  { lvl: 4,  name: 'Quiet Start',   desc: 'Start with a silencer in the bag',  apply: p => { p.attInv.silencer++; } },
  { lvl: 5,  name: 'Plate Carrier', desc: 'Start with 25 armor',               apply: p => { p.armor = Math.max(p.armor, 25); } },
  { lvl: 6,  name: 'Optics',        desc: 'Start with a scope in the bag',     apply: p => { p.attInv.scope++; } },
  { lvl: 8,  name: 'Frag Pack',     desc: 'Start with +2 grenades',            apply: p => { p.grenades += 2; } },
  { lvl: 10, name: 'Gunsmith Kit',  desc: 'Extended mag and laser in the bag', apply: p => { p.attInv.extmag++; p.attInv.laser++; } },
  { lvl: 12, name: 'Veteran',       desc: 'Start with +15 max HP',             apply: p => { p.maxHp += 15; p.hp = p.maxHp; } },
  { lvl: 15, name: 'Ammo Hoarder',  desc: 'One spare magazine for every gun',  apply: p => { for (const k in p.guns) p.guns[k].res += WEAPONS[k].mag; } },
];
function applyPerks(p) { const L = levelOf(profile.xp).level; for (const k of PERKS) if (L >= k.lvl) k.apply(p); }
function nextPerk() { const L = levelOf(profile.xp).level; return PERKS.find(k => k.lvl > L); }
function finishRun(r) {                                               // r: { mode, win, place, score, wave, kills }
  const before = levelOf(profile.xp).level;
  const xp = r.mode === 'mission' ? r.wave * 60 + r.kills * 3 + Math.floor(r.score / 8) : r.mode === 'br' ? r.kills * 40 + Math.max(0, BR.total + 1 - r.place) * 8 + (r.win ? 250 : 0) : Math.floor(r.score / 5) + r.wave * 20 + r.kills * 3;
  const score = r.mode === 'mission' ? r.score : r.mode === 'br' ? r.kills * 100 + Math.max(0, BR.total + 1 - r.place) * 20 + (r.win ? 500 : 0) : r.score;
  profile.xp += xp; profile.kills += r.kills; profile.games++; if (r.win) profile.wins++;
  if (r.mode === 'br') profile.bestPlace = Math.min(profile.bestPlace, r.place); else if (r.mode === 'mission') profile.bestMissions = Math.max(profile.bestMissions || 0, r.wave); else profile.bestWave = Math.max(profile.bestWave, r.wave);
  profile.bestScore = Math.max(profile.bestScore, score);
  const list = profile[r.mode === 'br' ? 'br' : r.mode === 'mission' ? 'mission' : 'survival'];
  list.push({ score, kills: r.kills, wave: r.wave, place: r.place, win: !!r.win, map: selectedMap, ch: CHARACTERS[selectedChar].name, t: Date.now(), xp });
  list.sort((a, b) => b.score - a.score); list.length = Math.min(list.length, 10);
  saveProfile();
  const after = levelOf(profile.xp).level;
  return { xp, score, level: after, up: after > before, perks: PERKS.filter(k => k.lvl > before && k.lvl <= after), mode: r.mode, win: r.win, place: r.place, kills: r.kills, wave: r.wave };
}
function drawProfileBar() {                                           // menu: level and XP at the top left
  const L = levelOf(profile.xp);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(10, 8, 226, 52);
  text(`LEVEL ${L.level}`, 18, 28, 16, 'left', '#ee8'); text(`${profile.xp} XP`, 228, 28, 11, 'right', '#cdb');
  ctx.fillStyle = '#233'; ctx.fillRect(18, 35, 210, 7); ctx.fillStyle = '#7c4'; ctx.fillRect(18, 35, 210 * L.into / L.need, 7);
  const np = nextPerk(); text(np ? `Next: Lv ${np.lvl} ${np.name}` : 'All perks unlocked', 18, 54, 10, 'left', '#9a9');
}
const recBtn = () => ({ x: W - 118, y: 10, w: 108, h: 26 });
const overRec = () => { const r = recBtn(); return mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h; };
function drawRecBtn() { const r = recBtn(); ctx.fillStyle = overRec() ? '#3c4a2e' : '#262f1e'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = '#9ab07a'; ctx.strokeRect(r.x, r.y, r.w, r.h); text('Records [R]', r.x + r.w / 2, r.y + 18, 12, 'center', '#dfe8c8'); }
function drawRunSummary() {                                           // game-over screen: what this run earned
  const r = runResult; if (!r) return; const L = levelOf(profile.xp), shown = r.perks.slice(0, 2), more = r.perks.length - shown.length, h = 128 + shown.length * 16 + (more > 0 ? 16 : 0);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(10, 8, 236, h); ctx.strokeStyle = '#9ab07a'; ctx.strokeRect(10, 8, 236, h);
  text(r.mode === 'br' ? (r.win ? 'VICTORY' : `ELIMINATED  #${r.place}`) : r.mode === 'mission' ? `MISSIONS ${r.wave}` : `WAVE ${r.wave}`, 20, 32, 16, 'left', r.win ? '#8f8' : '#ee8');
  text(`Score ${r.score}   Kills ${r.kills}`, 20, 54, 13, 'left', '#fff'); text(`+${r.xp} XP`, 20, 74, 15, 'left', '#9e9');
  ctx.fillStyle = '#233'; ctx.fillRect(20, 82, 210, 8); ctx.fillStyle = '#7c4'; ctx.fillRect(20, 82, 210 * L.into / L.need, 8);
  text(`Level ${L.level}`, 20, 106, 13, 'left', '#ee8'); if (r.up) text('LEVEL UP!', 230, 106, 13, 'right', '#ff8');
  shown.forEach((k, i) => text(`Unlocked: ${k.name}`, 20, 126 + i * 16, 12, 'left', '#8cf')); if (more > 0) text(`+${more} more perks (see Records)`, 20, 126 + shown.length * 16, 11, 'left', '#8cf');
}
function drawRecords() {
  ctx.fillStyle = 'rgba(8,12,6,0.92)'; ctx.fillRect(0, 0, W, H);
  text('RECORDS', W / 2, 62, 36, 'center');
  const L = levelOf(profile.xp);
  text(`Level ${L.level}   ${profile.xp} XP   ·   Games ${profile.games}   Wins ${profile.wins}   Kills ${profile.kills}   ·   Best wave ${profile.bestWave}   Best place ${profile.bestPlace === 99 ? '-' : '#' + profile.bestPlace}`, W / 2, 92, 13, 'center', '#cdb');
  const col = (x, title, list, fmt) => {
    text(title, x, 135, 17, 'left', '#ee8'); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, 142, 270, 1);
    if (!list.length) text('No runs yet', x, 170, 13, 'left', '#778');
    list.slice(0, 8).forEach((r, i) => { const d = new Date(r.t); text(`${i + 1}. ${String(r.score).padStart(5)}  ${fmt(r)}`, x, 168 + i * 24, 12, 'left', i === 0 ? '#fff' : '#cdb'); text(`${d.getMonth() + 1}/${d.getDate()}`, x + 270, 168 + i * 24, 10, 'right', '#889'); });
  };
  const mapName = id => (id === 'proc' ? 'Field' : id === 'kochi' ? 'Kochi' : id === 'prague' ? 'Prague' : id);
  col(20, 'SURVIVAL', profile.survival, r => `W${r.wave} ${r.kills}k ${mapName(r.map)}`);
  col(318, 'BATTLE ROYALE', profile.br, r => `${r.win ? 'WIN' : '#' + r.place} ${r.kills}k ${mapName(r.map)}`);
  col(616, 'MISSIONS', profile.mission || [], r => `${r.wave} done ${r.kills}k ${mapName(r.map)}`);
  text('Perks (Survival mode)', W / 2, 400, 16, 'center', '#ee8');
  PERKS.forEach((k, i) => { const x = 60 + (i % 3) * 270, y = 428 + Math.floor(i / 3) * 40, on = L.level >= k.lvl; text(`Lv ${k.lvl}  ${k.name}`, x, y, 13, 'left', on ? '#9e9' : '#667'); text(k.desc, x, y + 15, 10, 'left', on ? '#bcb' : '#556'); });
  text('Click or press R / Esc to go back', W / 2, H - 16, 13, 'center', '#ee8');
}
loadProfile();
