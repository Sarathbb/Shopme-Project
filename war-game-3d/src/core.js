// ---------- Core constants ----------
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const W = 900, H = 600, SS = 2;      // screen layout size (HUD/menus) and overlay supersampling
const U = 20;                         // field pixels per metre
let FW = 2400, FH = 1600;             // playable field in pixels (set per map; the default map is 120 m x 80 m)
let SPAWN = { x: 1200, y: 800 };       // where the player starts
const AIM_H = 1.3;                    // bullet / gun height above ground (m)
const wx = x => x / U - FW / U / 2, wz = y => y / U - FH / U / 2;   // field px -> world metres
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clampN((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const srgb = c => new THREE.Color(c).convertSRGBToLinear();   // we render with sRGB output, so author colours in sRGB
const coarse = matchMedia('(pointer: coarse)').matches;
