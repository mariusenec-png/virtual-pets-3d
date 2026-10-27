import type { LanguageSetting } from '../i18n';

/**
 * Core game types. These are pure data shapes with no React or Three.js
 * dependencies so the simulation can be unit-tested and later reused
 * in a mobile build.
 */

export type SpeciesId = 'cat' | 'dog';

/** All needs are stored on a 0..100 scale where 100 is the best value. */
export type NeedId = 'satiety' | 'hydration' | 'energy' | 'hygiene' | 'happiness' | 'health';

export type Needs = Record<NeedId, number>;

export type GrowthStage = 'baby' | 'young' | 'adult';

export type ActionId = 'feed' | 'water' | 'play' | 'pet' | 'bathe' | 'sleep' | 'wake';

export interface CareStats {
  feeds: number;
  drinks: number;
  plays: number;
  pets: number;
  baths: number;
  sleeps: number;
  vetVisits: number;
  minigames: number;
  /** Best score in the catch mini-game. */
  bestCatch: number;
}

export interface ActiveIllness {
  id: string;
  /** Pet age (in-game hours) when the illness started. */
  sinceAgeHours: number;
}

export interface PetState {
  id: string;
  name: string;
  species: SpeciesId;
  /** Real-world timestamp (ms) when the pet was created. */
  createdAt: number;
  /** In-game hours lived. Drives growth together with level. */
  ageHours: number;
  level: number;
  /** XP accumulated inside the current level. */
  xp: number;
  totalXp: number;
  needs: Needs;
  isSleeping: boolean;
  /** Current illness, if any. Only one at a time. */
  illness: ActiveIllness | null;
  /** The pet cannot catch a new illness before this age (in-game hours). */
  immuneUntilAgeHours: number;
  /** In-game hours accumulated while all needs were in good shape. */
  goodCareHours: number;
  /** Fractional passive XP not yet awarded (avoids losing XP to rounding). */
  pendingCareXp: number;
  stats: CareStats;
  /** Real timestamp (ms) after which an action grants XP again. */
  xpReadyAt: Partial<Record<ActionId, number>>;
}

export interface Inventory {
  food: Record<string, number>;
}

export interface Settings {
  /** Game hours that pass per real hour. 1 = real time. */
  timeScale: number;
  /** Shows developer tools (time skip, stat editing). */
  devMode: boolean;
  /** Fur rendering quality (number of fur shells). */
  furQuality: FurQuality;
  audio: AudioSettings;
  /** UI language ('auto' follows the browser). */
  language: LanguageSetting;
}

export interface AudioSettings {
  /** 0..1 */
  master: number;
  /** 0..1 */
  music: number;
  /** 0..1 */
  sfx: number;
  muted: boolean;
}

export type FurQuality = 'off' | 'low' | 'high';

/**
 * Everything that is saved: all pets plus what they share (coins, food,
 * settings). Game rules operate on a single-pet GameState view of it
 * (see src/game/household.ts: focus / unfocus).
 */
export interface Household {
  pets: PetState[];
  activePetId: string | null;
  coins: number;
  inventory: Inventory;
  settings: Settings;
  /** Daily reward streak. */
  daily: { lastClaimDay: string | null; streak: number };
  /** Real timestamp (ms) up to which the simulation has been applied. */
  lastSimulatedAt: number;
}

/** A game event that happened to a specific pet. */
export interface PetEvent {
  petId: string;
  event: GameEvent;
}

/** Single-pet view used by the game rules. */
export interface GameState {
  pet: PetState | null;
  coins: number;
  inventory: Inventory;
  unlockedToys: string[];
  settings: Settings;
  /** Real timestamp (ms) up to which the simulation has been applied. */
  lastSimulatedAt: number;
}

export type ActivityKind =
  | 'eat'
  | 'drink'
  | 'play'
  | 'petted'
  | 'bath'
  | 'sleep'
  | 'wake'
  | 'celebrate'
  | 'refuse';

export type GameEvent =
  | { type: 'xp'; amount: number; source: string }
  | { type: 'levelUp'; level: number; coins: number; unlocked: string[] }
  | { type: 'coins'; amount: number }
  | { type: 'activity'; activity: ActivityKind; itemId?: string }
  | { type: 'fellAsleep'; reason: 'exhausted' }
  | { type: 'wokeUp'; reason: 'rested' }
  | { type: 'warning'; need: NeedId }
  | { type: 'gotSick'; illnessId: string }
  | { type: 'cured'; illnessId: string; treatment: string }
  | { type: 'message'; text: string; tone: 'info' | 'good' | 'bad' };

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; reason: string; events: GameEvent[] };
