import { getIllness } from '../config/illnesses';
import { NEEDS } from '../config/needs';
import { SIMULATION } from '../config/simulation';
import { useGameStore } from '../store/gameStore';
import { formatHours } from './format';
import { list, t } from '../i18n';

export function WelcomeBack() {
  const info = useGameStore((s) => s.welcomeBack);
  const dismiss = useGameStore((s) => s.dismissWelcome);
  if (!info || info.pets.length === 0) return null;
  const several = info.pets.length > 1;
  return (
    <div className="modal-backdrop" onClick={dismiss}>
      <div className="modal welcome" role="dialog" aria-label={t('welcome.title')} onClick={(e) => e.stopPropagation()}>
        <h2>{t('welcome.title')}</h2>
        <p>
          {several
            ? t('welcome.passedMany', { time: formatHours(info.simulatedHours) })
            : t('welcome.passedOne', { time: formatHours(info.simulatedHours), name: info.pets[0].name })}
        </p>
        {info.skippedHours > 0 && (
          <p className="muted small">
            {t('welcome.capped', { hours: SIMULATION.offline.maxCatchUpHours })}
          </p>
        )}
        <ul className="welcome-pets">
          {info.pets.map((p) => {
            const illness = p.illnessId ? getIllness(p.illnessId) : undefined;
            return (
              <li key={p.id}>
                <strong>{p.name}</strong>:{' '}
                {illness && (
                  <span>{t('welcome.sick', { icon: illness.icon, illness: illness.name })} </span>
                )}
                {p.lowNeeds.length > 0 ? (
                  <span>{t('welcome.needs', { list: list(p.lowNeeds.map((id) => NEEDS[id].label.toLowerCase())) })}</span>
                ) : (
                  !illness && <span>{t('welcome.fine')}</span>
                )}
              </li>
            );
          })}
        </ul>
        <button className="btn btn-primary" onClick={dismiss} autoFocus>
          {t('welcome.go')}
        </button>
      </div>
    </div>
  );
}
