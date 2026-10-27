import { DECOR_SLOTS, getDecor, getSlot, ROOM, type DecorKind } from '../config/decor';
import { t } from '../i18n';
import type { Household, RoomState } from './types';

/**
 * Room decoration rules: buying decor, placing furniture in slots and
 * choosing wall/floor/rug themes. Pure functions on the Household.
 */

export type DecorResult = { ok: true; household: Household } | { ok: false; reason: string };

export function defaultRoom(): RoomState {
  return {
    wall: ROOM.defaults.wall,
    floor: ROOM.defaults.floor,
    rug: ROOM.defaults.rug,
    owned: [ROOM.defaults.wall, ROOM.defaults.floor, ROOM.defaults.rug],
    placed: {},
  };
}

export function ownsDecor(room: RoomState, id: string): boolean {
  const item = getDecor(id);
  return !!item && (item.price === 0 || room.owned.includes(id));
}

/** Slot where an item is placed, if any. */
export function slotOf(room: RoomState, id: string): string | null {
  for (const [slot, placed] of Object.entries(room.placed)) if (placed === id) return slot;
  return null;
}

/** Happiness-decay reduction from placed furniture (0..ROOM.maxComfort). */
export function roomComfort(room: RoomState): number {
  let sum = 0;
  for (const id of Object.values(room.placed)) sum += getDecor(id)?.comfort ?? 0;
  return Math.min(ROOM.maxComfort, Math.round(sum * 1000) / 1000);
}

export function buyDecor(h: Household, id: string): DecorResult {
  const item = getDecor(id);
  if (!item) return { ok: false, reason: t('decor.errUnknown') };
  if (ownsDecor(h.room, id)) return { ok: false, reason: t('decor.errOwned', { item: item.name }) };
  if (h.coins < item.price) return { ok: false, reason: t('decor.errCoins', { item: item.name, price: item.price }) };
  let room: RoomState = { ...h.room, owned: [...h.room.owned, id] };
  // A new theme is applied right away; new furniture goes to the first free slot.
  if (item.kind !== 'furniture') room = { ...room, [item.kind]: id };
  else {
    const free = DECOR_SLOTS.find((s) => !room.placed[s.id]);
    if (free) room = { ...room, placed: { ...room.placed, [free.id]: id } };
  }
  return { ok: true, household: { ...h, coins: h.coins - item.price, room } };
}

/** Puts owned furniture in a slot. The previous occupant goes back to storage. */
export function placeDecor(h: Household, id: string, slotId: string): DecorResult {
  const item = getDecor(id);
  if (!item || item.kind !== 'furniture') return { ok: false, reason: t('decor.errUnknown') };
  if (!ownsDecor(h.room, id)) return { ok: false, reason: t('decor.errNotOwned', { item: item.name }) };
  if (!getSlot(slotId)) return { ok: false, reason: t('decor.errSlot') };
  const placed = { ...h.room.placed };
  const from = slotOf(h.room, id);
  if (from) delete placed[from];
  placed[slotId] = id;
  return { ok: true, household: { ...h, room: { ...h.room, placed } } };
}

/** Moves the furniture in a slot back to storage. */
export function removeDecor(h: Household, slotId: string): Household {
  if (!h.room.placed[slotId]) return h;
  const placed = { ...h.room.placed };
  delete placed[slotId];
  return { ...h, room: { ...h.room, placed } };
}

/** Selects an owned wall/floor/rug theme. */
export function setTheme(h: Household, kind: Exclude<DecorKind, 'furniture'>, id: string): DecorResult {
  const item = getDecor(id);
  if (!item || item.kind !== kind) return { ok: false, reason: t('decor.errUnknown') };
  if (!ownsDecor(h.room, id)) return { ok: false, reason: t('decor.errNotOwned', { item: item.name }) };
  return { ok: true, household: { ...h, room: { ...h.room, [kind]: id } } };
}

/** Validates an untrusted room (from a save). */
export function sanitizeRoom(raw: unknown): RoomState {
  const room = defaultRoom();
  if (!raw || typeof raw !== 'object') return room;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.owned)) {
    for (const id of r.owned) {
      if (typeof id === 'string' && getDecor(id) && !room.owned.includes(id)) room.owned.push(id);
    }
  }
  for (const kind of ['wall', 'floor', 'rug'] as const) {
    const id = r[kind];
    if (typeof id === 'string' && getDecor(id)?.kind === kind && ownsDecor(room, id)) room[kind] = id;
  }
  if (r.placed && typeof r.placed === 'object') {
    const used = new Set<string>();
    for (const [slot, id] of Object.entries(r.placed as Record<string, unknown>)) {
      if (typeof id !== 'string' || !getSlot(slot) || used.has(id)) continue;
      const item = getDecor(id);
      if (item?.kind !== 'furniture' || !ownsDecor(room, id)) continue;
      room.placed[slot] = id;
      used.add(id);
    }
  }
  return room;
}
