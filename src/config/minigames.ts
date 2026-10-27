import type { NeedId } from '../game/types';

/** "Catch the Treats" mini-game tuning. Distances are in meters, times in seconds. */
export const CATCH_GAME = {
  durationSeconds: 30,
  /** Horizontal range the pet can move in. */
  minX: -1.3,
  maxX: 1.3,
  petSpeed: 2.6,
  spawnHeight: 2.3,
  /** Height (top of pet) at which an item is checked for a catch. */
  catchHeight: 0.4,
  /** Max horizontal distance between pet and item for a catch. */
  catchRadius: 0.3,
  /** Seconds between spawns at the start and at the end (difficulty ramp). */
  spawnIntervalStart: 0.9,
  spawnIntervalEnd: 0.42,
  /** Fall speed (m/s) at the start and at the end. */
  fallSpeedStart: 1.1,
  fallSpeedEnd: 2.3,
  /** Spawn probabilities (the rest are normal treats). */
  goldenChance: 0.08,
  hazardChance: 0.16,
  points: { treat: 1, golden: 5 },
  /** Points lost when catching a hazard (soap bottle). */
  hazardPenalty: 3,
  /** Every N consecutive catches adds +1 to the treat multiplier. */
  comboStep: 5,
  maxMultiplier: 4,
} as const;

export const CATCH_REWARDS = {
  coinsPerPoint: 0.5,
  maxCoins: 40,
  baseXp: 5,
  xpPerPoints: 3,
  maxXp: 25,
  /** Need changes after a round (playing is tiring). */
  needs: { happiness: 10, energy: -12, satiety: -6, hydration: -8 } as Partial<Record<NeedId, number>>,
  happinessPerPoint: 0.4,
  maxHappinessBonus: 15,
  /** Minimum energy needed to start a round. */
  minEnergy: 20,
};

/** Daily login reward by streak day (1-based). Day 7 also gives a treat. */
export const DAILY_REWARDS = {
  coins: [15, 20, 25, 30, 35, 40, 60],
  day7Food: { id: 'gourmetFeast', amount: 1 },
};
