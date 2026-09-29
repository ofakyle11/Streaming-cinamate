import { Button, useToast } from './ui';
import { useInstallPrompt } from '../pwa/install';
import '../styles/pwa.css';

/** Account-page card offering to install Last Frame as an app (PWA). */
export default function InstallAppCard() {
  const { status, promptInstall } = useInstallPrompt();
  const { toast } = useToast();

  const onInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') toast('Last Frame is installed. Find it on your home screen.', { kind: 'success' });
    else if (outcome === 'unavailable') toast('Install is not available in this browser right now.', { kind: 'error' });
  };

  return (
    <section className="install-card glass" aria-labelledby="install-card-title">
      <img className="install-card-mark" src="/logo.svg" alt="" width={48} height={48} />
      <div className="install-card-body">
        <h2 id="install-card-title">Get the app</h2>
        {status === 'installed' ? (
          <p className="muted">Last Frame is installed on this device.</p>
        ) : status === 'manual-ios' ? (
          <p className="muted">
            In Safari, tap <strong>Share</strong> then <strong>Add to Home Screen</strong> to install Last Frame.
          </p>
        ) : status === 'unavailable' ? (
          <p className="muted">
            Install Last Frame from your browser menu for a full-screen experience with offline artwork.
          </p>
        ) : (
          <p className="muted">Full-screen, launches from your home screen, and keeps artwork cached offline.</p>
        )}
      </div>
      {(status === 'available' || status === 'prompting') && (
        <Button variant="primary" className="install-card-action" loading={status === 'prompting'} onClick={onInstall}>
          Install app
        </Button>
      )}
    </section>
  );
}
