import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import type { SpeciesId } from '../game/types';
import { BathTub } from './effects/BathTub';
import { FUR_LAYER } from './fur/furShells';
import { CatchScene } from './minigame/CatchScene';
import { useGameStore } from '../store/gameStore';
import { Pet } from './pet/Pet';
import { Room } from './Room';
import { SoftEnvironment } from './SoftEnvironment';
import { graphicsProfile } from '../config/device';

/** Fur is on its own render layer so contact shadows skip it; the main camera enables it. */
const gfx = graphicsProfile();

export function PetScene({ speciesId, petId }: { speciesId: SpeciesId; petId: string }) {
  const inMinigame = useGameStore((s) => !!s.minigame);
  return (
    <Canvas
      className="scene-canvas"
      shadows
      dpr={[1, gfx.maxDpr]}
      camera={{ position: [0.4, 1.25, 2.9], fov: 42, near: 0.05, far: 50 }}
      gl={{ antialias: true, preserveDrawingBuffer: false, alpha: false }}
      onCreated={({ camera }) => camera.layers.enable(FUR_LAYER)}
    >
      <color attach="background" args={['#f3e7d8']} />
      <fog attach="fog" args={['#f3e7d8', 6, 12]} />

      <SoftEnvironment intensity={0.4} />
      <hemisphereLight args={['#fff6ea', '#b89a7a', 0.7]} />
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[2.5, 4.5, 2.5]}
        intensity={1.6}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[gfx.shadowMapSize, gfx.shadowMapSize]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.5}
        shadow-camera-far={12}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* Cool fill light from the window side */}
      <pointLight position={[-0.6, 1.6, -1.6]} intensity={1.2} distance={5} color="#d8ecff" />

      <Suspense fallback={null}>
        <Room />
      </Suspense>
      {/* Keyed by pet so switching pets starts fresh (position, pose, model). */}
      <Pet key={petId} speciesId={speciesId} />
      <BathTub />

      <ContactShadows position={[0, 0.006, 0]} opacity={0.35} scale={6} blur={2.4} far={1.2} resolution={gfx.contactShadowResolution} />

      {inMinigame && <CatchScene />}

      {/* The mini-game drives the camera itself; free orbiting comes back afterwards. */}
      {!inMinigame && (
        <OrbitControls
          makeDefault
          target={[0, 0.35, 0]}
          enablePan={false}
          minDistance={1.2}
          maxDistance={5}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI / 2.08}
          minAzimuthAngle={-Math.PI / 2.2}
          maxAzimuthAngle={Math.PI / 2.2}
          enableDamping
          dampingFactor={0.08}
        />
      )}
    </Canvas>
  );
}
