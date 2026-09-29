import { tmdb as defaultTmdb, type TmdbCastMember, type TmdbService } from '../../services';
import { initials } from './titleUtils';

interface Props {
  cast: TmdbCastMember[];
  svc?: TmdbService;
}

/** Horizontal, snap-scrolling strip of cast members. */
export default function CastStrip({ cast, svc = defaultTmdb }: Props) {
  if (cast.length === 0) return null;
  return (
    <section className="title-section" aria-labelledby="title-cast-heading">
      <h2 id="title-cast-heading">Cast</h2>
      <ul className="cast-strip" tabIndex={0} aria-label="Cast members, scroll horizontally">
        {cast.map((c, i) => (
          <li key={c.id} className="cast-card glass" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
            {c.profile_path ? (
              <img className="cast-photo" src={svc.imageUrl(c.profile_path, 'w342')} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="cast-photo cast-monogram" aria-hidden>
                {initials(c.name)}
              </span>
            )}
            <span className="cast-name">{c.name}</span>
            {c.character && <span className="cast-role">{c.character}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
