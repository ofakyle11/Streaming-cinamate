import { Skeleton } from './ui';

/** Hero placeholder while the featured titles load. */
export default function HeroSkeleton() {
  return (
    <header className="hero hero-skeleton" aria-hidden>
      <div className="hero-fade" />
      <div className="hero-card glass hero-skeleton-card">
        <Skeleton variant="text" className="hero-skeleton-title" />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" />
        <Skeleton variant="text" width="85%" />
        <div className="actions">
          <Skeleton width={110} height={42} />
          <Skeleton width={140} height={42} />
        </div>
      </div>
    </header>
  );
}
