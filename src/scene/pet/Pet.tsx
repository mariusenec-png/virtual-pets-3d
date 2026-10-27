import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { ROOM_LAYOUT } from '../../config/activities';
import { NEEDS } from '../../config/needs';
import { playSound } from '../../audio/engine';
import { getGrowthStage } from '../../game/progression';
import type { SpeciesId } from '../../game/types';
import { getSpecies } from '../../species/registry';
import { useGameStore } from '../../store/gameStore';
import { FxLayer } from '../effects/FxLayer';
import { CATCH_Z, catchRuntime } from '../minigame/runtime';
import { PlayToy } from '../effects/PlayToy';
import { SleepZzz } from '../effects/SleepZzz';
import { StinkLines } from '../effects/StinkLines';
import { SymptomBubble } from '../effects/SymptomBubble';
import { ModelErrorBoundary } from './ModelErrorBoundary';
import { PetModel } from './PetModel';
import { PlaceholderPet } from './PlaceholderPet';
import { planBehavior, type Behavior } from './behaviors';
import { furnitureSpots, furnitureSurfaces } from '../decor/furnitureSpots';
import { createPetMotion } from './motion';
import { computePose, computeRiggedOuterPose, damp, dampAngle, NEUTRAL_POSE, type Pose } from './poses';
import { useDirtTint } from './useDirtTint';
import { t } from '../../i18n';

const WALK_SPEED = 0.9; // m/s
/** Strolling speed for autonomous behaviors. */
const STROLL_SPEED = 0.55;
/** Seconds of calm after any activity before the pet does things on its own. */
const CALM_AFTER_ACTIVITY = 4;
const ARRIVE_EPS = 0.02;
/** Top of the bed's inner pad and its radius (see props/PetBed.tsx). */
const BED_PAD_HEIGHT = 0.08;
const BED_PAD_RADIUS = 0.36;
const tmp = new THREE.Vector3();

function vec(p: readonly [number, number, number]) {
  return new THREE.Vector3(p[0], p[1], p[2]);
}

const HOME = vec(ROOM_LAYOUT.home);
const FOOD = vec(ROOM_LAYOUT.foodBowl);
const WATER = vec(ROOM_LAYOUT.waterBowl);
const BED = vec(ROOM_LAYOUT.bed);
const BATH = vec(ROOM_LAYOUT.bathSpot);
const CAMERA_DIR = new THREE.Vector3(0.0, 0, 3);

/** Spot in front of an object, on the side facing the room center. */
function approach(target: THREE.Vector3, distance: number): THREE.Vector3 {
  const dir = tmp.copy(HOME).sub(target).setY(0);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  return target.clone().add(dir.normalize().multiplyScalar(distance));
}

export function Pet({ speciesId }: { speciesId: SpeciesId }) {
  const species = getSpecies(speciesId);
  const stage = useGameStore((s) => (s.game.pet ? getGrowthStage(s.game.pet) : 'baby'));
  const usingPlaceholder = useGameStore((s) => s.usingPlaceholder);
  const setUsingPlaceholder = useGameStore((s) => s.setUsingPlaceholder);
  const appearance = species.stages[stage];
  const targetHeight = appearance.height;

  const outer = useRef<THREE.Group>(null);
  const posed = useRef<THREE.Group>(null);
  const sized = useRef<THREE.Group>(null);
  const modelRoot = useRef<THREE.Group>(null);
  const state = useRef({
    pos: HOME.clone(),
    heading: 0,
    pose: { ...NEUTRAL_POSE } as Pose,
    height: targetHeight,
    proportions: [...appearance.proportions] as [number, number, number],
    /** Height of whatever the pet stands on (the bed pad is raised). */
    floor: 0,
    /** Autonomous behavior in progress (null = plain idle). */
    behavior: null as Behavior | null,
    /** Clock time when the behavior started performing (-1 = still walking there). */
    performStart: -1,
    /** Clock time before which no new behavior starts. */
    nextBehaviorAt: 3,
    /** Activity sequence seen last frame (detects new activities). */
    lastSeq: -1,
    /** Heading when a spin started. */
    spinFrom: 0,
    /** Current ground speed (m/s), for the gait. */
    speed: 0,
    /** Clock time until which the pet is "jumping" onto/off a surface. */
    hopUntil: -1,
    floorTarget: 0,
  });

  const motion = useRef(createPetMotion(targetHeight)).current;

  useDirtTint(modelRoot);

  useFrame((three, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = outer.current;
    const pg = posed.current;
    const sg = sized.current;
    if (!g || !pg || !sg) return;
    const { game, activity, household } = useGameStore.getState();
    const pet = game.pet;
    if (!pet) return;
    const st = state.current;
    const now = Date.now();
    const active = activity && now < activity.startedAt + activity.durationMs ? activity : null;
    const progress = active ? THREE.MathUtils.clamp((now - active.startedAt) / active.durationMs, 0, 1) : 0;
    const sleeping = pet.isSleeping;

    // Growth: smoothly approach the stage height and proportions.
    st.height = damp(st.height, targetHeight, 2.5, dt);
    for (let i = 0; i < 3; i++) st.proportions[i] = damp(st.proportions[i], appearance.proportions[i], 2.5, dt);
    sg.scale.set(st.height * st.proportions[0], st.height * st.proportions[1], st.height * st.proportions[2]);

    const mg = catchRuntime.game;
    let walking: boolean;
    if (mg) {
      // Mini-game: the game logic owns the position; face the direction of travel.
      st.pos.set(mg.petX, 0, CATCH_Z);
      walking = Math.abs(mg.petVelocity) > 0.15;
      const desired = walking ? (mg.petVelocity > 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
      st.heading = dampAngle(st.heading, desired, 12, dt);
    } else {
      const time = three.clock.elapsedTime;
      // New activity: remember where a spin starts.
      if (active && active.seq !== st.lastSeq) st.spinFrom = st.heading;
      st.lastSeq = active?.seq ?? st.lastSeq;

      // Autonomous behavior only while nothing else is going on.
      const idle = !active && !sleeping;
      if (!idle) {
        st.behavior = null;
        st.nextBehaviorAt = time + CALM_AFTER_ACTIVITY;
      } else if (!st.behavior && time >= st.nextBehaviorAt) {
        st.behavior = planBehavior({
          species: pet.species,
          personality: pet.personality,
          needs: pet.needs,
          unwell: !!pet.illness || pet.needs.health < NEEDS.health.warnBelow,
          position: [st.pos.x, st.pos.z],
          furniture: furnitureSpots(household.room, pet.species),
        });
        st.performStart = st.behavior.target ? -1 : time;
        if (!st.behavior.target && st.behavior.vocal) playSound(pet.species === 'cat' ? 'meow' : 'bark');
      }
      const beh = st.behavior;
      if (beh && st.performStart >= 0 && time > st.performStart + beh.duration) {
        st.behavior = null;
        st.nextBehaviorAt = time + 2.5 + Math.random() * 3.5;
      }

      // Where should the pet be?
      let target = st.pos;
      let face: THREE.Vector3 | null = CAMERA_DIR;
      let speed = WALK_SPEED;
      // Rigged pets lower their head into the bowl, so they stand closer.
      const reach = motion.rigged ? Math.max(0, st.height * 0.5 - 0.1) : st.height * 0.75;
      if (active?.kind === 'eat') {
        target = approach(FOOD, reach + 0.12);
        face = FOOD;
      } else if (active?.kind === 'drink') {
        target = approach(WATER, reach + 0.12);
        face = WATER;
      } else if (sleeping || active?.kind === 'sleep') {
        target = BED;
        face = CAMERA_DIR;
      } else if (active?.kind === 'bath') {
        target = BATH;
      } else if (st.behavior) {
        const b = st.behavior;
        if (b.target && st.performStart < 0) target = new THREE.Vector3(b.target[0], 0, b.target[1]);
        face = b.face === 'camera' ? CAMERA_DIR : b.face ? new THREE.Vector3(b.face[0], 0, b.face[1]) : null;
        speed = STROLL_SPEED;
      }

      // Move.
      const toTarget = tmp.copy(target).sub(st.pos).setY(0);
      const dist = toTarget.length();
      walking = dist > ARRIVE_EPS;
      if (walking) {
        const step = Math.min(dist, speed * dt);
        st.pos.addScaledVector(toTarget.normalize(), step);
        st.heading = dampAngle(st.heading, Math.atan2(toTarget.x, toTarget.z), 10, dt);
      } else {
        // Arrived at the behavior spot: start performing.
        const b = st.behavior;
        if (b && st.performStart < 0) {
          st.performStart = time;
          if (b.vocal) playSound(pet.species === 'cat' ? 'meow' : 'bark');
        }
        if (active?.kind === 'trick' && active.itemId === 'spin') {
          // One full turn over the trick, eased in and out.
          const u = THREE.MathUtils.smoothstep(progress, 0.08, 0.9);
          st.heading = st.spinFrom + u * Math.PI * 2;
        } else if (b?.anim === 'chaseTail' && st.performStart >= 0) {
          st.heading += 4.2 * dt;
        } else if (face) {
          const fx = face.x - st.pos.x;
          const fz = face.z - st.pos.z;
          st.heading = dampAngle(st.heading, Math.atan2(fx, fz), 5, dt);
        }
      }
      st.speed = walking ? speed : 0;
    }

    // Pose.
    const poseInput = {
      time: three.clock.elapsedTime,
      activity: mg ? null : (active?.kind ?? null),
      itemId: mg ? null : (active?.itemId ?? null),
      progress,
      arrived: !walking,
      walking,
      sleeping: !mg && sleeping,
      unwell: !!pet.illness || pet.needs.health < NEEDS.health.warnBelow,
    };
    const sinceCatch = now - catchRuntime.lastCatchAt;
    const sinceHazard = now - catchRuntime.lastHazardAt;
    const floorHop = st.hopUntil > three.clock.elapsedTime ? Math.sin(((st.hopUntil - three.clock.elapsedTime) / 0.4) * Math.PI) : 0;
    const hop = mg && sinceCatch < 300 ? 1 - sinceCatch / 300 : Math.max(0, floorHop);
    const flinch = mg && sinceHazard < 500 ? 1 - sinceHazard / 500 : 0;

    // Inputs for the skeleton animator (PetModel).
    const mi = motion.input;
    mi.time = poseInput.time;
    mi.speed = walking ? (mg ? Math.abs(mg.petVelocity) : st.speed) : 0;
    const beh = !mg ? st.behavior : null;
    const performing = !!beh && st.performStart >= 0;
    mi.behavior = performing ? beh!.anim : null;
    mi.behaviorProgress = performing ? Math.min(1, (poseInput.time - st.performStart) / beh!.duration) : 0;
    mi.itemId = poseInput.itemId;
    // Trotting on the spot while spinning or chasing the tail.
    mi.spinning =
      (poseInput.activity === 'trick' && poseInput.itemId === 'spin' && progress > 0.08 && progress < 0.9) ||
      (performing && beh!.anim === 'chaseTail');
    mi.height = st.height;
    mi.activity = poseInput.activity;
    mi.progress = progress;
    mi.arrived = poseInput.arrived;
    mi.sleeping = poseInput.sleeping;
    mi.unwell = poseInput.unwell;
    mi.happiness = pet.needs.happiness;
    mi.hop = hop;
    mi.flinch = flinch;

    const targetPose = motion.rigged ? computeRiggedOuterPose(poseInput) : computePose(poseInput);
    // Mini-game: hop when catching; without a skeleton, shake the whole body after a hazard.
    if (hop > 0) targetPose.lift = 0.22 * hop;
    if (flinch > 0 && !motion.rigged) targetPose.yaw = Math.sin(three.clock.elapsedTime * 30) * 0.45;
    const p = st.pose;
    const lambda = 14;
    p.lift = damp(p.lift, targetPose.lift, lambda, dt);
    p.pitch = damp(p.pitch, targetPose.pitch, lambda, dt);
    p.roll = dampAngle(p.roll, targetPose.roll, lambda, dt);
    p.side = damp(p.side, targetPose.side, lambda, dt);
    p.yaw = dampAngle(p.yaw, targetPose.yaw, lambda, dt);
    p.scaleY = damp(p.scaleY, targetPose.scaleY, lambda, dt);
    p.scaleXZ = damp(p.scaleXZ, targetPose.scaleXZ, lambda, dt);

    // Step (or jump) up onto raised surfaces: the bed pad and furniture.
    let floorTarget = Math.hypot(st.pos.x - BED.x, st.pos.z - BED.z) < BED_PAD_RADIUS ? BED_PAD_HEIGHT : 0;
    if (!mg) {
      for (const sfc of furnitureSurfaces(household.room)) {
        if (Math.hypot(st.pos.x - sfc.x, st.pos.z - sfc.z) < sfc.radius) floorTarget = Math.max(floorTarget, sfc.height);
      }
    }
    if (Math.abs(floorTarget - st.floorTarget) > 0.15) st.hopUntil = three.clock.elapsedTime + 0.4;
    st.floorTarget = floorTarget;
    st.floor = damp(st.floor, floorTarget, floorTarget - st.floor > 0.15 ? 7 : 10, dt);
    g.position.copy(st.pos);
    g.position.y = st.floor;
    g.rotation.y = st.heading;
    pg.position.y = p.lift * st.height;
    pg.position.x = p.side * st.height;
    pg.rotation.set(p.pitch, p.yaw, p.roll);
    pg.scale.set(p.scaleXZ, p.scaleY, p.scaleXZ);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // Ignore clicks that were really camera drags.
    if (e.delta > 6) return;
    e.stopPropagation();
    useGameStore.getState().pet();
  };

  return (
    <group
      ref={outer}
      onClick={onClick}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <group ref={posed}>
        <group ref={sized}>
          <group ref={modelRoot}>
            <ModelErrorBoundary
              resetKey={species.id}
              onError={() => setUsingPlaceholder(true)}
              fallback={<PlaceholderPet species={species} />}
            >
              <Suspense fallback={<LoadingMarker />}>
                <PetModel species={species} stage={stage} motion={motion} />
              </Suspense>
            </ModelErrorBoundary>
          </group>
        </group>
      </group>
      <PlayToy height={targetHeight} />
      <FxLayer height={targetHeight} />
      <SleepZzz height={targetHeight} />
      <StinkLines height={targetHeight} />
      <SymptomBubble height={targetHeight} />
      {usingPlaceholder && (
        <Html position={[0, targetHeight + 0.18, 0]} center zIndexRange={[10, 0]}>
          <div className="placeholder-badge">{t('scene.placeholder')}</div>
        </Html>
      )}
    </group>
  );
}

function LoadingMarker() {
  return (
    <Html center position={[0, 0.5, 0]}>
      <div className="model-loading">{t('scene.loadingModel')}</div>
    </Html>
  );
}
