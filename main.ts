// Port Solenne — the hand-in program for the make.fun "Make GTA 6" bounty.
//
// The game itself is the game/ folder beside this file: plain static files a
// desktop browser runs offline (game/index.html and its ES modules, no
// library, no network). This program copies game/ and screenshots/ into the
// output directory and writes dossier.json there with the kit's vendored
// buildDossier, so the judge reads exactly the bytes the scorer will rebuild.
//
// Run it the way the grader does, with MAKEFUN_OUTPUT_DIR standing in for
// /output:   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with:   node serve.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own (the kit's gate): the dossier text budget,
// at most 4 screenshots of at most 256 KiB, at most 993 game files and
// 48 MiB of game, no game path longer than 1000 bytes.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
