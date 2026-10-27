import { DECOR_SLOTS, getDecor, slotRotation } from '../../config/decor';
import type { RoomState, SpeciesId } from '../../game/types';
import type { FurnitureSpot, Vec2 } from '../pet/behaviors';

/** A raised surface pets step onto (bed pad, cushion, cat tree top...). */
export interface Surface {
  x: number;
  z: number;
  radius: number;
  height: number;
}

/** Converts an offset in the item's local space (z towards the room) to world x/z. */
function toWorld(slot: Vec2, angle: number, offset: Vec2): Vec2 {
  const [x, z] = offset;
  return [slot[0] + x * Math.cos(angle) + z * Math.sin(angle), slot[1] - x * Math.sin(angle) + z * Math.cos(angle)];
}

/** Places where the furniture in the room invites this species to do something. */
export function furnitureSpots(room: RoomState, species: SpeciesId): FurnitureSpot[] {
  const spots: FurnitureSpot[] = [];
  for (const slot of DECOR_SLOTS) {
    const item = getDecor(room.placed[slot.id] ?? '');
    const it = item?.interaction;
    if (!item || !it || !it.species.includes(species)) continue;
    const angle = slotRotation(slot);
    spots.push({
      itemId: item.id,
      anim: it.anim,
      target: toWorld(slot.position, angle, it.offset),
      face: it.faceItem ? slot.position : 'camera',
      weight: it.weight,
      duration: it.duration,
    });
  }
  return spots;
}

/** Raised surfaces of the placed furniture. */
export function furnitureSurfaces(room: RoomState): Surface[] {
  const out: Surface[] = [];
  for (const slot of DECOR_SLOTS) {
    const it = getDecor(room.placed[slot.id] ?? '')?.interaction;
    if (!it || it.height <= 0 || it.radius <= 0) continue;
    const [x, z] = toWorld(slot.position, slotRotation(slot), it.offset);
    out.push({ x, z, radius: it.radius, height: it.height });
  }
  return out;
}
