import Page from './Page';
import { useMeta } from '../hooks/useMeta';

export default function AccountPage() {
  useMeta({ title: 'Account', description: 'Manage your Last Frame account settings.' });
  return (
    <Page title="Account">
      <p className="muted">Account settings.</p>
    </Page>
  );
}
