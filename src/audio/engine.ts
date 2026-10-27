import type { AudioSettings } from '../game/types';
import type { SoundId } from './soundMap';

/**
 * Web Audio engine. All sounds are synthesized in code (no audio files, no
 * licensing). Browsers only allow audio after a user gesture, so the
 * context is created/resumed by `unlock()` on the first click or key press.
 * Every method is safe to call when Web Audio is unavailable (it no-ops).
 */

type Ctx = AudioContext;

interface ToneOptions {
  type?: OscillatorType;
  freq: number;
  /** Optional end frequency (exponential glide). */
  to?: number;
  at: number;
  dur: number;
  vol: number;
  attack?: number;
  dest?: AudioNode;
}

interface NoiseOptions {
  at: number;
  dur: number;
  vol: number;
  filter?: BiquadFilterType;
  freq?: number;
  to?: number;
  q?: number;
  attack?: number;
  dest?: AudioNode;
}

class AudioEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private settings: AudioSettings = { master: 0.8, music: 0.35, sfx: 0.8, muted: false };
  private lastPlayed = new Map<SoundId, number>();

  get context(): Ctx | null {
    return this.ctx;
  }

  get musicOutput(): GainNode | null {
    return this.musicBus;
  }

  get isRunning(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Creates (if needed) and resumes the audio context. Call from a user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        this.ctx = ctx;
        this.master = ctx.createGain();
        // A gentle compressor keeps overlapping sounds from clipping.
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        this.master.connect(comp).connect(ctx.destination);
        this.sfxBus = ctx.createGain();
        this.musicBus = ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus.connect(this.master);
        this.applyVolumes();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (e) {
      console.warn('[virtual-pets-3d] Audio unavailable:', e);
      this.ctx = null;
    }
  }

  /** Pauses all audio processing (e.g. when the tab is hidden). */
  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setSettings(s: AudioSettings): void {
    this.settings = s;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return;
    const t = this.ctx.currentTime;
    const m = this.settings.muted ? 0 : this.settings.master;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.settings.music, t, 0.2);
  }

  private noise(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.noiseBuffer) {
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  /** Low-level helpers, also used by the music player. */
  tone(o: ToneOptions): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, o.at);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), o.at + o.dur);
    const attack = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, o.at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), o.at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
    osc.connect(g).connect(o.dest ?? this.sfxBus!);
    osc.start(o.at);
    osc.stop(o.at + o.dur + 0.05);
  }

  noiseBurst(o: NoiseOptions): void {
    const ctx = this.ctx;
    const buffer = this.noise();
    if (!ctx || !buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter ?? 'bandpass';
    filter.frequency.setValueAtTime(o.freq ?? 1000, o.at);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, o.at + o.dur);
    filter.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const attack = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, o.at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), o.at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
    src.connect(filter).connect(g).connect(o.dest ?? this.sfxBus!);
    src.start(o.at, Math.random() * 1.5);
    src.stop(o.at + o.dur + 0.05);
  }

  /** Plays a sound effect. `pitch` scales the main frequencies (1 = normal). */
  play(id: SoundId, pitch = 1): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.settings.muted) return;
    // Avoid machine-gun repeats of the same sound.
    const nowMs = performance.now();
    const minGap = id === 'catch' || id === 'click' ? 40 : 120;
    if (nowMs - (this.lastPlayed.get(id) ?? -1e9) < minGap) return;
    this.lastPlayed.set(id, nowMs);
    const t = ctx.currentTime + 0.01;
    const p = pitch;

    switch (id) {
      case 'click':
        this.tone({ freq: 900, to: 600, at: t, dur: 0.05, vol: 0.06 });
        break;
      case 'coin':
        this.tone({ type: 'triangle', freq: 988, at: t, dur: 0.08, vol: 0.12 });
        this.tone({ type: 'triangle', freq: 1319, at: t + 0.07, dur: 0.22, vol: 0.12 });
        break;
      case 'xp':
        this.tone({ freq: 1200, to: 1800, at: t, dur: 0.14, vol: 0.05 });
        break;
      case 'levelUp':
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', freq: f, at: t + i * 0.09, dur: 0.3, vol: 0.12 }));
        this.tone({ freq: 2093, at: t + 0.4, dur: 0.6, vol: 0.05, attack: 0.05 });
        break;
      case 'eat':
        for (let i = 0; i < 8; i++) {
          this.noiseBurst({ at: t + 0.35 + i * 0.28 + Math.random() * 0.06, dur: 0.06, vol: 0.22, freq: 1600 + Math.random() * 900, q: 1.2 });
        }
        break;
      case 'drink':
        for (let i = 0; i < 8; i++) {
          const at = t + 0.4 + i * 0.26;
          this.tone({ freq: 260, to: 620, at, dur: 0.08, vol: 0.07 });
          this.noiseBurst({ at, dur: 0.06, vol: 0.05, filter: 'lowpass', freq: 900 });
        }
        break;
      case 'bath':
        for (let i = 0; i < 16; i++) {
          const f = 380 + Math.random() * 600;
          this.tone({ freq: f, to: f * 1.9, at: t + Math.random() * 3, dur: 0.06, vol: 0.06 });
        }
        this.noiseBurst({ at: t, dur: 3, vol: 0.03, filter: 'lowpass', freq: 600, attack: 0.4 });
        break;
      case 'purr': {
        // Low noise, amplitude-modulated ~24 Hz like a purr.
        const buffer = this.noise();
        if (!buffer) break;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 220;
        const am = ctx.createGain();
        am.gain.value = 0.5;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 24;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.5;
        lfo.connect(lfoGain).connect(am.gain);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.5, t + 0.25);
        env.gain.setValueAtTime(0.5, t + 1.2);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
        src.connect(lp).connect(am).connect(env).connect(this.sfxBus!);
        src.start(t);
        lfo.start(t);
        src.stop(t + 1.9);
        lfo.stop(t + 1.9);
        break;
      }
      case 'meow': {
        // Sawtooth through a vowel-like band-pass, rising then falling.
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(520 * p, t);
        osc.frequency.linearRampToValueAtTime(820 * p, t + 0.18);
        osc.frequency.linearRampToValueAtTime(560 * p, t + 0.5);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 4;
        bp.frequency.setValueAtTime(900, t);
        bp.frequency.linearRampToValueAtTime(1600, t + 0.2);
        bp.frequency.linearRampToValueAtTime(1000, t + 0.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        osc.connect(bp).connect(g).connect(this.sfxBus!);
        osc.start(t);
        osc.stop(t + 0.6);
        break;
      }
      case 'bark':
        [0, 0.22].forEach((d) => {
          this.tone({ type: 'sawtooth', freq: 420 * p, to: 180 * p, at: t + d, dur: 0.14, vol: 0.09 });
          this.noiseBurst({ at: t + d, dur: 0.1, vol: 0.12, freq: 900, q: 1.5 });
        });
        break;
      case 'happyDog':
        this.tone({ freq: 700, to: 1050, at: t, dur: 0.22, vol: 0.05 });
        this.tone({ freq: 1000, to: 760, at: t + 0.22, dur: 0.2, vol: 0.04 });
        [0.5, 0.75, 1.0].forEach((d) => this.noiseBurst({ at: t + d, dur: 0.12, vol: 0.06, filter: 'highpass', freq: 1800 }));
        break;
      case 'sleep':
        this.tone({ freq: 660, to: 440, at: t, dur: 0.6, vol: 0.05, attack: 0.05 });
        this.tone({ freq: 520, to: 330, at: t + 0.35, dur: 0.8, vol: 0.04, attack: 0.05 });
        break;
      case 'wake':
        this.tone({ freq: 440, to: 880, at: t, dur: 0.25, vol: 0.07 });
        this.tone({ freq: 660, to: 1320, at: t + 0.18, dur: 0.25, vol: 0.05 });
        break;
      case 'refuse':
        this.tone({ type: 'triangle', freq: 300, at: t, dur: 0.12, vol: 0.09 });
        this.tone({ type: 'triangle', freq: 220, at: t + 0.12, dur: 0.18, vol: 0.09 });
        break;
      case 'sneeze':
        this.tone({ freq: 500, to: 820, at: t, dur: 0.3, vol: 0.04, attack: 0.1 });
        this.noiseBurst({ at: t + 0.33, dur: 0.2, vol: 0.28, freq: 3200, to: 1800, q: 0.8 });
        break;
      case 'cured':
        [1047, 1568, 2093].forEach((f, i) => this.tone({ type: 'triangle', freq: f, at: t + i * 0.12, dur: 0.5, vol: 0.08 }));
        break;
      case 'warning':
        this.tone({ freq: 880, at: t, dur: 0.12, vol: 0.06 });
        this.tone({ freq: 660, at: t + 0.14, dur: 0.16, vol: 0.06 });
        break;
      case 'catch':
        this.tone({ freq: 660 * p, at: t, dur: 0.12, vol: 0.1 });
        this.tone({ type: 'triangle', freq: 1320 * p, at: t, dur: 0.08, vol: 0.04 });
        break;
      case 'golden':
        [1047, 1319, 1568, 2093].forEach((f, i) => this.tone({ freq: f, at: t + i * 0.05, dur: 0.18, vol: 0.09 }));
        break;
      case 'hazard':
        this.tone({ type: 'square', freq: 180, to: 90, at: t, dur: 0.25, vol: 0.06 });
        break;
      case 'miss':
        this.tone({ freq: 220, to: 130, at: t, dur: 0.14, vol: 0.05 });
        break;
      case 'countdown':
        this.tone({ freq: 660, at: t, dur: 0.14, vol: 0.1 });
        break;
      case 'go':
        this.tone({ freq: 990, at: t, dur: 0.35, vol: 0.12 });
        this.tone({ type: 'triangle', freq: 1980, at: t, dur: 0.25, vol: 0.04 });
        break;
      case 'gameOver':
        [523, 659, 784].forEach((f) => this.tone({ type: 'triangle', freq: f, at: t, dur: 0.8, vol: 0.07, attack: 0.02 }));
        this.tone({ type: 'triangle', freq: 1047, at: t + 0.25, dur: 0.9, vol: 0.08 });
        break;
      case 'daily':
        for (let i = 0; i < 5; i++) {
          this.tone({ type: 'triangle', freq: 988 + i * 60, at: t + i * 0.08, dur: 0.08, vol: 0.09 });
          this.tone({ type: 'triangle', freq: 1319 + i * 60, at: t + i * 0.08 + 0.06, dur: 0.16, vol: 0.09 });
        }
        break;
      case 'grow':
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone({ freq: f, at: t + i * 0.07, dur: 0.35, vol: 0.03 }));
        this.noiseBurst({ at: t, dur: 1.2, vol: 0.03, filter: 'highpass', freq: 6000, attack: 0.3 });
        break;
      case 'adopt':
        this.tone({ type: 'triangle', freq: 784, at: t, dur: 0.18, vol: 0.09 });
        this.tone({ type: 'triangle', freq: 1047, at: t + 0.16, dur: 0.35, vol: 0.09 });
        break;
    }
  }
}

export const audio = new AudioEngine();

/** Last vocal sound (meow, bark...) and when it was requested, so the pet's mouth can move with it. */
let lastVocal = { id: '', at: -1e9 };
const VOCAL: ReadonlySet<string> = new Set(['meow', 'bark', 'happyDog']);

export function getLastVocal(): { id: string; at: number } {
  return lastVocal;
}

export function playSound(id: SoundId | null, pitch = 1): void {
  if (!id) return;
  // Recorded even when muted: the animation does not depend on the audio.
  if (VOCAL.has(id)) lastVocal = { id, at: performance.now() };
  audio.play(id, pitch);
}
