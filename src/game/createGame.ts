import { VET } from '../config/illnesses';
import { STARTING_FOOD } from '../config/items';
import { STARTING_COINS } from '../config/progression';
import { DEFAULT_TIME_SCALE } from '../config/simulation';
import { getSpecies } from '../species/registry';
import { unlockedToysForLevel } from './progression';
import type { GameState, PersonalityId, PetState, Settings, SpeciesId } from './types';
import { isMobileDevice } from '../config/device';

export const MAX_NAME_LENGTH = 16;

export function defaultSettings(): Settings {
  return {
    timeScale: DEFAULT_TIME_SCALE,
    devMode: false,
    // Phones get lighter fur by default; players can change it in Settings.
    furQuality: isMobileDevice() ? 'low' : 'high',
    audio: { master: 0.8, music: 0.35, sfx: 0.8, muted: false },
    language: 'auto',
  };
}

export function createEmptyGame(now: number, settings: Settings = defaultSettings()): GameState {
  return {
    pet: null,
    coins: STARTING_COINS,
    inventory: { food: { ...STARTING_FOOD } },
    unlockedToys: [],
    settings: { ...settings },
    comfort: 0,
    lastSimulatedAt: now,
  };
}

/** Normalizes a player-entered name. Returns null when it is not usable. */
export function sanitizePetName(raw: string): string | null {
  // Strip control characters and collapse whitespace.
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length === 0) return null;
  return Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join('');
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Creates a fresh pet. The personality defaults to 'curious' (no effect on
 * needs) so tests stay deterministic; adoption in the game picks a random one.
 */
export function createPet(
  name: string,
  species: SpeciesId,
  now: number,
  personality: PersonalityId = 'curious',
): PetState {
  return {
    id: makeId(),
    name,
    species,
    createdAt: now,
    ageHours: 0,
    level: 1,
    xp: 0,
    totalXp: 0,
    needs: {
      satiety: 70,
      hydration: 70,
      energy: 80,
      hygiene: 90,
      happiness: 70,
      health: 100,
    },
    isSleeping: false,
    illness: null,
    immuneUntilAgeHours: VET.newPetImmunityHours,
    goodCareHours: 0,
    pendingCareXp: 0,
    stats: { feeds: 0, drinks: 0, plays: 0, pets: 0, baths: 0, sleeps: 0, vetVisits: 0, minigames: 0, bestCatch: 0, tricks: 0 },
    personality,
    tricks: {},
    xpReadyAt: {},
  };
}

/**
 * Starts a new game with a fresh pet. Settings are kept from the previous
 * game so the player's dev/time preferences survive a new pet.
 */
export function startNewGame(
  name: string,
  species: SpeciesId,
  now: number,
  settings: Settings = defaultSettings(),
): GameState {
  const clean = sanitizePetName(name);
  if (!clean) throw new Error('Pet name is empty');
  if (!getSpecies(species).available) throw new Error(`Species ${species} is not available yet`);
  const game = createEmptyGame(now, settings);
  game.pet = createPet(clean, species, now);
  game.unlockedToys = unlockedToysForLevel(species, 1);
  return game;
}
