import { useEffect } from 'react';

export const SITE_NAME = 'Last Frame';
export const DEFAULT_DESCRIPTION =
  'Last Frame — discover films and TV series, see where to watch them and keep your watchlist in one place.';
export const DEFAULT_IMAGE = '/apple-touch-icon.png';

export interface MetaOptions {
  /** Page title, rendered as "<title> · Last Frame". Omit for the bare site name. */
  title?: string;
  /** Meta/OG/Twitter description. Falls back to the site default. */
  description?: string;
  /** OG/Twitter image (absolute or root-relative URL). Falls back to the brand icon. */
  image?: string;
  /** og:type, defaults to "website". */
  type?: string;
}

type Attr = 'name' | 'property';

interface Tag {
  attr: Attr;
  key: string;
  content: string;
}

export function formatTitle(title?: string): string {
  const t = title?.trim();
  return t ? `${t} · ${SITE_NAME}` : SITE_NAME;
}

function absoluteUrl(url: string): string {
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

/**
 * Upserts a <meta> tag via DOM APIs and returns a function that restores the
 * previous state (previous content, or removal if the tag was created here).
 */
function applyTag({ attr, key, content }: Tag): () => void {
  const head = document.head;
  let el = Array.from(head.getElementsByTagName('meta')).find((m) => m.getAttribute(attr) === key);
  const created = !el;
  const previous = el?.getAttribute('content') ?? null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    head.appendChild(el);
  }
  el.setAttribute('content', content);
  const node = el;
  return () => {
    if (created) {
      node.remove();
    } else if (previous === null) {
      node.removeAttribute('content');
    } else {
      node.setAttribute('content', previous);
    }
  };
}

/**
 * Sets the document title plus description, OpenGraph and Twitter tags for the
 * current page, restoring the previous values when the component unmounts or
 * the inputs change. Uses DOM APIs only (no innerHTML).
 */
export function useMeta({ title, description, image, type = 'website' }: MetaOptions = {}): void {
  useEffect(() => {
    const fullTitle = formatTitle(title);
    const desc = description?.trim() || DEFAULT_DESCRIPTION;
    // Crawlers can't use inline data: URIs (e.g. mock-mode posters), so fall back.
    const img = absoluteUrl(image && !image.startsWith('data:') ? image : DEFAULT_IMAGE);
    const url = absoluteUrl(window.location.pathname + window.location.search);

    const previousTitle = document.title;
    document.title = fullTitle;

    const restores = [
      { attr: 'name', key: 'description', content: desc },
      { attr: 'property', key: 'og:site_name', content: SITE_NAME },
      { attr: 'property', key: 'og:type', content: type },
      { attr: 'property', key: 'og:title', content: fullTitle },
      { attr: 'property', key: 'og:description', content: desc },
      { attr: 'property', key: 'og:url', content: url },
      { attr: 'property', key: 'og:image', content: img },
      { attr: 'name', key: 'twitter:card', content: 'summary' },
      { attr: 'name', key: 'twitter:title', content: fullTitle },
      { attr: 'name', key: 'twitter:description', content: desc },
      { attr: 'name', key: 'twitter:image', content: img },
    ].map((t) => applyTag(t as Tag));

    return () => {
      for (let i = restores.length - 1; i >= 0; i--) restores[i]();
      document.title = previousTitle;
    };
  }, [title, description, image, type]);
}
