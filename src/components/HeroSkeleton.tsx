import { Skeleton } from './ui';

/** Hero placeholder while the featured titles load: the Ink screen with the copy block's shape. */
export default function HeroSkeleton() {
  return (
    <section className="hero" aria-hidden>
      <div className="hero-screen hero-skeleton">
        <div className="hero-copy hero-skeleton-copy">
          <Skeleton width={56} height={56} className="hero-skeleton-lockup" />
          <Skeleton variant="text" className="hero-skeleton-title" />
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" />
          <Skeleton variant="text" width="85%" />
          <div className="actions">
            <Skeleton width={160} height={44} className="hero-skeleton-pill" />
            <Skeleton width={110} height={44} className="hero-skeleton-pill" />
          </div>
        </div>
      </div>
    </section>
  );
}
