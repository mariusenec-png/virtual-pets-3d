import type { RigAnimInput } from '../rig/animator';

/**
 * Per-frame motion state shared between Pet (which decides where the pet
 * goes and what it does) and PetModel (which animates the skeleton).
 */
export interface PetMotion {
  input: RigAnimInput;
  /** Set by PetModel while a rigged model is shown. */
  rigged: boolean;
}

export function createPetMotion(height: number): PetMotion {
  return {
    rigged: false,
    input: {
      time: 0,
      speed: 0,
      height,
      activity: null,
      progress: 0,
      arrived: true,
      sleeping: false,
      unwell: false,
      happiness: 100,
      hop: 0,
      flinch: 0,
    },
  };
}
