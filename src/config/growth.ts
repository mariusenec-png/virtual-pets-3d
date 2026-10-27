import type { GrowthStage } from '../game/types';
import { t } from '../i18n';

/**
 * Growth stage requirements. A pet advances when it has reached ALL of:
 * the minimum in-game age, the minimum level and the minimum hours of good
 * care (all needs >= GOOD_CARE_THRESHOLD). Requirements only ever increase,
 * so a pet never shrinks back to an earlier stage.
 *
 * Timing at the default ×6 speed: Young after ~2 real hours, Adult after ~8.
 * Use developer mode (×60 / ×600 or "Skip 24 h") to test growth quickly.
 */

export interface GrowthStageDefinition {
  id: GrowthStage;
  label: string;
  minAgeHours: number;
  minLevel: number;
  minGoodCareHours: number;
}

export const GROWTH_STAGES: GrowthStageDefinition[] = [
  { id: 'baby', get label() { return t('stage.baby'); }, minAgeHours: 0, minLevel: 1, minGoodCareHours: 0 },
  { id: 'young', get label() { return t('stage.young'); }, minAgeHours: 12, minLevel: 3, minGoodCareHours: 4 },
  { id: 'adult', get label() { return t('stage.adult'); }, minAgeHours: 48, minLevel: 7, minGoodCareHours: 16 },
];
