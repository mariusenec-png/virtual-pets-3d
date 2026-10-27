import type { GrowthStage, NeedId, SpeciesId } from '../game/types';

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
}

export interface SpeciesDefinition {
  id: SpeciesId;
  name: string;
  icon: string;
  /** Selectable in the new-pet flow. */
  available: boolean;
  unavailableReason?: string;
  model: SpeciesModelConfig;
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
