import { useCallback, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AccountHeader from '../components/account/AccountHeader';
import AccountTabs from '../components/account/AccountTabs';
import { isAccountTab, type AccountTabId } from '../components/account/tabs';
import SignInSection from '../components/account/SignInSection';
import DevicesSection from '../components/account/DevicesSection';
import DataSection from '../components/account/DataSection';
import ProfilesSection from '../components/account/ProfilesSection';
import ViewingHistoryPanel from '../components/account/ViewingHistoryPanel';
import { accountAuth } from '../components/account/contract';
import InstallAppCard from '../components/InstallAppCard';
import { useAuth } from '../auth';
import { readSyncOwner, services } from '../services';
import type { DbService } from '../services/types';
import { useLastFrameStore } from '../state/store';
import { buildDataExport, countExportItems, downloadJson, exportFileName } from '../lib/exportData';
import { useMeta } from '../hooks/useMeta';
import '../styles/account.css';

type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null;

function errorText(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : 'Something went wrong. Please try again.';
}

export interface AccountPageProps {
  /** Override the DB adapter the export reads from (tests). */
  db?: DbService;
}

/**
 * /account: a tabbed settings area. Sign-in & security (how you sign in,
 * where you are signed in), Profiles, Viewing history, Your data (download,
 * delete). Works for guests and with no backend configured; the devices list
 * and change-email light up when the auth adapter offers them.
 */
export default function AccountPage({ db = services.db }: AccountPageProps) {
  useMeta({
    title: 'Account',
    description: 'Sign-in, devices, profiles and your data on Lastframe.tv.',
  });
  const auth = useAuth();
  const { status, user, deleteData } = auth;
  const ext = useMemo(() => accountAuth(auth), [auth]);
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: AccountTabId = isAccountTab(tabParam) ? tabParam : 'security';
  const [busy, setBusy] = useState<null | 'signout' | 'signout-all' | 'delete' | 'export'>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const noticeId = useId();
  const signedIn = status === 'authenticated' && !!user;
  const synced = signedIn && services.mode.db === 'live' && readSyncOwner() === user.id;

  const selectTab = useCallback(
    (next: AccountTabId) => {
      setNotice(null); // a notice belongs to the tab it was raised on
      const nextParams = new URLSearchParams(params);
      if (next === 'security') nextParams.delete('tab');
      else nextParams.set('tab', next);
      setParams(nextParams, { replace: true });
    },
    [params, setParams],
  );

  const run = async (
    kind: NonNullable<typeof busy>,
    action: () => Promise<void>,
    success?: string,
  ) => {
    setBusy(kind);
    setNotice(null);
    try {
      await action();
      if (success) setNotice({ kind: 'success', text: success });
    } catch (err) {
      setNotice({ kind: 'error', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const signOutHere = () =>
    run('signout', () => ext.signOut(), 'You are signed out of this device. Guest mode is on.');

  const signOutEverywhere = () =>
    run(
      'signout-all',
      () => ext.signOut({ scope: 'global' }),
      'You are signed out everywhere. Each device needs a new sign-in link.',
    );

  const onExport = () =>
    run('export', async () => {
      const snapshot = user ? await db.pullSnapshot(user.id).catch(() => null) : null;
      const data = buildDataExport(useLastFrameStore.getState(), user, snapshot);
      if (!downloadJson(data, exportFileName()))
        throw new Error('Your browser blocked the download.');
      const n = countExportItems(data);
      setNotice({
        kind: 'success',
        text: `Your export is downloading: ${n} saved ${n === 1 ? 'item' : 'items'} as JSON.`,
      });
    });

  const onDelete = () =>
    run(
      'delete',
      () => deleteData(),
      signedIn
        ? 'Your account is being deleted. Everything is gone from this device now and from our servers within 24 hours.'
        : 'Your data was deleted from this device.',
    );

  const noticeEl = notice && (
    <p
      id={noticeId}
      className={`account-notice ${notice.kind}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      {notice.text}
    </p>
  );

  return (
    <main className="page acct-page">
      <div className="acct">
        <AccountHeader status={status} user={user} synced={synced} />
        <AccountTabs active={tab} onChange={selectTab} />

        <div
          role="tabpanel"
          id={`acct-panel-${tab}`}
          aria-labelledby={`acct-tab-${tab}`}
          className="acct-panel"
          key={tab}
        >
          {noticeEl}

          {tab === 'security' && (
            <>
              {signedIn && user && (
                <SignInSection user={user} changeEmail={ext.changeEmail} onNotice={setNotice} />
              )}
              {signedIn && (
                <DevicesSection
                  listDevices={ext.listDevices}
                  forgetDevice={ext.forgetDevice}
                  signOutEverywhere={signOutEverywhere}
                  signOutHere={signOutHere}
                  busy={busy !== null}
                  onNotice={setNotice}
                />
              )}
              {status === 'guest' && (
                <section className="acct-sec" aria-label="Signed-in devices">
                  <h2>Where you are signed in</h2>
                  <p className="acct-lead">
                    Sign in to see every device on your account and sign any of them out from here.
                  </p>
                </section>
              )}
              <InstallAppCard />
            </>
          )}

          {tab === 'profiles' && <ProfilesSection />}

          {tab === 'history' && <ViewingHistoryPanel />}

          {tab === 'data' && status !== 'loading' && (
            <DataSection
              signedIn={signedIn}
              busy={busy !== null && busy !== 'export'}
              exporting={busy === 'export'}
              onExport={onExport}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>
    </main>
  );
}
