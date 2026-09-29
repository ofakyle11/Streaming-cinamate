import { useState } from 'react';

interface Props {
  src: string;
}

/** Full-bleed backdrop that fades in once the image has loaded. Decorative only. */
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
        />
      )}
      <div className="title-backdrop-fade" />
    </div>
  );
}
