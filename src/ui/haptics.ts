/** Short vibration on supporting phones (Android). Silently ignored elsewhere. */
export function haptic(ms: number): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    // Some browsers throw if vibration is blocked; it is only a nicety.
  }
}
