import { useEffect } from 'react';
import { useActiveBrand } from './activeBrand';
import { markSvg } from './marks';

const SELECTOR = 'link[rel="icon"][type="image/svg+xml"]';

/**
 * While a brand preview is active, points the SVG favicon at the previewed
 * mark (as a data: URI, so every colourway works) and restores the shipped
 * icon when the preview ends. Mount once, in the app shell.
 */
export function useBrandFavicon(): void {
  const { mark, colourway, isPreview } = useActiveBrand();
  useEffect(() => {
    if (!isPreview) return;
    const link = document.head.querySelector<HTMLLinkElement>(SELECTOR);
    if (!link) return;
    const previous = link.getAttribute('href');
    const svg = markSvg({ mark, colourway, variant: 'tile', size: 64 });
    link.setAttribute('href', `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    return () => {
      if (previous === null) link.removeAttribute('href');
      else link.setAttribute('href', previous);
    };
  }, [mark, colourway, isPreview]);
}
