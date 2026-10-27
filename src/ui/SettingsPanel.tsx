import { useState } from 'react';
import { FUR_QUALITY_OPTIONS } from '../config/graphics';
import { ILLNESSES } from '../config/illnesses';
import { NEED_ORDER, NEEDS } from '../config/needs';
import { TIME_SCALE_PRESETS } from '../config/simulation';
import { getGrowthStageDefinition } from '../game/progression';
import type { AudioSettings } from '../game/types';
import { getSpecies } from '../species/registry';
import { useGameStore } from '../store/gameStore';
import { InstallSection } from './InstallSection';
import { t } from '../i18n';

function volumePatch(key: 'master' | 'music' | 'sfx', value: number): Partial<AudioSettings> {
  const patch: Partial<AudioSettings> = {};
  patch[key] = value;
  return patch;
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useGameStore((s) => s.game.settings);
  const pet = useGameStore((s) => s.game.pet);
  const usingPlaceholder = useGameStore((s) => s.usingPlaceholder);
  const store = useGameStore.getState();
  const pets = useGameStore((s) => s.household.pets);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmRehome, setConfirmRehome] = useState<string | null>(null);
  const presets = TIME_SCALE_PRESETS.filter((p) => !p.devOnly || settings.devMode);
  const species = pet ? getSpecies(pet.species) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" role="dialog" aria-label={t('settings.title')} onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{t('settings.title')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </header>

        <section>
          <h3>{t('settings.language')}</h3>
          <div className="segmented">
            {(
              [
                ['auto', t('settings.languageAuto')],
                ['ro', 'Română'],
                ['en', 'English'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={settings.language === id ? 'selected' : ''}
                onClick={() => store.setLanguagePreference(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <InstallSection />

        <section>
          <h3>{t('settings.speed')}</h3>
          <p className="muted small">{t('settings.speedHelp')}</p>
          <div className="segmented">
            {presets.map((p) => (
              <button
                key={p.id}
                className={settings.timeScale === p.value ? 'selected' : ''}
                onClick={() => store.setTimeScale(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>{t('settings.sound')}</h3>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!settings.audio.muted}
              onChange={(e) => store.setAudio({ muted: !e.target.checked })}
            />
            <span>{t('settings.soundOn')}</span>
          </label>
          <div className="dev-needs">
            {(
              [
                ['master', t('settings.master')],
                ['music', t('settings.music')],
                ['sfx', t('settings.effects')],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="dev-need">
                <span>{label}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(settings.audio[key] * 100)}
                  disabled={settings.audio.muted}
                  onChange={(e) => store.setAudio(volumePatch(key, Number(e.target.value) / 100))}
                />
                <span className="dev-need-val">{Math.round(settings.audio[key] * 100)}</span>
              </label>
            ))}
          </div>
          <p className="muted small">{t('settings.soundNote')}</p>
        </section>

        <section>
          <h3>{t('settings.fur')}</h3>
          <p className="muted small">{t('settings.furHelp')}</p>
          <div className="segmented">
            {FUR_QUALITY_OPTIONS.map((o) => (
              <button
                key={o.id}
                className={settings.furQuality === o.id ? 'selected' : ''}
                onClick={() => store.setFurQuality(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="toggle">
            <input type="checkbox" checked={settings.devMode} onChange={(e) => store.setDevMode(e.target.checked)} />
            <span>{t('settings.devMode')}</span>
          </label>
          <p className="muted small">{t('settings.devHelp')}</p>
        </section>

        {settings.devMode && pet && (
          <section className="devtools">
            <h3>{t('settings.devTools')}</h3>
            <div className="btn-row">
              {[1, 6, 24].map((h) => (
                <button key={h} className="btn btn-small" onClick={() => store.devSkipHours(h)}>
                  {t('settings.skip', { n: h })}
                </button>
              ))}
              <button className="btn btn-small" onClick={() => store.devAddXp(50)}>
                +50 XP
              </button>
            </div>
            <div className="btn-row dev-ill">
              <span className="small">{t('settings.makeSick')}</span>
              {ILLNESSES.map((i) => (
                <button key={i.id} className="btn btn-small" onClick={() => store.devMakeSick(i.id)} disabled={!!pet.illness}>
                  {i.icon} {i.name}
                </button>
              ))}
            </div>
            <div className="dev-needs">
              {NEED_ORDER.map((id) => (
                <label key={id} className="dev-need">
                  <span>
                    {NEEDS[id].icon} {NEEDS[id].label}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(pet.needs[id])}
                    onChange={(e) => store.devSetNeed(id, Number(e.target.value))}
                  />
                  <span className="dev-need-val">{Math.round(pet.needs[id])}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3>{t('settings.pets')}</h3>
          <ul className="pet-list">
            {pets.map((p) => (
              <li key={p.id}>
                <span>
                  {getSpecies(p.species).icon} <strong>{p.name}</strong>{' '}
                  <span className="muted small">
                    {t('settings.petLine', { level: p.level, stage: getGrowthStageDefinition(p).label })}
                  </span>
                </span>
                {confirmRehome === p.id ? (
                  <span className="btn-row">
                    <span className="small">{t('settings.rehomeConfirm', { name: p.name })}</span>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => {
                        store.rehomePet(p.id);
                        setConfirmRehome(null);
                        if (pets.length <= 1) onClose();
                      }}
                    >
                      {t('common.yes')}
                    </button>
                    <button className="btn btn-small" onClick={() => setConfirmRehome(null)}>
                      {t('common.no')}
                    </button>
                  </span>
                ) : (
                  <button className="btn btn-small btn-danger-outline" onClick={() => setConfirmRehome(p.id)}>
                    {t('settings.rehome')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>{t('settings.save')}</h3>
          <div className="btn-row">
            <button className="btn btn-small" onClick={() => store.saveNow()}>
              {t('settings.saveNow')}
            </button>
            {!confirmReset ? (
              <button className="btn btn-small btn-danger-outline" onClick={() => setConfirmReset(true)}>
                {t('settings.startOver')}
              </button>
            ) : (
              <>
                <span className="small">{t('settings.startOverWarn')}</span>
                <button
                  className="btn btn-small btn-danger"
                  onClick={() => {
                    store.resetAll();
                    onClose();
                  }}
                >
                  {t('settings.startOverConfirm')}
                </button>
                <button className="btn btn-small" onClick={() => setConfirmReset(false)}>
                  {t('common.cancel')}
                </button>
              </>
            )}
          </div>
          <p className="muted small">{t('settings.saveNote')}</p>
        </section>

        {species && (
          <section>
            <h3>{t('settings.model')}</h3>
            <p className="small">
              {usingPlaceholder
                ? t('settings.modelPlaceholder', { species: species.name.toLowerCase() })
                : species.model.note}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
