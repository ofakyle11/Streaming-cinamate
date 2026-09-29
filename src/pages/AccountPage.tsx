import ViewingHistoryPanel from '../components/account/ViewingHistoryPanel';
import Page from './Page';

export default function AccountPage() {
  return (
    <Page title="Account">
      <p className="muted">Account settings.</p>
      <ViewingHistoryPanel />
    </Page>
  );
}
