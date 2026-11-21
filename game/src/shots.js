// Shadow Vault — the screenshot scenes behind ?shot=start|play|end. Each one
// stages a real frame of the live game, not a mock-up: the title over a
// patrolling floor, a mid-game moment with a cone, cover and the exfil pad
// all in frame, and the win screen after a staged clean getaway.
import { STEP } from './config.js';
import { MODE_INVESTIGATE } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';

const ATTRACT_SECONDS = 5;

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any other name stages the title.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;

  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < ATTRACT_SECONDS / STEP; i += 1) {
      world.step(STEP, { mx: 0, my: 0, sneaking: false, pickup: false, decoy: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'end') {
    // A finished job: all three cases stolen, the thief on the exfil pad.
    for (const item of state.intel) item.taken = true;
    state.collected = 3;
    state.player.x = 135;
    state.player.y = 595;
    state.player.facing = -Math.PI / 2;
    state.phase = 'won';
    state.winTime = 154;
    state.detections = 1;
    state.time = 154;
    return { screen: SCREEN_WON, best: 154 };
  }

  // Play: the thief crouched behind the mid-hall crates, one guard's orange
  // cone sweeping toward them, a decoy pinging nearby, one case already
  // stolen, the green exfil pad waiting bottom-left — the whole facility is
  // in frame, so the cone, the cover and the exit share the shot.
  state.phase = 'play';
  state.player.x = 800;
  state.player.y = 468;
  state.player.facing = -Math.PI / 2;
  state.player.sneaking = true;
  state.collected = 1;
  state.intel[1].taken = true;
  state.decoysLeft = 2;
  state.time = 87;
  state.decoys.push({
    x: 950,
    y: 520,
    tx: 950,
    ty: 520,
    flying: false,
    pingFor: 2.4,
    heard: true,
  });
  const hunter = state.guards[0];
  hunter.x = 700;
  hunter.y = 400;
  hunter.facing = Math.atan2(468 - 400, 800 - 700);
  hunter.mode = MODE_INVESTIGATE;
  hunter.alert = 0.72;
  hunter.investigateX = 800;
  hunter.investigateY = 468;
  hunter.scanFor = 0;
  state.hint = 'A guard is suspicious — break line of sight behind the crates.';
  return { screen: SCREEN_PLAY, best: 0 };
}
