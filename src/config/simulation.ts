import { t } from '../i18n';

/**
 * Simulation timing. Everything time-related is configurable here so the
 * game can be tested quickly without waiting days.
 */

export interface TimeScalePreset {
  id: string;
  label: string;
  /** In-game hours per real hour. */
  value: number;
  devOnly: boolean;
}

export const TIME_SCALE_PRESETS: TimeScalePreset[] = [
  { id: 'realtime', get label() { return t('speed.realtime'); }, value: 1, devOnly: false },
  { id: 'normal', get label() { return t('speed.normal'); }, value: 6, devOnly: false },
  { id: 'fast', get label() { return t('speed.fast'); }, value: 60, devOnly: true },
  { id: 'turbo', get label() { return t('speed.turbo'); }, value: 600, devOnly: true },
];

export const DEFAULT_TIME_SCALE = 6;

export const SIMULATION = {
  /** Real milliseconds between simulation ticks while the game is open. */
  tickIntervalMs: 1000,
  /** Largest simulation sub-step in in-game hours (keeps thresholds accurate). */
  maxStepHours: 1 / 12,
  /** Autosave interval in real milliseconds. */
  autosaveIntervalMs: 10_000,
  offline: {
    /** Offline catch-up never simulates more than this many in-game hours. */
    maxCatchUpHours: 24,
    /** While catching up offline, needs never drop below this value. */
    needFloor: 10,
    /** While catching up offline, health never drops below this value. */
    healthFloor: 30,
    /** Pets asleep or exhausted while offline sleep until rested. */
    autoSleep: true,
  },
  /** Rejects timestamps further in the future than this (clock tampering). */
  maxClockSkewMs: 5 * 60 * 1000,
} as const;
