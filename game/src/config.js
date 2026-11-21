// Shadow Vault — tuning constants. One place for every number the rest of the
// game balances against, so difficulty can be tuned without touching logic.
export const WORLD = { width: 1920, height: 720 };
export const VIEW = { width: 1280, height: 480 };
export const STEP = 1 / 60;
export const BEST_KEY = 'shadow-vault-best-time';

export const PLAYER = {
  radius: 13,
  runSpeed: 225,
  sneakSpeed: 112,
  accel: 1800,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 85,
  investigateSpeed: 132,
  chaseSpeed: 196,
  visionRange: 275,
  halfFov: 0.61, // ~35 degrees each side
  catchDistance: 28,
  loseSightSeconds: 2.5,
};

export const ALERT = {
  fillClose: 1.05, // per second, player nearer than 120 px and in the cone
  fillMid: 0.55, // 120–200 px
  fillFar: 0.3, // beyond 200 px
  sneakFactor: 0.5,
  runFactor: 1.4,
  drain: 0.5, // per second while unseen
  suspiciousAt: 0.6,
  chaseAt: 1.0,
};

export const GAME = {
  intelNeeded: 3,
  decoysStart: 3,
  decoyThrow: 190,
  decoyHearRadius: 330,
  decoyPingSeconds: 3,
  pickupRadius: 36,
};
