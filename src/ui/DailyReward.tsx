import { DAILY_REWARDS } from '../config/minigames';
import { useGameStore } from '../store/gameStore';
import { t } from '../i18n';

/** Daily login reward with a 7-day streak strip. */
export function DailyReward() {
  const open = useGameStore((s) => s.dailyOpen);
  const welcomeOpen = useGameStore((s) => !!s.welcomeBack);
  // Re-render after claiming (coins change).
  useGameStore((s) => s.household.daily);
  const store = useGameStore.getState();
  if (!open || welcomeOpen) return null;
  const status = store.getDailyStatus();

  return (
    <div className="modal-backdrop" onClick={() => store.closeDaily()}>
      <div className="modal welcome" role="dialog" aria-label={t('daily.title')} onClick={(e) => e.stopPropagation()}>
        <div className="growth-icon" aria-hidden>
          🎁
        </div>
        <h2>{status.available ? t('daily.title') : t('daily.tomorrow')}</h2>
        <p className="muted small">{t('daily.help')}</p>
        <ol className="daily-strip">
          {DAILY_REWARDS.coins.map((coins, i) => {
            const day = i + 1;
            const done = status.available ? day < status.day : day <= status.day;
            const today = status.available && day === status.day;
            return (
              <li key={day} className={`${done ? 'done' : ''} ${today ? 'today' : ''}`}>
                <span className="daily-day">{t('daily.day', { n: day })}</span>
                <span>🪙 {coins}</span>
                {day === DAILY_REWARDS.coins.length && <span>+ 🍱</span>}
              </li>
            );
          })}
        </ol>
        {status.available ? (
          <button
            className="btn btn-primary"
            onClick={() => {
              store.claimDailyReward();
              store.closeDaily();
            }}
            autoFocus
          >
            {t('daily.claim', { coins: status.coins })}
            {status.food ? t('daily.claimFood') : ''}
          </button>
        ) : (
          <button className="btn" onClick={() => store.closeDaily()} autoFocus>
            {t('common.ok')}
          </button>
        )}
      </div>
    </div>
  );
}
