import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function AppLayout() {
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
