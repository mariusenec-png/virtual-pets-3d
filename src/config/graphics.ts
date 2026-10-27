import type { FurQuality } from '../game/types';
import { t } from '../i18n';

/** Number of fur shells drawn per quality level. */
export const FUR_SHELLS: Record<FurQuality, number> = {
  off: 0,
  low: 12,
  high: 32,
};

export const FUR_QUALITY_OPTIONS: { id: FurQuality; label: string }[] = [
  { id: 'off', get label() { return t('fur.off'); } },
  { id: 'low', get label() { return t('fur.low'); } },
  { id: 'high', get label() { return t('fur.high'); } },
];

/** Fur length multiplier while wet (during and shortly after a bath). */
export const WET_FUR_LENGTH = 0.35;
/** Real seconds the fur stays wet after the bath ends. */
export const WET_FUR_DRY_SECONDS = 6;
