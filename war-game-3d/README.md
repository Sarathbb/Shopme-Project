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

Modes (menu, **B** or click the Mode bar): **Survival** (endless waves and bosses, with level perks), **Missions** and **Battle Royale** (you plus up to 24 bots on the big real maps, 11 on the small countryside field). In Battle Royale you start with one weapon and one spare magazine and must loot the houses and the open ground, fight the bots (who also fight each other), and stay inside the shrinking red zone; the last one alive wins. The zone arrow and timer are at the top of the screen; outside the zone you take damage that grows with every phase.

Enemy AI: soldiers and snipers have limited sight (shorter at night and in fog and rain, longer when you fire an unsilenced gun or carry a light), hear gunshots and explosions, take cover behind crates, planks, sandbags and barriers and peek out to shoot, flank you from the side, strafe while firing, retreat when badly hurt, search where they last saw you, and throw grenades at players who are hiding. In Battle Royale only enemies that have spotted you are marked on screen.

Progression: every run earns XP, saved in your browser (localStorage). Levels unlock starting perks for Survival (bandages, medkit, silencer, armor, scope, grenades, attachments, more HP). **R** in the menu opens Records: your best runs per mode, totals and the perk list.

Grenades and knife: hold **G** (or the right mouse button) to aim a grenade with a dotted arc and landing ring, release to throw; **T** switches between **frag**, **smoke** (blocks line of sight for about 17 s, so enemies lose you) and **flash** (blinds enemies in line of sight and white-outs your screen if you look at it). **X** is the knife: stab the nearest enemy in front, or kill an enemy who has not seen you from behind for a silent takedown. Crates and plank walls splinter to a stab too.

New enemies in Survival: **dogs** (fast biters in packs, wave 2+), **heavies** (armoured, wave 4+), **rooftop snipers** on tall buildings with a red laser telegraph before each shot (maps with real buildings, wave 3+), and an **attack helicopter** every third wave from wave 6 that circles and fires bursts. There is a **motorbike** among the parked vehicles: very fast and narrow, with a visible rider.

Missions (third mode in the menu): a chain of objectives that get harder. **Capture** a circle (stand in it, uncontested); **Rescue** a hostage from a guarded camp (sneak, hold F to cut the ropes, lead them to the green extraction ring; they follow your trail); **Defend** a radio base for about a minute while enemies attack it and you; **Destroy a convoy** of three vehicles driving along a road before they escape. Each success pays XP and score, drops loot and offers an upgrade.

Touch controls (phones and tablets; the layout appears when you first touch the screen): a floating move stick on the left (it follows your thumb; push it all the way to sprint, or turn on auto-sprint), drag anywhere on the right to look, and hold **FIRE** and drag at the same time to aim and shoot with one thumb. Around FIRE are JUMP, RLD (reload), GRN (hold to see the throw arc, release to throw), CRCH (crouch) and ... (opens a menu with KNIFE, BAND, MED, SWAP, GUN, DASH, TYPE and ZOOM). USE (doors, vehicles), HEAL and ZOOM appear when they are relevant, and tapping a weapon slot at the bottom switches weapons. The **SET** button next to pause opens settings: auto-sprint, aim assist, gyro aiming (tilt the phone; flip the direction if it feels backwards), vibration on hits, a left-handed layout and look sensitivity. Settings are saved on the device.

Realism pass: walls and roofs stay solid when you walk into a building (you see the room, a ceiling and daylight through the windows, not the outside world), and the camera stays inside the room under the ceiling. Items on the ground are now modelled objects (health pack, medkit, bandage rolls, armor vest, ammo box, grenades, attachments, and real guns lying down) that you pick up with **F** when close; the nearest one gets a bright ring and a prompt. Trees have lumpy crowns with light and shade, tiered pines, bark rings and wind sway (stronger in storms), and Kochi has coconut palms. Cars have smooth bodies with clear-coat paint and sky reflections, tinted glass, rims, lights, bumpers, number plates and a seat interior.

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
