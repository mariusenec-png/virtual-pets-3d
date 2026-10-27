import { describe, expect, it } from 'vitest';
import { getSlot } from '../../../config/decor';
import { defaultRoom } from '../../../game/decor';
import type { RoomState } from '../../../game/types';
import { planBehavior } from '../../pet/behaviors';
import { furnitureSpots, furnitureSurfaces } from '../furnitureSpots';

function room(placed: Record<string, string>): RoomState {
  const r = defaultRoom();
  return { ...r, owned: [...r.owned, ...Object.values(placed)], placed };
}

describe('furniture spots', () => {
  it('only offers furniture the species likes', () => {
    const r = room({ backLeft: 'catTree', right: 'kennel', backMid: 'bookshelf' });
    const cat = furnitureSpots(r, 'cat');
    const dog = furnitureSpots(r, 'dog');
    expect(cat.map((s) => s.itemId)).toEqual(['catTree']);
    expect(dog.map((s) => s.itemId)).toEqual(['kennel']);
    // The cat tree spot is the top of the tree itself.
    const slot = getSlot('backLeft')!;
    expect(cat[0].target[0]).toBeCloseTo(slot.position[0], 5);
    expect(cat[0].target[1]).toBeCloseTo(slot.position[1], 5);
    // The kennel spot is in front of the door, towards the room.
    const k = getSlot('right')!;
    expect(Math.hypot(dog[0].target[0], dog[0].target[1] - 0.15)).toBeLessThan(Math.hypot(k.position[0], k.position[1] - 0.15));
  });

  it('lists raised surfaces', () => {
    const s = furnitureSurfaces(room({ backLeft: 'catTree', left: 'cushion', backMid: 'scratchPost' }));
    expect(s.map((x) => x.height).sort()).toEqual([0.11, 0.82]);
  });

  it('the planner can choose furniture', () => {
    const r = room({ backLeft: 'catTree' });
    const b = planBehavior(
      {
        species: 'cat',
        personality: 'curious',
        needs: { satiety: 80, hydration: 80, energy: 80, hygiene: 80, happiness: 80, health: 100 },
        unwell: false,
        position: [0, 0],
        furniture: furnitureSpots(r, 'cat'),
      },
      () => 0,
    );
    expect(b.kind).toBe('furniture');
    expect(b.anim).toBe('watch');
  });
});
