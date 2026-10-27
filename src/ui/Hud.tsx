import { xpToNextLevel } from '../config/progression';
import { TIME_SCALE_PRESETS } from '../config/simulation';
import { getMood } from '../game/mood';
import { getIllness } from '../config/illnesses';
import { getPersonality } from '../config/personality';
import { dailyStatus } from '../game/daily';
import { getGrowthStageDefinition, levelProgress, nextStageRequirements } from '../game/progression';
import { getSpecies } from '../species/registry';
import { useGameStore } from '../store/gameStore';
import { formatAge, formatClock } from './format';
import { useNow } from './hooks';
import { t } from '../i18n';

/** Requirement labels come from progression.ts as stable ids. */
function reqLabel(label: string): string {
  if (label === 'age') return t('req.age');
  if (label === 'level') return t('req.level');
  return t('req.care');
}

export function PetCard({ onOpenVet }: { onOpenVet: () => void }) {
  const pet = useGameStore((s) => s.game.pet);
  if (!pet) return null;
  const species = getSpecies(pet.species);
  const stage = getGrowthStageDefinition(pet);
  const mood = getMood(pet);
  const progress = levelProgress(pet);
  const illness = pet.illness ? getIllness(pet.illness.id) : undefined;
  const next = nextStageRequirements(pet);
  const personality = getPersonality(pet.personality);
  return (
    <section className="panel petcard" aria-label={t('card.label')}>
      <div className="petcard-top">
        <span className="petcard-icon" aria-hidden>
          {species.icon}
        </span>
        <div className="petcard-id">
          <h2>{pet.name}</h2>
          <div className="petcard-sub">
            {t('card.sub', { stage: stage.label, species: species.name.toLowerCase(), age: formatAge(pet.ageHours) })}
            {' · '}
            <span className="personality" title={`${t('personality.label')}: ${personality.description}`}>
              {personality.icon} {personality.name}
            </span>
          </div>
        </div>
        <span className={`mood mood-${mood.id}`} title={t('card.mood')}>
          {mood.emoji} {mood.label}
        </span>
      </div>
      <div className="level-row">
        <span className="level-badge">{t('card.level', { level: pet.level })}</span>
        <div className="bar bar-xp" role="progressbar" aria-label={t('card.xpLabel')} aria-valuenow={Math.round(progress * 100)}>
          <div className="bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="xp-text">
          {t('card.xp', { xp: Math.floor(pet.xp), next: xpToNextLevel(pet.level) })}
        </span>
      </div>
      {illness && (
        <button className="illness-chip" onClick={onOpenVet}>
          {illness.icon} {illness.name} · <u>{t('card.seeVet')}</u>
        </button>
      )}
      <div className="next-stage">
        {next ? (
          <>
            <span className="next-label">{t('card.next', { stage: next.stage.label })}</span>
            {next.requirements.map((r) => (
              <span key={r.label} className={`req ${r.done ? 'done' : ''}`} title={reqLabel(r.label)}>
                {r.done ? '✓' : '○'} {reqLabel(r.label)} {Math.floor(Math.min(r.current, r.target))}/{r.target}
              </span>
            ))}
          </>
        ) : (
          <span className="next-label">{t('card.fullyGrown')}</span>
        )}
      </div>
    </section>
  );
}

export function SaveIndicator() {
  const save = useGameStore((s) => s.save);
  useNow(5000);
  let text = t('save.none');
  let cls = 'idle';
  if (save.state === 'saving') {
    text = t('save.saving');
    cls = 'saving';
  } else if (save.state === 'saved' && save.at) {
    const ago = Math.round((Date.now() - save.at) / 1000);
    text = ago < 5 ? t('save.saved') : t('save.savedAt', { time: formatClock(save.at) });
    cls = 'saved';
  } else if (save.state === 'error') {
    text = t('save.failed');
    cls = 'error';
  }
  return (
    <span className={`chip save-${cls}`} title={save.error ?? text} role="status">
      <span className="dot" aria-hidden />
      {text}
    </span>
  );
}

export function TopBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const coins = useGameStore((s) => s.game.coins);
  const timeScale = useGameStore((s) => s.game.settings.timeScale);
  const preset = TIME_SCALE_PRESETS.find((p) => p.value === timeScale);
  const dailyAvailable = useGameStore((s) => dailyStatus(s.household, Date.now()).available);
  const openDaily = useGameStore((s) => s.openDaily);
  const muted = useGameStore((s) => s.household.settings.audio.muted);
  const setAudio = useGameStore((s) => s.setAudio);
  return (
    <div className="topbar-right">
      {dailyAvailable && (
        <button className="chip chip-gift" onClick={openDaily} title={t('top.dailyTitle')}>
          {t('top.daily')}
        </button>
      )}
      <span className="chip" title={t('top.coins')}>
        🪙 {coins}
      </span>
      <span className={`chip ${timeScale > 6 ? 'chip-dev' : ''}`} title={preset?.label ?? `×${timeScale}`}>
        ⏱ ×{timeScale}
      </span>
      <SaveIndicator />
      <button
        className="icon-btn"
        onClick={() => setAudio({ muted: !muted })}
        aria-label={muted ? t('top.unmute') : t('top.mute')}
        title={muted ? t('top.unmute') : t('top.mute')}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <button className="icon-btn" onClick={onOpenSettings} aria-label={t('top.settings')} title={t('top.settings')}>
        ⚙️
      </button>
    </div>
  );
}
