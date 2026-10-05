import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LegalPage from './LegalPage';
import { renderInline } from './legalInline';
import { EFFECTIVE_DATE, legalDocuments, legalOrder } from '../content/legal';

function renderDoc(doc: (typeof legalOrder)[number]) {
  return render(
    <MemoryRouter initialEntries={[`/${doc}`]}>
      <LegalPage doc={doc} />
    </MemoryRouter>,
  );
}

describe('LegalPage', () => {
  it.each(legalOrder)(
    'renders /%s with its title, date and a section index that matches the headings',
    (doc) => {
      const d = legalDocuments[doc];
      renderDoc(doc);
      expect(document.title).toBe(`${d.title} · Lastframe.tv`);
      expect(screen.getByRole('heading', { level: 1, name: d.title })).toBeInTheDocument();
      expect(screen.getByText(`Effective ${EFFECTIVE_DATE} · Lastframe.tv`)).toBeInTheDocument();

      const toc = within(screen.getByRole('navigation', { name: 'Sections' }));
      const links = toc.getAllByRole('link');
      expect(links.map((a) => a.getAttribute('href'))).toEqual(d.sections.map((s) => `#${s.id}`));
      for (const s of d.sections) {
        expect(screen.getByRole('heading', { level: 2, name: s.heading })).toHaveAttribute(
          'id',
          s.id,
        );
      }
    },
  );

  it.each(legalOrder)('links /%s to the other two documents', (doc) => {
    renderDoc(doc);
    const related = screen.getByText('Also read').parentElement!;
    const hrefs = within(related)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(legalOrder.filter((s) => s !== doc).map((s) => `/${s}`));
  });

  it('keeps the copy on brand', () => {
    const text = JSON.stringify(legalDocuments);
    expect(text).not.toMatch(/cinamate/i);
    expect(text).not.toMatch(/\bPlay\b/);
    expect(text).not.toMatch(/\bmatch(es|ed)?\b/i);
  });

  it('section ids are unique within a document and safe as anchors', () => {
    for (const doc of legalOrder) {
      const ids = legalDocuments[doc].sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('renderInline', () => {
  it('renders bold and links without innerHTML', () => {
    render(
      <MemoryRouter>
        <p>
          {renderInline(
            'See **Supabase** and the [Account page](/account) or [mail](mailto:x@y.z).',
          )}
        </p>
      </MemoryRouter>,
    );
    expect(screen.getByText('Supabase').tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: 'Account page' })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('link', { name: 'mail' })).toHaveAttribute('href', 'mailto:x@y.z');
  });

  it('drops unsafe link schemes but keeps the label', () => {
    const { container } = render(
      <p>
        {renderInline(
          '[click](javascript:alert) and [plain](http://insecure.example) and [proto](//evil.example) and [slash](/\\evil.example) and [data](data:text/html,x)',
        )}
      </p>,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.textContent).toBe('click and plain and proto and slash and data');
  });
});
