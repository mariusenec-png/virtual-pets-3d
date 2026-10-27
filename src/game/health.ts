import { getIllness, VET } from '../config/illnesses';
import { clampNeed } from './math';
import { applyXp } from './progression';
import { cloneState } from './simulation';
import type { ActionResult, GameEvent, GameState, NeedId, PetState } from './types';
import { t } from '../i18n';

/**
 * Veterinary clinic actions. Like player actions, these are pure functions
 * returning a new state or a refusal.
 */

export type TreatmentKind = 'paid' | 'basic';

function fail(reason: string): ActionResult {
  return { ok: false, reason, events: [{ type: 'message', text: reason, tone: 'bad' }] };
}

function applyEffects(pet: PetState, effects: Partial<Record<NeedId, number>>): void {
  for (const [id, delta] of Object.entries(effects) as [NeedId, number][]) {
    pet.needs[id] = clampNeed(pet.needs[id] + delta);
  }
}

export function treatIllness(state: GameState, kind: TreatmentKind): ActionResult {
  const pet0 = state.pet;
  if (!pet0) return fail(t('msg.noPet'));
  if (!pet0.illness) return fail(t('msg.notSick', { name: pet0.name }));
  const illness = getIllness(pet0.illness.id);
  if (!illness) return fail(t('msg.unknownIllness'));
  if (kind === 'paid' && state.coins < illness.treatment.price) {
    return fail(t('msg.noCoinsFor', { item: illness.treatment.name }));
  }

  const next = cloneState(state);
  const pet = next.pet!;
  const events: GameEvent[] = [];
  if (kind === 'paid') {
    next.coins -= illness.treatment.price;
    applyEffects(pet, illness.treatment.effects);
    events.push({ type: 'coins', amount: -illness.treatment.price });
    pet.immuneUntilAgeHours = pet.ageHours + VET.immunityHours.paid;
  } else {
    applyEffects(pet, VET.basic.effects);
    pet.immuneUntilAgeHours = pet.ageHours + VET.immunityHours.basic;
  }
  pet.illness = null;
  pet.stats.vetVisits += 1;
  const treatment = kind === 'paid' ? illness.treatment.name : VET.basic.name;
  events.push({ type: 'cured', illnessId: illness.id, treatment });
  events.push({ type: 'activity', activity: kind === 'paid' ? 'celebrate' : 'refuse' });
  events.push(...applyXp(next, VET.treatXp, 'vet'));
  return { ok: true, state: next, events };
}

export function giveVitamins(state: GameState): ActionResult {
  const pet0 = state.pet;
  if (!pet0) return fail(t('msg.noPet'));
  if (pet0.illness) return fail(t('msg.vitaminsNoCure'));
  if (pet0.needs.health >= 100) return fail(t('msg.perfectHealth', { name: pet0.name }));
  if (state.coins < VET.vitamins.price) return fail(t('msg.noCoinsFor', { item: VET.vitamins.name }));
  const next = cloneState(state);
  next.coins -= VET.vitamins.price;
  applyEffects(next.pet!, VET.vitamins.effects);
  next.pet!.stats.vetVisits += 1;
  return {
    ok: true,
    state: next,
    events: [
      { type: 'coins', amount: -VET.vitamins.price },
      { type: 'activity', activity: 'petted' },
      { type: 'message', text: t('msg.vitaminsDone', { name: next.pet!.name, vitamins: VET.vitamins.name }), tone: 'good' },
    ],
  };
}

/** Developer tool: makes the pet sick immediately (ignores immunity). */
export function contractIllness(state: GameState, illnessId: string): ActionResult {
  if (!state.pet) return fail(t('msg.noPet'));
  if (!getIllness(illnessId)) return fail(t('msg.unknownIllness'));
  const next = cloneState(state);
  next.pet!.illness = { id: illnessId, sinceAgeHours: next.pet!.ageHours };
  return { ok: true, state: next, events: [{ type: 'gotSick', illnessId }] };
}
