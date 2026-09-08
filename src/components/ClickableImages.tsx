'use client';
import { useState } from 'react';
import { ImageLightbox } from './ImageLightbox';

/** Dải ảnh thumbnail, bấm vào xem to (lightbox). thumbClass tuỳ chỉnh kích thước ô. */
export function ClickableImages({ imgs, thumbClass = 'h-24 w-24 rounded-lg border object-cover' }: { imgs: { public_url: string }[]; thumbClass?: string }) {
  const [idx, setIdx] = useState(-1);
  if (!imgs.length) return null;
  const srcs = imgs.map((i) => i.public_url);
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {imgs.map((im, i) => (
          <button key={i} type="button" onClick={() => setIdx(i)} className="cursor-zoom-in">
            <img src={im.public_url} alt="ảnh" className={thumbClass + ' hover:opacity-90'} />
          </button>
        ))}
      </div>
      {idx >= 0 && <ImageLightbox srcs={srcs} index={idx} onClose={() => setIdx(-1)} />}
    </>
  );
}
