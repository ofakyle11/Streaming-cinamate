import { useState } from 'react';

interface Props {
  src: string;
}

/** Full-bleed backdrop that fades in once the image has loaded. Decorative only.
 *  Carries the `lf-artwork` view-transition name so the poster that was clicked
 *  morphs into it (motion.css); there is exactly one backdrop per page, and the
 *  "More like this" row opts its cards out so the name is never duplicated. */
export default function TitleBackdrop({ src }: Props) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === src;
  return (
    <div className="title-backdrop" aria-hidden>
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          className={`title-backdrop-img${loaded ? ' loaded' : ''}`}
          onLoad={() => setLoadedSrc(src)}
          data-testid="title-backdrop"
          style={{ viewTransitionName: 'lf-artwork' }}
        />
      )}
      <div className="title-backdrop-fade" />
    </div>
  );
}
