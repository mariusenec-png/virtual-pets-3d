import type { NeedId } from '../game/types';
import { t } from '../i18n';

/**
 * Fictional, casual in-game illnesses. None of this is real veterinary
 * information. Rates are "chance per in-game hour" (as a Poisson rate).
 */

export interface IllnessTrigger {
  need: NeedId;
  below: number;
  chancePerHour: number;
}

export interface IllnessDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  symptoms: string[];
  /** Explanation shown in the diagnosis. */
  likelyCause: string;
  /** Prevention tip shown after treatment. */
  prevention: string;
  healthLossPerHour: number;
  /** Extra multipliers on need decay while ill. */
  decayMultipliers: Partial<Record<NeedId, number>>;
  /** The pet refuses to play while it has this illness. */
  blocksPlay: boolean;
  /** Small background chance even with perfect care. */
  randomChancePerHour: number;
  triggers: IllnessTrigger[];
  treatment: {
    name: string;
    price: number;
    /** Need changes applied by the paid treatment. */
    effects: Partial<Record<NeedId, number>>;
  };
}

export const ILLNESSES: IllnessDefinition[] = [
  {
    id: 'sniffles',
    get name() {
      return t('ill.sniffles.name');
    },
    icon: '🤧',
    get description() {
      return t('ill.sniffles.desc');
    },
    get symptoms() {
      return t('ill.sniffles.symptoms').split('|');
    },
    get likelyCause() {
      return t('ill.sniffles.cause');
    },
    get prevention() {
      return t('ill.sniffles.prevention');
    },
    healthLossPerHour: 2,
    decayMultipliers: { energy: 1.6 },
    blocksPlay: false,
    randomChancePerHour: 0.001,
    triggers: [
      { need: 'energy', below: 20, chancePerHour: 0.04 },
      { need: 'hygiene', below: 30, chancePerHour: 0.02 },
    ],
    treatment: {
      get name() {
        return t('ill.sniffles.treatment');
      },
      price: 20, effects: { health: 25, energy: 10 } },
  },
  {
    id: 'tummyTrouble',
    get name() {
      return t('ill.tummyTrouble.name');
    },
    icon: '🤢',
    get description() {
      return t('ill.tummyTrouble.desc');
    },
    get symptoms() {
      return t('ill.tummyTrouble.symptoms').split('|');
    },
    get likelyCause() {
      return t('ill.tummyTrouble.cause');
    },
    get prevention() {
      return t('ill.tummyTrouble.prevention');
    },
    healthLossPerHour: 3,
    decayMultipliers: { happiness: 1.4, hydration: 1.3 },
    blocksPlay: true,
    randomChancePerHour: 0.001,
    triggers: [
      { need: 'satiety', below: 15, chancePerHour: 0.05 },
      { need: 'hydration', below: 15, chancePerHour: 0.05 },
    ],
    treatment: {
      get name() {
        return t('ill.tummyTrouble.treatment');
      },
      price: 25, effects: { health: 25, satiety: 10, hydration: 15 } },
  },
  {
    id: 'itchyCoat',
    get name() {
      return t('ill.itchyCoat.name');
    },
    icon: '🐾',
    get description() {
      return t('ill.itchyCoat.desc');
    },
    get symptoms() {
      return t('ill.itchyCoat.symptoms').split('|');
    },
    get likelyCause() {
      return t('ill.itchyCoat.cause');
    },
    get prevention() {
      return t('ill.itchyCoat.prevention');
    },
    healthLossPerHour: 1.5,
    decayMultipliers: { happiness: 1.5, hygiene: 1.5 },
    blocksPlay: false,
    randomChancePerHour: 0.001,
    triggers: [{ need: 'hygiene', below: 25, chancePerHour: 0.06 }],
    treatment: {
      get name() {
        return t('ill.itchyCoat.treatment');
      },
      price: 20, effects: { health: 20, hygiene: 100 } },
  },
  {
    id: 'theBlues',
    get name() {
      return t('ill.theBlues.name');
    },
    icon: '🌧️',
    get description() {
      return t('ill.theBlues.desc');
    },
    get symptoms() {
      return t('ill.theBlues.symptoms').split('|');
    },
    get likelyCause() {
      return t('ill.theBlues.cause');
    },
    get prevention() {
      return t('ill.theBlues.prevention');
    },
    healthLossPerHour: 1,
    decayMultipliers: { happiness: 1.4, satiety: 0.7 },
    blocksPlay: false,
    randomChancePerHour: 0.001,
    triggers: [{ need: 'happiness', below: 20, chancePerHour: 0.05 }],
    treatment: {
      get name() {
        return t('ill.theBlues.treatment');
      },
      price: 15, effects: { health: 20, happiness: 35 } },
  },
];

export const VET = {
  /** Free basic treatment: always cures, but the pet dislikes it. */
  basic: {
    get name() {
      return t('vet.basicName');
    },
    effects: { health: 5, happiness: -10 } as Partial<Record<NeedId, number>> },
  /** Optional health boost for a healthy pet with reduced health. */
  vitamins: {
    get name() {
      return t('vet.vitaminsName');
    },
    price: 10,
    effects: { health: 30 } as Partial<Record<NeedId, number>> },
  /** In-game hours of immunity after a paid / basic treatment. */
  immunityHours: { paid: 12, basic: 6 },
  /** Immunity for a newly adopted pet. */
  newPetImmunityHours: 3,
  /** XP for taking a sick pet to the vet. */
  treatXp: 10,
};

export function getIllness(id: string): IllnessDefinition | undefined {
  return ILLNESSES.find((i) => i.id === id);
}
