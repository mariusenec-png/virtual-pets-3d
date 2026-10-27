import { NEED_ORDER, NEEDS } from '../config/needs';
import { useGameStore } from '../store/gameStore';
import { t } from '../i18n';

function level(value: number, warn: number, critical: number): 'good' | 'warn' | 'critical' {
  if (value < critical) return 'critical';
  if (value < warn) return 'warn';
  return 'good';
}

export function NeedsPanel() {
  const needs = useGameStore((s) => s.game.pet?.needs);
  if (!needs) return null;
  return (
    <section className="panel needs" aria-label={t('needs.label')}>
      {NEED_ORDER.map((id) => {
        const def = NEEDS[id];
        const v = needs[id];
        const lvl = level(v, def.warnBelow, def.criticalBelow);
        return (
          <div key={id} className={`need need-${lvl}`} title={`${def.label}: ${Math.round(v)}/100`}>
            <span className="need-icon" aria-hidden>
              {def.icon}
            </span>
            <div className="need-body">
              <div className="need-label">
                <span>{def.label}</span>
                <span className="need-value">{Math.round(v)}</span>
              </div>
              <div
                className="bar"
                role="progressbar"
                aria-label={def.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(v)}
              >
                <div className="bar-fill" style={{ width: `${v}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
