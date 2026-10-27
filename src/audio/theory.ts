/**
 * Tiny bits of music theory for the generative background music.
 * Pure functions so they can be unit-tested.
 */

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export type ChordQuality = 'major' | 'minor' | 'sus2' | 'maj7' | 'min7';

const INTERVALS: Record<ChordQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  sus2: [0, 2, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
};

export interface Chord {
  root: number;
  quality: ChordQuality;
}

export function chordNotes(chord: Chord): number[] {
  return INTERVALS[chord.quality].map((i) => chord.root + i);
}

/** Calm progression for the room (C - Am - F - G, with color tones). */
export const HOME_PROGRESSION: Chord[] = [
  { root: 60, quality: 'maj7' },
  { root: 57, quality: 'min7' },
  { root: 53, quality: 'maj7' },
  { root: 55, quality: 'sus2' },
];

/** Upbeat progression for the mini-game (F - G - Em - Am). */
export const GAME_PROGRESSION: Chord[] = [
  { root: 53, quality: 'major' },
  { root: 55, quality: 'major' },
  { root: 52, quality: 'minor' },
  { root: 57, quality: 'minor' },
];

/** C major pentatonic notes within [low, high] (MIDI). */
export function pentatonic(low: number, high: number): number[] {
  const steps = [0, 2, 4, 7, 9];
  const out: number[] = [];
  for (let n = low; n <= high; n++) if (steps.includes(((n % 12) + 12) % 12)) out.push(n);
  return out;
}

/**
 * Picks the arpeggio note for an eighth-note step: chord tones one octave up,
 * walking up and down so the melody feels intentional rather than random.
 */
export function arpeggioNote(chord: Chord, step: number): number {
  const notes = chordNotes(chord).map((n) => n + 12);
  const cycle = [...notes, ...notes.slice(1, -1).reverse()];
  return cycle[step % cycle.length];
}
