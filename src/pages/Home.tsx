import { useState } from 'react';
import Hero from '../components/Hero';
import Row from '../components/Row';
import DetailModal from '../components/DetailModal';
import { movies, rows, Movie } from '../data/movies';

export default function Home() {
  const [selected, setSelected] = useState<Movie | null>(null);

  return (
    <>
      <Hero featured={movies.slice(0, 5)} onMore={setSelected} />
      <main className="rows">
        {rows.map((r) => (
          <Row key={r.title} title={r.title} items={r.items} onSelect={setSelected} />
        ))}
      </main>
      {selected && <DetailModal movie={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
