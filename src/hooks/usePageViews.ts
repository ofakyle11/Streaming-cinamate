import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPage } from '../services/analytics/track';

/** Emits one page view per route change (path + query). Mount once in the app layout. */
export function usePageViews(): void {
  const { pathname, search } = useLocation();
  useEffect(() => {
    trackPage(pathname, { path: `${pathname}${search}` });
  }, [pathname, search]);
}
