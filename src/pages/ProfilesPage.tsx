import Page from './Page';
import { useMeta } from '../hooks/useMeta';

export default function ProfilesPage() {
  useMeta({ title: 'Profiles', description: 'Manage who is watching on Last Frame.' });
  return (
    <Page title="Profiles">
      <p className="muted">Manage who is watching.</p>
    </Page>
  );
}
