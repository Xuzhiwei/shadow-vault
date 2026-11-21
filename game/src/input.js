// Shadow Vault — input. WASD or arrows to move, Shift to sneak, E to pick
// up, G to throw a decoy, P or Escape to pause, M to mute, Enter or click to
// confirm on the menus. Keys are edge-triggered for actions, level-triggered
// for movement, so holding a key never double-fires a throw.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_PICKUP = 4;
export const ACTION_DECOY = 8;
export const ACTION_MUTE = 16;

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let clickPos = null;

  function keyDown(event) {
    const key = event.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    const k = key.toLowerCase();
    held.add(k);
    if (key === 'Enter' || key === ' ') queued |= ACTION_CONFIRM;
    else if (k === 'p' || key === 'Escape') queued |= ACTION_PAUSE;
    else if (k === 'e') queued |= ACTION_PICKUP;
    else if (k === 'g') queued |= ACTION_DECOY;
    else if (k === 'm') queued |= ACTION_MUTE;
  }

  function keyUp(event) {
    held.delete(event.key.toLowerCase());
  }

  function blur() {
    held.clear();
  }

  function pointer(event) {
    const rect = canvas.getBoundingClientRect();
    clickPos = {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
    queued |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  canvas.addEventListener('pointerdown', pointer);

  return {
    /** Normalised movement vector from the keys currently held. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (held.has('a') || held.has('arrowleft')) x -= 1;
      if (held.has('d') || held.has('arrowright')) x += 1;
      if (held.has('w') || held.has('arrowup')) y -= 1;
      if (held.has('s') || held.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    sneaking() {
      return held.has('shift');
    },
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
    /** Put edge-triggered bits back: an action pressed while its screen
     * cannot use it (title, pause, end screens) is kept, not eaten. */
    requeue(actions) {
      queued |= actions;
    },
    takeClick() {
      const pos = clickPos;
      clickPos = null;
      return pos;
    },
  };
}
