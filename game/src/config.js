// Port Solenne — shared tuning for the whole game.
// One file holds the street plan, the palette and every balance number, so the
// city generator, the simulation and the renderer never disagree about the
// world they share. The look is a Leonida evening: tangerine melting through
// hot pink into violet, indigo silhouettes, signs that wake up after dark.

export const WORLD_W = 3360;
export const WORLD_H = 2520;

// Road centre-lines. Blocks are whatever is left between neighbouring roads.
export const AVENUES = [240, 720, 1200, 1680, 2160, 2640, 3120]; // vertical, x
export const STREETS = [240, 660, 1080, 1500, 1920, 2340]; // horizontal, y
export const ROAD_HALF = 58; // half the road width, kerb to centre line
export const WALK_HALF = 74; // road half + sidewalk

export const FIXED_DT = 1 / 60;
export const SAVE_KEY = 'port-solenne-save-v1';
export const DAY_SECONDS = 240; // one full day/night cycle

export const PLAYER_TUNE = {
  radius: 13,
  walk: 180,
  sprint: 272,
  health: 100,
  punchRange: 42,
  punchDamage: 34,
  punchEvery: 0.34,
  shotDamage: 26,
  shotEvery: 0.24,
};

export const HEAT_TUNE = {
  perStar: 100,
  maxStars: 5,
  calmDelay: 7, // seconds without a witnessed crime before heat decays
  calmRate: 5.5,
  carTheft: 14,
  gunshot: 7,
  assault: 24,
  pedHit: 55,
  copHit: 70,
  carBump: 6,
  vandalism: 4,
};

// Sunset first, neon second: every colour the renderer needs.
export const INK = {
  skyHigh: '#2a1052',
  skyMid: '#b83a7c',
  skyLow: '#ff7e47',
  sunLow: '#ffd98a',
  sunCore: '#fff3c4',
  sea: '#1d2f66',
  seaGlow: '#3ec6d8',
  sand: '#e8b06f',
  boardwalk: '#8a5a3b',
  grass: '#274d3d',
  parkGreen: '#2f6b4a',
  asphalt: '#232038',
  kerb: '#f2e6c9',
  lanePaint: '#ffd94d',
  pavement: '#c98a5e',
  zebra: '#f7ead2',
  roofSlate: '#33254d',
  roofPlum: '#4a2c63',
  roofWine: '#6e2f63',
  pink: '#ff4fa3',
  cyan: '#39e6ff',
  amber: '#ffb03a',
  lime: '#b6ff5e',
  violet: '#9d6bff',
  ink: '#14101f',
  paper: '#fff6e8',
  danger: '#ff4757',
  gold: '#ffd94d',
  mint: '#52ffa8',
};

export const DISTRICTS = [
  { name: 'Old Market', x: 240, y: 240 },
  { name: 'Canal Row', x: 1200, y: 660 },
  { name: 'Palmetto Heights', x: 720, y: 1080 },
  { name: 'Neon Mile', x: 1680, y: 1500 },
  { name: 'Marina Azul', x: 2640, y: 1080 },
  { name: 'Solenne Beach', x: 2160, y: 2340 },
  { name: 'The Flats', x: 720, y: 1920 },
  { name: 'Lighthouse Point', x: 3120, y: 2340 },
];

// The local motor pool. topSpeed/accel in px units; price is flavour for the
// stats screen. The Cruiser is the police interceptor and is never parked.
export const CAR_KINDS = [
  { name: 'Palmetto Coupe', topSpeed: 342, accel: 212, grip: 3.4, price: 900 },
  { name: 'Brisa GT', topSpeed: 398, accel: 264, grip: 3.9, price: 2400 },
  { name: 'Canal Taxi', topSpeed: 288, accel: 178, grip: 3.1, price: 500 },
  { name: 'Marta Pickup', topSpeed: 262, accel: 170, grip: 2.8, price: 650 },
  { name: 'Velvet Sedan', topSpeed: 316, accel: 198, grip: 3.2, price: 1100 },
  { name: 'Dune Buggy', topSpeed: 302, accel: 240, grip: 2.6, price: 800 },
  { name: 'Solenne Cruiser', topSpeed: 330, accel: 226, grip: 3.5, price: 0 },
];

export const PAINTS = [
  '#ff5d47', '#ff9f2e', '#ffd94d', '#52ffa8', '#39c2ff', '#ff4fa3',
  '#9d6bff', '#f2f2f2', '#2e2a3a', '#ff7847', '#4fe3c1', '#e84f7a',
];

export const NAMES = [
  'Ana', 'Bruno', 'Celia', 'Dario', 'Elena', 'Felix', 'Gia', 'Hugo',
  'Ines', 'Jorge', 'Kira', 'Lorenzo', 'Marta', 'Nico', 'Ofelia', 'Pablo',
  'Rosa', 'Silvio', 'Tania', 'Ugo', 'Valeria', 'Waldo', 'Yara', 'Zeno',
];
