import { getIllness } from '../config/illnesses';
import { isPersonalityId, personalityFromId } from '../config/personality';
import { TRICKS } from '../config/tricks';
import { FOODS } from '../config/items';
import { MAX_LEVEL } from '../config/progression';
import { SIMULATION } from '../config/simulation';
import { defaultSettings, sanitizePetName } from '../game/createGame';
import { sanitizeRoom } from '../game/decor';
import { createHousehold, MAX_PETS } from '../game/household';
import { clamp, clampNeed, isFiniteNumber } from '../game/math';
import type { ActionId, Household, NeedId, PetState, Settings } from '../game/types';
import { isSpeciesId } from '../species/registry';

/**
 * Save/load layer. Everything read from storage is treated as untrusted:
 * it is validated, clamped and repaired so a corrupted or hand-edited save
 * can never break the game.
 */

export const SAVE_KEY = 'virtual-pets-3d/save';
/**
 * v1: single pet ({ game }). v2: multi-pet household ({ household }).
 * Milestone 8 added optional pet fields (personality, tricks) without a
 * version bump: older v2 saves get defaults when loaded.
 */
export const SAVE_VERSION = 2;

/** Minimal key-value interface so tests (and a future mobile build) can swap storage. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface SaveEnvelope {
  version: number;
  savedAt: number;
  household: Household;
}

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; household: Household; savedAt: number; repaired: boolean; migratedFrom?: number }
  | { status: 'corrupt'; error: string };

function browserStorage(): KeyValueStore | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Access can throw in privacy modes.
    return null;
  }
}

const NEED_IDS: NeedId[] = ['satiety', 'hydration', 'energy', 'hygiene', 'happiness', 'health'];
const ACTION_IDS: ActionId[] = ['feed', 'water', 'play', 'pet', 'bathe', 'sleep', 'wake'];

function num(value: unknown, fallback: number, min: number, max: number, track: { repaired: boolean }): number {
  if (!isFiniteNumber(value)) {
    track.repaired = true;
    return fallback;
  }
  const c = clamp(value, min, max);
  if (c !== value) track.repaired = true;
  return c;
}

function sanitizeSettings(raw: unknown, track: { repaired: boolean }): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') {
    track.repaired = true;
    return d;
  }
  const r = raw as Record<string, unknown>;
  return {
    timeScale: num(r.timeScale, d.timeScale, 0, 10_000, track),
    devMode: typeof r.devMode === 'boolean' ? r.devMode : d.devMode,
    furQuality: r.furQuality === 'off' || r.furQuality === 'low' || r.furQuality === 'high' ? r.furQuality : d.furQuality,
    language: r.language === 'en' || r.language === 'ro' || r.language === 'auto' ? r.language : d.language,
    audio: (() => {
      const a = (r.audio && typeof r.audio === 'object' ? r.audio : {}) as Record<string, unknown>;
      return {
        master: num(a.master, d.audio.master, 0, 1, { repaired: false }),
        music: num(a.music, d.audio.music, 0, 1, { repaired: false }),
        sfx: num(a.sfx, d.audio.sfx, 0, 1, { repaired: false }),
        muted: typeof a.muted === 'boolean' ? a.muted : d.audio.muted,
      };
    })(),
  };
}

function sanitizePet(raw: unknown, now: number, track: { repaired: boolean }): PetState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isSpeciesId(r.species)) return null;
  const name = typeof r.name === 'string' ? sanitizePetName(r.name) : null;
  if (!name) return null;

  const needsRaw = (r.needs && typeof r.needs === 'object' ? r.needs : {}) as Record<string, unknown>;
  const needs = {} as PetState['needs'];
  for (const id of NEED_IDS) needs[id] = clampNeed(num(needsRaw[id], 60, 0, 100, track));

  const statsRaw = (r.stats && typeof r.stats === 'object' ? r.stats : {}) as Record<string, unknown>;
  const stat = (k: string) => Math.floor(num(statsRaw[k], 0, 0, 1e9, track));

  const xpRaw = (r.xpReadyAt && typeof r.xpReadyAt === 'object' ? r.xpReadyAt : {}) as Record<string, unknown>;
  const xpReadyAt: PetState['xpReadyAt'] = {};
  for (const id of ACTION_IDS) {
    // Cooldowns are clamped so a future timestamp cannot lock XP forever.
    if (isFiniteNumber(xpRaw[id])) xpReadyAt[id] = clamp(xpRaw[id] as number, 0, now + 10 * 60 * 1000);
  }

  const illRaw = r.illness as Record<string, unknown> | null | undefined;
  const illness =
    illRaw && typeof illRaw === 'object' && typeof illRaw.id === 'string' && getIllness(illRaw.id)
      ? { id: illRaw.id, sinceAgeHours: num(illRaw.sinceAgeHours, 0, 0, 1e7, track) }
      : null;
  if (illRaw && !illness) track.repaired = true;

  const id = typeof r.id === 'string' && r.id.length > 0 ? r.id : `pet-${now}`;
  // Fields added in milestone 8: older saves simply lack them (not a repair).
  const tricksRaw = (r.tricks && typeof r.tricks === 'object' ? r.tricks : {}) as Record<string, unknown>;
  const tricks: PetState['tricks'] = {};
  for (const trick of TRICKS) {
    if (isFiniteNumber(tricksRaw[trick.id])) tricks[trick.id] = clamp(tricksRaw[trick.id] as number, 0, 100);
  }

  return {
    id,
    name,
    species: r.species,
    createdAt: num(r.createdAt, now, 0, now + SIMULATION.maxClockSkewMs, track),
    ageHours: num(r.ageHours, 0, 0, 1e7, track),
    level: Math.floor(num(r.level, 1, 1, MAX_LEVEL, track)),
    xp: num(r.xp, 0, 0, 1e9, track),
    totalXp: num(r.totalXp, 0, 0, 1e12, track),
    needs,
    isSleeping: typeof r.isSleeping === 'boolean' ? r.isSleeping : false,
    illness,
    // Older saves have no immunity field: treat as no immunity.
    immuneUntilAgeHours: isFiniteNumber(r.immuneUntilAgeHours) ? clamp(r.immuneUntilAgeHours, 0, 1e7) : 0,
    goodCareHours: num(r.goodCareHours, 0, 0, 1e7, track),
    pendingCareXp: num(r.pendingCareXp, 0, 0, 1000, track),
    stats: {
      feeds: stat('feeds'),
      drinks: stat('drinks'),
      plays: stat('plays'),
      pets: stat('pets'),
      baths: stat('baths'),
      sleeps: stat('sleeps'),
      vetVisits: stat('vetVisits'),
      minigames: stat('minigames'),
      bestCatch: stat('bestCatch'),
      tricks: isFiniteNumber(statsRaw.tricks) ? Math.floor(clamp(statsRaw.tricks, 0, 1e9)) : 0,
    },
    personality: isPersonalityId(r.personality) ? r.personality : personalityFromId(id),
    tricks,
    xpReadyAt,
  };
}

/** Validates an untrusted object into a usable Household. */
export function sanitizeHousehold(raw: unknown, now: number): { household: Household; repaired: boolean } {
  const track = { repaired: false };
  if (!raw || typeof raw !== 'object') {
    return { household: createHousehold(now), repaired: true };
  }
  const r = raw as Record<string, unknown>;
  const settings = sanitizeSettings(r.settings, track);
  const household = createHousehold(now, settings);

  // Pets: drop invalid ones, keep ids unique, respect the pet limit.
  const rawPets = Array.isArray(r.pets) ? r.pets : [];
  if (!Array.isArray(r.pets)) track.repaired = true;
  const seen = new Set<string>();
  for (const rawPet of rawPets) {
    if (household.pets.length >= MAX_PETS) {
      track.repaired = true;
      break;
    }
    const pet = sanitizePet(rawPet, now, track);
    if (!pet) {
      track.repaired = true;
      continue;
    }
    if (seen.has(pet.id)) {
      pet.id = `${pet.id}-${household.pets.length}`;
      track.repaired = true;
    }
    seen.add(pet.id);
    household.pets.push(pet);
  }
  const active = typeof r.activePetId === 'string' ? r.activePetId : null;
  household.activePetId = household.pets.some((p) => p.id === active) ? active : (household.pets[0]?.id ?? null);
  if (household.activePetId !== active) track.repaired = true;

  household.coins = Math.floor(num(r.coins, household.coins, 0, 1e9, track));

  const dailyRaw = (r.daily && typeof r.daily === 'object' ? r.daily : {}) as Record<string, unknown>;
  household.daily = {
    lastClaimDay:
      typeof dailyRaw.lastClaimDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dailyRaw.lastClaimDay)
        ? dailyRaw.lastClaimDay
        : null,
    streak: Math.floor(num(dailyRaw.streak, 0, 0, 7, { repaired: false })),
  };

  // Added in milestone 9: older saves start with the default room.
  household.room = sanitizeRoom(r.room);

  const invRaw = (r.inventory as Record<string, unknown> | undefined)?.food;
  if (invRaw && typeof invRaw === 'object') {
    const food: Record<string, number> = {};
    for (const f of FOODS) {
      food[f.id] = Math.floor(num((invRaw as Record<string, unknown>)[f.id], 0, 0, 9999, track));
    }
    household.inventory = { food };
  } else {
    track.repaired = true;
  }

  // A save from the future (clock skew) is anchored to now to avoid negative time.
  const last = isFiniteNumber(r.lastSimulatedAt) ? r.lastSimulatedAt : now;
  household.lastSimulatedAt = last > now + SIMULATION.maxClockSkewMs ? now : Math.min(last, now);
  if (household.lastSimulatedAt !== last) track.repaired = true;

  return { household, repaired: track.repaired };
}

/** Converts a v1 single-pet save ({ pet, coins, ... }) into the v2 household shape. */
function migrateV1(game: unknown): unknown {
  if (!game || typeof game !== 'object') return game;
  const g = game as Record<string, unknown>;
  const pet = g.pet as Record<string, unknown> | null | undefined;
  return {
    pets: pet ? [pet] : [],
    activePetId: pet && typeof pet.id === 'string' ? pet.id : null,
    coins: g.coins,
    inventory: g.inventory,
    settings: g.settings,
    lastSimulatedAt: g.lastSimulatedAt,
  };
}

export function loadHousehold(now: number, store: KeyValueStore | null = browserStorage()): LoadResult {
  if (!store) return { status: 'empty' };
  let text: string | null;
  try {
    text = store.getItem(SAVE_KEY);
  } catch (e) {
    return { status: 'corrupt', error: `Storage unavailable: ${String(e)}` };
  }
  if (!text) return { status: 'empty' };
  try {
    const env = JSON.parse(text) as Record<string, unknown>;
    if (!env || typeof env !== 'object' || typeof env.version !== 'number') {
      return { status: 'corrupt', error: 'Save has no version.' };
    }
    if (env.version > SAVE_VERSION) {
      return { status: 'corrupt', error: `Save version ${env.version} is newer than this game supports.` };
    }
    const rawHousehold = env.version === 1 ? migrateV1(env.game) : env.household;
    const { household, repaired } = sanitizeHousehold(rawHousehold, now);
    const savedAt = isFiniteNumber(env.savedAt) ? Math.min(env.savedAt, now) : household.lastSimulatedAt;
    return {
      status: 'ok',
      household,
      savedAt,
      repaired,
      migratedFrom: env.version < SAVE_VERSION ? env.version : undefined,
    };
  } catch (e) {
    return { status: 'corrupt', error: `Could not parse save: ${String(e)}` };
  }
}

export function saveHousehold(
  household: Household,
  now: number,
  store: KeyValueStore | null = browserStorage(),
): { ok: true } | { ok: false; error: string } {
  if (!store) return { ok: false, error: 'Local storage is not available in this browser.' };
  const env: SaveEnvelope = { version: SAVE_VERSION, savedAt: now, household };
  try {
    store.setItem(SAVE_KEY, JSON.stringify(env));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Saving failed: ${String(e)}` };
  }
}

export function clearSave(store: KeyValueStore | null = browserStorage()): void {
  try {
    store?.removeItem(SAVE_KEY);
  } catch {
    // Ignore: nothing else we can do.
  }
}

/** Keeps a copy of a save that failed to load so it is never silently destroyed. */
export function backupCorruptSave(store: KeyValueStore | null = browserStorage()): void {
  try {
    const text = store?.getItem(SAVE_KEY);
    if (text) store!.setItem(`${SAVE_KEY}/corrupt-backup-${Date.now()}`, text);
  } catch {
    // Ignore.
  }
}
