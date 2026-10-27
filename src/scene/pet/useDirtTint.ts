import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';

const DIRT_COLOR = new THREE.Color('#6b5236');
/** Hygiene below which the coat starts to look dirty. */
const DIRTY_BELOW = 45;
const MAX_TINT = 0.5;

type Tintable = THREE.Material & { color?: THREE.Color; userData: { baseColor?: THREE.Color } };

/**
 * Tints every material under `root` towards a muddy color as hygiene drops,
 * so a bath produces a clearly visible change. Materials must be unique to
 * this pet instance (PetModel clones them).
 */
export function useDirtTint(root: RefObject<THREE.Object3D | null>) {
  const last = useRef({ dirt: -1, meshes: -1, frame: 0 });

  useFrame(() => {
    const obj = root.current;
    if (!obj) return;
    const hygiene = useGameStore.getState().game.pet?.needs.hygiene ?? 100;
    const dirt = THREE.MathUtils.clamp((DIRTY_BELOW - hygiene) / DIRTY_BELOW, 0, 1);
    const l = last.current;
    l.frame += 1;
    // Re-scan occasionally so a model that finished loading gets tinted too.
    const rescan = l.frame % 30 === 0;
    if (!rescan && Math.abs(dirt - l.dirt) < 0.01) return;

    let meshes = 0;
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      meshes += 1;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Tintable[];
      for (const m of mats) {
        if (!m.color) continue;
        if (!m.userData.baseColor) m.userData.baseColor = m.color.clone();
        m.color.copy(m.userData.baseColor).lerp(DIRT_COLOR, dirt * MAX_TINT);
      }
    });
    l.dirt = dirt;
    l.meshes = meshes;
  });
}
