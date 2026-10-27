import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FUR_SHELLS, WET_FUR_DRY_SECONDS, WET_FUR_LENGTH } from '../../config/graphics';
import type { GrowthStage } from '../../game/types';
import type { SpeciesDefinition } from '../../species/types';
import { useGameStore } from '../../store/gameStore';
import { applyCoatToMaterial, createCoatUniforms, type CoatUniforms } from '../coat/coat';
import { createFurShells, findBodyMesh, type FurHandle, type FurLayout } from '../fur/furShells';
import { RigAnimator } from '../rig/animator';
import { buildRig, resetRigPose, type PetRig } from '../rig/autoRig';
import { applyEyeScale, averageAlbedo, collectEyeParts } from './eyeParts';
import { buildMouth } from './mouth';
import type { PetMotion } from './motion';
import { damp } from './poses';

/** Body regions used by the coat pattern when a species has no rig. */
const DEFAULT_REGIONS = { legTop: 0.3, tailStartZ: -0.4, neckZ: 0.25 };

/**
 * Loads a species GLB and normalizes it: rotated to face +Z, feet on y = 0,
 * centered on X/Z, and scaled to a height of exactly 1 unit. The caller
 * scales the result to the growth-stage height.
 *
 * Materials are cloned per instance so visual effects (e.g. dirt tint)
 * never leak into the cached GLTF. When the species has rig landmarks the
 * body gets an automatic skeleton and is animated procedurally; the body
 * mesh gets shell fur.
 */
export function PetModel({
  species,
  stage,
  motion,
}: {
  species: SpeciesDefinition;
  stage: GrowthStage;
  motion: PetMotion;
}) {
  const { scene } = useGLTF(species.model.url);
  const furQuality = useGameStore((s) => s.game.settings.furQuality);

  const prepared = useMemo(() => {
    const root = scene.clone(true);
    root.rotation.set(0, species.model.rotationY, 0);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (!(size.y > 0)) throw new Error(`Model ${species.model.url} has no visible geometry`);
    root.position.set(-center.x, -box.min.y, -center.z);

    const materials: THREE.Material[] = [];
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const clone = (m: THREE.Material) => {
        const c = m.clone();
        materials.push(c);
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
    });

    const wrapper = new THREE.Group();
    wrapper.add(root);
    wrapper.scale.setScalar(1 / size.y);
    wrapper.updateMatrixWorld(true);

    let rig: PetRig | null = null;
    let animator: RigAnimator | null = null;
    const body = findBodyMesh(root, species.fur.bodyMeshName);
    if (species.rig && body) {
      const others: THREE.Mesh[] = [];
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m !== body) others.push(m);
      });
      rig = buildRig(wrapper, size.y, body, others, species.rig, species.id);
      animator = new RigAnimator(rig, species.rig, species.id, Math.floor(Math.random() * 1000) + 1);
    }

    // Coat markings, painted from the rest pose in normalized model space.
    const furBody = rig ? rig.body : body;
    let coat: CoatUniforms | null = null;
    let furLayout: FurLayout | null = null;
    if (furBody) {
      wrapper.updateMatrixWorld(true);
      const toModel = new THREE.Matrix4()
        .makeScale(1 / size.y, 1 / size.y, 1 / size.y)
        .multiply(new THREE.Matrix4().copy(wrapper.matrixWorld).invert())
        .multiply(furBody.matrixWorld);
      const tail0 = species.rig?.landmarks.tail[0];
      furLayout = {
        toModel,
        regions: species.rig?.regions ?? DEFAULT_REGIONS,
        tailBase: tail0 ? [tail0[1], tail0[2]] : [0.5, -0.42],
      };
      if (species.coat) coat = createCoatUniforms(species.coat, toModel, species.rig?.regions ?? DEFAULT_REGIONS);
    }
    if (species.coat && furBody && coat) {
      const mats = Array.isArray(furBody.material) ? furBody.material : [furBody.material];
      for (const m of mats) applyCoatToMaterial(m, coat);
    }

    // After rigging the eye meshes live under the head bone, so search the wrapper.
    // Eyelids take the coat color around the eyes (a bit lighter than the body average).
    const bodyMat = furBody ? (Array.isArray(furBody.material) ? furBody.material[0] : furBody.material) : null;
    const lidColor = bodyMat ? averageAlbedo(bodyMat).multiplyScalar(1.3) : undefined;
    const eyes = collectEyeParts(wrapper, species.model.eyePartPattern, {
      lidColor,
      body: furBody,
      // Brows sit on top of the (short) fur around the eyes.
      surfaceOffset: species.fur.lengthRatio * species.fur.profile.head * size.y * 0.9,
      browWhiskers: species.id === 'cat',
    });
    // An opening mouth that follows the head bone.
    const headBone = rig?.bones.get('head');
    const mouth = species.mouth && headBone ? buildMouth(wrapper, headBone, furBody, size.y, species.mouth) : null;

    return { wrapper, root, materials, eyes, height: size.y, rig, animator, body: furBody, coat, furLayout, mouth };
  }, [scene, species]);

  useEffect(
    () => () => {
      prepared.materials.forEach((m) => m.dispose());
      prepared.mouth?.dispose();
    },
    [prepared],
  );

  useEffect(() => {
    motion.rigged = !!prepared.rig;
    return () => {
      motion.rigged = false;
    };
  }, [prepared, motion]);

  // Fur shells, rebuilt when the quality setting changes.
  const fur = useRef<FurHandle | null>(null);
  useEffect(() => {
    const shells = FUR_SHELLS[furQuality];
    if (shells <= 0) return;
    const body = prepared.body;
    if (!body) return;
    // Measure in the rest pose: the fur mask is computed from mesh positions.
    if (prepared.rig) resetRigPose(prepared.rig);
    prepared.wrapper.updateMatrixWorld(true);
    const excluded: THREE.Mesh[] = [];
    prepared.wrapper.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m !== body && !m.userData.proxy && !m.userData.noFurMask) excluded.push(m);
    });
    let handle: FurHandle | null = null;
    try {
      handle = createFurShells(
        body,
        excluded,
        prepared.root,
        prepared.height,
        { shells, ...species.fur },
        prepared.coat ?? undefined,
        prepared.furLayout ?? undefined,
      );
    } catch (e) {
      // Fur is cosmetic: never let it break the pet.
      console.warn('[virtual-pets-3d] Fur disabled:', e);
    }
    if (!handle) return;
    const created = handle;
    body.add(created.object);
    fur.current = created;
    return () => {
      created.dispose();
      fur.current = null;
    };
  }, [prepared, furQuality, species.fur]);

  const appearance = species.stages[stage];
  // Wet fur during and shortly after a bath; stage look eased over time.
  const anim = useRef({ eye: appearance.eyeScale, furLength: appearance.furLength, furDensity: appearance.furDensity });
  const wet = useRef({ scale: 1, wetUntil: 0 });
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const a0 = anim.current;
    a0.eye = damp(a0.eye, appearance.eyeScale, 2.5, dt);
    a0.furLength = damp(a0.furLength, appearance.furLength, 2.5, dt);
    a0.furDensity = damp(a0.furDensity, appearance.furDensity, 2.5, dt);

    const animator = prepared.animator;
    if (animator) animator.update(motion.input, dt);
    applyEyeScale(prepared.eyes, a0.eye, animator ? animator.blink : 1, animator?.brows);
    if (animator && prepared.mouth) prepared.mouth.update(animator.mouth.open, animator.mouth.tongue);

    const handle = fur.current;
    if (!handle) return;
    const a = useGameStore.getState().activity;
    const now = Date.now();
    const w = wet.current;
    if (a?.kind === 'bath' && now < a.startedAt + a.durationMs) {
      w.wetUntil = a.startedAt + a.durationMs + WET_FUR_DRY_SECONDS * 1000;
    }
    const target = now < w.wetUntil ? WET_FUR_LENGTH : 1;
    // Getting wet is quick; drying is slow.
    w.scale = damp(w.scale, target, target < w.scale ? 4 : 0.8, dt);
    handle.update(clock.elapsedTime, w.scale * a0.furLength, a0.furDensity);
  });

  return <primitive object={prepared.wrapper} />;
}

export function preloadSpeciesModel(url: string): void {
  useGLTF.preload(url);
}
