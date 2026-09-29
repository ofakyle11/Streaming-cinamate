import { Skeleton } from './ui';

interface Props {
  title: string;
  /** Number of placeholder cards. */
  count?: number;
}

/** Placeholder row shown while a Home row loads. */
export default function RowSkeleton({ title, count = 8 }: Props) {
  return (
    <section className="row in row-skeleton" aria-busy="true" aria-label={`${title}, loading`}>
      <h2>{title}</h2>
      <div className="track">
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
    </section>
  );
}
