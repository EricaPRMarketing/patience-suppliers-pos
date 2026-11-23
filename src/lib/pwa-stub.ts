/** Stand-in for the service worker registration in the preview-link build, where service workers are not allowed. */
export function registerSW(_opts?: unknown) {
  return () => Promise.resolve();
}
