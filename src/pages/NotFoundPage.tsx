import { Link } from 'react-router-dom';
import Page from './Page';
import { useMeta } from '../hooks/useMeta';

export default function NotFoundPage() {
  useMeta({ title: 'Page not found' });
  return (
    <Page title="404 — Lost the frame">
      <p className="muted">That page doesn't exist.</p>
      <Link className="page-link" to="/">Back home</Link>
    </Page>
  );
}
