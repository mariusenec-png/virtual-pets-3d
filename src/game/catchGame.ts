import { CATCH_GAME as C } from '../config/minigames';
import { clamp } from './math';

/**
 * Pure simulation of the "Catch the Treats" mini-game. Treats fall from the
 * ceiling; the pet moves left/right to catch them. Rendering and input live
 * in src/scene/minigame; this module has no React/Three dependency.
 */

export type CatchItemKind = 'treat' | 'golden' | 'hazard';

export interface CatchItem {
  id: number;
  kind: CatchItemKind;
  x: number;
  y: number;
  speed: number;
}

export interface CatchGameState {
  time: number;
  petX: number;
  /** Last horizontal velocity of the pet (for animation). */
  petVelocity: number;
  items: CatchItem[];
  score: number;
  combo: number;
  bestCombo: number;
  caught: number;
  missed: number;
  hazards: number;
  nextSpawnIn: number;
  nextId: number;
  over: boolean;
}

export interface CatchInput {
  /** Desired x position (pointer/touch), takes priority when set. */
  targetX: number | null;
  /** Keyboard axis: -1 left, 0 none, 1 right. */
  axis: number;
}

export type CatchEvent =
  | { type: 'catch'; kind: 'treat' | 'golden'; points: number; x: number; multiplier: number }
  | { type: 'hazard'; x: number }
  | { type: 'miss'; x: number }
  | { type: 'end' };

export function createCatchGame(): CatchGameState {
  return {
    time: 0,
    petX: 0,
    petVelocity: 0,
    items: [],
    score: 0,
    combo: 0,
    bestCombo: 0,
    caught: 0,
    missed: 0,
    hazards: 0,
    nextSpawnIn: 0.6,
    nextId: 1,
    over: false,
  };
}

/** 0 at the start of the round, 1 at the end. */
export function difficulty(s: Pick<CatchGameState, 'time'>): number {
  return clamp(s.time / C.durationSeconds, 0, 1);
}

export function multiplier(combo: number): number {
  return Math.min(C.maxMultiplier, 1 + Math.floor(combo / C.comboStep));
}

function spawn(s: CatchGameState, rng: () => number): void {
  const d = difficulty(s);
  const r = rng();
  const kind: CatchItemKind = r < C.goldenChance ? 'golden' : r < C.goldenChance + C.hazardChance ? 'hazard' : 'treat';
  const speed = (C.fallSpeedStart + (C.fallSpeedEnd - C.fallSpeedStart) * d) * (0.85 + rng() * 0.3);
  s.items.push({
    id: s.nextId++,
    kind,
    x: C.minX + 0.1 + rng() * (C.maxX - C.minX - 0.2),
    y: C.spawnHeight,
    speed: kind === 'golden' ? speed * 1.2 : speed,
  });
  s.nextSpawnIn = C.spawnIntervalStart + (C.spawnIntervalEnd - C.spawnIntervalStart) * d;
}

/** Advances the game by `dt` seconds. Mutates and returns events. */
export function stepCatchGame(s: CatchGameState, dt: number, input: CatchInput, rng: () => number): CatchEvent[] {
  if (s.over) return [];
  const events: CatchEvent[] = [];
  dt = clamp(dt, 0, 0.1);
  s.time += dt;

  // Move the pet.
  const before = s.petX;
  if (input.targetX !== null) {
    const delta = clamp(input.targetX, C.minX, C.maxX) - s.petX;
    s.petX += clamp(delta, -C.petSpeed * dt, C.petSpeed * dt);
  } else if (input.axis !== 0) {
    s.petX += Math.sign(input.axis) * C.petSpeed * dt;
  }
  s.petX = clamp(s.petX, C.minX, C.maxX);
  s.petVelocity = dt > 0 ? (s.petX - before) / dt : 0;

  // Spawn.
  if (s.time < C.durationSeconds) {
    s.nextSpawnIn -= dt;
    if (s.nextSpawnIn <= 0) spawn(s, rng);
  }

  // Fall, catch, miss.
  const remaining: CatchItem[] = [];
  for (const item of s.items) {
    const prevY = item.y;
    item.y -= item.speed * dt;
    const crossed = prevY >= C.catchHeight && item.y < C.catchHeight;
    if (crossed && Math.abs(item.x - s.petX) <= C.catchRadius) {
      if (item.kind === 'hazard') {
        s.score = Math.max(0, s.score - C.hazardPenalty);
        s.combo = 0;
        s.hazards += 1;
        events.push({ type: 'hazard', x: item.x });
      } else {
        const m = item.kind === 'treat' ? multiplier(s.combo) : 1;
        const points = C.points[item.kind] * m;
        s.score += points;
        s.combo += 1;
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        s.caught += 1;
        events.push({ type: 'catch', kind: item.kind, points, x: item.x, multiplier: m });
      }
      continue;
    }
    if (item.y < 0) {
      if (item.kind !== 'hazard') {
        s.missed += 1;
        s.combo = 0;
        events.push({ type: 'miss', x: item.x });
      }
      continue;
    }
    remaining.push(item);
  }
  s.items = remaining;

  // The round ends when time is up and the last items have landed.
  if (s.time >= C.durationSeconds && s.items.length === 0) {
    s.over = true;
    events.push({ type: 'end' });
  }
  return events;
}

export function timeLeft(s: Pick<CatchGameState, 'time'>): number {
  return Math.max(0, C.durationSeconds - s.time);
}
