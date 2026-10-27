import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';

/**
 * Food or water bowl. Food appears when the pet starts eating and shrinks
 * as it eats; water fills up when given and drains while the pet drinks.
 */

const FOOD_COLORS: Record<string, string> = {
  kibble: '#9a5f33',
  wetFood: '#b5674a',
  salmonTreat: '#f08a6c',
  chickenBites: '#d7a15f',
  gourmetFeast: '#c0583c',
  vitaminTreat: '#e8b94a',
};

interface BowlProps {
  kind: 'food' | 'water';
  position: [number, number, number];
}

export function Bowl({ kind, position }: BowlProps) {
  const contentRef = useRef<THREE.Mesh>(null);
  const contentMat = useRef<THREE.MeshStandardMaterial>(null);
  const lastSeq = useRef(-1);
  const idleLevel = kind === 'water' ? 0.35 : 0;

  const bowlGeometry = useMemo(() => {
    // Lathe profile: outer wall, rim, inner wall.
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.13, 0.0),
      new THREE.Vector2(0.17, 0.06),
      new THREE.Vector2(0.18, 0.09),
      new THREE.Vector2(0.165, 0.095),
      new THREE.Vector2(0.14, 0.04),
      new THREE.Vector2(0.0, 0.025),
    ];
    return new THREE.LatheGeometry(pts, 48);
  }, []);

  useFrame(() => {
    const mesh = contentRef.current;
    const mat = contentMat.current;
    if (!mesh || !mat) return;
    const { activity } = useGameStore.getState();
    const t = Date.now();
    let level = idleLevel;
    const mine = activity && (kind === 'food' ? activity.kind === 'eat' : activity.kind === 'drink');
    if (mine && activity) {
      if (lastSeq.current !== activity.seq) {
        lastSeq.current = activity.seq;
        if (kind === 'food') mat.color.set(FOOD_COLORS[activity.itemId ?? ''] ?? '#9a5f33');
      }
      const p = THREE.MathUtils.clamp((t - activity.startedAt) / activity.durationMs, 0, 1);
      // Fill quickly, then deplete while the pet eats/drinks.
      level = p < 0.12 ? p / 0.12 : 1 - ((p - 0.12) / 0.88) * (1 - idleLevel);
    }
    mesh.visible = level > 0.02;
    const s = 0.55 + 0.45 * level;
    mesh.scale.set(s, kind === 'food' ? Math.max(0.05, level) : 1, s);
    mesh.position.y = kind === 'food' ? 0.03 + 0.025 * level : 0.03 + 0.05 * level;
  });

  return (
    <group position={position}>
      <mesh geometry={bowlGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={kind === 'food' ? '#e2725b' : '#5b9bd5'}
          roughness={0.35}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {kind === 'food' ? (
        <mesh ref={contentRef} position={[0, 0.03, 0]} castShadow>
          <sphereGeometry args={[0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial ref={contentMat} color="#9a5f33" roughness={0.9} />
        </mesh>
      ) : (
        <mesh ref={contentRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.15, 40]} />
          <meshStandardMaterial
            ref={contentMat}
            color="#8fd3f4"
            roughness={0.05}
            metalness={0.1}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}
    </group>
  );
}
