import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/errors/ErrorBoundary';
import OfflineBanner from '../components/errors/OfflineBanner';

export default function AppLayout() {
  const location = useLocation();
  return (
    <>
      <div className="aurora" aria-hidden>
        <span /><span /><span />
      </div>
      <Navbar />
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<div className="page-loading" aria-live="polite">Loading…</div>}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
      <OfflineBanner />
      <footer className="footer">Last Frame · lastframe.tv</footer>
    </>
  );
}
