import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useMeta } from '../hooks/useMeta';
import {
  EFFECTIVE_DATE,
  legalDocuments,
  legalOrder,
  type LegalBlock,
  type LegalDocument,
} from '../content/legal';
import { renderInline } from './legalInline';
import '../styles/legal.css';

function Block({ block }: { block: LegalBlock }) {
  if (Array.isArray(block)) {
    return (
      <ul>
        {block.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  }
  return <p>{renderInline(block)}</p>;
}

interface LegalPageProps {
  doc: LegalDocument['slug'];
}

/** One reading-style page for /privacy, /terms and /security. Copy lives in src/content/legal.ts. */
export default function LegalPage({ doc }: LegalPageProps) {
  const d = legalDocuments[doc];
  useMeta({ title: d.title, description: d.description, type: 'article' });
  const others = legalOrder.filter((slug) => slug !== doc).map((slug) => legalDocuments[slug]);

  return (
    <main className="page legal-page">
      <article className="legal" aria-labelledby="legal-title">
        <header className="legal-head">
          <p className="legal-eyebrow">{d.eyebrow}</p>
          <h1 id="legal-title">{d.title}</h1>
          <p className="legal-meta">Effective {EFFECTIVE_DATE} · Lastframe.tv</p>
          <p className="legal-summary">{d.summary}</p>
          <nav className="legal-toc" aria-label="Sections">
            {d.sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.heading}
              </a>
            ))}
          </nav>
        </header>

        {d.sections.map((s) => (
          <section key={s.id} className="legal-section" aria-labelledby={`${s.id}-heading`}>
            <h2 id={s.id} tabIndex={-1}>
              <span id={`${s.id}-heading`}>{s.heading}</span>
            </h2>
            {s.body.map((block, i) => (
              <Fragment key={i}>
                <Block block={block} />
              </Fragment>
            ))}
          </section>
        ))}

        <footer className="legal-related">
          <span>Also read</span>
          {others.map((o) => (
            <Link key={o.slug} className="legal-related-link glass" to={`/${o.slug}`}>
              {o.title}
            </Link>
          ))}
        </footer>
      </article>
    </main>
  );
}
