// ---------- Daily challenge: the same map, weather, time, loadout, modifier and missions for everyone on a given day ----------
const DAILY = { on: false, off: 0, cfg: null, t: 0, extra: null };
const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function withSeed(seed, fn) { const o = Math.random; Math.random = mulberry32(seed); try { return fn(); } finally { Math.random = o; } }
const DMODS = [
  { id: 'glass', name: 'Glass cannon', desc: 'Only 50 max HP', mult: 1.5, apply: p => { p.maxHp = 50; p.hp = 50; } },
  { id: 'scav', name: 'Scavenger', desc: 'One spare magazine, no more', mult: 1.25, apply: p => { for (const k in p.guns) p.guns[k].res = WEAPONS[k].mag; p.grenades = 1; } },
  { id: 'nohl', name: 'No medics', desc: 'No bandages or medkits, health packs turn into ammo', mult: 1.3, apply: p => { p.bandages = 0; p.medkits = 0; } },
  { id: 'horde', name: 'Horde', desc: 'More enemies, faster', mult: 1.4, apply: () => {} },
  { id: 'sharp', name: 'Sharpshooter', desc: 'Sniper and knife only', mult: 1.3, apply: p => { p.guns = { 3: { ammo: 5, res: 40, att: {} } }; p.weaponIdx = 3; } },
];
const dayKeyOf = off => { const d = new Date(); d.setDate(d.getDate() - off); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
function dailyCfg(off) {
  const key = dayKeyOf(off), r = mulberry32(key * 2654435761 % 4294967296), maps = Object.keys(REAL_MAPS).concat(['proc']), pk = a => a[Math.floor(r() * a.length)];
  const mod = pk(DMODS), types = ['capture', 'rescue', 'defend', 'convoy'].sort(() => r() - 0.5).slice(0, 3);
  return { key, seed: key, map: pk(maps), hour: pk([7, 10, 13, 17, 19.5, 22, 1.5]), weather: pk(['clear', 'clear', 'cloudy', 'rain', 'storm', 'fog']), char: Math.floor(r() * 3), mod, deck: types, mult: mod.mult };
}
const dayLabel = key => { const s = String(key); return `${s.slice(6)}/${s.slice(4, 6)}`; };
const todStr = h => { const hh = Math.floor(h), mm = h % 1 ? '30' : '00'; return String(hh).padStart(2, '0') + ':' + mm; };
function dailyInfoLine() {
  const c = dailyCfg(DAILY.off), best = profile.daily && profile.daily[c.key];
  return `DAILY ${dayLabel(c.key)}${DAILY.off ? ' (replay)' : ''}: ${REAL_MAPS[c.map] ? REAL_MAPS[c.map].name : 'Field'} · ${WEATHERS[c.weather].label} ${todStr(c.hour)} · ${c.mod.name} · best ${best ? best.best : '-'}   ([ ] change day)`;
}
function applyDailyWorld() {                                       // fixed weather and time of day
  const c = DAILY.cfg; TOD.hour = c.hour; TOD.auto = false; WX.auto = false; setWeather(c.weather); Object.assign(WX.cur, WEATHERS[c.weather]);
}
function dailyScore() {
  const c = DAILY.cfg, bonus = Math.max(0, 480 - DAILY.t) * 2; return Math.round((score + (MS.done >= 3 ? bonus : 0)) * c.mult);
}
function shareCode(key, sc) { return `W3D-${key}-${sc.toString(36).toUpperCase()}-${((key * 31 + sc * 7919) % 46656).toString(36).toUpperCase().padStart(3, '0')}`; }
function recordDaily(win) {
  const c = DAILY.cfg, sc = dailyScore(); profile.daily = profile.daily || {};
  const e = profile.daily[c.key] || (profile.daily[c.key] = { best: 0, tries: 0, bestTime: 0, done: false }); e.tries++;
  if (sc > e.best) e.best = sc; if (win && (!e.done || DAILY.t < e.bestTime)) e.bestTime = Math.round(DAILY.t); if (win) e.done = true;
  profile.dailyList = (profile.dailyList || []).filter(x => x.key !== c.key); profile.dailyList.push({ key: c.key, score: e.best, done: e.done, t: Date.now() }); profile.dailyList.sort((a, b) => b.key - a.key); profile.dailyList.length = Math.min(profile.dailyList.length, 10);
  DAILY.extra = { score: sc, code: shareCode(c.key, sc), win, time: Math.round(DAILY.t), modName: c.mod.name, key: c.key }; saveProfile();
}
function copyShare() { const x = DAILY.extra; if (!x) return; try { navigator.clipboard.writeText(x.code).then(() => notify('Share code copied'), () => notify('Copy failed: ' + x.code)); } catch (e) { notify('Share code: ' + x.code); } }
function drawDailyHud() { if (!DAILY.on) return; const m = Math.floor(DAILY.t / 60), s = String(Math.floor(DAILY.t % 60)).padStart(2, '0'); text(`DAILY ${dayLabel(DAILY.cfg.key)}  ·  ${m}:${s}  ·  ${DAILY.cfg.mod.name}`, W - 15, 128 + (ENV.night > 0.5 && !player.torch ? 16 : 0), 11, 'right', '#8cf'); }
function drawDailySummary() {
  const x = DAILY.extra; if (!x || !DAILY.on) return; const bx = 10, by = 176;
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(bx, by, 236, 118); ctx.strokeStyle = '#8cf'; ctx.strokeRect(bx, by, 236, 118);
  text(x.win ? 'DAILY COMPLETE' : 'DAILY FAILED', bx + 118, by + 20, 14, 'center', x.win ? '#8f8' : '#f98'); text(`Score ${x.score}`, bx + 118, by + 42, 17, 'center', '#fff'); text(`${Math.floor(x.time / 60)}:${String(x.time % 60).padStart(2, '0')}  ·  ${x.modName}`, bx + 118, by + 58, 10, 'center', '#cdd');
  const e = profile.daily[x.key]; text(`Best today ${e.best}  ·  tries ${e.tries}`, bx + 118, by + 72, 10, 'center', '#9ab');
  ctx.fillStyle = overShare() ? '#2c4a5e' : '#1c3040'; ctx.fillRect(bx + 10, by + 80, 216, 30); ctx.strokeStyle = '#8cf'; ctx.strokeRect(bx + 10, by + 80, 216, 30); text(x.code, bx + 118, by + 94, 11, 'center', '#cfe'); text('click or Y to copy', bx + 118, by + 106, 8, 'center', '#789');
}
const overShare = () => mouse.x >= 20 && mouse.x <= 236 && mouse.y >= 256 && mouse.y <= 286;
