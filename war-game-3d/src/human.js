// ---------- Realistic soldier: rigged GLB (Idle/Walk/Run) + procedural weapon + arm IK ----------
const HUMAN = { gltf: null, clips: {} };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

function aimBone(bone, child, dir) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _b.sub(_a).normalize();
  _q1.setFromUnitVectors(_b, dir);
  bone.getWorldQuaternion(_q2); _q2.premultiply(_q1);
  bone.parent.getWorldQuaternion(_q1).invert();
  bone.quaternion.copy(_q1.multiply(_q2));
  bone.updateMatrixWorld(true);
}
// Two-bone IK: put the hand on `target` (world), bending the elbow toward `pole` (world direction).
function solveArm(upper, fore, hand, target, pole) {
  upper.getWorldPosition(_c); fore.getWorldPosition(_d); hand.getWorldPosition(_e);
  const l1 = _c.distanceTo(_d), l2 = _d.distanceTo(_e);
  const dir = target.clone().sub(_c), dist = Math.min(Math.max(dir.length(), 0.05), l1 + l2 - 0.002);
  dir.normalize();
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pd = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const elbow = _c.clone().add(dir.clone().multiplyScalar(a)).add(pd.multiplyScalar(h));
  aimBone(upper, fore, elbow.clone().sub(_c).normalize());
  fore.getWorldPosition(_d);
  aimBone(fore, hand, target.clone().sub(_d).normalize());
}

const GUN_MAT = {};
function gunMats() {
  if (!GUN_MAT.metal) {
    GUN_MAT.metal = new THREE.MeshStandardMaterial({ color: srgb('#1d1f22'), metalness: 0.8, roughness: 0.38 });
    GUN_MAT.poly = new THREE.MeshStandardMaterial({ color: srgb('#151617'), metalness: 0.1, roughness: 0.7 });
    GUN_MAT.wood = new THREE.MeshStandardMaterial({ color: srgb('#6b4a2b'), metalness: 0, roughness: 0.65 });
    GUN_MAT.tan = new THREE.MeshStandardMaterial({ color: srgb('#7a6a4a'), metalness: 0.1, roughness: 0.7 });
  }
  return GUN_MAT;
}
// Guns are built along +x with the rear of the stock at the origin. Grip points are in gun space.
function buildGun(kind) {
  const M = gunMats(), g = new THREE.Group();
  const bx = (m, x0, x1, y, h, w, z = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, w), m); o.position.set((x0 + x1) / 2, y, z); o.rotation.z = rz; o.rotation.y = ry; o.castShadow = true; g.add(o); return o;
  };
  const cy = (m, x0, x1, y, r, z = 0) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, x1 - x0, 10), m); o.rotation.z = Math.PI / 2; o.position.set((x0 + x1) / 2, y, z); o.castShadow = true; g.add(o); return o;
  };
  let grips;
  if (kind === 'shotgun') {
    bx(M.wood, 0, 0.3, -0.01, 0.1, 0.045, 0, 0, -0.12);        // stock
    bx(M.metal, 0.3, 0.58, 0.0, 0.075, 0.05);                   // receiver
    cy(M.metal, 0.5, 1.2, 0.02, 0.016); cy(M.metal, 0.55, 1.05, -0.015, 0.02); // barrel + magazine tube
    bx(M.wood, 0.7, 0.92, -0.02, 0.06, 0.06);                   // pump
    bx(M.wood, 0.34, 0.42, -0.1, 0.12, 0.04, 0, 0, 0.3);        // grip
    grips = { r: [0.38, -0.12, 0], l: [0.8, -0.06, 0] };
  } else if (kind === 'sniper') {
    bx(M.wood, 0, 0.32, -0.015, 0.11, 0.045, 0, 0, -0.1);        // stock
    bx(M.metal, 0.32, 0.62, 0.0, 0.085, 0.05);                   // action
    cy(M.metal, 0.62, 1.45, 0.012, 0.015);                       // long barrel
    cy(M.metal, 0.3, 0.62, 0.075, 0.03);                         // scope
    cy(M.metal, 0.28, 0.34, 0.075, 0.04); cy(M.metal, 0.58, 0.64, 0.075, 0.04);
    bx(M.poly, 0.38, 0.44, -0.08, 0.1, 0.04);                    // mag
    bx(M.wood, 0.34, 0.4, -0.09, 0.11, 0.04, 0, 0, 0.3);         // grip
    grips = { r: [0.37, -0.1, 0], l: [0.78, -0.04, 0] };
  } else if (kind === 'smg') {
    bx(M.poly, 0, 0.2, 0.0, 0.07, 0.03);                         // folding stock
    bx(M.metal, 0.2, 0.5, 0.0, 0.085, 0.05);                     // body
    cy(M.metal, 0.5, 0.78, 0.015, 0.014);                        // barrel
    bx(M.poly, 0.34, 0.4, -0.15, 0.2, 0.035, 0, 0, 0.05);        // long mag
    bx(M.poly, 0.26, 0.32, -0.09, 0.12, 0.035, 0, 0, 0.25);      // grip
    bx(M.metal, 0.3, 0.42, 0.06, 0.03, 0.03);                    // sight
    grips = { r: [0.29, -0.1, 0], l: [0.5, -0.08, 0] };
  } else {
    bx(M.poly, 0, 0.26, -0.01, 0.1, 0.045, 0, 0, -0.1);          // stock
    bx(M.metal, 0.26, 0.58, 0.0, 0.095, 0.05);                   // receiver
    bx(M.poly, 0.58, 0.84, 0.0, 0.075, 0.056);                   // handguard
    cy(M.metal, 0.84, 1.08, 0.012, 0.013);                       // barrel
    cy(M.metal, 1.02, 1.1, 0.012, 0.02);                         // muzzle brake
    bx(M.poly, 0.4, 0.46, -0.14, 0.2, 0.04, 0, 0, 0.18);         // magazine
    bx(M.poly, 0.31, 0.37, -0.09, 0.12, 0.04, 0, 0, 0.3);        // grip
    bx(M.metal, 0.34, 0.5, 0.075, 0.05, 0.04);                   // optic
    cy(M.metal, 0.36, 0.48, 0.08, 0.026);
    grips = { r: [0.34, -0.1, 0], l: [0.7, -0.05, 0] };
  }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.9, toneMapped: false }));
  muzzle.position.set(kind === 'shotgun' ? 1.25 : kind === 'smg' ? 0.85 : kind === 'sniper' ? 1.5 : 1.15, 0.012, 0); muzzle.visible = false; g.add(muzzle);
  g.userData = { grips, muzzle, kind };
  return g;
}

function makeHuman(o = {}) {
  const root = new THREE.Group(), model = THREE.SkeletonUtils.clone(HUMAN.gltf.scene);
  model.rotation.y = -Math.PI / 2; root.add(model);
    model.traverse(m => {
    if (!m.isMesh) return;
    m.castShadow = true; m.frustumCulled = false;
    m.material = m.material.clone(); m.material.color.multiply(srgb(o.tint || '#ffffff').lerp(new THREE.Color(1, 1, 1), 0)); 
    m.material.roughness = 0.75; m.material.metalness = 0.15;
  });
  const bones = {}; model.traverse(b => { if (b.isBone) bones[b.name] = b; });
  const mixer = new THREE.AnimationMixer(model), acts = {};
  for (const n of ['Idle', 'Walk', 'Run']) { acts[n] = mixer.clipAction(HUMAN.gltf.animations.find(c => c.name === n)); acts[n].play(); acts[n].setEffectiveWeight(n === 'Idle' ? 1 : 0); }
  acts.Idle.time = Math.random() * 3;
  root.scale.setScalar(o.scale || 1);
  root.userData = { model, bones, mixer, acts, w: { Idle: 1, Walk: 0, Run: 0 }, gun: null, gunKind: '', baseMats: [] , flashMats: []};
  model.traverse(m => { if (m.isMesh) root.userData.flashMats.push(m.material); });
  setHumanGun(root, o.gun || 'rifle');
  return root;
}
function flashHuman(root, hex) { for (const m of root.userData.flashMats) m.emissive.setHex(hex); }
function humanMuzzle(root, on) { root.userData.gun.userData.muzzle.visible = on;
}
function setHumanGun(root, kind) {
  const u = root.userData; if (u.gunKind === kind) return;
  if (u.gun) root.remove(u.gun);
  u.gun = buildGun(kind); u.gunKind = kind;
  u.gun.position.set(0.1, 1.36, 0.17); root.add(u.gun);
}
const POLE_R = new THREE.Vector3(0, -0.8, 0.7), POLE_L = new THREE.Vector3(0, -0.8, -0.5);
// speed in px/s (game units), back = moving against the facing direction
function updateHuman(root, dt, speed, back) {
  const u = root.userData, W = u.w;
  const tgt = { Idle: 0, Walk: 0, Run: 0 };
  if (speed < 8) tgt.Idle = 1;
  else if (speed < 140) { const k = (speed - 8) / 132; tgt.Idle = 1 - k; tgt.Walk = k; }
  else { const k = Math.min(1, (speed - 140) / 80); tgt.Walk = 1 - k; tgt.Run = k; }
  for (const n in W) {
    W[n] += (tgt[n] - W[n]) * Math.min(1, dt * 12);
    u.acts[n].setEffectiveWeight(W[n]);
  }
  const dirk = back ? -1 : 1;
  u.acts.Walk.setEffectiveTimeScale(Math.min(2.2, Math.max(0.3, speed / 75)) * dirk);
  u.acts.Run.setEffectiveTimeScale(Math.min(2.2, Math.max(0.5, speed / 105)) * dirk);
  u.mixer.update(dt);
  root.updateMatrixWorld(true);
  // arms hold the weapon
  const B = u.bones, gun = u.gun, gr = gun.userData.grips;
  const tr = gun.localToWorld(new THREE.Vector3(...gr.r)), tl = gun.localToWorld(new THREE.Vector3(...gr.l));
  const q = root.getWorldQuaternion(new THREE.Quaternion());
  solveArm(B.mixamorigRightArm, B.mixamorigRightForeArm, B.mixamorigRightHand, tr, POLE_R.clone().applyQuaternion(q));
  solveArm(B.mixamorigLeftArm, B.mixamorigLeftForeArm, B.mixamorigLeftHand, tl, POLE_L.clone().applyQuaternion(q));
}
