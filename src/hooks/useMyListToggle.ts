import { useCallback } from 'react';
import { useOptionalToast } from '../components/ui/Toast';
import { analytics as defaultAnalytics, type AnalyticsService, type MediaType } from '../services';
import { selectIsInWatchlist, useLastFrameStore } from '../state/store';

/** The minimum a surface needs to know about a title to add it to My List. */
export interface ListableTitle {
  id: number;
  mediaType: MediaType;
  title: string;
}

/** Where the toggle was used; sent with the analytics event. */
export type MyListSource = 'card' | 'title' | 'modal' | 'my-list' | 'hero';

export function myListToastMessage(title: string, added: boolean): string {
  return added ? `Added ${title} to My List` : `Removed ${title} from My List`;
}

/**
 * Add/remove a title from the active profile's My List, with a toast and an
 * analytics event. Shared by poster cards, the title page and the detail modal.
 */
export function useMyListToggle(
  item: ListableTitle,
  source: MyListSource,
  analytics: AnalyticsService = defaultAnalytics,
) {
  const inList = useLastFrameStore(selectIsInWatchlist(item.id));
  const toggleWatchlist = useLastFrameStore((s) => s.toggleWatchlist);
  const { toast } = useOptionalToast();
  const { id, mediaType, title } = item;

  const toggle = useCallback(() => {
    // Read fresh state so rapid double-clicks cannot desync the toast from the store.
    const wasIn = selectIsInWatchlist(id)(useLastFrameStore.getState());
    toggleWatchlist(id, mediaType);
    analytics.track(wasIn ? 'watchlist_remove' : 'watchlist_add', { id, mediaType, source });
    toast(myListToastMessage(title, !wasIn), { kind: wasIn ? 'info' : 'success' });
  }, [analytics, id, mediaType, source, title, toast, toggleWatchlist]);

  return { inList, toggle };
}
