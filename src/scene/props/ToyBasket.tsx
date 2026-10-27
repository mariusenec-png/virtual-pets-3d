import { useMemo } from 'react';
import * as THREE from 'three';

export function ToyBasket({ position }: { position: [number, number, number] }) {
  const basket = useMemo(() => {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.2, 0),
      new THREE.Vector2(0.24, 0.2),
      new THREE.Vector2(0.23, 0.21),
      new THREE.Vector2(0.19, 0.02),
      new THREE.Vector2(0, 0.02),
    ];
    return new THREE.LatheGeometry(pts, 32);
  }, []);
  return (
    <group position={position}>
      <mesh geometry={basket} castShadow receiveShadow>
        <meshStandardMaterial color="#c9a46b" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.06, 0.2, 0.03]} castShadow>
        <sphereGeometry args={[0.07, 20, 14]} />
        <meshStandardMaterial color="#d8e85a" roughness={0.6} />
      </mesh>
      <mesh position={[0.07, 0.19, -0.04]} castShadow>
        <sphereGeometry args={[0.075, 20, 14]} />
        <meshStandardMaterial color="#e06b8b" roughness={1} />
      </mesh>
      <mesh position={[0.0, 0.24, -0.02]} rotation={[0.4, 0, 0.6]} castShadow>
        <torusGeometry args={[0.05, 0.015, 8, 20]} />
        <meshStandardMaterial color="#5aa0d8" />
      </mesh>
    </group>
  );
}
