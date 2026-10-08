// ---------- Realistic cars: smoothed side-profile bodies with clear-coat paint, glass, wheels, lights, plates and an interior ----------
let CAR_ENV = null; const CAR_MATS = [];
function carEnv() {                                                // reflections: a little sky-and-ground scene baked once into an environment map
  if (CAR_ENV) return CAR_ENV;
  try {
    const sc = new THREE.Scene(), pm = new THREE.PMREMGenerator(renderer), skyM = new THREE.Mesh(new THREE.SphereGeometry(100, 24, 12), sky.material.clone());
    sc.add(skyM); const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x66705a })); ground.position.y = -1; sc.add(ground);
    CAR_ENV = pm.fromScene(sc, 0.03).texture; pm.dispose();
  } catch (e) { CAR_ENV = null; }
  return CAR_ENV;
}
function carMat(kind, color, o = {}) {
  const env = carEnv(); let m;
  if (kind === 'paint') m = new THREE.MeshPhysicalMaterial({ color: srgb(color), metalness: 0.55, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.07, envMap: env, envMapIntensity: 1, ...o });
  else if (kind === 'glass') m = new THREE.MeshPhysicalMaterial({ color: srgb('#0e1822'), metalness: 0.05, roughness: 0.04, envMap: env, envMapIntensity: 1.4, transparent: true, opacity: 0.72, depthWrite: false, ...o });
  else if (kind === 'chrome') m = new THREE.MeshStandardMaterial({ color: srgb('#d8dce0'), metalness: 1, roughness: 0.14, envMap: env, envMapIntensity: 1, ...o });
  else m = new THREE.MeshStandardMaterial({ color: srgb(color || '#16171a'), roughness: 0.8, metalness: 0.1, ...o });
  if (env && kind !== 'plastic') CAR_MATS.push(m); return m;
}
const chaikin = (pts, n = 2) => { for (let k = 0; k < n; k++) { const o = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } pts = o; } return pts; };
function extrudeProfile(pts, W, bev = 0.07) {
  const sh = new THREE.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]));
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.1, W - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 4 }); g.translate(0, 0, -(W - 2 * bev) / 2); return g;
}
const polyGeo = pts => { const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])))); return g; };
function slantQuad(x0, y0, x1, y1, w0, w1) {                       // a sloped glass panel (windscreen / rear window) spanning the car's width
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, -w0, x0, y0, w0, x1, y1, w1, x1, y1, -w1], 3)); g.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]); g.computeVertexNormals(); return g;
}
// side silhouettes in metres (x forward, y up) for a car of the nominal length; scaled to the real length
const CAR_PROFILE = {
  sedan: { L: 4.4, body: [[-2.2, 0.4], [-2.2, 0.82], [-2.05, 0.98], [-1.2, 1.02], [-0.75, 1.38], [0.55, 1.4], [1.05, 1.02], [1.95, 0.92], [2.2, 0.74], [2.2, 0.4]],
    win: [[[-1.1, 1.07], [-0.78, 1.33], [-0.12, 1.34], [-0.12, 1.07]], [[0.0, 1.07], [0.0, 1.34], [0.52, 1.34], [0.92, 1.07]]], wind: [[1.06, 1.04, 0.56, 1.37], [-1.2, 1.04, -0.78, 1.36]] },
  pickup: { L: 5.0, body: [[-2.5, 0.45], [-2.5, 1.08], [-0.6, 1.08], [-0.55, 1.62], [0.7, 1.64], [1.15, 1.2], [2.05, 1.08], [2.5, 0.9], [2.5, 0.45]],
    win: [[[-0.42, 1.2], [-0.38, 1.57], [0.66, 1.58], [1.04, 1.2]]], wind: [[1.16, 1.22, 0.74, 1.6], [-0.55, 1.22, -0.55, 1.6]] },
  van: { L: 4.8, body: [[-2.4, 0.42], [-2.4, 1.92], [1.1, 1.97], [1.75, 1.4], [2.4, 1.02], [2.4, 0.42]],
    win: [[[0.78, 1.45], [0.98, 1.88], [1.42, 1.9], [1.7, 1.45]]], wind: [[1.78, 1.42, 1.18, 1.92]] },
  jeep: { L: 4.2, body: [[-2.1, 0.45], [-2.1, 1.3], [0.1, 1.3], [0.35, 1.3], [0.6, 1.25], [2.0, 1.2], [2.1, 0.95], [2.1, 0.45]], win: [], wind: [[0.62, 1.28, 0.4, 1.78]] },
  wreck: null,
};
CAR_PROFILE.wreck = CAR_PROFILE.sedan;
const plateTex = () => { const c = document.createElement('canvas'); c.width = 128; c.height = 40; const g = c.getContext('2d'); g.fillStyle = '#f4f2e8'; g.fillRect(0, 0, 128, 40); g.strokeStyle = '#222'; g.lineWidth = 3; g.strokeRect(2, 2, 124, 36); g.fillStyle = '#16181c'; g.font = 'bold 21px monospace'; g.textAlign = 'center'; g.fillText('KL ' + (1 + Math.floor(Math.random() * 79)).toString().padStart(2, '0') + ' ' + pick(['AB', 'BC', 'CK', 'DM', 'EF']) + ' ' + (1000 + Math.floor(Math.random() * 8999)), 64, 28); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };

function makeCarMesh(v) {
  const T = v.type, wreck = T === 'wreck', L = v.halfL * 2 / U, Wd = v.halfW * 2 / U, g = new THREE.Group(), root = new THREE.Group(); root.add(g);
  const paintCol = wreck ? '#2a2420' : T === 'jeep' ? '#5a6340' : v.col;
  const body = wreck ? carMat('plastic', '#2a2420', { roughness: 0.95 }) : carMat('paint', paintCol), glass = wreck ? carMat('plastic', '#111', { roughness: 1 }) : carMat('glass'), chrome = carMat('chrome'), dark = carMat('plastic', '#16171a'), rubber = carMat('plastic', '#101112', { roughness: 0.95 });
  const box = (w, h, d, m, x, y, z, parent = g) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.castShadow = true; b.receiveShadow = true; b.position.set(x, y, z); parent.add(b); return b; };
  const lightMat = (c, i) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.2 });
  let frontX = L / 2, rearX = -L / 2, wheelXs = [L * 0.32, -L * 0.32], wr = 0.34;
  if (T === 'truck') {
    wr = 0.5; wheelXs = [L * 0.32, -L * 0.3, -L * 0.42];
    const cabL = L * 0.28, cabX = L * 0.36, cabP = [[-cabL / 2, 0.6], [-cabL / 2, 2.55], [cabL * 0.15, 2.62], [cabL * 0.42, 1.95], [cabL * 0.5, 1.45], [cabL * 0.5, 0.6]];
    const cab = new THREE.Mesh(extrudeProfile(chaikin(cabP.map(p => [p[0] + cabX, p[1]]), 2), Wd * 0.96, 0.08), body); cab.castShadow = true; g.add(cab);
    for (const sz of [-1, 1]) { const w = new THREE.Mesh(polyGeo([[cabX - 0.25, 1.55], [cabX - 0.2, 2.35], [cabX + cabL * 0.18, 2.4], [cabX + cabL * 0.38, 1.7], [cabX + cabL * 0.38, 1.55]]), glass); w.position.z = sz * (Wd * 0.48 + 0.012); if (sz < 0) w.rotation.y = Math.PI; g.add(w); }
    g.add(new THREE.Mesh(slantQuad(cabX + cabL * 0.44, 1.65, cabX + cabL * 0.3, 2.45, Wd * 0.4, Wd * 0.4), glass));
    box(L * 0.66, 2.2, Wd, carMat('plastic', '#c9cbc6', { roughness: 0.7, metalness: 0.2 }), -L * 0.17, 1.95, 0); box(L * 0.7, 0.3, Wd * 0.9, dark, -L * 0.15, 0.78, 0);
    for (let i = 0; i < 6; i++) box(0.05, 2.1, Wd * 1.01, carMat('plastic', '#a9aca6'), -L * 0.45 + i * L * 0.12, 1.95, 0);                    // cargo box ribs
    box(0.3, 0.5, Wd * 0.98, rubber, L / 2 - 0.05, 0.7, 0); box(0.04, 0.9, Wd * 0.6, dark, L * 0.5 - 0.02, 1.2, 0); rearX = -L * 0.5;
  } else {
    const P = CAR_PROFILE[T] || CAR_PROFILE.sedan, k = L / P.L, sc = pt => [pt[0] * k, pt[1]];
    const bodyG = extrudeProfile(chaikin(P.body.map(sc), 2), Wd * 0.98, 0.07); const bm = new THREE.Mesh(bodyG, body); bm.castShadow = true; bm.receiveShadow = true; g.add(bm);
    for (const poly of P.win) for (const sz of [-1, 1]) { const w = new THREE.Mesh(polyGeo(poly.map(sc)), glass); w.position.z = sz * (Wd * 0.49 + 0.014); if (sz < 0) w.rotation.y = Math.PI; g.add(w); }
    for (const [x0, y0, x1, y1] of P.wind) g.add(new THREE.Mesh(slantQuad(x0 * k, y0, x1 * k, y1, Wd * 0.43, Wd * 0.4), glass));
    if (T === 'pickup') { box(L * 0.4, 0.05, Wd * 0.8, dark, -L * 0.27, 1.095, 0); box(0.06, 0.08, Wd * 0.9, body, -L * 0.5 + 0.03, 1.1, 0); for (const sz of [-1, 1]) box(L * 0.4, 0.4, 0.05, body, -L * 0.27, 1.28, sz * Wd * 0.46); }
    if (T === 'jeep') {                                                                  // open top: roll bars, spare wheel, seats
      for (const sz of [-1, 1]) { box(0.07, 0.6, 0.07, dark, -L * 0.2, 1.62, sz * Wd * 0.4); box(0.07, 0.07, 0.07, dark, 0.2 * k, 1.78, sz * Wd * 0.43); } box(0.07, 0.07, Wd * 0.85, dark, -L * 0.2, 1.93, 0);
      const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 18).rotateX(Math.PI / 2), rubber); spare.position.set(-L / 2 - 0.2, 1.0, 0); spare.rotation.set(0, Math.PI / 2, 0); spare.rotation.set(0, 0, 0); spare.rotation.y = 0; spare.castShadow = true; g.add(spare); spare.rotation.set(0, Math.PI / 2, 0);
    }
    // interior seen through the glass
    if (T !== 'jeep' || true) { const sy = T === 'van' ? 1.05 : 0.8; for (const sz of [-1, 1]) { box(0.55, 0.12, 0.5, dark, L * 0.04, sy, sz * Wd * 0.22); box(0.12, 0.55, 0.5, dark, -L * 0.06, sy + 0.3, sz * Wd * 0.22); } box(0.3, 0.3, Wd * 0.8, dark, L * 0.17, sy + 0.15, 0); const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 16), dark); sw.position.set(L * 0.14, sy + 0.38, Wd * -0.22); sw.rotation.y = Math.PI / 2; sw.rotation.x = 0.35; g.add(sw); }
    frontX = L * 0.5; rearX = -L * 0.5; if (T === 'pickup') wr = 0.38; else if (T === 'van') wr = 0.36; else if (T === 'jeep') wr = 0.42;
  }
  // wheel arches, wheels (rounded tyres, rims with spokes) and the front wheels that steer
  const wheels = [], front = [];
  const dualRear = T === 'truck';
  wheelXs.forEach((wxm, idx) => {
    const isF = idx === 0;
    for (const sz of [-1, 1]) {
      if (wreck && Math.random() < 0.25) continue;
      const arch = new THREE.Mesh(new THREE.CircleGeometry(wr * 1.22, 22), dark); arch.position.set(wxm, wr, sz * (Wd * 0.49 + 0.02)); if (sz < 0) arch.rotation.y = Math.PI; g.add(arch);
      const grp = new THREE.Group(); grp.position.set(wxm, wr, sz * (Wd / 2 - 0.12));
      const w = new THREE.Group(); const tyre = new THREE.Mesh(new THREE.TorusGeometry(wr * 0.76, wr * 0.26, 10, 22), rubber); tyre.castShadow = true; w.add(tyre);
      const sidewall = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.78, wr * 0.78, wr * 0.34, 20).rotateX(Math.PI / 2), rubber); w.add(sidewall);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.6, wr * 0.6, wr * 0.38, 18).rotateX(Math.PI / 2), chrome); w.add(rim);
      for (let s = 0; s < 5; s++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(wr * 1.0, wr * 0.09, wr * 0.4), dark); sp.rotation.z = s / 5 * Math.PI; sp.position.z = sz * wr * 0.04; w.add(sp); }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.13, wr * 0.13, wr * 0.44, 10).rotateX(Math.PI / 2), chrome); w.add(hub);
      grp.add(w); g.add(grp); wheels.push(w); if (isF) front.push(grp);
    }
  });
  let lampMats = null;
  if (!wreck) {
    const hl = lightMat('#fff3d0', 0.8), tl = lightMat('#d01818', 0.55); lampMats = [hl, tl];
    for (const sz of [-1, 1]) {
      box(0.1, 0.17, 0.4, chrome, frontX - 0.02, T === 'truck' ? 1.0 : 0.78, sz * Wd * 0.33); box(0.06, 0.14, 0.34, hl, frontX + 0.04, T === 'truck' ? 1.0 : 0.78, sz * Wd * 0.33);
      box(0.1, 0.14, 0.36, dark, rearX + 0.02, T === 'truck' ? 1.0 : 0.8, sz * Wd * 0.34); box(0.06, 0.12, 0.3, tl, rearX - 0.03, T === 'truck' ? 1.0 : 0.8, sz * Wd * 0.34);
      const mir = box(0.1, 0.12, 0.18, body, L * 0.1, T === 'van' ? 1.6 : T === 'truck' ? 2.0 : 1.12, sz * (Wd / 2 + 0.12)); box(0.03, 0.03, 0.1, dark, L * 0.1, mir.position.y - 0.06, sz * (Wd / 2 + 0.05));
      box(0.5, 0.02, 0.02, dark, L * 0.02, T === 'truck' ? 1.6 : 0.88, sz * (Wd / 2 + 0.003)); box(0.14, 0.03, 0.03, chrome, -L * 0.02, T === 'truck' ? 1.7 : 1.0, sz * (Wd / 2 + 0.014));   // door seam and handle
    }
    box(0.1, 0.12, Wd * 0.85, dark, frontX + 0.01, 0.52, 0); box(0.1, 0.12, Wd * 0.85, dark, rearX - 0.01, 0.52, 0);                            // bumpers
    box(0.05, 0.22, Wd * 0.45, dark, frontX + 0.02, T === 'truck' ? 1.0 : 0.72, 0); for (let i = 0; i < 4; i++) box(0.02, 0.012, Wd * 0.4, chrome, frontX + 0.05, (T === 'truck' ? 0.92 : 0.64) + i * 0.05, 0);   // grille
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), new THREE.MeshStandardMaterial({ map: plateTex(), roughness: 0.6 })); plate.position.set(rearX - 0.012, 0.62, 0); plate.rotation.y = -Math.PI / 2; g.add(plate);
    const pf = plate.clone(); pf.position.set(frontX + 0.01, 0.5, 0); pf.rotation.y = Math.PI / 2; g.add(pf);
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 10).rotateZ(Math.PI / 2), chrome); ex.position.set(rearX - 0.04, 0.38, Wd * 0.3); g.add(ex);
  }
  // driver door (left side): a dark recess with a seat, and a hinged panel in front of it
  const [dxf, dlf] = VT[T].door, dx = L * dxf, dl = L * dlf, dy = T === 'truck' ? 1.25 : 0.95, dh = T === 'truck' ? 1.3 : 0.62;
  box(dl, dh, 0.05, dark, dx, dy, -Wd / 2 + 0.01); box(dl * 0.6, 0.12, 0.38, dark, dx - dl * 0.1, dy - 0.15, -Wd / 2 + 0.2); box(dl * 0.6, 0.4, 0.1, dark, dx - dl * 0.3, dy + 0.1, -Wd / 2 + 0.2);
  const pivot = new THREE.Group(); pivot.position.set(dx + dl / 2, dy, -Wd / 2 - 0.05); g.add(pivot);
  box(dl, dh, 0.06, body, -dl / 2, 0, 0, pivot); box(dl * 0.86, dh * 0.45, 0.07, glass, -dl / 2, dh * 0.34, 0, pivot); box(0.14, 0.04, 0.06, chrome, -dl + 0.2, -0.02, -0.05, pivot);
  if (wreck) g.rotation.z = rnd(-0.05, 0.05);
  root.userData = { pivot, wheels, front, g, lamps: lampMats };
  return root;
}
