import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ROOM_LAYOUT } from '../../config/activities';
import { useGameStore } from '../../store/gameStore';

const BUBBLES = 26;

/** A small tub with foam bubbles that appears during the bath activity. */
export function BathTub() {
  const group = useRef<THREE.Group>(null);
  const bubbles = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () => Array.from({ length: BUBBLES }, () => ({ a: Math.random() * Math.PI * 2, r: 0.15 + Math.random() * 0.3, s: 0.6 + Math.random() * 0.8, o: Math.random() })),
    [],
  );
  const tub = useMemo(() => {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.5, 0),
      new THREE.Vector2(0.55, 0.18),
      new THREE.Vector2(0.53, 0.19),
      new THREE.Vector2(0.48, 0.02),
      new THREE.Vector2(0, 0.02),
    ];
    return new THREE.LatheGeometry(pts, 48);
  }, []);

  useFrame(({ clock }) => {
    const g = group.current;
    const b = bubbles.current;
    if (!g || !b) return;
    const a = useGameStore.getState().activity;
    const now = Date.now();
    const active = a?.kind === 'bath' && now < a.startedAt + a.durationMs;
    const p = active ? (now - a!.startedAt) / a!.durationMs : 1;
    // Pop in, hold, pop out.
    const s = active ? Math.min(1, p * 6, (1 - p) * 6) : 0;
    g.visible = s > 0.01;
    g.scale.setScalar(Math.max(0.001, s));
    if (!g.visible) return;
    const t = clock.elapsedTime;
    seeds.forEach((seed, i) => {
      const rise = (t * 0.35 * seed.s + seed.o) % 1;
      dummy.position.set(Math.cos(seed.a + t * 0.3) * seed.r, 0.15 + rise * 0.6, Math.sin(seed.a + t * 0.3) * seed.r * 0.8);
      dummy.scale.setScalar((0.03 + seed.s * 0.025) * Math.sin(rise * Math.PI));
      dummy.updateMatrix();
      b.setMatrixAt(i, dummy.matrix);
    });
    b.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group} position={ROOM_LAYOUT.bathSpot} visible={false}>
      <mesh geometry={tub} castShadow receiveShadow>
        <meshStandardMaterial color="#e8f4fb" roughness={0.25} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 40]} />
        <meshStandardMaterial color="#bfe6fa" transparent opacity={0.7} roughness={0.05} />
      </mesh>
      <instancedMesh ref={bubbles} args={[undefined, undefined, BUBBLES]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.75} roughness={0.1} />
      </instancedMesh>
    </group>
  );
}
