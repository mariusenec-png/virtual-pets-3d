import { NEEDS } from '../config/needs';
import { MAX_PETS } from '../game/household';
import type { NeedId, PetState } from '../game/types';
import { getSpecies } from '../species/registry';
import { useGameStore } from '../store/gameStore';
import { list, t } from '../i18n';

type Status = 'ok' | 'warn' | 'bad' | 'sleep';

function petStatus(pet: PetState): { status: Status; hint: string } {
  if (pet.illness) return { status: 'bad', hint: t('status.sick') };
  const ids = Object.keys(NEEDS) as NeedId[];
  const critical = ids.filter((id) => pet.needs[id] < NEEDS[id].criticalBelow);
  if (critical.length) return { status: 'bad', hint: t('status.needs', { list: list(critical.map((id) => NEEDS[id].label.toLowerCase())) }) };
  const low = ids.filter((id) => pet.needs[id] < NEEDS[id].warnBelow);
  if (low.length) return { status: 'warn', hint: t('status.low', { list: list(low.map((id) => NEEDS[id].label.toLowerCase())) }) };
  if (pet.isSleeping) return { status: 'sleep', hint: t('status.sleeping') };
  return { status: 'ok', hint: t('status.ok') };
}

/** Row of pet chips to switch the active pet, plus an "adopt" button. */
export function PetSwitcher({ onAdopt }: { onAdopt: () => void }) {
  const pets = useGameStore((s) => s.household.pets);
  const activeId = useGameStore((s) => s.household.activePetId);
  const switchPet = useGameStore((s) => s.switchPet);
  const full = pets.length >= MAX_PETS;

  return (
    <nav className="switcher" aria-label={t('switch.label')}>
      {pets.map((pet) => {
        const { status, hint } = petStatus(pet);
        const active = pet.id === activeId;
        return (
          <button
            key={pet.id}
            className={`switch-chip ${active ? 'active' : ''}`}
            onClick={() => switchPet(pet.id)}
            aria-pressed={active}
            title={`${pet.name}: ${hint}`}
          >
            <span className="switch-icon" aria-hidden>
              {getSpecies(pet.species).icon}
            </span>
            <span className="switch-name">{pet.name}</span>
            <span className={`switch-dot dot-${status}`} aria-label={hint} />
          </button>
        );
      })}
      <button
        className="switch-chip switch-add"
        onClick={onAdopt}
        disabled={full}
        title={full ? t('switch.full', { max: MAX_PETS }) : t('switch.adopt')}
        aria-label={t('switch.adopt')}
      >
        ＋
      </button>
    </nav>
  );
}
