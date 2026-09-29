import { useSearchParams } from 'react-router-dom';
import Page from './Page';

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  return (
    <Page title="Search">
      <p className="muted">{q ? `Results for "${q}" coming soon.` : 'Type to search titles, people and genres.'}</p>
    </Page>
  );
}
