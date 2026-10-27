import type { TrickId } from '../game/types';
import { t, type MessageKey } from '../i18n';

/** Tricks the pet can be taught, in the order they unlock. */
export interface TrickDef {
  id: TrickId;
  icon: string;
  readonly name: string;
  /** Pet level needed before the trick can be practiced. */
  unlockLevel: number;
  /** Learning speed multiplier (harder tricks are slower to learn). */
  ease: number;
}

function trick(id: TrickId, icon: string, unlockLevel: number, ease: number): TrickDef {
  return {
    id,
    icon,
    unlockLevel,
    ease,
    get name() {
      return t(`trick.${id}` as MessageKey);
    },
  };
}

export const TRICKS: TrickDef[] = [
  trick('sit', '🪑', 1, 1),
  trick('paw', '🐾', 2, 0.85),
  trick('down', '⬇️', 3, 0.8),
  trick('spin', '🌀', 4, 0.7),
  trick('beg', '🙏', 5, 0.6),
  trick('rollOver', '🔄', 6, 0.5),
];

export function getTrick(id: string): TrickDef | undefined {
  return TRICKS.find((tr) => tr.id === id);
}

export const TRAINING = {
  /** Energy spent per attempt, and the minimum needed to train. */
  energyCost: 4,
  minEnergy: 15,
  /** Below this happiness the pet does not want to train. */
  minHappiness: 15,
  /** Mastery points per successful / failed attempt (before ease and personality). */
  gainOnSuccess: 12,
  gainOnFail: 4,
  /** Chance of success: base + perMastery * mastery (0..100), plus the mood bonus. */
  baseChance: 0.35,
  chancePerMastery: 0.006,
  /** Happy pets (above 70) focus better, sad ones (below 35) worse. */
  happyBonus: 0.1,
  sadPenalty: -0.15,
  /** Happiness change after a success / a failure. */
  successJoy: 3,
  failJoy: -1,
  /** XP for a success while the trick is still being learned. */
  learningXp: 4,
  /** Coins when a trick is mastered (100). */
  masteredCoins: 25,
  /** Labels: 0 new, below `good` learning, below 100 good, 100 mastered. */
  good: 50,
} as const;

export type TrickLevel = 'new' | 'learning' | 'good' | 'mastered';

export function trickLevel(mastery: number | undefined): TrickLevel {
  const m = mastery ?? 0;
  if (m >= 100) return 'mastered';
  if (m >= TRAINING.good) return 'good';
  if (m > 0) return 'learning';
  return 'new';
}
