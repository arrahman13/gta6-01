// The simulation: one fixed-step world holding the player, traffic,
// pedestrians, police, bullets, the story and every side hustle in Port
// Solenne. It knows nothing about the DOM — the renderer reads its state,
// the input layer feeds it intents, and a headless test can drive it with a
// scripted keyboard. All randomness flows from the seeded stream handed in
// at creation, so a seed always grows the same city life.

import {
  WORLD_W, WORLD_H, AVENUES, STREETS, ROAD_HALF, PLAYER_TUNE, HEAT_TUNE,
  CAR_KINDS, PAINTS, NAMES, DAY_SECONDS,
} from './config.js';
import { generateCity, resolveCircle, MART, GARAGE, PRECINCT } from './city.js';
import { MISSIONS, SIDE_TEXT } from './missions.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

const GIVER_SPOTS = {
  marisol: { x: MART.doorX, y: MART.doorY + 6, label: 'Marisol at the Leonida Mart' },
  pepe: { x: 2760, y: 1180, label: 'Pepe at the marina lot' },
  vera: { x: 1740, y: 1560, label: 'Vera on the Neon Mile' },
  ghost: { x: 1862, y: 1652, label: 'the arcade cabinet' },
};
const CLINIC_DOOR = { x: 1240, y: 1010 };
const PRECINCT_DOOR = { x: PRECINCT.doorX, y: PRECINCT.doorY + 24 };
const RACE_START = { x: 3050, y: 2360 };
const RACE_GATES = [
  { x: 2640, y: 2340 }, { x: 2160, y: 1920 }, { x: 2640, y: 1500 },
  { x: 3120, y: 1080 }, { x: 2640, y: 660 }, { x: 3050, y: 2360 },
];

export function createWorld(rng, audio) {
  const city = generateCity(rng);
  const state = {
    time: 0,
    clock: 0.7, // late golden afternoon; the neon wakes up soon
    city,
    player: {
      x: MART.doorX, y: MART.doorY - 22, angle: -Math.PI / 2,
      hp: PLAYER_TUNE.health, car: null, punchCd: 0, shotCd: 0,
      hurtAgo: 99, bustMeter: 0,
    },
    money: 40,
    ammo: 24,
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    rivals: [],
    heat: 0,
    lastCrimeAgo: 99,
    seenAgo: 0,
    mission: { index: 0, phase: 'offer', step: 0, got: [], timer: 0, gate: 0, reached: false, alarmFired: false, dialogue: [], dialogueT: 0 },
    taxi: null,
    race: null,
    ghosts: [],
    pickups: city.pickups.map((p) => ({ ...p, taken: false, respawn: 0 })),
    toasts: [],
    banner: null,
    bannerT: 0,
    phone: null,
    stats: { carsStolen: 0, fares: 0, races: 0, ghosts: 0, missions: 0, shots: 0, punches: 0, busted: 0, wasted: 0 },
    camera: { x: 0, y: 0 },
    view: { w: 1280, h: 720 },
    over: null,
  };

  const toast = (text, secs = 3.4) => {
    state.toasts.push({ text, t: secs });
    if (state.toasts.length > 3) state.toasts.shift();
  };
  const say = (lines) => {
    state.mission.dialogue = lines.slice();
    state.mission.dialogueT = 0;
    if (lines.length) audio.sfx('phone');
  };
  const banner = (text, secs = 2.6) => { state.banner = text; state.bannerT = secs; };

  // ---- spawning -----------------------------------------------------------

  function roadNodes() {
    const nodes = [];
    for (let a = 0; a < AVENUES.length; a++) {
      for (let s = 0; s < STREETS.length; s++) nodes.push({ a, s, x: AVENUES[a], y: STREETS[s] });
    }
    return nodes;
  }
  const nodes = roadNodes();
  const nodeAt = (a, s) => nodes[a * STREETS.length + s];

  function spawnCar(kindIdx, x, y, angle, mode) {
    const kind = CAR_KINDS[kindIdx];
    const car = {
      x, y, angle, speed: 0, kind: kindIdx, kindName: kind.name,
      paint: mode === 'police' ? '#f2f2f2' : rng.pick(PAINTS),
      mode, hp: 100, node: null, target: null, wait: 0, honk: 0,
    };
    state.cars.push(car);
    return car;
  }

  function seedTraffic() {
    // Story props first: a coupe kerbed by the Mart, the repo target at the marina.
    spawnCar(0, 1156, 856, Math.PI / 2, 'parked');
    spawnCar(1, 2720, 1146, Math.PI, 'parked');
    // Parked cars hug the kerbs; traffic cars run the node graph.
    for (let i = 0; i < 16; i++) {
      const onAvenue = rng.chance(0.5);
      const road = onAvenue ? rng.pick(AVENUES) : rng.pick(STREETS);
      const along = rng.range(80, onAvenue ? WORLD_H - 80 : WORLD_W - 80);
      const side = rng.sign();
      const x = onAvenue ? road + side * 44 : along;
      const y = onAvenue ? along : road + side * 44;
      const p = resolveCircle(city, x, y, 20);
      spawnCar(rng.int(0, 5), p.x, p.y, onAvenue ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI), 'parked');
    }
    for (let i = 0; i < 26; i++) {
      const start = rng.pick(nodes);
      const car = spawnCar(rng.int(0, 5), start.x, start.y, 0, 'traffic');
      car.node = start;
      pickNextNode(car);
      placeOnLane(car);
    }
  }

  function pickNextNode(car) {
    const { a, s } = car.node;
    const options = [];
    if (a > 0) options.push(nodeAt(a - 1, s));
    if (a < AVENUES.length - 1) options.push(nodeAt(a + 1, s));
    if (s > 0) options.push(nodeAt(a, s - 1));
    if (s < STREETS.length - 1) options.push(nodeAt(a, s + 1));
    car.target = rng.pick(options);
  }

  function placeOnLane(car) {
    if (!car.target) return;
    const dx = Math.sign(car.target.x - car.node.x);
    const dy = Math.sign(car.target.y - car.node.y);
    car.x = car.node.x + (-dy) * 26;
    car.y = car.node.y + dx * 26;
    car.angle = Math.atan2(dy, dx);
  }

  function seedPeds() {
    for (let i = 0; i < 34; i++) {
      const onAvenue = rng.chance(0.5);
      const road = onAvenue ? rng.pick(AVENUES) : rng.pick(STREETS);
      const along = rng.range(60, onAvenue ? WORLD_H - 60 : WORLD_W - 60);
      const side = rng.sign();
      const x = onAvenue ? road + side * (ROAD_HALF + 10) : along;
      const y = onAvenue ? along : road + side * (ROAD_HALF + 10);
      const p = resolveCircle(city, x, y, 12);
      state.peds.push({
        x: p.x, y: p.y, angle: rng.range(0, TAU), hp: 40, name: rng.pick(NAMES),
        tx: p.x, ty: p.y, flee: 0, down: 0, panic: 0, shirt: rng.pick(PAINTS),
      });
    }
  }

  seedTraffic();
  seedPeds();

  // ---- wanted -------------------------------------------------------------

  const stars = () => clamp(Math.ceil(state.heat / HEAT_TUNE.perStar), 0, HEAT_TUNE.maxStars);

  function witnessed(x, y, radius) {
    for (const p of state.peds) if (p.down <= 0 && Math.hypot(p.x - x, p.y - y) < radius) return true;
    for (const c of state.cops) if (Math.hypot(c.x - x, c.y - y) < radius) return true;
    for (const c of state.cars) if (c.mode === 'police' && Math.hypot(c.x - x, c.y - y) < radius) return true;
    return false;
  }

  function commitCrime(kind, x, y) {
    const loud = kind === 'gunshot' || kind === 'copHit';
    if (!loud && !witnessed(x, y, 280)) return;
    if (loud && !witnessed(x, y, 340) && kind === 'gunshot') return;
    state.heat = clamp(state.heat + (HEAT_TUNE[kind] || 4), 0, HEAT_TUNE.perStar * HEAT_TUNE.maxStars);
    state.lastCrimeAgo = 0;
  }

  function addHeat(amount) {
    state.heat = clamp(state.heat + amount, 0, HEAT_TUNE.perStar * HEAT_TUNE.maxStars);
    state.lastCrimeAgo = 0;
  }

  // ---- missions -----------------------------------------------------------

  const missionDef = () => MISSIONS[state.mission.index] || null;
  const stepDef = () => {
    const m = missionDef();
    return m ? m.steps[state.mission.step] || null : null;
  };

  function beginStep() {
    const m = state.mission;
    const step = stepDef();
    m.got = [];
    m.gate = 0;
    m.reached = false;
    m.alarmFired = false;
    m.timer = step && step.type === 'checkpoints' ? step.time : 0;
    state.rivals = [];
    if (step && step.type === 'shootout') {
      for (let i = 0; i < step.rivals; i++) {
        const a = (i / step.rivals) * TAU + 0.6;
        state.rivals.push({
          x: step.x + Math.cos(a) * 74, y: step.y + Math.sin(a) * 74,
          hp: 52, shotCd: rng.range(0.4, 1.4), name: 'Velvet Crew',
        });
      }
    }
  }

  function startMission() {
    const m = missionDef();
    if (!m) return;
    state.mission.phase = 'intro';
    say(m.intro);
  }

  function completeStep() {
    const m = state.mission;
    const def = missionDef();
    audio.sfx('success');
    m.step += 1;
    if (m.step >= def.steps.length) {
      state.money += def.reward;
      state.stats.missions += 1;
      m.index += 1;
      m.step = 0;
      m.phase = 'offer';
      say(def.outro);
      toast(`Mission complete: ${def.title} — $${def.reward}`);
      if (!missionDef()) banner(SIDE_TEXT.storyDone, 5);
    } else {
      beginStep();
      const next = stepDef();
      if (next) toast(next.label);
    }
  }

  function failMission(why) {
    const m = state.mission;
    if (m.phase === 'run' || m.phase === 'intro') {
      m.phase = 'offer';
      m.step = 0;
      state.rivals = [];
      toast(why);
    }
  }

  function objective() {
    const m = state.mission;
    const def = missionDef();
    if (!def) {
      if (state.taxi) return { x: state.taxi.x, y: state.taxi.y, label: 'Drop off your passenger' };
      if (state.race) return { x: RACE_GATES[state.race.gate].x, y: RACE_GATES[state.race.gate].y, label: 'Pier race gate' };
      return { x: MART.doorX, y: MART.doorY, label: 'Free roam — the Mart, the pier, the ghosts' };
    }
    if (m.phase === 'offer') {
      const g = GIVER_SPOTS[def.giver];
      return { x: g.x, y: g.y, label: `Talk to ${g.label}` };
    }
    if (m.phase === 'intro') return { x: state.player.x, y: state.player.y, label: def.title };
    const step = stepDef();
    if (!step) return { x: MART.doorX, y: MART.doorY, label: def.title };
    if (step.type === 'collect') {
      let best = null;
      let bestD = Infinity;
      step.points.forEach((p, i) => {
        if (m.got.includes(i)) return;
        const d = Math.hypot(p.x - state.player.x, p.y - state.player.y);
        if (d < bestD) { bestD = d; best = p; }
      });
      if (best) return { x: best.x, y: best.y, label: step.label };
    }
    if (step.type === 'checkpoints') {
      const p = step.points[m.gate];
      if (p) return { x: p.x, y: p.y, label: `${step.label} (${m.gate + 1}/${step.points.length})` };
    }
    if (step.type === 'escape' && m.reached && stars() > 1) {
      return { x: step.x, y: step.y, label: 'Cool off here — lose the heat' };
    }
    return { x: step.x, y: step.y, label: step.label };
  }

  // ---- shared driving -----------------------------------------------------

  function driveCar(car, throttle, steer, dt) {
    const kind = CAR_KINDS[car.kind];
    const top = car.hp <= 0 ? 0 : kind.topSpeed;
    if (throttle > 0) car.speed += kind.accel * dt * (1 - Math.max(0, car.speed) / (top + 1));
    else if (throttle < 0) car.speed -= (car.speed > 4 ? kind.accel * 1.4 : kind.accel * 0.6) * dt;
    else car.speed -= car.speed * 0.7 * dt;
    car.speed = clamp(car.speed, -95, top);
    if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
    const steerAuthority = clamp(Math.abs(car.speed) / 60, 0, 1) * Math.sign(car.speed);
    car.angle += steer * kind.grip * steerAuthority * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const before = Math.abs(car.speed);
    const fixed = resolveCircle(city, car.x, car.y, 20);
    const pushed = Math.hypot(fixed.x - car.x, fixed.y - car.y);
    car.x = clamp(fixed.x, 24, WORLD_W - 24);
    car.y = clamp(fixed.y, 24, WORLD_H - 24);
    if (pushed > 6 && before > 130) {
      car.hp -= 9;
      car.speed *= 0.35;
      audio.sfx('crash');
      commitCrime('vandalism', car.x, car.y);
    } else if (pushed > 2) {
      car.speed *= 0.7;
    }
  }

  function carBumps(dt) {
    const all = state.cars;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 40) {
          const push = (40 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const impact = Math.abs(a.speed - b.speed);
          if (impact > 90) {
            a.hp -= 6; b.hp -= 6;
            a.speed *= 0.55; b.speed *= 0.55;
            if (a === state.player.car || b === state.player.car) {
              audio.sfx('crash');
              commitCrime('carBump', state.player.x, state.player.y);
            }
          }
        }
      }
    }
  }

  // ---- player -------------------------------------------------------------

  function hurtPlayer(amount) {
    const p = state.player;
    p.hp -= amount;
    p.hurtAgo = 0;
    if (p.hp <= 0) wasted();
  }

  function wasted() {
    const p = state.player;
    state.stats.wasted += 1;
    banner(SIDE_TEXT.wasted, 3.4);
    audio.sfx('fail');
    state.money = Math.max(0, state.money - 100);
    if (p.car) { p.car.mode = 'parked'; p.car = null; }
    p.x = CLINIC_DOOR.x; p.y = CLINIC_DOOR.y;
    p.hp = PLAYER_TUNE.health;
    state.heat = 0;
    state.cops = [];
    state.cars = state.cars.filter((c) => c.mode !== 'police');
    state.rivals = [];
    failMission('The job died with you at the clinic. It will keep.');
  }

  function busted() {
    const p = state.player;
    state.stats.busted += 1;
    banner(SIDE_TEXT.busted, 3.4);
    audio.sfx('fail');
    const fine = Math.min(state.money, 100 + stars() * 50);
    state.money -= fine;
    if (p.car) { p.car.mode = 'parked'; p.car = null; }
    p.x = PRECINCT_DOOR.x; p.y = PRECINCT_DOOR.y;
    p.hp = PLAYER_TUNE.health;
    p.bustMeter = 0;
    state.heat = 0;
    state.cops = [];
    state.cars = state.cars.filter((c) => c.mode !== 'police');
    state.rivals = [];
    failMission('The bust ended the job. Marisol will re-offer it.');
    toast(`Fine paid: $${fine}`);
  }

  function updatePlayer(dt, input) {
    const p = state.player;
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.shotCd = Math.max(0, p.shotCd - dt);
    p.hurtAgo += dt;
    if (p.hurtAgo > 5 && p.hp > 0 && p.hp < PLAYER_TUNE.health) {
      p.hp = Math.min(PLAYER_TUNE.health, p.hp + 6 * dt);
    }

    if (input.pressed('enter')) {
      if (p.car) {
        const car = p.car;
        car.mode = 'parked';
        car.speed = 0;
        p.car = null;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
        const fixed = resolveCircle(city, p.x, p.y, p.radius);
        p.x = fixed.x; p.y = fixed.y;
        audio.sfx('door');
        if (state.taxi) { state.taxi = null; toast('Fare cancelled — the passenger climbs out, unimpressed.'); }
      } else {
        let best = null;
        let bestD = 58;
        for (const car of state.cars) {
          if (car.mode === 'police') continue;
          const d = Math.hypot(car.x - p.x, car.y - p.y);
          if (d < bestD) { bestD = d; best = car; }
        }
        if (best) {
          const wasYours = best.mode === 'player';
          best.mode = 'player';
          p.car = best;
          p.x = best.x; p.y = best.y;
          audio.sfx('door');
          if (!wasYours && !best.counted) {
            best.counted = true;
            state.stats.carsStolen += 1;
            commitCrime('carTheft', best.x, best.y);
          }
        } else if (Math.hypot(p.x - MART.doorX, p.y - MART.doorY) < 54) {
          shop();
        }
      }
    }

    if (p.car) {
      const car = p.car;
      const throttle = input.down('up') ? 1 : input.down('down') ? -1 : 0;
      const steer = (input.down('left') ? -1 : 0) + (input.down('right') ? 1 : 0);
      driveCar(car, throttle, steer, dt);
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      // Running someone down is the loudest crime in Solenne.
      for (const ped of state.peds) {
        if (ped.down > 0) continue;
        if (Math.abs(car.speed) > 60 && Math.hypot(ped.x - car.x, ped.y - car.y) < 24) {
          ped.down = 26;
          ped.hp = 0;
          audio.sfx('hit');
          if (witnessed(ped.x, ped.y, 300)) addHeat(HEAT_TUNE.pedHit);
        }
      }
    } else {
      const mx = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
      const my = (input.down('down') ? 1 : 0) - (input.down('up') ? 1 : 0);
      if (mx || my) {
        const len = Math.hypot(mx, my);
        const speed = input.down('sprint') ? PLAYER_TUNE.sprint : PLAYER_TUNE.walk;
        p.angle = Math.atan2(my, mx);
        p.x += (mx / len) * speed * dt;
        p.y += (my / len) * speed * dt;
        const fixed = resolveCircle(city, p.x, p.y, p.radius);
        p.x = clamp(fixed.x, 16, WORLD_W - 16);
        p.y = clamp(fixed.y, 16, WORLD_H - 16);
      }
    }

    // Fists and pistol share one helper: find what is in front, hurt it.
    if (input.pressed('punch') && p.punchCd <= 0) {
      p.punchCd = PLAYER_TUNE.punchEvery;
      state.stats.punches += 1;
      audio.sfx('punch');
      meleeHit();
    }
    if (input.down('shoot') && p.shotCd <= 0) {
      p.shotCd = PLAYER_TUNE.shotEvery;
      if (state.ammo > 0) {
        state.ammo -= 1;
        state.stats.shots += 1;
        audio.sfx('shot');
        state.bullets.push({
          x: p.x + Math.cos(p.angle) * 18, y: p.y + Math.sin(p.angle) * 18,
          vx: Math.cos(p.angle) * 660, vy: Math.sin(p.angle) * 660,
          from: 'player', life: 0.55,
        });
        commitCrime('gunshot', p.x, p.y);
        for (const ped of state.peds) {
          if (Math.hypot(ped.x - p.x, ped.y - p.y) < 190) { ped.panic = 2.4; ped.tx = ped.x + (ped.x - p.x); ped.ty = ped.y + (ped.y - p.y); }
        }
      } else {
        toast('Out of ammo — the Leonida Mart sells more, no questions asked.');
        p.shotCd = 0.6;
      }
    }
  }

  function meleeHit() {
    const p = state.player;
    const reach = PLAYER_TUNE.punchRange;
    const targets = [];
    for (const ped of state.peds) if (ped.down <= 0) targets.push({ e: ped, kind: 'ped' });
    for (const r of state.rivals) targets.push({ e: r, kind: 'rival' });
    for (const cop of state.cops) targets.push({ e: cop, kind: 'cop' });
    let best = null;
    let bestD = reach;
    for (const t of targets) {
      const d = Math.hypot(t.e.x - p.x, t.e.y - p.y);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (!best) return;
    const e = best.e;
    e.hp -= PLAYER_TUNE.punchDamage;
    audio.sfx('hit');
    if (best.kind === 'ped') {
      commitCrime('assault', e.x, e.y);
      e.panic = 2.4; e.tx = e.x + (e.x - p.x) * 3; e.ty = e.y + (e.y - p.y) * 3;
      if (e.hp <= 0) e.down = 26;
    } else if (best.kind === 'cop') {
      addHeat(HEAT_TUNE.copHit);
      if (e.hp <= 0) { e.dead = true; toast('An officer is down. The whole precinct knows.'); }
    } else if (e.hp <= 0) {
      toast('One of the Velvet Crew folds.');
    }
  }

  function shop() {
    if (state.money >= 60) {
      state.money -= 60;
      state.player.hp = Math.min(PLAYER_TUNE.health, state.player.hp + 40);
      state.ammo += 12;
      toast(SIDE_TEXT.shopLine);
      audio.sfx('coin');
    } else if (state.money >= 20) {
      state.money -= 20;
      state.player.hp = Math.min(PLAYER_TUNE.health, state.player.hp + 40);
      toast('Snacks acquired. The ammo shelf stays a dream for now.');
      audio.sfx('coin');
    } else {
      toast('Marisol shakes her head: "Cash first, sobrino."');
    }
  }

  // ---- traffic & pedestrians ----------------------------------------------

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.mode !== 'traffic') continue;
      const kind = CAR_KINDS[car.kind];
      // Aim at the target node's lane point: offset perpendicular to travel.
      const dx = car.target.x - car.node.x;
      const dy = car.target.y - car.node.y;
      const aimX = car.target.x + (-Math.sign(dy)) * 26;
      const aimY = car.target.y + Math.sign(dx) * 26;
      const want = Math.atan2(aimY - car.y, aimX - car.x);
      car.angle += clamp(angDiff(want, car.angle), -2.4 * dt, 2.4 * dt);
      let speedTarget = kind.topSpeed * 0.42;
      // Mind the car in front.
      for (const other of state.cars) {
        if (other === car) continue;
        const ox = other.x - car.x;
        const oy = other.y - car.y;
        const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
        const side = Math.abs(ox * -Math.sin(car.angle) + oy * Math.cos(car.angle));
        if (ahead > 0 && ahead < 62 && side < 20) speedTarget = Math.min(speedTarget, Math.max(0, other.speed));
      }
      car.speed += clamp(speedTarget - car.speed, -190 * dt, 120 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = resolveCircle(city, car.x, car.y, 18);
      car.x = fixed.x; car.y = fixed.y;
      if (Math.hypot(car.target.x - car.x, car.target.y - car.y) < 44) {
        car.node = car.target;
        pickNextNode(car);
      }
    }
  }

  function updatePeds(dt) {
    for (const ped of state.peds) {
      if (ped.down > 0) { ped.down -= dt; continue; }
      if (ped.asPassenger) continue;
      const dx = ped.tx - ped.x;
      const dy = ped.ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 14 || ped.panic > 0 && d < 30) {
        // New whim: stroll to another stretch of sidewalk.
        const onAvenue = rng.chance(0.5);
        const road = onAvenue ? rng.pick(AVENUES) : rng.pick(STREETS);
        const side = rng.sign();
        const along = clamp((onAvenue ? ped.y : ped.x) + rng.range(-520, 520), 60, (onAvenue ? WORLD_H : WORLD_W) - 60);
        ped.tx = onAvenue ? road + side * (ROAD_HALF + 10) : along;
        ped.ty = onAvenue ? along : road + side * (ROAD_HALF + 10);
      }
      const speed = ped.panic > 0 ? 238 : 74;
      ped.panic = Math.max(0, ped.panic - dt);
      if (d > 1) {
        ped.angle = Math.atan2(dy, dx);
        ped.x += Math.cos(ped.angle) * Math.min(speed * dt, d);
        ped.y += Math.sin(ped.angle) * Math.min(speed * dt, d);
        const fixed = resolveCircle(city, ped.x, ped.y, 11);
        ped.x = fixed.x; ped.y = fixed.y;
      }
    }
  }

  // ---- police ---------------------------------------------------------------

  let copSpawnCd = 0;

  function spawnCopCar() {
    const p = state.player;
    let sx = PRECINCT_DOOR.x;
    let sy = PRECINCT_DOOR.y;
    // Prefer a road node a long way off, so they arrive, not apparate.
    let best = null;
    let bestD = 0;
    for (const n of nodes) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d > 520 && d > bestD) { bestD = d; best = n; if (rng.chance(0.3)) break; }
    }
    if (best) { sx = best.x; sy = best.y; }
    const car = spawnCar(6, sx, sy, 0, 'police');
    car.paint = '#f2f2f2';
    return car;
  }

  function updatePolice(dt) {
    const p = state.player;
    const s = stars();
    copSpawnCd -= dt;
    const copCars = state.cars.filter((c) => c.mode === 'police');
    const wantCars = s === 0 ? 0 : Math.min(2 + Math.floor(s / 2), 4);
    const wantFoot = s >= 3 ? s - 2 : s === 2 ? 1 : 0;
    if (copSpawnCd <= 0) {
      if (copCars.length < wantCars) { spawnCopCar(); copSpawnCd = 1.1; }
      else if (state.cops.length < wantFoot) {
        const src = copCars[0];
        state.cops.push({
          x: src ? src.x + 24 : PRECINCT_DOOR.x, y: src ? src.y : PRECINCT_DOOR.y,
          angle: 0, hp: 60, shotCd: rng.range(0.8, 1.6), name: 'Officer',
        });
        copSpawnCd = 1.1;
      }
    }
    if (s === 0) {
      state.cops = state.cops.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 900);
      for (const car of copCars) if (Math.hypot(car.x - p.x, car.y - p.y) > 950) car.mode = 'parked';
    }

    // Interceptors hunt the player's position, not a node.
    for (const car of copCars) {
      const targetDist = p.car ? 0 : 64;
      const dx = p.x - car.x;
      const dy = p.y - car.y;
      const d = Math.hypot(dx, dy);
      const want = Math.atan2(dy, dx);
      car.angle += clamp(angDiff(want, car.angle), -2.9 * dt, 2.9 * dt);
      const kind = CAR_KINDS[car.kind];
      let speedTarget = d > targetDist + 30 ? kind.topSpeed * (0.9 + s * 0.03) : 0;
      if (d < 40) speedTarget = 0;
      car.speed += clamp(speedTarget - car.speed, -260 * dt, kind.accel * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = resolveCircle(city, car.x, car.y, 20);
      car.x = clamp(fixed.x, 24, WORLD_W - 24);
      car.y = clamp(fixed.y, 24, WORLD_H - 24);
    }

    let nearCop = false;
    for (const cop of state.cops) {
      const d = Math.hypot(p.x - cop.x, p.y - cop.y);
      if (d < 260) nearCop = true;
      if (d > 30) {
        cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
        const speed = p.car ? 150 : 208;
        cop.x += Math.cos(cop.angle) * speed * dt;
        cop.y += Math.sin(cop.angle) * speed * dt;
        const fixed = resolveCircle(city, cop.x, cop.y, 12);
        cop.x = fixed.x; cop.y = fixed.y;
      }
      if (s >= 4 && d < 250 && d > 34) {
        cop.shotCd -= dt;
        if (cop.shotCd <= 0) {
          cop.shotCd = 1.35;
          state.bullets.push({
            x: cop.x, y: cop.y,
            vx: Math.cos(cop.angle) * 620, vy: Math.sin(cop.angle) * 620,
            from: 'cop', life: 0.5,
          });
          audio.sfx('shot');
        }
      }
    }
    for (const car of copCars) if (Math.hypot(car.x - p.x, car.y - p.y) < 260) nearCop = true;

    // The arrest: be close, be slow, be surrounded by patience.
    const playerSpeed = p.car ? Math.abs(p.car.speed) : 0;
    let pressure = false;
    if (!p.car) {
      for (const cop of state.cops) if (Math.hypot(cop.x - p.x, cop.y - p.y) < 32) pressure = true;
      for (const car of copCars) if (Math.hypot(car.x - p.x, car.y - p.y) < 44) pressure = true;
    } else if (playerSpeed < 26) {
      for (const car of copCars) if (Math.hypot(car.x - p.x, car.y - p.y) < 52) pressure = true;
      for (const cop of state.cops) if (Math.hypot(cop.x - p.x, cop.y - p.y) < 30) pressure = true;
    }
    if (pressure && s > 0) {
      p.bustMeter += dt;
      if (p.bustMeter >= 1.1) { busted(); return; }
    } else {
      p.bustMeter = Math.max(0, p.bustMeter - dt * 1.6);
    }
    state.seenAgo = nearCop ? 0 : state.seenAgo + dt;
  }

  // ---- bullets & rivals -----------------------------------------------------

  function pointInBuilding(x, y) {
    for (const b of city.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
    }
    return false;
  }

  function updateBullets(dt) {
    const p = state.player;
    const keep = [];
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || pointInBuilding(b.x, b.y)) continue;
      let spent = false;
      if (b.from === 'player') {
        for (const r of state.rivals) {
          if (r.hp > 0 && Math.hypot(r.x - b.x, r.y - b.y) < 15) { r.hp -= PLAYER_TUNE.shotDamage; audio.sfx('hit'); spent = true; break; }
        }
        if (!spent) for (const cop of state.cops) {
          if (!cop.dead && Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
            cop.hp -= PLAYER_TUNE.shotDamage;
            addHeat(HEAT_TUNE.copHit);
            if (cop.hp <= 0) cop.dead = true;
            spent = true; break;
          }
        }
        if (!spent) for (const ped of state.peds) {
          if (ped.down <= 0 && Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
            ped.hp -= PLAYER_TUNE.shotDamage;
            ped.panic = 2.4;
            if (ped.hp <= 0) ped.down = 26;
            spent = true; break;
          }
        }
        if (!spent) for (const car of state.cars) {
          if (car !== p.car && Math.hypot(car.x - b.x, car.y - b.y) < 22) { car.hp -= 8; spent = true; break; }
        }
      } else {
        const target = p.car || p;
        const radius = p.car ? 22 : 13;
        if (Math.hypot(target.x - b.x, target.y - b.y) < radius) {
          if (p.car) p.car.hp -= 5;
          else hurtPlayer(b.from === 'cop' ? 5 : 7);
          spent = true;
        }
      }
      if (!spent) keep.push(b);
    }
    state.bullets = keep;
    state.rivals = state.rivals.filter((r) => r.hp > 0);
    state.cops = state.cops.filter((c) => !c.dead);
  }

  function updateRivals(dt) {
    const p = state.player;
    for (const r of state.rivals) {
      const d = Math.hypot(p.x - r.x, p.y - r.y);
      if (d < 320 && d > 165) {
        const a = Math.atan2(p.y - r.y, p.x - r.x);
        r.x += Math.cos(a) * 66 * dt;
        r.y += Math.sin(a) * 66 * dt;
        const fixed = resolveCircle(city, r.x, r.y, 12);
        r.x = fixed.x; r.y = fixed.y;
      }
      if (d < 280) {
        r.shotCd -= dt;
        if (r.shotCd <= 0) {
          r.shotCd = rng.range(1.05, 1.6);
          const a = Math.atan2(p.y - r.y, p.x - r.x) + rng.range(-0.07, 0.07);
          state.bullets.push({ x: r.x, y: r.y, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, from: 'rival', life: 0.5 });
          audio.sfx('shot');
        }
      }
    }
  }

  // ---- missions & side systems ----------------------------------------------

  function updateMissions(dt) {
    const m = state.mission;
    const p = state.player;
    // Phone dialogue ticks over on its own clock.
    if (m.dialogue.length) {
      m.dialogueT += dt;
      state.phone = { who: m.dialogue[0][0], text: m.dialogue[0][1] };
      if (m.dialogueT > 2.9) {
        m.dialogue.shift();
        m.dialogueT = 0;
        if (!m.dialogue.length) {
          state.phone = null;
          if (m.phase === 'intro') {
            m.phase = 'run';
            m.step = 0;
            beginStep();
            const step = stepDef();
            if (step) toast(step.label);
          }
        }
      }
    } else {
      state.phone = null;
    }

    const def = missionDef();
    if (!def) return;
    if (m.phase === 'offer') {
      const g = GIVER_SPOTS[def.giver];
      if (Math.hypot(p.x - g.x, p.y - g.y) < 46 && !p.car) startMission();
      return;
    }
    if (m.phase !== 'run') return;
    const step = stepDef();
    if (!step) return;

    if (step.type === 'goto') {
      if (step.needsCarModel && p.car && p.car.kindName === step.needsCarModel && !m.alarmFired) {
        m.alarmFired = true;
        state.heat = Math.max(state.heat, (step.alarmStars || 2) * HEAT_TUNE.perStar - 30);
        state.lastCrimeAgo = 0;
        audio.sfx('alarm');
        toast('The alarm has opinions. Half the Mile just heard that engine.');
      }
      const okCar = !step.needsCarModel || (p.car && p.car.kindName === step.needsCarModel);
      if (okCar && Math.hypot(p.x - step.x, p.y - step.y) < step.radius) {
        if (step.carry) toast(`Loaded: ${step.carry}. Marisol is already smiling.`);
        completeStep();
      }
    } else if (step.type === 'collect') {
      step.points.forEach((pt, i) => {
        if (m.got.includes(i)) return;
        if (Math.hypot(p.x - pt.x, p.y - pt.y) < step.radius) {
          m.got.push(i);
          audio.sfx(step.ghostHunt ? 'ghost' : 'coin');
          toast(`${pt.label} — ${m.got.length}/${step.points.length}`);
          if (m.got.length === step.points.length) completeStep();
        }
      });
    } else if (step.type === 'checkpoints') {
      m.timer -= dt;
      if (m.timer <= 0) {
        toast('The band tuned up without you. Run the gates again.');
        audio.sfx('fail');
        beginStep();
        return;
      }
      const gate = step.points[m.gate];
      if (gate && Math.hypot(p.x - gate.x, p.y - gate.y) < 66) {
        m.gate += 1;
        audio.sfx('coin');
        if (m.gate >= step.points.length) completeStep();
        else toast(`Gate ${m.gate}/${step.points.length} — keep rolling.`);
      }
    } else if (step.type === 'escape') {
      if (Math.hypot(p.x - step.x, p.y - step.y) < step.radius) {
        m.reached = true;
        if (stars() <= 1) completeStep();
      }
    } else if (step.type === 'shootout') {
      if (state.rivals.length === 0 && Math.hypot(p.x - step.x, p.y - step.y) < step.radius) {
        toast('The ledger changes hands. Marisol sends a thumbs-up emoji.');
        completeStep();
      }
    }
  }

  function updateSideSystems(dt) {
    const p = state.player;
    // Fun Ghosts: they only appear for the curious.
    for (const spot of city.ghostSpots) {
      if (state.ghosts.includes(spot.id)) continue;
      if (Math.hypot(p.x - spot.x, p.y - spot.y) < 32) {
        state.ghosts.push(spot.id);
        state.stats.ghosts += 1;
        state.money += 25;
        audio.sfx('ghost');
        toast(`Fun Ghost found (${state.ghosts.length}/12) — it leaves $25 and a tiny wave.`);
      }
    }
    // Pickups breathe back into the world after a while.
    for (const pk of state.pickups) {
      if (pk.taken) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) pk.taken = false;
        continue;
      }
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < 27) {
        pk.taken = true;
        pk.respawn = 30;
        if (pk.kind === 'health') { p.hp = Math.min(PLAYER_TUNE.health, p.hp + 35); toast('Bandages and cafecito: +35 health.'); }
        if (pk.kind === 'ammo') { state.ammo += 12; toast('Ammunition: +12 rounds.'); }
        if (pk.kind === 'cash') { state.money += 30; toast('A dropped wallet, returned to circulation: +$30.'); }
        audio.sfx('coin');
      }
    }
    // Taxi work exists only behind the wheel of a Canal Taxi.
    if (p.car && p.car.kindName === 'Canal Taxi') {
      if (!state.taxi) {
        let best = null;
        let bestD = Infinity;
        for (const ped of state.peds) {
          if (ped.down > 0 || ped.asPassenger) continue;
          const d = Math.hypot(ped.x - p.x, ped.y - p.y);
          if (d > 300 && d < 720 && d < bestD) { bestD = d; best = ped; }
        }
        if (best) {
          best.asPassenger = true;
          state.taxi = { phase: 'pickup', x: best.x, y: best.y, ped: best, t: 0 };
          toast(`${best.name} is hailing you — stop beside them.`);
        }
      } else if (state.taxi.phase === 'pickup') {
        const t = state.taxi;
        if (Math.abs(p.car.speed) < 22 && Math.hypot(p.x - t.x, p.y - t.y) < 48) {
          const dest = rng.pick(nodes);
          t.phase = 'dropoff';
          t.x = dest.x; t.y = dest.y;
          t.fare = 30 + Math.round(Math.hypot(dest.x - p.x, dest.y - p.y) / 9);
          t.t = 0;
          toast(SIDE_TEXT.taxiStart);
          audio.sfx('phone');
        }
      } else {
        const t = state.taxi;
        t.t += dt;
        if (Math.hypot(p.x - t.x, p.y - t.y) < 58) {
          const tip = t.t < Math.hypot(t.x - p.x, t.y - p.y) / 10 + 26 ? 15 : 5;
          state.money += t.fare + tip;
          state.stats.fares += 1;
          if (t.ped) t.ped.asPassenger = false;
          toast(`${SIDE_TEXT.taxiDone} Fare $${t.fare} + tip $${tip}.`);
          audio.sfx('success');
          state.taxi = null;
        }
      }
    }
    // The pier race starts by rolling through its start line.
    if (!state.race && p.car && Math.hypot(p.x - RACE_START.x, p.y - RACE_START.y) < 52) {
      state.race = { gate: 0, t: 0, limit: 95 };
      toast(SIDE_TEXT.raceStart);
      audio.sfx('phone');
    }
    if (state.race) {
      const r = state.race;
      r.t += dt;
      if (r.t > r.limit) {
        state.race = null;
        toast('Out of time — the pier crowd drifts back to its cafecitos.');
        audio.sfx('fail');
      } else {
        const gate = RACE_GATES[r.gate];
        if (p.car && Math.hypot(p.x - gate.x, p.y - gate.y) < 66) {
          r.gate += 1;
          audio.sfx('coin');
          if (r.gate >= RACE_GATES.length) {
            state.money += 300;
            state.stats.races += 1;
            toast(`${SIDE_TEXT.raceDone} Prize $300.`);
            audio.sfx('success');
            state.race = null;
          } else {
            toast(`Race gate ${r.gate}/${RACE_GATES.length}.`);
          }
        }
      }
    }
  }

  // ---- the frame --------------------------------------------------------------

  function update(dt, input) {
    state.time += dt;
    state.clock = (state.clock + dt / DAY_SECONDS) % 1;
    state.lastCrimeAgo += dt;

    updatePlayer(dt, input);
    if (state.player.hp <= 0) return; // wasted() already tidied up
    carBumps(dt);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateBullets(dt);
    updateRivals(dt);
    updateMissions(dt);
    updateSideSystems(dt);

    // Heat cools when nobody is watching and the sirens are far away.
    const anyCopNear = state.cops.length > 0 || state.cars.some((c) => c.mode === 'police' && Math.hypot(c.x - state.player.x, c.y - state.player.y) < 260);
    if (state.lastCrimeAgo > HEAT_TUNE.calmDelay && !anyCopNear) {
      state.heat = Math.max(0, state.heat - HEAT_TUNE.calmRate * dt);
    }
    if (stars() === 0) state.player.bustMeter = 0;

    for (const t of state.toasts) t.t -= dt;
    state.toasts = state.toasts.filter((t) => t.t > 0);
    state.bannerT = Math.max(0, state.bannerT - dt);
    if (state.bannerT <= 0) state.banner = null;

    // Camera: centred on the player, shy of the world's edge.
    const p = state.player;
    state.camera.x = clamp(p.x - state.view.w / 2, 0, Math.max(0, WORLD_W - state.view.w));
    state.camera.y = clamp(p.y - state.view.h / 2, 0, Math.max(0, WORLD_H - state.view.h));

    audio.update(dt, p.car ? { speed: p.car.speed } : null);
    audio.setSiren(stars() > 0 && anyCopNear);
    input.endFrame();
  }

  function snapshot() {
    return {
      v: 1,
      money: state.money,
      ammo: state.ammo,
      missionIndex: state.mission.index,
      ghosts: state.ghosts.slice(),
      stats: { ...state.stats },
      player: { x: state.player.x, y: state.player.y },
      clock: state.clock,
    };
  }

  function applySnapshot(snap) {
    if (!snap) return;
    state.money = snap.money ?? state.money;
    state.ammo = snap.ammo ?? state.ammo;
    state.mission.index = clamp(snap.missionIndex ?? 0, 0, MISSIONS.length);
    state.mission.phase = 'offer';
    state.mission.step = 0;
    state.ghosts = Array.isArray(snap.ghosts) ? snap.ghosts.slice() : [];
    Object.assign(state.stats, snap.stats || {});
    if (snap.player) {
      const fixed = resolveCircle(city, snap.player.x, snap.player.y, PLAYER_TUNE.radius);
      state.player.x = fixed.x;
      state.player.y = fixed.y;
    }
    if (typeof snap.clock === 'number') state.clock = snap.clock;
  }

  return {
    state,
    city,
    update,
    objective,
    snapshot,
    applySnapshot,
    stars,
    setViewport: (w, h) => { state.view.w = w; state.view.h = h; },
  };
}
