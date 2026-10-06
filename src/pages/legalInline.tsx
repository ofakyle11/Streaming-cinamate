import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** `**bold**` or `[text](href)`; everything else is plain text.
 *  Deliberately small: no nesting, no `)` inside an href, no spanning lines. */
const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Only root-relative, https and mailto links are ever rendered. */
function safeHref(href: string): string | null {
  // Root-relative only: `//host` and `/\host` would resolve to another origin.
  if (/^\/(?![/\\])/.test(href)) return href;
  if (/^(https:|mailto:)/i.test(href)) return href;
  return null;
}

/** Turns the tiny inline markup into React nodes without innerHTML. */
export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const [, bold, label, href] = m;
    if (bold !== undefined) {
      out.push(<strong key={key++}>{bold}</strong>);
    } else {
      const safe = safeHref(href);
      if (!safe) {
        out.push(label);
      } else if (safe.startsWith('/')) {
        out.push(
          <Link key={key++} to={safe}>
            {label}
          </Link>,
        );
      } else {
        out.push(
          <a key={key++} href={safe}>
            {label}
          </a>,
        );
      }
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
