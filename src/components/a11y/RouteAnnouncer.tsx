import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** Max time to wait for a lazily loaded page to set its title before announcing anyway. */
export const TITLE_WAIT_MS = 1500;

/**
 * Announces client-side route changes to assistive tech and resets focus to
 * the `#main` wrapper, mimicking what a full page load would do.
 *
 * - Always mounted: a visually hidden polite live region.
 * - Skips the initial render (the browser already announced the page).
 * - Reacts to `pathname` only, so hash- or search-only changes are ignored.
 * - Waits one tick so the new page's `useMeta` has set `document.title`. If the
 *   title has not changed yet (a lazy route chunk still loading behind Suspense),
 *   it waits for the title to change, up to TITLE_WAIT_MS.
 * - Never steals focus while a modal dialog (`[aria-modal="true"]`) is open.
 */
export default function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState('');
  const isFirst = useRef(true);
  const lastTitle = useRef('');

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      lastTitle.current = document.title;
      return;
    }
    let observer: MutationObserver | undefined;
    let fallback: number | undefined;
    let done = false;

    const announce = () => {
      if (done) return;
      done = true;
      observer?.disconnect();
      window.clearTimeout(fallback);
      lastTitle.current = document.title;
      setMessage(`Navigated to ${document.title}`);
    };

    const timer = window.setTimeout(() => {
      if (!document.querySelector('[aria-modal="true"]')) {
        document.getElementById('main')?.focus({ preventScroll: true });
      }
      if (document.title !== lastTitle.current || typeof MutationObserver === 'undefined') {
        announce();
        return;
      }
      observer = new MutationObserver(() => {
        if (document.title !== lastTitle.current) announce();
      });
      observer.observe(document.head, { childList: true, subtree: true, characterData: true });
      fallback = window.setTimeout(announce, TITLE_WAIT_MS);
    }, 0);

    return () => {
      done = true;
      window.clearTimeout(timer);
      window.clearTimeout(fallback);
      observer?.disconnect();
    };
  }, [pathname]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
