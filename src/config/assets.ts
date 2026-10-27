/**
 * Base path the app is served from: "/" locally, "/virtual-pets-3d/" on
 * GitHub Pages. Vite injects it as import.meta.env.BASE_URL at build time.
 * Read defensively so pure modules also work in plain Node tests.
 */
const BASE: string = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

/** URL of a file from /public, respecting the deployment base path. */
export function assetUrl(path: string): string {
  return `${BASE.endsWith('/') ? BASE : `${BASE}/`}${path.replace(/^\//, '')}`;
}
