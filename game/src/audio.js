// Shadow Vault — procedural sound. No audio files: every blip, sting and
// jingle is an oscillator shaped in code, so the game stays a few static
// files. The context is created on the first user gesture, as browsers ask.
export function createSound() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, lowpass, delay = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    step(sneaking) {
      noise(0.07, sneaking ? 0.05 : 0.12, sneaking ? 500 : 900);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.5);
      tone(990, 0.18, 'sine', 0.5, null, 0.09);
    },
    decoy() {
      tone(1180, 0.1, 'square', 0.16);
      tone(1180, 0.1, 'square', 0.16, null, 0.22);
    },
    suspicious() {
      tone(392, 0.16, 'triangle', 0.4);
      tone(466, 0.2, 'triangle', 0.4, null, 0.14);
    },
    alarm() {
      tone(220, 0.28, 'sawtooth', 0.4, 440);
      tone(220, 0.28, 'sawtooth', 0.4, 440, 0.26);
    },
    caught() {
      tone(160, 0.7, 'sawtooth', 0.45, 55);
      noise(0.5, 0.2, 300);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'sine', 0.45, null, i * 0.11));
    },
    click() {
      tone(740, 0.06, 'sine', 0.3);
    },
  };
}
