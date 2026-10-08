import { useState } from 'react';
import type { Picture as PictureInfo } from '../data/pictures';

/** A word's illustration, with the emoji as a fallback if the image can't load. */
export function Picture({ picture, className = '' }: { picture: PictureInfo; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`picture sketch ${className}`} role="img" aria-label={picture.alt}>
      {failed
        ? <span aria-hidden="true">{picture.emoji}</span>
        : <img src={picture.src} alt="" draggable={false} onError={() => setFailed(true)} />}
    </div>
  );
}

/** Starts downloading pictures before they're shown. */
export function preloadPictures(pictures: (PictureInfo | null)[]) {
  for (const p of pictures) if (p) new Image().src = p.src;
}
