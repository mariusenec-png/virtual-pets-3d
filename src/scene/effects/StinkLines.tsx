import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { NEEDS } from '../../config/needs';
import { useGameStore } from '../../store/gameStore';

/** Wavy green wisps that rise from the pet when hygiene is low. */
export function StinkLines({ height }: { height: number }) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      Array.from({ length: 6 }, (_, i) => new THREE.Vector3(Math.sin(i * 1.4) * 0.03, i * 0.04, 0)),
    );
    return new THREE.TubeGeometry(curve, 24, 0.006, 6, false);
  }, []);
  const offsets = [-0.12, 0.0, 0.12];

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const hygiene = useGameStore.getState().game.pet?.needs.hygiene ?? 100;
    const visible = hygiene < NEEDS.hygiene.warnBelow;
    g.visible = visible;
    if (!visible) return;
    g.children.forEach((child, i) => {
      const phase = (clock.elapsedTime * 0.5 + i / 3) % 1;
      child.position.y = height * 0.85 + phase * 0.25;
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = Math.sin(phase * Math.PI) * 0.8;
    });
  });

  return (
    <group ref={group} visible={false}>
      {offsets.map((x) => (
        <mesh key={x} geometry={geometry} position={[x, height, 0]}>
          <meshBasicMaterial color="#8fbf5a" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
