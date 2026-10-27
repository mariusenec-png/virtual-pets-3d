import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DECOR_SLOTS, getDecor, slotRotation, type DecorSlot } from '../../config/decor';
import { useGameStore } from '../../store/gameStore';
import { buildFurniture } from './furnitureModels';

/** Furniture placed in the room, plus the spot markers while placing. */
export function DecorLayer() {
  const placed = useGameStore((s) => s.household.room.placed);
  const placing = useGameStore((s) => s.decorPlacing);
  return (
    <group>
      {DECOR_SLOTS.map((slot) => {
        const id = placed[slot.id];
        return id ? <PlacedFurniture key={`${slot.id}:${id}`} id={id} slot={slot} /> : null;
      })}
      {placing && DECOR_SLOTS.map((slot) => <SlotMarker key={slot.id} slot={slot} occupied={!!placed[slot.id]} />)}
    </group>
  );
}

function PlacedFurniture({ id, slot }: { id: string; slot: DecorSlot }) {
  const model = useMemo(() => buildFurniture(id, getDecor(id)?.light), [id]);
  useEffect(() => () => model?.dispose(), [model]);
  useFrame(({ clock }) => model?.update?.(clock.elapsedTime));
  if (!model) return null;
  return (
    <group position={[slot.position[0], 0, slot.position[1]]} rotation={[0, slotRotation(slot), 0]}>
      <primitive object={model.object} />
    </group>
  );
}

function SlotMarker({ slot, occupied }: { slot: DecorSlot; occupied: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const placeDecor = useGameStore((s) => s.placeDecor);
  useFrame(({ clock }) => {
    const m = ring.current;
    if (!m) return;
    const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.06;
    m.scale.set(s, s, s);
  });
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    placeDecor(slot.id);
  };
  const color = occupied ? '#f0a54a' : '#5fc28a';
  return (
    <group position={[slot.position[0], 0.02, slot.position[1]]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.44, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={onClick}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <circleGeometry args={[0.44, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* A soft column of light so spots are easy to find from any angle. */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 1.2, 32, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
