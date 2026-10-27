import type { NeedId, PersonalityId } from '../game/types';
import { t, type MessageKey } from '../i18n';

/**
 * Personalities make pets of the same species behave differently. Effects
 * are deliberately mild: they flavor the game without forcing a play style.
 * The scene also uses them to pick what the pet does on its own.
 */
export interface PersonalityDef {
  id: PersonalityId;
  icon: string;
  readonly name: string;
  readonly description: string;
  /** Multipliers on need decay (1 = unchanged). */
  decay: Partial<Record<NeedId, number>>;
  /** Multiplier on trick learning speed. */
  learning: number;
  /** Multiplier on happiness from playing with toys. */
  playJoy: number;
  /** Multiplier on happiness from being petted. */
  pettingJoy: number;
}

function def(
  id: PersonalityId,
  icon: string,
  rest: Omit<PersonalityDef, 'id' | 'icon' | 'name' | 'description'>,
): PersonalityDef {
  return {
    id,
    icon,
    get name() {
      return t(`personality.${id}` as MessageKey);
    },
    get description() {
      return t(`personality.${id}.desc` as MessageKey);
    },
    ...rest,
  };
}

export const PERSONALITIES: PersonalityDef[] = [
  def('playful', '🎾', { decay: { happiness: 1.1 }, learning: 1, playJoy: 1.3, pettingJoy: 1 }),
  def('lazy', '😴', { decay: { energy: 0.85 }, learning: 0.8, playJoy: 1, pettingJoy: 1 }),
  def('curious', '🔍', { decay: {}, learning: 1.3, playJoy: 1, pettingJoy: 1 }),
  def('foodie', '🍗', { decay: { satiety: 1.15 }, learning: 1.1, playJoy: 1, pettingJoy: 1 }),
  def('cuddly', '💞', { decay: {}, learning: 1, playJoy: 1, pettingJoy: 1.5 }),
];

export const PERSONALITY_IDS = PERSONALITIES.map((p) => p.id);

export function getPersonality(id: PersonalityId): PersonalityDef {
  return PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[2];
}

export function isPersonalityId(v: unknown): v is PersonalityId {
  return typeof v === 'string' && (PERSONALITY_IDS as string[]).includes(v);
}

/** Random personality for a new pet. */
export function randomPersonality(rng: () => number = Math.random): PersonalityId {
  return PERSONALITY_IDS[Math.min(PERSONALITY_IDS.length - 1, Math.floor(rng() * PERSONALITY_IDS.length))];
}

/** Stable personality for pets saved before personalities existed. */
export function personalityFromId(id: string): PersonalityId {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PERSONALITY_IDS[h % PERSONALITY_IDS.length];
}
