// Headless smoke test for Port Solenne: drives the real simulation with a
// scripted keyboard and a silent audio stub, and checks the systems the
// bounty asks for actually work — walking, stealing, driving, heat, police,
// the first mission, saves. Run with:  node tests/smoke.mjs
// Exits non-zero if any check fails.

import { makeRandom } from '../game/src/random.js';
import { createWorld } from '../game/src/world.js';
import { MISSIONS } from '../game/src/missions.js';
import { saveGame, loadGame, wipeGame } from '../game/src/save.js';
import { MART } from '../game/src/city.js';

const DT = 1 / 60;
let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) { passed += 1; console.log(`  ok  ${name}`); }
  else { failed += 1; console.log(`FAIL  ${name} ${detail}`); }
}

const silentAudio = {
  update() {}, setSiren() {}, sfx() {}, unlock() {},
  toggleMute() { return false; }, muted: false,
};

function scriptedInput() {
  const held = new Set();
  const taps = new Set();
  return {
    down: (a) => held.has(a),
    pressed: (a) => taps.has(a),
    endFrame: () => taps.clear(),
    hold: (a, on = true) => { if (on) held.add(a); else held.delete(a); },
    tap: (a) => taps.add(a),
  };
}

function run(world, input, steps) {
  for (let i = 0; i < steps; i++) world.update(DT, input);
}

function freshWorld(seed = 11) {
  const input = scriptedInput();
  const world = createWorld(makeRandom(seed), silentAudio);
  return { world, input, state: world.state };
}

// --- the city itself -------------------------------------------------------
{
  const { world, state } = freshWorld();
  check('city has buildings', state.city.buildings.length > 50, `got ${state.city.buildings.length}`);
  check('city has shop signs', state.city.signs.length >= 8, `got ${state.city.signs.length}`);
  check('traffic and parked cars exist', state.cars.length >= 30, `got ${state.cars.length}`);
  check('pedestrians exist', state.peds.length >= 25, `got ${state.peds.length}`);
  check('ghost collectibles placed', state.city.ghostSpots.length === 12);
  check('story has six missions', MISSIONS.length === 6);
  check('objective points at the first giver', world.objective().label.includes('Marisol'), world.objective().label);
  const traffic = state.cars.find((c) => c.mode === 'traffic');
  const before = { x: traffic.x, y: traffic.y };
  run(world, scriptedInput(), 300);
  check('traffic actually drives', Math.hypot(traffic.x - before.x, traffic.y - before.y) > 24,
    `moved ${Math.hypot(traffic.x - before.x, traffic.y - before.y).toFixed(0)}px`);
  check('the day clock advances', state.clock !== 0.7);
}

// --- walking, stealing, driving ---------------------------------------------
{
  const { world, input, state } = freshWorld();
  const startX = state.player.x;
  input.hold('right');
  run(world, input, 60);
  input.hold('right', false);
  check('player walks east', state.player.x > startX + 55, `moved ${(state.player.x - startX).toFixed(0)}px`);

  const coupe = state.cars.find((c) => c.mode === 'parked' && c.kindName === 'Palmetto Coupe');
  state.player.x = coupe.x - 30;
  state.player.y = coupe.y;
  input.tap('enter');
  run(world, input, 2);
  check('player enters a car', state.player.car === coupe);
  const at = { x: coupe.x, y: coupe.y };
  input.hold('up');
  run(world, input, 100);
  input.hold('up', false);
  check('car drives away', Math.hypot(coupe.x - at.x, coupe.y - at.y) > 60,
    `drove ${Math.hypot(coupe.x - at.x, coupe.y - at.y).toFixed(0)}px`);
  check('theft counted', state.stats.carsStolen >= 1);
  input.tap('enter');
  run(world, input, 2);
  check('player exits the car', state.player.car === null);
}

// --- crime, heat, police ------------------------------------------------------
{
  const { world, input, state } = freshWorld();
  const ped = state.peds.find((p) => p.down <= 0);
  state.player.x = ped.x - 24;
  state.player.y = ped.y;
  input.tap('punch');
  run(world, input, 3);
  check('assault registers heat', state.heat > 0, `heat ${state.heat}`);
  input.hold('shoot');
  run(world, input, 420);
  input.hold('shoot', false);
  check('wanted star rises', world.stars() >= 1, `stars ${world.stars()} heat ${Math.round(state.heat)}`);
  // Poll while the run unfolds (a stationary player would simply be arrested,
  // which clears the board again — the response is what is being proven).
  let policeHere = false;
  for (let i = 0; i < 24 && !policeHere; i++) {
    run(world, input, 30);
    policeHere = state.cars.some((c) => c.mode === 'police') || state.cops.length > 0;
  }
  check('police respond to the wanted level', policeHere);
}

// --- ghosts and pickups ---------------------------------------------------------
{
  const { world, input, state } = freshWorld();
  const spot = state.city.ghostSpots[0];
  const moneyBefore = state.money;
  state.player.x = spot.x;
  state.player.y = spot.y;
  run(world, input, 3);
  check('ghost collectible collected', state.ghosts.includes(spot.id) && state.money === moneyBefore + 25);
  const cash = state.pickups.find((p) => p.kind === 'cash');
  const before = state.money;
  state.player.x = cash.x;
  state.player.y = cash.y;
  run(world, input, 3);
  check('cash pickup pays out', state.money === before + 30, `money ${state.money} vs ${before}`);
}

// --- the story opens --------------------------------------------------------------
{
  const { world, input, state } = freshWorld();
  state.player.x = MART.doorX;
  state.player.y = MART.doorY - 22;
  let steps = 0;
  while (state.mission.phase !== 'run' && steps < 900) { run(world, input, 10); steps += 10; }
  check('mission one starts at the giver', state.mission.phase === 'run', `phase ${state.mission.phase}`);
  state.player.x = 430;
  state.player.y = 300;
  run(world, input, 3);
  check('first mission step completes', state.mission.step === 1, `step ${state.mission.step}`);
}

// --- saves ---------------------------------------------------------------------------
{
  const { world, state } = freshWorld();
  state.money = 777;
  const snap = world.snapshot();
  saveGame(snap);
  const loaded = loadGame();
  check('save persists through storage', !!loaded && loaded.money === 777);
  const other = freshWorld(99);
  other.world.applySnapshot(loaded);
  check('save restores money', other.state.money === 777);
  check('save restores mission progress', other.state.mission.index === snap.missionIndex);
  wipeGame();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
