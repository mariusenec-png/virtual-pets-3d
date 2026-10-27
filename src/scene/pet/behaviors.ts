import { ROOM_LAYOUT } from '../../config/activities';
import type { Needs, PersonalityId, SpeciesId } from '../../game/types';

/**
 * Autonomous behavior: what the pet does on its own while nobody is asking
 * it to do anything. Purely visual (needs are not affected); the choice is
 * weighted by species, personality, needs and health so every pet feels a
 * little different.
 */

/** What the skeleton animator plays once the pet reaches its spot. */
export type BehaviorAnim =
  | 'look'
  | 'window'
  | 'beg'
  | 'watch'
  | 'groom'
  | 'sniff'
  | 'toy'
  | 'chaseTail'
  | 'rest'
  | 'stretch';

export type BehaviorKind = BehaviorAnim | 'wander' | 'begWater';

export type Vec2 = [number, number];

export interface Behavior {
  kind: BehaviorKind;
  anim: BehaviorAnim;
  /** Where to walk first (x, z); null = stay where it is. */
  target: Vec2 | null;
  /** What to face once there: a point (x, z), the camera, or keep the heading. */
  face: Vec2 | 'camera' | null;
  /** Seconds to perform once arrived. */
  duration: number;
  /** Make a sound when it starts performing (meow / bark). */
  vocal: boolean;
}

export interface PlannerContext {
  species: SpeciesId;
  personality: PersonalityId;
  needs: Needs;
  unwell: boolean;
  /** Current position (x, z). */
  position: Vec2;
}

type Rng = () => number;

const RUG_CENTER: Vec2 = [0, 0.15];
const RUG_RADIUS = 0.95;

function xz(p: readonly [number, number, number]): Vec2 {
  return [p[0], p[2]];
}

/** A point `distance` away from `object`, on the side facing the rug center. */
function approach(object: Vec2, distance: number): Vec2 {
  let dx = RUG_CENTER[0] - object[0];
  let dz = RUG_CENTER[1] - object[1];
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  return [object[0] + dx * distance, object[1] + dz * distance];
}

function randomRugPoint(rng: Rng, radius = RUG_RADIUS): Vec2 {
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * radius;
  return [RUG_CENTER[0] + Math.cos(a) * r, RUG_CENTER[1] + Math.sin(a) * r * 0.85];
}

function nearby(from: Vec2, rng: Rng, radius: number): Vec2 {
  const a = rng() * Math.PI * 2;
  const p: Vec2 = [from[0] + Math.cos(a) * radius, from[1] + Math.sin(a) * radius];
  // Keep it on the rug.
  const dx = p[0] - RUG_CENTER[0];
  const dz = p[1] - RUG_CENTER[1];
  const d = Math.hypot(dx, dz);
  if (d > RUG_RADIUS) return [RUG_CENTER[0] + (dx / d) * RUG_RADIUS, RUG_CENTER[1] + (dz / d) * RUG_RADIUS];
  return p;
}

function between(rng: Rng, a: number, b: number): number {
  return a + rng() * (b - a);
}

/** Relative weights of each behavior for this pet right now. */
export function behaviorWeights(ctx: PlannerContext): Record<BehaviorKind, number> {
  const cat = ctx.species === 'cat';
  const n = ctx.needs;
  const w: Record<BehaviorKind, number> = {
    wander: 3,
    window: 2,
    watch: 2,
    groom: cat ? 3 : 0,
    sniff: cat ? 0.5 : 3,
    toy: 2,
    chaseTail: cat ? 0 : 1,
    rest: 1.5,
    stretch: 1,
    look: 1.5,
    beg: n.satiety < 45 ? 6 : 0,
    begWater: n.hydration < 45 ? 6 : 0,
  };
  switch (ctx.personality) {
    case 'playful':
      w.toy *= 2.5;
      w.chaseTail *= 2;
      w.rest *= 0.6;
      break;
    case 'lazy':
      w.rest *= 3;
      w.stretch *= 1.5;
      w.wander *= 0.5;
      w.toy *= 0.5;
      break;
    case 'curious':
      w.wander *= 2;
      w.window *= 2;
      w.sniff *= 2;
      break;
    case 'foodie':
      w.beg = Math.max(w.beg, 1.5);
      break;
    case 'cuddly':
      w.watch *= 3;
      break;
  }
  if (n.energy < 35) {
    w.rest *= 3;
    w.toy *= 0.3;
    w.chaseTail = 0;
    w.wander *= 0.5;
  }
  if (n.happiness < 30) {
    w.window *= 2;
    w.toy *= 0.5;
    w.watch *= 1.5;
  }
  if (ctx.unwell) {
    w.toy = 0;
    w.chaseTail = 0;
    w.stretch = 0;
    w.wander *= 0.3;
    w.rest *= 4;
  }
  return w;
}

/** Picks the next autonomous behavior. */
export function planBehavior(ctx: PlannerContext, rng: Rng = Math.random): Behavior {
  const weights = behaviorWeights(ctx);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let pick = rng() * total;
  let kind: BehaviorKind = 'look';
  for (const [k, v] of Object.entries(weights) as [BehaviorKind, number][]) {
    pick -= v;
    if (pick <= 0 && v > 0) {
      kind = k;
      break;
    }
  }
  return makeBehavior(kind, ctx, rng);
}

export function makeBehavior(kind: BehaviorKind, ctx: PlannerContext, rng: Rng): Behavior {
  const here = ctx.position;
  switch (kind) {
    case 'wander':
      return { kind, anim: 'look', target: randomRugPoint(rng), face: null, duration: between(rng, 3, 6), vocal: false };
    case 'window':
      return {
        kind,
        anim: 'window',
        target: xz(ROOM_LAYOUT.window),
        face: [ROOM_LAYOUT.window[0], ROOM_LAYOUT.window[2] - 1],
        duration: between(rng, 8, 14),
        vocal: false,
      };
    case 'watch':
      return { kind, anim: 'watch', target: [between(rng, -0.25, 0.25), 0.8], face: 'camera', duration: between(rng, 6, 10), vocal: false };
    case 'groom':
      return { kind, anim: 'groom', target: null, face: 'camera', duration: between(rng, 6, 9), vocal: false };
    case 'sniff':
      return { kind, anim: 'sniff', target: nearby(here, rng, 0.45), face: null, duration: between(rng, 3, 5), vocal: false };
    case 'toy': {
      const basket = xz(ROOM_LAYOUT.toyBasket);
      return { kind, anim: 'toy', target: approach(basket, 0.42), face: basket, duration: between(rng, 4, 7), vocal: true };
    }
    case 'chaseTail':
      return { kind, anim: 'chaseTail', target: null, face: null, duration: between(rng, 2.5, 4), vocal: true };
    case 'rest':
      return { kind, anim: 'rest', target: randomRugPoint(rng, 0.7), face: 'camera', duration: between(rng, 10, 18), vocal: false };
    case 'stretch':
      return { kind, anim: 'stretch', target: null, face: null, duration: 2.4, vocal: false };
    case 'beg': {
      const bowl = xz(ROOM_LAYOUT.foodBowl);
      return { kind, anim: 'beg', target: approach(bowl, 0.38), face: 'camera', duration: between(rng, 7, 11), vocal: true };
    }
    case 'begWater': {
      const bowl = xz(ROOM_LAYOUT.waterBowl);
      return { kind, anim: 'beg', target: approach(bowl, 0.38), face: 'camera', duration: between(rng, 7, 11), vocal: true };
    }
    case 'look':
    default:
      return { kind: 'look', anim: 'look', target: null, face: 'camera', duration: between(rng, 3, 6), vocal: false };
  }
}
