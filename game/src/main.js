// Shadow Vault — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between five screens: title, play, paused, won and caught.
//
// ?shot=start|play|end stages that scene instead of running the loop, paints
// it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_DECOY, EVENT_PICKUP, EVENT_STEP, EVENT_SUSPICIOUS, EVENT_WON } from './world.js';
import { ACTION_CONFIRM, ACTION_DECOY, ACTION_MUTE, ACTION_PAUSE, ACTION_PICKUP, createInput } from './input.js';
import { createSound } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const sound = createSound();
// A handle for play-testing and debugging from the browser console.
window.__shadowVault = world;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time then lasts one visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.state.phase = 'play';
    accumulator = 0;
    screen = SCREEN_PLAY;
    sound.unlock();
    announce('Playing. Steal 3 intel, then reach the exfil pad.');
  }

  function endGame(won) {
    if (won) {
      screen = SCREEN_WON;
      if (best === 0 || world.state.winTime < best) {
        best = Math.floor(world.state.winTime);
        saveBest(best);
      }
      sound.win();
      announce(`Clean getaway in ${Math.floor(world.state.winTime)} seconds.`);
    } else {
      screen = SCREEN_CAUGHT;
      sound.caught();
      announce('Caught. Press Enter to try again.');
    }
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) sound.pickup();
    if (events & EVENT_DECOY) sound.decoy();
    if (events & EVENT_STEP) sound.step(input.sneaking());
    if (events & EVENT_SUSPICIOUS) {
      sound.suspicious();
      announce('A guard is suspicious — break line of sight.');
    }
    if (events & EVENT_ALARM) {
      sound.alarm();
      announce('ALERTED — a guard is chasing you!');
    }
    if (events & EVENT_WON) endGame(true);
    else if (events & EVENT_CAUGHT) endGame(false);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      sound.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_WON || screen === SCREEN_CAUGHT) {
        startGame();
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    // Pick up / throw only work while playing: an E or G pressed on a menu
    // or during a transition is kept for the next play frame, not eaten.
    if (screen !== SCREEN_PLAY) {
      input.requeue(actions & (ACTION_PICKUP | ACTION_DECOY));
    }
    return actions;
  }

  function stepGame(actions) {
    const move = input.moveVector();
    const events = world.step(STEP, {
      mx: move.x,
      my: move.y,
      sneaking: input.sneaking(),
      pickup: Boolean(actions & ACTION_PICKUP),
      decoy: Boolean(actions & ACTION_DECOY),
    }, false);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { mx: 0, my: 0, sneaking: false, pickup: false, decoy: false }, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        // Edge-triggered actions (pickup, decoy) fire on the first sub-step
        // only, so one key press is never spent twice in a slow frame.
        stepGame(firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Shadow Vault. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
