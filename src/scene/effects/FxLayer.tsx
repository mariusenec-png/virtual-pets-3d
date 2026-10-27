import { Html } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';

/**
 * Floating feedback above the pet's head: XP gains, level-ups, hearts and
 * growth announcements. Rendered as DOM via <Html> (no font downloads).
 */
export function FxLayer({ height }: { height: number }) {
  const fx = useGameStore((s) => s.fx);
  return (
    <Html position={[0, height + 0.08, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
      <div className="fx-anchor">
        {fx.map((f, i) => {
          if (f.kind === 'hearts') {
            return (
              <div key={f.id} className="fx fx-hearts">
                {['💗', '💕', '💗'].map((h, j) => (
                  <span key={j} style={{ animationDelay: `${j * 0.15}s`, left: `${(j - 1) * 26}px` }}>
                    {h}
                  </span>
                ))}
              </div>
            );
          }
          return (
            <div
              key={f.id}
              className={`fx fx-${f.kind}`}
              style={{ ['--fx-offset' as string]: `${(i % 3) * 14 - 14}px` }}
            >
              {f.kind === 'levelUp' && '⭐ '}
              {f.kind === 'grow' && '🌱 '}
              {f.label}
            </div>
          );
        })}
      </div>
    </Html>
  );
}
