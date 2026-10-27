import { useState } from 'react';
import { decorOfKind, ROOM, type DecorItem, type DecorKind } from '../config/decor';
import { ownsDecor, roomComfort, slotOf } from '../game/decor';
import { list, t, type MessageKey } from '../i18n';
import { getSpecies } from '../species/registry';
import { useGameStore } from '../store/gameStore';

type ThemeKind = Exclude<DecorKind, 'furniture'>;

/** Shop and editor for the room: furniture plus wall, floor and rug themes. */
export function DecorPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<DecorKind>('furniture');
  const room = useGameStore((s) => s.household.room);
  const coins = useGameStore((s) => s.household.coins);
  const store = useGameStore.getState();
  const comfort = Math.round(roomComfort(room) * 100);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal decor" role="dialog" aria-label={t('decor.title')} onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{t('decor.title')}</h2>
          <span className="chip">🪙 {coins}</span>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </header>
        <p className="decor-comfort">
          🛋️ {t('decor.comfort', { n: comfort, max: Math.round(ROOM.maxComfort * 100) })}
        </p>
        <div className="segmented decor-tabs" role="tablist">
          {(['furniture', 'wall', 'floor', 'rug'] as const).map((k) => (
            <button key={k} role="tab" className={tab === k ? 'selected' : ''} aria-selected={tab === k} onClick={() => setTab(k)}>
              {t(`decor.tab.${k}` as MessageKey)}
            </button>
          ))}
        </div>

        {tab === 'furniture' ? (
          <>
            <p className="muted decor-hint">{t('decor.hint')}</p>
            <div className="decor-list">
              {decorOfKind('furniture').map((item) => (
                <FurnitureRow key={item.id} item={item} />
              ))}
            </div>
          </>
        ) : (
          <div className="decor-swatches">
            {decorOfKind(tab).map((item) => {
              const owned = ownsDecor(room, item.id);
              const active = room[tab as ThemeKind] === item.id;
              return (
                <button
                  key={item.id}
                  className={`swatch ${active ? 'active' : ''}`}
                  disabled={!owned && coins < item.price}
                  onClick={() => (owned ? store.setTheme(tab as ThemeKind, item.id) : store.buyDecor(item.id))}
                >
                  <span
                    className="swatch-color"
                    style={{ background: `linear-gradient(135deg, ${item.colors!.main} 60%, ${item.colors!.accent ?? item.colors!.main} 60%)` }}
                  />
                  <span className="swatch-name">{item.name}</span>
                  <small>{active ? t('decor.inUse') : owned ? t('decor.use') : t('decor.buy', { price: item.price })}</small>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FurnitureRow({ item }: { item: DecorItem }) {
  const room = useGameStore((s) => s.household.room);
  const coins = useGameStore((s) => s.household.coins);
  const store = useGameStore.getState();
  const owned = ownsDecor(room, item.id);
  const slot = slotOf(room, item.id);
  const lovedBy = item.interaction?.species.map((id) => `${getSpecies(id).icon} ${getSpecies(id).name}`) ?? [];
  return (
    <div className="decor-row">
      <span className="tray-icon">{item.icon}</span>
      <span className="tray-text">
        <strong>{item.name}</strong>
        <small>
          {t('decor.comfortItem', { n: Math.round((item.comfort ?? 0) * 100) })}
          {lovedBy.length > 0 && ` · ${t('decor.lovedBy', { list: list(lovedBy) })}`}
          {owned && ` · ${slot ? t('decor.inRoom') : t('decor.inStorage')}`}
        </small>
      </span>
      {!owned ? (
        <button className="btn btn-small btn-primary" disabled={coins < item.price} onClick={() => store.buyDecor(item.id)}>
          {t('decor.buy', { price: item.price })}
        </button>
      ) : (
        <span className="decor-actions">
          <button className="btn btn-small" onClick={() => store.startPlacing(item.id)}>
            {slot ? t('decor.move') : t('decor.place')}
          </button>
          {slot && (
            <button className="btn btn-small" onClick={() => store.removeDecor(slot)}>
              {t('decor.store')}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

/** Banner shown while choosing a spot in the 3D room. */
export function PlacingBanner() {
  const placing = useGameStore((s) => s.decorPlacing);
  const cancel = useGameStore((s) => s.cancelPlacing);
  if (!placing) return null;
  const item = decorOfKind('furniture').find((d) => d.id === placing);
  return (
    <div className="placing-banner" role="status">
      <span>
        {item?.icon} {t('decor.placing', { item: item?.name ?? '' })}
      </span>
      <button className="btn btn-small" onClick={cancel}>
        {t('decor.cancel')}
      </button>
    </div>
  );
}
