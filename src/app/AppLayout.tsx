import { MouseEvent, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
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
  return (
    <>
      <a className="skip-link glass" href="#main" onClick={skipToContent}>
        Skip to content
      </a>
      <div className="aurora" aria-hidden>
        <span /><span /><span />
      </div>
      <Navbar />
      <div id="main" className="main-target" tabIndex={-1}>
        <Suspense fallback={<div className="page-loading" aria-live="polite">Loading…</div>}>
          <Outlet />
        </Suspense>
      </div>
      <footer className="footer">Last Frame · lastframe.tv</footer>
    </>
  );
}
