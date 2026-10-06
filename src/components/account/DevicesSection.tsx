import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Device } from './contract';
import { relativeSeen } from './relativeSeen';
import { Button } from '../ui';

interface DevicesSectionProps {
  listDevices?: () => Promise<Device[]>;
  forgetDevice?: (deviceId: string) => Promise<void>;
  /** Signs out everywhere, then this device. */
  signOutEverywhere: () => Promise<void>;
  /** Plain sign-out from this device. */
  signOutHere: () => Promise<void>;
  busy: boolean;
  onNotice: (notice: { kind: 'success' | 'error' | 'info'; text: string }) => void;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; devices: Device[] }
  | { kind: 'error' }
  | { kind: 'local' };

function DeviceIcon({ device }: { device: Device }) {
  const phone = /iphone|android|mobile/i.test(`${device.label} ${device.userAgent}`);
  return (
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
        {phone ? (
          <>
            <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
            <path d="M11 18h2" />
          </>
        ) : (
          <>
            <rect x="2.5" y="4.5" width="19" height="13" rx="2" />
            <path d="M8 20.5h8" />
          </>
        )}
      </svg>
    </span>
  );
}

/**
 * "Where you are signed in": the devices list the app keeps for the account,
 * sign out of one, or everywhere. Without the backend (or while it loads
 * nothing) the section still works for this device.
 */
export default function DevicesSection({
  listDevices,
  forgetDevice,
  signOutEverywhere,
  signOutHere,
  busy,
  onNotice,
}: DevicesSectionProps) {
  const headingId = useId();
  const [state, setState] = useState<LoadState>(
    listDevices ? { kind: 'loading' } : { kind: 'local' },
  );
  const [forgetting, setForgetting] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [now] = useState(() => Date.now());
  const cancelRef = useRef<HTMLButtonElement>(null);
  const allRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  const load = useCallback(async () => {
    if (!listDevices) return;
    try {
      const devices = await listDevices();
      setState({ kind: 'ready', devices: devices.filter((d) => !d.revokedAt) });
    } catch {
      setState({ kind: 'error' });
    }
  }, [listDevices]);

  useEffect(() => {
    let active = true;
    if (!listDevices) return;
    void listDevices()
      .then(
        (devices) =>
          active && setState({ kind: 'ready', devices: devices.filter((d) => !d.revokedAt) }),
      )
      .catch(() => active && setState({ kind: 'error' }));
    return () => {
      active = false;
    };
  }, [listDevices]);

  useEffect(() => {
    if (confirmAll) cancelRef.current?.focus();
    else if (wasConfirming.current) allRef.current?.focus();
    wasConfirming.current = confirmAll;
  }, [confirmAll]);

  const forget = async (device: Device) => {
    if (!forgetDevice) return;
    setForgetting(device.id);
    try {
      await forgetDevice(device.id);
      setState((s) =>
        s.kind === 'ready'
          ? { kind: 'ready', devices: s.devices.filter((d) => d.id !== device.id) }
          : s,
      );
      onNotice({
        kind: 'success',
        text: `${device.label} will be signed out the next time it opens Lastframe.tv.`,
      });
    } catch (err) {
      onNotice({
        kind: 'error',
        text: err instanceof Error && err.message ? err.message : 'Could not sign that device out.',
      });
    } finally {
      setForgetting(null);
    }
  };

  const everywhere = async () => {
    setConfirmAll(false);
    await signOutEverywhere();
  };

  const devices = state.kind === 'ready' ? state.devices : [];
  const others = devices.filter((d) => !d.current);
  const current = devices.find((d) => d.current) ?? null;

  return (
    <section className="acct-sec" aria-labelledby={headingId}>
      <h2 id={headingId}>Where you are signed in</h2>
      <p className="acct-lead">
        Sign out of any device you do not recognise. A new sign-in link is needed to get back in.
      </p>

      {state.kind === 'loading' && (
        <p className="acct-hint" aria-live="polite">
          Loading your devices…
        </p>
      )}
      {state.kind === 'error' && (
        <div className="acct-row">
          <span className="acct-row-text">
            <b>Your device list is not available right now.</b>
            <span>You can still sign out of this device, or everywhere.</span>
          </span>
          <Button variant="glass" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {(state.kind === 'local' || (state.kind === 'ready' && !current)) && (
        <div className="acct-row">
          <DeviceIcon
            device={{
              id: 'this',
              label: 'This device',
              userAgent: '',
              createdAt: '',
              lastSeenAt: '',
              revokedAt: null,
              current: true,
            }}
          />
          <div className="acct-row-text">
            <b>This browser</b>
            <span>active now</span>
          </div>
          <span className="acct-tag now">This device</span>
        </div>
      )}

      {state.kind === 'ready' && (
        <ul className="acct-list" aria-label="Signed-in devices">
          {current && (
            <li className="acct-row">
              <DeviceIcon device={current} />
              <div className="acct-row-text">
                <b>{current.label}</b>
                <span>{relativeSeen(current.lastSeenAt, now) || 'active now'}</span>
              </div>
              <span className="acct-tag now">This device</span>
            </li>
          )}
          {others.map((d) => (
            <li key={d.id} className="acct-row">
              <DeviceIcon device={d} />
              <div className="acct-row-text">
                <b>{d.label}</b>
                <span>{relativeSeen(d.lastSeenAt, now)}</span>
              </div>
              {forgetDevice && (
                <Button
                  variant="glass"
                  size="sm"
                  loading={forgetting === d.id}
                  disabled={busy || forgetting !== null}
                  aria-label={`Sign out ${d.label}`}
                  onClick={() => void forget(d)}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="acct-actions">
        {confirmAll ? (
          <div className="acct-confirm" role="group" aria-label="Confirm signing out everywhere">
            <p>
              Every device, including this one, is signed out. Each needs a new sign-in link to get
              back in.
            </p>
            <div className="acct-confirm-buttons">
              <Button
                ref={cancelRef}
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmAll(false)}
              >
                Cancel
              </Button>
              <Button variant="accent" size="sm" loading={busy} onClick={() => void everywhere()}>
                Sign out everywhere
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void signOutHere()}>
              Sign out of this device
            </Button>
            <Button
              ref={allRef}
              variant="glass"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmAll(true)}
            >
              Sign out everywhere
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
