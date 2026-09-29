import { useCallback, useMemo } from 'react';
import { useHistoryRows, useViewActions, useViews } from '../hooks/useViewHistory';
import { viewKey, type ViewEntry } from '../lib/viewHistory';
import type { Movie } from '../services';
import { selectHistory, useLastFrameStore, type HistoryEntry } from '../state/store';
import Row from './Row';
import { IconButton, useOptionalToast } from './ui';
import './HistoryRows.css';

interface Props {
  /** Side effect when a card is opened (analytics); navigation is handled by the card link. */
  onSelect?: (m: Movie) => void;
}

/** Progress-map key for history entries saved before they carried a media type. */
const legacyProgressKey = (id: number) => `any:${id}`;

type HistoryRowName = 'Continue Watching' | 'Recently Viewed';

/** Whole-number playback percentage (0-100), or null when the duration is unknown. */
function progressPercent(entry: Pick<HistoryEntry, 'position' | 'duration'> | undefined): number | null {
  if (!entry || entry.duration <= 0 || entry.position <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((entry.position / entry.duration) * 100)));
}

/** Home rows built from the active profile's viewing history. Renders nothing when history is empty. */
export default function HistoryRows({ onSelect }: Props) {
  const { continueWatching, recentlyViewed } = useHistoryRows();
  const views = useViews();
  const playback = useLastFrameStore(selectHistory);
  const { recordView, removeView } = useViewActions();
  // Optional so Home still renders in isolation (tests) without a ToastProvider.
  const { toast } = useOptionalToast();

  const entriesByKey = useMemo(() => new Map(views.map((e) => [e.key, e])), [views]);
  // Keyed by viewKey when the entry knows its media type, so movie and TV ids never collide;
  // legacy entries without one fall back to an id-only key that matches either type.
  const progressByKey = useMemo(() => {
    const map = new Map<string, HistoryEntry>();
    for (const p of playback) {
      if (p.completed) continue;
      const key = p.mediaType ? viewKey({ mediaType: p.mediaType, id: p.titleId }) : legacyProgressKey(p.titleId);
      if (!map.has(key)) map.set(key, p);
    }
    return map;
  }, [playback]);

  const remove = useCallback(
    (m: Movie, row: HistoryRowName) => {
      const key = viewKey(m);
      const entry: ViewEntry | undefined = entriesByKey.get(key);
      removeView(key);
      toast(`Removed ${m.title} from ${row}`, {
        duration: 6000,
        action: {
          label: 'Undo',
          onAction: () => recordView(entry?.title ?? m, entry?.trailerPlayedAt !== undefined ? 'trailer' : 'open'),
        },
      });
    },
    [entriesByKey, removeView, recordView, toast],
  );

  const removeButton = (m: Movie, row: HistoryRowName) => (
    <IconButton
      size="sm"
      className="history-remove"
      label={`Remove ${m.title} from ${row}`}
      onClick={() => remove(m, row)}
    >
      <span aria-hidden>✕</span>
    </IconButton>
  );

  const continueExtra = (m: Movie) => {
    const pct = progressPercent(progressByKey.get(viewKey(m)) ?? progressByKey.get(legacyProgressKey(m.id)));
    const trailer = entriesByKey.get(viewKey(m))?.trailerPlayedAt !== undefined;
    return (
      <>
        {removeButton(m, 'Continue Watching')}
        {pct !== null ? (
          <div
            className="history-progress"
            role="progressbar"
            aria-label={`${m.title} watched`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={`${pct}% watched`}
          >
            <span className="history-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        ) : (
          trailer && <span className="history-pill glass">Trailer watched</span>
        )}
      </>
    );
  };

  return (
    <>
      {continueWatching.length > 0 && (
        <Row title="Continue Watching" items={continueWatching} onSelect={onSelect} cardExtra={continueExtra} />
      )}
      {recentlyViewed.length > 0 && (
        <Row
          title="Recently Viewed"
          items={recentlyViewed}
          onSelect={onSelect}
          cardExtra={(m) => removeButton(m, 'Recently Viewed')}
        />
      )}
    </>
  );
}
