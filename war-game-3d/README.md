# War 3D

A third-person 3D war shooter that runs in the browser (Three.js). Open `index.html`, or rebuild it from the sources.

- `src/` game code: `core.js` (constants), `human.js` (rigged soldier, weapons, arm IK), `render.js` (renderer, sky, camera, effects),
  `world.js` (terrain, roads, village, forests, props), `interior.js` (enterable buildings: walls, doors, rooms, furniture),
  `vehicles.js` (vehicle models with opening doors, driving, collisions), `game.js` (rules, input, HUD)
- `assets/Soldier.glb` rigged and animated soldier (Idle/Walk/Run) from the Three.js examples
- `build.py` inlines the code and embeds the model, producing the single-file `index.html`

Controls: WASD move, mouse look (click to capture, Esc to release), LMB shoot, RMB or G grenade, Space dash, R reload, 1/2/3 weapon,
P pause, Q/E turn, **F** open or close a door / get in or out of a vehicle.
Driving: W/S gas and brake, A/D steer, Space handbrake, mouse look. On touch screens: left stick moves, drag the right side to look, FIRE button shoots, USE opens doors and enters vehicles; while driving the left stick steers and accelerates.

Credits: the soldier model is the "Vanguard" character used in the Three.js examples (Mixamo).
