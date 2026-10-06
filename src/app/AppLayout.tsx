import { MouseEvent, Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/errors/ErrorBoundary';
import OfflineBanner from '../components/errors/OfflineBanner';
import RouteAnnouncer from '../components/a11y/RouteAnnouncer';
import { useBrandFavicon } from '../components/brand/useBrandFavicon';
import { usePageViews } from '../hooks/usePageViews';
import '../styles/a11y.css';

/** Move focus to the content wrapper without adding a history entry (router-friendly). */
function skipToContent(e: MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById('main');
  if (!target) return;
  e.preventDefault();
  target.focus();
  target.scrollIntoView?.({ block: 'start' });
}

export default function AppLayout() {
  const location = useLocation();
  usePageViews();
  useBrandFavicon();
  return (
    <>
      <a className="skip-link glass" href="#main" onClick={skipToContent}>
        Skip to content
      </a>
      <Navbar />
      <div id="main" className="main-target" tabIndex={-1}>
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense
            fallback={
              <div className="page-loading" aria-live="polite">
                Loading…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </div>
      <OfflineBanner />
      <RouteAnnouncer />
      <footer className="footer">
        {/* The legal-pages thread adds Privacy, Terms and Security here with their routes. */}
        <span>Lastframe.tv</span>
        <Link to="/brand">Brand kit</Link>
      </footer>
    </>
  );
}
