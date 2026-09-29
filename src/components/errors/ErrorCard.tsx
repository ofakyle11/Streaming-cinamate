import { useEffect, useRef } from 'react';
import Button from '../ui/Button';
import '../../styles/errors.css';

export interface ErrorCardProps {
  title?: string;
  message?: string;
  /** Primary action; omitted -> no retry button. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Shows a secondary "Go home" link. Default true. */
  showHome?: boolean;
}

/** Glass error card used by route/component error boundaries. */
export default function ErrorCard({
  title = 'Something went wrong',
  message = 'This scene failed to load. Try again, or head back home.',
  onRetry,
  retryLabel = 'Try again',
  showHome = true,
}: ErrorCardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the error so keyboard and screen-reader users land on it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="page error-page">
      <section className="error-card glass" role="alert" aria-labelledby="error-card-title">
        <div className="error-card-icon" aria-hidden>
          !
        </div>
        <h1 id="error-card-title" ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
        <p className="error-card-message">{message}</p>
        <div className="error-card-actions">
          {onRetry && (
            <Button variant="primary" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {showHome && (
            // Plain anchor: works even when the router itself is what failed.
            <a className="btn glass" href="/">
              Go home
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
