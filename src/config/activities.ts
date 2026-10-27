import type { ActivityKind } from '../game/types';

/**
 * How long each on-screen activity lasts (real milliseconds) and whether it
 * blocks other actions while it plays.
 */
export const ACTIVITY_DURATION_MS: Record<ActivityKind, number> = {
  eat: 3600,
  drink: 3000,
  play: 4200,
  petted: 1800,
  bath: 3800,
  sleep: 1400,
  wake: 1400,
  celebrate: 2200,
  refuse: 1200,
};

export const BLOCKING_ACTIVITIES: ReadonlySet<ActivityKind> = new Set<ActivityKind>([
  'eat',
  'drink',
  'play',
  'bath',
  'sleep',
  'wake',
]);

/** Scene layout (world units, meters). Pet "home" is the origin. */
export const ROOM_LAYOUT = {
  home: [0, 0, 0.15] as [number, number, number],
  foodBowl: [-0.95, 0, 0.55] as [number, number, number],
  waterBowl: [-0.55, 0, 0.95] as [number, number, number],
  bed: [1.05, 0, -0.45] as [number, number, number],
  bathSpot: [0, 0, 0.35] as [number, number, number],
  toyBasket: [1.25, 0, 0.75] as [number, number, number],
};
