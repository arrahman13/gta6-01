// The city itself: blocks, buildings, shop signs, palms, lamps, billboards and
// the twelve hiding places of the Fun Ghosts. Everything is derived from the
// road plan in config.js plus a seeded random stream, and a few landmarks are
// placed by hand because the story depends on where they stand: the Leonida
// Mart, the Hotel Palmera, the arcade, the garage, the precinct, the clinic.

import {
  WORLD_W, WORLD_H, AVENUES, STREETS, WALK_HALF, INK, DISTRICTS,
} from './config.js';

export const MART = { x: 1246, y: 806, w: 196, h: 108, doorX: 1344, doorY: 800 };
export const HOTEL = { x: 2220, y: 548, w: 204, h: 112, doorX: 2322, doorY: 668 };
export const ARCADE = { x: 1770, y: 1668, w: 184, h: 108, doorX: 1862, doorY: 1660 };
export const GARAGE = { x: 1836, y: 1176, w: 176, h: 122, doorX: 1826, doorY: 1237 };
export const PRECINCT = { x: 2380, y: 462, w: 180, h: 110, doorX: 2470, doorY: 580 };
export const CLINIC = { x: 830, y: 800, w: 160, h: 100, doorX: 910, doorY: 908 };
export const PARK = { x: 1274, y: 1154, w: 332, h: 272 };
export const BEACH_Y = 2430;

const SHOP_NAMES = [
  'Cafe Brisa', 'Taco Trueno', 'Librería Faro', 'Beach Bar Ola',
  'Radio Solenne', "Pepe's Marina", 'Floristería Luz', 'Barbería Sol',
  'Hotel Palmera', 'Solenne Arcade', 'Clínica San Solenne', 'Precinct 9',
];

const BILLBOARD_JOKES = [
  'DOWNLOAD SIZE: YES',
  'NOW SERVING #404',
  "VISIT PORT SOLENNE — YOU'RE ALREADY HERE",
  'CAFECITO: LEGALLY A FOOD GROUP',
  'SUNSET EVERY DAY, GUARANTEED*',
  'BOATS: LIKE CARS, BUT WETTER',
  'RADIO SOLENNE 101.5 — ALL HITS, SOME NEWS',
  'YOUR OTHER CAR IS A JET SKI',
];

// Twelve Fun Ghosts hide in plain sight: rooftops are out, so they haunt
// parks, piers, forecourts and other open ground a pedestrian can reach.
const GHOST_SPOTS = [
  { x: 1440, y: 1290 }, { x: 3120, y: 2400 }, { x: 300, y: 330 },
  { x: 2160, y: 2460 }, { x: 760, y: 560 }, { x: 2650, y: 700 },
  { x: 960, y: 1700 }, { x: 2050, y: 2050 }, { x: 480, y: 2280 },
  { x: 2900, y: 1700 }, { x: 1330, y: 2050 }, { x: 3300, y: 1200 },
];

function blockEdges() {
  // Open spans between roads: [x0, x1] pairs for columns, [y0, y1] for rows.
  const cols = [];
  const rows = [];
  let prev = 0;
  for (const ax of AVENUES) { cols.push([prev, ax - WALK_HALF]); prev = ax + WALK_HALF; }
  cols.push([prev, WORLD_W]);
  prev = 0;
  for (const sy of STREETS) { rows.push([prev, sy - WALK_HALF]); prev = sy + WALK_HALF; }
  rows.push([prev, WORLD_H]);
  return { cols, rows };
}

export function generateCity(rng) {
  const buildings = [];
  const signs = [];
  const palms = [];
  const lamps = [];
  const billboards = [];
  const { cols, rows } = blockEdges();
  const roofs = [INK.roofSlate, INK.roofPlum, INK.roofWine];

  const addBuilding = (x, y, w, h, name) => {
    const b = { x, y, w, h, roof: rng.pick(roofs), floors: rng.int(2, 9), name: name || null };
    buildings.push(b);
    if (name) signs.push({ text: name, x: x + w / 2, y, color: rng.pick([INK.pink, INK.cyan, INK.amber, INK.lime]) });
    return b;
  };

  // Hand-placed landmarks first; the filler keeps out of their footprints.
  const landmarks = [MART, HOTEL, ARCADE, GARAGE, PRECINCT, CLINIC];
  addBuilding(MART.x, MART.y, MART.w, MART.h, 'Leonida Mart');
  addBuilding(HOTEL.x, HOTEL.y, HOTEL.w, HOTEL.h, 'Hotel Palmera');
  addBuilding(ARCADE.x, ARCADE.y, ARCADE.w, ARCADE.h, 'Solenne Arcade');
  addBuilding(GARAGE.x, GARAGE.y, GARAGE.w, GARAGE.h, 'Garage Neon');
  addBuilding(PRECINCT.x, PRECINCT.y, PRECINCT.w, PRECINCT.h, 'Precinct 9');
  addBuilding(CLINIC.x, CLINIC.y, CLINIC.w, CLINIC.h, 'Clínica San Solenne');
  const overlapsLandmark = (x, y, w, h) => landmarks.some((L) =>
    x < L.x + L.w + 10 && x + w > L.x - 10 && y < L.y + L.h + 10 && y + h > L.y - 10);
  // Ghost spots sit on open ground: no filler building may swallow one.
  const coversGhost = (x, y, w, h) => GHOST_SPOTS.some((g) =>
    g.x > x - 42 && g.x < x + w + 42 && g.y > y - 42 && g.y < y + h + 42);

  let shopCursor = 0;
  for (const [cx0, cx1] of cols) {
    for (const [ry0, ry1] of rows) {
      const bw = cx1 - cx0;
      const bh = ry1 - ry0;
      if (bw < 90 || bh < 90) continue;
      if (cx0 === PARK.x && ry0 === PARK.y) continue; // the park stays green
      if (ry0 >= BEACH_Y - WALK_HALF) continue; // beachfront stays sand
      // Narrow blocks get one slab; wide ones get a grid of columns/rows.
      const nCols = bw > 300 ? rng.int(2, 3) : 1;
      const nRows = bh > 240 ? rng.int(2, 3) : 1;
      const cellW = bw / nCols;
      const cellH = bh / nRows;
      for (let i = 0; i < nCols; i++) {
        for (let j = 0; j < nRows; j++) {
          if (rng.chance(0.12)) continue; // a plaza, a lot, breathing room
          const pad = 14;
          const x = cx0 + i * cellW + pad + rng.range(0, 8);
          const y = ry0 + j * cellH + pad + rng.range(0, 8);
          const w = cellW - pad * 2 - rng.range(0, 10);
          const h = cellH - pad * 2 - rng.range(0, 10);
          if (w < 40 || h < 36) continue;
          if (overlapsLandmark(x, y, w, h)) continue;
          if (coversGhost(x, y, w, h)) continue;
          const nearRoad = j === 0 || i === 0;
          const name = nearRoad && shopCursor < SHOP_NAMES.length && rng.chance(0.4)
            ? SHOP_NAMES[shopCursor++] : null;
          addBuilding(x, y, w, h, name);
        }
      }
      // Palms loiter on block corners; lamps guard the intersections.
      if (rng.chance(0.8)) palms.push({ x: cx0 + 10, y: ry0 + 10, s: rng.range(0.8, 1.25) });
      if (rng.chance(0.6)) palms.push({ x: cx1 - 12, y: ry1 - 12, s: rng.range(0.8, 1.25) });
    }
  }
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      lamps.push({ x: ax - WALK_HALF + 6, y: sy - WALK_HALF + 6 });
      lamps.push({ x: ax + WALK_HALF - 6, y: sy + WALK_HALF - 6 });
    }
  }
  // Billboards face the avenues, one joke per board.
  BILLBOARD_JOKES.forEach((text, i) => {
    const ax = AVENUES[i % AVENUES.length];
    const sy = STREETS[(i * 2 + 1) % STREETS.length];
    billboards.push({ text, x: ax + (i % 2 ? 96 : -96), y: sy - 30 });
  });
  // Park palms and a double row along the beach.
  for (let i = 0; i < 10; i++) palms.push({ x: PARK.x + rng.range(16, PARK.w - 16), y: PARK.y + rng.range(16, PARK.h - 16), s: rng.range(0.9, 1.4) });
  for (let x = 120; x < WORLD_W - 60; x += 150) palms.push({ x: x + rng.range(-16, 16), y: BEACH_Y + 26, s: rng.range(0.9, 1.3) });

  const pickups = [
    { kind: 'health', x: CLINIC.doorX, y: CLINIC.doorY + 26 },
    { kind: 'health', x: 2160, y: 2400 },
    { kind: 'ammo', x: MART.doorX + 30, y: MART.doorY - 26 },
    { kind: 'ammo', x: PRECINCT.doorX, y: PRECINCT.doorY + 30 },
    { kind: 'cash', x: 760, y: 2050 },
    { kind: 'cash', x: 2650, y: 2050 },
    { kind: 'cash', x: 480, y: 900 },
  ];

  return {
    buildings, signs, palms, lamps, billboards, pickups,
    ghostSpots: GHOST_SPOTS.map((g, i) => ({ ...g, id: i })),
    park: PARK, beachY: BEACH_Y,
  };
}

// Push a circle out of every building it overlaps; returns the fixed point.
export function resolveCircle(city, x, y, r) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        // Centre inside the rect: leave by the nearest face.
        const left = x - b.x; const right = b.x + b.w - x;
        const top = y - b.y; const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  return { x, y };
}

export function isRoad(x, y) {
  const onAvenue = AVENUES.some((ax) => Math.abs(x - ax) <= WALK_HALF);
  const onStreet = STREETS.some((sy) => Math.abs(y - sy) <= WALK_HALF);
  return onAvenue || onStreet;
}

export function districtAt(x, y) {
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dist = (d.x - x) ** 2 + (d.y - y) ** 2;
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return best.name;
}
