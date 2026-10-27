import { useEffect, useRef, useState } from 'react';
import { FOODS, toysForSpecies } from '../config/items';
import { getPersonality } from '../config/personality';
import { TRAINING, TRICKS, trickLevel } from '../config/tricks';
import { trickSuccessChance } from '../game/tricks';
import type { MessageKey } from '../i18n';
import { useGameStore } from '../store/gameStore';
import { useIsBusy } from './hooks';
import { t } from '../i18n';

type Tray = 'food' | 'toys' | 'tricks' | null;

export function ActionBar({ onOpenVet }: { onOpenVet: () => void }) {
  const pet = useGameStore((s) => s.game.pet);
  const inventory = useGameStore((s) => s.game.inventory);
  const coins = useGameStore((s) => s.game.coins);
  const unlocked = useGameStore((s) => s.game.unlockedToys);
  const sick = useGameStore((s) => !!s.game.pet?.illness);
  const store = useGameStore.getState();
  const busy = useIsBusy();
  const [tray, setTray] = useState<Tray>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close trays when clicking elsewhere.
  useEffect(() => {
    if (!tray) return;
    const onDown = (e: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setTray(null);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [tray]);

  if (!pet) return null;
  const asleep = pet.isSleeping;
  const awakeOnly = busy || asleep;
  const toys = toysForSpecies(pet.species);

  return (
    <div className="actionbar-wrap" ref={barRef}>
      {tray === 'food' && (
        <div className="tray" role="menu" aria-label={t('tray.food')}>
          <div className="tray-title">
            {t('tray.food')} <span className="muted">· 🪙 {coins}</span>
          </div>
          {FOODS.map((f) => {
            const count = inventory.food[f.id] ?? 0;
            return (
              <div key={f.id} className="tray-item">
                <button
                  className="tray-main"
                  disabled={awakeOnly || count <= 0}
                  onClick={() => {
                    store.feed(f.id);
                    setTray(null);
                  }}
                >
                  <span className="tray-icon">{f.icon}</span>
                  <span className="tray-text">
                    <strong>{f.name}</strong>
                    <small>
                      {t('tray.foodEffect', { n: f.effects.satiety ?? 0 })}
                      {f.favoriteOf?.includes(pet.species) ? t('tray.favorite') : ''}
                    </small>
                  </span>
                  <span className={`tray-count ${count === 0 ? 'empty' : ''}`}>×{count}</span>
                </button>
                <button
                  className="btn btn-small"
                  disabled={coins < f.packPrice}
                  onClick={() => store.buyFood(f.id)}
                  title={t('tray.buyTitle', { n: f.packSize, price: f.packPrice })}
                >
                  +{f.packSize} · 🪙{f.packPrice}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {tray === 'toys' && (
        <div className="tray" role="menu" aria-label={t('tray.toys')}>
          <div className="tray-title">{t('tray.toys')}</div>
          <div className="tray-item">
            <button
              className="tray-main tray-game"
              disabled={awakeOnly}
              onClick={() => {
                setTray(null);
                store.openMinigame();
              }}
            >
              <span className="tray-icon">🎮</span>
              <span className="tray-text">
                <strong>{t('tray.gameName')}</strong>
                <small>{t('tray.gameDesc')}</small>
              </span>
            </button>
          </div>
          {toys.map((toy) => {
            const isUnlocked = unlocked.includes(toy.id);
            return (
              <div key={toy.id} className="tray-item">
                <button
                  className="tray-main"
                  disabled={awakeOnly || !isUnlocked}
                  onClick={() => {
                    store.play(toy.id);
                    setTray(null);
                  }}
                >
                  <span className="tray-icon">{isUnlocked ? toy.icon : '🔒'}</span>
                  <span className="tray-text">
                    <strong>{toy.name}</strong>
                    <small>
                      {isUnlocked
                        ? t('tray.toyEffect', { happy: toy.effects.happiness ?? 0, energy: toy.effects.energy ?? 0 })
                        : t('tray.unlocksAt', { level: toy.unlockLevel })}
                    </small>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tray === 'tricks' && (
        <div className="tray" role="menu" aria-label={t('tricks.title')}>
          <div className="tray-title">
            {t('tricks.title')}{' '}
            <span className="muted">
              ·{' '}
              {t('tricks.learnSpeed', {
                personality: `${getPersonality(pet.personality).icon} ${getPersonality(pet.personality).name}`,
                n: getPersonality(pet.personality).learning,
              })}
            </span>
          </div>
          <div className="tray-hint">{t('tricks.hint', { energy: TRAINING.energyCost })}</div>
          {TRICKS.map((trick) => {
            const locked = pet.level < trick.unlockLevel;
            const mastery = pet.tricks[trick.id] ?? 0;
            const level = trickLevel(mastery);
            const chance = Math.round(trickSuccessChance(pet, trick.id) * 100);
            return (
              <div key={trick.id} className="tray-item">
                <button
                  className="tray-main"
                  disabled={awakeOnly || locked}
                  onClick={() => {
                    store.practiceTrick(trick.id);
                    setTray(null);
                  }}
                >
                  <span className="tray-icon">{locked ? '🔒' : trick.icon}</span>
                  <span className="tray-text">
                    <strong>{trick.name}</strong>
                    {locked ? (
                      <small>{t('tricks.locked', { level: trick.unlockLevel })}</small>
                    ) : (
                      <>
                        <small>
                          {t(`tricks.level.${level}` as MessageKey)}
                          {level !== 'mastered' ? ` · ${t('tricks.chance', { n: chance })}` : ''}
                        </small>
                        <span className="mastery" aria-hidden>
                          <span className={`mastery-fill ${level}`} style={{ width: `${mastery}%` }} />
                        </span>
                      </>
                    )}
                  </span>
                  {!locked && (
                    <span className="tray-cta">{level === 'mastered' ? t('tricks.show') : t('tricks.practice')}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <nav className="actionbar" aria-label={t('actions.label')}>
        <ActionButton icon="🍖" label={t('action.feed')} active={tray === 'food'} disabled={awakeOnly} onClick={() => setTray(tray === 'food' ? null : 'food')} />
        <ActionButton icon="💧" label={t('action.water')} disabled={awakeOnly} onClick={() => store.water()} />
        <ActionButton icon="🎾" label={t('action.play')} active={tray === 'toys'} disabled={awakeOnly} onClick={() => setTray(tray === 'toys' ? null : 'toys')} />
        <ActionButton icon="🤚" label={t('action.pet')} disabled={false} onClick={() => store.pet()} />
        <ActionButton icon="🎓" label={t('action.tricks')} active={tray === 'tricks'} disabled={awakeOnly} onClick={() => setTray(tray === 'tricks' ? null : 'tricks')} />
        <ActionButton icon="🛁" label={t('action.bath')} disabled={awakeOnly} onClick={() => store.bathe()} />
        {asleep ? (
          <ActionButton icon="☀️" label={t('action.wake')} disabled={busy} onClick={() => store.wake()} />
        ) : (
          <ActionButton icon="🌙" label={t('action.sleep')} disabled={busy} onClick={() => store.sleep()} />
        )}
        <ActionButton icon="🏥" label={t('action.vet')} alert={sick} disabled={false} onClick={onOpenVet} />
      </nav>
    </div>
  );
}

function ActionButton(props: {
  icon: string;
  label: string;
  disabled: boolean;
  active?: boolean;
  alert?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`action ${props.active ? 'active' : ''} ${props.alert ? 'alert' : ''}`}
      disabled={props.disabled}
      onClick={props.onClick}
      aria-label={props.label}
    >
      <span className="action-icon" aria-hidden>
        {props.icon}
      </span>
      <span className="action-label">{props.label}</span>
    </button>
  );
}
