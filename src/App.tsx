import { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Row from './components/Row';
import DetailModal from './components/DetailModal';
import { movies, rows, Movie } from './data/movies';

export default function App() {
  const [selected, setSelected] = useState<Movie | null>(null);

  return (
    <>
      <div className="aurora" aria-hidden>
        <span /><span /><span />
      </div>
      <Navbar />
      <Hero featured={movies.slice(0, 5)} onMore={setSelected} />
      <main className="rows">
        {rows.map((r) => (
          <Row key={r.title} title={r.title} items={r.items} onSelect={setSelected} />
        ))}
      </main>
      <footer className="footer">Cinamate · rough draft</footer>
      {selected && <DetailModal movie={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
