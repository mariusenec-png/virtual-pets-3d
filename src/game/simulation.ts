import { getIllness, ILLNESSES, type IllnessDefinition } from '../config/illnesses';
import { DECAY, GOOD_CARE_THRESHOLD, NEEDS } from '../config/needs';
import { GOOD_CARE_XP_PER_HOUR } from '../config/progression';
import { SIMULATION } from '../config/simulation';
import { getSpecies } from '../species/registry';
import type { SpeciesDefinition } from '../species/types';
import { clamp, clampNeed, MS_PER_HOUR } from './math';
import { applyXp } from './progression';
import type { GameEvent, GameState, NeedId, PetState, StepResult } from './types';

/** Random source in [0, 1). Injected so tests can be deterministic. */
export type Rng = () => number;

export interface SimulateOptions {
  /** Offline catch-up applies safety floors and a maximum duration. */
  offline: boolean;
  rng?: Rng;
}

const PHYSICAL_NEEDS: NeedId[] = ['satiety', 'hydration', 'energy', 'hygiene'];
const CARE_NEEDS: NeedId[] = ['satiety', 'hydration', 'energy', 'hygiene', 'happiness', 'health'];

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function mult(species: SpeciesDefinition, illness: IllnessDefinition | undefined, need: NeedId): number {
  return (species.decayMultipliers[need] ?? 1) * (illness?.decayMultipliers[need] ?? 1);
}

/** Total illness rate per hour and each illness's share, given current needs. */
export function illnessRates(pet: PetState): { illness: IllnessDefinition; rate: number }[] {
  return ILLNESSES.map((illness) => {
    let rate = illness.randomChancePerHour;
    for (const t of illness.triggers) {
      if (pet.needs[t.need] < t.below) rate += t.chancePerHour;
    }
    return { illness, rate };
  });
}

/** Rolls for a new illness during `dt` hours. Mutates `pet`. */
function maybeGetSick(pet: PetState, dt: number, rng: Rng, events: GameEvent[]): void {
  if (pet.illness || pet.ageHours < pet.immuneUntilAgeHours) return;
  const rates = illnessRates(pet);
  const total = rates.reduce((sum, r) => sum + r.rate, 0);
  if (total <= 0) return;
  const p = 1 - Math.exp(-total * dt);
  if (rng() >= p) return;
  // Pick which illness, weighted by its rate.
  let pick = rng() * total;
  for (const r of rates) {
    pick -= r.rate;
    if (pick <= 0) {
      pet.illness = { id: r.illness.id, sinceAgeHours: pet.ageHours };
      events.push({ type: 'gotSick', illnessId: r.illness.id });
      return;
    }
  }
}

/** Advances a single pet by `dt` in-game hours. Mutates `pet`. */
function stepPet(
  pet: PetState,
  dt: number,
  species: SpeciesDefinition,
  opts: SimulateOptions,
  rng: Rng,
  events: GameEvent[],
): void {
  const n = pet.needs;
  const before = { ...n };
  const asleep = pet.isSleeping;
  const sleepM = DECAY.asleepMultiplier;
  const illness = pet.illness ? getIllness(pet.illness.id) : undefined;

  n.satiety -= DECAY.awake.satiety * mult(species, illness, 'satiety') * (asleep ? sleepM.satiety : 1) * dt;
  n.hydration -= DECAY.awake.hydration * mult(species, illness, 'hydration') * (asleep ? sleepM.hydration : 1) * dt;
  n.hygiene -= DECAY.awake.hygiene * mult(species, illness, 'hygiene') * (asleep ? sleepM.hygiene : 1) * dt;
  n.happiness -= DECAY.awake.happiness * mult(species, illness, 'happiness') * (asleep ? sleepM.happiness : 1) * dt;

  if (asleep) {
    n.energy += DECAY.sleepEnergyGain * dt;
  } else {
    n.energy -= DECAY.awake.energy * mult(species, illness, 'energy') * dt;
  }

  // Unmet needs make the pet unhappy and, when critical, unhealthy.
  const lowCount = PHYSICAL_NEEDS.filter((id) => before[id] < NEEDS[id].warnBelow).length;
  n.happiness -= DECAY.unhappyPerLowNeed * lowCount * (asleep ? 0.5 : 1) * dt;

  const criticalCount = PHYSICAL_NEEDS.filter((id) => before[id] < NEEDS[id].criticalBelow).length;
  if (illness) n.health -= illness.healthLossPerHour * dt;
  if (criticalCount > 0) {
    n.health -= DECAY.healthLossPerCriticalNeed * criticalCount * dt;
  } else if (!illness && CARE_NEEDS.every((id) => id === 'health' || before[id] >= DECAY.healthyAbove)) {
    n.health += DECAY.healthRegen * dt;
  }

  // Clamp, applying gentler floors while catching up offline.
  for (const id of CARE_NEEDS) {
    const floor = opts.offline
      ? id === 'health'
        ? Math.min(before[id], SIMULATION.offline.healthFloor)
        : Math.min(before[id], SIMULATION.offline.needFloor)
      : 0;
    n[id] = clamp(clampNeed(n[id]), floor, 100);
  }

  // Sleep transitions.
  if (!pet.isSleeping && n.energy < DECAY.exhaustedBelow) {
    pet.isSleeping = true;
    events.push({ type: 'fellAsleep', reason: 'exhausted' });
  } else if (pet.isSleeping && n.energy >= DECAY.autoWakeAt) {
    pet.isSleeping = false;
    events.push({ type: 'wokeUp', reason: 'rested' });
  }

  // Threshold warnings (only interesting while the player is watching).
  if (!opts.offline) {
    for (const id of CARE_NEEDS) {
      if (before[id] >= NEEDS[id].warnBelow && n[id] < NEEDS[id].warnBelow) {
        events.push({ type: 'warning', need: id });
      }
    }
  }

  pet.ageHours += dt;
  maybeGetSick(pet, dt, rng, events);

  if (!pet.illness && CARE_NEEDS.every((id) => n[id] >= GOOD_CARE_THRESHOLD)) {
    pet.goodCareHours += dt;
    pet.pendingCareXp += GOOD_CARE_XP_PER_HOUR * dt;
  }
}

/**
 * Simulates `gameHours` of in-game time. Pure (given the rng): returns a new state.
 */
export function simulateHours(state: GameState, gameHours: number, opts: SimulateOptions): StepResult {
  if (!state.pet || !(gameHours > 0)) return { state, events: [] };

  const next = cloneState(state);
  const pet = next.pet!;
  const species = getSpecies(pet.species);
  const events: GameEvent[] = [];
  const rng = opts.rng ?? Math.random;

  let remaining = opts.offline ? Math.min(gameHours, SIMULATION.offline.maxCatchUpHours) : gameHours;
  while (remaining > 1e-9) {
    const dt = Math.min(remaining, SIMULATION.maxStepHours);
    stepPet(pet, dt, species, opts, rng, events);
    remaining -= dt;
  }

  const wholeXp = Math.floor(pet.pendingCareXp);
  if (wholeXp > 0) {
    pet.pendingCareXp -= wholeXp;
    events.push(...applyXp(next, wholeXp, 'care'));
  }

  return { state: next, events };
}

export interface AdvanceResult extends StepResult {
  /** In-game hours that were actually simulated. */
  simulatedHours: number;
  /** In-game hours that elapsed but were skipped by the offline cap. */
  skippedHours: number;
}

/**
 * Brings the state up to `now` (real ms timestamp) using the configured
 * time scale. Handles clocks moving backwards and caps offline catch-up.
 */
export function advanceToNow(state: GameState, now: number, opts: SimulateOptions): AdvanceResult {
  const elapsedMs = now - state.lastSimulatedAt;
  if (!(elapsedMs > 0)) {
    // Clock moved backwards or no time passed: just re-anchor.
    return { state: { ...state, lastSimulatedAt: now }, events: [], simulatedHours: 0, skippedHours: 0 };
  }
  const timeScale = clamp(state.settings.timeScale, 0, 10_000);
  const gameHours = (elapsedMs / MS_PER_HOUR) * timeScale;
  const cap = opts.offline ? SIMULATION.offline.maxCatchUpHours : Number.POSITIVE_INFINITY;
  const simulatedHours = Math.min(gameHours, cap);
  const result = simulateHours(state, simulatedHours, opts);
  return {
    state: { ...result.state, lastSimulatedAt: now },
    events: result.events,
    simulatedHours,
    skippedHours: Math.max(0, gameHours - simulatedHours),
  };
}
