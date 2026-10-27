import { useEffect, useState } from 'react';
import { getIllness, VET } from '../config/illnesses';
import { NEEDS } from '../config/needs';
import { useGameStore } from '../store/gameStore';
import { t } from '../i18n';

type Step = 'intro' | 'examining' | 'result' | 'done';

const EXAM_MS = 1400;

/**
 * Veterinary clinic: examine the pet, get a diagnosis and pick a treatment.
 * The basic treatment is always free so a broke player can never get stuck.
 */
export function VetPanel({ onClose }: { onClose: () => void }) {
  const pet = useGameStore((s) => s.game.pet);
  const coins = useGameStore((s) => s.game.coins);
  const store = useGameStore.getState();
  const [step, setStep] = useState<Step>('intro');
  const [outcome, setOutcome] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 'examining') return;
    const id = window.setTimeout(() => setStep('result'), EXAM_MS);
    return () => window.clearTimeout(id);
  }, [step]);

  if (!pet) return null;
  const illness = pet.illness ? getIllness(pet.illness.id) : undefined;
  const health = Math.round(pet.needs.health);
  const healthLevel = health < NEEDS.health.criticalBelow ? 'critical' : health < NEEDS.health.warnBelow ? 'warn' : 'good';

  const finish = (text: string) => {
    setOutcome(text);
    setStep('done');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal vet" role="dialog" aria-label={t('vet.label')} onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{t('vet.title')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </header>

        <div className={`vet-health need-${healthLevel}`}>
          <span>{t('vet.health')}</span>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${health}%` }} />
          </div>
          <strong>{health}</strong>
        </div>

        {step === 'intro' && (
          <section className="vet-step">
            <p>
              {t('vet.intro', { name: pet.name })}
              {pet.isSleeping && ` ${t('vet.introAsleep', { name: pet.name })}`}
            </p>
            <button className="btn btn-primary" onClick={() => setStep('examining')} autoFocus>
              {t('vet.examine', { name: pet.name })}
            </button>
          </section>
        )}

        {step === 'examining' && (
          <section className="vet-step vet-examining" aria-live="polite">
            <div className="stethoscope" aria-hidden>
              🩺
            </div>
            <p>{t('vet.examining', { name: pet.name })}</p>
          </section>
        )}

        {step === 'result' && illness && (
          <section className="vet-step">
            <h3>{t('vet.diagnosis', { icon: illness.icon, illness: illness.name })}</h3>
            <p>{illness.description}</p>
            <div className="vet-columns">
              <div>
                <h4>{t('vet.symptoms')}</h4>
                <ul>
                  {illness.symptoms.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>{t('vet.cause')}</h4>
                <p className="small">{illness.likelyCause}</p>
              </div>
            </div>
            <h4>{t('vet.treatment')}</h4>
            <div className="vet-options">
              <button
                className="vet-option"
                disabled={coins < illness.treatment.price}
                onClick={() => {
                  if (store.treat('paid')) finish(t('vet.paidDone', { treatment: illness.treatment.name, prevention: illness.prevention }));
                }}
              >
                <strong>{illness.treatment.name}</strong>
                <small>{t('vet.paidDesc', { name: pet.name })}</small>
                <span className="price">🪙 {illness.treatment.price}</span>
              </button>
              <button
                className="vet-option"
                onClick={() => {
                  if (store.treat('basic')) finish(t('vet.basicDone', { name: pet.name, prevention: illness.prevention }));
                }}
              >
                <strong>{VET.basic.name}</strong>
                <small>{t('vet.basicDesc', { name: pet.name })}</small>
                <span className="price free">{t('vet.free')}</span>
              </button>
            </div>
            <p className="muted small">{t('vet.coinsNote', { coins })}</p>
          </section>
        )}

        {step === 'result' && !illness && (
          <section className="vet-step">
            <h3>{t('vet.notSick', { name: pet.name })}</h3>
            <p>
              {health >= 100 ? t('vet.perfect', { name: pet.name }) : t('vet.noIllness', { health })}
            </p>
            {health < 100 && (
              <div className="vet-options">
                <button
                  className="vet-option"
                  disabled={coins < VET.vitamins.price}
                  onClick={() => {
                    if (store.vitamins()) finish(t('vet.vitaminsDone', { name: pet.name }));
                  }}
                >
                  <strong>{VET.vitamins.name}</strong>
                  <small>{t('vet.vitaminsDesc', { n: VET.vitamins.effects.health ?? 0 })}</small>
                  <span className="price">🪙 {VET.vitamins.price}</span>
                </button>
              </div>
            )}
          </section>
        )}

        {step === 'done' && (
          <section className="vet-step">
            <h3>{t('vet.done')}</h3>
            <p>{outcome}</p>
            <button className="btn btn-primary" onClick={onClose} autoFocus>
              {t('vet.backHome')}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
