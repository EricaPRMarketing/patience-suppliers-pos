/** Works both on a normal web host and when the app is served from a sub-folder (hash routing). */
export const USE_HASH = import.meta.env.VITE_HASH_ROUTER === '1';

export function asset(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}

/** URL for opening an app page in a new tab. */
export function pageUrl(path: string): string {
  return USE_HASH ? `${window.location.pathname}${window.location.search}#${path}` : path;
}
