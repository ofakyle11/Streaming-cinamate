import { useParams } from 'react-router-dom';
import Page from './Page';
import { useMeta } from '../hooks/useMeta';

export default function GenrePage() {
  const { id } = useParams();
  useMeta({ title: id ? `Genre: ${id}` : 'Genre', description: 'Browse titles by genre.' });
  return (
    <Page title={`Genre: ${id ?? ''}`}>
      <p className="muted">Titles in this genre will appear here.</p>
    </Page>
  );
}
