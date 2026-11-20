// The renderer: everything the player sees, drawn from world state alone.
// Layers, back to front: ground and roads, props, pickups and ghosts, cars,
// people, bullets, then the light of the hour poured over the top, then the
// HUD in screen space. The title and pause screens are full-canvas scenes of
// their own. Nothing here mutates the world; it only reads and draws.

import {
  WORLD_W, WORLD_H, AVENUES, STREETS, ROAD_HALF, WALK_HALF, INK, DISTRICTS,
} from './config.js';
import { districtAt } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// The hour in Port Solenne: clock is a day fraction starting at midnight.
// Returns how dark the world overlay should be and how warm the light runs.
function lightAt(clock) {
  const hour = clock * 24;
  const sunUp = Math.sin(((hour - 6) / 12) * Math.PI); // peaks at noon
  const darkness = hour < 5.4 || hour > 19.6 ? 0.52 : hour < 7 ? 0.3 : hour > 18 ? 0.3 : 0.04;
  const golden = Math.max(0, 1 - Math.abs(hour - 17.6) / 1.7) + Math.max(0, 1 - Math.abs(hour - 6.4) / 1.1) * 0.7;
  return { darkness: Math.max(0.02, darkness - Math.max(0, sunUp) * 0.02), golden: Math.min(1, golden) };
}

function clockText(clock) {
  const mins = Math.floor(clock * 24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// The little white ghost: make.fun's mascot, moonlighting as a collectible.
export function drawGhost(ctx, x, y, s, alpha = 1, color = '#ffffff') {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10, 10);
  ctx.lineTo(-10, -2);
  ctx.arc(0, -2, 10, Math.PI, 0);
  ctx.lineTo(10, 10);
  ctx.lineTo(6.6, 6.4);
  ctx.lineTo(3.3, 10);
  ctx.lineTo(0, 6.4);
  ctx.lineTo(-3.3, 10);
  ctx.lineTo(-6.6, 6.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK.ink;
  ctx.beginPath();
  ctx.arc(-3.6, -3, 1.7, 0, TAU);
  ctx.arc(3.6, -3, 1.7, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawGround(ctx, city, cam, view) {
  ctx.fillStyle = INK.grass;
  ctx.fillRect(cam.x, cam.y, view.w, view.h);
  // The park: one proud green rectangle with a pale path cross.
  ctx.fillStyle = INK.parkGreen;
  ctx.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
  ctx.fillStyle = 'rgba(255,246,232,0.25)';
  ctx.fillRect(city.park.x, city.park.y + city.park.h / 2 - 7, city.park.w, 14);
  ctx.fillRect(city.park.x + city.park.w / 2 - 7, city.park.y, 14, city.park.h);
  // Beach and boardwalk along the south shore; sea glitter below the sand.
  ctx.fillStyle = INK.sand;
  ctx.fillRect(0, city.beachY, WORLD_W, WORLD_H - city.beachY);
  ctx.fillStyle = INK.boardwalk;
  ctx.fillRect(0, city.beachY, WORLD_W, 12);
  // Sidewalks first (the wide pale band), then asphalt over the middle.
  ctx.fillStyle = INK.pavement;
  for (const ax of AVENUES) ctx.fillRect(ax - WALK_HALF, 0, WALK_HALF * 2, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - WALK_HALF, WORLD_W, WALK_HALF * 2);
  ctx.fillStyle = INK.asphalt;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_HALF, 0, ROAD_HALF * 2, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_HALF, WORLD_W, ROAD_HALF * 2);
  // Lane dashes down every road's spine.
  ctx.fillStyle = INK.lanePaint;
  ctx.globalAlpha = 0.5;
  for (const ax of AVENUES) for (let y = 12; y < WORLD_H; y += 46) ctx.fillRect(ax - 2, y, 4, 24);
  for (const sy of STREETS) for (let x = 12; x < WORLD_W; x += 46) ctx.fillRect(x, sy - 2, 24, 4);
  ctx.globalAlpha = 1;
  // Crosswalks at every crossing.
  ctx.fillStyle = INK.zebra;
  ctx.globalAlpha = 0.55;
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(ax - ROAD_HALF + 6 + (i + 2) * 21, sy - WALK_HALF + 2, 12, 10);
        ctx.fillRect(ax - ROAD_HALF + 6 + (i + 2) * 21, sy + WALK_HALF - 12, 12, 10);
        ctx.fillRect(ax - WALK_HALF + 2, sy - ROAD_HALF + 6 + (i + 2) * 21, 10, 12);
        ctx.fillRect(ax + WALK_HALF - 12, sy - ROAD_HALF + 6 + (i + 2) * 21, 10, 12);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawBuildings(ctx, city, cam, view, darkness) {
  for (const b of city.buildings) {
    if (b.x + b.w < cam.x - 40 || b.x > cam.x + view.w + 40 || b.y + b.h < cam.y - 40 || b.y > cam.y + view.h + 40) continue;
    ctx.fillStyle = 'rgba(10,6,24,0.35)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(255,246,232,0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Windows: a seeded-looking grid that lights up as the sky goes down.
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rowsN = Math.max(2, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rowsN; j++) {
        const lit = ((i * 7 + j * 13 + b.floors) % 5) < 2;
        ctx.fillStyle = lit && darkness > 0.2 ? 'rgba(255,205,110,0.9)' : 'rgba(20,16,31,0.5)';
        ctx.fillRect(b.x + 8 + i * ((b.w - 16) / cols), b.y + 8 + j * ((b.h - 16) / rowsN), 9, 6);
      }
    }
    if (b.name) {
      ctx.fillStyle = 'rgba(20,16,31,0.65)';
      const label = b.name.toUpperCase();
      ctx.font = '700 11px system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      rr(ctx, b.x + b.w / 2 - tw / 2 - 6, b.y + b.h / 2 - 10, tw + 12, 20, 5);
      ctx.fill();
      ctx.fillStyle = INK.paper;
      ctx.textAlign = 'center';
      ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 4);
      ctx.textAlign = 'left';
    }
  }
  // Neon shop signs glow after dark.
  for (const s of city.signs) {
    if (darkness < 0.15) continue;
    ctx.save();
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = s.color;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.text.toUpperCase(), s.x, s.y - 8);
    ctx.restore();
    ctx.textAlign = 'left';
  }
  for (const bb of city.billboards) {
    ctx.fillStyle = INK.ink;
    ctx.fillRect(bb.x - 74, bb.y - 20, 148, 40);
    ctx.strokeStyle = INK.amber;
    ctx.lineWidth = 2;
    ctx.strokeRect(bb.x - 74, bb.y - 20, 148, 40);
    ctx.fillStyle = INK.amber;
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const words = bb.text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) { if ((line + ' ' + w).trim().length > 24) { lines.push(line.trim()); line = w; } else line += ' ' + w; }
    lines.push(line.trim());
    lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, bb.x, bb.y - 4 + i * 12));
    ctx.textAlign = 'left';
  }
}

function drawProps(ctx, city, darkness, time) {
  for (const lamp of city.lamps) {
    ctx.fillStyle = INK.ink;
    ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    if (darkness > 0.18) {
      const g = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 44);
      g.addColorStop(0, 'rgba(255,190,90,0.34)');
      g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 44, 0, TAU);
      ctx.fill();
    }
  }
  for (const palm of city.palms) {
    ctx.save();
    ctx.translate(palm.x, palm.y);
    ctx.scale(palm.s, palm.s);
    ctx.strokeStyle = '#5d4028';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.quadraticCurveTo(3, -4, 6, -12);
    ctx.stroke();
    ctx.strokeStyle = '#2e8f5b';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.sin(time * 0.7 + palm.x) * 0.05;
      ctx.beginPath();
      ctx.moveTo(6, -12);
      ctx.quadraticCurveTo(6 + Math.cos(a) * 11, -12 + Math.sin(a) * 6 - 3, 6 + Math.cos(a) * 17, -12 + Math.sin(a) * 10 + 3);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawCar(ctx, car, time, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(10,6,24,0.35)';
  rr(ctx, -24, -11, 50, 24, 7);
  ctx.fill();
  ctx.fillStyle = car.mode === 'police' ? '#f2f2f2' : car.paint;
  rr(ctx, -25, -13, 50, 26, 7);
  ctx.fill();
  if (car.mode === 'police') {
    ctx.fillStyle = INK.ink;
    rr(ctx, -8, -13, 17, 26, 4);
    ctx.fill();
    const flash = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = flash ? INK.danger : INK.cyan;
    rr(ctx, -5, -9, 10, 6, 2);
    ctx.fill();
    ctx.fillStyle = flash ? INK.cyan : INK.danger;
    rr(ctx, -5, 3, 10, 6, 2);
    ctx.fill();
  }
  ctx.fillStyle = '#18202e';
  rr(ctx, -6, -10, 17, 20, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(190,230,255,0.75)';
  rr(ctx, 12, -10, 6, 20, 3);
  ctx.fill();
  if (car.hp < 45) {
    ctx.fillStyle = 'rgba(40,40,48,0.5)';
    ctx.beginPath();
    ctx.arc(14 + Math.sin(time * 7 + car.x) * 2, -4, 6 + (45 - car.hp) * 0.12, 0, TAU);
    ctx.fill();
  }
  if (isPlayer) {
    ctx.strokeStyle = INK.gold;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    rr(ctx, -29, -17, 58, 34, 9);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(10,6,24,0.3)';
  ctx.beginPath();
  ctx.arc(1.5, 2.5, 10, 0, TAU);
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = opts.skin || '#e8b08a';
  ctx.beginPath();
  ctx.arc(0, 0, 5.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = shirt;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
  ctx.stroke();
  if (opts.badge) {
    ctx.fillStyle = INK.gold;
    ctx.fillRect(-2, -11, 4, 4);
  }
  ctx.restore();
}

function drawWorld(ctx, world, view) {
  const { state } = world;
  const city = state.city;
  const cam = state.camera;
  const { darkness, golden } = lightAt(state.clock);
  const t = state.time;

  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawGround(ctx, city, cam, view);
  drawProps(ctx, city, darkness, t);
  drawBuildings(ctx, city, cam, view, darkness);

  // Pickups pulse gently; ghosts bob and mind their own business.
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(t * 3 + pk.x) * 2;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = pk.kind === 'health' ? '#ff5d6e' : pk.kind === 'ammo' ? INK.amber : INK.mint;
    rr(ctx, -9, -9, 18, 18, 5);
    ctx.fill();
    ctx.fillStyle = INK.ink;
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? '≡' : '$', 0, 4.5);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  for (const spot of city.ghostSpots) {
    if (state.ghosts.includes(spot.id)) continue;
    drawGhost(ctx, spot.x, spot.y - 6 + Math.sin(t * 2 + spot.id) * 3, 0.95, 0.88);
  }

  // Objective beacon: a column of light you can steer by.
  const obj = world.objective();
  const pulse = 0.6 + Math.sin(t * 4) * 0.25;
  ctx.save();
  ctx.globalAlpha = pulse * 0.3;
  ctx.fillStyle = INK.gold;
  ctx.fillRect(obj.x - 5, obj.y - 190, 10, 190);
  ctx.globalAlpha = pulse;
  ctx.beginPath();
  ctx.arc(obj.x, obj.y, 17 + Math.sin(t * 4) * 3, 0, TAU);
  ctx.strokeStyle = INK.gold;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Race gates and taxi markers borrow the same ring language.
  const ring = (x, y, color, label) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y, 20 + Math.sin(t * 5) * 3, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 28);
    ctx.restore();
    ctx.textAlign = 'left';
  };
  if (state.race) {
    const gates = [[2640, 2340], [2160, 1920], [2640, 1500], [3120, 1080], [2640, 660], [3050, 2360]];
    const g = gates[state.race.gate];
    if (g) ring(g[0], g[1], INK.cyan, 'RACE GATE');
  }
  if (state.taxi) ring(state.taxi.x, state.taxi.y, INK.lime, state.taxi.phase === 'pickup' ? 'PASSENGER' : 'DROP OFF');

  for (const car of state.cars) drawCar(ctx, car, t, state.player.car === car);
  for (const ped of state.peds) {
    if (ped.down > 0) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(1.2);
      ctx.fillStyle = ped.shirt;
      rr(ctx, -11, -5, 22, 10, 5);
      ctx.fill();
      ctx.restore();
    } else {
      drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, {});
    }
  }
  for (const r of state.rivals) drawPerson(ctx, r.x, r.y, 0, '#c2185b', { skin: '#caa27e' });
  for (const cop of state.cops) drawPerson(ctx, cop.x, cop.y, cop.angle, '#27407c', { badge: true, skin: '#d9a37e' });
  const p = state.player;
  if (!p.car) drawPerson(ctx, p.x, p.y, p.angle, INK.gold, { skin: '#b97a56' });

  ctx.fillStyle = '#fff6e8';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.6, 0, TAU);
    ctx.fill();
  }

  // The hour, poured over everything: dusk warmth, then honest night.
  if (golden > 0.15) {
    ctx.fillStyle = `rgba(255,110,60,${0.10 * golden})`;
    ctx.fillRect(cam.x, cam.y, view.w, view.h);
  }
  if (darkness > 0.03) {
    ctx.fillStyle = `rgba(16,10,44,${darkness})`;
    ctx.fillRect(cam.x, cam.y, view.w, view.h);
    // Headlight cones and the player's little pool of lamplight.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cone = (x, y, angle) => {
      const g = ctx.createRadialGradient(x, y, 8, x, y, 130);
      g.addColorStop(0, 'rgba(255,230,160,0.20)');
      g.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, 130, angle - 0.42, angle + 0.42);
      ctx.closePath();
      ctx.fill();
    };
    for (const car of state.cars) if (car.speed !== 0 || car === p.car) cone(car.x, car.y, car.angle);
    const pg = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, 90);
    pg.addColorStop(0, 'rgba(255,210,140,0.13)');
    pg.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 90, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const trial = line ? line + ' ' + w : w;
    if (ctx.measureText(trial).width > maxWidth && line) { lines.push(line); line = w; }
    else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

function drawMinimap(ctx, world, x, y, w, h) {
  const { state } = world;
  ctx.save();
  ctx.fillStyle = 'rgba(16,12,30,0.82)';
  rr(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,246,232,0.35)';
  ctx.lineWidth = 1;
  rr(ctx, x, y, w, h, 8);
  ctx.stroke();
  const sx = (wx) => x + (wx / WORLD_W) * w;
  const sy = (wy) => y + (wy / WORLD_H) * h;
  ctx.strokeStyle = 'rgba(255,246,232,0.28)';
  for (const ax of AVENUES) { ctx.beginPath(); ctx.moveTo(sx(ax), y + 3); ctx.lineTo(sx(ax), y + h - 3); ctx.stroke(); }
  for (const syRoad of STREETS) { ctx.beginPath(); ctx.moveTo(x + 3, sy(syRoad)); ctx.lineTo(x + w - 3, sy(syRoad)); ctx.stroke(); }
  ctx.fillStyle = 'rgba(63,198,216,0.5)';
  ctx.fillRect(x, sy(state.city.beachY), w, Math.max(2, h - (sy(state.city.beachY) - y)));
  const obj = world.objective();
  ctx.fillStyle = INK.gold;
  ctx.beginPath();
  ctx.arc(sx(obj.x), sy(obj.y), 3.4, 0, TAU);
  ctx.fill();
  for (const spot of state.city.ghostSpots) {
    if (state.ghosts.includes(spot.id)) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(sx(spot.x) - 1.4, sy(spot.y) - 1.4, 2.8, 2.8);
  }
  if (Math.floor(state.time * 2.4) % 2 === 0) {
    ctx.fillStyle = '#5f8dff';
    for (const car of state.cars) if (car.mode === 'police') { ctx.beginPath(); ctx.arc(sx(car.x), sy(car.y), 2.4, 0, TAU); ctx.fill(); }
    for (const cop of state.cops) { ctx.beginPath(); ctx.arc(sx(cop.x), sy(cop.y), 2.2, 0, TAU); ctx.fill(); }
  }
  const p = state.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sx(p.x), sy(p.y), 3.6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, world, view) {
  const { state } = world;
  const p = state.player;
  const stars = world.stars();
  ctx.save();
  // Wallet, health, ammo: the top-left stack.
  ctx.fillStyle = 'rgba(16,12,30,0.72)';
  rr(ctx, 14, 14, 218, 74, 9);
  ctx.fill();
  ctx.fillStyle = INK.mint;
  ctx.font = '800 21px system-ui, sans-serif';
  ctx.fillText(`$${state.money}`, 26, 41);
  ctx.fillStyle = 'rgba(20,16,31,0.9)';
  rr(ctx, 26, 52, 150, 10, 5);
  ctx.fill();
  ctx.fillStyle = p.hp > 34 ? INK.mint : INK.danger;
  rr(ctx, 26, 52, Math.max(0, 150 * (p.hp / 100)), 10, 5);
  ctx.fill();
  ctx.fillStyle = INK.paper;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(`♥ ${Math.ceil(p.hp)}`, 184, 62);
  ctx.fillText(`ammo ${state.ammo}`, 120, 41);
  // Wanted stars and the clock, top-right.
  ctx.font = '900 24px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? INK.gold : 'rgba(255,246,232,0.22)';
    ctx.fillText('★', view.w - 168 + i * 30, 40);
  }
  ctx.fillStyle = INK.paper;
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${clockText(state.clock)} · ${districtAt(p.x, p.y)}`, view.w - 18, 64);
  ctx.textAlign = 'left';
  // Timers ride top-centre when a clock is running.
  ctx.textAlign = 'center';
  const stepTimer = state.mission.phase === 'run' && state.mission.timer > 0 ? state.mission.timer : null;
  const raceTimer = state.race ? state.race.limit - state.race.t : null;
  const shownTimer = raceTimer !== null ? raceTimer : stepTimer;
  if (shownTimer !== null) {
    ctx.fillStyle = shownTimer < 12 ? INK.danger : INK.paper;
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillText(`⏱ ${Math.max(0, shownTimer).toFixed(1)}`, view.w / 2, 40);
  }
  ctx.textAlign = 'left';
  // Objective line under the wallet.
  const obj = world.objective();
  ctx.fillStyle = 'rgba(16,12,30,0.66)';
  const label = `▸ ${obj.label}`;
  ctx.font = '600 14px system-ui, sans-serif';
  const tw = ctx.measureText(label).width;
  rr(ctx, 14, 96, tw + 22, 26, 7);
  ctx.fill();
  ctx.fillStyle = INK.gold;
  ctx.fillText(label, 25, 114);
  // Bust pressure: a thin red promise above the player's head.
  if (p.bustMeter > 0.06) {
    const bx = p.x - state.camera.x;
    const by = p.y - state.camera.y - 34;
    ctx.fillStyle = 'rgba(20,16,31,0.8)';
    rr(ctx, bx - 26, by, 52, 7, 3);
    ctx.fill();
    ctx.fillStyle = INK.danger;
    rr(ctx, bx - 26, by, 52 * Math.min(1, p.bustMeter / 1.1), 7, 3);
    ctx.fill();
  }
  drawMinimap(ctx, world, 14, view.h - 146, 176, 132);
  // Phone: dialogue with a name tag, bottom-right.
  if (state.phone) {
    const lines = wrapText(ctx, state.phone.text, 300);
    const ph = 58 + lines.length * 19;
    const px = view.w - 344;
    const py = view.h - ph - 16;
    ctx.fillStyle = 'rgba(14,11,26,0.88)';
    rr(ctx, px, py, 328, ph, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,232,0.25)';
    rr(ctx, px, py, 328, ph, 12);
    ctx.stroke();
    ctx.fillStyle = INK.cyan;
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillText('☎  SOLENNE MOBILE', px + 16, py + 22);
    ctx.fillStyle = INK.paper;
    ctx.font = '600 14.5px system-ui, sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, px + 16, py + 46 + i * 19));
  }
  // Toasts stack above the minimap.
  ctx.font = '600 13.5px system-ui, sans-serif';
  state.toasts.forEach((toast, i) => {
    const ty = view.h - 168 - i * 30;
    const twd = ctx.measureText(toast.text).width;
    ctx.fillStyle = 'rgba(16,12,30,0.78)';
    rr(ctx, 14, ty - 17, twd + 20, 24, 7);
    ctx.fill();
    ctx.fillStyle = INK.paper;
    ctx.fillText(toast.text, 24, ty);
  });
  // Banners shout from the middle.
  if (state.banner) {
    ctx.fillStyle = 'rgba(14,11,26,0.55)';
    ctx.fillRect(0, view.h / 2 - 64, view.w, 128);
    ctx.fillStyle = state.banner.startsWith('BUSTED') ? '#5f8dff' : state.banner.startsWith('WASTED') ? INK.danger : INK.gold;
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const first = state.banner.split('—')[0].trim();
    ctx.fillText(first, view.w / 2, view.h / 2 + 4);
    ctx.fillStyle = INK.paper;
    ctx.font = '600 16px system-ui, sans-serif';
    const rest = state.banner.split('—')[1];
    if (rest) ctx.fillText('—' + rest, view.w / 2, view.h / 2 + 36);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawTitle(ctx, world, view, hasSave) {
  const { state } = world;
  const w = view.w;
  const h = view.h;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, INK.skyHigh);
  sky.addColorStop(0.52, INK.skyMid);
  sky.addColorStop(0.78, INK.skyLow);
  sky.addColorStop(1, '#ffb03a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // The sun, low and pleased with itself.
  const sunY = h * 0.66;
  const sg = ctx.createRadialGradient(w * 0.5, sunY, 10, w * 0.5, sunY, 190);
  sg.addColorStop(0, 'rgba(255,243,196,0.95)');
  sg.addColorStop(0.35, 'rgba(255,217,138,0.75)');
  sg.addColorStop(1, 'rgba(255,217,138,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = INK.sunCore;
  ctx.beginPath();
  ctx.arc(w * 0.5, sunY, 54, 0, TAU);
  ctx.fill();
  // Skyline silhouette: two rows of towers against the light.
  ctx.fillStyle = 'rgba(30,14,54,0.85)';
  let bx = -10;
  let i = 0;
  while (bx < w + 20) {
    const bw = 46 + ((i * 53) % 70);
    const bh = 90 + ((i * 97) % 170);
    ctx.fillRect(bx, sunY + 58 - bh, bw, bh);
    bx += bw + 8;
    i += 1;
  }
  ctx.fillStyle = '#170b2e';
  ctx.fillRect(0, sunY + 58, w, h - sunY);
  // Sea glitter under the skyline.
  ctx.fillStyle = 'rgba(62,198,216,0.5)';
  for (let k = 0; k < 26; k++) {
    const gx = (k * 173) % Math.max(60, w - 40);
    ctx.fillRect(gx, sunY + 74 + (k * 29) % 40, 26 + (k % 4) * 9, 2.4);
  }
  drawGhost(ctx, w - 118, 96 + Math.sin(state.time * 1.6) * 6, 2.1, 0.96);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff6e8';
  ctx.font = '900 76px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(20,8,40,0.55)';
  ctx.shadowBlur = 18;
  ctx.fillText('PORT SOLENNE', w / 2, 128);
  ctx.shadowBlur = 0;
  ctx.fillStyle = INK.gold;
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillText('a tiny grand theft in Leonida — six missions, one ledger, zero downloads', w / 2, 162);
  ctx.fillStyle = 'rgba(255,246,232,0.92)';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(hasSave ? 'ENTER — keep playing your save      ·      N — start over' : 'ENTER — start the story', w / 2, h - 148);
  ctx.font = '500 14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,246,232,0.75)';
  ctx.fillText('WASD drive & walk · E enter car / shop · F punch · J shoot · SHIFT sprint · P pause · M mute', w / 2, h - 122);
  // Marisol's receipt, pinned to the corner like all important documents.
  const rx = w - 252;
  const ry = h - 218;
  ctx.save();
  ctx.translate(rx, ry);
  ctx.rotate(-0.035);
  ctx.fillStyle = '#fff6e8';
  rr(ctx, 0, 0, 218, 168, 4);
  ctx.fill();
  ctx.fillStyle = INK.ink;
  ctx.textAlign = 'left';
  ctx.font = '800 13px system-ui, sans-serif';
  ctx.fillText('LEONIDA MART — RECEIPT', 14, 24);
  ctx.font = '500 12px ui-monospace, monospace';
  const rows = [
    ['13 years away', '$0.00'],
    ['One (1) hometown', 'incl.'],
    ['Favours outstanding', 'many'],
    ['Sunset, daily', 'free'],
    ['TOTAL DUE', 'one ledger'],
  ];
  rows.forEach((r, k) => {
    ctx.fillText(r[0], 14, 52 + k * 19);
    ctx.textAlign = 'right';
    ctx.fillText(r[1], 204, 52 + k * 19);
    ctx.textAlign = 'left';
  });
  ctx.font = '700 10.5px system-ui, sans-serif';
  ctx.fillText('PAID IN FULL BY A FRIEND', 14, 156);
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawPaused(ctx, world, view) {
  const { state } = world;
  ctx.fillStyle = 'rgba(12,8,26,0.78)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK.paper;
  ctx.font = '900 46px system-ui, sans-serif';
  ctx.fillText('PAUSED', view.w / 2, 120);
  ctx.font = '600 16px system-ui, sans-serif';
  const s = state.stats;
  const lines = [
    `Missions done ${s.missions}/6 · Fun Ghosts ${s.ghosts}/12 · Cars liberated ${s.carsStolen}`,
    `Taxi fares ${s.fares} · Pier races won ${s.races} · Busted ${s.busted} · Wasted ${s.wasted}`,
    '',
    'P / ESC — back to the streets',
    'S — save now      L — load save      Q — quit to title',
    'M — mute the sunset',
  ];
  lines.forEach((l, i) => ctx.fillText(l, view.w / 2, 176 + i * 28));
  drawGhost(ctx, view.w / 2, view.h - 110, 1.6, 0.9);
  ctx.textAlign = 'left';
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw(world, screen, hasSave = false) {
      const view = { w: canvas.width, h: canvas.height };
      ctx.clearRect(0, 0, view.w, view.h);
      if (screen === SCREEN_TITLE) {
        drawTitle(ctx, world, view, hasSave);
        return;
      }
      drawWorld(ctx, world, view);
      drawHud(ctx, world, view);
      if (screen === SCREEN_PAUSED) drawPaused(ctx, world, view);
    },
  };
}
