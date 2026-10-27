import { t } from '../i18n';
import type { SpeciesDefinition } from './types';
import { assetUrl } from '../config/assets';
import { CAT_RIG } from './rigs';

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
  rig: CAT_RIG,
  // Grey mackerel tabby with a pale belly.
  coat: {
    stripeColor: '#5e5e66',
    stripeStrength: 0.85,
    stripeFrequency: 9,
    backShade: 0.35,
    bellyColor: '#cfc9c0',
    bellyStrength: 0.75,
    sockStrength: 0.35,
  },
  stages: {
    baby: { height: 0.42, eyeScale: 1.3, proportions: [1.06, 0.94, 0.9], furLength: 1.4, furDensity: 0.85 },
    young: { height: 0.6, eyeScale: 1.12, proportions: [1.02, 0.98, 0.96], furLength: 1.15, furDensity: 0.92 },
    adult: { height: 0.78, eyeScale: 1, proportions: [1, 1, 1], furLength: 1, furDensity: 1 },
  },
  fur: {
    lengthRatio: 0.026,
    densityPerHeight: 420,
    gravity: 0.3,
    rootShade: 0.62,
    strandVariation: 0.12,
    comb: 1.2,
    clump: 0.6,
    rim: 0.35,
    sheen: 0.22,
    // Fluffy tail and chest ruff, short fur on the face and legs.
    profile: { body: 1, legs: 0.55, head: 0.6, tail: 1.5, chest: 1.3, belly: 1.15 },
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
