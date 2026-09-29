import { useSearchParams } from 'react-router-dom';
import Page from './Page';
import { useMeta } from '../hooks/useMeta';

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  useMeta({ title: 'Search', description: 'Search films, series, people and genres.' });
  return (
    <Page title="Search">
      <p className="muted">{q ? `Results for "${q}" coming soon.` : 'Type to search titles, people and genres.'}</p>
    </Page>
  );
}
