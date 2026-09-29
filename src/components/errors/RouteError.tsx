import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import ErrorCard from './ErrorCard';

function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed|Loading chunk/i.test(
      error.message,
    )
  );
}

/**
 * react-router `errorElement` for the layout route: last-resort fallback for
 * loader/render errors that escape the in-layout ErrorBoundary. Retry does a
 * full reload, which also recovers from failed lazy-chunk imports.
 */
export default function RouteError() {
  const error = useRouteError();
  const reload = () => window.location.reload();

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorCard
        title={error.status === 404 ? '404 — Lost the frame' : `Error ${error.status}`}
        message={error.statusText || 'That page could not be loaded.'}
        onRetry={error.status === 404 ? undefined : reload}
      />
    );
  }

  if (isChunkLoadError(error)) {
    return (
      <ErrorCard
        title="Couldn't load this page"
        message="Part of the app failed to download. Check your connection and reload."
        onRetry={reload}
        retryLabel="Reload"
      />
    );
  }

  return <ErrorCard onRetry={reload} retryLabel="Reload" />;
}
