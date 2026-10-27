import { STARTING_FOOD } from '../config/items';
import { STARTING_COINS } from '../config/progression';
import { SIMULATION } from '../config/simulation';
import { getSpecies } from '../species/registry';
import { createPet, defaultSettings, sanitizePetName } from './createGame';
import { clamp, MS_PER_HOUR } from './math';
import { unlockedToysForLevel } from './progression';
import { simulateHours, type SimulateOptions } from './simulation';
import type { GameState, Household, PetEvent, PetState, Settings, SpeciesId } from './types';
import { t } from '../i18n';

/**
 * Multi-pet household. Pets share coins, food and settings; each pet keeps
 * its own needs, level, illness and growth. All pets keep living while the
 * player looks after another one.
 *
 * Game rules are written for a single pet (GameState). `focus` builds that
 * view for one pet and `unfocus` writes the result back.
 */

export const MAX_PETS = 4;

export function createHousehold(now: number, settings: Settings = defaultSettings()): Household {
  return {
    pets: [],
    activePetId: null,
    coins: STARTING_COINS,
    inventory: { food: { ...STARTING_FOOD } },
    settings: { ...settings },
    daily: { lastClaimDay: null, streak: 0 },
    lastSimulatedAt: now,
  };
}

export function getActivePet(h: Household): PetState | null {
  return h.pets.find((p) => p.id === h.activePetId) ?? null;
}

/** Single-pet view of the household (the pet object is shared, not copied). */
export function focus(h: Household, petId: string | null = h.activePetId): GameState {
  const pet = h.pets.find((p) => p.id === petId) ?? null;
  return {
    pet,
    coins: h.coins,
    inventory: h.inventory,
    unlockedToys: pet ? unlockedToysForLevel(pet.species, pet.level) : [],
    settings: h.settings,
    lastSimulatedAt: h.lastSimulatedAt,
  };
}

/** Writes a (modified) single-pet view back into the household. */
export function unfocus(h: Household, view: GameState): Household {
  const updated = view.pet;
  return {
    ...h,
    pets: updated ? h.pets.map((p) => (p.id === updated.id ? updated : p)) : h.pets,
    coins: view.coins,
    inventory: view.inventory,
    settings: view.settings,
    lastSimulatedAt: view.lastSimulatedAt,
  };
}

export type AdoptResult = { ok: true; household: Household; pet: PetState } | { ok: false; reason: string };

export function adoptPet(h: Household, rawName: string, species: SpeciesId, now: number): AdoptResult {
  const name = sanitizePetName(rawName);
  if (!name) return { ok: false, reason: t('adopt.errName') };
  if (!getSpecies(species).available) return { ok: false, reason: t('adopt.errSpecies') };
  if (h.pets.length >= MAX_PETS) return { ok: false, reason: t('adopt.errFull', { max: MAX_PETS }) };
  if (h.pets.some((p) => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return { ok: false, reason: t('adopt.errDuplicate', { name }) };
  }
  const pet = createPet(name, species, now);
  return { ok: true, pet, household: { ...h, pets: [...h.pets, pet], activePetId: pet.id } };
}

export function setActivePet(h: Household, petId: string): Household {
  if (!h.pets.some((p) => p.id === petId)) return h;
  return { ...h, activePetId: petId };
}

/** Removes a pet (rehoming). The next remaining pet becomes active. */
export function removePet(h: Household, petId: string): Household {
  const pets = h.pets.filter((p) => p.id !== petId);
  const activePetId = h.activePetId === petId ? (pets[0]?.id ?? null) : h.activePetId;
  return { ...h, pets, activePetId };
}

export interface HouseholdStep {
  household: Household;
  events: PetEvent[];
}

/** Simulates `gameHours` for every pet. Shared coins flow through each pet in turn. */
export function simulateHousehold(h: Household, gameHours: number, opts: SimulateOptions): HouseholdStep {
  let current = h;
  const events: PetEvent[] = [];
  for (const pet of h.pets) {
    const r = simulateHours(focus(current, pet.id), gameHours, opts);
    current = unfocus(current, r.state);
    for (const event of r.events) events.push({ petId: pet.id, event });
  }
  return { household: current, events };
}

export interface HouseholdAdvance extends HouseholdStep {
  simulatedHours: number;
  skippedHours: number;
}

/**
 * Brings every pet up to `now` (real ms) using the time scale. Handles
 * clocks moving backwards and caps offline catch-up, like advanceToNow.
 */
export function advanceHousehold(h: Household, now: number, opts: SimulateOptions): HouseholdAdvance {
  const elapsedMs = now - h.lastSimulatedAt;
  if (!(elapsedMs > 0)) {
    return { household: { ...h, lastSimulatedAt: now }, events: [], simulatedHours: 0, skippedHours: 0 };
  }
  const timeScale = clamp(h.settings.timeScale, 0, 10_000);
  const gameHours = (elapsedMs / MS_PER_HOUR) * timeScale;
  const cap = opts.offline ? SIMULATION.offline.maxCatchUpHours : Number.POSITIVE_INFINITY;
  const simulatedHours = Math.min(gameHours, cap);
  const r = simulateHousehold(h, simulatedHours, opts);
  return {
    household: { ...r.household, lastSimulatedAt: now },
    events: r.events,
    simulatedHours,
    skippedHours: Math.max(0, gameHours - simulatedHours),
  };
}
