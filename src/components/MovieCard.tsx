import { useContext, useState, type ReactNode } from 'react';
import { Link, UNSAFE_DataRouterStateContext, useViewTransitionState } from 'react-router-dom';
import { prefetchTitleRoute } from '../app/prefetch';
import type { Movie } from '../services';
import type { RovingItemProps } from '../hooks/useRovingFocus';
import { titlePath } from '../pages/homeRows';
import { useMyListToggle, type MyListSource } from '../hooks/useMyListToggle';
import { IconButton } from './ui';
import CardRating from './ratings/CardRating';
import './MovieCard.css';

interface Props {
  movie: Movie;
  delay: number;
  /** Optional side effect (e.g. analytics) when the card is opened. Navigation is handled by the link. */
  onSelect?: (m: Movie) => void;
  /** Show the hover add/remove My List button. Default true. */
  listToggle?: boolean;
  /** Analytics source for the My List toggle. Default 'card'. */
  listSource?: MyListSource;
  /**
   * Optional extra overlay (e.g. a remove button or progress bar) rendered as a
   * sibling of the link, after the built-in overlays. Buttons are safe here.
   */
  extraAction?: ReactNode;
  /** Roving-tabindex wiring from the parent Row (arrow keys move between cards). */
  rovingProps?: RovingItemProps<HTMLAnchorElement>;
  /**
   * Carry the `lf-artwork` view-transition name while navigating to this title
   * (the poster morphs into the title backdrop). Default true. Rows rendered on
   * a title page pass false: that page's backdrop already owns the name, and a
   * duplicate aborts the whole route transition.
   */
  artworkTransition?: boolean;
}

/**
 * True while the router is running a view transition to or from `to`.
 * `useViewTransitionState` needs a data router (RouterProvider); unit tests
 * render inside MemoryRouter, so mirror react-router's own Link: read the data
 * router state context and only call the hook when one is present. The
 * presence of a data router is static for a tree, so the conditional call is
 * stable across renders.
 */
function useArtworkTransition(to: string): boolean {
  const routerState = useContext(UNSAFE_DataRouterStateContext);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return routerState != null && useViewTransitionState(to);
}

export default function MovieCard({
  movie,
  delay,
  onSelect,
  listToggle = true,
  listSource = 'card',
  extraAction,
  rovingProps,
  artworkTransition = true,
}: Props) {
  const to = titlePath(movie);
  // Only the clicked card carries the view-transition name: two elements with
  // the same name abort the whole route transition, and a title can sit in
  // several rows. `useViewTransitionState` is path-based (true for every card
  // of that title), so it is combined with a per-card "this one was clicked"
  // flag set in the same event as the navigation.
  const [clicked, setClicked] = useState(false);
  const transitioning = useArtworkTransition(to) && artworkTransition;
  const isTransitioning = transitioning && clicked;
  // Reset once the transition is over (adjusting state during render, per React's
  // guidance, so a cancelled navigation does not leave the flag set).
  if (!transitioning && clicked) setClicked(false);
  return (
    <div className="card" style={{ transitionDelay: `${delay}ms`, animationDelay: `${delay}ms` }}>
      <Link
        to={to}
        viewTransition
        className="card-link"
        aria-label={`${movie.title} (${movie.year})`}
        onClick={() => {
          setClicked(true);
          onSelect?.(movie);
        }}
        onPointerEnter={prefetchTitleRoute}
        {...rovingProps}
      >
        <img
          src={movie.poster}
          alt=""
          loading="lazy"
          decoding="async"
          width={342}
          height={513}
          style={isTransitioning ? { viewTransitionName: 'lf-artwork' } : undefined}
        />
        <div className="card-info glass" aria-hidden="true">
          <strong>{movie.title}</strong>
          <span>
            <em className="fit">Fit {movie.match}</em> · {movie.year}
            {movie.genres[0] ? ` · ${movie.genres[0]}` : ''}
          </span>
        </div>
      </Link>
      {listToggle && <CardListToggle movie={movie} source={listSource} />}
      <CardRating movie={movie} />
      {extraAction}
    </div>
  );
}

function CardListToggle({ movie, source }: { movie: Movie; source: MyListSource }) {
  const { inList, toggle } = useMyListToggle(movie, source);
  return (
    <IconButton
      size="sm"
      glass={false}
      className={`card-list-btn${inList ? ' is-listed' : ''}`}
      label={inList ? `Remove ${movie.title} from My List` : `Add ${movie.title} to My List`}
      aria-pressed={inList}
      onClick={toggle}
    >
      <span aria-hidden>{inList ? '✓' : '＋'}</span>
    </IconButton>
  );
}
