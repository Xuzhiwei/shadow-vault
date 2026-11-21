// Shadow Vault — seeing. A guard's eye is a cone plus a raycast: a segment
// from the guard to the player is clear only when no sight-blocking rectangle
// cuts it. The cone itself is drawn as a fan of short rays so walls and
// crates carve its edge, which is what makes hiding behind cover work.
import { GUARD } from './config.js';

function segmentHitsRect(ax, ay, bx, by, r) {
  // Slab test: does segment AB cross the rectangle?
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  if (Math.abs(dx) < 1e-9) {
    if (ax < r.x || ax > r.x + r.w) return false;
  } else {
    let ta = (r.x - ax) / dx;
    let tb = (r.x + r.w - ax) / dx;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (ay < r.y || ay > r.y + r.h) return false;
  } else {
    let ta = (r.y - ay) / dy;
    let tb = (r.y + r.h - ay) / dy;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** True when nothing between (ax, ay) and (bx, by) blocks sight. */
export function hasLineOfSight(ax, ay, bx, by, blockers) {
  for (const r of blockers) {
    if (segmentHitsRect(ax, ay, bx, by, r)) return false;
  }
  return true;
}

/** Distance from (ax, ay) along a ray until it hits a blocker, capped at max. */
export function rayLength(ax, ay, angle, max, blockers) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = max;
  for (const r of blockers) {
    // Intersect the ray with each of the rectangle's four edges, keep nearest.
    const edges = [
      [r.x, r.y, r.x + r.w, r.y],
      [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
      [r.x + r.w, r.y + r.h, r.x, r.y + r.h],
      [r.x, r.y + r.h, r.x, r.y],
    ];
    for (const [x1, y1, x2, y2] of edges) {
      const ex = x2 - x1;
      const ey = y2 - y1;
      const denom = dx * ey - dy * ex;
      if (Math.abs(denom) < 1e-9) continue;
      const t = ((x1 - ax) * ey - (y1 - ay) * ex) / denom;
      const u = ((x1 - ax) * dy - (y1 - ay) * dx) / denom;
      if (t > 0 && t < best && u >= 0 && u <= 1) best = t;
    }
  }
  return best;
}

/** Is the player inside the guard's cone and in the open? */
export function guardSeesPlayer(guard, player, blockers) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.visionRange) return { seen: false, dist };
  let diff = Math.atan2(dy, dx) - guard.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > GUARD.halfFov) return { seen: false, dist };
  if (!hasLineOfSight(guard.x, guard.y, player.x, player.y, blockers)) {
    return { seen: false, dist };
  }
  return { seen: true, dist };
}

/** Fan of ray lengths across the cone, for drawing the lit wedge. */
export function coneFan(guard, blockers, rays = 26) {
  const points = [];
  for (let i = 0; i <= rays; i += 1) {
    const angle = guard.facing - GUARD.halfFov + (2 * GUARD.halfFov * i) / rays;
    const len = rayLength(guard.x, guard.y, angle, GUARD.visionRange, blockers);
    points.push({ x: guard.x + Math.cos(angle) * len, y: guard.y + Math.sin(angle) * len });
  }
  return points;
}
