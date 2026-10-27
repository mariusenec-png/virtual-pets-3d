import * as THREE from 'three';
import type { ActivityKind, SpeciesId } from '../../game/types';
import type { BehaviorAnim } from '../pet/behaviors';
import type { PetRig } from './autoRig';
import type { RigConfig } from './rigTypes';

/**
 * Procedural skeletal animation for the auto-rigged pets.
 *
 * Every frame the animator builds a target pose out of layers (posture,
 * gait, head look, tail, activity overlays), then eases each bone towards it
 * so transitions stay fluid. Angles are radians in bone-local space; because
 * the rest pose has no rotation, +X pitches a forward-pointing bone down and
 * swings a downward-pointing leg backwards, +Y turns to the pet's left.
 */

export interface RigAnimInput {
  /** Seconds, continuously increasing. */
  time: number;
  /** Ground speed in m/s. */
  speed: number;
  /** Pet height in meters (gait frequency scales with it). */
  height: number;
  activity: ActivityKind | null;
  /** Item of the activity (trick id for tricks). */
  itemId: string | null;
  /** Autonomous behavior being performed (only while idle and arrived). */
  behavior: BehaviorAnim | null;
  /** 0..1 progress of the behavior. */
  behaviorProgress: number;
  /** Trotting on the spot (spin trick, chasing the tail). */
  spinning: boolean;
  /** 0..1 progress of the activity. */
  progress: number;
  /** Whether the pet has reached its activity spot. */
  arrived: boolean;
  sleeping: boolean;
  unwell: boolean;
  /** 0..100 */
  happiness: number;
  /** 0..1 pulse after catching a treat in the mini-game. */
  hop: number;
  /** 0..1 pulse after touching a hazard in the mini-game. */
  flinch: number;
}

type Rot = [number, number, number];
type PoseMap = Record<string, Rot>;

const LEGS = ['L', 'R'] as const;

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function expDamp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Pounce cycle used by play (shared with the outer pose so jump and body stay in sync). */
export function pounceCycle(time: number): { crouch: number; jump: number; lift: number } {
  const u = (time % 1.7) / 1.7;
  if (u < 0.55) return { crouch: smooth01(u / 0.2), jump: 0, lift: 0 };
  if (u < 0.8) {
    const j = (u - 0.55) / 0.25;
    return { crouch: 1 - smooth01(j * 3), jump: Math.sin(Math.PI * j), lift: Math.sin(Math.PI * j) * 0.32 };
  }
  return { crouch: 0.4 * (1 - smooth01((u - 0.8) / 0.2)), jump: 0, lift: 0 };
}

// --- Static postures -------------------------------------------------------

function sym(map: PoseMap, base: string, r: Rot): void {
  for (const s of LEGS) map[`${base}${s}`] = r;
}

function sitPose(species: SpeciesId): PoseMap {
  const p: PoseMap = {
    pelvis: [-0.62, 0, 0],
    spine: [0.12, 0, 0],
    chest: [0.2, 0, 0],
    neck: [-0.05, 0, 0],
    head: [0.15, 0, 0],
    tail0: [-0.35, 0, 0],
    tail1: [-0.6, 0.5, 0],
    tail2: [0, 0.7, 0],
    tail3: [0, 0.7, 0],
  };
  sym(p, 'shoulder', [0.3, 0, 0]);
  sym(p, 'elbow', [0, 0, 0]);
  sym(p, 'hip', [-0.75, 0, 0]);
  sym(p, 'knee', [2.0, 0, 0]);
  sym(p, 'hock', [-0.65, 0, 0]);
  if (species === 'dog') {
    p.tail0 = [-0.45, 0, 0];
    p.tail1 = [-0.3, 0.2, 0];
    p.tail2 = [0, 0.3, 0];
    p.tail3 = [0, 0.3, 0];
  }
  return p;
}

function liePose(species: SpeciesId): PoseMap {
  // Curled "loaf": paws tucked under the chest, head turned towards the
  // tail, tail wrapped around the body.
  const p: PoseMap = {
    pelvis: [0.05, 0, 0],
    spine: [0, 0.25, 0],
    chest: [-0.05, 0.25, 0],
    neck: [0.35, 0.5, 0],
    head: [0.3, 0.4, 0.35],
    tail0: [-1.35, 0, 0],
    tail1: [-0.55, 0.7, 0],
    tail2: [0, 0.8, 0],
    tail3: [0, 0.8, 0],
  };
  sym(p, 'shoulder', [1.25, 0, 0]);
  sym(p, 'elbow', [-2.3, 0, 0]);
  sym(p, 'wrist', [0.4, 0, 0]);
  sym(p, 'hip', [-1.15, 0, 0]);
  sym(p, 'knee', [2.3, 0, 0]);
  sym(p, 'hock', [-1.1, 0, 0]);
  if (species === 'dog') {
    // Dogs sleep with the front legs stretched out and the head on the paws.
    sym(p, 'shoulder', [-1.35, 0, 0]);
    sym(p, 'elbow', [0.25, 0, 0]);
    sym(p, 'wrist', [-0.3, 0, 0]);
    p.spine = [0, 0.12, 0];
    p.chest = [0, 0.1, 0];
    p.neck = [0.55, 0.15, 0];
    p.head = [-0.15, 0.2, 0.15];
    p.tail0 = [-0.6, 0, 0];
    p.tail1 = [-0.3, 0.4, 0];
    p.tail2 = [0, 0.45, 0];
    p.tail3 = [0, 0.4, 0];
  }
  return p;
}

/** Lying "sphinx" with the head up and eyes open (resting, the "down" trick). */
function restPose(species: SpeciesId): PoseMap {
  const p = liePose(species);
  p.spine = [0, 0.04, 0];
  p.chest = [-0.05, 0.04, 0];
  p.neck = [-0.1, 0.1, 0];
  p.head = [0.1, 0.05, 0];
  if (species === 'dog') {
    p.neck = [-0.05, 0, 0];
    p.head = [0.05, 0, 0];
  }
  return p;
}

function crouchPose(): PoseMap {
  const p: PoseMap = { pelvis: [-0.12, 0, 0], chest: [0.08, 0, 0], neck: [-0.25, 0, 0], head: [-0.05, 0, 0] };
  sym(p, 'shoulder', [-0.55, 0, 0]);
  sym(p, 'elbow', [1.0, 0, 0]);
  sym(p, 'wrist', [-0.45, 0, 0]);
  sym(p, 'hip', [-0.6, 0, 0]);
  sym(p, 'knee', [1.2, 0, 0]);
  sym(p, 'hock', [-0.55, 0, 0]);
  return p;
}

/** Pelvis drop (normalized height units) for a posture. */
const SIT_DROP = 0.53;
const LIE_DROP = 0.58;
const CROUCH_DROP = 0.22;

// --- Animator --------------------------------------------------------------

export class RigAnimator {
  private readonly rig: PetRig;
  private readonly cfg: RigConfig;
  private readonly species: SpeciesId;
  private readonly sit: PoseMap;
  private readonly lie: PoseMap;
  private readonly rest: PoseMap;
  private readonly crouch: PoseMap = crouchPose();
  /** Eased bone rotations. */
  private readonly current = new Map<string, Rot>();
  private readonly target = new Map<string, Rot>();
  private readonly pelvisRest: THREE.Vector3;
  private pelvisY = 0;
  private pelvisZ = 0;
  // Smoothed layer weights.
  private walkW = 0;
  private sitW = 0;
  private lieW = 0;
  private restW = 0;
  private crouchW = 0;
  private phase = 0;
  private idleFor = 0;
  // Blinking.
  private nextBlink = 2;
  private blinkStart = -1;
  /** Eye openness (1 = open, ~0 = closed); applied by the caller to the eye groups. */
  blink = 1;
  /** Eyebrow expression, eased; applied by the caller with the eyes. */
  readonly brows = { raise: 0, worry: 0, quirk: 0 };
  private eyeOpen = 1;
  // Idle look target (changes every few seconds).
  private lookYaw = 0;
  private lookPitch = 0;
  private lookTilt = 0;
  private nextLook = 0;
  private rand: () => number;
  private readonly tailAxis = new Map<string, THREE.Vector3>();

  constructor(rig: PetRig, cfg: RigConfig, species: SpeciesId, seed = 1) {
    this.rig = rig;
    this.cfg = cfg;
    this.species = species;
    this.sit = sitPose(species);
    this.lie = liePose(species);
    this.rest = restPose(species);
    this.pelvisRest = rig.rest.get('pelvis')!.position.clone();
    for (const name of rig.bones.keys()) {
      this.current.set(name, [0, 0, 0]);
      this.target.set(name, [0, 0, 0]);
    }
    const tl = cfg.landmarks.tail;
    for (let k = 0; k < tl.length - 1; k++) {
      const d = new THREE.Vector3(tl[k + 1][0] - tl[k][0], tl[k + 1][1] - tl[k][1], tl[k + 1][2] - tl[k][2]).normalize();
      const axis = d.cross(new THREE.Vector3(1, 0, 0));
      if (axis.lengthSq() > 1e-6) this.tailAxis.set(`tail${k}`, axis.normalize());
    }
    let s = seed * 9301 + 49297;
    this.rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  /**
   * Adds a rotation to a bone's target. For tail bones `y` is a sideways
   * bend (towards the pet's left), converted to the axis that actually
   * swings that segment sideways: a vertical segment needs Z, a horizontal
   * one needs Y.
   */
  private add(name: string, x: number, y: number, z: number, w = 1): void {
    const t = this.target.get(name);
    if (!t) return;
    const lateral = this.tailAxis.get(name);
    t[0] += x * w;
    if (lateral) {
      t[1] += y * lateral.y * w;
      t[2] += (y * lateral.z + z) * w;
    } else {
      t[1] += y * w;
      t[2] += z * w;
    }
  }

  /** Same pitch on the left and right bone of a pair. */
  private sym(base: string, x: number): void {
    this.add(`${base}L`, x, 0, 0);
    this.add(`${base}R`, x, 0, 0);
  }

  private addPose(pose: PoseMap, w: number): void {
    if (w <= 1e-4) return;
    for (const name in pose) {
      const r = pose[name];
      this.add(name, r[0], r[1], r[2], w);
    }
  }

  update(i: RigAnimInput, rawDt: number): void {
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    const t = i.time;
    for (const r of this.target.values()) r.fill(0);
    const cat = this.species === 'cat';
    const act = i.activity;
    const sleeping = i.sleeping && act !== 'wake';
    const moving = i.speed > 0.05;
    const happy = i.happiness / 100;

    // ---- Posture weights ----
    const isIdle = !moving && !act && !sleeping;
    const beh = isIdle ? i.behavior : null;
    const trick = act === 'trick' ? i.itemId : null;
    const bp = i.behaviorProgress;
    this.idleFor = isIdle && (!beh || beh === 'look') ? this.idleFor + dt : 0;
    let sitT = isIdle && this.idleFor > 7 && !i.unwell ? 1 : 0;
    let restT = 0;
    if (beh === 'window' || beh === 'beg' || beh === 'watch' || beh === 'groom' || beh === 'watchItem') sitT = 1;
    if (beh === 'rest') restT = 1;
    if (trick === 'sit' || trick === 'paw' || trick === 'beg') sitT = smooth01(i.progress * 5);
    if (trick === 'down') restT = smooth01(i.progress * 4);
    if (trick === 'rollOver') restT = i.progress < 0.85 ? smooth01(i.progress * 5) : 0;
    if (act === 'confused') sitT = 0.45;
    if (act === 'bath' && i.arrived && i.progress < 0.72) sitT = 0.85;
    if (act === 'petted' && !moving) sitT = Math.max(sitT, cat ? 0.6 : 1);
    let lieT = sleeping ? 1 : 0;
    if (act === 'sleep') lieT = smooth01(i.progress * 1.6);
    if (act === 'wake') lieT = 1 - smooth01(i.progress * 2.2);
    let crouchT = 0;
    let jump = 0;
    if ((act === 'eat' || act === 'drink') && i.arrived) crouchT = cat ? 0.8 : 0.45;
    if (act === 'play') {
      const pc = pounceCycle(t);
      crouchT = pc.crouch;
      jump = pc.jump;
    }
    if (i.hop > 0) jump = Math.max(jump, i.hop);
    if (beh === 'toy' && cat) crouchT = 0.7;
    if (moving) {
      sitT = 0;
      lieT = 0;
      restT = 0;
      crouchT = 0;
    }
    this.sitW = expDamp(this.sitW, sitT, 4, dt);
    this.lieW = expDamp(this.lieW, lieT, act === 'sleep' || act === 'wake' ? 6 : 3, dt);
    this.restW = expDamp(this.restW, restT * (1 - lieT), trick ? 7 : 3, dt);
    this.crouchW = expDamp(this.crouchW, crouchT, 10, dt);
    this.walkW = expDamp(this.walkW, moving || i.spinning ? 1 : 0, 8, dt);

    const lying = Math.min(1, this.lieW + this.restW);
    this.addPose(this.sit, this.sitW * (1 - lying));
    this.addPose(this.lie, this.lieW);
    this.addPose(this.rest, this.restW * (1 - this.lieW));
    this.addPose(this.crouch, this.crouchW);
    let drop = SIT_DROP * this.sitW * (1 - lying) + LIE_DROP * lying + CROUCH_DROP * this.crouchW;
    let forward = 0;

    // ---- Gait (trot) ----
    const gaitOn = moving || i.spinning;
    if (gaitOn) {
      const legLen = this.cfg.regions.legTop * i.height;
      const stride = 0.55 * legLen;
      const speed = Math.max(i.speed, i.spinning ? 0.7 : 0);
      const freq = THREE.MathUtils.clamp((speed * 0.5) / Math.max(stride, 0.01) / 2, 1.2, 4.5);
      this.phase = (this.phase + freq * dt) % 1;
    }
    if (this.walkW > 0.01) {
      const w = this.walkW;
      const amp = 0.5;
      const legs: [string, number, boolean][] = [
        ['L', 0, true],
        ['R', 0.5, true],
        ['L', 0.5, false],
        ['R', 0, false],
      ];
      for (const [side, offset, front] of legs) {
        const p = (this.phase + offset) % 1;
        const duty = 0.58;
        let swing: number;
        let lift = 0;
        if (p < duty) swing = -1 + (2 * p) / duty;
        else {
          const s = (p - duty) / (1 - duty);
          swing = Math.cos(Math.PI * s);
          lift = Math.sin(Math.PI * s);
        }
        if (front) {
          this.add(`shoulder${side}`, amp * swing, 0, 0, w);
          this.add(`elbow${side}`, 1.1 * lift, 0, 0, w);
          this.add(`wrist${side}`, 0.7 * lift - 0.15 * Math.max(0, swing), 0, 0, w);
        } else {
          this.add(`hip${side}`, amp * 0.9 * swing, 0, 0, w);
          this.add(`knee${side}`, 0.65 * lift, 0, 0, w);
          this.add(`hock${side}`, -0.4 * lift + 0.15 * Math.max(0, swing), 0, 0, w);
        }
      }
      const step = Math.sin(this.phase * Math.PI * 4);
      drop += (0.012 + 0.012 * step) * w;
      this.add('spine', 0.02 * step, 0.05 * Math.sin(this.phase * Math.PI * 2), 0, w);
      this.add('chest', 0, -0.05 * Math.sin(this.phase * Math.PI * 2), 0.03 * Math.sin(this.phase * Math.PI * 2), w);
      // The head stays steady against the bob and looks where it goes.
      this.add('neck', -0.03 * step - 0.05, 0, 0, w);
      this.add('head', 0.02 * step, 0, 0, w);
      for (let k = 0; k < this.rig.tailBones.length; k++) {
        this.add(this.rig.tailBones[k], 0, 0.12 * Math.sin(this.phase * Math.PI * 2 - k * 0.8), 0, w);
      }
    }

    // ---- Jump (pounce, catch hop, celebrate): tuck legs in the air ----
    if (jump > 0.01) {
      this.sym('shoulder', -0.9 * jump);
      this.sym('elbow', 0.6 * jump);
      this.sym('hip', 0.8 * jump);
      this.sym('knee', -0.3 * jump);
      this.add('neck', -0.2 * jump, 0, 0);
    }

    // ---- Head: idle look-around with neck/head split ----
    if (t >= this.nextLook) {
      const r = this.rand;
      const lookAtCamera = r() < 0.4;
      this.lookYaw = lookAtCamera ? 0 : (r() - 0.5) * 1.3;
      this.lookPitch = (r() - 0.6) * 0.35;
      this.lookTilt = r() < 0.25 ? (r() - 0.5) * 0.6 : 0;
      this.nextLook = t + 1.8 + r() * 3.5;
    }
    const headBusy =
      beh === 'groom' || beh === 'sniff' || beh === 'window' || beh === 'chaseTail' || beh === 'scratch' || beh === 'watchItem' ||
      !!trick || act === 'confused';
    const lookW = (isIdle || act === 'petted' ? 1 : 0.25) * (1 - this.lieW) * (1 - this.walkW * 0.8) * (headBusy ? 0.2 : 1);
    const micro = Math.sin(t * 1.3) * 0.04;
    this.add('neck', this.lookPitch * 0.4, this.lookYaw * 0.4 + micro, 0, lookW);
    this.add('head', this.lookPitch * 0.6, this.lookYaw * 0.6, this.lookTilt, lookW);

    // ---- Tail ----
    const tail = this.rig.tailBones;
    const n = tail.length;
    if (cat) {
      // Upright when content, low and twitchy when unhappy or ill.
      const mood = i.unwell ? -0.6 : happy > 0.55 ? 0.1 : -0.35;
      const awake = 1 - this.lieW;
      for (let k = 0; k < n; k++) {
        const wave = Math.sin(t * 1.4 - k * 0.7) * (0.12 + 0.05 * k);
        const tip = k === n - 1 ? 0.35 * Math.sin(t * 0.7) : 0;
        this.add(tail[k], (k === 0 ? mood : 0) * awake, (wave + tip) * awake + 0.04 * Math.sin(t * 0.5) * this.lieW, 0);
      }
    } else {
      // Dogs wag faster and wider the happier they are.
      const excited =
        act === 'play' || act === 'petted' || act === 'celebrate' || act === 'eat' || act === 'trick' ||
        beh === 'toy' || beh === 'chaseTail' || beh === 'beg' || beh === 'watch';
      const wagAmp = (excited ? 0.55 : happy > 0.6 ? 0.32 : happy > 0.35 ? 0.12 : 0.03) * (1 - this.lieW * 0.9);
      const wagSpeed = excited ? 15 : 10;
      const mood = i.unwell || happy < 0.3 ? -0.55 : 0.05;
      for (let k = 0; k < n; k++) {
        this.add(tail[k], k === 0 ? mood * (1 - this.lieW) : 0, wagAmp * Math.sin(t * wagSpeed - k * 0.5) * (k === 0 ? 1 : 0.5), 0);
      }
    }

    // ---- Activity overlays ----
    switch (act) {
      case 'eat':
      case 'drink':
        if (i.arrived) {
          const chew = act === 'eat' ? Math.sin(t * 9) * 0.08 : Math.sin(t * 14) * 0.05;
          // Crouch and bring the head down to the bowl.
          this.add('chest', 0.25, 0, 0);
          this.add('neck', cat ? 0.85 : 0.95, 0, 0);
          this.add('head', 0.25 + chew, 0, 0);
          this.sym('shoulder', -0.3);
          this.sym('elbow', 0.6);
          this.sym('wrist', -0.3);
          drop += 0.05;
        }
        break;
      case 'petted': {
        // Lean into the hand, head tilted, eyes half closed.
        this.add('head', -0.1, 0.1, 0.35 + Math.sin(t * 2) * 0.08);
        this.add('neck', -0.1, 0.15, 0);
        this.add('chest', 0, 0, 0.06 * Math.sin(t * 3));
        break;
      }
      case 'bath':
        if (i.progress > 0.72) {
          // Full body shake from head to tail.
          const k = 1 - (i.progress - 0.72) / 0.28;
          const s = (o: number) => Math.sin(t * 38 - o) * k;
          this.add('head', 0, 0.45 * s(0), 0.2 * s(0));
          this.add('neck', 0, 0.35 * s(0.4), 0);
          this.add('chest', 0, 0.2 * s(0.8), 0.25 * s(0.8));
          this.add('spine', 0, 0.12 * s(1.2), 0.2 * s(1.2));
          this.add('pelvis', 0, 0.08 * s(1.6), 0.12 * s(1.6));
        } else {
          this.add('neck', 0.1, 0, 0);
          this.add('head', 0.1, 0, 0);
        }
        break;
      case 'wake': {
        // Play-bow stretch: chest down, rear up, then settle.
        const s = Math.sin(Math.min(1, i.progress * 1.4) * Math.PI);
        this.sym('shoulder', -0.9 * s);
        this.sym('elbow', 0.2 * s);
        this.add('chest', 0.25 * s, 0, 0);
        this.add('pelvis', 0.15 * s, 0, 0);
        this.add('neck', -0.3 * s, 0, 0);
        this.add('head', -0.2 * s, 0, 0);
        forward += 0.03 * s;
        break;
      }
      case 'celebrate':
        this.add('neck', -0.35, 0, 0);
        this.add('head', -0.15, 0, 0);
        break;
      case 'refuse': {
        const k = 1 - i.progress;
        this.add('neck', -0.15, 0.35 * Math.sin(t * 14) * k + 0.35, 0);
        this.add('head', -0.2, 0.4 * Math.sin(t * 14 - 0.4) * k + 0.3, 0);
        break;
      }
      case 'play':
        // Butt wiggle before the pounce, head locked on the toy.
        this.add('pelvis', 0, 0.12 * Math.sin(t * 22) * this.crouchW, 0);
        break;
      default:
        break;
    }
    const extra = this.behaviorAndTricks(i, beh, trick, bp, cat);
    jump = Math.max(jump, extra.jump);
    drop += extra.drop;
    if (beh === 'stretch') forward += 0.03 * Math.sin(Math.min(1, bp * 1.2) * Math.PI);
    if (i.unwell && !sleeping && !moving && !act) {
      this.add('neck', 0.35, 0, 0);
      this.add('head', 0.15, 0, 0.08 * Math.sin(t * 0.8));
      drop += 0.03;
    }
    if (i.flinch > 0) {
      this.add('neck', -0.2 * i.flinch, 0.5 * Math.sin(t * 30) * i.flinch, 0);
      this.add('head', 0, 0.4 * Math.sin(t * 30 - 0.5) * i.flinch, 0);
    }

    // ---- Ease bones toward the target ----
    const fast = beh === 'chaseTail' || beh === 'toy' || beh === 'groom' || trick === 'paw' || trick === 'spin';
    const lambda = this.walkW > 0.3 || jump > 0.01 || act === 'bath' || i.flinch > 0 ? 30 : fast ? 16 : 9;
    const euler = new THREE.Euler();
    for (const [name, bone] of this.rig.bones) {
      const tgt = this.target.get(name)!;
      const cur = this.current.get(name)!;
      for (let k = 0; k < 3; k++) cur[k] = expDamp(cur[k], tgt[k], lambda, dt);
      euler.set(cur[0], cur[1], cur[2]);
      bone.quaternion.setFromEuler(euler);
    }

    // Pelvis height (lowering for sit/lie/crouch).
    const H = this.rig.height;
    this.pelvisY = expDamp(this.pelvisY, -drop * this.cfg.landmarks.pelvis[1], 12, dt);
    this.pelvisZ = expDamp(this.pelvisZ, forward, 8, dt);
    const pelvis = this.rig.bones.get('pelvis')!;
    pelvis.position.set(this.pelvisRest.x, this.pelvisRest.y + this.pelvisY * H, this.pelvisRest.z + this.pelvisZ * H);

    // Breathing: chest expands, slower while asleep.
    const breath = Math.sin(t * (sleeping ? 1.4 : 2.4));
    const chest = this.rig.bones.get('chest')!;
    chest.scale.set(1 + breath * 0.02, 1 + breath * 0.012, 1);

    // ---- Eyes ----
    if (t >= this.nextBlink && this.blinkStart < 0) {
      this.blinkStart = t;
      this.nextBlink = t + 2 + this.rand() * 4;
    }
    let lid = 1;
    if (this.blinkStart >= 0) {
      const b = (t - this.blinkStart) / 0.16;
      if (b >= 1) this.blinkStart = -1;
      else lid = 1 - Math.sin(Math.PI * b);
    }
    let open = 1;
    if (sleeping || this.lieW > 0.7) open = 0;
    else if (act === 'petted') open = cat ? 0.3 : 0.55;
    else if (i.unwell) open = 0.6;
    else if (beh === 'watch' && cat) open = Math.sin(t * 0.6) > 0.6 ? 0.25 : 1; // slow "cat kiss" blink
    else if (beh === 'rest') open = Math.sin(t * 0.35) > 0.5 ? 0.35 : 0.9;
    this.eyeOpen = expDamp(this.eyeOpen, open, 6, dt);
    this.blink = Math.max(0, Math.min(this.eyeOpen, lid));

    // ---- Eyebrows ----
    let raise = 0;
    let worry = 0;
    let quirk = 0;
    if (sleeping) raise = -0.3;
    else if (act === 'refuse') worry = -0.8;
    else if (act === 'confused') quirk = 1;
    else if (act === 'play' || act === 'celebrate' || act === 'trick' || i.hop > 0) raise = 0.8;
    else if (act === 'petted') raise = 0.25;
    else if (beh === 'watch' || beh === 'beg' || beh === 'window' || beh === 'watchItem' || beh === 'toy') raise = 0.45;
    if (!sleeping && act !== 'refuse' && (i.unwell || happy < 0.3)) {
      worry = 0.85;
      raise = Math.min(raise, 0.1);
    }
    // Small idle twitches so the face never looks frozen.
    raise += 0.08 * Math.sin(t * 0.7) * Math.sin(t * 0.23);
    const b = this.brows;
    b.raise = expDamp(b.raise, raise, 6, dt);
    b.worry = expDamp(b.worry, worry, 5, dt);
    b.quirk = expDamp(b.quirk, quirk, 6, dt);
  }

  /**
   * Overlays for autonomous behaviors and tricks. Returns a "jump" amount
   * (moves that leave the floor) and an extra pelvis drop.
   */
  private behaviorAndTricks(
    i: RigAnimInput,
    beh: BehaviorAnim | null,
    trick: string | null,
    bp: number,
    cat: boolean,
  ): { jump: number; drop: number } {
    const t = i.time;
    const p = i.progress;
    let jump = 0;
    let drop = 0;
    switch (beh) {
      case 'window':
        this.add('neck', -0.4, 0.1 * Math.sin(t * 0.4), 0);
        this.add('head', -0.25, 0.2 * Math.sin(t * 0.33 + 1), 0.08 * Math.sin(t * 0.21));
        break;
      case 'beg': {
        this.add('head', 0, 0, 0.25);
        // Paw tap every couple of seconds ("I'm hungry").
        const tap = Math.max(0, Math.sin(t * 2.6)) ** 6;
        this.add('shoulderR', -0.7 * tap, 0, 0);
        this.add('elbowR', 0.6 * tap, 0, 0);
        break;
      }
      case 'watch':
        this.add('head', 0, 0, 0.18 * Math.sin(t * 0.5));
        break;
      case 'groom': {
        // Lick the raised paw, now and then rub it over the face.
        const rub = Math.sin(t * 0.8) > 0.55 ? 1 : 0;
        this.add('shoulderL', -1.15 - 0.4 * rub, 0, -0.15);
        this.add('elbowL', 1.9 - 0.5 * rub, 0, 0);
        this.add('wristL', 0.7, 0, 0);
        this.add('neck', 0.25, -0.15, 0);
        this.add('head', 0.35 + 0.12 * Math.sin(t * 11) * (1 - rub), -0.25, 0.25 * rub);
        break;
      }
      case 'sniff':
        this.add('neck', 0.75, 0.15 * Math.sin(t * 1.3), 0);
        this.add('head', 0.25 + 0.04 * Math.sin(t * 16), 0.3 * Math.sin(t * 1.7), 0);
        break;
      case 'toy':
        if (cat) {
          // Crouch and swipe at the toys.
          const swipe = Math.max(0, Math.sin(t * 5)) ** 3;
          this.add('shoulderR', -1.1 * swipe, 0, -0.1 * swipe);
          this.add('elbowR', -0.6 * swipe + 0.4, 0, 0);
          this.add('head', -0.1, 0.2 * Math.sin(t * 2.3), 0);
          this.add('pelvis', 0, 0.1 * Math.sin(t * 20), 0);
        } else {
          // Play bow: chest down on the forearms, rear up, tail going.
          const bounce = Math.max(0, Math.sin(t * 6));
          this.add('pelvis', 0.3, 0, 0);
          this.sym('hip', -0.3);
          this.add('chest', 0.15, 0, 0);
          this.sym('shoulder', -0.55 + 0.1 * bounce);
          this.sym('elbow', 1.3);
          this.sym('wrist', -0.55);
          this.add('neck', -0.55, 0, 0);
          this.add('head', -0.1, 0.15 * Math.sin(t * 2), 0);
          jump = 0.15 * bounce;
        }
        break;
      case 'chaseTail':
        this.add('spine', 0, 0.3, 0);
        this.add('chest', 0, 0.3, 0);
        this.add('neck', 0, 0.6, 0);
        this.add('head', 0.1, 0.4, 0);
        break;
      case 'stretch': {
        const s = Math.sin(Math.min(1, bp * 1.2) * Math.PI);
        this.sym('shoulder', -0.9 * s);
        this.sym('elbow', 0.2 * s);
        this.add('chest', 0.25 * s, 0, 0);
        this.add('pelvis', 0.15 * s, 0, 0);
        this.add('neck', -0.3 * s, 0, 0);
        this.add('head', -0.25 * s, 0, 0);
        break;
      }
      case 'scratch': {
        // Stretch up the post and scratch with alternating front paws.
        const s = Math.sin(t * 9);
        this.add('pelvis', -0.75, 0, 0);
        this.sym('hip', 0.55);
        this.sym('knee', 0.3);
        this.add('chest', -0.15, 0, 0);
        this.add('shoulderL', -1.35 + 0.3 * s, 0, 0);
        this.add('shoulderR', -1.35 - 0.3 * s, 0, 0);
        this.sym('elbow', 0.25);
        this.add('neck', 0.35, 0, 0);
        this.add('head', 0.2, 0, 0);
        this.add('pelvis', 0, 0.06 * Math.sin(t * 4.5), 0);
        break;
      }
      case 'watchItem':
        // Fascinated by the fish: head follows them, tail tip twitches.
        this.add('neck', -0.1, 0.25 * Math.sin(t * 0.9), 0);
        this.add('head', 0.05, 0.2 * Math.sin(t * 0.9 - 0.3), 0.1 * Math.sin(t * 0.45));
        break;
      case 'rest':
        // Now and then rest the chin for a moment.
        this.add('neck', 0.3 * Math.max(0, Math.sin(t * 0.25)), 0, 0);
        break;
      default:
        break;
    }

    if (trick) {
      const hold = smooth01((p - 0.15) * 6) * (1 - smooth01((p - 0.88) * 9));
      switch (trick) {
        case 'sit':
          this.add('neck', -0.15, 0, 0);
          this.add('head', -0.1, 0, 0.12 * hold);
          break;
        case 'paw':
          // Offer the right paw and shake it a little.
          this.add('shoulderR', (-1.25 + 0.12 * Math.sin(t * 11)) * hold, 0, 0.05 * hold);
          this.add('elbowR', 0.1 * hold, 0, 0);
          this.add('wristR', -0.25 * hold, 0, 0);
          this.add('chest', 0, 0, -0.06 * hold);
          this.add('head', -0.1, 0, 0.2 * hold);
          break;
        case 'down':
          this.add('head', -0.05, 0, 0.1 * hold);
          break;
        case 'spin':
          this.add('spine', 0, 0.25, 0);
          this.add('chest', 0, 0.25, 0);
          this.add('neck', 0, 0.4, 0);
          break;
        case 'beg': {
          // Sit up on the hind legs with the front paws curled.
          const up = hold;
          this.add('pelvis', -0.55 * up, 0, 0);
          // Undo the hip rotation on the hind legs so the feet stay planted.
          this.sym('hip', 0.55 * up);
          this.add('spine', -0.15 * up, 0, 0);
          this.add('chest', -0.3 * up, 0, 0);
          this.sym('shoulder', -0.2 * up);
          this.sym('elbow', 1.7 * up);
          this.sym('wrist', 0.9 * up);
          this.add('neck', 0.3 * up, 0, 0);
          this.add('head', 0.05 * up + 0.06 * Math.sin(t * 3), 0, 0.08 * Math.sin(t * 1.5));
          drop += 0.04 * up;
          // Keep the tail on the floor instead of through it.
          this.add('tail0', 0.7 * up, 0, 0);
          break;
        }
        case 'rollOver': {
          // Tuck the legs while rolling (the roll itself is the outer pose).
          const roll = Math.sin(Math.PI * Math.min(1, Math.max(0, (p - 0.25) / 0.55)));
          this.sym('shoulder', -0.6 * roll);
          this.sym('elbow', 1.2 * roll);
          this.sym('hip', -0.7 * roll);
          this.sym('knee', 1.2 * roll);
          break;
        }
        default:
          break;
      }
    }
    if (i.activity === 'confused') {
      // Puzzled head tilts, looking from side to side.
      const side = Math.sin(t * 1.6) > 0 ? 1 : -1;
      this.add('neck', -0.1, 0.15 * side, 0);
      this.add('head', -0.1, 0.1 * side, 0.4 * side);
    }
    return { jump, drop };
  }
}
