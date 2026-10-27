import type { ActionId } from '../game/types';

/** XP and level configuration. */

export const MAX_LEVEL = 30;

/** XP needed to go from `level` to `level + 1`. */
export function xpToNextLevel(level: number): number {
  return Math.round(40 * Math.pow(level, 1.35));
}

/** XP granted per action when the action was actually needed. */
export const ACTION_XP: Record<ActionId, number> = {
  feed: 10,
  water: 6,
  play: 12,
  pet: 3,
  bathe: 10,
  sleep: 4,
  wake: 0,
};

/** Real-time cooldown (ms) before the same action grants XP again. */
export const ACTION_XP_COOLDOWN_MS: Record<ActionId, number> = {
  feed: 20_000,
  water: 20_000,
  play: 8_000,
  pet: 30_000,
  bathe: 60_000,
  sleep: 60_000,
  wake: 0,
};

/** Passive XP per in-game hour while every need is in good shape. */
export const GOOD_CARE_XP_PER_HOUR = 6;

/** Coins granted on reaching a level: base + perLevel * level. */
export const LEVEL_UP_COINS = { base: 10, perLevel: 5 };

export const STARTING_COINS = 50;
