import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHistory, useViewActions, useViews } from '../../hooks';
import { relativeTime } from '../../lib/viewHistory';
import { titlePath } from '../../pages/homeRows';
import { analytics } from '../../services';
import { Button, useToast } from '../ui';
import './ViewingHistoryPanel.css';

/** How many recent titles the panel previews. */
const PREVIEW_COUNT = 5;

/**
 * Account > Viewing history: previews recently viewed titles and clears the
 * active profile's history (viewed titles + playback progress) after a confirm step.
 */
export default function ViewingHistoryPanel() {
  const views = useViews();
  const playback = useHistory();
  const { clearAll } = useViewActions();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  // Move focus into the confirm step, and back to the trigger when it closes.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
    else if (wasConfirming.current) clearRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const total = views.length;
  const empty = total === 0 && playback.length === 0;
  // Reference time for "5m ago" labels, fixed per visit to keep render pure.
  const [now] = useState(() => Date.now());

  const confirmClear = () => {
    clearAll();
    setConfirming(false);
    analytics.track('history_clear', { count: total });
    toast('Viewing history cleared', { kind: 'success' });
  };

  return (
    <section className="history-panel glass" aria-labelledby="history-panel-heading">
      <header className="history-panel-head">
        <div>
          <h2 id="history-panel-heading">Viewing history</h2>
          <p className="muted">
            {empty
              ? 'Titles you open or play trailers for will appear here.'
              : `${total} ${total === 1 ? 'title' : 'titles'} viewed on this profile.`}
          </p>
        </div>
      </header>

      {total > 0 && (
        <ol className="history-list" aria-label="Recently viewed titles">
          {views.slice(0, PREVIEW_COUNT).map((e) => (
            <li key={e.key} className="history-item">
              <Link to={titlePath(e.title)} className="history-link">
                <img src={e.title.poster} alt="" loading="lazy" />
                <span className="history-text">
                  <strong>{e.title.title}</strong>
                  <span className="muted">
                    {e.trailerPlayedAt !== undefined ? 'Trailer played' : 'Viewed'} · {relativeTime(e.lastViewedAt, now)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <div className="history-actions">
        {confirming ? (
          <div className="history-confirm" role="group" aria-label="Confirm clearing history">
            <p>Clear all viewing history for this profile? This can’t be undone.</p>
            <div className="history-confirm-buttons">
              <Button ref={cancelRef} variant="glass" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button variant="accent" size="sm" onClick={confirmClear}>
                Clear history
              </Button>
            </div>
          </div>
        ) : (
          <Button ref={clearRef} variant="glass" size="sm" disabled={empty} onClick={() => setConfirming(true)}>
            Clear viewing history
          </Button>
        )}
      </div>
    </section>
  );
}
