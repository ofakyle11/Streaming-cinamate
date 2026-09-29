import { Skeleton } from '../ui';

/** Loading placeholder mirroring the title page layout. */
export default function TitleSkeleton() {
  return (
    <main className="title-page" aria-busy="true">
      <span className="title-sr-only" role="status">
        Loading title…
      </span>
      <div className="title-backdrop" aria-hidden>
        <div className="title-backdrop-fade" />
      </div>
      <div className="title-content">
        <div className="title-panel glass" aria-hidden>
          <Skeleton variant="text" width="60%" height="2.2rem" />
          <Skeleton variant="text" width="45%" />
          <Skeleton variant="text" width="35%" />
          <div className="title-skel-lines">
            <Skeleton variant="text" />
            <Skeleton variant="text" />
            <Skeleton variant="text" width="80%" />
          </div>
          <div className="title-actions">
            <Skeleton width={150} height={44} />
            <Skeleton width={120} height={44} />
            <Skeleton width={90} height={44} />
          </div>
        </div>
        <div className="title-section" aria-hidden>
          <Skeleton variant="text" width={80} height="1.2rem" />
          <div className="cast-strip">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="cast-skel" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
