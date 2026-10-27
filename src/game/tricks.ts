import { getIllness } from '../config/illnesses';
import { getPersonality } from '../config/personality';
import { getTrick, TRAINING, type TrickDef } from '../config/tricks';
import { t } from '../i18n';
import { clampNeed } from './math';
import { applyXp } from './progression';
import { cloneState, type Rng } from './simulation';
import type { ActionResult, GameEvent, GameState, PetState, TrickId } from './types';

/**
 * Trick training. Each attempt costs energy and either succeeds (the pet
 * performs the trick) or fails (the pet gets it wrong). Both teach a little;
 * success teaches more. Once a trick reaches 100 mastery it always works.
 */

/** Chance (0..1) that an attempt succeeds. */
export function trickSuccessChance(pet: PetState, trickId: TrickId): number {
  const mastery = pet.tricks[trickId] ?? 0;
  if (mastery >= 100) return 1;
  let chance = TRAINING.baseChance + TRAINING.chancePerMastery * mastery;
  if (pet.needs.happiness > 70) chance += TRAINING.happyBonus;
  else if (pet.needs.happiness < 35) chance += TRAINING.sadPenalty;
  return Math.min(0.95, Math.max(0.1, chance));
}

/** Why the pet cannot train right now, or null. */
export function trainingBlockedReason(state: GameState, trick: TrickDef | undefined): string | null {
  const pet = state.pet;
  if (!pet) return t('msg.noPet');
  if (!trick) return t('msg.unknownTrick');
  if (pet.isSleeping) return t('msg.sleepingWake', { name: pet.name });
  if (pet.level < trick.unlockLevel) return t('msg.trickLocked', { trick: trick.name, level: trick.unlockLevel });
  if (pet.illness && getIllness(pet.illness.id)) return t('msg.tooSickToTrain', { name: pet.name });
  if (pet.needs.energy < TRAINING.minEnergy) return t('msg.tooTiredToTrain', { name: pet.name });
  if (pet.needs.happiness < TRAINING.minHappiness) return t('msg.tooSadToTrain', { name: pet.name });
  return null;
}

export function practiceTrick(state: GameState, trickId: string, _now: number, rng: Rng = Math.random): ActionResult {
  const trick = getTrick(trickId);
  const blocked = trainingBlockedReason(state, trick);
  if (blocked) {
    const refuse = !!state.pet && !state.pet.isSleeping && !!trick;
    const events: GameEvent[] = refuse ? [{ type: 'activity', activity: 'refuse' }] : [];
    events.push({ type: 'message', text: blocked, tone: 'bad' });
    return { ok: false, reason: blocked, events };
  }
  const def = trick!;
  const next = cloneState(state);
  const pet = next.pet!;
  const before = pet.tricks[def.id] ?? 0;
  const success = rng() < trickSuccessChance(pet, def.id);
  const personality = getPersonality(pet.personality);

  pet.needs.energy = clampNeed(pet.needs.energy - TRAINING.energyCost);
  const events: GameEvent[] = [];
  if (success) {
    pet.stats.tricks += 1;
    pet.needs.happiness = clampNeed(pet.needs.happiness + TRAINING.successJoy);
    events.push({ type: 'activity', activity: 'trick', itemId: def.id });
  } else {
    pet.needs.happiness = clampNeed(pet.needs.happiness + TRAINING.failJoy);
    events.push({ type: 'activity', activity: 'confused', itemId: def.id });
  }

  if (before < 100) {
    const gain = (success ? TRAINING.gainOnSuccess : TRAINING.gainOnFail) * def.ease * personality.learning;
    const after = Math.min(100, Math.round((before + gain) * 10) / 10);
    pet.tricks[def.id] = after;
    if (success) events.push(...applyXp(next, TRAINING.learningXp, 'trick'));
    if (after >= 100) {
      next.coins += TRAINING.masteredCoins;
      events.push({ type: 'trickMastered', trickId: def.id, coins: TRAINING.masteredCoins });
    } else {
      events.push({
        type: 'message',
        text: success
          ? t('msg.trickSuccess', { name: pet.name, trick: def.name })
          : t('msg.trickFail', { name: pet.name, trick: def.name }),
        tone: success ? 'good' : 'info',
      });
    }
  }
  return { ok: true, state: next, events };
}
