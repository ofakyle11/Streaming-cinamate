import { ReactNode } from 'react';

interface PageProps { title: string; children?: ReactNode }

/** Shared glass page shell for secondary routes. */
export default function Page({ title, children }: PageProps) {
  return (
    <main className="page">
      <section className="page-card glass">
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
