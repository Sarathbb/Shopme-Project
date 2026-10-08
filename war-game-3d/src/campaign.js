// ---------- Campaign: Operation Monsoon, six chapters across Kochi, with briefings, debriefs, stars and a final boss ----------
const CAMP = { on: false, i: 0, sel: 0, prevMap: null, res: null, bt: 0 };
const CHAPTERS = [
  { name: 'LANDFALL', map: 'kochi', time: 6.6, weather: 'cloudy', type: 'capture', par: 170,
    brief: ['Dawn over Fort Kochi. Overnight, the Dagan Syndicate seized the old harbour district, closed the ferries and put its gunmen in the streets.',
      'Your team is the first ashore. Before anything else we need a foothold: take the square by the Chinese fishing nets and hold it long enough for the second wave to land.'],
    radio: 'HQ: Landfall confirmed. Take the zone and hold it.', outro: ['The square is ours and the landing craft are coming in. Prisoners say the Syndicate has taken hostages, among them a harbour engineer who knows the port defences.', 'Rest while you can. Tonight we go in quietly.'] },
  { name: 'SILENT TIDE', map: 'kochi', time: 23.2, weather: 'clear', type: 'rescue', par: 260,
    brief: ['Night. Dr. Menon, the harbour engineer, is held in a guarded compound near the waterfront. If the guards raise the alarm the Syndicate will move him and we lose our only chance.',
      'Go in quiet. Stay low, use the dark, distract the guards with a bottle if you need to. Cut the ropes, then walk him back to the extraction point.'],
    radio: 'HQ: Stealth op. Nobody should know you were there.', outro: ['Dr. Menon is safe. He tells us the Syndicate is moving weapons out of Thoppumpady by road, trucks leaving each hour for the northern districts.', 'Those trucks have to be stopped.'] },
  { name: 'HARBOUR ROAD', map: 'thoppumpady', time: 18.4, weather: 'cloudy', type: 'convoy', par: 200,
    brief: ['Dusk at Thoppumpady. The convoy carries rockets and ammunition and it is already rolling. Two trucks and a jeep, with an armed escort that will close on you the moment you get near.',
      'Burn every vehicle before it reaches the end of the road. If even one gets through, those weapons will be used on the city.'],
    radio: 'HQ: Convoy is moving. Stop every truck.', outro: ['The convoy is burning, but the Syndicate is not finished. Their radio relay on the headland is jamming our signals and directing their fighters.', 'We will keep a base there until engineers can take it over.'] },
  { name: 'HOLD THE RELAY', map: 'thoppumpady', time: 14, weather: 'rain', type: 'defend', par: 120,
    brief: ['Monsoon rain. Our engineers have a signal relay on the headland, and the Syndicate has sent everything it has to retake it.',
      'Defend the relay until the engineers have the network back online. If it falls, the whole operation goes blind. Use cover, mind your ammunition, and keep your squad close.'],
    radio: 'HQ: Relay is live. Hold until the link is stable.', outro: ['The network is up, and the first thing it brings is a name: Quartermaster Voss, who runs the Syndicate supply chain from a guarded villa in Fort Kochi.', 'Take him out and the Syndicate will have nothing to fight with.'] },
  { name: 'THE QUARTERMASTER', map: 'kochi', time: 12, weather: 'clear', type: 'eliminate', par: 280,
    brief: ['Midday, Fort Kochi. Voss is armoured, heavily guarded and sitting at the centre of a ring of patrols.',
      'He is the target. Find him on the radar, deal with the guards however you like (quietly if you can) and finish him before reinforcements arrive. A raised alarm will bring more fighters.'],
    radio: 'HQ: Voss is in the compound. Eliminate the target.', outro: ['Voss is down. With the supply lines cut, the Syndicate has one card left. Dagan himself has taken a stand at Thoppumpady with everything he has.', 'It ends tonight.'] },
  { name: 'DAGAN', map: 'thoppumpady', time: 1.6, weather: 'storm', type: 'boss', par: 330,
    brief: ['Storm over Thoppumpady. The warlord has no more trucks, no more hostages, and nowhere left to run.',
      'He wears heavy armour, fires in spreads, and when he is hurt he will call in a gunship. His fighters will keep coming until he falls. Take cover, keep moving, and finish this.'],
    radio: 'HQ: This is it. Bring Dagan down.', outro: ['Dagan has fallen. By dawn the ferries are running again, the streets are quiet, and the people of Kochi are coming home.', 'Operation Monsoon is complete.'] },
];
const campCh = () => CHAPTERS[CAMP.i];
function campWorld(c) { selectedMap = c.map; TOD.auto = false; TOD.hour = c.time; setWeather(c.weather); Object.assign(WX.cur, WEATHERS[c.weather]); WX.auto = false; }
function campRadio(msg) { if (SQUAD.list.length) squadSay('HQ', msg.replace(/^HQ: /, '')); else notify(msg); }
function campBrief() { state = 'briefing'; CAMP.bt = 0; Sound.engineOff(); Sound.ui(); }
function campGo() {                                                  // briefing accepted: the chapter's mission begins
  const c = campCh(); MS.n = CAMP.i; MS.done = CAMP.i; MS.deck = [c.type]; MS.cur = null; state = 'playing'; nextMission(); tryLock();
  setTimeout(() => { if (state === 'playing' && CAMP.on) campRadio(c.radio); }, 1800);
}
function campLoad(i) {                                               // next chapter: new map, weather and time; the soldier keeps weapons, kit and upgrades
  CAMP.i = i; const c = campCh(); clearMissionObjects(); MS.cur = null; campWorld(c); Sound.engineOff();
  for (const e of enemies) removeMesh(e.mesh); enemies = []; bullets = []; enemyBullets = []; clearPickupMeshes(); pickups = []; particles = []; grenades = []; boss = null; smokes = [];
  resetEvents(); generateMap(); clearDecals(); resetDestruct(); spawnAmbient(); playerBuilding = null;
  Object.assign(player, { x: SPAWN.x, y: SPAWN.y, vx: 0, vy: 0, driving: null, enter: null, bleed: 0, heal: null }); player.fy = player.fyVis = floorY(player.x, player.y);
  player.hp = Math.min(player.maxHp, player.hp + (player.maxHp - player.hp) * 0.5 + 20);
  clearSquad(); spawnSquad(); campBrief();
}
function campDone() {                                                // chapter complete: stars, XP, saved progress
  const c = campCh(), t = MS.cur.t, last = CAMP.i === CHAPTERS.length - 1, hpOk = player.hp >= player.maxHp * 0.5, fast = t <= c.par, stars = 1 + (hpOk ? 1 : 0) + (fast ? 1 : 0);
  const xp = 150 + stars * 50 + (last ? 400 : 0), old = profile.camp.stars[CAMP.i] || 0;
  profile.camp.done = Math.max(profile.camp.done, CAMP.i + 1); profile.camp.stars[CAMP.i] = Math.max(old, stars); profile.xp += xp; saveProfile();
  CAMP.res = { stars, t, xp, hpOk, fast, last, par: c.par }; CAMP.sel = Math.min(CHAPTERS.length - 1, CAMP.i + 1); state = 'debrief'; Sound.wave();
}
function campNext() { if (CAMP.res.last) { endRun(true); return; } offerUpgrades(); }
function campKey(k) {
  if (state === 'briefing') { if (k === 'enter' || k === ' ') campGo(); else if (k === 'escape') { if (CAMP.prevMap) selectedMap = CAMP.prevMap; CAMP.on = false; state = 'menu'; } }
  else if (k === 'enter' || k === ' ') campNext();
}
function campClick() { if (state === 'briefing') campGo(); else campNext(); }
const campStars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
function wrapText(str, maxW, size) {
  ctx.font = `${size}px monospace`; const out = []; let line = '';
  for (const w of str.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
function drawBriefing() {
  const c = campCh(); ctx.fillStyle = 'rgba(6,10,6,0.78)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(110, 50, W - 220, H - 130); ctx.strokeStyle = '#9ab07a'; ctx.strokeRect(110, 50, W - 220, H - 130);
  text('OPERATION MONSOON', W / 2, 84, 14, 'center', '#9a9'); text(`CHAPTER ${CAMP.i + 1}  ·  ${c.name}`, W / 2, 124, 34, 'center', '#ee8');
  const mapName = (REAL_MAPS[c.map] ? REAL_MAPS[c.map].name : c.map), tm = `${String(Math.floor(c.time)).padStart(2, '0')}:${String(Math.floor((c.time % 1) * 60)).padStart(2, '0')}`;
  text(`${mapName}  ·  ${tm}  ·  ${c.weather}`, W / 2, 150, 13, 'center', '#cdb');
  let y = 196; for (const p of c.brief) { for (const ln of wrapText(p, W - 280, 15)) { text(ln, 140, y, 15, 'left', '#e8eedd'); y += 22; } y += 12; }
  ctx.fillStyle = 'rgba(255,230,120,0.08)'; ctx.fillRect(140, y + 4, W - 280, 40); text('OBJECTIVE', 154, y + 22, 11, 'left', '#9a9'); text(MTYPES[c.type], 154, y + 39, 16, 'left', '#fd4');
  text(`Par ${Math.floor(c.par / 60)}:${String(c.par % 60).padStart(2, '0')}  ·  best ${campStars(profile.camp.stars[CAMP.i] || 0)}`, W - 154, y + 39, 12, 'right', '#cdb');
  const sq = SQUAD.list.length ? 'Squad: ' + SQUAD.list.map(a => a.name).join(', ') : 'Going in alone'; text(sq, 140, H - 116, 12, 'left', '#8cf');
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300); ctx.globalAlpha = pulse; text(touch.on ? 'TAP TO BEGIN' : 'PRESS ENTER OR CLICK TO BEGIN', W / 2, H - 90, 18, 'center', '#ee8'); ctx.globalAlpha = 1;
}
function drawDebrief() {
  const c = campCh(), r = CAMP.res; ctx.fillStyle = 'rgba(6,10,6,0.78)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(110, 50, W - 220, H - 130); ctx.strokeStyle = '#9ab07a'; ctx.strokeRect(110, 50, W - 220, H - 130);
  text(r.last ? 'CAMPAIGN COMPLETE' : 'CHAPTER COMPLETE', W / 2, 98, 32, 'center', '#8f8'); text(`${c.name}`, W / 2, 124, 16, 'center', '#ee8');
  text(campStars(r.stars), W / 2, 172, 40, 'center', '#fd4');
  const row = (y, ok, a, b) => { text(ok ? '★' : '☆', 220, y, 14, 'left', ok ? '#fd4' : '#667'); text(a, 244, y, 13, 'left', ok ? '#dde' : '#889'); text(b, W - 220, y, 12, 'right', '#9ab'); };
  const mm = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  row(206, true, 'Chapter complete', ''); row(228, r.hpOk, 'Finish with at least half your health', ''); row(250, r.fast, `Finish under par (${mm(r.par)})`, `your time ${mm(r.t)}`);
  text(`+${r.xp} XP`, W / 2, 288, 18, 'center', '#9e9'); let y = 322; for (const p of c.outro) { for (const ln of wrapText(p, W - 280, 14)) { text(ln, 140, y, 14, 'left', '#e8eedd'); y += 21; } y += 10; }
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300); ctx.globalAlpha = pulse; text(r.last ? (touch.on ? 'TAP TO FINISH' : 'PRESS ENTER TO FINISH') : (touch.on ? 'TAP FOR NEXT CHAPTER' : 'PRESS ENTER FOR NEXT CHAPTER'), W / 2, H - 92, 18, 'center', '#ee8'); ctx.globalAlpha = 1;
}
function campMenuLine() {
  const n = CAMP.sel, c = CHAPTERS[n];
  return `Mode: CAMPAIGN  -  chapter ${n + 1}/6: ${c.name} ${campStars(profile.camp.stars[n] || 0)}   ([ ] chapter, B mode)`;
}
