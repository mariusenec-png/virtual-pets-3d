import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { ROOM_LAYOUT } from '../../config/activities';
import { NEEDS } from '../../config/needs';
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
import { createPetMotion } from './motion';
import { computePose, computeRiggedOuterPose, damp, dampAngle, NEUTRAL_POSE, type Pose } from './poses';
import { useDirtTint } from './useDirtTint';
import { t } from '../../i18n';

const WALK_SPEED = 0.9; // m/s
const ARRIVE_EPS = 0.02;
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
  });

  const motion = useRef(createPetMotion(targetHeight)).current;

  useDirtTint(modelRoot);

  useFrame((three, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = outer.current;
    const pg = posed.current;
    const sg = sized.current;
    if (!g || !pg || !sg) return;
    const { game, activity } = useGameStore.getState();
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
      // Where should the pet be?
      let target = HOME;
      let face: THREE.Vector3 | null = CAMERA_DIR;
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
      } else if (active?.kind === 'wake') {
        target = st.pos; // stretch in place before walking home
      }

      // Move.
      const toTarget = tmp.copy(target).sub(st.pos).setY(0);
      const dist = toTarget.length();
      walking = dist > ARRIVE_EPS;
      if (walking) {
        const step = Math.min(dist, WALK_SPEED * dt);
        st.pos.addScaledVector(toTarget.normalize(), step);
        st.heading = dampAngle(st.heading, Math.atan2(toTarget.x, toTarget.z), 10, dt);
      } else if (face) {
        const fx = face.x - st.pos.x;
        const fz = face.z - st.pos.z;
        st.heading = dampAngle(st.heading, Math.atan2(fx, fz), 5, dt);
      }
    }

    // Pose.
    const poseInput = {
      time: three.clock.elapsedTime,
      activity: mg ? null : (active?.kind ?? null),
      progress,
      arrived: !walking,
      walking,
      sleeping: !mg && sleeping,
      unwell: !!pet.illness || pet.needs.health < NEEDS.health.warnBelow,
    };
    const sinceCatch = now - catchRuntime.lastCatchAt;
    const sinceHazard = now - catchRuntime.lastHazardAt;
    const hop = mg && sinceCatch < 300 ? 1 - sinceCatch / 300 : 0;
    const flinch = mg && sinceHazard < 500 ? 1 - sinceHazard / 500 : 0;

    // Inputs for the skeleton animator (PetModel).
    const mi = motion.input;
    mi.time = poseInput.time;
    mi.speed = walking ? (mg ? Math.abs(mg.petVelocity) : WALK_SPEED) : 0;
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
    p.roll = damp(p.roll, targetPose.roll, lambda, dt);
    p.yaw = dampAngle(p.yaw, targetPose.yaw, lambda, dt);
    p.scaleY = damp(p.scaleY, targetPose.scaleY, lambda, dt);
    p.scaleXZ = damp(p.scaleXZ, targetPose.scaleXZ, lambda, dt);

    g.position.copy(st.pos);
    g.rotation.y = st.heading;
    pg.position.y = p.lift * st.height;
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
