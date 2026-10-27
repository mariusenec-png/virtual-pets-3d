import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { playSound } from '../../audio/engine';
import { CATCH_GAME } from '../../config/minigames';
import { stepCatchGame } from '../../game/catchGame';
import { useGameStore } from '../../store/gameStore';
import { CATCH_VIEW_HALF_WIDTH, CATCH_Z, catchRuntime } from './runtime';
import { haptic } from '../../ui/haptics';

const POOL = 28;

/**
 * 3D part of "Catch the Treats": steps the game logic every frame, draws the
 * falling items and drives the camera to a fixed side-on view.
 */
export function CatchScene() {
  const phase = useGameStore((s) => s.minigame?.phase);
  const pool = useRef<(THREE.Group | null)[]>([]);
  const finished = useRef(false);
  const lookAt = useMemo(() => new THREE.Vector3(0, 0.95, CATCH_Z), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const { camera, size } = useThree();

  useFrame((three, dt) => {
    // Camera: keep the play area horizontally in view for any aspect ratio.
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const halfFov = THREE.MathUtils.degToRad(cam.fov / 2);
    const distance = Math.max(2.9, CATCH_VIEW_HALF_WIDTH / (Math.tan(halfFov) * aspect));
    camPos.set(0, 1.1, CATCH_Z + distance);
    catchRuntime.viewHalfWidth = Math.tan(halfFov) * aspect * cam.position.distanceTo(lookAt);
    cam.position.lerp(camPos, 1 - Math.exp(-5 * Math.min(dt, 0.1)));
    cam.lookAt(lookAt);

    const game = catchRuntime.game;
    if (game && phase === 'playing' && !game.over) {
      const events = stepCatchGame(game, dt, catchRuntime.input, Math.random);
      const store = useGameStore.getState();
      for (const e of events) {
        if (e.type === 'catch') {
          catchRuntime.lastCatchAt = Date.now();
          haptic(e.kind === 'golden' ? 30 : 12);
          if (e.kind === 'golden') playSound('golden');
          else playSound('catch', 1 + Math.min(game.combo, 12) * 0.05);
          store.popFx(e.kind === 'golden' ? 'levelUp' : 'xp', e.kind === 'golden' ? `+${e.points} ⭐` : `+${e.points}`);
        } else if (e.type === 'hazard') {
          catchRuntime.lastHazardAt = Date.now();
          playSound('hazard');
          haptic(70);
          store.popFx('xp', `-${CATCH_GAME.hazardPenalty} 🧼`);
        } else if (e.type === 'miss') {
          playSound('miss');
        }
      }
      if (game.over && !finished.current) {
        finished.current = true;
        store.finishMinigame({ score: game.score, caught: game.caught, bestCombo: game.bestCombo });
      }
    }
    if (phase !== 'playing') finished.current = false;

    // Draw items from the pool.
    const items = game?.items ?? [];
    const t = three.clock.elapsedTime;
    for (let i = 0; i < POOL; i++) {
      const g = pool.current[i];
      if (!g) continue;
      const item = items[i];
      g.visible = !!item;
      if (!item) continue;
      g.position.set(item.x, item.y, CATCH_Z);
      g.rotation.set(t * 2 + item.id, t * 3 + item.id, 0);
      g.children[0].visible = item.kind === 'treat';
      g.children[1].visible = item.kind === 'golden';
      g.children[2].visible = item.kind === 'hazard';
    }
  });

  return (
    <group>
      {Array.from({ length: POOL }, (_, i) => (
        <group key={i} ref={(el) => void (pool.current[i] = el)} visible={false}>
          {/* Treat: kibble-like disc */}
          <mesh castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
            <meshStandardMaterial color="#a0612f" roughness={0.8} />
          </mesh>
          {/* Golden treat */}
          <mesh castShadow>
            <icosahedronGeometry args={[0.075, 0]} />
            <meshStandardMaterial color="#ffcc33" emissive="#ffaa00" emissiveIntensity={0.45} metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Hazard: soap bottle */}
          <group>
            <mesh castShadow>
              <cylinderGeometry args={[0.05, 0.055, 0.15, 14]} />
              <meshStandardMaterial color="#5aa9e6" roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.095, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.05, 10]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
