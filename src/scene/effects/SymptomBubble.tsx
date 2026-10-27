import { Html } from '@react-three/drei';
import { getIllness } from '../../config/illnesses';
import { useGameStore } from '../../store/gameStore';

/** A small thought bubble with the illness icon floating next to a sick pet. */
export function SymptomBubble({ height }: { height: number }) {
  const illnessId = useGameStore((s) => s.game.pet?.illness?.id);
  const sleeping = useGameStore((s) => !!s.game.pet?.isSleeping);
  if (!illnessId || sleeping) return null;
  const illness = getIllness(illnessId);
  if (!illness) return null;
  return (
    <Html position={[-height * 0.35, height * 0.95, 0]} center pointerEvents="none" zIndexRange={[15, 0]}>
      <div className={`symptom symptom-${illness.id}`} title={illness.name}>
        {illness.icon}
      </div>
    </Html>
  );
}
