// Keyboard and mouse state for the game. The world only ever asks two
// questions — "is this action held?" (down) and "did it start this frame?"
// (pressed) — so a test harness can drive the same interface with a script.
// Actions are named for intent, not keys, and the mapping lives here alone.

const BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  punch: ['KeyF'],
  shoot: ['KeyJ', 'MouseLeft'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  save: ['KeyS'],
  load: ['KeyL'],
  quit: ['KeyQ'],
  start: ['Enter', 'Space'],
  new: ['KeyN'],
  phone: ['Tab'],
};

export function createInput(target) {
  const held = new Set();
  const fresh = new Set();
  const byCode = new Map();
  for (const [action, codes] of Object.entries(BINDINGS)) {
    for (const code of codes) byCode.set(code, action);
  }

  const press = (code) => {
    const action = byCode.get(code);
    if (!action) return false;
    if (!held.has(action)) fresh.add(action);
    held.add(action);
    return true;
  };
  const release = (code) => {
    const action = byCode.get(code);
    if (action) held.delete(action);
  };

  if (target && typeof target.addEventListener === 'function') {
    target.addEventListener('keydown', (ev) => {
      if (press(ev.code) && ev.code.startsWith('Arrow')) ev.preventDefault();
      if (ev.code === 'Tab') ev.preventDefault();
    });
    target.addEventListener('keyup', (ev) => release(ev.code));
    target.addEventListener('mousedown', (ev) => { if (ev.button === 0) press('MouseLeft'); });
    target.addEventListener('mouseup', (ev) => { if (ev.button === 0) release('MouseLeft'); });
    target.addEventListener('blur', () => { held.clear(); fresh.clear(); });
  }

  return {
    down: (action) => held.has(action),
    pressed: (action) => fresh.has(action),
    // Called once per frame after the world has read the edges.
    endFrame: () => fresh.clear(),
    // Test hooks: a scripted driver can pose as the keyboard.
    fakeDown: (action) => { if (!held.has(action)) fresh.add(action); held.add(action); },
    fakeUp: (action) => held.delete(action),
    fakeTap: (action) => { fresh.add(action); },
  };
}
