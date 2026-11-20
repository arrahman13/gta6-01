// Boot and screen flow: title → streets → pause, on a fixed-step clock so
// the simulation runs the same on every machine. This module owns the few
// things the world must not: the canvas, the save file, autosave, and the
// screenshot harness hook (window.__shotReady) the maker's camera waits for.

import { FIXED_DT } from './config.js';
import { makeRandom } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWorld } from './world.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED } from './render.js';
import { saveGame, loadGame, wipeGame } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 20261120) >>> 0;

const audio = createAudio();
const world = createWorld(makeRandom(seed), audio);
const renderer = createRenderer(canvas);
const input = createInput(window);

let screen = SCREEN_TITLE;
let hasSave = !!loadGame();
let lastSaveAt = 0;
let shotFrames = 0;
const shot = params.get('shot');
if (shot) screen = applyShot(world, shot) === 'title' ? SCREEN_TITLE : SCREEN_PLAY;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  world.setViewport(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('keydown', () => audio.unlock(), { once: true });
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

function toast(text) {
  world.state.toasts.push({ text, t: 3 });
}

function startGame(fresh) {
  if (fresh) {
    wipeGame();
    hasSave = false;
  } else if (hasSave) {
    world.applySnapshot(loadGame());
  }
  screen = SCREEN_PLAY;
  audio.unlock();
}

let last = performance.now();
let acc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;

  // Mute is read before anyone else consumes the frame's key edges.
  if (input.pressed('mute')) {
    const muted = audio.toggleMute();
    toast(muted ? 'Sound off. The sunset hums on without you.' : 'Sound on.');
  }
  // Screen-level keys are read from the same edge set the world uses.
  if (screen === SCREEN_TITLE) {
    world.state.time += dt; // let the title ghost bob
    if (input.pressed('start')) startGame(false);
    else if (input.pressed('new') && hasSave) startGame(true);
    input.endFrame();
  } else if (screen === SCREEN_PLAY) {
    if (input.pressed('pause')) {
      screen = SCREEN_PAUSED;
      input.endFrame();
    } else {
      acc += dt;
      let steps = 0;
      while (acc >= FIXED_DT && steps < 5) {
        world.update(FIXED_DT, input);
        acc -= FIXED_DT;
        steps += 1;
      }
      if (steps === 5) acc = 0;
      if (world.state.time - lastSaveAt > 20) {
        lastSaveAt = world.state.time;
        saveGame(world.snapshot());
        hasSave = true;
      }
    }
  } else if (screen === SCREEN_PAUSED) {
    if (input.pressed('pause')) screen = SCREEN_PLAY;
    else if (input.pressed('save')) { saveGame(world.snapshot()); hasSave = true; toast('Saved. Port Solenne will wait.'); }
    else if (input.pressed('load') && hasSave) { world.applySnapshot(loadGame()); toast('Save loaded.'); }
    else if (input.pressed('quit')) screen = SCREEN_TITLE;
    input.endFrame();
  }
  renderer.draw(world, screen, hasSave);

  if (shot) {
    shotFrames += 1;
    const needed = shot === 'title' ? 36 : shot === 'chase' ? 40 : 105;
    if (shotFrames >= needed) window.__shotReady = true;
  }
}

window.__game = { world, get screen() { return screen; } };
requestAnimationFrame(frame);
