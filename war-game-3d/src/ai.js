// ---------- Enemy AI: sight and hearing, cover and peeking, flanking, grenades, searching ----------
// aiThink() turns what an infantry enemy knows into a movement direction and a shot decision; update() in game.js applies it.
const AI = { nadeCD: 0 };
const COVER_KINDS = ['crate', 'plank', 'sandbag', 'barrier', 'rock', 'barrel', 'bale', 'container'];
function lineClear(x0, y0, x1, y1) {                       // no solid cover or wall between two points (bullets would get through)
  const hk = lastHitKind, ho = lastHitObs, d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.ceil(d / 16)); let ok = true;
  for (let i = 1; i < n; i++) { const t = i / n; if (bulletBlocked(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) { ok = false; break; } }
  lastHitKind = hk; lastHitObs = ho; return ok && !smokeCuts(x0, y0, x1, y1);
}
function sightOf(e, tgt) {                                 // how far this enemy can see the target right now
  let r = (e.sight || 560) * ENV.vis;
  if (tgt === player) {
    if (player.crouch) r *= 0.75; if (player.sprinting) r *= 1.2;
    if (performance.now() - (player.lastFireT || 0) < 1500) r *= player.gs.att.muzzle ? 1.15 : 1.6;           // muzzle flash gives you away
    if (player.torch || (player.driving && ENV.night > 0.35)) r *= 1 + ENV.night * 0.6;                           // so does a light at night
    if (playerBuilding && playerBuilding.lightOn === false && !player.torch) r *= 0.6;                            // a dark room hides you
    if (buildingAt(e.x, e.y) !== playerBuilding) r *= playerBuilding ? 0.5 : 1;                                   // walls hide you
  }
  return r;
}
function aiNoise(x, y, r, skip) { civScare(x, y, r * 0.8);                                // a shot or explosion: enemies that cannot see you now come to have a look
  for (const e of enemies) if (e !== skip && e.stealth && e.alertT <= 0 && e.hp > 0 && Math.hypot(e.x - x, e.y - y) < r) e.invest = { x: x + rnd(-60, 60), y: y + rnd(-60, 60), t: 8 };
  for (const e of enemies) if (e !== skip && e.ai && !e.stealth && !e.sees && e.hp > 0 && Math.hypot(e.x - x, e.y - y) < r) { e.lastSeen = { x: x + rnd(-80, 80), y: y + rnd(-80, 80) }; e.seenAge = 0; if (e.mode === 'search' || e.mode === 'advance') e.modeT = 0; }
}
function findCover(e, tgt, far) {                          // a solid object I can stand behind so that the target has no line to me
  let best = null, bs = 1e9;
  for (const o of [...nearObs(e.x, e.y, 280)]) {
    if (o.gone || !COVER_KINDS.includes(o.kind) || !KINDS[o.kind].stop) continue;
    const c = obsCenter(o), r = KINDS[o.kind].round ? rad(o) : Math.max(o.hw || 0, o.hh || 0);
    const ux = c.x - tgt.x, uy = c.y - tgt.y, ul = Math.hypot(ux, uy) || 1, off = r + e.r + 14;
    const px = c.x + ux / ul * off, py = c.y + uy / ul * off;
    const dm = Math.hypot(px - e.x, py - e.y), dt = Math.hypot(px - tgt.x, py - tgt.y);
    if (dm > 300 || dt < 90 || (far ? dt < 220 : false)) continue;
    const sc = dm + dt * (far ? -0.5 : 0.3); if (sc >= bs) continue;
    if (!pointFree(px, py, e.r + 3) || lineClear(tgt.x, tgt.y, px, py)) continue;
    bs = sc; best = { x: px, y: py, cx: c.x, cy: c.y, r, ux: ux / ul, uy: uy / ul };
  }
  return best;
}
function enemyGrenade(e, at) {
  const d = clampN(Math.hypot(at.x - e.x, at.y - e.y), 120, 400), a = Math.atan2(at.y - e.y, at.x - e.x), t = d / 300;
  grenades.push({ x: e.x, y: e.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, t, t0: t, enemy: true });
  Sound.grenadeThrow(); notify('Grenade!'); e.gCool = rnd(10, 16); AI.nadeCD = 3.5;
}
function aiThink(e, dt, tgt) {
  const p = { mx: 0, my: 0, spd: 1, hold: false, fire: false, aim: 0, spread: 0.2 };
  if (e.blind > 0) {                                      // flashbanged: stumbling about, cannot see or shoot
    e.blind -= dt; e.sees = false; e.flash = Math.max(e.flash, 0.03); e.blindT = (e.blindT || 0) - dt; if (e.blindT <= 0) { e.blindT = 0.5; e.blindA = Math.random() * 6.28; }
    p.mx = Math.cos(e.blindA || 0); p.my = Math.sin(e.blindA || 0); p.spd = 0.35; return p;
  }
  e.modeT -= dt; e.percT -= dt; e.hurtT += dt; e.gCool -= dt; e.strafeT -= dt; e.seenAge += dt;
  if (e.hp < e.prevHp) e.hurtT = 0; e.prevHp = e.hp;
  // ---- perception, a few times a second ----
  e.alertT -= dt; e.alertFlash -= dt; if (e.invest) { e.invest.t -= dt; if (e.invest.t <= 0) e.invest = null; }
  if (!tgt) e.sees = false;
  else if (e.percT <= 0) {
    const dtp = e.percT = 0.18 + Math.random() * 0.1, d0 = Math.hypot(tgt.x - e.x, tgt.y - e.y), rg = sightOf(e, tgt);
    let can = d0 < rg && lineClear(e.x, e.y, tgt.x, tgt.y);
    if (e.stealth && e.alertT <= 0) {                     // not yet alerted: a guard only sees what is in front of it, and takes time to be sure
      const dir = Math.atan2(tgt.y - e.y, tgt.x - e.x), da = Math.abs(Math.atan2(Math.sin(dir - (e.faceA || 0)), Math.cos(dir - (e.faceA || 0))));
      if (da > 1.05 && d0 > rg * 0.2) can = false;
      if (can) e.susp = d0 < rg * 0.2 ? 1 : e.susp + dtp * (0.3 + 2.0 * (1 - d0 / rg)); else e.susp = Math.max(0, e.susp - dtp * 0.3);
      if (can && e.susp > 0.35) { e.lastSeen = { x: tgt.x, y: tgt.y }; e.seenAge = 0; }
      if (e.susp >= 1 && can) {                           // spotted: this guard and its neighbours turn hostile
        e.alertT = 14; e.alertFlash = 1.6; e.sees = true; Sound.alert && Sound.alert(e.x, e.y);
        for (const o of enemies) if (o !== e && o.stealth && o.hp > 0 && o.alertT <= 0 && Math.hypot(o.x - e.x, o.y - e.y) < 380) o.susp = Math.max(o.susp, 0.75);
      } else e.sees = false;
    } else e.sees = can;
  }
  if (e.sees && tgt) { e.lastSeen = { x: tgt.x, y: tgt.y }; e.seenAge = 0; if (e.stealth) e.alertT = 14; }
  if (e.stealth && e.alertT <= 0 && tgt) {                // unalerted behaviour: investigate noise or suspicion, otherwise patrol
    if (e.susp > 0.35 || e.invest) {
      const at = e.susp > 0.35 ? e.lastSeen : e.invest, dd = Math.hypot(at.x - e.x, at.y - e.y); e.faceA = Math.atan2(at.y - e.y, at.x - e.x);
      if (dd > 60) { p.mx = at.x - e.x; p.my = at.y - e.y; p.spd = e.susp > 0.35 ? 0.35 : 0.6; } else p.hold = true;
      return p;
    }
    if (e.patrol && e.patrol.length) {
      const w = e.patrol[e.pi % e.patrol.length]; if (Math.hypot(w.x - e.x, w.y - e.y) < 24) { e.pi++; e.wait = rnd(0.6, 2.2); }
      e.wait -= dt; if (e.wait > 0) { p.hold = true; return p; }
      const ta = Math.atan2(w.y - e.y, w.x - e.x); p.mx = w.x - e.x; p.my = w.y - e.y; p.spd = 0.4; e.faceA += Math.atan2(Math.sin(ta - e.faceA), Math.cos(ta - e.faceA)) * Math.min(1, dt * 4); return p;
    }
  }
  if (e.radio && tgt && !e.sees && e.seenAge > 6) { e.lastSeen = { x: tgt.x + rnd(-230, 230), y: tgt.y + rnd(-230, 230) }; e.seenAge = 4; }   // squad radio, so a wave cannot stall
  if (!tgt) {                                             // nothing to fight: wander to a destination (battle royale)
    const dest = e.dest; if (dest) { p.mx = dest.x - e.x; p.my = dest.y - e.y; p.spd = 0.8; } else p.hold = true;
    return p;
  }
  const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy) || 1, rng = e.range * ENV.vis, ang = Math.atan2(dy, dx);
  const toward = (x, y, s = 1) => { p.mx = x - e.x; p.my = y - e.y; p.spd = s; };
  // ---- mode changes ----
  if (e.hold) e.mode = e.sees ? 'attack' : 'search';
  else if (e.mode === 'retreat') { if (e.modeT <= 0) { e.mode = 'advance'; } }
  else if (e.hp < e.maxHp * 0.34 && e.sees && !e.retreated && e.type !== 'runner') { e.retreated = true; e.mode = 'retreat'; e.modeT = 4 + Math.random() * 3; e.cover = findCover(e, tgt, true); }
  else if (e.mode === 'cover' || e.mode === 'peek') {
    if (e.mode === 'cover' && e.cover && Math.hypot(e.cover.x - e.x, e.cover.y - e.y) < 14) { if (e.hideT === undefined) e.hideT = 1.2 + Math.random() * 1.6; e.hideT -= dt; if (e.hideT <= 0) { e.mode = 'peek'; e.modeT = 1.0 + Math.random() * 0.9; e.hideT = undefined; e.peeks = (e.peeks || 0) + 1; e.peekSide = Math.random() < 0.5 ? 1 : -1; } }
    else if (e.mode === 'cover' && e.modeT <= 0) { e.mode = 'advance'; e.hideT = undefined; }
    else if (e.mode === 'peek' && e.modeT <= 0) { if (e.peeks > 3) { e.mode = 'attack'; e.peeks = 0; e.cover = null; } else e.mode = 'cover'; }
  } else if (e.sees && e.hurtT < 0.5 && e.type !== 'runner' && Math.random() < dt * 2.5) {
    const c = findCover(e, tgt, false); if (c) { e.cover = c; e.mode = 'cover'; e.modeT = 4; e.hideT = undefined; }
  } else if (!e.sees) { if (e.mode !== 'search' || e.modeT < -1) { e.mode = e.seenAge < 12 ? 'search' : 'advance'; } }
  else if (e.role === 'flank' && d > 240) e.mode = 'flank';
  else e.mode = d < rng * 0.6 ? 'attack' : 'advance';
  if (e.mode === 'flank' && (d < 240 || e.sees && d < rng * 0.5)) { e.role = 'assault'; e.mode = 'attack'; }
  if (e.cover == null && (e.mode === 'cover' || e.mode === 'peek')) e.mode = 'advance';
  // ---- movement for the mode ----
  switch (e.mode) {
    case 'advance': if (e.sees) toward(tgt.x, tgt.y); else toward(e.lastSeen.x, e.lastSeen.y); if (e.type === 'runner') { p.mx += -dy / d * Math.sin(performance.now() / 260 + e.phase) * 70; p.my += dx / d * Math.sin(performance.now() / 260 + e.phase) * 70; } break;
    case 'attack': {
      if (e.strafeT <= 0) { e.strafeT = 1 + Math.random() * 1.4; e.strafeDir = Math.random() < 0.5 ? 1 : -1; }
      const sd = e.strafeDir || 1, back = e.type === 'sniper' ? (d < rng * 0.45 ? -1 : 0) : (d < rng * 0.28 ? -0.7 : d > rng * 0.55 ? 0.5 : 0);
      p.mx = -dy / d * sd + dx / d * back; p.my = dx / d * sd + dy / d * back; p.spd = e.type === 'sniper' ? 0.35 : 0.55; if (e.type === 'sniper' && Math.random() < dt * 0.4) p.hold = true; break;
    }
    case 'flank': { const a = Math.atan2(e.y - tgt.y, e.x - tgt.x) + (e.flankSide || 1) * 0.35; toward(tgt.x + Math.cos(a) * 250, tgt.y + Math.sin(a) * 250, 1.05); break; }
    case 'cover': { const c = e.cover; if (Math.hypot(c.x - e.x, c.y - e.y) < 14) p.hold = true; else toward(c.x, c.y, 1.1); break; }
    case 'peek': { const c = e.cover, s = e.peekSide || 1, off = c.r + 20; toward(c.cx - c.uy * s * off + c.ux * (c.r * 0.2), c.cy + c.ux * s * off + c.uy * (c.r * 0.2), 0.8); if (Math.hypot(p.mx, p.my) < 8) p.hold = true; break; }
    case 'search': {
      const ls = e.lastSeen; if (Math.hypot(ls.x - e.x, ls.y - e.y) > 50) toward(ls.x, ls.y, 0.9);
      else { if (e.wanderT === undefined || e.wanderT <= 0) { e.wanderT = 1.5 + Math.random(); e.wander = { x: ls.x + rnd(-130, 130), y: ls.y + rnd(-130, 130) }; } e.wanderT -= dt; toward(e.wander.x, e.wander.y, 0.6); if (e.seenAge > 11) e.modeT = -2; }
      break;
    }
    case 'retreat': if (e.cover && Math.hypot(e.cover.x - e.x, e.cover.y - e.y) > 14) toward(e.cover.x, e.cover.y, 1.2); else if (!e.cover) { p.mx = -dx; p.my = -dy; p.spd = 1.1; } else p.hold = true; break;
  }
  if (e.hold) p.hold = true;
  // ---- keep apart from friends ----
  let sx = 0, sy = 0; for (const o of enemies) if (o !== e && o.hp > 0) { const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy); if (od < 34 && od > 0.1) { sx += ox / od * (34 - od); sy += oy / od * (34 - od); } }
  if (!p.hold) { const l = Math.hypot(p.mx, p.my) || 1; p.mx = p.mx / l * 100 + sx * 3; p.my = p.my / l * 100 + sy * 3; }
  // ---- shooting: only with a clear line, and not while running for cover ----
  const aimOK = e.sees && d < rng && (e.mode === 'attack' || e.mode === 'peek' || e.mode === 'advance' || e.mode === 'flank' || e.mode === 'retreat' && Math.random() < 0.3);
  if (aimOK) {
    p.fire = true; const lead = tgt === player ? d / (e.bspeed || 300) * 0.55 : 0, tx = tgt.x + (tgt.vx || 0) * lead, ty = tgt.y + (tgt.vy || 0) * lead;
    p.aim = Math.atan2(ty - e.y, tx - e.x); p.spread = (e.type === 'sniper' ? 0.025 : 0.1) + (d / Math.max(rng, 1)) * 0.14 + (e.mode === 'attack' ? 0.03 : 0);
  } else p.aim = ang;
  // ---- grenades at a player who is hiding ----
  if (tgt === player && e.canNade && e.gCool <= 0 && AI.nadeCD <= 0 && d > 150 && d < 380 && (!e.sees && e.seenAge < 6 || (e.sees && player.speedNow < 25 && Math.random() < dt * 0.4))) enemyGrenade(e, e.sees ? player : e.lastSeen);
  return p;
}

function aiFire(e, plan) {                                    // one volley from an AI soldier, according to its weapon
  const n = e.pellets || 1, sp = (e.pellets ? 0.3 : plan.spread);
  for (let i = 0; i < n; i++) fire(e, plan.aim + (Math.random() - 0.5) * 2 * sp, e.bspeed, e.bdmg);
  e.cool = e.rate * (0.9 + Math.random() * 0.5);
}
function chooseTarget(e) {                                    // waves: always the player. Battle royale: the nearest living fighter in range. Defend mission: the base when it is closer
  if (gameMode === 'mission' && MS.cur && MS.cur.type === 'defend' && MS.cur.base.hp > 0 && !e.guard) { const b = MS.cur.base; return Math.hypot(b.x - e.x, b.y - e.y) < Math.hypot(player.x - e.x, player.y - e.y) * 1.25 ? b : player; }
  if (gameMode !== 'br') {                                 // a living teammate that is clearly closer draws fire away from the player
    if (!SQUAD.list.length) return player;
    e.tgtT = (e.tgtT || 0) - 0.016; if (e.tgt && e.tgtT > 0 && (e.tgt === player || (e.tgt.state === 'ok' && e.tgt.hp > 0))) return e.tgt;
    e.tgtT = 0.8; let best = player, bd = Math.hypot(player.x - e.x, player.y - e.y) * 0.8;
    for (const a of SQUAD.list) if (a.state === 'ok') { const d = Math.hypot(a.x - e.x, a.y - e.y); if (d < bd && d < 520) { bd = d; best = a; } }
    return e.tgt = best;
  }
  e.tgtT = (e.tgtT || 0) - 0.016; if (e.tgt && e.tgtT > 0 && (e.tgt === player || e.tgt.hp > 0) && e.tgt.state !== 'down') return e.tgt;
  e.tgtT = 1; let best = null, bd = (e.sight || 560) * ENV.vis * 1.1;
  const cand = player.hp > 0 ? [player] : []; for (const a of SQUAD.list) if (a.state === 'ok') cand.push(a); for (const o of enemies) if (o !== e && o.hp > 0 && o.ai) cand.push(o);
  for (const o of cand) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; best = o; } }
  return e.tgt = best;
}
