import type { ActivityKind } from '../../game/types';
import { pounceCycle } from '../rig/animator';

/**
 * Procedural pose generator. The supplied models have no skeleton, so
 * every reaction is expressed by moving/tilting/squashing the whole model.
 * Units: offsets are relative to pet height (1 = full height).
 */

export interface Pose {
  /** Vertical offset (fraction of pet height). */
  lift: number;
  /** Forward lean in radians (positive = towards the face). */
  pitch: number;
  /** Side roll in radians. */
  roll: number;
  /** Extra yaw on top of the movement heading. */
  yaw: number;
  scaleY: number;
  scaleXZ: number;
  /** Sideways offset (fraction of pet height), used to roll around the body center. */
  side: number;
}

export const NEUTRAL_POSE: Pose = { lift: 0, pitch: 0, roll: 0, yaw: 0, scaleY: 1, scaleXZ: 1, side: 0 };

export interface PoseInput {
  /** Seconds, continuously increasing. */
  time: number;
  /** Current activity, if any, and its 0..1 progress. */
  activity: ActivityKind | null;
  /** Item of the activity (trick id for tricks). */
  itemId?: string | null;
  progress: number;
  /** Whether the pet has reached its activity spot. */
  arrived: boolean;
  walking: boolean;
  sleeping: boolean;
  unwell: boolean;
}

export function computePose(i: PoseInput): Pose {
  const t = i.time;
  const p = i.progress;
  const pose: Pose = { ...NEUTRAL_POSE };

  // Breathing is always present.
  const breath = Math.sin(t * (i.sleeping ? 1.3 : 2.2));
  pose.scaleY = 1 + breath * (i.sleeping ? 0.025 : 0.018);
  pose.scaleXZ = 1 - breath * 0.008;

  if (i.walking) {
    pose.lift = Math.abs(Math.sin(t * 11)) * 0.05;
    pose.roll = Math.sin(t * 11) * 0.05;
    return pose;
  }

  if (i.sleeping && i.activity !== 'wake') {
    pose.scaleY *= 0.74;
    pose.scaleXZ *= 1.1;
    pose.roll = 0.22;
    pose.pitch = 0.06;
    return pose;
  }

  switch (i.activity) {
    case 'eat':
      if (i.arrived) pose.pitch = 0.28 + Math.sin(t * 9) * 0.07;
      break;
    case 'drink':
      if (i.arrived) pose.pitch = 0.24 + Math.sin(t * 13) * 0.04;
      break;
    case 'play':
      pose.lift = Math.abs(Math.sin(t * 7)) * 0.22;
      pose.yaw = Math.sin(t * 3.2) * 0.9;
      pose.pitch = Math.sin(t * 7) * 0.12;
      break;
    case 'petted':
      pose.scaleY *= 0.94 + Math.sin(t * 14) * 0.03;
      pose.scaleXZ *= 1.03;
      pose.roll = Math.sin(t * 6) * 0.09;
      break;
    case 'bath':
      // Sit still in the tub, then shake off the water at the end.
      if (p > 0.72) pose.roll = Math.sin(t * 42) * 0.14 * (1 - (p - 0.72) / 0.28);
      else pose.scaleY *= 0.96;
      break;
    case 'sleep':
      // Transition into lying down.
      pose.scaleY *= 1 - 0.26 * p;
      pose.scaleXZ *= 1 + 0.1 * p;
      pose.roll = 0.22 * p;
      break;
    case 'wake': {
      // Stretch up, then settle.
      const s = Math.sin(p * Math.PI);
      pose.scaleY *= 0.74 + 0.26 * Math.min(1, p * 2) + s * 0.08;
      pose.pitch = -0.18 * s;
      break;
    }
    case 'celebrate':
      pose.lift = Math.abs(Math.sin(p * Math.PI * 3)) * 0.4;
      pose.yaw = p * Math.PI * 2;
      break;
    case 'refuse':
      pose.yaw = Math.sin(t * 16) * 0.4 * (1 - p);
      pose.pitch = -0.08;
      break;
    default:
      // Idle: gentle look-around.
      pose.yaw = Math.sin(t * 0.45) * 0.28 + Math.sin(t * 1.3) * 0.05;
      if (i.unwell) {
        pose.roll = Math.sin(t * 1.4) * 0.07;
        pose.scaleY *= 0.95;
        pose.pitch = 0.08;
      }
  }
  return pose;
}

/**
 * Whole-body motion for rigged pets: the skeleton animator handles posture,
 * gait and breathing, so this only adds what bones cannot do (jumping off
 * the floor, spinning around).
 */
export function computeRiggedOuterPose(i: PoseInput): Pose {
  const pose: Pose = { ...NEUTRAL_POSE };
  if (i.walking) return pose;
  switch (i.activity) {
    case 'play':
      pose.lift = pounceCycle(i.time).lift;
      pose.yaw = Math.sin(i.time * 1.1) * 0.5;
      break;
    case 'celebrate':
      pose.lift = Math.abs(Math.sin(i.progress * Math.PI * 3)) * 0.35;
      pose.yaw = i.progress * Math.PI * 2;
      break;
    case 'trick':
      if (i.itemId === 'rollOver') {
        // Roll around the body's long axis, pivoting at the body center
        // (about a fifth of the height above the floor while lying).
        const u = Math.min(1, Math.max(0, (i.progress - 0.25) / 0.55));
        const theta = (u * u * (3 - 2 * u)) * Math.PI * 2;
        const c = 0.2;
        pose.roll = theta;
        pose.side = c * Math.sin(theta);
        pose.lift = c * (1 - Math.cos(theta));
      }
      break;
    default:
      break;
  }
  return pose;
}

/** Frame-rate independent exponential smoothing. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Smoothly turns towards a target angle along the shortest path. */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-lambda * dt));
}
