import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { playSound } from '../audio/engine';
import { CATCH_GAME, CATCH_REWARDS } from '../config/minigames';
import { multiplier, timeLeft } from '../game/catchGame';
import { catchRuntime } from '../scene/minigame/runtime';
import { useGameStore } from '../store/gameStore';
import { t } from '../i18n';

const COUNTDOWN_MS = 3000;

/** Screens and controls for "Catch the Treats". */
export function MinigameOverlay() {
  const mg = useGameStore((s) => s.minigame);
  const name = useGameStore((s) => s.game.pet?.name ?? t('common.yourPet'));
  const best = useGameStore((s) => s.game.pet?.stats.bestCatch ?? 0);
  const store = useGameStore.getState();
  if (!mg) return null;

  if (mg.phase === 'intro') {
    return (
      <div className="modal-backdrop">
        <div className="modal welcome minigame-card" role="dialog" aria-label={t('mg.title')}>
          <div className="growth-icon" aria-hidden>
            🎮
          </div>
          <h2>{t('mg.title')}</h2>
          <p>{t('mg.intro', { name, golden: CATCH_GAME.points.golden })}</p>
          <ul className="rules">
            <li>{t('mg.ruleMove')}</li>
            <li>{t('mg.ruleCombo', { n: CATCH_GAME.comboStep })}</li>
            <li>{t('mg.ruleRewards', { energy: Math.abs(CATCH_REWARDS.needs.energy ?? 0) })}</li>
          </ul>
          {best > 0 && <p className="muted small">{t('mg.best', { n: best })}</p>}
          <div className="btn-row center">
            <button className="btn btn-primary" onClick={() => store.startMinigame()} autoFocus>
              {t('mg.start', { n: CATCH_GAME.durationSeconds })}
            </button>
            <button className="btn" onClick={() => store.closeMinigame()}>
              {t('mg.notNow')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mg.phase === 'result' && mg.result) {
    const r = mg.result;
    return (
      <div className="modal-backdrop">
        <div className="modal welcome minigame-card" role="dialog" aria-label={t('mg.over')}>
          <h2>{r.newBest ? t('mg.newBest') : t('mg.over')}</h2>
          <p className="big-score">{r.score}</p>
          <p className="muted small">
            {t('mg.stats', { caught: r.caught, combo: r.bestCombo })}
            {!r.newBest && r.previousBest > 0 ? t('mg.statsBest', { n: r.previousBest }) : ''}
          </p>
          <div className="reward-row">
            <span>🪙 +{r.rewards.coins}</span>
            <span>✨ +{r.rewards.xp} XP</span>
            <span>💛 +{r.rewards.happiness + (CATCH_REWARDS.needs.happiness ?? 0)}</span>
          </div>
          <div className="btn-row center">
            <button className="btn btn-primary" onClick={() => store.startMinigame()} autoFocus>
              {t('mg.again')}
            </button>
            <button className="btn" onClick={() => store.closeMinigame()}>
              {t('mg.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <CatchControls countdown={mg.phase === 'countdown'} startedAt={mg.phaseStartedAt} />;
}

/** In-game HUD plus keyboard and pointer/touch input. */
function CatchControls({ countdown, startedAt }: { countdown: boolean; startedAt: number }) {
  const [, setFrame] = useState(0);
  const layer = useRef<HTMLDivElement>(null);
  const beginPlaying = useGameStore((s) => s.beginPlaying);
  const closeMinigame = useGameStore((s) => s.closeMinigame);

  // Re-render the HUD ~10 times per second (score, timer).
  useEffect(() => {
    const id = window.setInterval(() => setFrame((f) => f + 1), 100);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!countdown) return;
    const id = window.setTimeout(beginPlaying, Math.max(0, startedAt + COUNTDOWN_MS - Date.now()));
    return () => window.clearTimeout(id);
  }, [countdown, startedAt, beginPlaying]);

  // Keyboard input.
  useEffect(() => {
    const keys = new Set<string>();
    const update = () => {
      const left = keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
      const right = keys.has('ArrowRight') || keys.has('d') || keys.has('D');
      catchRuntime.input.axis = (right ? 1 : 0) - (left ? 1 : 0);
      if (left || right) catchRuntime.input.targetX = null;
    };
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMinigame();
        return;
      }
      keys.add(e.key);
      update();
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key);
      update();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      catchRuntime.input.axis = 0;
    };
  }, [closeMinigame]);

  // Pointer / touch: the pet follows the horizontal position.
  const onPointer = (e: ReactPointerEvent) => {
    const rect = layer.current?.getBoundingClientRect();
    if (!rect) return;
    if (e.pointerType === 'mouse' && e.type === 'pointermove' && e.buttons === 0 && catchRuntime.input.axis !== 0) return;
    const fx = (e.clientX - rect.left) / rect.width;
    catchRuntime.input.targetX = (fx - 0.5) * 2 * catchRuntime.viewHalfWidth;
  };

  const game = catchRuntime.game;
  const left = game ? timeLeft(game) : CATCH_GAME.durationSeconds;
  const count = Math.ceil((startedAt + COUNTDOWN_MS - Date.now()) / 1000);
  const lastBeep = useRef(0);
  useEffect(() => {
    if (countdown && count > 0 && count !== lastBeep.current) {
      lastBeep.current = count;
      playSound('countdown');
    }
  }, [countdown, count]);

  return (
    <div
      ref={layer}
      className="catch-layer"
      onPointerMove={onPointer}
      onPointerDown={onPointer}
      style={{ touchAction: 'none' }}
    >
      <div className="catch-hud">
        <span className="catch-score">⭐ {game?.score ?? 0}</span>
        <div className="catch-time" aria-label={t('mg.timeLeft')}>
          <div className="catch-time-fill" style={{ width: `${(left / CATCH_GAME.durationSeconds) * 100}%` }} />
        </div>
        <span className="catch-combo">×{multiplier(game?.combo ?? 0)}</span>
        <button className="icon-btn" onClick={closeMinigame} aria-label={t('mg.quit')} title={t('mg.quit')}>
          ✕
        </button>
      </div>
      {countdown && count > 0 && <div className="countdown">{count}</div>}
      {!countdown && game && game.time < 2.5 && <div className="catch-hint">{t('mg.hint')}</div>}
    </div>
  );
}
