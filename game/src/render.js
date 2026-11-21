// Shadow Vault — the painter. One canvas, one fixed 1280x480 frame, the whole
// 1920x720 facility scaled to fit: floor tiles, walls, crates, desks, server
// racks, glowing intel, the green exfil pad, vision cones carved by cover,
// the thief, the guards, the HUD and the title / win / caught screens.
import { VIEW, WORLD } from './config.js';
import { COVER, EXFIL, PROPS, WALLS } from './level.js';
import { MODE_CHASE, MODE_INVESTIGATE, overallAlert } from './world.js';
import { coneFan } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WON = 'won';
export const SCREEN_CAUGHT = 'caught';

const SCALE = VIEW.width / WORLD.width;
const TILE = 60;

function hashTile(tx, ty) {
  const s = Math.sin(tx * 12.9898 + ty * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ratingFor(time, detections) {
  if (detections === 0 && time < 180) return 'S — GHOST';
  if (detections <= 1 && time < 260) return 'A — SHADOW';
  if (detections <= 3) return 'B — PROWLER';
  return 'C — LOUD';
}

export function createRenderer(canvas) {
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext('2d');

  function drawFloor(time) {
    ctx.fillStyle = '#14161d';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    for (let ty = 0; ty < WORLD.height / TILE; ty += 1) {
      for (let tx = 0; tx < WORLD.width / TILE; tx += 1) {
        const h = hashTile(tx, ty);
        const x = tx * TILE * SCALE;
        const y = ty * TILE * SCALE;
        const s = TILE * SCALE;
        ctx.fillStyle = h < 0.5 ? '#171a22' : '#191d27';
        ctx.fillRect(x, y, s, s);
        // Zone tints: server room cool blue, vault warm amber, lobby faint green.
        if (tx * TILE < 444 && ty * TILE < 304) ctx.fillStyle = 'rgba(46, 92, 140, 0.10)';
        else if (tx * TILE >= 1500 && ty * TILE < 324) ctx.fillStyle = 'rgba(190, 140, 50, 0.08)';
        else if (tx * TILE < 444 && ty * TILE >= 500) ctx.fillStyle = 'rgba(46, 160, 90, 0.05)';
        else ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(x, y, s, s);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.strokeRect(x + 0.5, y + 0.5, s, s);
      }
    }
    // Room labels, etched on the floor.
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(200, 210, 230, 0.20)';
    ctx.textAlign = 'left';
    ctx.fillText('SERVER ROOM', 60 * SCALE, 300 * SCALE);
    ctx.fillText('THE VAULT', 1620 * SCALE, 330 * SCALE);
    ctx.fillText('OFFICES', 780 * SCALE, 130 * SCALE);
    ctx.fillText('LOBBY', 60 * SCALE, 500 * SCALE);
    void time;
  }

  function drawWalls(walls) {
    for (const w of walls) {
      const x = w.x * SCALE;
      const y = w.y * SCALE;
      const ww = w.w * SCALE;
      const hh = w.h * SCALE;
      ctx.fillStyle = '#2c3140';
      ctx.fillRect(x, y, ww, hh);
      ctx.fillStyle = '#454d63';
      ctx.fillRect(x, y, ww, Math.max(2, 3 * SCALE));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(x, y + hh - Math.max(2, 3 * SCALE), ww, Math.max(2, 3 * SCALE));
    }
  }

  function drawCover(cover) {
    for (const c of cover) {
      const x = c.x * SCALE;
      const y = c.y * SCALE;
      const w = c.w * SCALE;
      const h = c.h * SCALE;
      if (c.kind === 'crate') {
        ctx.fillStyle = '#6b4f2a';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#8a6a3c';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.moveTo(x + w, y);
        ctx.lineTo(x, y + h);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 220, 150, 0.12)';
        ctx.fillRect(x, y, w, 4);
      } else if (c.kind === 'pillar') {
        ctx.fillStyle = '#3a4054';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#565e78';
        ctx.fillRect(x - 2, y - 2, w + 4, 5);
        ctx.fillRect(x - 2, y + h - 3, w + 4, 5);
      } else if (c.kind === 'rack') {
        ctx.fillStyle = '#1d2333';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#2c3550';
        ctx.fillRect(x, y, w, 5);
        for (let i = 0; i < 5; i += 1) {
          const lx = x + 6 + i * ((w - 12) / 5);
          const blink = (Math.floor(performance.now() / 500) + i) % 3 === 0;
          ctx.fillStyle = blink ? '#37e08a' : '#1f6b46';
          ctx.fillRect(lx, y + h / 2 - 2, 4, 4);
        }
      }
    }
  }

  function drawProps(props) {
    for (const p of props) {
      const x = p.x * SCALE;
      const y = p.y * SCALE;
      const w = p.w * SCALE;
      const h = p.h * SCALE;
      if (p.kind === 'desk') {
        ctx.fillStyle = '#4a3826';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#5d4830';
        ctx.fillRect(x, y, w, 6);
        // Monitor glow.
        ctx.fillStyle = 'rgba(120, 200, 255, 0.5)';
        ctx.fillRect(x + w * 0.35, y + h * 0.2, w * 0.3, h * 0.45);
        ctx.fillStyle = '#222';
        ctx.fillRect(x + w * 0.4, y + h * 0.65, 3, h * 0.2);
      } else if (p.kind === 'plant') {
        ctx.fillStyle = '#274d2d';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, w * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3f7a44';
        ctx.beginPath();
        ctx.arc(x + w / 2 - 3, y + h / 2 - 3, w * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5da864';
        ctx.beginPath();
        ctx.arc(x + w / 2 - 4, y + h / 2 - 5, w * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPatrolPaths(guards) {
    ctx.save();
    ctx.strokeStyle = 'rgba(150, 170, 210, 0.10)';
    ctx.setLineDash([2, 7]);
    ctx.lineWidth = 1.5;
    for (const g of guards) {
      ctx.beginPath();
      g.waypoints.forEach((wp, i) => {
        const x = wp.x * SCALE;
        const y = wp.y * SCALE;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawExfil(time) {
    const pulse = 0.55 + 0.3 * Math.sin(time * 3);
    const x = EXFIL.x * SCALE;
    const y = EXFIL.y * SCALE;
    const w = EXFIL.w * SCALE;
    const h = EXFIL.h * SCALE;
    ctx.fillStyle = `rgba(34, 197, 94, ${0.16 + pulse * 0.12})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = `rgba(74, 222, 128, ${0.7 + pulse * 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.setLineDash([]);
    ctx.fillStyle = '#4ade80';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXFIL', x + w / 2, y + h / 2 - 6);
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(220, 255, 230, 0.85)';
    ctx.fillText('EXIT UNSEEN', x + w / 2, y + h / 2 + 12);
    // Animated chevrons pointing out.
    const off = (time * 26) % 18;
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i += 1) {
      const cx = x + 12 + off + i * 18;
      ctx.beginPath();
      ctx.moveTo(cx, y + h - 14);
      ctx.lineTo(cx + 7, y + h - 22);
      ctx.lineTo(cx, y + h - 30);
      ctx.stroke();
    }
  }

  function drawIntel(state, time) {
    for (const item of state.intel) {
      if (item.taken) continue;
      const x = item.x * SCALE;
      const y = item.y * SCALE;
      const pulse = 0.6 + 0.4 * Math.sin(time * 4 + item.id * 2);
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 34);
      glow.addColorStop(0, `rgba(34, 211, 238, ${0.5 * pulse})`);
      glow.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 34, 0, Math.PI * 2);
      ctx.fill();
      // Floating diamond marker.
      const bob = Math.sin(time * 3 + item.id) * 3;
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(x, y - 26 + bob);
      ctx.lineTo(x + 7, y - 18 + bob);
      ctx.lineTo(x, y - 10 + bob);
      ctx.lineTo(x - 7, y - 18 + bob);
      ctx.closePath();
      ctx.fill();
      // The case itself.
      ctx.fillStyle = '#0e7490';
      ctx.fillRect(x - 11, y - 8, 22, 16);
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(x - 11, y - 8, 22, 4);
      ctx.fillStyle = '#a5f3fc';
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
  }

  function drawDecoys(state) {
    for (const d of state.decoys) {
      const x = d.x * SCALE;
      const y = d.y * SCALE;
      if (!d.flying) {
        const ring = ((performance.now() / 450) % 1) * 26;
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 8 + ring, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCones(state, time) {
    void time;
    const blockers = [...WALLS, ...COVER];
    for (const guard of state.guards) {
      const fan = coneFan(guard, blockers);
      const base = guard.mode === MODE_CHASE
        ? '239, 68, 68'
        : guard.mode === MODE_INVESTIGATE
          ? '249, 115, 22'
          : '250, 204, 21';
      const alpha = guard.mode === MODE_CHASE ? 0.34 : guard.mode === MODE_INVESTIGATE ? 0.28 : 0.2;
      const grad = ctx.createRadialGradient(
        guard.x * SCALE, guard.y * SCALE, 8,
        guard.x * SCALE, guard.y * SCALE, 275 * SCALE,
      );
      grad.addColorStop(0, `rgba(${base}, ${alpha})`);
      grad.addColorStop(1, `rgba(${base}, ${alpha * 0.25})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(guard.x * SCALE, guard.y * SCALE);
      for (const pt of fan) ctx.lineTo(pt.x * SCALE, pt.y * SCALE);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(${base}, 0.35)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawGuard(guard, time) {
    const x = guard.x * SCALE;
    const y = guard.y * SCALE;
    const r = guard.radius * SCALE;
    // Alert ring above the head while the meter is up.
    if (guard.alert > 0.05) {
      ctx.strokeStyle = guard.mode === MODE_CHASE ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 7, -Math.PI / 2, -Math.PI / 2 + guard.alert * Math.PI * 2);
      ctx.stroke();
    }
    // Body: dark uniform, red trim.
    ctx.fillStyle = '#1f2433';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = guard.mode === MODE_CHASE ? '#ef4444' : '#7c2d2d';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facing wedge / visor.
    ctx.fillStyle = guard.mode === MODE_CHASE ? '#ef4444' : guard.mode === MODE_INVESTIGATE ? '#f59e0b' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, guard.facing - 0.5, guard.facing + 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.arc(x + Math.cos(guard.facing) * r * 0.45, y + Math.sin(guard.facing) * r * 0.45, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // "?" while suspicious, "!" while chasing.
    if (guard.mode === MODE_INVESTIGATE || guard.mode === MODE_CHASE) {
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = guard.mode === MODE_CHASE ? '#ef4444' : '#f59e0b';
      ctx.fillText(guard.mode === MODE_CHASE ? '!' : '?', x, y - r - 8);
    }
    void time;
  }

  function drawPlayer(player, time) {
    const x = player.x * SCALE;
    const y = player.y * SCALE;
    const r = player.radius * SCALE * (player.sneaking ? 0.85 : 1);
    // Soft personal light.
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 46);
    glow.addColorStop(0, 'rgba(45, 212, 191, 0.20)');
    glow.addColorStop(1, 'rgba(45, 212, 191, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 46, 0, Math.PI * 2);
    ctx.fill();
    // Cloak: teal body with a darker hood.
    ctx.fillStyle = '#0d9488';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#134e4a';
    ctx.beginPath();
    ctx.arc(x + Math.cos(player.facing) * r * 0.3, y + Math.sin(player.facing) * r * 0.3, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // Eyes / direction tick.
    ctx.fillStyle = '#ccfbf1';
    ctx.beginPath();
    ctx.arc(x + Math.cos(player.facing) * r * 0.62, y + Math.sin(player.facing) * r * 0.62, 2.5, 0, Math.PI * 2);
    ctx.fill();
    if (player.sneaking) {
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.6)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    void time;
  }

  function drawLighting(time) {
    void time;
    const edge = ctx.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.42,
      VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.62,
    );
    edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edge.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawHud(state, screen) {
    const alert = overallAlert(state);
    // Top bar.
    ctx.fillStyle = 'rgba(8, 10, 16, 0.82)';
    ctx.fillRect(0, 0, VIEW.width, 44);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, 44, VIEW.width, 1);
    ctx.textAlign = 'left';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('SHADOW VAULT', 14, 19);
    // Alert word + meter.
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = alert.level === 2 ? '#ef4444' : alert.level === 1 ? '#f59e0b' : '#4ade80';
    ctx.fillText(alert.word, 168, 19);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(258, 9, 120, 10);
    ctx.fillStyle = alert.level === 2 ? '#ef4444' : alert.level === 1 ? '#f59e0b' : '#4ade80';
    ctx.fillRect(258, 9, 120 * Math.max(alert.value, alert.level === 2 ? 1 : 0), 10);
    // Intel pips.
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('INTEL', 420, 19);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < state.collected ? '#22d3ee' : 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.arc(478 + i * 24, 14, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // Decoys + timer, right side.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`DECOYS ${state.decoysLeft}`, 1000, 19);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`TIME ${fmtTime(state.time)}`, 1130, 19);
    ctx.fillStyle = '#64748b';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('M mute', 1258, 19);
    // Bottom hint bar.
    if (screen === SCREEN_PLAY) {
      ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
      ctx.fillRect(0, VIEW.height - 30, VIEW.width, 30);
      ctx.textAlign = 'center';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(state.hint, VIEW.width / 2, VIEW.height - 11);
    }
  }

  function dim() {
    ctx.fillStyle = 'rgba(4, 6, 12, 0.66)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10, 13, 22, 0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawTitle(state, best) {
    dim();
    panel(330, 56, 620, 368);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5eead4';
    ctx.font = '700 46px system-ui, sans-serif';
    ctx.fillText('SHADOW VAULT', 640, 128);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('A top-down stealth job — steal three intel cases and slip out unseen.', 640, 160);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 14px system-ui, sans-serif';
    ctx.fillText('Four guards walk the floor. Their cones are their eyes: stay out of the', 640, 192);
    ctx.fillText('yellow, break line of sight behind crates, and throw a decoy to pull', 640, 212);
    ctx.fillText('them away. Get caught, and the job is over.', 640, 232);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 14px system-ui, sans-serif';
    const lines = [
      'WASD / Arrows — move        Shift — sneak (slow, quiet)',
      'E — steal intel        G — throw a noisemaker decoy',
      'P — pause        M — mute',
    ];
    lines.forEach((line, i) => ctx.fillText(line, 640, 272 + i * 22));
    ctx.fillStyle = '#5eead4';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText('— PRESS ENTER OR CLICK TO START —', 640, 362);
    if (best > 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText(`Best escape: ${fmtTime(best)}`, 640, 392);
    }
    void state;
  }

  function drawWon(state) {
    dim();
    panel(380, 96, 520, 288);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4ade80';
    ctx.font = '700 38px system-ui, sans-serif';
    ctx.fillText('CLEAN GETAWAY', 640, 158);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('All three intel cases stolen. Nobody saw a thing —', 640, 196);
    ctx.fillText('or at least, nobody caught you.', 640, 218);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 15px system-ui, sans-serif';
    ctx.fillText(`Escape time  ${fmtTime(state.winTime)}`, 640, 258);
    ctx.fillText(`Times spotted  ${state.detections}`, 640, 282);
    ctx.fillStyle = '#facc15';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(`RATING  ${ratingFor(state.winTime, state.detections)}`, 640, 316);
    ctx.fillStyle = '#5eead4';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText('— PRESS ENTER TO RUN IT AGAIN —', 640, 352);
  }

  function drawCaught(state) {
    dim();
    panel(380, 110, 520, 260);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ef4444';
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.fillText('CAUGHT', 640, 172);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(`${state.caughtBy} guard ran you down in the open.`, 640, 210);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 15px system-ui, sans-serif';
    ctx.fillText('Watch the cones. Break line of sight. Sneak, don’t sprint.', 640, 240);
    ctx.fillText(`Intel stolen: ${state.collected}/3    Time: ${fmtTime(state.time)}`, 640, 266);
    ctx.fillStyle = '#5eead4';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText('— PRESS ENTER TO TRY AGAIN —', 640, 316);
  }

  function drawPaused() {
    dim();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 34px system-ui, sans-serif';
    ctx.fillText('PAUSED', 640, 220);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText('Press P or Enter to keep moving.', 640, 252);
  }

  function draw(state, screen, best) {
    const time = performance.now() / 1000;
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    drawFloor(time);
    drawPatrolPaths(state.guards);
    drawExfil(time);
    drawIntel(state, time);
    drawWalls(WALLS);
    drawCover(COVER);
    drawProps(PROPS);
    drawCones(state, time);
    drawDecoys(state);
    drawPlayer(state.player, time);
    for (const guard of state.guards) drawGuard(guard, time);
    drawLighting(time);
    drawHud(state, screen);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_WON) drawWon(state);
    else if (screen === SCREEN_CAUGHT) drawCaught(state);
    else if (screen === SCREEN_PAUSED) drawPaused();
  }

  return { draw };
}
