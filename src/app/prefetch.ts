let titlePrefetched: Promise<unknown> | null = null;

/** Warm the TitlePage route chunk (e.g. on card hover/focus). Idempotent; failures are ignored. */
export function prefetchTitleRoute(): void {
  if (titlePrefetched) return;
  titlePrefetched = import('../pages/TitlePage').catch(() => {
    titlePrefetched = null;
  });
}
