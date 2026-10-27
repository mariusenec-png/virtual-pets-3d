import { Html } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';

export function SleepZzz({ height }: { height: number }) {
  const sleeping = useGameStore((s) => !!s.game.pet?.isSleeping);
  if (!sleeping) return null;
  return (
    <Html position={[height * 0.25, height * 0.8, 0]} center pointerEvents="none" zIndexRange={[15, 0]}>
      <div className="zzz">
        <span>z</span>
        <span>z</span>
        <span>Z</span>
      </div>
    </Html>
  );
}
