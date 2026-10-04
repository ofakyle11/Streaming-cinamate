import { useState } from 'react';
import { defaultWatchRegion, useWatchProviders } from '../../hooks/useTitleDetails';
import {
  tmdb as defaultTmdb,
  type MediaType,
  type TmdbService,
  type TmdbWatchProvider,
  type WatchRegion,
} from '../../services';
import { Skeleton } from '../ui';
import { hasOffers, initials, OFFER_GROUPS as GROUPS } from './titleUtils';

interface Props {
  mediaType: MediaType;
  titleId: number;
  title: string;
  svc?: TmdbService;
  /** Overrides the locale-derived default (mainly for tests). */
  initialRegion?: WatchRegion;
}

const REGIONS: { id: WatchRegion; label: string }[] = [
  { id: 'US', label: 'United States' },
  { id: 'CA', label: 'Canada' },
];

function ProviderChip({ p, svc }: { p: TmdbWatchProvider; svc: TmdbService }) {
  return (
    <li className="provider glass">
      {p.logo_path ? (
        <img
          className="provider-logo"
          src={svc.imageUrl(p.logo_path, 'w342')}
          alt=""
          loading="lazy"
          decoding="async"
          width={30}
          height={30}
        />
      ) : (
        <span className="provider-logo provider-monogram" aria-hidden>
          {initials(p.provider_name)}
        </span>
      )}
      <span className="provider-name">{p.provider_name}</span>
    </li>
  );
}

/** Where to watch: provider offers by region (US/CA) with the required JustWatch attribution. */
export default function WhereToWatch({
  mediaType,
  titleId,
  title,
  svc = defaultTmdb,
  initialRegion,
}: Props) {
  const [region, setRegion] = useState<WatchRegion>(() => initialRegion ?? defaultWatchRegion());
  const state = useWatchProviders(mediaType, titleId, region, svc);

  return (
    <section
      id="where-to-watch"
      className="title-section where-to-watch glass"
      aria-labelledby="title-wtw-heading"
    >
      <div className="wtw-head">
        <h2 id="title-wtw-heading" tabIndex={-1}>
          Where to watch
        </h2>
        <div className="region-toggle" role="radiogroup" aria-label="Region">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={region === r.id}
              aria-label={r.label}
              className={region === r.id ? 'active' : undefined}
              onClick={() => setRegion(r.id)}
            >
              {r.id}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && (
          <div className="wtw-loading">
            <Skeleton variant="text" width="30%" />
            <Skeleton height={44} />
          </div>
        )}
        {state.status === 'error' && (
          <p className="muted">Streaming availability is unavailable right now.</p>
        )}
        {state.status === 'ready' && !hasOffers(state.data) && (
          <p className="muted">
            {title} isn’t available to stream, rent or buy in{' '}
            {REGIONS.find((r) => r.id === region)?.label} yet.
          </p>
        )}
        {state.status === 'ready' && state.data && hasOffers(state.data) && (
          <div className="wtw-groups">
            {GROUPS.map(({ key, label }) => {
              const list = state.data?.[key];
              if (!list?.length) return null;
              return (
                <div key={key} className="wtw-group">
                  <h3>{label}</h3>
                  <ul className="provider-list">
                    {list.map((p) => (
                      <ProviderChip key={p.provider_id} p={p} svc={svc} />
                    ))}
                  </ul>
                </div>
              );
            })}
            {state.data.link && (
              <a
                className="page-link wtw-link"
                href={state.data.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                All options on TMDB
              </a>
            )}
          </div>
        )}
      </div>

      <p className="wtw-attribution">
        Streaming data powered by{' '}
        <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer">
          JustWatch
        </a>
      </p>
    </section>
  );
}
