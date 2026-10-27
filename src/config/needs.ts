import type { NeedId } from '../game/types';
import { t } from '../i18n';

/**
 * Need display + decay configuration.
 * Rates are expressed in points per in-game hour on a 0..100 scale.
 */

export interface NeedDefinition {
  id: NeedId;
  label: string;
  icon: string;
  /** Below this value the need is shown as a warning. */
  warnBelow: number;
  /** Below this value the need is critical and starts harming health. */
  criticalBelow: number;
}

export const NEED_ORDER: NeedId[] = ['satiety', 'hydration', 'energy', 'hygiene', 'happiness', 'health'];

export const NEEDS: Record<NeedId, NeedDefinition> = {
  satiety: { id: 'satiety', get label() { return t('need.satiety'); }, icon: '🍖', warnBelow: 35, criticalBelow: 15 },
  hydration: { id: 'hydration', get label() { return t('need.hydration'); }, icon: '💧', warnBelow: 35, criticalBelow: 15 },
  energy: { id: 'energy', get label() { return t('need.energy'); }, icon: '⚡', warnBelow: 25, criticalBelow: 10 },
  hygiene: { id: 'hygiene', get label() { return t('need.hygiene'); }, icon: '🫧', warnBelow: 30, criticalBelow: 12 },
  happiness: { id: 'happiness', get label() { return t('need.happiness'); }, icon: '💛', warnBelow: 30, criticalBelow: 12 },
  health: { id: 'health', get label() { return t('need.health'); }, icon: '❤️', warnBelow: 50, criticalBelow: 25 },
};

export const DECAY = {
  /** Base decay per in-game hour while awake. */
  awake: {
    satiety: 8,
    hydration: 10,
    energy: 6,
    hygiene: 4,
    happiness: 5,
  },
  /** Multipliers applied while sleeping. Energy is restored instead. */
  asleepMultiplier: {
    satiety: 0.5,
    hydration: 0.5,
    hygiene: 0.3,
    happiness: 0.2,
  },
  /** Energy restored per in-game hour while sleeping. */
  sleepEnergyGain: 25,
  /** Extra happiness loss per hour for each need below its warning level. */
  unhappyPerLowNeed: 3,
  /** Health loss per hour for each need below its critical level. */
  healthLossPerCriticalNeed: 6,
  /** Health regeneration per hour when every need is at least `healthyAbove`. */
  healthRegen: 3,
  healthyAbove: 50,
  /** Energy level at which an awake pet collapses into sleep. */
  exhaustedBelow: 5,
  /** A sleeping pet wakes up by itself when energy reaches this value. */
  autoWakeAt: 100,
} as const;

/** Needs considered when evaluating "good care" (health is evaluated too). */
export const GOOD_CARE_THRESHOLD = 60;
