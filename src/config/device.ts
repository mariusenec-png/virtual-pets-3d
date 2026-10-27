/**
 * Rough device class detection used to pick sensible graphics defaults.
 * Safe to call outside the browser (returns desktop defaults).
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const small = Math.min(window.screen?.width ?? 1920, window.screen?.height ?? 1080) < 820;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return ua || (coarse && small);
}

export interface GraphicsProfile {
  maxDpr: number;
  shadowMapSize: number;
  contactShadowResolution: number;
}

export function graphicsProfile(): GraphicsProfile {
  return isMobileDevice()
    ? { maxDpr: 1.5, shadowMapSize: 1024, contactShadowResolution: 256 }
    : { maxDpr: 2, shadowMapSize: 2048, contactShadowResolution: 512 };
}
