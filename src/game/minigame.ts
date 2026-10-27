import { getIllness } from '../config/illnesses';
import { CATCH_REWARDS as R } from '../config/minigames';
import { clampNeed } from './math';
import { applyXp } from './progression';
import { cloneState } from './simulation';
import type { ActionResult, GameEvent, GameState, NeedId } from './types';
import { t } from '../i18n';

/** Why the active pet cannot play a mini-game right now, or null if it can. */
export function minigameBlockedReason(state: GameState): string | null {
  const pet = state.pet;
  if (!pet) return t('mg.blockedNoPet');
  if (pet.isSleeping) return t('mg.blockedSleeping', { name: pet.name });
  const illness = pet.illness ? getIllness(pet.illness.id) : undefined;
  if (illness?.blocksPlay) return t('mg.blockedSick', { name: pet.name });
  if (pet.needs.energy < R.minEnergy) return t('mg.blockedTired', { name: pet.name });
  return null;
}

export interface CatchRoundResult {
  score: number;
  caught: number;
  bestCombo: number;
}

export interface CatchRewards {
  coins: number;
  xp: number;
  happiness: number;
}

export function catchRewards(score: number): CatchRewards {
  const s = Math.max(0, Math.floor(score));
  return {
    coins: Math.min(R.maxCoins, Math.floor(s * R.coinsPerPoint)),
    xp: Math.min(R.maxXp, R.baseXp + Math.floor(s / R.xpPerPoints)),
    happiness: Math.min(R.maxHappinessBonus, Math.round(s * R.happinessPerPoint)),
  };
}

/** Applies the result of a finished round: coins, XP and need changes. */
export function applyCatchRound(state: GameState, result: CatchRoundResult): ActionResult {
  if (!state.pet) return { ok: false, reason: t('msg.noPet'), events: [] };
  const next = cloneState(state);
  const pet = next.pet!;
  const rewards = catchRewards(result.score);
  const needs: Partial<Record<NeedId, number>> = { ...R.needs, happiness: (R.needs.happiness ?? 0) + rewards.happiness };
  for (const [id, delta] of Object.entries(needs) as [NeedId, number][]) {
    pet.needs[id] = clampNeed(pet.needs[id] + delta);
  }
  next.coins += rewards.coins;
  pet.stats.minigames += 1;
  pet.stats.bestCatch = Math.max(pet.stats.bestCatch, Math.floor(result.score));
  const events: GameEvent[] = [{ type: 'coins', amount: rewards.coins }];
  events.push(...applyXp(next, rewards.xp, 'minigame'));
  return { ok: true, state: next, events };
}
