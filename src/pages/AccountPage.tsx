import Page from './Page';
import InstallAppCard from '../components/InstallAppCard';

export default function AccountPage() {
  return (
    <Page title="Account">
      <p className="muted">Account settings.</p>
      <InstallAppCard />
    </Page>
  );
}
