import { lazy, useSyncExternalStore } from 'react';
import { useAuth } from '../auth';
import { GUEST_CHANGE_EVENT, GUEST_KEY, hasChosenGuest } from '../lib/guest';

const Home = lazy(() => import('./Home'));
const LandingPage = lazy(() => import('./LandingPage'));

/** Re-renders when the guest choice changes (same tab via the custom event, other tabs via `storage`). */
function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === GUEST_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(GUEST_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(GUEST_CHANGE_EVENT, onChange);
  };
}

const snapshot = () => hasChosenGuest();
const serverSnapshot = () => false;

/**
 * The front door at `/` (plan decision 1A): signed-in users and remembered
 * guests get the app's Home; a signed-out first-time visitor gets the landing
 * page. Nothing is drawn while auth is still resolving so a signed-in user
 * never sees the landing page flash past.
 */
export default function FrontDoor() {
  const { status } = useAuth();
  const guest = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (status === 'loading') {
    return (
      <div className="page-loading" aria-live="polite">
        Loading…
      </div>
    );
  }
  if (status === 'authenticated' || guest) return <Home />;
  return <LandingPage />;
}
