// ---------- Audio: everything is synthesised (no files), positional, with reverb and indoor muffling ----------
const Sound = {
  ac: null, muted: false, musicOn: true, paused: false, lis: { x: 0, y: 0, z: 0, rx: 1, rz: 0, fx: 0, fz: -1 },
  eng: null, skidN: null, hornN: null, nextBird: 3, nextFar: 20, stepT: 0, lastShot: {}, beat: 0, nextBeat: 0, musicVol: 0.5,

  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    let ac;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.ac = ac;
    try { this.musicOn = localStorage.getItem('war3d-music') !== '0'; this.muted = localStorage.getItem('war3d-muted') === '1'; } catch (e) {}
    const g = v => { const n = ac.createGain(); n.gain.value = v; return n; };
    this.master = g(this.muted ? 0 : 0.85);
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ac.destination);
    this.uiBus = g(0.9); this.uiBus.connect(this.master);
    this.inBus = g(1); this.inBus.connect(this.master);                      // sounds in the same room as you
    this.outLP = ac.createBiquadFilter(); this.outLP.type = 'lowpass'; this.outLP.frequency.value = 22000; this.outLP.connect(this.master);
    this.outBus = g(1); this.outBus.connect(this.outLP);                      // sounds on the other side of a wall (muffled when you are indoors)
    this.musicBus = g(this.musicOn ? 0.5 : 0); this.musicBus.connect(this.master);
    this.nb = this.noiseBuf(2);
    // two reverbs: a wide outdoor tail and a short room
    this.revOut = ac.createConvolver(); this.revOut.buffer = this.makeIR(2.4, 2.5); this.revIn = ac.createConvolver(); this.revIn.buffer = this.makeIR(0.7, 3.5);
    this.sendOut = g(1); this.sendIn = g(1); this.sendOut.connect(this.revOut); this.sendIn.connect(this.revIn);
    const wetO = g(0.5), wetI = g(0.6); this.revOut.connect(wetO); wetO.connect(this.outLP); this.revIn.connect(wetI); wetI.connect(this.inBus);
    // ambience: wind bed
    const w = ac.createBufferSource(); w.buffer = this.noiseBuf(4); w.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 0.5; this.windG = g(0.05);
    const lfo = ac.createOscillator(), lg = g(0.03); lfo.frequency.value = 0.09; lfo.connect(lg); lg.connect(this.windG.gain); lfo.start();
    w.connect(wf); wf.connect(this.windG); this.windG.connect(this.outBus); w.start();
    // rain bed: filtered noise whose level follows the weather (outdoor bus, so it is muffled indoors)
    const rn = ac.createBufferSource(); rn.buffer = this.noiseBuf(3); rn.loop = true;
    const rh = ac.createBiquadFilter(); rh.type = 'highpass'; rh.frequency.value = 1400; const rl = ac.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 7500;
    this.rainG = g(0); rn.connect(rh); rh.connect(rl); rl.connect(this.rainG); this.rainG.connect(this.outBus); rn.start();
    this.nextCricket = 0;
  },
  noiseBuf(sec) { const n = Math.floor(this.ac.sampleRate * sec), b = this.ac.createBuffer(1, n, this.ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; },
  makeIR(sec, decay) {
    const sr = this.ac.sampleRate, n = Math.floor(sr * sec), b = this.ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n; lp += (Math.random() * 2 - 1 - lp) * (0.25 + 0.6 * (1 - t)); d[i] = lp * Math.pow(1 - t, decay) * 1.6; } }
    return b;
  },
  setMuted(m) { this.muted = m; try { localStorage.setItem('war3d-muted', m ? '1' : '0'); } catch (e) {} if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ac.currentTime, 0.05); },
  toggleMute() { this.setMuted(!this.muted); },
  toggleMusic() { this.musicOn = !this.musicOn; try { localStorage.setItem('war3d-music', this.musicOn ? '1' : '0'); } catch (e) {} if (this.musicBus) this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.5 : 0, this.ac.currentTime, 0.3); },

  // ----- where a sound goes: pan, level, muffling and reverb from the listener's point of view -----
  place(x, y, o = {}) {                                   // x, y in field px; returns { node, delay } to connect a source into, or null if inaudible
    const ac = this.ac, L = this.lis, px = wx(x), pz = wz(y), py = hAt(px, pz) + 1.3;
    const dx = px - L.x, dz = pz - L.z, dist = Math.hypot(dx, py - L.y, dz), dh = Math.hypot(dx, dz) || 1;
    if (dist > (o.range || 190)) return null;
    const pan = clampN((dx * L.rx + dz * L.rz) / dh, -1, 1) * 0.85, front = (dx * L.fx + dz * L.fz) / dh;
    const sameRoom = buildingAt(x, y) === playerBuilding;
    const gain = (o.vol ?? 1) / Math.pow(1 + dist / (o.ref || 7), 1.15);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clampN(20000 / (1 + dist / 22), 900, 20000) * (front < -0.2 ? 0.55 : 1);
    const gn = ac.createGain(); gn.gain.value = gain;
    const sp = ac.createStereoPanner ? ac.createStereoPanner() : null; if (sp) sp.pan.value = pan;
    lp.connect(gn); if (sp) { gn.connect(sp); sp.connect(sameRoom ? this.inBus : this.outBus); } else gn.connect(sameRoom ? this.inBus : this.outBus);
    const rs = ac.createGain(); rs.gain.value = (o.rev ?? 0.25) * Math.min(1, 0.4 + dist / 60); gn.connect(rs); rs.connect(playerBuilding ? this.sendIn : this.sendOut);
    return { node: lp, delay: o.noDelay ? 0 : dist / 343 };
  },
  // output for a sound with no position (your own weapon, footsteps) or at a position
  dest(o) {
    if (o && o.at) return this.place(o.at[0], o.at[1], o);
    const bus = o && o.ui ? this.uiBus : this.inBus, rs = this.ac.createGain(); rs.gain.value = (o && o.rev) ?? 0.15;
    const gn = this.ac.createGain(); gn.gain.value = (o && o.vol) ?? 1; gn.connect(bus); gn.connect(rs); rs.connect(playerBuilding ? this.sendIn : this.sendOut);
    return { node: gn, delay: 0 };
  },

  // ----- building blocks -----
  tone(freq, dur, type = 'square', vol = 0.06, slide = 0, o = {}) {
    if (!this.ac) return; const d = this.dest({ ui: true, ...o }); if (!d) return;
    const t = this.ac.currentTime + d.delay + (o.delay || 0), osc = this.ac.createOscillator(), g = this.ac.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t); if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(d.node); osc.start(t); osc.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.12, o = {}) {                         // filtered noise burst. o: { lp, hp, bp, q, sweepTo, attack, at, delay }
    if (!this.ac) return; const d = this.dest(o); if (!d) return;
    const t = this.ac.currentTime + d.delay + (o.delay || 0), s = this.ac.createBufferSource(), g = this.ac.createGain(); s.buffer = this.nb; s.loop = true;
    let last = s;
    const chain = (type, f, q, to) => { const fl = this.ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur); if (q) fl.Q.value = q; last.connect(fl); last = fl; };
    if (o.hp) chain('highpass', o.hp); if (o.bp) chain('bandpass', o.bp, o.q || 1, o.sweepTo); if (o.lp) chain('lowpass', o.lp, 0.7, o.sweepTo && !o.bp ? o.sweepTo : 0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (o.drive) { const ws = this.ac.createWaveShaper(); ws.curve = this.satCurve(o.drive); last.connect(ws); last = ws; }
    last.connect(g); g.connect(d.node); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  satCurve(k) { this._sat = this._sat || {}; if (this._sat[k]) return this._sat[k]; const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n / 2) - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } return (this._sat[k] = c); },
  // layered firearm report: supersonic crack + muzzle blast + body + low boom + mechanical clack + room/landscape tail & echo
  bang(o, p) {
    const r = 0.92 + Math.random() * 0.16, v = (p.vol || 1) * 0.5, tl = p.tail || 1;
    this.noise(0.02, 0.9 * v, { ...o, hp: 2200 * r, drive: 6, attack: 0.0006 });                                    // crack
    this.noise(0.05, 0.5 * v, { ...o, bp: 4200 * r, q: 0.8, drive: 4, attack: 0.0006 });
    this.noise(p.blast || 0.16, 0.95 * v, { ...o, lp: 3200 * r, sweepTo: 260, drive: 5, attack: 0.0008 });          // muzzle blast
    this.noise(p.body || 0.32, 0.6 * v, { ...o, lp: 700 * r, sweepTo: 110, drive: 3, attack: 0.001 });             // chest-thump body
    this.thump(p.f0 || 120, p.f1 || 36, p.boom || 0.22, 0.75 * v, o);                                               // low boom
    this.noise(0.012, 0.18 * v, { bp: 3200, q: 2, delay: 0.045, ...(o.at ? { at: o.at, ref: o.ref, range: o.range, vol: o.vol } : {}) }); // action clack
    this.noise(1.3 * tl, 0.2 * v, { ...o, lp: 1000, sweepTo: 180, attack: 0.025, rev: 0.95, delay: 0.03 });         // reverb tail
    this.noise(0.3, 0.14 * v, { ...o, lp: 1500, sweepTo: 300, rev: 0.7, delay: 0.17 + Math.random() * 0.05 });      // distant slap-back echo
    this.noise(0.5 * tl, 0.07 * v, { ...o, lp: 500, rev: 0.9, delay: 0.4 + Math.random() * 0.1 });
  },
  thump(f0, f1, dur, vol = 0.3, o = {}) { this.tone(f0, dur, 'sine', vol, f1 - f0, { ui: false, ...o }); },
  limit(key, ms) { const n = performance.now(); if (n - (this.lastShot[key] || 0) < ms) return false; this.lastShot[key] = n; return true; },

  // ----- weapons -----
  suppressed(o = {}) { const r = 0.92 + Math.random() * 0.16; this.noise(0.03, 0.22, { ...o, bp: 2600 * r, q: 0.7, attack: 0.001 }); this.noise(0.11, 0.2, { ...o, lp: 1500 * r, sweepTo: 300, attack: 0.002 }); this.thump(150, 60, 0.08, 0.18, o); this.noise(0.012, 0.1, { bp: 3000, q: 2, delay: 0.04 }); this.noise(0.35, 0.05, { ...o, lp: 700, rev: 0.6, delay: 0.05 }); },
  shoot(o = {}) { this.bang(o, { vol: 1, f0: 130, f1: 40 }); },
  smg(o = {}) { this.bang(o, { vol: 0.75, blast: 0.1, body: 0.18, boom: 0.12, f0: 170, f1: 60, tail: 0.5 }); },
  shotgun(o = {}) { this.bang(o, { vol: 1.25, blast: 0.3, body: 0.5, boom: 0.35, f0: 95, f1: 30, tail: 1.2 }); this.noise(0.05, 0.28, { bp: 900, q: 2, delay: 0.38 }); this.noise(0.04, 0.25, { bp: 1500, q: 3, delay: 0.52 }); },
  sniperShot(o = {}) { this.bang(o, { vol: 1.35, blast: 0.26, body: 0.45, boom: 0.3, f0: 105, f1: 32, tail: 2 }); },
  cannon(o = {}) { this.noise(0.6, 0.55, { ...o, lp: 1100, sweepTo: 70, drive: 4 }); this.thump(70, 24, 0.6, 0.55, o); this.noise(0.03, 0.5, { ...o, hp: 1500, drive: 6 }); this.noise(1.6, 0.25, { ...o, lp: 450, rev: 0.9, delay: 0.05 }); },
  enemyShot(x, y, type) {
    if (!this.ac || !this.limit('e' + Math.round(x / 40) + Math.round(y / 40), 70)) return;
    const o = { at: [x, y], vol: 1.4, ref: 9 };
    if (type === 'tank' || type === 'boss') this.cannon({ ...o, vol: 1.1, ref: 14, range: 280 }); else if (type === 'sniper') this.sniperShot({ ...o, range: 260 }); else if (type === 'runner' || type === 'smg') this.smg(o); else if (type === 'shotgun') this.shotgun(o); else this.shoot(o);
  },
  reload(dur = 1.2) {
    this.noise(0.04, 0.25, { bp: 1800, q: 3, delay: 0.1 }); this.thump(260, 140, 0.05, 0.14, { delay: 0.1 });            // magazine out
    this.noise(0.05, 0.3, { bp: 1200, q: 3, delay: dur * 0.55 }); this.thump(220, 120, 0.06, 0.2, { delay: dur * 0.55 });   // magazine in
    this.noise(0.04, 0.35, { bp: 2400, q: 4, delay: dur * 0.85 }); this.noise(0.05, 0.3, { bp: 1500, q: 4, delay: dur * 0.85 + 0.07 }); // bolt
  },
  heartbeat() { this.tone(58, 0.14, 'sine', 0.5, -26, { ui: true }); this.tone(52, 0.16, 'sine', 0.38, -22, { ui: true, delay: 0.17 }); },
  killcam() { this.tone(520, 0.7, 'sine', 0.12, -440, { ui: true }); this.thump(90, 40, 0.5, 0.35, { ui: true }); this.noise(0.8, 0.12, { ui: true, lp: 1800, sweepTo: 200, attack: 0.05 }); },
  glass(x, y) { const o = { at: [x, y], vol: 1.2, ref: 7, range: 130 }; this.noise(0.05, 0.5, { hp: 4500, ...o }); this.noise(0.4, 0.3, { hp: 5000, attack: 0.002, ...o });
    for (let i = 0; i < 6; i++) { const f = 2400 + Math.random() * 3200; this.tone(f, 0.12 + Math.random() * 0.1, 'triangle', 0.11, -f * 0.3, { ...o, delay: 0.03 + i * 0.045 + Math.random() * 0.03 }); } },
  woodBreak(x, y) { const o = { at: [x, y], vol: 1.3, ref: 7, range: 140 }; this.noise(0.08, 0.6, { bp: 900, q: 1, ...o }); this.thump(180, 60, 0.18, 0.4, o);
    for (let i = 0; i < 4; i++) this.noise(0.05, 0.3, { bp: 500 + Math.random() * 900, q: 3, delay: 0.05 + i * 0.06, ...o }); },
  knife() { this.noise(0.12, 0.28, { bp: 2400, q: 1.2, sweepTo: 900, attack: 0.01 }); },
  stab(x, y) { const o = { at: [x, y], vol: 1.2, ref: 6, range: 90 }; this.thump(150, 70, 0.08, 0.35, o); this.noise(0.06, 0.3, { lp: 900, ...o }); },
  smokePop(x, y) { const o = { at: [x, y], vol: 1.2, ref: 8, range: 160 }; this.thump(140, 60, 0.12, 0.3, o); this.noise(1.2, 0.2, { hp: 2500, attack: 0.05, ...o }); },
  flashbang(x, y) { const o = { at: [x, y], vol: 1.6, ref: 10, range: 220 }; this.noise(0.04, 0.9, { hp: 1500, drive: 5, ...o }); this.noise(0.5, 0.7, { lp: 2500, sweepTo: 300, drive: 4, ...o }); this.thump(120, 40, 0.2, 0.6, o); },
  tinnitus(sec) { this.tone(5200, Math.min(4, sec * 1.2), 'sine', 0.07, -900, { ui: true }); },
  heliChop(x, y) { const o = { at: [x, y], vol: 1.5, ref: 16, range: 420 }; this.noise(0.07, 0.4, { lp: 320, attack: 0.006, ...o }); this.thump(75, 48, 0.07, 0.3, o); },
  bite(x, y) { const o = { at: [x, y], vol: 1.1, ref: 6, range: 90 }; this.noise(0.08, 0.35, { bp: 700, q: 2, ...o }); },
  alert(x, y) { const o = { at: [x, y], vol: 1.2, ref: 8, range: 200 }; this.tone(880, 0.1, 'square', 0.1, 0, { ...o }); this.tone(1175, 0.14, 'square', 0.1, 0, { ...o, delay: 0.1 }); },
  carAlarm(x, y, hi) { const o = { at: [x, y], vol: 1.3, ref: 10, range: 280, rev: 0.3 }; this.tone(hi ? 1100 : 760, 0.28, 'square', 0.07, hi ? -200 : 200, o); },
  panic(x, y) { const o = { at: [x, y], vol: 1.5, ref: 9, range: 220 }; this.tone(900 + Math.random() * 400, 0.3, 'sawtooth', 0.08, -350, o); this.tone(1200 + Math.random() * 300, 0.22, 'sawtooth', 0.06, -500, { ...o, delay: 0.2 }); },
  bark(x, y) { const o = { at: [x, y], vol: 1.5, ref: 8, range: 240 }; for (let i = 0; i < 2; i++) { this.noise(0.09, 0.4, { bp: 700, q: 3, delay: i * 0.18, ...o }); this.tone(380, 0.1, 'square', 0.08, -140, { ...o, delay: i * 0.18 }); } },
  dry() { this.noise(0.03, 0.2, { bp: 2200, q: 4 }); },
  swap() { this.noise(0.05, 0.2, { bp: 1500, q: 3 }); this.thump(200, 110, 0.05, 0.12); },
  grenadeThrow() { this.noise(0.12, 0.15, { bp: 1500, sweepTo: 600, q: 1 }); this.noise(0.03, 0.2, { bp: 2500, q: 5 }); },

  // ----- impacts, hits, explosions -----
  impact(x, y, kind) {
    if (!this.ac || !this.limit('i' + Math.round(x / 30) + Math.round(y / 30), 40)) return;
    const o = { at: [x, y], vol: 1.3, ref: 6, range: 120 };
    if (kind === 'vehicle' || kind === 'container' || kind === 'barrel') { this.tone(1500 + Math.random() * 700, 0.12, 'triangle', 0.18, -500, o); this.noise(0.05, 0.35, { bp: 3000, q: 2, ...o }); }
    else if (kind === 'rock' || kind === 'barrier') { this.noise(0.06, 0.4, { hp: 2200, ...o }); this.thump(260, 120, 0.05, 0.15, o); }
    else if (kind === 'sandbag') this.noise(0.1, 0.35, { lp: 600, ...o });
    else if (kind === 'crate' || kind === 'fence' || kind === 'door' || kind === 'furn' || kind === 'furnTall') { this.noise(0.07, 0.4, { bp: 800, q: 1.2, ...o }); this.thump(240, 110, 0.07, 0.2, o); }
    else { this.noise(0.07, 0.4, { bp: 1400, q: 0.9, ...o }); this.thump(180, 80, 0.06, 0.2, o); }
  },
  hit() { this.noise(0.05, 0.25, { bp: 900, q: 1 }); },
  hitEnemy(x, y, type) {
    this.tone(1800, 0.04, 'sine', 0.05, 0, { ui: true });                                   // hit marker tick
    if (!this.limit('h' + Math.round(x / 25) + Math.round(y / 25), 45)) return;
    const o = { at: [x, y], vol: 1.4, ref: 6, range: 140 };
    if (type === 'tank' || type === 'boss') { this.tone(1100 + Math.random() * 500, 0.14, 'triangle', 0.2, -400, o); this.noise(0.06, 0.4, { bp: 2500, q: 2, ...o }); }
    else { this.noise(0.08, 0.45, { lp: 700, ...o }); this.thump(150, 70, 0.08, 0.25, o); }
  },
  whiz(x, y) { if (!this.ac || !this.limit('w', 90)) return; this.noise(0.18, 0.3, { bp: 3200, sweepTo: 1400, q: 3, at: [x, y], vol: 2.2, ref: 3, range: 60, noDelay: true }); },
  hurt() { this.thump(120, 50, 0.2, 0.4); this.noise(0.18, 0.3, { lp: 500 }); this.tone(190, 0.22, 'sawtooth', 0.05, -70); },
  death() { this.tone(300, 1.4, 'sawtooth', 0.12, -260); this.noise(1.2, 0.2, { lp: 600, sweepTo: 100 }); this.thump(90, 30, 0.9, 0.5); },
  boom(x, y, big = 1) {
    if (!this.ac) return; const o = x === undefined ? { vol: 1 } : { at: [x, y], vol: 1.2 * big, ref: 14, range: 320 };
    this.noise(1.2, 0.9, { lp: 2800, sweepTo: 120, attack: 0.006, rev: 0.9, ...o }); this.thump(75, 24, 0.7, 0.8, o); this.noise(0.15, 0.7, { hp: 1500, ...o });
    this.noise(0.9, 0.25, { bp: 3500, q: 1, delay: 0.25, attack: 0.1, ...o });          // falling debris
  },
  crash(imp, x, y) { const o = { at: [x, y], vol: 1, ref: 8 }; this.noise(0.25, Math.min(0.8, imp / 300), { lp: 1800, sweepTo: 300, ...o }); this.thump(110, 40, 0.2, 0.5, o); this.tone(900 + Math.random() * 500, 0.2, 'triangle', 0.15, -300, o); },
  pickup() { this.tone(660, 0.09, 'sine', 0.07); this.tone(990, 0.12, 'sine', 0.07, 0, { delay: 0.07 }); this.noise(0.04, 0.2, { bp: 3000, q: 3, delay: 0.02 }); },

  // ----- movement -----
  step(surface, vol = 1) {
    if (!this.ac) return; const v = vol * (0.85 + Math.random() * 0.3), r = Math.random();
    switch (surface) {
      case 'asphalt': case 'concrete': this.noise(0.05, 0.28 * v, { bp: 2600 + r * 500, q: 1.6 }); this.thump(130, 70, 0.05, 0.14 * v); break;
      case 'wood': this.thump(170 + r * 40, 85, 0.09, 0.22 * v); this.noise(0.06, 0.18 * v, { bp: 700, q: 1.2 }); break;
      case 'metal': this.tone(700 + r * 300, 0.09, 'triangle', 0.1 * v, -200); this.noise(0.04, 0.2 * v, { bp: 3000, q: 2 }); break;
      case 'dirt': this.noise(0.08, 0.3 * v, { lp: 900 + r * 300 }); this.thump(110, 60, 0.05, 0.12 * v); break;
      case 'mud': this.noise(0.12, 0.3 * v, { lp: 500 + r * 200, sweepTo: 300 }); this.thump(90, 45, 0.08, 0.15 * v); break;
      default: this.noise(0.1, 0.22 * v, { bp: 1800 + r * 600, q: 0.7 }); this.noise(0.07, 0.15 * v, { lp: 600 }); break;       // grass
    }
  },
  enemyStep(x, y, surface) { if (this.ac && this.limit('s' + Math.round(x / 50) + Math.round(y / 50), 120)) this.noise(0.06, 0.4, { ...(surface === 'concrete' ? { bp: 2400, q: 1.5 } : { lp: 1000 }), at: [x, y], ref: 5, range: 55 }); },
  jump() { this.noise(0.12, 0.18, { lp: 900 }); this.tone(260, 0.12, 'sine', 0.04, 160); },
  land(imp = 4) { this.thump(110, 50, 0.12, Math.min(0.4, 0.1 + imp * 0.04)); this.noise(0.1, 0.2, { lp: 800 }); },
  cloth() { this.noise(0.14, 0.12, { bp: 1000, q: 0.6 }); },
  dash() { this.noise(0.22, 0.25, { bp: 1200, sweepTo: 3000, q: 0.8 }); },
  door(open, x, y) {
    const o = { at: [x, y], vol: 0.9, ref: 6, range: 90 };
    this.noise(0.45, 0.2, { bp: open ? 380 : 720, sweepTo: open ? 800 : 300, q: 6, attack: 0.1, ...o });
    this.thump(open ? 130 : 160, 60, 0.12, 0.25, { delay: open ? 0.4 : 0.38, ...o }); this.noise(0.05, 0.25, { bp: 1800, q: 3, delay: open ? 0 : 0.4, ...o });
  },
  carDoor(open, x, y) { const o = { at: [x, y], vol: 1, ref: 6, range: 90 }; this.thump(150, 65, 0.1, 0.35, o); this.noise(0.06, 0.3, { bp: 1600, q: 2, ...o }); if (!open) this.noise(0.04, 0.2, { bp: 3000, q: 4, delay: 0.05, ...o }); },
  ui() { this.tone(520, 0.05, 'square', 0.04); },
  blackout() { if (!this.ac) return; this.tone(180, 0.9, 'sawtooth', 0.09, -140); this.tone(60, 1.2, 'sine', 0.12, -30, { delay: 0.1 }); },
  powerOn() { if (!this.ac) return; this.tone(300, 0.15, 'square', 0.05, 200); this.tone(600, 0.2, 'square', 0.05, 0, { delay: 0.15 }); },
  radio() { if (!this.ac) return; this.tone(1500, 0.04, 'square', 0.035); this.tone(1100, 0.05, 'square', 0.03, 0, { delay: 0.05 }); },
  wave() { [330, 415, 495].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.05, 0, { delay: i * 0.13 })); this.noise(0.5, 0.06, { lp: 500, attack: 0.2 }); },
  bossRoar() { this.tone(70, 1.2, 'sawtooth', 0.14, -35); this.tone(52, 1.2, 'square', 0.1, -20); this.noise(1.1, 0.25, { lp: 400, attack: 0.15 }); },
  stinger() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.06, 0, { delay: i * 0.22 })); },

  // ----- vehicles -----
  engineOn() {
    if (!this.ac || this.eng) return;
    const ac = this.ac, g = ac.createGain(); g.gain.value = 0; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const a = ac.createOscillator(), b = ac.createOscillator(), c = ac.createOscillator(); a.type = 'sawtooth'; b.type = 'square'; c.type = 'sawtooth';
    const gb = ac.createGain(), gc = ac.createGain(); gb.gain.value = 0.5; gc.gain.value = 0.25;
    a.connect(lp); b.connect(gb); gb.connect(lp); c.connect(gc); gc.connect(lp); lp.connect(g); g.connect(this.inBus); a.start(); b.start(); c.start();
    const ns = ac.createBufferSource(); ns.buffer = this.nb; ns.loop = true; const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.8; const ng = ac.createGain(); ng.gain.value = 0; ns.connect(nf); nf.connect(ng); ng.connect(this.inBus); ns.start();
    this.eng = { a, b, c, g, lp, ng, nf, gear: 0 };
    this.thump(80, 150, 0.3, 0.3); this.noise(0.4, 0.1, { lp: 500 });                                   // ignition
  },
  engineSet(r, thr = 0, load = 0) {                         // r = speed / top speed, thr = throttle 0..1
    const E = this.eng; if (!E) return; const t = this.ac.currentTime, gears = 5, gs = 1 / gears, gear = Math.min(gears - 1, Math.floor(r / gs));
    if (gear !== E.gear && r > 0.05) { E.gear = gear; this.noise(0.06, 0.12, { lp: 900 }); }
    const within = (r - gear * gs) / gs, rpm = 850 + (0.25 + within * 0.75) * 4800 * (r < 0.02 ? 0 : 1), f = rpm / 30;
    for (const [o, m] of [[E.a, 1], [E.b, 0.5], [E.c, 2]]) o.frequency.setTargetAtTime(f * m, t, 0.05);
    E.lp.frequency.setTargetAtTime(350 + rpm * 0.5 + thr * 700, t, 0.08);
    E.g.gain.setTargetAtTime(this.muted ? 0 : 0.05 + 0.04 * thr + 0.03 * r, t, 0.08);
    E.ng.gain.setTargetAtTime(0.02 + 0.05 * r + 0.02 * thr, t, 0.1); E.nf.frequency.setTargetAtTime(600 + r * 1800, t, 0.1);
  },
  engineOff() {
    const E = this.eng; if (!E) return; this.eng = null;
    const t = this.ac.currentTime; E.g.gain.setTargetAtTime(0, t, 0.1); E.ng.gain.setTargetAtTime(0, t, 0.1);
    setTimeout(() => { try { E.a.stop(); E.b.stop(); E.c.stop(); } catch (e) {} }, 500);
    this.skid(0); this.horn(false);
  },
  skid(level) {
    if (!this.ac) return;
    if (!this.skidN) { const s = this.ac.createBufferSource(); s.buffer = this.nb; s.loop = true; const f = this.ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 4; const g = this.ac.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.inBus); s.start(); this.skidN = { g, f }; }
    this.skidN.g.gain.setTargetAtTime(this.muted ? 0 : level * 0.14, this.ac.currentTime, 0.05);
  },
  horn(on) {
    if (!this.ac) return;
    if (on && !this.hornN) { const g = this.ac.createGain(); g.gain.value = 0.06; const os = [420, 530].map(f => { const o = this.ac.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(); return o; }); g.connect(this.inBus); g.connect(this.sendOut); this.hornN = { g, os }; }
    else if (!on && this.hornN) { const H = this.hornN; this.hornN = null; H.g.gain.setTargetAtTime(0, this.ac.currentTime, 0.02); setTimeout(() => H.os.forEach(o => { try { o.stop(); } catch (e) {} }), 150); }
  },

  // ----- per-frame: listener, ambience, music -----
  update(dt, intensity) {
    if (!this.ac) return;
    const L = this.lis, t = this.ac.currentTime, fx = Math.cos(look.yaw), fz = Math.sin(look.yaw);
    L.x = camera.position.x; L.y = camera.position.y; L.z = camera.position.z; L.fx = fx; L.fz = fz; L.rx = -fz; L.rz = fx;
    // indoors, the world outside is muffled; when the game is not running everything is ducked
    this.outLP.frequency.setTargetAtTime(playerBuilding ? 1300 : 22000, t, 0.15);
    this.master.gain.setTargetAtTime(this.muted ? 0 : (this.paused ? 0.25 : 0.85) * SET.vol.master, t, 0.1);
    this.inBus.gain.setTargetAtTime(SET.vol.sfx, t, 0.1); this.outBus.gain.setTargetAtTime(SET.vol.sfx, t, 0.1); this.uiBus.gain.setTargetAtTime(0.9 * SET.vol.sfx, t, 0.1);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.5 * SET.vol.music : 0, t, 0.3);
    this.windG.gain.setTargetAtTime(0.05 + (player && player.driving ? 0.03 : 0) + ENV.dark * 0.06 + (WX.cur.storm || 0) * 0.07, t, 0.5);
    this.rainG.gain.setTargetAtTime(this.paused ? 0 : ENV.rain * 0.085, t, 0.6);
    if (!this.paused) {
      this.nextBird -= dt; this.nextFar -= dt;
      if (this.nextBird <= 0) { this.nextBird = 3 + Math.random() * 8; if (ENV.night < 0.5 && ENV.rain < 0.3) this.bird(); }
      this.nextCricket -= dt; if (this.nextCricket <= 0) { this.nextCricket = 0.5 + Math.random() * 0.7; if (ENV.night > 0.5 && ENV.rain < 0.3) this.cricket(); }
      if (this.nextFar <= 0) { this.nextFar = 14 + Math.random() * 25; this.distant(); }
    }
    this.music(dt, intensity || 0);
  },
  cricket() { const a = Math.random() * 6.28, d = 8 + Math.random() * 25, x = player.x + Math.cos(a) * d * U, y = player.y + Math.sin(a) * d * U; for (let i = 0; i < 3; i++) this.tone(4300 + Math.random() * 300, 0.05, 'sine', 0.035, 0, { ui: false, at: [x, y], vol: 2, ref: 6, range: 90, delay: i * 0.07, rev: 0.1 }); },
  thunder(delay) { this.noise(0.05, 0.5, { hp: 3000, delay, rev: 0.8 }); this.noise(3.2, 0.9, { lp: 260, sweepTo: 50, attack: 0.25, delay: delay + 0.05, rev: 0.9 }); this.thump(55, 28, 1.6, 0.5, { delay: delay + 0.1, ui: true }); },
  bird() {
    const a = Math.random() * 6.28, d = 25 + Math.random() * 60, x = player.x + Math.cos(a) * d * U, y = player.y + Math.sin(a) * d * U, n = 2 + Math.floor(Math.random() * 3), f0 = 2600 + Math.random() * 1600;
    for (let i = 0; i < n; i++) this.tone(f0, 0.09, 'sine', 0.06, 700 + Math.random() * 600, { ui: false, at: [x, y], vol: 2.6, ref: 10, range: 150, delay: i * 0.13, rev: 0.2 });
  },
  distant() {
    const a = Math.random() * 6.28, d = 140 + Math.random() * 60, x = player.x + Math.cos(a) * d * U, y = player.y + Math.sin(a) * d * U;
    const n = 1 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) { this.noise(0.25, 0.5, { lp: 700, sweepTo: 150, at: [x, y], vol: 2.2, ref: 30, range: 260, delay: i * (0.12 + Math.random() * 0.2), rev: 0.7, noDelay: true }); }
  },
  // generative score: a low drone and a pulse that speeds up with the number of enemies; no music while paused
  music(dt, intensity) {
    if (!this.musicOn || this.paused || state === 'upgrade') return;
    const t = this.ac.currentTime; if (this.nextBeat < t - 0.5) this.nextBeat = t + 0.1;
    const bpm = 78 + intensity * 40, spb = 60 / bpm / 2;
    const scale = [0, 3, 5, 7, 10, 12];
    while (this.nextBeat < t + 0.25) {
      const b = this.beat++, when = this.nextBeat; this.nextBeat += spb;
      const out = n => n.connect(this.musicBus);
      if (b % 16 === 0) {                                   // pad chord
        const base = [41, 41, 36, 38][Math.floor(b / 16) % 4];
        for (const iv of [0, 7, 12, 15]) { const o = this.ac.createOscillator(), g = this.ac.createGain(), lp = this.ac.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 440 * Math.pow(2, (base + iv - 69) / 12) * (1 + (Math.random() - 0.5) * 0.004); lp.type = 'lowpass'; lp.frequency.value = 500;
          g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.025, when + 1.5); g.gain.linearRampToValueAtTime(0.0001, when + spb * 16); o.connect(lp); lp.connect(g); out(g); o.start(when); o.stop(when + spb * 16 + 0.1); }
      }
      if (b % 2 === 0 && intensity > 0.05) {                // bass pulse
        const o = this.ac.createOscillator(), g = this.ac.createGain(); o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (28 + scale[(b >> 1) % 3 === 2 ? 3 : 0] - 69) / 12);
        g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.05 + 0.04 * intensity, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + spb * 1.6); o.connect(g); out(g); o.start(when); o.stop(when + spb * 1.7);
      }
      if (intensity > 0.35 && (b % 4 === 2 || (intensity > 0.7 && b % 2 === 1))) {   // hat
        const s = this.ac.createBufferSource(), g = this.ac.createGain(), hp = this.ac.createBiquadFilter(); s.buffer = this.nb; hp.type = 'highpass'; hp.frequency.value = 6500;
        g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.03, when + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05); s.connect(hp); hp.connect(g); out(g); s.start(when, Math.random()); s.stop(when + 0.06);
      }
      if (intensity > 0.55 && b % 8 === 0) { const o = this.ac.createOscillator(), g = this.ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, when); o.frequency.exponentialRampToValueAtTime(40, when + 0.2); g.gain.setValueAtTime(0.12, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.25); o.connect(g); out(g); o.start(when); o.stop(when + 0.3); }   // kick
    }
  },
};
