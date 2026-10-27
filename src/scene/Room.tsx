import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { ROOM_LAYOUT } from '../config/activities';
import { getDecor, ROOM } from '../config/decor';
import { useGameStore } from '../store/gameStore';
import { DecorLayer } from './decor/DecorLayer';
import { Bowl } from './props/Bowl';
import { PetBed } from './props/PetBed';
import { ToyBasket } from './props/ToyBasket';

/**
 * The cozy pet room. Built from procedural geometry so it needs no external
 * assets. Props that react to gameplay (bowls, bed) live in ./props.
 */

function themeColors(id: string, fallback: string) {
  const c = getDecor(id)?.colors ?? getDecor(fallback)!.colors!;
  return { main: c.main, accent: c.accent ?? c.main };
}

function useTileTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#d6d0c6';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 128, 128);
    ctx.strokeRect(128, 128, 128, 128);
    ctx.strokeRect(128, 0, 128, 128);
    ctx.strokeRect(0, 128, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);
}

function useWoodTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    const planks = 8;
    for (let i = 0; i < planks; i++) {
      const shade = 200 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.76)}, ${Math.floor(shade * 0.52)})`;
      ctx.fillRect(0, (i * 512) / planks, 512, 512 / planks);
      ctx.fillStyle = 'rgba(80, 50, 25, 0.35)';
      ctx.fillRect(0, (i * 512) / planks, 512, 2);
      // Grain lines.
      ctx.strokeStyle = 'rgba(120, 80, 45, 0.12)';
      for (let g = 0; g < 6; g++) {
        const y = (i * 512) / planks + 6 + g * 9;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(170, y + 3, 340, y - 3, 512, y + 1);
        ctx.stroke();
      }
      // Staggered seams.
      ctx.fillStyle = 'rgba(80, 50, 25, 0.3)';
      ctx.fillRect(((i * 197) % 400) + 40, (i * 512) / planks, 2, 512 / planks);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);
}

function Window() {
  return (
    <group position={[-0.6, 1.55, -2.48]}>
      {/* Sky */}
      <mesh>
        <planeGeometry args={[1.3, 1.0]} />
        <meshBasicMaterial color="#cfe8f5" toneMapped={false} />
      </mesh>
      {/* Frame */}
      {[
        [0, 0.52, 1.42, 0.06],
        [0, -0.52, 1.42, 0.06],
        [0.68, 0, 0.06, 1.1],
        [-0.68, 0, 0.06, 1.1],
        [0, 0, 0.04, 1.0],
        [0, 0, 1.3, 0.04],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.02]} castShadow>
          <boxGeometry args={[w, h, 0.05]} />
          <meshStandardMaterial color="#fbf7f0" roughness={0.6} />
        </mesh>
      ))}
      {/* Sill */}
      <mesh position={[0, -0.58, 0.07]} castShadow receiveShadow>
        <boxGeometry args={[1.55, 0.05, 0.18]} />
        <meshStandardMaterial color="#fbf7f0" roughness={0.6} />
      </mesh>
      {/* Curtains */}
      {[-0.86, 0.86].map((x) => (
        <mesh key={x} position={[x, -0.05, 0.08]} castShadow>
          <boxGeometry args={[0.24, 1.35, 0.04]} />
          <meshStandardMaterial color="#9fb8a0" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return { a, tilt: 0.5 + (i % 3) * 0.2, h: 0.32 + (i % 4) * 0.05 };
      }),
    [],
  );
  return (
    <group position={position}>
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.11, 0.28, 24]} />
        <meshStandardMaterial color="#d97f5d" roughness={0.8} />
      </mesh>
      {leaves.map((l, i) => (
        <mesh
          key={i}
          position={[Math.cos(l.a) * 0.06, 0.28 + l.h / 2, Math.sin(l.a) * 0.06]}
          rotation={[Math.sin(l.a) * l.tilt, 0, -Math.cos(l.a) * l.tilt]}
          castShadow
        >
          <capsuleGeometry args={[0.035, l.h, 4, 8]} />
          <meshStandardMaterial color={i % 2 ? '#5d8a5a' : '#6f9e63'} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Shelf() {
  return (
    <group position={[1.2, 1.25, -2.45]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.05, 0.22]} />
        <meshStandardMaterial color="#a77b52" roughness={0.7} />
      </mesh>
      <mesh position={[-0.3, 0.12, 0]} castShadow>
        <boxGeometry args={[0.08, 0.2, 0.15]} />
        <meshStandardMaterial color="#e2a25e" />
      </mesh>
      <mesh position={[-0.2, 0.11, 0]} castShadow>
        <boxGeometry args={[0.07, 0.18, 0.15]} />
        <meshStandardMaterial color="#7a9cc6" />
      </mesh>
      <mesh position={[0.25, 0.1, 0]} castShadow>
        <sphereGeometry args={[0.08, 24, 16]} />
        <meshStandardMaterial color="#f2d8c4" roughness={0.4} />
      </mesh>
    </group>
  );
}

export function Room() {
  const wood = useWoodTexture();
  const tiles = useTileTexture();
  const room = useGameStore((s) => s.household.room);
  const wall = themeColors(room.wall, ROOM.defaults.wall);
  const floor = themeColors(room.floor, ROOM.defaults.floor);
  const rug = themeColors(room.rug, ROOM.defaults.rug);
  const tiled = room.floor === 'floorTiles';
  const WALL = wall.main;
  const WALL_TRIM = wall.accent;
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial
          key={tiled ? 'tiles' : 'wood'}
          map={tiled ? tiles : wood}
          color={floor.main}
          roughness={tiled ? 0.45 : 0.75}
        />
      </mesh>
      {/* Rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0.15]} receiveShadow>
        <circleGeometry args={[1.0, 64]} />
        <meshStandardMaterial color={rug.main} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0.15]} receiveShadow>
        <ringGeometry args={[0.82, 0.88, 64]} />
        <meshStandardMaterial color={rug.accent} roughness={1} />
      </mesh>
      {/* Walls */}
      <mesh position={[0, 1.5, -2.5]} receiveShadow>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      <mesh position={[-3, 1.5, 0.5]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      {/* Baseboards */}
      <mesh position={[0, 0.06, -2.48]} receiveShadow>
        <boxGeometry args={[6, 0.12, 0.04]} />
        <meshStandardMaterial color={WALL_TRIM} />
      </mesh>
      <mesh position={[-2.98, 0.06, 0.5]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[6, 0.12, 0.04]} />
        <meshStandardMaterial color={WALL_TRIM} />
      </mesh>

      <Window />
      <Shelf />
      <Plant position={[-2.3, 0, -1.9]} />

      {/* Low cabinet */}
      <RoundedBox args={[1.1, 0.55, 0.45]} radius={0.03} position={[-1.7, 0.275, -2.2]} castShadow receiveShadow>
        <meshStandardMaterial color="#f4ece1" roughness={0.6} />
      </RoundedBox>

      <Bowl kind="food" position={ROOM_LAYOUT.foodBowl} />
      <Bowl kind="water" position={ROOM_LAYOUT.waterBowl} />
      <PetBed position={ROOM_LAYOUT.bed} />
      <ToyBasket position={ROOM_LAYOUT.toyBasket} />
      <DecorLayer />
    </group>
  );
}
