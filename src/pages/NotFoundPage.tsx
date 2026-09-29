import { Link } from 'react-router-dom';
import Page from './Page';

export default function NotFoundPage() {
  return (
    <Page title="404 — Lost the frame">
      <p className="muted">That page doesn't exist.</p>
      <Link className="page-link" to="/">Back home</Link>
    </Page>
  );
}
