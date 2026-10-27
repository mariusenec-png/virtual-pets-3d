export function PetBed({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Raised cushion rim */}
      <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[0.42, 0.11, 20, 48]} />
        <meshStandardMaterial color="#8a6fa8" roughness={0.95} />
      </mesh>
      {/* Inner pad */}
      <mesh position={[0, 0.045, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.4, 0.42, 0.07, 48]} />
        <meshStandardMaterial color="#efe2f5" roughness={1} />
      </mesh>
      {/* Little pillow */}
      <mesh position={[0.08, 0.1, -0.2]} rotation={[0.2, 0.3, 0]} castShadow>
        <sphereGeometry args={[0.12, 24, 16]} />
        <meshStandardMaterial color="#f7d6e0" roughness={1} />
      </mesh>
    </group>
  );
}
