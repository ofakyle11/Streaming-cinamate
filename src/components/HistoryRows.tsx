import { useHistoryRows } from '../hooks/useViewHistory';
import type { Movie } from '../services';
import Row from './Row';

interface Props {
  /** Side effect when a card is opened (analytics); navigation is handled by the card link. */
  onSelect?: (m: Movie) => void;
}

/** Home rows built from the active profile's viewing history. Renders nothing when history is empty. */
export default function HistoryRows({ onSelect }: Props) {
  const { continueWatching, recentlyViewed } = useHistoryRows();
  return (
    <>
      {continueWatching.length > 0 && <Row title="Continue Watching" items={continueWatching} onSelect={onSelect} />}
      {recentlyViewed.length > 0 && <Row title="Recently Viewed" items={recentlyViewed} onSelect={onSelect} />}
    </>
  );
}
