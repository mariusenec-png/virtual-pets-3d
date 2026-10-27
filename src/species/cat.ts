import { t } from '../i18n';
import type { SpeciesDefinition } from './types';
import { assetUrl } from '../config/assets';

export const CAT: SpeciesDefinition = {
  id: 'cat',
  get name() {
    return t('species.cat');
  },
  icon: '🐱',
  available: true,
  model: {
    url: assetUrl('models/cat.glb'),
    // The supplied model already faces +Z.
    rotationY: 0,
    eyePartPattern: '^(eye|vertical_pupil)',
    hasSkeletalAnimations: false,
    get note() {
      return t('species.cat.note');
    },
  },
  stages: {
    baby: { height: 0.42, eyeScale: 1.3, proportions: [1.06, 0.94, 0.9], furLength: 1.4, furDensity: 0.85 },
    young: { height: 0.6, eyeScale: 1.12, proportions: [1.02, 0.98, 0.96], furLength: 1.15, furDensity: 0.92 },
    adult: { height: 0.78, eyeScale: 1, proportions: [1, 1, 1], furLength: 1, furDensity: 1 },
  },
  fur: {
    lengthRatio: 0.02,
    densityPerHeight: 200,
    gravity: 0.35,
    rootShade: 0.78,
    strandVariation: 0.18,
  },
  placeholder: {
    body: '#8a8f96',
    belly: '#e9e4da',
    ears: '#5f6369',
    nose: '#c98b8b',
    earShape: 'pointy',
    tailLength: 0.5,
  },
  decayMultipliers: {
    // Cats groom themselves.
    hygiene: 0.6,
    energy: 0.9,
  },
  bathHappiness: -6,
  reactions: {
    happy: 'purrs happily',
    eat: 'nibbles the food',
    play: 'pounces on the toy',
    petted: 'purrs and leans in',
    bath: 'tolerates the bath... barely',
    sleep: 'curls up and dozes off',
    refuse: 'flicks its tail and looks away',
  },
};
