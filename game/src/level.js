// Shadow Vault — the facility floor plan. Hand-laid rectangles: walls block
// movement and sight, tall cover blocks movement and sight, low props block
// movement only. Guard patrol loops are drawn so no straight leg crosses a
// wall or a piece of tall cover.
import { WORLD } from './config.js';

export const WALL = 'wall';
export const TALL = 'tall';
export const LOW = 'low';

// Solid walls (also drawn as the building shell).
export const WALLS = [
  // Outer shell, 24 px thick.
  { x: 0, y: 0, w: WORLD.width, h: 24 },
  { x: 0, y: WORLD.height - 24, w: WORLD.width, h: 24 },
  { x: 0, y: 0, w: 24, h: WORLD.height },
  { x: WORLD.width - 24, y: 0, w: 24, h: WORLD.height },
  // Server room (top-left): right wall with a door gap y 150..210.
  { x: 420, y: 24, w: 24, h: 126 },
  { x: 420, y: 210, w: 24, h: 70 },
  // Server room bottom wall with a door gap x 240..300.
  { x: 24, y: 280, w: 220, h: 24 },
  { x: 300, y: 280, w: 144, h: 24 },
  // Vault (top-right): left wall with a door gap y 160..220.
  { x: 1500, y: 24, w: 24, h: 136 },
  { x: 1500, y: 220, w: 24, h: 80 },
  // Vault bottom wall.
  { x: 1500, y: 300, w: 396, h: 24 },
  // Central divider below the hall, gap y 520..580.
  { x: 900, y: 380, w: 24, h: 140 },
  { x: 900, y: 580, w: 24, h: 116 },
  // Office floor wall, gaps x 700..760 and x 1200..1260.
  { x: 560, y: 420, w: 140, h: 24 },
  { x: 760, y: 420, w: 440, h: 24 },
  { x: 1260, y: 420, w: 240, h: 24 },
];

// Tall cover: crates, pillars, server racks. Blocks sight and movement.
export const COVER = [
  // Mid-hall crate cluster.
  { x: 660, y: 500, w: 110, h: 60, kind: 'crate' },
  { x: 780, y: 540, w: 60, h: 60, kind: 'crate' },
  // Vault approach.
  { x: 1420, y: 530, w: 80, h: 70, kind: 'crate' },
  // Storage, bottom-right.
  { x: 1620, y: 560, w: 120, h: 60, kind: 'crate' },
  // Pillars.
  { x: 1000, y: 180, w: 44, h: 44, kind: 'pillar' },
  { x: 1000, y: 560, w: 44, h: 44, kind: 'pillar' },
  { x: 500, y: 560, w: 44, h: 44, kind: 'pillar' },
  // Server racks inside the server room.
  { x: 120, y: 60, w: 140, h: 40, kind: 'rack' },
  { x: 120, y: 180, w: 140, h: 40, kind: 'rack' },
  // Crates inside the vault.
  { x: 1600, y: 80, w: 70, h: 50, kind: 'crate' },
  { x: 1800, y: 230, w: 60, h: 40, kind: 'crate' },
  // Office crates, top corridor.
  { x: 660, y: 280, w: 90, h: 60, kind: 'crate' },
  { x: 760, y: 270, w: 60, h: 60, kind: 'crate' },
];

// Low props: desks and plants. Block movement, never sight.
export const PROPS = [
  { x: 700, y: 210, w: 140, h: 50, kind: 'desk' },
  { x: 1050, y: 210, w: 140, h: 50, kind: 'desk' },
  { x: 880, y: 285, w: 140, h: 50, kind: 'desk' },
  { x: 250, y: 480, w: 120, h: 44, kind: 'desk' },
  { x: 480, y: 60, w: 36, h: 36, kind: 'plant' },
  { x: 1330, y: 360, w: 36, h: 36, kind: 'plant' },
  { x: 960, y: 640, w: 36, h: 36, kind: 'plant' },
  { x: 260, y: 650, w: 36, h: 36, kind: 'plant' },
  { x: 1560, y: 60, w: 36, h: 36, kind: 'plant' },
];

// The three intel cases to steal.
export const INTEL = [
  { id: 0, x: 1720, y: 150, label: 'Vault ledger' },
  { id: 1, x: 220, y: 120, label: 'Server keys' },
  { id: 2, x: 1180, y: 330, label: 'Office files' },
];

// Green exfil pad, bottom-left lobby.
export const EXFIL = { x: 70, y: 540, w: 130, h: 110 };

// Where the thief slips in.
export const PLAYER_START = { x: 120, y: 450 };

// Four patrol loops, each a closed list of waypoints.
export const GUARDS = [
  {
    name: 'Hall West',
    waypoints: [
      { x: 560, y: 480 },
      { x: 860, y: 480 },
      { x: 860, y: 620 },
      { x: 560, y: 620 },
    ],
  },
  {
    name: 'Hall East',
    waypoints: [
      { x: 960, y: 480 },
      { x: 1400, y: 480 },
      { x: 1400, y: 620 },
      { x: 960, y: 620 },
    ],
  },
  {
    name: 'Office',
    waypoints: [
      { x: 620, y: 160 },
      { x: 1240, y: 160 },
      { x: 1240, y: 360 },
      { x: 620, y: 360 },
    ],
  },
  {
    name: 'Vault Watch',
    waypoints: [
      { x: 1560, y: 360 },
      { x: 1800, y: 360 },
      { x: 1800, y: 640 },
      { x: 1560, y: 640 },
    ],
  },
];

// Everything that stops a body, and everything that stops an eye.
export function solidRects() {
  const out = [];
  for (const r of WALLS) out.push({ x: r.x, y: r.y, w: r.w, h: r.h });
  for (const r of COVER) out.push({ x: r.x, y: r.y, w: r.w, h: r.h });
  for (const r of PROPS) out.push({ x: r.x, y: r.y, w: r.w, h: r.h });
  return out;
}

export function sightBlockers() {
  const out = [];
  for (const r of WALLS) out.push({ x: r.x, y: r.y, w: r.w, h: r.h });
  for (const r of COVER) out.push({ x: r.x, y: r.y, w: r.w, h: r.h });
  return out;
}
