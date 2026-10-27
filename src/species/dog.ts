import { t } from '../i18n';
import type { SpeciesDefinition } from './types';
import { assetUrl } from '../config/assets';
import { DOG_RIG } from './rigs';

export const DOG: SpeciesDefinition = {
  id: 'dog',
  get name() {
    return t('species.dog');
  },
  icon: '🐶',
  available: true,
  model: {
    url: assetUrl('models/dog.glb'),
    // The supplied model faces +X; rotate so it faces the camera (+Z).
    rotationY: -Math.PI / 2,
    eyePartPattern: '^(dark_eye_socket|eye)',
    hasSkeletalAnimations: false,
    get note() {
      return t('species.dog.note');
    },
  },
  rig: DOG_RIG,
  // Plain coat with a slightly darker back and a lighter belly.
  coat: {
    stripeColor: '#8a7360',
    stripeStrength: 0,
    stripeFrequency: 0,
    backShade: 0.45,
    bellyColor: '#f1dfc2',
    bellyStrength: 0.45,
    sockStrength: 0.2,
  },
  stages: {
    baby: { height: 0.4, eyeScale: 1.3, proportions: [1.06, 0.95, 0.88], furLength: 1.5, furDensity: 0.85 },
    young: { height: 0.58, eyeScale: 1.12, proportions: [1.02, 0.98, 0.95], furLength: 1.2, furDensity: 0.92 },
    adult: { height: 0.75, eyeScale: 1, proportions: [1, 1, 1], furLength: 1, furDensity: 1 },
  },
  fur: {
    // Short coat.
    lengthRatio: 0.017,
    densityPerHeight: 380,
    gravity: 0.25,
    rootShade: 0.62,
    strandVariation: 0.1,
    // Short coat that lies flat and shines a little.
    comb: 1.2,
    clump: 0.3,
    rim: 0.3,
    sheen: 0.3,
    profile: { body: 1, legs: 0.6, head: 0.55, tail: 1.25, chest: 1.15, belly: 1.05 },
  },
  placeholder: {
    body: '#b07a4a',
    belly: '#f0dcc0',
    ears: '#7a4f2c',
    nose: '#2b2b2b',
    earShape: 'floppy',
    tailLength: 0.35,
  },
  decayMultipliers: {
    happiness: 1.2,
    satiety: 1.1,
  },
  bathHappiness: 2,
  reactions: {
    happy: 'wags its tail',
    eat: 'gobbles up the food',
    play: 'bounds after the toy',
    petted: 'rolls over for belly rubs',
    bath: 'splashes around in the bath',
    sleep: 'flops down and starts snoring',
    refuse: 'tilts its head, not interested',
  },
};
