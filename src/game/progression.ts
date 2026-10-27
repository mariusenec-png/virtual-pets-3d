import { GROWTH_STAGES, type GrowthStageDefinition } from '../config/growth';
import { toysForSpecies } from '../config/items';
import { LEVEL_UP_COINS, MAX_LEVEL, xpToNextLevel } from '../config/progression';
import type { GameEvent, GameState, GrowthStage, PetState, SpeciesId } from './types';

export function unlockedToysForLevel(species: SpeciesId, level: number): string[] {
  return toysForSpecies(species)
    .filter((t) => t.unlockLevel <= level)
    .map((t) => t.id);
}

/**
 * Adds XP to the pet, handling level-ups, coin rewards and toy unlocks.
 * Mutates the given (already cloned) state and returns the events produced.
 */
export function applyXp(state: GameState, amount: number, source: string): GameEvent[] {
  const pet = state.pet;
  if (!pet || amount <= 0) return [];
  const events: GameEvent[] = [{ type: 'xp', amount, source }];
  pet.xp += amount;
  pet.totalXp += amount;

  while (pet.level < MAX_LEVEL && pet.xp >= xpToNextLevel(pet.level)) {
    pet.xp -= xpToNextLevel(pet.level);
    pet.level += 1;
    const coins = LEVEL_UP_COINS.base + LEVEL_UP_COINS.perLevel * pet.level;
    state.coins += coins;
    const before = new Set(state.unlockedToys);
    const nowUnlocked = unlockedToysForLevel(pet.species, pet.level);
    const unlocked = nowUnlocked.filter((id) => !before.has(id));
    state.unlockedToys = Array.from(new Set([...state.unlockedToys, ...nowUnlocked]));
    events.push({ type: 'levelUp', level: pet.level, coins, unlocked });
  }

  if (pet.level >= MAX_LEVEL) {
    pet.xp = 0;
  }
  return events;
}

type GrowthInput = Pick<PetState, 'ageHours' | 'level' | 'goodCareHours'>;

function meetsStage(pet: GrowthInput, stage: GrowthStageDefinition): boolean {
  return pet.ageHours >= stage.minAgeHours && pet.level >= stage.minLevel && pet.goodCareHours >= stage.minGoodCareHours;
}

export function getGrowthStageDefinition(pet: GrowthInput): GrowthStageDefinition {
  let current = GROWTH_STAGES[0];
  for (const stage of GROWTH_STAGES) {
    if (meetsStage(pet, stage)) current = stage;
  }
  return current;
}

export function getGrowthStage(pet: GrowthInput): GrowthStage {
  return getGrowthStageDefinition(pet).id;
}

export interface GrowthRequirement {
  label: string;
  current: number;
  target: number;
  done: boolean;
}

/** What the pet still needs for the next stage, or null when fully grown. */
export function nextStageRequirements(
  pet: GrowthInput,
): { stage: GrowthStageDefinition; requirements: GrowthRequirement[] } | null {
  const current = getGrowthStageDefinition(pet);
  const idx = GROWTH_STAGES.indexOf(current);
  const stage = GROWTH_STAGES[idx + 1];
  if (!stage) return null;
  return {
    stage,
    requirements: [
      { label: 'age', current: pet.ageHours, target: stage.minAgeHours, done: pet.ageHours >= stage.minAgeHours },
      { label: 'level', current: pet.level, target: stage.minLevel, done: pet.level >= stage.minLevel },
      {
        label: 'care',
        current: pet.goodCareHours,
        target: stage.minGoodCareHours,
        done: pet.goodCareHours >= stage.minGoodCareHours,
      },
    ],
  };
}

/** Progress (0..1) through the current level. */
export function levelProgress(pet: Pick<PetState, 'level' | 'xp'>): number {
  if (pet.level >= MAX_LEVEL) return 1;
  return Math.min(1, pet.xp / xpToNextLevel(pet.level));
}
