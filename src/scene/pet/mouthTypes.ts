import type { Vec3 } from '../rig/rigTypes';

/** Mouth placement for a species (see mouth.ts). Kept free of three.js imports. */
export interface MouthConfig {
  /** Center of the mouth opening, normalized model space (facing +Z, 1 unit tall). */
  center: Vec3;
  /** Width and maximum open height of the mouth, normalized. */
  width: number;
  height: number;
  /** How far the tongue can stick out, normalized. */
  tongueLength: number;
}
