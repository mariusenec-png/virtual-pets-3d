import type { GrowthStage, NeedId, SpeciesId } from '../game/types';
import type { CoatStyle } from '../scene/coat/coatTypes';
import type { RigConfig } from '../scene/rig/rigTypes';
import type { MouthConfig } from '../scene/pet/mouthTypes';

/**
 * A species definition describes everything species-specific: the 3D asset,
 * how to normalize it, how it looks at each growth stage, and gameplay
 * modifiers. Adding a new animal means adding one of these files and
 * registering it; the core game does not need to change.
 */

export interface SpeciesModelConfig {
  /** Path under /public. */
  url: string;
  /** Rotation (radians, around Y) that makes the model face +Z (the camera). */
  rotationY: number;
  /** Mesh names (regex, case-insensitive) treated as eye parts for per-stage eye scaling. */
  eyePartPattern: string;
  /** Whether the model ships skeletal animation clips. */
  hasSkeletalAnimations: boolean;
  /** Human-readable note about the asset (origin/limitations). */
  note: string;
}

export interface StageAppearance {
  /** Target height of the pet in world units (meters) at this stage. */
  height: number;
  /** Scale applied to eye parts (babies have relatively bigger eyes). */
  eyeScale: number;
  /** Body proportions [width, height, length] on top of the height scale. */
  proportions: [number, number, number];
  /** Fur length multiplier (babies are fluffier). */
  furLength: number;
  /** Fur density multiplier (lower = softer, wispier fur). */
  furDensity: number;
}

export interface PlaceholderColors {
  body: string;
  belly: string;
  ears: string;
  nose: string;
}

/** Shell-fur look for the species (see src/scene/fur/furShells.ts). */
export interface FurStyle {
  /** Name of the mesh that gets fur; defaults to the mesh with the most vertices. */
  bodyMeshName?: string;
  /** Fur length as a fraction of the model height. */
  lengthRatio: number;
  /** Strands per model height (higher = finer). */
  densityPerHeight: number;
  /** How much the tips droop (fraction of fur length). */
  gravity: number;
  /** Brightness at the roots (0..1). */
  rootShade: number;
  /** Random brightness variation between strands (0..1). */
  strandVariation: number;
  /** How much strands lie down along the body, head to tail (fraction of length). */
  comb: number;
  /** How much strand tips gather into tufts (0..1). */
  clump: number;
  /** Soft back-light glow on the silhouette (0..1). */
  rim: number;
  /** Silky highlight across the strands (0..1). */
  sheen: number;
  /** Fur length per body region (1 = lengthRatio). */
  profile: { body: number; legs: number; head: number; tail: number; chest: number; belly: number };
}

export interface SpeciesDefinition {
  id: SpeciesId;
  name: string;
  icon: string;
  /** Selectable in the new-pet flow. */
  available: boolean;
  unavailableReason?: string;
  model: SpeciesModelConfig;
  /**
   * Landmarks for the automatic skeleton (the models ship without one).
   * Without it the pet is animated by moving the whole model.
   */
  rig?: RigConfig;
  /** Opening mouth (needs a rig: it follows the head bone). */
  mouth?: MouthConfig;
  /** Procedural markings painted on skin and fur (tabby stripes, belly...). */
  coat?: CoatStyle;
  stages: Record<GrowthStage, StageAppearance>;
  fur: FurStyle;
  placeholder: PlaceholderColors & { earShape: 'pointy' | 'floppy'; tailLength: number };
  /** Multipliers on base decay rates (1 = unchanged). */
  decayMultipliers: Partial<Record<NeedId, number>>;
  /** Happiness change applied by a bath (cats dislike baths). */
  bathHappiness: number;
  /** Short reaction texts used for feedback. */
  reactions: {
    happy: string;
    eat: string;
    play: string;
    petted: string;
    bath: string;
    sleep: string;
    refuse: string;
  };
}
