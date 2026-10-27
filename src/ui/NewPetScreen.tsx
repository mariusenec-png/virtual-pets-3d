import { useState, type FormEvent } from 'react';
import { MAX_NAME_LENGTH, sanitizePetName } from '../game/createGame';
import type { SpeciesId } from '../game/types';
import { SPECIES_LIST } from '../species/registry';
import { useGameStore } from '../store/gameStore';
import { t } from '../i18n';

/**
 * Adoption form. Full screen for the first pet; shown as a dialog with a
 * Cancel button when adopting another pet (`onDone` given).
 */
export function NewPetScreen({ onDone }: { onDone?: () => void }) {
  const createPet = useGameStore((s) => s.createPet);
  const petCount = useGameStore((s) => s.household.pets.length);
  const firstAvailable = SPECIES_LIST.find((s) => s.available)?.id ?? 'cat';
  const [species, setSpecies] = useState<SpeciesId>(firstAvailable);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const clean = sanitizePetName(name);
  const asDialog = !!onDone;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!clean) return;
    const err = createPet(clean, species);
    setError(err);
    if (!err) onDone?.();
  };

  const card = (
    <form className="newpet-card" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
      <div className="newpet-paw" aria-hidden>
        🐾
      </div>
      <h1>{petCount > 0 ? t('adopt.titleAnother') : t('adopt.title')}</h1>
      <p className="muted">
        {petCount > 0 ? t('adopt.introAnother') : t('adopt.intro')}
      </p>

      <fieldset className="species-grid">
        <legend className="sr-only">{t('adopt.species')}</legend>
        {SPECIES_LIST.map((s) => (
          <label
            key={s.id}
            className={`species-option ${species === s.id ? 'selected' : ''} ${s.available ? '' : 'disabled'}`}
          >
            <input
              type="radio"
              name="species"
              value={s.id}
              checked={species === s.id}
              disabled={!s.available}
              onChange={() => setSpecies(s.id)}
            />
            <span className="species-icon" aria-hidden>
              {s.icon}
            </span>
            <span className="species-name">{s.name}</span>
            {!s.available && <span className="species-note">{s.unavailableReason}</span>}
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span>{t('adopt.name')}</span>
        <input
          autoFocus
          value={name}
          maxLength={MAX_NAME_LENGTH * 2}
          placeholder={species === 'dog' ? t('adopt.placeholderDog') : t('adopt.placeholderCat')}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button className="btn btn-primary btn-lg" type="submit" disabled={!clean}>
        {clean ? t('adopt.submitNamed', { name: clean }) : t('adopt.submitEmpty')}
      </button>
      {asDialog && (
        <button className="btn" type="button" onClick={onDone}>
          {t('common.cancel')}
        </button>
      )}
    </form>
  );

  if (asDialog) {
    return (
      <div className="modal-backdrop" onClick={onDone}>
        {card}
      </div>
    );
  }
  return <div className="newpet">{card}</div>;
}
