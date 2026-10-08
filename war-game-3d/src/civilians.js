// ---------- Civilians in everyday clothes: the soldier's armoured skin is hidden and a clothed body is built on the same skeleton, so every animation still drives it ----------
const SKIN_TONES = ['#8a5a3c', '#a06a46', '#b57c58', '#c48a62', '#7a4c32', '#d4a07a'], HAIR_COLS = ['#16120e', '#1c1612', '#2a2018', '#3a2a1c', '#5a5a5c'];
const SHIRTS = ['#d8d4c8', '#7aa0c8', '#c86a5a', '#6aa88a', '#e0c060', '#8a6ac0', '#e8e8e8', '#4a6a90', '#b8584a', '#d0903a'], PANTS = ['#2f4468', '#5a5240', '#3a3a40', '#6a5a3a', '#26323f', '#7a7466'];
const SARIS = ['#c0304a', '#2a6a9a', '#d8a020', '#2a8a5a', '#8a2a8a', '#e87020', '#e8e0d0'], LUNGIS = ['#f2efe6', '#2a5aa0', '#c8c0a0', '#3a7a4a', '#a03a3a'];
const _Y = new THREE.Vector3(0, 1, 0);
function makeCivilian(o = {}) {
  const root = makeHuman({ tint: '#ffffff', gun: 'rifle', scale: o.scale || 1 }), u = root.userData, B = u.bones;
  u.model.traverse(m => { if (m.isSkinnedMesh) m.visible = false; });
  u.gun.visible = false; u.civ = true;
  const style = o.style || pick(['shirt', 'shirt', 'shirt', 'lungi', 'sari', 'sari', 'kurta']), fem = style === 'sari' || style === 'kurta' || o.fem;
  const skin = stdMat(null, o.skin || pick(SKIN_TONES), 0.7), shirt = stdMat(null, o.shirt || pick(SHIRTS), 0.9), pants = stdMat(null, o.pants || pick(PANTS), 0.9), shoe = stdMat(null, pick(['#1a1816', '#3a2a1c', '#d8d4c8', '#222a40']), 0.7), hair = stdMat(null, o.hair || pick(HAIR_COLS), 0.85);
  const saree = stdMat(null, o.saree || pick(SARIS), 0.8), lungi = stdMat(null, pick(LUNGIS), 0.9), blouse = stdMat(null, pick(['#e8c8a0', '#b84a5a', '#2a4a7a', '#e8e0d0', '#5a8a5a']), 0.85);
  const add = (bone, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; bone.add(m); return m; };
  const limb = (a, b, r0, r1, mat, sx = 1, sz = 1, ext = 0) => {                 // a tapered tube from bone a to its child b (units are centimetres, the skeleton's own)
    const v = B['mixamorig' + b].position.clone(), len = v.length() + ext, geo = new THREE.CylinderGeometry(r1, r0, len, 12, 1); geo.translate(0, len / 2, 0);
    const m = new THREE.Mesh(geo, mat); m.quaternion.setFromUnitVectors(_Y, v.clone().normalize()); m.scale.set(sx, 1, sz); m.castShadow = true; B['mixamorig' + a].add(m); return m;
  };
  const longSleeve = style !== 'lungi' || Math.random() < 0.5, topMat = style === 'sari' ? blouse : shirt, legMat = style === 'sari' || style === 'lungi' ? skin : pants;
  // torso, shoulders, neck and head
  limb('Hips', 'Spine', fem ? 14 : 15, 15.5, style === 'sari' ? saree : pants, 1.05, 0.72); limb('Spine', 'Spine1', 15.5, 15.5, topMat, 1.06, 0.74); limb('Spine1', 'Spine2', 15.5, fem ? 15 : 17, topMat, 1.1, 0.76); limb('Spine2', 'Neck', fem ? 15 : 17, 7, topMat, 1.12, 0.78, 1);
  limb('Neck', 'Head', 5.6, 5, skin); add(B.mixamorigHead, new THREE.SphereGeometry(10.2, 14, 12), skin, 0, 10.5, 2.0, 0.92, 1.13, 1.0);
  add(B.mixamorigHead, new THREE.SphereGeometry(10.6, 14, 8, 0, 6.283, 0, 1.75), hair, 0, 10.9, 1.4, 0.95, 1.12, 1.05);
  if (fem && Math.random() < 0.7) add(B.mixamorigHead, new THREE.SphereGeometry(9.5, 12, 10), hair, 0, 6.5, -3.4, 0.9, 1.5, 0.75);             // long hair
  add(B.mixamorigHead, new THREE.SphereGeometry(1.6, 6, 6), skin, 0, 9.3, 11.2, 1, 1, 1.4);                                                    // nose
  for (const ex of [-3.6, 3.6]) add(B.mixamorigHead, new THREE.SphereGeometry(1.0, 6, 6), stdMat(null, '#16120e', 0.5), ex, 12.2, 10.4);                // eyes
  for (const sd of ['Left', 'Right']) {
    const sgn = sd === 'Left' ? 1 : -1;
    limb(sd + 'Shoulder', sd + 'Arm', 5.4, 5.4, topMat); limb(sd + 'Arm', sd + 'ForeArm', 4.8, 3.9, topMat); limb(sd + 'ForeArm', sd + 'Hand', 3.8, 3.1, longSleeve ? topMat : skin);
    add(B['mixamorig' + sd + 'Hand'], new THREE.SphereGeometry(4.0, 8, 6), skin, 0, 4.2, 0, 1, 1.15, 0.7);
    limb(sd + 'UpLeg', sd + 'Leg', 8.4, 6.6, legMat); limb(sd + 'Leg', sd + 'Foot', 6.4, 4.7, legMat);
    const toe = B['mixamorig' + sd + 'ToeBase'], foot = B['mixamorig' + sd + 'Foot']; if (toe) { const v = toe.position.clone(), len = v.length() + 4, geo = new THREE.BoxGeometry(8, len, 6); geo.translate(0, len / 2, 0); const sh = new THREE.Mesh(geo, shoe); sh.quaternion.setFromUnitVectors(_Y, v.normalize()); sh.castShadow = true; foot.add(sh); }
  }
  // garments that hang from the hips: skirts and tunics (rigid, long enough to cover the stride)
  const cloth = (mat, topR, botR, h, z = 0, sz = 1.3) => { const m = add(B.mixamorigHips, new THREE.CylinderGeometry(botR, topR, h, 16, 1, true), mat, 0, -h / 2 + 2, z, 1.1, 1, sz); m.material = mat; m.material.side = THREE.DoubleSide; return m; };
  if (style === 'sari') {
    cloth(saree, 17, 25, 88, 0, 1.25);                                                                                                         // down to the ankles
    add(B.mixamorigSpine2, new THREE.BoxGeometry(12, 46, 2.6), saree, -3 * 1, -14, -9.5, 1, 1, 1).rotation.z = 0.22;                          // the pallu over the shoulder, hanging down the back
    add(B.mixamorigSpine1, new THREE.BoxGeometry(34, 4, 21), saree, 0, 0, 0.5, 1, 1, 1);
  } else if (style === 'lungi') { cloth(lungi, 17, 23, 72, 0, 1.3); add(B.mixamorigHips, new THREE.CylinderGeometry(16.5, 16.5, 4, 14), stdMat(null, '#3a2a1c', 0.8), 0, 5, 0, 1.1, 1, 0.8); }
  else if (style === 'kurta') cloth(shirt, 16.5, 21, 58, 0, 1.2);
  // head cover for some
  if (o.head || Math.random() < 0.18) { const k = o.head || pick(['cap', 'beret']); dressHuman(root, { skin: 'std', head: k, back: Math.random() < 0.2 ? 'pack' : 'none' }); }
  else if (Math.random() < 0.15) dressHuman(root, { skin: 'std', head: 'none', back: 'pack' });
  return root;
}
