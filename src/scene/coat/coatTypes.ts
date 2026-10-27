/** Coat markings for a species (see coat.ts). Kept free of three.js imports. */
export interface CoatStyle {
  /** Stripe color (multiplied with the base color). */
  stripeColor: string;
  /** 0 = no stripes, 1 = fully dark stripes. */
  stripeStrength: number;
  /** Stripes per model height along the body. */
  stripeFrequency: number;
  /** Darkening along the back (0..1). */
  backShade: number;
  /** Color of the belly, chest and muzzle. */
  bellyColor: string;
  /** 0 = no lighter belly, 1 = belly fully in bellyColor. */
  bellyStrength: number;
  /** Light paws ("socks"), 0..1. */
  sockStrength: number;
}
