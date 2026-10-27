import { audio } from './engine';
import { arpeggioNote, chordNotes, GAME_PROGRESSION, HOME_PROGRESSION, midiToFreq, type Chord } from './theory';

/**
 * Generative background music using a look-ahead scheduler: every 100 ms
 * it schedules the notes of the next ~0.3 s on the audio clock, so timing
 * stays steady even if the main thread is busy.
 */

export type MusicMode = 'home' | 'game';

interface Style {
  bpm: number;
  progression: Chord[];
  /** Probability that an eighth note plays an arpeggio pluck. */
  arpDensity: number;
  pad: boolean;
  kick: boolean;
}

const STYLES: Record<MusicMode, Style> = {
  home: { bpm: 68, progression: HOME_PROGRESSION, arpDensity: 0.55, pad: true, kick: false },
  game: { bpm: 124, progression: GAME_PROGRESSION, arpDensity: 0.9, pad: false, kick: true },
};

const LOOKAHEAD_S = 0.3;
const TICK_MS = 100;
const STEPS_PER_BAR = 8;

class MusicPlayer {
  private mode: MusicMode | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;

  get current(): MusicMode | null {
    return this.mode;
  }

  start(mode: MusicMode): void {
    const ctx = audio.context;
    if (!ctx) return;
    if (this.mode === mode && this.timer !== null) return;
    this.mode = mode;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.15;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.mode = null;
  }

  private schedule(): void {
    const ctx = audio.context;
    const out = audio.musicOutput;
    if (!ctx || !out || !this.mode || ctx.state !== 'running') return;
    const style = STYLES[this.mode];
    const stepDur = 60 / style.bpm / 2; // eighth notes
    // If we fell behind (tab was hidden), skip ahead instead of bursting notes.
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(style, this.step, this.nextTime, stepDur, out);
      this.nextTime += stepDur;
      this.step += 1;
    }
  }

  private playStep(style: Style, step: number, at: number, stepDur: number, out: AudioNode): void {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const inBar = step % STEPS_PER_BAR;
    const chord = style.progression[bar % style.progression.length];
    const barDur = stepDur * STEPS_PER_BAR;

    if (inBar === 0) {
      if (style.pad) {
        for (const n of chordNotes(chord)) {
          audio.tone({ type: 'triangle', freq: midiToFreq(n), at, dur: barDur * 1.1, vol: 0.035, attack: 0.6, dest: out });
        }
      }
      // Bass on the downbeat.
      audio.tone({ freq: midiToFreq(chord.root - 12), at, dur: barDur * 0.9, vol: 0.08, attack: 0.02, dest: out });
    }
    if (style.kick && inBar % 2 === 0) {
      audio.tone({ freq: 120, to: 45, at, dur: 0.18, vol: 0.12, dest: out });
    }
    if (Math.random() < style.arpDensity) {
      const n = arpeggioNote(chord, step);
      audio.tone({
        type: style.kick ? 'triangle' : 'sine',
        freq: midiToFreq(n),
        at,
        dur: style.kick ? stepDur * 1.5 : stepDur * 3,
        vol: style.kick ? 0.045 : 0.04,
        dest: out,
      });
    }
  }
}

export const music = new MusicPlayer();
