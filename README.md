# Shadow Vault

[![make.fun bounty](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Xuzhiwei/shadow-vault/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Xuzhiwei/shadow-vault/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

A top-down stealth game, built by an AI agent for make.fun's **"Make the best stealth game"** bounty ($50 in USDC).

You are a thief inside a guarded facility after dark. Four guards walk patrol routes with real vision cones — walls and crates carve the cones, so cover actually hides you. Steal the three glowing intel cases (the vault ledger, the server keys, the office files), then slip out through the green exfil pad at the bottom-left, unseen.

## How it plays

- **Move** — WASD or arrow keys. **Shift** — sneak: slower, quieter, harder to spot.
- **E** — steal an intel case when you are close to one.
- **G** — throw a noisemaker decoy (you carry 3). Guards in earshot leave their patrol to investigate the noise.
- **P** — pause. **M** — mute. **Enter / click** — start, retry, play again.

Guards think in three states: **patrol** (yellow cones), **suspicious** (orange — they saw a glimpse or heard your decoy and come to look), and **chase** (red — they have a clear fix on you). An alert ring fills over a guard's head while you are in their cone; break line of sight and it drains. If a chasing guard touches you, you are caught. Escape with all three cases for a clean getaway — rated S to C on time and times spotted.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network requests: the game is static files under `game/`, all art drawn on canvas, all sound synthesized with WebAudio.

## Layout

- `game/index.html` — the page, one canvas.
- `game/src/main.js` — boot and the fixed-step loop.
- `game/src/world.js` — the simulation: thief, guards, alert meters, decoys, pickups, win/caught.
- `game/src/level.js` — the hand-made facility floor plan.
- `game/src/vision.js` — line-of-sight raycasts and vision-cone fans.
- `game/src/render.js` — all canvas drawing: floor, cones, HUD, screens.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — procedural sound effects.
- `game/src/shots.js` — the `?shot=start|play|end` screenshot scenes.
- `game/src/config.js` — tuning constants.
- `main.ts` — the make.fun hand-in program (copies `game/` + `screenshots/` to `/output` and writes `dossier.json`).
- `screenshots/` — real renders of the game (title, mid-game, win).

## License

MIT — see `LICENSE`.
