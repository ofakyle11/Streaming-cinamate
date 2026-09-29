import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { usePageViews } from '../hooks/usePageViews';

export default function AppLayout() {
  usePageViews();
  return (
    <>
      <div className="aurora" aria-hidden>
        <span /><span /><span />
      </div>
      <Navbar />
      <Suspense fallback={<div className="page-loading" aria-live="polite">Loading…</div>}>
        <Outlet />
      </Suspense>
      <footer className="footer">Last Frame · lastframe.tv</footer>
    </>
  );
}
