import { Button } from './ui';

interface Props {
  title: string;
  message?: string;
  onRetry: () => void;
}

/** Inline, per-row failure state with a retry action. */
export default function RowError({ title, message, onRetry }: Props) {
  return (
    <section className="row in row-error" aria-label={title}>
      <h2>{title}</h2>
      <div className="row-error-card glass" role="alert">
        <p>
          <strong>Couldn’t load {title}.</strong>
          {message ? <span className="row-error-detail"> {message}</span> : null}
        </p>
        <Button size="sm" onClick={onRetry} aria-label={`Retry ${title}`}>
          ↻ Retry
        </Button>
      </div>
    </section>
  );
}
