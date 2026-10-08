// ---------- Dynamic score and ambience: layers fade in and out with the fight, events get stingers, the city has a voice ----------
const MUS = { mood: 'menu', want: 'menu', hold: 0, calm: 0, lay: { pad: 0, bass: 0, kick: 0, snare: 0, hat: 0, arp: 0, tens: 0, stab: 0, boss: 0 }, bpm: 72, step: 0, next: 0, bus: null, minor: true, lastInt: 0, inten: 0 };
const MOOD_LAYERS = {
  menu:    { pad: 0.85, arp: 0.6 },
  brief:   { pad: 0.8, tens: 0.55, kick: 0.25 },
  explore: { pad: 0.6, arp: 0.4 },
  night:   { pad: 0.55, tens: 0.3, arp: 0.15 },
  tension: { pad: 0.6, tens: 0.9, bass: 0.55, hat: 0.2 },
  combat:  { pad: 0.4, bass: 1, kick: 1, snare: 0.85, hat: 0.8, stab: 0.55 },
  boss:    { pad: 0.5, bass: 1, kick: 1, snare: 1, hat: 1, stab: 1, boss: 1 },
  victory: { pad: 1, arp: 1 },
};
const MOOD_BPM = { menu: 70, brief: 76, explore: 74, night: 70, tension: 92, combat: 128, boss: 142, victory: 84 };
const PROGS = {                                                       // chord roots (semitones from the key) and quality, two bars each
  calm: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']],
  dark: [[0, 'm'], [1, 'M'], [0, 'm'], [7, 'm']],
  fight: [[0, 'm'], [8, 'M'], [10, 'M'], [7, 'm']],
  boss: [[0, 'm'], [1, 'M'], [0, 'm'], [10, 'M']],
  win: [[0, 'M'], [5, 'M'], [7, 'M'], [0, 'M']],
};
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19];
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
function musicMood() {
  if (state === 'briefing') return 'brief';
  if (state === 'debrief') return 'victory';
  if (state === 'over') return runResult && runResult.win ? 'victory' : 'menu';
  if (state !== 'playing' && state !== 'paused' && state !== 'upgrade' && state !== 'gunsmith') return 'menu';
  if (!player || !enemies) return 'menu';
  let active = 0, near = 0, bossUp = false;
  for (const e of enemies) {
    if (e.hp <= 0 || e.dummy) continue; const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (e.type === 'boss' && d < 1400) bossUp = true;
    if (e.type === 'heli' && d < 900) active += 2;
    else if (d < 950 && (!e.stealth || e.alertT > 0)) active++;
    else if (d < 600 && e.stealth) near++;
  }
  for (const v of vehicles) if (v.hostile && !v.burned && Math.hypot(v.x - player.x, v.y - player.y) < 900) active += 2;
  MUS.inten = clampN(active / 7, 0, 1);
  if (bossUp) return 'boss';
  if (MUS.inten >= 0.3 || (MUS.inten > 0 && MUS.want === 'combat')) return 'combat';
  if (MUS.inten > 0 || near > 0 || (typeof EVT !== 'undefined' && EVT.cur && EVT.cur.kind !== 'storm') || (player.hp < player.maxHp * 0.3)) return 'tension';
  return ENV.night > 0.5 ? 'night' : 'explore';
}
function musicInit() {
  const ac = Sound.ac, g = v => { const n = ac.createGain(); n.gain.value = v; return n; };
  MUS.bus = {}; for (const k of ['pad', 'bass', 'drums', 'lead', 'tens']) { MUS.bus[k] = g(0); MUS.bus[k].connect(Sound.musicBus); }
  const dl = ac.createDelay(1); dl.delayTime.value = 0.375; const fb = g(0.38), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  MUS.bus.lead.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(Sound.musicBus);                                 // echo on the lead
  // a sustained low drone for tension and boss moods
  const dg = g(0.7); dg.connect(MUS.bus.tens);
  MUS.drone = [0, 7].map(i => { const o = ac.createOscillator(), f = ac.createBiquadFilter(), gg = g(0.22); o.type = 'sawtooth'; o.frequency.value = mtof(26 + i * 7); f.type = 'lowpass'; f.frequency.value = 160; o.connect(f); f.connect(gg); gg.connect(dg); o.start(); return o; });
  const lfo = ac.createOscillator(), lg = g(0.3); lfo.frequency.value = 0.13; lfo.connect(lg); lg.connect(dg.gain); lfo.start();
}
function musicNote(type, freq, when, dur, vol, bus, o = {}) {
  const ac = Sound.ac, osc = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter(); osc.type = type; osc.frequency.setValueAtTime(freq, when); if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + o.slide), when + dur);
  lp.type = 'lowpass'; lp.frequency.value = o.lp || 2400; if (o.detune) osc.detune.value = o.detune;
  const a = o.attack || 0.01; g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + a);
  if (o.sus) { g.gain.setValueAtTime(vol, when + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, when + dur); } else g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(lp); lp.connect(g); g.connect(bus); osc.start(when); osc.stop(when + dur + 0.05);
}
function musicNoise(when, dur, vol, bus, o = {}) {
  const ac = Sound.ac, s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter(); s.buffer = Sound.nb; f.type = o.type || 'highpass'; f.frequency.value = o.f || 6500; if (o.q) f.Q.value = o.q;
  g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); s.connect(f); f.connect(g); g.connect(bus); s.start(when, Math.random()); s.stop(when + dur + 0.02);
}
function chordNotes(root, q) { return q === 'm' ? [0, 3, 7] : [0, 4, 7]; }
Sound.music = function (dt, _intensity) {
  if (!this.musicOn || this.paused) { return; }
  if (!MUS.bus) musicInit();
  const ac = this.ac, t = ac.currentTime, B = MUS.bus;
  // ---- choose the mood; combat comes on at once, calmer moods only after a few quiet seconds ----
  const want = musicMood(); MUS.hold -= dt;
  if (want !== MUS.want) { MUS.want = want; MUS.hold = (want === 'combat' || want === 'boss' || want === 'brief' || want === 'victory') ? 0 : (MUS.mood === 'combat' || MUS.mood === 'boss' ? 6 : 1.5); }
  if (MUS.hold <= 0 && MUS.mood !== MUS.want) { MUS.mood = MUS.want; if (MUS.mood === 'boss' && !MUS.bossHeard) { MUS.bossHeard = true; } }
  const target = MOOD_LAYERS[MUS.mood] || {}, L = MUS.lay, k = Math.min(1, dt * 0.9);
  for (const n in L) L[n] += ((target[n] || 0) - L[n]) * k;
  const tp = Math.max(L.pad, L.boss * 0.8); B.pad.gain.setTargetAtTime(0.9 * tp, t, 0.3); B.bass.gain.setTargetAtTime(0.9 * L.bass, t, 0.2); B.drums.gain.setTargetAtTime(1, t, 0.2); B.lead.gain.setTargetAtTime(0.9 * L.arp, t, 0.3); B.tens.gain.setTargetAtTime(Math.max(L.tens, L.boss * 0.8) * 0.8, t, 0.4);
  const bpm = MOOD_BPM[MUS.mood] || 80; MUS.bpm += (bpm - MUS.bpm) * Math.min(1, dt * 0.6);
  // ---- scheduling in sixteenth notes, a quarter of a second ahead ----
  if (MUS.next < t - 0.5) MUS.next = t + 0.1; const s16 = 60 / MUS.bpm / 4, mood = MUS.mood;
  const key = ENV.night > 0.5 || mood === 'boss' || mood === 'tension' ? 38 : 45, prog = PROGS[mood === 'victory' ? 'win' : mood === 'boss' ? 'boss' : mood === 'combat' ? 'fight' : mood === 'tension' || mood === 'night' ? 'dark' : 'calm'];
  while (MUS.next < t + 0.25) {
    const st = MUS.step++, when = MUS.next; MUS.next += s16; const s = st % 16, bar = Math.floor(st / 16), ch = prog[Math.floor(bar / 2) % prog.length], root = key + ch[0], notes = chordNotes(root, ch[1]);
    if (st % 32 === 0 && (L.pad > 0.04 || L.boss > 0.04)) {                                            // pad chord, two bars
      for (const iv of notes) for (const d of (LITE ? [0] : [-6, 7])) musicNote('sawtooth', mtof(root + 12 + iv), when, s16 * 33, LITE ? 0.05 : 0.03, B.pad, { attack: 1.4, lp: 900, detune: d, sus: 1 });
      musicNote('sine', mtof(root), when, s16 * 33, 0.06, B.pad, { attack: 0.8, sus: 1 });
      if (L.boss > 0.3) musicNote('sawtooth', mtof(root - 12), when, s16 * 20, 0.04, B.pad, { attack: 0.6, lp: 500, sus: 1 });                 // war horn
    }
    if (L.bass > 0.05) {                                                                                 // bass: eighths, sixteenths when the fight is on
      const fast = mood === 'combat' || mood === 'boss', hit = fast ? ([0, 2, 3, 6, 8, 10, 11, 14].includes(s)) : s % 4 === 0;
      if (hit) { const n = root - 12 + (s === 6 || s === 14 ? 7 : s === 11 ? 12 : 0); musicNote('triangle', mtof(n), when, s16 * (fast ? 1.6 : 3), fast ? 0.2 : 0.1, B.bass, { lp: 700 }); musicNote('sine', mtof(n - 12), when, s16 * 2, fast ? 0.2 : 0.1, B.bass); }
    }
    if (L.kick > 0.05 && (s === 0 || s === 8 || (mood === 'boss' && (s === 4 || s === 12)) || (mood === 'combat' && s === 10 && bar % 2) || mood === 'brief' && s === 0)) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(130, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.16); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.5 * L.kick, when + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22); o.connect(g); g.connect(B.drums); o.start(when); o.stop(when + 0.25); }
    if (L.snare > 0.05 && (s === 4 || s === 12 || (mood === 'boss' && s === 15))) { musicNoise(when, 0.14, 0.2 * L.snare, B.drums, { type: 'bandpass', f: 1900, q: 0.8 }); musicNote('triangle', 190, when, 0.1, 0.07 * L.snare, B.drums, { slide: -60 }); }
    if (L.hat > 0.05 && (LITE ? s % 4 === 2 : mood === 'boss' ? true : s % 2 === 0 || (mood === 'combat' && s === 15))) musicNoise(when, s === 14 ? 0.14 : 0.04, (s % 4 === 2 ? 0.07 : 0.04) * L.hat, B.drums, { f: 7000 });
    if (L.stab > 0.05 && ((mood === 'boss' ? [0, 3, 6, 10, 12] : [0, 6, 10]).includes(s))) for (const iv of notes) for (const d of (LITE ? [0] : [-8, 8])) musicNote('sawtooth', mtof(root + (mood === 'boss' ? 0 : 12) + iv), when, s16 * 2.2, (mood === 'boss' ? 0.026 : 0.05) * L.stab, B.bass, { lp: mood === 'boss' ? 1100 : 1700, detune: d });
    if (L.arp > 0.05 && (s % 2 === 0 || (mood === 'menu' && s % 4 === 3)) && Math.random() < (mood === 'victory' ? 0.9 : LITE ? 0.25 : 0.45)) {          // a sparse pentatonic line with echo
      const deg = mood === 'victory' ? [0, 4, 7, 12, 16, 19][(s >> 1) % 6] : PENTA[Math.floor(Math.random() * PENTA.length)], oct = ENV.night > 0.5 ? 12 : 24;
      musicNote(mood === 'night' ? 'sine' : 'triangle', mtof(root + oct + deg), when, s16 * 4, 0.12, B.lead, { lp: 3200, attack: 0.008 });
    }
    if (L.tens > 0.1 && s % (LITE ? 8 : 4) === 0) { musicNoise(when, 0.03, (s === 0 ? 0.05 : 0.025) * L.tens, B.tens, { type: 'bandpass', f: 3200, q: 4 }); }                                  // ticking
    if (player && player.hp < player.maxHp * 0.3 && state === 'playing' && s % 4 === 0) { musicNote('sine', 55, when, 0.14, 0.2, B.drums, { slide: -15 }); musicNote('sine', 52, when + s16 * 1.2, 0.12, 0.14, B.drums, { slide: -14 }); }   // heartbeat
  }
};
// ----- stingers: short musical markers for events -----
Sound.stinger = function (kind) {
  if (!this.ac || !this.musicOn || !MUS.bus) return; const ac = this.ac, t = ac.currentTime + 0.02, B = MUS.bus.drums;
  if (kind === 'crash') { musicNote('sawtooth', 220, t, 1.4, 0.08, B, { slide: -170, lp: 900 }); musicNote('sine', 70, t, 1.2, 0.2, B, { slide: -40 }); for (const iv of [0, 1, 6]) musicNote('sawtooth', mtof(50 + iv), t + 0.1, 1.6, 0.03, B, { lp: 800, attack: 0.1 }); }
  else if (kind === 'blackout') { musicNote('sawtooth', 300, t, 1.8, 0.07, B, { slide: -260, lp: 600 }); musicNote('sine', 48, t + 0.2, 1.8, 0.2, B, { slide: -14 }); }
  else if (kind === 'escort') { for (let i = 0; i < 4; i++) musicNote('square', mtof(62 + i * 2), t + i * 0.16, 0.14, 0.05, B, { lp: 2400 }); }
  else if (kind === 'raid') { for (let i = 0; i < 4; i++) musicNote('sawtooth', mtof(i % 2 ? 62 : 69), t + i * 0.28, 0.26, 0.05, B, { lp: 1800 }); }
  else if (kind === 'storm') { musicNote('sine', 40, t, 2.4, 0.22, B, { slide: -6, attack: 0.5 }); }
  else if (kind === 'victory') { [0, 4, 7, 12, 16].forEach((iv, i) => musicNote('triangle', mtof(60 + iv), t + i * 0.13, 0.9, 0.08, B, { lp: 3000 })); }
  else if (kind === 'defeat') { [0, -3, -7, -12].forEach((iv, i) => musicNote('triangle', mtof(57 + iv), t + i * 0.3, 1.2, 0.09, B, { lp: 1400 })); }
};
// ----- ambience: city hum, insects by day, frogs by the water, storm rumble, rain on the roof, a humming grid, fire crackle -----
const AMBX = { next: { frog: 2, dog: 30, crackle: 0, zap: 6 }, nodes: null };
function ambInit() {
  const ac = Sound.ac, g = v => { const n = ac.createGain(); n.gain.value = v; return n; }, loop = (sec, fn) => { const s = ac.createBufferSource(); s.buffer = Sound.noiseBuf(sec); s.loop = true; const out = fn(s); s.start(); return out; };
  const N = {};
  N.city = loop(3, s => { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; const gn = g(0); s.connect(f); f.connect(gn); gn.connect(Sound.outBus); return gn; });
  N.bugs = loop(2, s => { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5600; f.Q.value = 9; const am = g(0.5), lf = ac.createOscillator(), lg = g(0.5); lf.frequency.value = 38; lf.connect(lg); lg.connect(am.gain); lf.start(); const gn = g(0); s.connect(f); f.connect(am); am.connect(gn); gn.connect(Sound.outBus); return gn; });
  N.rumble = loop(4, s => { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 95; const gn = g(0); s.connect(f); f.connect(gn); gn.connect(Sound.outBus); return gn; });
  N.roof = loop(3, s => { const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800; const gn = g(0); s.connect(hp); hp.connect(lp); lp.connect(gn); gn.connect(Sound.inBus); return gn; });
  const hum = g(0), o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.frequency.value = 100; o2.frequency.value = 200; o2.type = 'square'; const lp2 = ac.createBiquadFilter(); lp2.frequency.value = 500; o1.connect(hum); o2.connect(lp2); lp2.connect(hum); hum.connect(Sound.outBus); o1.start(); o2.start(); N.hum = hum;
  AMBX.nodes = N;
}
function ambUpdate(dt) {
  if (!Sound.ac || Sound.paused) return; if (!AMBX.nodes) ambInit(); const N = AMBX.nodes, t = Sound.ac.currentTime, outdoors = !playerBuilding, tc = 0.6;
  AMBX.bt = (AMBX.bt || 0) - dt; if (AMBX.bt <= 0) { AMBX.bt = 0.6; let c = 0; for (const b of buildings) { const dx = (b.door ? b.door.x : 0) - player.x, dy = (b.door ? b.door.y : 0) - player.y; if (dx * dx + dy * dy < 640000) c++; } AMBX.bld = c; } const bld = AMBX.bld || 0;
  N.city.gain.setTargetAtTime(clampN(bld / 14, 0, 1) * 0.035 * (state === 'playing' ? 1 : 0.3), t, tc);
  N.bugs.gain.setTargetAtTime(!LITE && ENV.night < 0.4 && ENV.rain < 0.2 && state === 'playing' ? 0.013 * (1 - ENV.night) : 0, t, 1.2);
  N.rumble.gain.setTargetAtTime((WX.cur.storm || 0) * 0.12 + (typeof EVT !== 'undefined' && EVT.cur && EVT.cur.kind === 'crash' ? 0.02 : 0), t, 1);
  N.roof.gain.setTargetAtTime(playerBuilding ? ENV.rain * 0.09 : 0, t, 0.5);
  N.hum.gain.setTargetAtTime(clampN(bld / 10, 0, 1) * 0.011 * (1 - (typeof EVT !== 'undefined' ? EVT.black : 0)), t, 0.8);
  if (state !== 'playing') return;
  const nx = AMBX.next; for (const k in nx) nx[k] -= dt;
  const ev = typeof EVT !== 'undefined' ? EVT.cur : null;
  if (ev && ev.kind === 'crash' && ev.loot && nx.crackle <= 0) { nx.crackle = (LITE ? 0.4 : 0.08) + Math.random() * 0.25; Sound.noise(0.04, 0.35, { hp: 2200, at: [ev.x, ev.y], vol: 1.4, ref: 12, range: 170, rev: 0.2 }); }
  if (typeof EVT !== 'undefined' && EVT.black > 0.5) { if (nx.zap <= 0) { nx.zap = 5 + Math.random() * 9; const a = Math.random() * 6.28, x = player.x + Math.cos(a) * 500, y = player.y + Math.sin(a) * 500; Sound.noise(0.12, 0.5, { hp: 3500, at: [x, y], vol: 2, ref: 20, range: 300 }); Sound.tone(110, 0.4, 'sawtooth', 0.05, -60, { at: [x, y], vol: 1.5, ref: 20, range: 300 }); } }
  if (!LITE && ENV.night > 0.5 && ENV.rain < 0.3 && LAKE && nx.frog <= 0) { nx.frog = 1 + Math.random() * 2.5; const lx = LAKE.type === 'circle' ? LAKE.x : player.x, ly = LAKE.type === 'circle' ? LAKE.y : player.y; const dl = LAKE.type === 'circle' ? Math.hypot(player.x - lx, player.y - ly) - LAKE.r : 400;
    if (dl < 800) { const a = Math.random() * 6.28, r0 = LAKE.type === 'circle' ? LAKE.r : 100, x = lx + Math.cos(a) * r0, y = ly + Math.sin(a) * r0; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) Sound.tone(190 + Math.random() * 60, 0.09, 'square', 0.03, 40, { at: [x, y], vol: 2.4, ref: 14, range: 200, delay: i * 0.12 }); } }
  if (ENV.night > 0.5 && nx.dog <= 0) { nx.dog = 30 + Math.random() * 50; if (Sound.bark) { const a = Math.random() * 6.28; Sound.bark(player.x + Math.cos(a) * 1500, player.y + Math.sin(a) * 1500); } }
}
{ const _init = Sound.init, _update = Sound.update; Sound.init = function () { const had = !!this.ac; _init.call(this); }; Sound.update = function (dt, intensity) { _update.call(this, dt, intensity); try { ambUpdate(dt); } catch (e) { if (!AMBX.err) { AMBX.err = 1; console.error('ambience: ' + e.message); } } }; }
