import type { RigConfig } from '../scene/rig/rigTypes';

/**
 * Auto-rig landmarks for the supplied models, measured from their geometry
 * (normalized model space: facing +Z, feet at y = 0, 1 unit tall).
 * See src/scene/rig/autoRig.ts.
 */

export const CAT_RIG: RigConfig = {
  landmarks: {
    pelvis: [0, 0.4, -0.17],
    spine: [0, 0.42, 0.02],
    chest: [0, 0.42, 0.2],
    neck: [0, 0.5, 0.28],
    head: [0, 0.6, 0.36],
    headEnd: [0, 0.58, 0.52],
    shoulder: [0.105, 0.33, 0.25],
    elbow: [0.105, 0.17, 0.26],
    wrist: [0.105, 0.04, 0.27],
    frontToe: [0.105, 0, 0.32],
    hip: [0.105, 0.36, -0.17],
    knee: [0.105, 0.2, -0.15],
    hock: [0.105, 0.1, -0.24],
    hindToe: [0.105, 0.02, -0.21],
    tail: [
      [0, 0.52, -0.42],
      [0, 0.58, -0.48],
      [0, 0.7, -0.5],
      [0, 0.82, -0.49],
      [0.02, 0.97, -0.47],
    ],
    // From the inner-ear meshes.
    ear: { base: [0.075, 0.655, 0.39], tip: [0.09, 0.75, 0.385], radius: 0.03 },
  },
  regions: { legTop: 0.3, tailStartZ: -0.4, neckZ: 0.24 },
};

export const DOG_RIG: RigConfig = {
  landmarks: {
    pelvis: [0, 0.48, -0.3],
    spine: [0, 0.5, -0.05],
    chest: [0, 0.5, 0.2],
    neck: [0, 0.58, 0.32],
    head: [0, 0.72, 0.42],
    headEnd: [0, 0.7, 0.74],
    shoulder: [0.1, 0.38, 0.28],
    elbow: [0.1, 0.22, 0.3],
    wrist: [0.1, 0.07, 0.31],
    frontToe: [0.1, 0, 0.36],
    hip: [0.1, 0.4, -0.28],
    knee: [0.1, 0.22, -0.27],
    hock: [0.1, 0.1, -0.34],
    hindToe: [0.1, 0, -0.3],
    tail: [
      [0, 0.52, -0.47],
      [0, 0.58, -0.58],
      [0, 0.65, -0.66],
      [0, 0.72, -0.71],
      [0, 0.81, -0.745],
    ],
    ear: { base: [0.08, 0.855, 0.42], tip: [0.09, 0.995, 0.42], radius: 0.05 },
  },
  regions: { legTop: 0.33, tailStartZ: -0.45, neckZ: 0.28 },
};
