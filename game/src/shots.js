// Staged scenes for the maker's screenshots. Each scene arranges the real
// world — the same simulation the player gets — into one honest moment of
// the game, then lets it run: a story opening outside the Mart, a three-star
// chase at dusk, the Neon Mile after dark. Nothing is composited; the camera
// just shows up on time. Scenes are chosen by the ?shot= query parameter.

import { MISSIONS } from './missions.js';

function policeCar(x, y, angle) {
  return {
    x, y, angle, speed: 150, kind: 6, kindName: 'Solenne Cruiser',
    paint: '#f2f2f2', mode: 'police', hp: 100, node: null, target: null,
    wait: 0, honk: 0,
  };
}

export function applyShot(world, shot) {
  const { state } = world;
  const p = state.player;
  if (shot === 'mission') {
    // Opening beat: Rafi on the Mart forecourt, Marisol on the phone. The
    // dialogue clock starts deep in credit so her first line is still on
    // screen when the camera arrives.
    state.clock = 0.66;
    p.x = 1330; p.y = 776; p.angle = Math.PI / 2;
    state.mission.phase = 'intro';
    state.mission.dialogue = MISSIONS[0].intro.slice();
    state.mission.dialogueT = -30;
    return 'play';
  }
  if (shot === 'chase') {
    // Three stars on the Neon Mile at dusk, mid-pursuit: the player bursts
    // out of the street 1500 crossing in the repo'd Brisa GT, the law a
    // couple of car-lengths back and gaining — but not there yet.
    state.clock = 0.79;
    const car = state.cars.find((c) => c.kindName === 'Brisa GT') || state.cars[0];
    car.mode = 'player';
    car.x = 1680 - 26; car.y = 1560; car.angle = Math.PI / 2; car.speed = 320;
    p.car = car;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    state.heat = 300;
    state.lastCrimeAgo = 0;
    const copA = policeCar(1680 - 26, 1330, Math.PI / 2);
    copA.speed = 240;
    const copB = policeCar(1680 + 26, 1240, Math.PI / 2);
    copB.speed = 225;
    state.cars.push(copA, copB);
    // The camera takes a few real seconds to arrive, and an un-driven car
    // coasts to a stop and gets its driver arrested. So the scene directs
    // itself: a tiny autopilot holds the GT at speed down the avenue and
    // loops the pursuit back to its mark before the crossing at street 1920.
    if (typeof requestAnimationFrame === 'function') {
      const direct = () => {
        if (state.player.car === car) {
          if (car.y > 1980 || car.hp <= 0) {
            car.x = 1680 - 26; car.y = 1560; car.angle = Math.PI / 2; car.hp = 100;
            copA.x = 1680 - 26; copA.y = 1330; copA.angle = Math.PI / 2; copA.speed = 240;
            copB.x = 1680 + 26; copB.y = 1240; copB.angle = Math.PI / 2; copB.speed = 225;
            state.heat = 300;
            state.lastCrimeAgo = 0;
          }
          car.speed = Math.max(car.speed, 298);
          car.angle += (Math.PI / 2 - car.angle) * 0.12;
          p.x = car.x; p.y = car.y;
          requestAnimationFrame(direct);
        }
      };
      requestAnimationFrame(direct);
    }
    return 'play';
  }
  if (shot === 'night') {
    // The arcade corner after dark: neon, palms, and a ghost nearby.
    state.clock = 0.93;
    p.x = 1798; p.y = 1610; p.angle = Math.PI;
    state.money = 640;
    return 'play';
  }
  return 'title';
}
