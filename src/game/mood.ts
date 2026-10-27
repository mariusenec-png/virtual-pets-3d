import { getIllness } from '../config/illnesses';
import { NEEDS } from '../config/needs';
import { t } from '../i18n';
import type { NeedId, PetState } from './types';

export type MoodId =
  | 'sleeping'
  | 'sick'
  | 'unwell'
  | 'hungry'
  | 'thirsty'
  | 'tired'
  | 'dirty'
  | 'sad'
  | 'happy'
  | 'content';

export interface Mood {
  id: MoodId;
  label: string;
  emoji: string;
}

const needMood = (): Partial<Record<NeedId, Mood>> => ({
  satiety: { id: 'hungry', label: t('mood.hungry'), emoji: '🍖' },
  hydration: { id: 'thirsty', label: t('mood.thirsty'), emoji: '💧' },
  energy: { id: 'tired', label: t('mood.tired'), emoji: '🥱' },
  hygiene: { id: 'dirty', label: t('mood.dirty'), emoji: '🫧' },
  happiness: { id: 'sad', label: t('mood.sad'), emoji: '😿' },
});

export function getMood(pet: PetState): Mood {
  if (pet.isSleeping) return { id: 'sleeping', label: t('mood.sleeping'), emoji: '💤' };
  if (pet.illness) {
    const illness = getIllness(pet.illness.id);
    return { id: 'sick', label: t('mood.sick'), emoji: illness?.icon ?? '🤒' };
  }
  if (pet.needs.health < NEEDS.health.warnBelow) return { id: 'unwell', label: t('mood.unwell'), emoji: '🤒' };

  // Pick the lowest need that is below its warning level.
  let worst: { id: NeedId; ratio: number } | null = null;
  const NEED_MOOD = needMood();
  for (const id of Object.keys(NEED_MOOD) as NeedId[]) {
    const ratio = pet.needs[id] / NEEDS[id].warnBelow;
    if (ratio < 1 && (!worst || ratio < worst.ratio)) worst = { id, ratio };
  }
  if (worst) return NEED_MOOD[worst.id]!;
  if (pet.needs.happiness >= 75) return { id: 'happy', label: t('mood.happy'), emoji: '😊' };
  return { id: 'content', label: t('mood.content'), emoji: '🙂' };
}

/** Needs currently below their warning threshold. */
export function lowNeeds(pet: PetState): NeedId[] {
  return (Object.keys(NEEDS) as NeedId[]).filter((id) => pet.needs[id] < NEEDS[id].warnBelow);
}
