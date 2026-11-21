// Shadow Vault — the simulation. One fixed step moves the thief, walks the
// guards through patrol → suspicious → chase, fills and drains each guard's
// alert meter, flies thrown decoys, and settles pickups, the win and the
// catch. It knows nothing about drawing or sound: it reports what happened
// as event bits and lets the shell react.
import { ALERT, GAME, GUARD, PLAYER } from './config.js';
import {
  COVER,
  EXFIL,
  GUARDS,
  INTEL,
  PLAYER_START,
  PROPS,
  WALLS,
  sightBlockers,
  solidRects,
} from './level.js';
import { guardSeesPlayer } from './vision.js';

export const EVENT_PICKUP = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_WON = 4;
export const EVENT_ALARM = 8;
export const EVENT_SUSPICIOUS = 16;
export const EVENT_STEP = 32;
export const EVENT_DECOY = 64;

export const MODE_PATROL = 'patrol';
export const MODE_INVESTIGATE = 'investigate';
export const MODE_CHASE = 'chase';

const SOLIDS = solidRects();
const BLOCKERS = sightBlockers();

function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

function blockedAt(x, y, r) {
  for (const rect of SOLIDS) {
    if (circleHitsRect(x, y, r, rect)) return true;
  }
  return false;
}

/** Move a circle with axis-separated sliding along walls and cover. */
function moveBody(body, dx, dy) {
  const nx = body.x + dx;
  if (!blockedAt(nx, body.y, body.radius)) body.x = nx;
  const ny = body.y + dy;
  if (!blockedAt(body.x, ny, body.radius)) body.y = ny;
}

function turnToward(current, target, maxStep) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

function makeGuard(def, index) {
  const first = def.waypoints[0];
  return {
    name: def.name,
    x: first.x,
    y: first.y,
    radius: GUARD.radius,
    facing: Math.PI / 2,
    waypoints: def.waypoints,
    wpIndex: 1 % def.waypoints.length,
    mode: MODE_PATROL,
    alert: 0,
    unseenFor: 0,
    pauseFor: 0,
    scanFor: 0,
    investigateX: first.x,
    investigateY: first.y,
    stuckFor: 0,
    lastDist: Infinity,
    index,
  };
}

export function createWorld() {
  const state = {
    phase: 'title', // title | play | won | caught
    time: 0,
    detections: 0,
    collected: 0,
    decoysLeft: GAME.decoysStart,
    player: {
      x: PLAYER_START.x,
      y: PLAYER_START.y,
      radius: PLAYER.radius,
      facing: Math.PI / 2,
      sneaking: false,
      moving: false,
    },
    guards: GUARDS.map(makeGuard),
    intel: INTEL.map((item) => ({ ...item, taken: false })),
    decoys: [],
    stepAcc: 0,
    hint: '',
    winTime: 0,
    caughtBy: '',
  };

  function reset() {
    state.phase = 'title';
    state.time = 0;
    state.detections = 0;
    state.collected = 0;
    state.decoysLeft = GAME.decoysStart;
    state.player.x = PLAYER_START.x;
    state.player.y = PLAYER_START.y;
    state.player.facing = Math.PI / 2;
    state.player.sneaking = false;
    state.player.moving = false;
    state.guards = GUARDS.map(makeGuard);
    state.intel = INTEL.map((item) => ({ ...item, taken: false }));
    state.decoys = [];
    state.stepAcc = 0;
    state.hint = 'Reach the vault, the servers and the office — unseen.';
    state.winTime = 0;
    state.caughtBy = '';
  }

  function nearestIntel() {
    let best = null;
    let bestDist = Infinity;
    for (const item of state.intel) {
      if (item.taken) continue;
      const d = Math.hypot(item.x - state.player.x, item.y - state.player.y);
      if (d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    return best;
  }

  function updateHint() {
    const p = state.player;
    if (state.collected < GAME.intelNeeded) {
      const item = nearestIntel();
      if (item && Math.hypot(item.x - p.x, item.y - p.y) < GAME.pickupRadius + 14) {
        state.hint = `Press E — steal the ${item.label}.`;
        return;
      }
      state.hint = `Steal the intel: ${state.collected}/${GAME.intelNeeded} — Shift to sneak, G to throw a decoy.`;
      return;
    }
    if (p.x > EXFIL.x && p.x < EXFIL.x + EXFIL.w && p.y > EXFIL.y && p.y < EXFIL.y + EXFIL.h) {
      state.hint = 'Exfiltrating…';
    } else {
      state.hint = 'All intel stolen — reach the green exfil pad, bottom-left.';
    }
  }

  function throwDecoy() {
    if (state.decoysLeft <= 0) return 0;
    const p = state.player;
    const tx = p.x + Math.cos(p.facing) * GAME.decoyThrow;
    const ty = p.y + Math.sin(p.facing) * GAME.decoyThrow;
    state.decoys.push({
      x: p.x,
      y: p.y,
      tx: Math.max(30, Math.min(1890, tx)),
      ty: Math.max(30, Math.min(690, ty)),
      flying: true,
      pingFor: GAME.decoyPingSeconds,
      heard: false,
    });
    state.decoysLeft -= 1;
    return EVENT_DECOY;
  }

  function tryPickup() {
    const p = state.player;
    for (const item of state.intel) {
      if (item.taken) continue;
      if (Math.hypot(item.x - p.x, item.y - p.y) < GAME.pickupRadius) {
        item.taken = true;
        state.collected += 1;
        return EVENT_PICKUP;
      }
    }
    return 0;
  }

  function stepGuard(guard, dt, events, blind) {
    const p = state.player;
    // On the title screen the guards only patrol: no eyes, no alarms.
    if (blind) {
      guard.alert = 0;
      guard.mode = MODE_PATROL;
    }
    const seen = blind
      ? { seen: false, dist: Infinity }
      : guardSeesPlayer(guard, p, BLOCKERS);
    let out = events;

    // Alert meter: fill while the thief is in the cone, drain while hidden.
    if (seen.seen) {
      let rate = seen.dist < 120 ? ALERT.fillClose : seen.dist < 200 ? ALERT.fillMid : ALERT.fillFar;
      if (p.sneaking) rate *= ALERT.sneakFactor;
      else if (p.moving) rate *= ALERT.runFactor;
      guard.alert = Math.min(1, guard.alert + rate * dt);
      guard.investigateX = p.x;
      guard.investigateY = p.y;
      guard.unseenFor = 0;
    } else {
      guard.alert = Math.max(0, guard.alert - ALERT.drain * dt);
      guard.unseenFor += dt;
    }

    if (guard.mode !== MODE_CHASE && guard.alert >= ALERT.chaseAt) {
      guard.mode = MODE_CHASE;
      guard.unseenFor = 0;
      state.detections += 1;
      out |= EVENT_ALARM;
    } else if (guard.mode === MODE_PATROL && guard.alert >= ALERT.suspiciousAt) {
      guard.mode = MODE_INVESTIGATE;
      guard.scanFor = 0;
      guard.stuckFor = 0;
      guard.lastDist = Infinity;
      out |= EVENT_SUSPICIOUS;
    }

    if (guard.mode === MODE_CHASE) {
      if (!seen.seen && guard.unseenFor > GUARD.loseSightSeconds) {
        guard.mode = MODE_INVESTIGATE;
        guard.scanFor = 0;
        guard.stuckFor = 0;
        guard.lastDist = Infinity;
      } else {
        const angle = Math.atan2(p.y - guard.y, p.x - guard.x);
        guard.facing = turnToward(guard.facing, angle, 9 * dt);
        const dist = Math.hypot(p.x - guard.x, p.y - guard.y);
        if (dist >= guard.lastDist - 1) guard.stuckFor += dt;
        else {
          guard.stuckFor = 0;
          guard.lastDist = dist;
        }
        // A guard walled off from the thief gives up the chase rather than
        // shoving at a crate forever: it falls back to searching the last
        // place it saw them.
        if (guard.stuckFor > 1.0) {
          guard.mode = MODE_INVESTIGATE;
          guard.scanFor = 0;
          guard.stuckFor = 0;
          guard.lastDist = Infinity;
          return out;
        }
        moveBody(guard, Math.cos(angle) * GUARD.chaseSpeed * dt, Math.sin(angle) * GUARD.chaseSpeed * dt);
        if (Math.hypot(p.x - guard.x, p.y - guard.y) < GUARD.catchDistance) {
          state.phase = 'caught';
          state.caughtBy = guard.name;
          out |= EVENT_CAUGHT;
        }
      }
      return out;
    }

    if (guard.mode === MODE_INVESTIGATE) {
      const dx = guard.investigateX - guard.x;
      const dy = guard.investigateY - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 18) {
        const angle = Math.atan2(dy, dx);
        guard.facing = turnToward(guard.facing, angle, 7 * dt);
        if (dist >= guard.lastDist - 1) guard.stuckFor += dt;
        else {
          guard.stuckFor = 0;
          guard.lastDist = dist;
        }
        // Same give-up rule as the chase: a blocked guard resumes patrol
        // instead of grinding against an obstacle.
        if (guard.stuckFor > 1.0) {
          guard.mode = MODE_PATROL;
          guard.alert = Math.min(guard.alert, 0.35);
          guard.stuckFor = 0;
          guard.lastDist = Infinity;
          return out;
        }
        moveBody(guard, Math.cos(angle) * GUARD.investigateSpeed * dt, Math.sin(angle) * GUARD.investigateSpeed * dt);
      } else {
        guard.scanFor += dt;
        guard.facing += dt * 1.6;
        if (guard.scanFor > 1.4) {
          guard.mode = MODE_PATROL;
          guard.alert = Math.min(guard.alert, 0.35);
        }
      }
      return out;
    }

    // Patrol: walk the loop, pausing briefly at each waypoint.
    if (guard.pauseFor > 0) {
      guard.pauseFor -= dt;
      return out;
    }
    const target = guard.waypoints[guard.wpIndex];
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
      guard.pauseFor = 0.5;
      return out;
    }
    const angle = Math.atan2(dy, dx);
    guard.facing = turnToward(guard.facing, angle, 7 * dt);
    moveBody(guard, Math.cos(angle) * GUARD.patrolSpeed * dt, Math.sin(angle) * GUARD.patrolSpeed * dt);
    return out;
  }

  /**
   * Advance the world one fixed step.
   * input: {mx, my, sneaking, pickup, decoy} — ignored while attract is true.
   * Returns event bits for this step.
   */
  function step(dt, input, attract) {
    let events = 0;
    const p = state.player;

    if (state.phase === 'play' && !attract) {
      state.time += dt;
      const speed = input.sneaking ? PLAYER.sneakSpeed : PLAYER.runSpeed;
      p.sneaking = input.sneaking;
      p.moving = input.mx !== 0 || input.my !== 0;
      if (p.moving) {
        p.facing = Math.atan2(input.my, input.mx);
        moveBody(p, input.mx * speed * dt, input.my * speed * dt);
        state.stepAcc += speed * dt;
        if (state.stepAcc > 30) {
          state.stepAcc = 0;
          events |= EVENT_STEP;
        }
      }
      if (input.pickup) events |= tryPickup();
      if (input.decoy) events |= throwDecoy();
    }

    // Decoys fly, land, ping, and pull nearby guards over.
    for (let i = state.decoys.length - 1; i >= 0; i -= 1) {
      const d = state.decoys[i];
      if (d.flying) {
        const dx = d.tx - d.x;
        const dy = d.ty - d.y;
        const dist = Math.hypot(dx, dy);
        const hop = 520 * dt;
        if (dist <= hop) {
          d.x = d.tx;
          d.y = d.ty;
          d.flying = false;
        } else {
          d.x += (dx / dist) * hop;
          d.y += (dy / dist) * hop;
        }
      } else {
        d.pingFor -= dt;
        if (!d.heard) {
          d.heard = true;
          for (const guard of state.guards) {
            if (guard.mode === MODE_CHASE) continue;
            if (Math.hypot(guard.x - d.x, guard.y - d.y) < GAME.decoyHearRadius) {
              guard.mode = MODE_INVESTIGATE;
              guard.investigateX = d.x;
              guard.investigateY = d.y;
              guard.scanFor = 0;
              guard.stuckFor = 0;
              guard.lastDist = Infinity;
            }
          }
        }
        if (d.pingFor <= 0) state.decoys.splice(i, 1);
      }
    }

    // Guards see, think and walk — even on the title screen, for a live backdrop.
    for (const guard of state.guards) {
      events = stepGuard(guard, dt, events, attract);
      if (state.phase === 'caught') break;
    }

    if (state.phase === 'play') {
      updateHint();
      if (
        state.collected >= GAME.intelNeeded &&
        p.x > EXFIL.x && p.x < EXFIL.x + EXFIL.w &&
        p.y > EXFIL.y && p.y < EXFIL.y + EXFIL.h
      ) {
        state.phase = 'won';
        state.winTime = state.time;
        events |= EVENT_WON;
      }
    }
    return events;
  }

  reset();
  return { state, reset, step };
}

// Re-exported for the renderer and the shot stager.
export { COVER, EXFIL, INTEL, PROPS, WALLS };
export function overallAlert(state) {
  let worst = 0;
  let mode = MODE_PATROL;
  for (const g of state.guards) {
    if (g.alert > worst) {
      worst = g.alert;
      mode = g.mode;
    }
  }
  if (mode === MODE_CHASE) return { word: 'ALERTED', level: 2, value: worst };
  if (worst >= ALERT.suspiciousAt || mode === MODE_INVESTIGATE) {
    return { word: 'SUSPICIOUS', level: 1, value: worst };
  }
  return { word: 'CALM', level: 0, value: worst };
}
