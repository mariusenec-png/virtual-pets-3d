import { GROWTH_STAGES } from '../config/growth';
import { getSpecies } from '../species/registry';
import { useGameStore } from '../store/gameStore';
import { t } from '../i18n';

export function GrowthDialog() {
  const grewTo = useGameStore((s) => s.grewTo);
  const pet = useGameStore((s) => s.game.pet);
  const dismiss = useGameStore((s) => s.dismissGrowth);
  if (!grewTo || !pet) return null;
  const stage = GROWTH_STAGES.find((s) => s.id === grewTo)!;
  const species = getSpecies(pet.species);
  const isAdult = grewTo === 'adult';
  return (
    <div className="modal-backdrop" onClick={dismiss}>
      <div className="modal welcome growth" role="dialog" aria-label={t('growth.ok')} onClick={(e) => e.stopPropagation()}>
        <div className="growth-icon" aria-hidden>
          🌱 {species.icon}
        </div>
        <h2>{isAdult ? t('growth.adultTitle', { name: pet.name }) : t('growth.title', { name: pet.name })}</h2>
        <p className="muted">{t('growth.stageLine', { stage: stage.label, species: species.name.toLowerCase() })}</p>
        <p>{isAdult ? t('growth.adultText', { name: pet.name }) : t('growth.text', { name: pet.name })}</p>
        <button className="btn btn-primary" onClick={dismiss} autoFocus>
          {t('growth.ok')}
        </button>
      </div>
    </div>
  );
}
