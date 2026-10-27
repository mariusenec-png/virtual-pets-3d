import { DAILY_REWARDS } from '../config/minigames';
import type { Household } from './types';

/**
 * Daily login reward. Claiming on consecutive calendar days (local time)
 * builds a streak of up to 7 days, then it starts over.
 */

/** Local calendar day key, e.g. "2026-10-27". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function previousDayKey(ts: number): string {
  const d = new Date(ts);
  d.setDate(d.getDate() - 1);
  return dayKey(d.getTime());
}

export interface DailyStatus {
  available: boolean;
  /** Streak day (1..7) that claiming today would give. */
  day: number;
  coins: number;
  food: { id: string; amount: number } | null;
}

export function dailyStatus(h: Household, now: number): DailyStatus {
  const today = dayKey(now);
  const available = h.daily.lastClaimDay !== today;
  const continues = h.daily.lastClaimDay === previousDayKey(now);
  const len = DAILY_REWARDS.coins.length;
  // Shown day: next streak day if claimable, otherwise the day already claimed.
  const day = available ? (continues ? (h.daily.streak % len) + 1 : 1) : Math.max(1, h.daily.streak);
  return {
    available,
    day,
    coins: DAILY_REWARDS.coins[day - 1],
    food: day === len ? DAILY_REWARDS.day7Food : null,
  };
}

export function claimDaily(h: Household, now: number): { household: Household; status: DailyStatus } | null {
  const status = dailyStatus(h, now);
  if (!status.available) return null;
  const food = { ...h.inventory.food };
  if (status.food) food[status.food.id] = (food[status.food.id] ?? 0) + status.food.amount;
  return {
    status,
    household: {
      ...h,
      coins: h.coins + status.coins,
      inventory: { ...h.inventory, food },
      daily: { lastClaimDay: dayKey(now), streak: status.day },
    },
  };
}
