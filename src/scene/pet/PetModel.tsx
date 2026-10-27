import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FUR_SHELLS, WET_FUR_DRY_SECONDS, WET_FUR_LENGTH } from '../../config/graphics';
import type { GrowthStage } from '../../game/types';
import type { SpeciesDefinition } from '../../species/types';
import { useGameStore } from '../../store/gameStore';
import { createFurShells, findBodyMesh, type FurHandle } from '../fur/furShells';
import { applyEyeScale, collectEyeParts } from './eyeParts';
import { damp } from './poses';

/**
 * Loads a species GLB and normalizes it: rotated to face +Z, feet on y = 0,
 * centered on X/Z, and scaled to a height of exactly 1 unit. The caller
 * scales the result to the growth-stage height.
 *
 * Materials are cloned per instance so visual effects (e.g. dirt tint)
 * never leak into the cached GLTF. The body mesh gets shell fur.
 */
export function PetModel({ species, stage }: { species: SpeciesDefinition; stage: GrowthStage }) {
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

    const eyes = collectEyeParts(root, species.model.eyePartPattern);

    const wrapper = new THREE.Group();
    wrapper.add(root);
    wrapper.scale.setScalar(1 / size.y);
    return { wrapper, root, materials, eyes, height: size.y };
  }, [scene, species.model.url, species.model.rotationY, species.model.eyePartPattern]);

  useEffect(() => () => prepared.materials.forEach((m) => m.dispose()), [prepared]);

  // Fur shells, rebuilt when the quality setting changes.
  const fur = useRef<FurHandle | null>(null);
  useEffect(() => {
    const shells = FUR_SHELLS[furQuality];
    if (shells <= 0) return;
    const body = findBodyMesh(prepared.root, species.fur.bodyMeshName);
    if (!body) return;
    const excluded: THREE.Mesh[] = [];
    prepared.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m !== body) excluded.push(m);
    });
    let handle: FurHandle | null = null;
    try {
      handle = createFurShells(body, excluded, prepared.root, prepared.height, { shells, ...species.fur });
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
    applyEyeScale(prepared.eyes, a0.eye);

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
