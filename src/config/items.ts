import type { NeedId, SpeciesId } from '../game/types';
import { t } from '../i18n';

/** Food and toy definitions. Effects are deltas on the 0..100 need scale. */

export interface FoodItem {
  id: string;
  name: string;
  icon: string;
  effects: Partial<Record<NeedId, number>>;
  /** Coins for a pack of `packSize`. */
  packPrice: number;
  packSize: number;
  /** Extra happiness when the species loves this food. */
  favoriteOf?: SpeciesId[];
}

export interface ToyItem {
  id: string;
  name: string;
  icon: string;
  species: SpeciesId[];
  unlockLevel: number;
  effects: Partial<Record<NeedId, number>>;
  /** Extra XP on top of the base play XP. */
  bonusXp: number;
}

export const FOODS: FoodItem[] = [
  {
    id: 'kibble',
    get name() {
      return t('food.kibble');
    },
    icon: '🥣',
    effects: { satiety: 30, happiness: 2 },
    packPrice: 10,
    packSize: 5,
  },
  {
    id: 'wetFood',
    get name() {
      return t('food.wetFood');
    },
    icon: '🥫',
    effects: { satiety: 40, hydration: 8, happiness: 5 },
    packPrice: 18,
    packSize: 5,
  },
  {
    id: 'salmonTreat',
    get name() {
      return t('food.salmonTreat');
    },
    icon: '🐟',
    effects: { satiety: 12, happiness: 10 },
    packPrice: 15,
    packSize: 3,
    favoriteOf: ['cat'],
  },
  {
    id: 'chickenBites',
    get name() {
      return t('food.chickenBites');
    },
    icon: '🍗',
    effects: { satiety: 18, happiness: 8 },
    packPrice: 15,
    packSize: 3,
    favoriteOf: ['dog'],
  },
  {
    id: 'gourmetFeast',
    get name() {
      return t('food.gourmetFeast');
    },
    icon: '🍱',
    effects: { satiety: 55, hydration: 10, happiness: 14 },
    packPrice: 30,
    packSize: 2,
  },
  {
    id: 'vitaminTreat',
    get name() {
      return t('food.vitaminTreat');
    },
    icon: '💊',
    effects: { satiety: 8, health: 10, happiness: 4 },
    packPrice: 24,
    packSize: 3,
  },
];

export const FAVORITE_FOOD_HAPPINESS_BONUS = 8;

export const STARTING_FOOD: Record<string, number> = {
  kibble: 10,
  wetFood: 4,
  salmonTreat: 3,
  chickenBites: 3,
  gourmetFeast: 0,
  vitaminTreat: 0,
};

export const TOYS: ToyItem[] = [
  {
    id: 'ball',
    get name() {
      return t('toy.ball');
    },
    icon: '🎾',
    species: ['cat', 'dog'],
    unlockLevel: 1,
    effects: { happiness: 18, energy: -12, satiety: -4, hydration: -5, hygiene: -4 },
    bonusXp: 0,
  },
  {
    id: 'yarn',
    get name() {
      return t('toy.yarn');
    },
    icon: '🧶',
    species: ['cat'],
    unlockLevel: 2,
    effects: { happiness: 22, energy: -10, satiety: -3, hydration: -4, hygiene: -2 },
    bonusXp: 2,
  },
  {
    id: 'rope',
    get name() {
      return t('toy.rope');
    },
    icon: '🪢',
    species: ['dog'],
    unlockLevel: 2,
    effects: { happiness: 22, energy: -14, satiety: -5, hydration: -6, hygiene: -5 },
    bonusXp: 2,
  },
  {
    id: 'featherWand',
    get name() {
      return t('toy.featherWand');
    },
    icon: '🪶',
    species: ['cat'],
    unlockLevel: 4,
    effects: { happiness: 28, energy: -14, satiety: -4, hydration: -5, hygiene: -3 },
    bonusXp: 4,
  },
  {
    id: 'frisbee',
    get name() {
      return t('toy.frisbee');
    },
    icon: '🥏',
    species: ['dog'],
    unlockLevel: 4,
    effects: { happiness: 28, energy: -18, satiety: -6, hydration: -8, hygiene: -6 },
    bonusXp: 4,
  },
];

/** Minimum energy required to play. */
export const PLAY_MIN_ENERGY = 15;

export const WATER_EFFECTS: Partial<Record<NeedId, number>> = { hydration: 45, happiness: 1 };
export const PET_EFFECTS: Partial<Record<NeedId, number>> = { happiness: 8 };
export const BATH_EFFECTS: Partial<Record<NeedId, number>> = { hygiene: 100 };
/** Happiness lost when woken up while still tired (energy below threshold). */
export const GRUMPY_WAKE = { energyBelow: 40, happiness: -8 };

/** Refusal thresholds: actions that would be pointless are refused. */
export const REFUSE_ABOVE = {
  satiety: 92,
  hydration: 95,
  hygiene: 95,
  /** Pet refuses to sleep when energy is above this value. */
  energyForSleep: 85,
};

/** Thresholds under which an action is considered "needed" and grants XP. */
export const XP_NEEDED_BELOW = {
  satiety: 80,
  hydration: 80,
  hygiene: 75,
  energyForSleep: 50,
};

export function getFood(id: string): FoodItem | undefined {
  return FOODS.find((f) => f.id === id);
}

export function getToy(id: string): ToyItem | undefined {
  return TOYS.find((t) => t.id === id);
}

export function toysForSpecies(species: SpeciesId): ToyItem[] {
  return TOYS.filter((t) => t.species.includes(species));
}
