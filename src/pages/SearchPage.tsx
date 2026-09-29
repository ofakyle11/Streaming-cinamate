import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import Page from './Page';
import { AnalyticsEvents, track } from '../services/analytics/track';

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  useEffect(() => {
    const query = q.trim();
    if (query) track(AnalyticsEvents.search, { query: query.slice(0, 100), length: query.length });
  }, [q]);
  return (
    <Page title="Search">
      <p className="muted">{q ? `Results for "${q}" coming soon.` : 'Type to search titles, people and genres.'}</p>
    </Page>
  );
}
