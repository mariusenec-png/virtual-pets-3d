import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';

/**
 * The toy currently being played with. It bounces/swings in front of the
 * pet while the "play" activity runs. Lives inside the pet's heading group.
 */
export function PlayToy({ height }: { height: number }) {
  const group = useRef<THREE.Group>(null);
  const toyId = useGameStore((s) => (s.activity?.kind === 'play' ? s.activity.itemId : undefined));

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const a = useGameStore.getState().activity;
    const active = a?.kind === 'play' && Date.now() < a.startedAt + a.durationMs;
    g.visible = active;
    if (!active) return;
    const t = clock.elapsedTime;
    const forward = height * 0.9 + 0.1;
    if (toyId === 'featherWand' || toyId === 'rope') {
      g.position.set(Math.sin(t * 4) * 0.25, height * 0.7 + Math.sin(t * 7) * 0.08, forward);
      g.rotation.z = Math.sin(t * 4) * 0.6;
    } else if (toyId === 'frisbee') {
      g.position.set(Math.sin(t * 2.5) * 0.35, 0.15 + Math.abs(Math.sin(t * 2.5)) * 0.35, forward + 0.1);
      g.rotation.y = t * 12;
    } else {
      // Balls bounce.
      g.position.set(Math.sin(t * 2.2) * 0.3, 0.06 + Math.abs(Math.sin(t * 7)) * 0.3, forward);
      g.rotation.x = t * 6;
    }
  });

  return (
    <group ref={group} visible={false}>
      {toyId === 'ball' && (
        <mesh castShadow>
          <sphereGeometry args={[0.06, 24, 16]} />
          <meshStandardMaterial color="#d8e85a" roughness={0.6} />
        </mesh>
      )}
      {toyId === 'yarn' && (
        <mesh castShadow>
          <sphereGeometry args={[0.07, 24, 16]} />
          <meshStandardMaterial color="#e06b8b" roughness={1} />
        </mesh>
      )}
      {toyId === 'featherWand' && (
        <group>
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.5, 6]} />
            <meshStandardMaterial color="#8b5e3c" />
          </mesh>
          <mesh position={[0, -0.03, 0]} scale={[0.4, 1, 0.15]} castShadow>
            <sphereGeometry args={[0.07, 16, 12]} />
            <meshStandardMaterial color="#5aa0d8" roughness={1} />
          </mesh>
        </group>
      )}
      {toyId === 'rope' && (
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.025, 0.3, 4, 8]} />
          <meshStandardMaterial color="#d9534f" roughness={1} />
        </mesh>
      )}
      {toyId === 'frisbee' && (
        <mesh castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.02, 32]} />
          <meshStandardMaterial color="#ff9f43" roughness={0.4} />
        </mesh>
      )}
    </group>
  );
}
