import type { SpeciesId } from '../game/types';
import { CAT } from './cat';
import { DOG } from './dog';
import type { SpeciesDefinition } from './types';

/** Register new species here. */
export const SPECIES: Record<SpeciesId, SpeciesDefinition> = {
  cat: CAT,
  dog: DOG,
};

export const SPECIES_LIST: SpeciesDefinition[] = Object.values(SPECIES);

export function getSpecies(id: SpeciesId): SpeciesDefinition {
  return SPECIES[id];
}

export function isSpeciesId(value: unknown): value is SpeciesId {
  return typeof value === 'string' && value in SPECIES;
}
