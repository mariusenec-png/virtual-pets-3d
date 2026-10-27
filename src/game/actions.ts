import {
  BATH_EFFECTS,
  FAVORITE_FOOD_HAPPINESS_BONUS,
  getFood,
  getToy,
  GRUMPY_WAKE,
  PET_EFFECTS,
  PLAY_MIN_ENERGY,
  REFUSE_ABOVE,
  WATER_EFFECTS,
  XP_NEEDED_BELOW,
} from '../config/items';
import { getIllness } from '../config/illnesses';
import { ACTION_XP, ACTION_XP_COOLDOWN_MS } from '../config/progression';
import { getSpecies } from '../species/registry';
import { clampNeed } from './math';
import { applyXp } from './progression';
import { cloneState } from './simulation';
import type { ActionId, ActionResult, GameEvent, GameState, NeedId, PetState } from './types';
import { t } from '../i18n';

/**
 * Player actions. Each action is a pure function: it never mutates the
 * input state and returns either a new state with events or a refusal.
 */

function fail(reason: string, refuse = false): ActionResult {
  const events: GameEvent[] = refuse ? [{ type: 'activity', activity: 'refuse' }] : [];
  events.push({ type: 'message', text: reason, tone: 'bad' });
  return { ok: false, reason, events };
}

function applyEffects(pet: PetState, effects: Partial<Record<NeedId, number>>): void {
  for (const [id, delta] of Object.entries(effects) as [NeedId, number][]) {
    pet.needs[id] = clampNeed(pet.needs[id] + delta);
  }
}

/** Grants action XP when the action was needed and is off cooldown. */
function grantActionXp(
  state: GameState,
  action: ActionId,
  now: number,
  needed: boolean,
  bonus = 0,
): GameEvent[] {
  const pet = state.pet!;
  const readyAt = pet.xpReadyAt[action] ?? 0;
  if (!needed || now < readyAt) return [];
  pet.xpReadyAt[action] = now + ACTION_XP_COOLDOWN_MS[action];
  return applyXp(state, ACTION_XP[action] + bonus, action);
}

function requireAwakePet(state: GameState): string | null {
  if (!state.pet) return t('msg.noPet');
  if (state.pet.isSleeping) return t('msg.sleepingWake', { name: state.pet.name });
  return null;
}

export function feed(state: GameState, foodId: string, now: number): ActionResult {
  const blocked = requireAwakePet(state);
  if (blocked) return fail(blocked);
  const food = getFood(foodId);
  if (!food) return fail(t('msg.unknownFood'));
  if ((state.inventory.food[foodId] ?? 0) <= 0) return fail(t('msg.outOf', { food: food.name }));
  const pet0 = state.pet!;
  if (pet0.needs.satiety >= REFUSE_ABOVE.satiety) {
    return fail(t('msg.notHungry', { name: pet0.name }), true);
  }

  const next = cloneState(state);
  const pet = next.pet!;
  const needed = pet.needs.satiety < XP_NEEDED_BELOW.satiety;
  next.inventory.food[foodId] = (next.inventory.food[foodId] ?? 0) - 1;
  applyEffects(pet, food.effects);
  const favorite = food.favoriteOf?.includes(pet.species) ?? false;
  if (favorite) applyEffects(pet, { happiness: FAVORITE_FOOD_HAPPINESS_BONUS });
  pet.stats.feeds += 1;

  const events: GameEvent[] = [{ type: 'activity', activity: 'eat', itemId: foodId }];
  if (favorite) events.push({ type: 'message', text: t('msg.loves', { name: pet.name, food: food.name }), tone: 'good' });
  events.push(...grantActionXp(next, 'feed', now, needed));
  return { ok: true, state: next, events };
}

export function giveWater(state: GameState, now: number): ActionResult {
  const blocked = requireAwakePet(state);
  if (blocked) return fail(blocked);
  if (state.pet!.needs.hydration >= REFUSE_ABOVE.hydration) {
    return fail(t('msg.notThirsty', { name: state.pet!.name }), true);
  }
  const next = cloneState(state);
  const pet = next.pet!;
  const needed = pet.needs.hydration < XP_NEEDED_BELOW.hydration;
  applyEffects(pet, WATER_EFFECTS);
  pet.stats.drinks += 1;
  const events: GameEvent[] = [{ type: 'activity', activity: 'drink' }];
  events.push(...grantActionXp(next, 'water', now, needed));
  return { ok: true, state: next, events };
}

export function play(state: GameState, toyId: string, now: number): ActionResult {
  const blocked = requireAwakePet(state);
  if (blocked) return fail(blocked);
  const toy = getToy(toyId);
  const pet0 = state.pet!;
  if (!toy || !toy.species.includes(pet0.species)) return fail(t('msg.toyUnavailable'));
  if (!state.unlockedToys.includes(toyId)) return fail(t('msg.toyLocked', { toy: toy.name, level: toy.unlockLevel }));
  if (pet0.needs.energy < PLAY_MIN_ENERGY) return fail(t('msg.tooTired', { name: pet0.name }), true);
  const illness = pet0.illness ? getIllness(pet0.illness.id) : undefined;
  if (illness?.blocksPlay) return fail(t('msg.tooSick', { name: pet0.name }), true);

  const next = cloneState(state);
  const pet = next.pet!;
  applyEffects(pet, toy.effects);
  pet.stats.plays += 1;
  const events: GameEvent[] = [{ type: 'activity', activity: 'play', itemId: toyId }];
  // Playing is always "needed" as long as the pet is not overjoyed already.
  events.push(...grantActionXp(next, 'play', now, pet0.needs.happiness < 95, toy.bonusXp));
  return { ok: true, state: next, events };
}

export function petAnimal(state: GameState, now: number): ActionResult {
  if (!state.pet) return fail(t('msg.noPet'));
  const next = cloneState(state);
  const pet = next.pet!;
  const gentle = pet.isSleeping;
  applyEffects(pet, gentle ? { happiness: PET_EFFECTS.happiness! / 2 } : PET_EFFECTS);
  pet.stats.pets += 1;
  const events: GameEvent[] = [{ type: 'activity', activity: 'petted' }];
  events.push(...grantActionXp(next, 'pet', now, true));
  return { ok: true, state: next, events };
}

export function bathe(state: GameState, now: number): ActionResult {
  const blocked = requireAwakePet(state);
  if (blocked) return fail(blocked);
  if (state.pet!.needs.hygiene >= REFUSE_ABOVE.hygiene) {
    return fail(t('msg.alreadyClean', { name: state.pet!.name }), true);
  }
  const next = cloneState(state);
  const pet = next.pet!;
  const species = getSpecies(pet.species);
  const needed = pet.needs.hygiene < XP_NEEDED_BELOW.hygiene;
  applyEffects(pet, BATH_EFFECTS);
  applyEffects(pet, { happiness: species.bathHappiness });
  pet.stats.baths += 1;
  const events: GameEvent[] = [{ type: 'activity', activity: 'bath' }];
  events.push(...grantActionXp(next, 'bathe', now, needed));
  return { ok: true, state: next, events };
}

export function putToSleep(state: GameState, now: number): ActionResult {
  const blocked = requireAwakePet(state);
  if (blocked) return fail(state.pet?.isSleeping ? t('msg.alreadyAsleep', { name: state.pet.name }) : blocked);
  if (state.pet!.needs.energy > REFUSE_ABOVE.energyForSleep) {
    return fail(t('msg.notSleepy', { name: state.pet!.name }), true);
  }
  const next = cloneState(state);
  const pet = next.pet!;
  const needed = pet.needs.energy < XP_NEEDED_BELOW.energyForSleep;
  pet.isSleeping = true;
  pet.stats.sleeps += 1;
  const events: GameEvent[] = [{ type: 'activity', activity: 'sleep' }];
  events.push(...grantActionXp(next, 'sleep', now, needed));
  return { ok: true, state: next, events };
}

export function wakeUp(state: GameState): ActionResult {
  if (!state.pet) return fail(t('msg.noPet'));
  if (!state.pet.isSleeping) return fail(t('msg.alreadyAwake', { name: state.pet.name }));
  const next = cloneState(state);
  const pet = next.pet!;
  pet.isSleeping = false;
  const events: GameEvent[] = [{ type: 'activity', activity: 'wake' }];
  if (pet.needs.energy < GRUMPY_WAKE.energyBelow) {
    applyEffects(pet, { happiness: GRUMPY_WAKE.happiness });
    events.push({ type: 'message', text: t('msg.grumpy', { name: pet.name }), tone: 'bad' });
  }
  return { ok: true, state: next, events };
}

export function buyFood(state: GameState, foodId: string): ActionResult {
  const food = getFood(foodId);
  if (!food) return fail(t('msg.unknownFood'));
  if (state.coins < food.packPrice) return fail(t('msg.noCoinsFor', { item: food.name }));
  const next = cloneState(state);
  next.coins -= food.packPrice;
  next.inventory.food[foodId] = (next.inventory.food[foodId] ?? 0) + food.packSize;
  return {
    ok: true,
    state: next,
    events: [
      { type: 'coins', amount: -food.packPrice },
      { type: 'message', text: t('msg.bought', { n: food.packSize, food: food.name }), tone: 'good' },
    ],
  };
}
