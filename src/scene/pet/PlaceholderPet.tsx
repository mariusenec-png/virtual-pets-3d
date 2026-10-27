import type { SpeciesDefinition } from '../../species/types';

/**
 * Temporary primitive-based stand-in used when the species GLB cannot be
 * loaded. It is normalized to 1 unit tall, faces +Z, and is clearly flagged
 * in the UI as a placeholder.
 */
export function PlaceholderPet({ species }: { species: SpeciesDefinition }) {
  const c = species.placeholder;
  const floppy = c.earShape === 'floppy';
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0.36, -0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.2, 0.32, 8, 20]} />
        <meshStandardMaterial color={c.body} roughness={0.85} />
      </mesh>
      {/* Belly */}
      <mesh position={[0, 0.3, 0.02]} scale={[0.8, 0.7, 1]} castShadow>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshStandardMaterial color={c.belly} roughness={0.9} />
      </mesh>
      {/* Legs */}
      {[
        [-0.12, 0.2],
        [0.12, 0.2],
        [-0.12, -0.25],
        [0.12, -0.25],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.11, z]} castShadow>
          <capsuleGeometry args={[0.06, 0.12, 4, 10]} />
          <meshStandardMaterial color={c.body} roughness={0.85} />
        </mesh>
      ))}
      {/* Head */}
      <group position={[0, 0.7, 0.28]}>
        <mesh castShadow>
          <sphereGeometry args={[0.2, 32, 24]} />
          <meshStandardMaterial color={c.body} roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.06, 0.15]} scale={[1, 0.75, 0.8]} castShadow>
          <sphereGeometry args={[0.1, 24, 16]} />
          <meshStandardMaterial color={c.belly} roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.02, 0.24]}>
          <sphereGeometry args={[0.028, 16, 12]} />
          <meshStandardMaterial color={c.nose} roughness={0.4} />
        </mesh>
        {[-0.075, 0.075].map((x) => (
          <mesh key={x} position={[x, 0.05, 0.17]}>
            <sphereGeometry args={[0.03, 16, 12]} />
            <meshStandardMaterial color="#1d1d1f" roughness={0.2} />
          </mesh>
        ))}
        {[-1, 1].map((side) =>
          floppy ? (
            <mesh
              key={side}
              position={[side * 0.17, 0.02, -0.02]}
              rotation={[0, 0, side * 0.35]}
              scale={[0.45, 1, 0.8]}
              castShadow
            >
              <sphereGeometry args={[0.12, 20, 14]} />
              <meshStandardMaterial color={c.ears} roughness={0.9} />
            </mesh>
          ) : (
            <mesh key={side} position={[side * 0.1, 0.2, -0.02]} rotation={[0, 0, -side * 0.25]} castShadow>
              <coneGeometry args={[0.07, 0.16, 4]} />
              <meshStandardMaterial color={c.ears} roughness={0.9} />
            </mesh>
          ),
        )}
      </group>
      {/* Tail */}
      <mesh position={[0, 0.45, -0.42]} rotation={[-0.9, 0, 0]} castShadow>
        <capsuleGeometry args={[0.04, c.tailLength, 4, 10]} />
        <meshStandardMaterial color={c.ears} roughness={0.85} />
      </mesh>
    </group>
  );
}
