import { t } from '../i18n';
import type { SpeciesDefinition } from './types';
import { assetUrl } from '../config/assets';

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
  stages: {
    baby: { height: 0.4, eyeScale: 1.3, proportions: [1.06, 0.95, 0.88], furLength: 1.5, furDensity: 0.85 },
    young: { height: 0.58, eyeScale: 1.12, proportions: [1.02, 0.98, 0.95], furLength: 1.2, furDensity: 0.92 },
    adult: { height: 0.75, eyeScale: 1, proportions: [1, 1, 1], furLength: 1, furDensity: 1 },
  },
  fur: {
    // Short coat.
    lengthRatio: 0.014,
    densityPerHeight: 200,
    gravity: 0.25,
    rootShade: 0.75,
    strandVariation: 0.18,
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
