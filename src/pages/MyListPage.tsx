import Page from './Page';
import { useMeta } from '../hooks/useMeta';

export default function MyListPage() {
  useMeta({ title: 'My List', description: 'The films and series you have saved to watch.' });
  return (
    <Page title="My List">
      <p className="muted">Titles you save will show up here.</p>
    </Page>
  );
}
