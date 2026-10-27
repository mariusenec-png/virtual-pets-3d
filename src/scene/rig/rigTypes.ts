/**
 * Quadruped rig description. Joint positions are in NORMALIZED model space:
 * the model faces +Z, stands on y = 0, is centered on x/z and is exactly
 * 1 unit tall. Only left-side limbs (+x) are listed; the right side mirrors.
 */

export type Vec3 = [number, number, number];

export interface RigLandmarks {
  pelvis: Vec3;
  spine: Vec3;
  chest: Vec3;
  neck: Vec3;
  head: Vec3;
  headEnd: Vec3;
  shoulder: Vec3;
  elbow: Vec3;
  wrist: Vec3;
  frontToe: Vec3;
  hip: Vec3;
  knee: Vec3;
  hock: Vec3;
  hindToe: Vec3;
  /** Tail joints from base to tip (the last point is the tail end). */
  tail: Vec3[];
  /** Left ear (base on the head, tip); the right ear mirrors. Optional. */
  ear?: { base: Vec3; tip: Vec3; radius: number };
}

export interface RigRegions {
  /** Below this height, vertices belong to the legs. */
  legTop: number;
  /** Behind this z (and above legTop) vertices belong to the tail. */
  tailStartZ: number;
  /** In front of this z (and above legTop) vertices belong to the neck/head. */
  neckZ: number;
}

export interface RigConfig {
  landmarks: RigLandmarks;
  regions: RigRegions;
}

export type BoneName =
  | 'pelvis'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'shoulderL'
  | 'elbowL'
  | 'wristL'
  | 'shoulderR'
  | 'elbowR'
  | 'wristR'
  | 'hipL'
  | 'kneeL'
  | 'hockL'
  | 'hipR'
  | 'kneeR'
  | 'hockR'
  | 'earL'
  | 'earR'
  | `tail${number}`;
