import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getMql(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;
}

function subscribe(cb: () => void): () => void {
  const mql = getMql();
  if (!mql || typeof mql.addEventListener !== 'function') return () => {};
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

const getSnapshot = () => getMql()?.matches ?? false;
const getServerSnapshot = () => false;

/** Live `prefers-reduced-motion: reduce` flag. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
