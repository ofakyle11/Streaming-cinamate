import { useEffect, useState } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import '../../styles/errors.css';

/**
 * Glass banner shown while the browser reports it is offline. The live region
 * is always mounted so screen readers announce both going offline and coming
 * back online (politely, without interrupting).
 */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  const [recovered, setRecovered] = useState(false);

  // Remember a real offline -> online transition so recovery is announced.
  useEffect(() => {
    const onOffline = () => setRecovered(false);
    const onOnline = () => setRecovered(true);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return (
    <div className="offline-region" role="status" aria-live="polite" aria-atomic="true">
      {!online && (
        <div className="offline-banner glass">
          <span className="offline-dot" aria-hidden />
          You're offline. Showing what we have; we'll reconnect automatically.
        </div>
      )}
      {online && recovered && <span className="offline-sr-only">Back online.</span>}
    </div>
  );
}
