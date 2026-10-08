# War 3D

A third-person 3D war shooter that runs in the browser (Three.js). Open `index.html`, or rebuild it from the sources.

- `src/` game code: `core.js` (constants), `human.js` (rigged soldier, weapons, arm IK), `render.js` (renderer, sky, camera, effects),
  `world.js` (terrain, roads, village, forests, props), `interior.js` (enterable buildings: walls, doors, rooms, furniture),
  `realmap.js` + `realmap_data.js` (real-world maps: streets and building footprints of an actual place, with enterable houses), `audio.js` (synthesised sound: positional audio, reverb, music), `vehicles.js` (vehicle models with opening doors, driving, collisions), `game.js` (rules, input, HUD)
- `assets/Soldier.glb` rigged and animated soldier (Idle/Walk/Run) from the Three.js examples
- `build.py` inlines the code and embeds the model, producing the single-file `index.html`

Controls: WASD move, mouse look (click to capture, Esc to release), LMB shoot, RMB or G grenade, **Space jump**, **Shift sprint**, **C crouch**, V dash, R reload, 1-4 weapon (Rifle, Shotgun, SMG, Sniper; the others are found as loot crates), **Z** scope zoom, **H** bandage, **J** medkit, **K** killcam on/off, **B** gunsmith (fit scope / silencer / extended mag / laser),
P pause, Q/E turn, **F** open or close a door / get in or out of a vehicle.
Driving: W/S gas and brake, A/D steer, Space handbrake, mouse look. On touch screens: left stick moves, drag the right side to look, FIRE button shoots, USE opens doors and enters vehicles, JUMP and CRCH jump and crouch (push the stick all the way to sprint); while driving the left stick steers and accelerates.

Credits: the soldier model is the "Vanguard" character used in the Three.js examples (Mixamo).

Movement: acceleration and braking, strafing and backpedalling are slower, uphill slows you, sprint uses stamina and you cannot shoot while sprinting.
Jumping clears low cover (sandbags, barriers, crates, tables) and you can stand on top of it. Accuracy: the bullet cone widens when moving, sprinting
or in the air and tightens when still or crouched; the crosshair gap shows it, and sustained fire adds bloom and recoil.

Destruction: shoot ground-floor windows to shatter them, wooden crates and plank walls splinter apart after enough hits, and red fuel barrels (yellow band) explode, chain-react, burn for a few seconds and hurt anything close, including you. Grenades and exploding cars break these too.

Day/night and weather: a full day lasts 8 minutes (it starts at 09:00). Dawn and dusk colour the sky, the moon and stars come out at night, some windows glow, and **L** switches on a flashlight (vehicles get headlights at night). The weather drifts between clear, cloudy, rain, storm (lightning and thunder) and fog; fog, rain and darkness shorten how far enemies can see and shoot. **O** changes the weather, **I** skips three hours. URL options for testing: `?time=22` and `?weather=storm`.

Sound: M mutes, N toggles the music. All audio is generated in the browser (no sound files): weapon shots, impacts by material, footsteps by surface, doors,
vehicle engine with gears, skid and horn (H), bullet whizzes, explosions, ambient wind and birds, and a generative score that speeds up with the action.
Sounds are positional and muffled when you are indoors and the source is outside.

## Real maps
The menu opens on **Fort Kochi, Kerala** (real OpenStreetMap streets and 141 building footprints from a 400 x 300 m window, 34 of them enterable houses; data (c) OpenStreetMap contributors, ODbL) and also offers **Prague, Bubeneč** (a 400 x 300 m window of a real Prague district: real street layout and 104 real building footprints, 34 of them enterable houses
with a door facing the street, the rest solid blocks extruded from their outlines) and a random countryside battlefield. Press **T** or click the map bar to switch.
Opening `index.html?map=proc` starts on the random map.

To add your own place (needs internet): `python3 tools/bake_osm.py --id mytown --name "My Town" --lat 10.0 --lon 76.2` then `python3 build.py`.
It downloads buildings and roads from OpenStreetMap (Overpass API) for a 400 x 300 m window and adds the map to the menu.
Credits: Prague data from the Bubeneč sample dataset in the momepy package (BSD-3-Clause); places baked with `bake_osm.py` are (c) OpenStreetMap contributors (ODbL).
