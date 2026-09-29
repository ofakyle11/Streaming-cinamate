import { useParams } from 'react-router-dom';
import Page from './Page';

export default function GenrePage() {
  const { id } = useParams();
  return (
    <Page title={`Genre: ${id ?? ''}`}>
      <p className="muted">Titles in this genre will appear here.</p>
    </Page>
  );
}
