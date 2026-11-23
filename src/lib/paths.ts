/**
 * Router mode. "browser" for normal hosting, "memory" for the preview link, where the app runs inside a frame
 * and cannot use the address bar.
 */
export const ROUTER_MODE: 'browser' | 'memory' = import.meta.env.VITE_ROUTER === 'memory' ? 'memory' : 'browser';
export const USE_HASH = ROUTER_MODE !== 'browser';
export const IS_PREVIEW = ROUTER_MODE === 'memory';

export function asset(path: string): string {
  if (path.startsWith('data:')) return path;
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}

/** URL for opening an app page in a new tab (normal hosting only). */
export function pageUrl(path: string): string {
  return path;
}
/** Demo build for showing the client: sample data and one-tap logins, but a normal installable web app. */
export const IS_DEMO = IS_PREVIEW || import.meta.env.VITE_DEMO === 'true';
