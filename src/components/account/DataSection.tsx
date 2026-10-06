import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui';

interface DataSectionProps {
  signedIn: boolean;
  busy: boolean;
  exporting: boolean;
  onExport: () => Promise<void>;
  onDelete: () => Promise<void>;
}

/**
 * "Your data": download everything as JSON, and the delete zone. Signed in,
 * delete is the account (the privacy page promises erasure within 24 hours);
 * as a guest it is this device's data.
 */
export default function DataSection({
  signedIn,
  busy,
  exporting,
  onExport,
  onDelete,
}: DataSectionProps) {
  const dataId = useId();
  const dangerId = useId();
  const [confirm, setConfirm] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  useEffect(() => {
    if (confirm) cancelRef.current?.focus();
    else if (wasConfirming.current) openRef.current?.focus();
    wasConfirming.current = confirm;
  }, [confirm]);

  return (
    <>
      <section className="acct-sec" aria-labelledby={dataId}>
        <h2 id={dataId}>Your data</h2>
        <p className="acct-lead">
          Everything Lastframe.tv keeps about you is yours to take or erase.
        </p>
        <div className="acct-row">
          <span className="acct-ic" aria-hidden>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              focusable="false"
            >
              <path d="M12 4v11m0 0 4-4m-4 4-4-4M4 19h16" />
            </svg>
          </span>
          <div className="acct-row-text">
            <b>Download my data</b>
            <span>
              Profiles, My List, history and ratings as a JSON file
              {signedIn ? '' : ' from this device'}.
            </span>
          </div>
          <Button
            variant="glass"
            size="sm"
            loading={exporting}
            disabled={busy}
            onClick={() => void onExport()}
          >
            Download
          </Button>
        </div>
        <p className="acct-hint">
          How we handle your data is in the <Link to="/privacy">privacy policy</Link>.
        </p>
      </section>

      <section className="acct-sec acct-danger" aria-labelledby={dangerId}>
        <h2 id={dangerId}>{signedIn ? 'Delete account' : 'Delete my data'}</h2>
        <p className="acct-lead">
          {signedIn
            ? 'Removes your account and all synced data within 24 hours, and clears this device. Signed-in devices are signed out. This cannot be undone.'
            : 'Removes profiles, My List, watch history and ratings from this device. This cannot be undone.'}
        </p>
        {confirm ? (
          <div
            className="acct-confirm"
            role="group"
            aria-label={signedIn ? 'Confirm account deletion' : 'Confirm data deletion'}
          >
            <p>
              {signedIn
                ? 'Delete your account and everything in it?'
                : 'Delete everything saved on this device?'}
            </p>
            <div className="acct-confirm-buttons">
              <Button
                ref={cancelRef}
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                size="sm"
                className="acct-btn-danger-solid"
                loading={busy}
                onClick={() => {
                  void onDelete().then(() => setConfirm(false));
                }}
              >
                {signedIn ? 'Yes, delete my account' : 'Yes, delete everything'}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            ref={openRef}
            variant="ghost"
            className="acct-btn-danger"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            {signedIn ? 'Delete my account…' : 'Delete my data…'}
          </Button>
        )}
      </section>
    </>
  );
}
