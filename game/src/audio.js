// All sound is synthesised: a slow synthwave loop, an engine whose pitch
// follows the car, a two-tone siren, and a pocketful of one-shot effects.
// Nothing is loaded, so the game is silent until the first user gesture
// unlocks the AudioContext — and in a headless test, where no AudioContext
// exists at all, every method quietly does nothing.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = 0;
  let chordStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = null, dest = null) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(dest || master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // A lazy sunset progression: Am — F — C — G, one soft pad chord at a time,
  // with a bass note underneath. Cheap, cheerful, unmistakably evening.
  const CHORDS = [
    [110.0, 220.0, 261.63, 329.63],
    [87.31, 174.61, 220.0, 261.63],
    [130.81, 196.0, 261.63, 329.63],
    [98.0, 196.0, 246.94, 293.66],
  ];

  function playChord() {
    if (!ensure()) return;
    const chord = CHORDS[chordStep % CHORDS.length];
    chordStep += 1;
    for (const f of chord) tone(f, 3.6, 'triangle', 0.05, 0, null, musicGain);
    tone(chord[0] / 2, 3.2, 'sine', 0.09, 0, null, musicGain);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    update(dt, driving) {
      if (!ctx) return;
      musicTimer -= dt;
      if (musicTimer <= 0) { playChord(); musicTimer = 3.4; }
      // Engine: a sawtooth whose pitch tracks speed, started on first drive.
      if (driving) {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineGain.gain.value = 0.0;
          engineOsc.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        const speed = Math.min(1, Math.abs(driving.speed) / 380);
        engineOsc.frequency.value = 55 + speed * 165 + Math.sin(ctx.currentTime * 31) * 2.5;
        engineGain.gain.value = 0.028 + speed * 0.05;
      } else if (engineGain) {
        engineGain.gain.value = 0;
      }
    },
    setSiren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'square';
        sirenGain.gain.value = 0.016;
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.55;
        lfoGain.gain.value = 130;
        lfo.connect(lfoGain);
        lfoGain.connect(sirenOsc.frequency);
        sirenOsc.frequency.value = 760;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        lfo.start();
        sirenOsc._lfo = lfo;
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); sirenOsc._lfo.stop(); } catch { /* already gone */ }
        sirenOsc = null;
        sirenGain = null;
      }
    },
    sfx(name) {
      if (!ensure()) return;
      switch (name) {
        case 'punch': tone(140, 0.09, 'square', 0.12, 0, 60); break;
        case 'shot': tone(880, 0.11, 'sawtooth', 0.10, 0, 120); tone(190, 0.08, 'square', 0.08); break;
        case 'hit': tone(220, 0.08, 'square', 0.09, 0, 90); break;
        case 'coin': tone(990, 0.07, 'sine', 0.10); tone(1320, 0.12, 'sine', 0.10, 0.06); break;
        case 'ghost': tone(520, 0.3, 'sine', 0.10, 0, 1040); break;
        case 'door': tone(320, 0.07, 'triangle', 0.10, 0, 210); break;
        case 'crash': tone(120, 0.22, 'sawtooth', 0.13, 0, 40); break;
        case 'alarm': tone(1180, 0.14, 'square', 0.07); tone(1180, 0.14, 'square', 0.07, 0.2); break;
        case 'success': tone(660, 0.1, 'triangle', 0.11); tone(880, 0.16, 'triangle', 0.11, 0.09); break;
        case 'fail': tone(300, 0.25, 'triangle', 0.11, 0, 160); break;
        case 'phone': tone(1046, 0.08, 'sine', 0.08); tone(1046, 0.08, 'sine', 0.08, 0.14); break;
        default: break;
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
  };
}
