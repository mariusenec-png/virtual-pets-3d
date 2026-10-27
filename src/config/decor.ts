import type { SpeciesId } from '../game/types';
import { t, type MessageKey } from '../i18n';

/**
 * Room decoration catalog. Everything is built from procedural geometry in
 * src/scene/decor, so no external assets are needed. Items are bought once
 * with coins and shared by every pet in the home.
 */

export type DecorKind = 'furniture' | 'wall' | 'floor' | 'rug';

/** What a pet can do with a piece of furniture (see src/scene/pet/behaviors.ts). */
export interface DecorInteraction {
  species: SpeciesId[];
  /** Skeleton animation played there. */
  anim: 'rest' | 'watch' | 'scratch' | 'watchItem';
  /** Spot relative to the item (x right, z towards the room), meters. */
  offset: [number, number];
  /** Height of the surface the pet stands on there (0 = floor). */
  height: number;
  /** Radius of that surface (the pet steps up when inside it). */
  radius: number;
  /** Face the item (true) or the camera (false) once there. */
  faceItem: boolean;
  /** Relative chance compared to the built-in behaviors (about 1..3). */
  weight: number;
  /** Seconds spent there. */
  duration: [number, number];
}

export interface DecorItem {
  id: string;
  kind: DecorKind;
  icon: string;
  readonly name: string;
  price: number;
  /** Furniture only: lowers happiness decay (summed, capped by ROOM.maxComfort). */
  comfort?: number;
  interaction?: DecorInteraction;
  /** Themes: colors used by the room. */
  colors?: { main: string; accent?: string };
  /** Light emitted (floor lamp). */
  light?: { color: string; intensity: number; height: number };
}

function item(def: Omit<DecorItem, 'name'>): DecorItem {
  return {
    ...def,
    get name() {
      return t(`decor.${def.id}` as MessageKey);
    },
  };
}

export const DECOR_ITEMS: DecorItem[] = [
  // Furniture
  item({
    id: 'box',
    kind: 'furniture',
    icon: '📦',
    price: 15,
    comfort: 0.02,
    interaction: { species: ['cat'], anim: 'rest', offset: [0, 0], height: 0.02, radius: 0.18, faceItem: false, weight: 2.5, duration: [10, 18] },
  }),
  item({
    id: 'cushion',
    kind: 'furniture',
    icon: '🟣',
    price: 40,
    comfort: 0.04,
    interaction: { species: ['cat', 'dog'], anim: 'rest', offset: [0, 0], height: 0.11, radius: 0.3, faceItem: false, weight: 2, duration: [10, 18] },
  }),
  item({
    id: 'scratchPost',
    kind: 'furniture',
    icon: '🪵',
    price: 45,
    comfort: 0.03,
    interaction: { species: ['cat'], anim: 'scratch', offset: [0, 0.3], height: 0, radius: 0, faceItem: true, weight: 2, duration: [3, 5] },
  }),
  item({
    id: 'catTree',
    kind: 'furniture',
    icon: '🐈',
    price: 120,
    comfort: 0.06,
    interaction: { species: ['cat'], anim: 'watch', offset: [0, 0], height: 0.82, radius: 0.22, faceItem: false, weight: 3, duration: [10, 18] },
  }),
  item({
    id: 'kennel',
    kind: 'furniture',
    icon: '🏠',
    price: 110,
    comfort: 0.06,
    interaction: { species: ['dog'], anim: 'rest', offset: [0, 0.5], height: 0, radius: 0, faceItem: false, weight: 3, duration: [10, 18] },
  }),
  item({
    id: 'armchair',
    kind: 'furniture',
    icon: '🛋️',
    price: 90,
    comfort: 0.04,
    interaction: { species: ['cat'], anim: 'rest', offset: [0, 0.05], height: 0.4, radius: 0.24, faceItem: false, weight: 2, duration: [10, 16] },
  }),
  item({
    id: 'aquarium',
    kind: 'furniture',
    icon: '🐠',
    price: 150,
    comfort: 0.05,
    interaction: { species: ['cat', 'dog'], anim: 'watchItem', offset: [0, 0.55], height: 0, radius: 0, faceItem: true, weight: 2.5, duration: [8, 14] },
  }),
  item({ id: 'bigPlant', kind: 'furniture', icon: '🪴', price: 35, comfort: 0.02 }),
  item({
    id: 'floorLamp',
    kind: 'furniture',
    icon: '💡',
    price: 50,
    comfort: 0.02,
    light: { color: '#ffd9a0', intensity: 2.2, height: 1.45 },
  }),
  item({ id: 'bookshelf', kind: 'furniture', icon: '📚', price: 70, comfort: 0.02 }),

  // Wall colors
  item({ id: 'wallCream', kind: 'wall', icon: '🟨', price: 0, colors: { main: '#efe3d3', accent: '#d9c7b0' } }),
  item({ id: 'wallSage', kind: 'wall', icon: '🟩', price: 30, colors: { main: '#d6e2cf', accent: '#a9bd9f' } }),
  item({ id: 'wallSky', kind: 'wall', icon: '🟦', price: 30, colors: { main: '#d4e4ef', accent: '#a5bfd2' } }),
  item({ id: 'wallBlush', kind: 'wall', icon: '🩷', price: 30, colors: { main: '#f2dcd8', accent: '#d8b3ad' } }),
  item({ id: 'wallLavender', kind: 'wall', icon: '🟪', price: 30, colors: { main: '#e3dbef', accent: '#bfb1d6' } }),
  item({ id: 'wallSunny', kind: 'wall', icon: '🌼', price: 30, colors: { main: '#f6e7b8', accent: '#dcc68a' } }),

  // Floors
  item({ id: 'floorOak', kind: 'floor', icon: '🪵', price: 0, colors: { main: '#c69a6d' } }),
  item({ id: 'floorWalnut', kind: 'floor', icon: '🟫', price: 40, colors: { main: '#8a5f3c' } }),
  item({ id: 'floorBirch', kind: 'floor', icon: '🤍', price: 40, colors: { main: '#e6d2b3' } }),
  item({ id: 'floorTiles', kind: 'floor', icon: '🏁', price: 40, colors: { main: '#e9e4dc', accent: '#c9bfb1' } }),

  // Rugs
  item({ id: 'rugSand', kind: 'rug', icon: '🟠', price: 0, colors: { main: '#e9c9a8', accent: '#d4a27c' } }),
  item({ id: 'rugTeal', kind: 'rug', icon: '🔵', price: 25, colors: { main: '#9cc7c3', accent: '#5f9e98' } }),
  item({ id: 'rugRose', kind: 'rug', icon: '🌸', price: 25, colors: { main: '#efbfc4', accent: '#d48a94' } }),
  item({ id: 'rugGrey', kind: 'rug', icon: '⚪', price: 25, colors: { main: '#d5d2cd', accent: '#a9a49c' } }),
];

export function getDecor(id: string): DecorItem | undefined {
  return DECOR_ITEMS.find((d) => d.id === id);
}

export function decorOfKind(kind: DecorKind): DecorItem[] {
  return DECOR_ITEMS.filter((d) => d.kind === kind);
}

/** Places along the walls where furniture can stand (x, z in meters). */
export interface DecorSlot {
  id: string;
  position: [number, number];
}

export const DECOR_SLOTS: DecorSlot[] = [
  { id: 'backLeft', position: [-2.3, -1.15] },
  { id: 'backCenter', position: [-1.45, -1.45] },
  { id: 'backMid', position: [0.45, -2.0] },
  { id: 'backRight', position: [1.95, -1.85] },
  { id: 'right', position: [2.1, -0.35] },
  { id: 'left', position: [-1.95, -0.45] },
];

export function getSlot(id: string): DecorSlot | undefined {
  return DECOR_SLOTS.find((s) => s.id === id);
}

/** Furniture faces the middle of the rug. */
export function slotRotation(slot: DecorSlot): number {
  return Math.atan2(0 - slot.position[0], 0.15 - slot.position[1]);
}

export const ROOM = {
  /** Maximum happiness-decay reduction from furniture (0.3 = 30%). */
  maxComfort: 0.3,
  defaults: { wall: 'wallCream', floor: 'floorOak', rug: 'rugSand' },
} as const;
